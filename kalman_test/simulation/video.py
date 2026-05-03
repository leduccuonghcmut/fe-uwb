import asyncio
import struct
import time
import socketio
from bleak import BleakScanner
from winsdk.windows.devices.bluetooth.advertisement import (
    BluetoothLEAdvertisementPublisher,
    BluetoothLEAdvertisement,
    BluetoothLEManufacturerData
)
from winsdk.windows.storage.streams import DataWriter

# Import bộ lọc Kalman
from gmc_kalman import IMM_GMC_Kalman

# ======================================================================
# CẤU HÌNH KẾT NỐI SERVER
# ======================================================================
SERVER_URL = "http://localhost:3000"

sio = socketio.AsyncClient()
config_queue = asyncio.Queue()

anchors_state = {}
last_anchor_send_time = 0

# --- Quản lý bộ lọc cho từng Tag ---
tag_filters = {}
last_tag_timestamp = {} 

# Biến toàn cục để quản lý tiến trình phát sóng hiện tại
current_publisher = None
current_adv_task = None

# ======================================================================
# 1. BLE ADVERTISER (CHẠY THẬT TRÊN WINDOWS DÙNG WINSDK)
# ======================================================================
def stop_publisher():
    """Hàm phụ trợ để tắt an toàn Publisher của Windows"""
    global current_publisher
    if current_publisher is not None:
        try:
            current_publisher.stop()
        except:
            pass
        current_publisher = None

async def broadcast_windows_payload(company_id, payload_bytes, duration=5.0):
    global current_publisher
    
    stop_publisher()

    writer = DataWriter()
    writer.write_bytes(payload_bytes)

    md = BluetoothLEManufacturerData()
    md.company_id = company_id
    md.data = writer.detach_buffer()

    ad = BluetoothLEAdvertisement()
    ad.manufacturer_data.append(md)
    
    current_publisher = BluetoothLEAdvertisementPublisher(ad)
    
    try:
        current_publisher.start()
        await asyncio.sleep(duration)
    except asyncio.CancelledError:
        pass
    finally:
        stop_publisher()
        print("---> [ADV] Đã tắt phát sóng BLE trên Windows.\n")

async def advertiser_worker():
    global current_adv_task
    print("[ADV WORKER] Đã khởi động bộ phát Bluetooth trên Windows.")
    while True:
        config = await config_queue.get()
        
        if current_adv_task and not current_adv_task.done():
            current_adv_task.cancel()
            
        cmd_type = config.get("cmd_type", "role")
        
        if cmd_type == "role":
            mac_hex = config.get("mac", "0000")
            role = int(config.get("role", 0))
            node_id = int(config.get("id", 0))
            
            if mac_hex.upper() == "FFFF":
                mac_int = 0xFFFF
            else:
                mac_int = int(mac_hex, 16)
                
            payload = struct.pack('<BHBB', 0x43, mac_int, role, node_id)
            if role == 0:
                print(f"\n---> [ADV] ĐÃ BẬT LỆNH RESET VỀ PENDING: MAC={mac_hex}")
            else:
                print(f"\n---> [ADV] ĐÃ BẬT PHÁT CẤU HÌNH: MAC={mac_hex} | Role={role} | ID={node_id}")
            
            current_adv_task = asyncio.create_task(broadcast_windows_payload(0x0059, payload, duration=6.0))
            
        elif cmd_type == "coord":
            a_id_str = config.get("id", "")
            if isinstance(a_id_str, str) and a_id_str.startswith("A"):
                node_id = int(a_id_str.replace("A", ""))
            else:
                node_id = int(a_id_str)
                
            x = config.get("x", 0.0)
            y = config.get("y", 0.0)
            
            payload = struct.pack('<BBff', 0x47, int(node_id), float(x), float(y))
            print(f"\n---> [ADV] ĐÃ BẬT PHÁT TỌA ĐỘ TỪ WEB: Anchor A{node_id} -> (X={x}, Y={y})")
            
            current_adv_task = asyncio.create_task(broadcast_windows_payload(0x0059, payload, duration=5.0))
        
        config_queue.task_done()

# ======================================================================
# 2. BLE SCANNER (NGHE DỮ LIỆU TỪ MẠCH)
# ======================================================================
def detection_callback(device, advertisement_data):
    global anchors_state, last_anchor_send_time, tag_filters, last_tag_timestamp

    for company_id, data in advertisement_data.manufacturer_data.items():
        # --- PENDING DEVICE ---
        if len(data) == 3 and data[0] == 85: # 85 = 0x55 ('U')
            try:
                mac_val = data[1] | (data[2] << 8)
                mac_hex = f"{mac_val:04X}"
                dev_info = {"mac": mac_hex, "role": 0, "id": 0}
                print(f"[SCAN] NEW DEVICE PENDING - MAC: {mac_hex}")
                
                async def send_new_device():
                    if sio.connected:
                        await sio.emit("new-device", dev_info)
                asyncio.create_task(send_new_device())
                continue 
            except Exception as e:
                pass

        # --- TAG (XỬ LÝ 15 BYTES VÀ KALMAN CHỐNG NHIỄU DT) ---
        elif len(data) == 15 and data[0] == 123: # 123 = 0x7B ('{')
            try:
                unpacked = struct.unpack('<BBBLff', data)
                tid = unpacked[1]
                seq = unpacked[2]
                timestamp_ms = unpacked[3]
                raw_x = unpacked[4]
                raw_y = unpacked[5]

                # Lọc IMM-GMC
                if tid not in tag_filters:
                    tag_filters[tid] = IMM_GMC_Kalman(q=0.8, r=0.05, alpha=1.5, beta=0.5)
                    tag_filters[tid].reset(raw_x, raw_y)
                    last_tag_timestamp[tid] = timestamp_ms
                    fused_x, fused_y = raw_x, raw_y
                    print(f"[FILTER INIT] Bắt đầu theo dõi TAG {tid}")
                else:
                    prev_time = last_tag_timestamp[tid]
                    
                    # --- XỬ LÝ LỖI DT VÀ TRÙNG LẶP GÓI TIN ---
                    if timestamp_ms == prev_time:
                        dt = 0.0
                    elif timestamp_ms < prev_time:
                        dt = 0.1 # MCU bị reset
                    else:
                        dt = (timestamp_ms - prev_time) / 1000.0

                    last_tag_timestamp[tid] = timestamp_ms

                    # Bảo vệ: Nếu dt quá lớn một cách vô lý (do kẹt mạng), giới hạn lại hoặc reset
                    if dt > 2.0:
                        tag_filters[tid].reset(raw_x, raw_y)
                        fused_x, fused_y = raw_x, raw_y
                        print(f"[FILTER RESET] TAG {tid} mất sóng ({dt:.2f}s), reset vị trí.")
                    elif dt > 0.0:
                        # Chỉ chạy predict khi dt > 0 thực sự
                        tag_filters[tid].predict(dt)
                        fused_x, fused_y = tag_filters[tid].update([raw_x, raw_y])
                    else:
                        # Gói tin trùng lặp, chỉ lấy luôn kết quả hiện tại mà không chạy lại update/predict
                        # Do thiết kế bộ lọc hiện tại, ta tính lại dựa trên giá trị đã lưu
                        fused_x = tag_filters[tid].mode_prob[0] * tag_filters[tid].models[0].x[0] + tag_filters[tid].mode_prob[1] * tag_filters[tid].models[1].x[0]
                        fused_y = tag_filters[tid].mode_prob[0] * tag_filters[tid].models[0].x[1] + tag_filters[tid].mode_prob[1] * tag_filters[tid].models[1].x[1]

                final_x = round(fused_x, 2)
                final_y = round(fused_y, 2)

                print(f"[SCAN] TAG {tid} | Seq {seq:03d} | RAW: ({raw_x:5.2f}, {raw_y:5.2f}) -> LỌC: ({final_x:5.2f}, {final_y:5.2f})")
                
                async def send_tag():
                    if sio.connected:
                        await sio.emit("tag-update", {"id": tid, "x": final_x, "y": final_y})
                asyncio.create_task(send_tag())
            except Exception as e:
                print(f"Lỗi parse TAG: {e}")

        # --- ANCHOR ---
        elif len(data) == 11 and data[0] == 91: # 91 = 0x5B ('[')
            try:
                unpacked = struct.unpack('<BBBff', data)
                aid = unpacked[1]
                seq = unpacked[2]
                ax = round(unpacked[3], 2)
                ay = round(unpacked[4], 2)

                anchor_key = f"A{aid}"
                anchors_state[anchor_key] = {"x": ax, "y": ay, "z": 0.0}

                current_time = time.time()
                if current_time - last_anchor_send_time > 1.0:
                    async def send_anchors():
                        if sio.connected and anchors_state:
                            await sio.emit("anchors-update", anchors_state.copy())
                    asyncio.create_task(send_anchors())
                    last_anchor_send_time = current_time
            except Exception as e:
                pass

async def start_scanner():
    scanner = BleakScanner(detection_callback)
    await scanner.start()
    print("[SCANNER] Đã bật Bluetooth Scanner trên Windows.")

# ======================================================================
# 3. KẾT NỐI SOCKET.IO
# ======================================================================
@sio.event
async def connect():
    print("✅ Đã kết nối Socket.IO thành công tới Server!")

@sio.event
async def disconnect():
    print("❌ Đã mất kết nối tới Server.")

@sio.on("set-device-role")
async def on_set_device_role(data):
    print(f"\n[SOCKET NHẬN] Yêu cầu Set Role: {data}")
    await config_queue.put({
        "cmd_type": "role",
        "mac": data.get("mac"),
        "role": data.get("role"),
        "id": data.get("id")
    })

@sio.on("update_anchor")
async def on_update_anchor(data):
    print(f"\n[SOCKET NHẬN] Yêu cầu Update Tọa độ Anchor: {data}")
    await config_queue.put({
        "cmd_type": "coord",
        "id": data.get("id"),
        "x": data.get("x"),
        "y": data.get("y")
    })

# ======================================================================
# 4. CHẠY TOÀN BỘ HỆ THỐNG
# ======================================================================
async def main():
    print("=== ĐANG KHỞI ĐỘNG UWB GATEWAY (NATIVE WINDOWS MODE) ===")
    asyncio.create_task(advertiser_worker())
    await start_scanner()
    try:
        await sio.connect(SERVER_URL, transports=['websocket'])
        await sio.wait()
    except Exception as e:
        print(f"Lỗi kết nối Socket.IO: {e}")
        print("Vui lòng đảm bảo Server Node.js đang chạy và IP chính xác!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        stop_publisher()
        print("\nĐã tắt Gateway.")