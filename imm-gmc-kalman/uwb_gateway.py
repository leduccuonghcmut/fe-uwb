# uwb_gateway.py
# ======================================================================
# UWB BLE-to-Socket.io Gateway
# Receives coordinates solved via IM-IRLS on-board from UWB tags,
# filters noise with IMM-GMC-Kalman, logs to vitri.txt, and sends to web.
# Relays coordinates/role updates from web to hardware nodes via BLE.
# ======================================================================

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

# Import filter module
from gmc_kalman import IMM_GMC_Kalman

# Node.js backend configuration
SERVER_URL = "http://localhost:3000"

sio = socketio.AsyncClient()
config_queue = asyncio.Queue()

anchors_state = {}
last_anchor_send_time = 0

# Active filters managed per Tag ID
tag_filters = {}
last_tag_timestamp = {} 

current_publisher = None
current_adv_task = None

# ======================================================================
# 1. BLE Advertiser (Downlink Commands)
# ======================================================================
def stop_publisher():
    """Stops the active Windows BLE advertiser."""
    global current_publisher
    if current_publisher is not None:
        try:
            current_publisher.stop()
        except:
            pass
        current_publisher = None

# async def broadcast_windows_payload(company_id, payload_bytes, duration=5.0):
#     """Publishes a manufacturer-specific BLE advertisement payload."""
#     global current_publisher
#     stop_publisher()

#     writer = DataWriter()
#     writer.write_bytes(payload_bytes)

#     md = BluetoothLEManufacturerData()
#     md.company_id = company_id
#     md.data = writer.detach_buffer()

#     ad = BluetoothLEAdvertisement()
#     ad.manufacturer_data.append(md)
    
#     current_publisher = BluetoothLEAdvertisementPublisher(ad)
    
#     try:
#         current_publisher.start()
#         await asyncio.sleep(duration)
#     except asyncio.CancelledError:
#         pass
#     finally:
#         stop_publisher()
#         print("[ADV] BLE configuration broadcast stopped.")

async def broadcast_windows_payload(company_id, payload_bytes, duration=5.0):
    writer = DataWriter()
    writer.write_bytes(payload_bytes)
    md = BluetoothLEManufacturerData()
    md.company_id = company_id
    md.data = writer.detach_buffer()
    ad = BluetoothLEAdvertisement()
    ad.manufacturer_data.append(md)
    publisher = BluetoothLEAdvertisementPublisher(ad)
    try:
        publisher.start()
        await asyncio.sleep(duration)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            publisher.stop()
        except:
            pass
        print("[ADV] BLE configuration broadcast stopped.")


async def advertiser_worker():
    """Worker task processing device command queue."""
    global current_adv_task
    print("[ADV WORKER] Windows BLE advertiser worker initialized.")
    while True:
        config = await config_queue.get()
        
        if current_adv_task and not current_adv_task.done():
            current_adv_task.cancel()
            
        cmd_type = config.get("cmd_type", "role")
        
        # A. Node role configuration (ID / Role)
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
                print(f"[ADV] Sending Reset to Pending: MAC={mac_hex}")
            else:
                print(f"[ADV] Sending Role Config: MAC={mac_hex} | Role={role} | ID={node_id}")
            
            current_adv_task = asyncio.create_task(broadcast_windows_payload(0x0059, payload, duration=11.0))
            
        # B. Anchor coordinates configuration
        elif cmd_type == "coord":
            a_id_str = config.get("id", "")
            if isinstance(a_id_str, str) and a_id_str.startswith("A"):
                node_id = int(a_id_str.replace("A", ""))
            else:
                node_id = int(a_id_str)
                
            x = config.get("x", 0.0)
            y = config.get("y", 0.0)
            
            payload = struct.pack('<BBff', 0x47, int(node_id), float(x), float(y))
            print(f"[ADV] Sending Anchor Coord Config: A{node_id} -> (X={x}, Y={y})")
            
            current_adv_task = asyncio.create_task(broadcast_windows_payload(0x0059, payload, duration=11.0))
        
        config_queue.task_done()

# ======================================================================
# 2. BLE Scanner (Uplink Telemetry)
# ======================================================================
def detection_callback(device, advertisement_data):
    """Receives and parses BLE advertisement packets from UWB nodes."""
    global anchors_state, last_anchor_send_time, tag_filters, last_tag_timestamp

    for company_id, data in advertisement_data.manufacturer_data.items():
        
        # --- A. New Unconfigured Device (Pending, 3 Bytes) ---
        if len(data) == 3 and data[0] == 85: # 0x55 ('U')
            try:
                mac_val = data[1] | (data[2] << 8)
                mac_hex = f"{mac_val:04X}"
                dev_info = {"mac": mac_hex, "role": 0, "id": 0}
                print(f"[SCAN] New pending device detected: MAC={mac_hex}")
                
                async def send_new_device():
                    if sio.connected:
                        await sio.emit("new-device", dev_info)
                asyncio.create_task(send_new_device())
                continue 
            except Exception as e:
                pass

        # --- B. Tag Position Data (15 Bytes - Solved by IM-IRLS on-board) ---
        elif len(data) == 15 and data[0] == 123: # 0x7B ('{')
            try:
                unpacked = struct.unpack('<BBBLff', data)
                tid = unpacked[1]
                seq = unpacked[2]
                timestamp_ms = unpacked[3]
                raw_x = unpacked[4]   # Raw X position resolved via IM-IRLS on Tag
                raw_y = unpacked[5]   # Raw Y position resolved via IM-IRLS on Tag

                # Initialize IMM-GMC-Kalman filter for new Tag IDs
                if tid not in tag_filters:
                    tag_filters[tid] = IMM_GMC_Kalman(q=0.8, r=0.05, alpha=1.5, beta=0.5)
                    tag_filters[tid].reset(raw_x, raw_y)
                    last_tag_timestamp[tid] = timestamp_ms
                    fused_x, fused_y = raw_x, raw_y
                    print(f"[FILTER] Initialized filter tracking for Tag {tid}")
                else:
                    prev_time = last_tag_timestamp[tid]
                    
                    # Calculate dt (seconds) between sequential packets
                    if timestamp_ms == prev_time:
                        dt = 0.0
                    elif timestamp_ms < prev_time:
                        dt = 0.1  # Handle MCU resets
                    else:
                        dt = (timestamp_ms - prev_time) / 1000.0

                    last_tag_timestamp[tid] = timestamp_ms

                    # Reset filter state if offline for too long
                    if dt > 2.0:
                        tag_filters[tid].reset(raw_x, raw_y)
                        fused_x, fused_y = raw_x, raw_y
                        print(f"[FILTER RESET] Tag {tid} disconnected for {dt:.2f}s, resetting position.")
                    elif dt > 0.0:
                        # Predict and Update cycle
                        tag_filters[tid].predict(dt)
                        fused_x, fused_y = tag_filters[tid].update([raw_x, raw_y])
                    else:
                        # Re-use previous state for duplicate packets
                        fused_x = tag_filters[tid].mode_prob[0] * tag_filters[tid].models[0].x[0] + tag_filters[tid].mode_prob[1] * tag_filters[tid].models[1].x[0]
                        fused_y = tag_filters[tid].mode_prob[0] * tag_filters[tid].models[0].x[1] + tag_filters[tid].mode_prob[1] * tag_filters[tid].models[1].x[1]

                final_x = round(fused_x, 2)
                final_y = round(fused_y, 2)

                print(f"[SCAN] Tag {tid} | Seq {seq:03d} | Raw: ({raw_x:5.2f}, {raw_y:5.2f}) -> Filtered: ({final_x:5.2f}, {final_y:5.2f})")
                
                # Write current position to local cache
                with open("vitri.txt", "w") as f:
                    f.write(f"{seq},{final_x},{final_y}")
                
                # Broadcast filtered coordinate to Node.js backend
                async def send_tag():
                    if sio.connected:
                        await sio.emit("tag-update", {"id": tid, "x": final_x, "y": final_y})
                asyncio.create_task(send_tag())
            except Exception as e:
                print(f"[ERROR] Failed to parse Tag package: {e}")

        # --- C. Anchor Location Data (11 Bytes) ---
        elif len(data) == 11 and data[0] == 91: # 0x5B ('[')
            try:
                unpacked = struct.unpack('<BBBff', data)
                aid = unpacked[1]
                seq = unpacked[2]
                ax = round(unpacked[3], 2)
                ay = round(unpacked[4], 2)

                anchor_key = f"A{aid}"
                anchors_state[anchor_key] = {"x": ax, "y": ay, "z": 0.0}

                current_time = time.time()
                # Rate limit anchor updates to prevent socket flooding
                if current_time - last_anchor_send_time > 1.0:
                    async def send_anchors():
                        if sio.connected and anchors_state:
                            await sio.emit("anchors-update", anchors_state.copy())
                    asyncio.create_task(send_anchors())
                    last_anchor_send_time = current_time
            except Exception as e:
                pass

async def start_scanner():
    """Initializes the Bleak scanner object."""
    scanner = BleakScanner(detection_callback)
    await scanner.start()
    print("[SCANNER] Scanning BLE advertising packets from UWB nodes...")

# ======================================================================
# 3. Socket.io Events (Downlink Command Subscriptions)
# ======================================================================
@sio.event
async def connect():
    print("[SOCKET] Connected successfully to Node.js server.")

@sio.event
async def disconnect():
    print("[SOCKET] Disconnected from Node.js server.")

@sio.on("set-device-role")
async def on_set_device_role(data):
    """Triggers role command packaging on backend message request."""
    print(f"[SOCKET IN] Device config command: {data}")
    await config_queue.put({
        "cmd_type": "role",
        "mac": data.get("mac"),
        "role": data.get("role"),
        "id": data.get("id")
    })

@sio.on("update_anchor")
async def on_update_anchor(data):
    """Triggers coordinate advertisement updates on web modification."""
    print(f"[SOCKET IN] Anchor coordinate update: {data}")
    await config_queue.put({
        "cmd_type": "coord",
        "id": data.get("id"),
        "x": data.get("x"),
        "y": data.get("y")
    })

# ======================================================================
# 4. Main Gateway Entry
# ======================================================================
async def main():
    print("=== STARTING UWB GATEWAY (NATIVE WINDOWS MODE) ===")
    asyncio.create_task(advertiser_worker())
    await start_scanner()
    try:
        await sio.connect(SERVER_URL, transports=['websocket'])
        await sio.wait()
    except Exception as e:
        print(f"[SOCKET ERROR] Failed to connect: {e}")
        print("[SOCKET ERROR] Please verify the Node.js server status and connection URL.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        stop_publisher()
        print("[GATEWAY] UWB Gateway shutdown completed.")
