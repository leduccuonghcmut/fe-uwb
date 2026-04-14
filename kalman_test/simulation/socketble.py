# socketble.py
import asyncio
import struct
import time
import socketio
from bleak import BleakScanner

sio = socketio.AsyncClient(logger=False, engineio_logger=False)
loop = None

anchors_state = {}
last_anchor_send_time = 0

@sio.event
async def connect():
    pass  

@sio.event
async def connect_error(data):
    print("Socket.IO ket noi loi:", data)

@sio.event
async def disconnect():
    pass  

async def main():
    global loop
    loop = asyncio.get_running_loop()

    print("Dang quet UWB/BLE va gui du lieu len server...")
    print("He thong BLE 2D (11 Bytes) -> Server Socket 3D (Z=0.0).")
    print("Bam Ctrl+C de dung.\n")

    try:
        await sio.connect("http://localhost:3000", transports=["websocket", "polling"])
    except Exception as e:
        print("Khong the ket noi Socket.IO:", e)

    scanner = BleakScanner(detection_callback)
    await scanner.start()

    try:
        while True:
            await asyncio.sleep(0.03)
    finally:
        await scanner.stop()
        if sio.connected:
            await sio.disconnect()

def detection_callback(device, advertisement_data):
    global loop, anchors_state, last_anchor_send_time

    for company_id, data in advertisement_data.manufacturer_data.items():
        
        # ==================== PENDING DEVICE (ROLE = 0) ====================
        if len(data) == 3 and data[0] == 85:
            try:
                # Phục hồi giá trị MAC (dạng số nguyên)
                mac_val = data[1] | (data[2] << 8)
                
                # Ép kiểu format thành chuỗi Hex (4 ký tự, in hoa) để giống với C (%04X)
                mac_hex = f"{mac_val:04X}"
                
                dev_info = {"mac": mac_hex, "role": 0, "id": 0}
                
                print(f"[NEW DEVICE PENDING] MAC: {mac_hex} | Role: 0 | ID: 0")
                
                async def send_new_device():
                    if sio.connected:
                        try:
                            await sio.emit("new-device", dev_info)
                        except:
                            pass
                
                if loop:
                    loop.create_task(send_new_device())
                continue 
            except Exception as e:
                print("Loi unpack Pending Device:", e)

        # ==================== TAG ====================
        elif len(data) == 11 and data[0] == 123:
            try:
                unpacked = struct.unpack('<BBBff', data)
                
                tid = unpacked[1]
                seq = unpacked[2]
                x = round(unpacked[3], 2)
                y = round(unpacked[4], 2)
                z = 0.0

                print(f"TAG  id={tid} seq={seq} -> (x={x} y={z} z={y})")

                async def send_tag():
                    if sio.connected:
                        try:
                            await sio.emit("tag-update", {"id": tid, "x": x, "y": z, "z": y})
                        except:
                            pass

                if loop:
                    loop.create_task(send_tag())

            except Exception as e:
                print("Loi unpack Tag:", e)

        # ==================== ANCHOR ====================
        elif len(data) == 11 and data[0] == 91:
            try:
                unpacked = struct.unpack('<BBBff', data)
                
                aid = unpacked[1]
                seq = unpacked[2]
                ax = round(unpacked[3], 2)
                ay = round(unpacked[4], 2)
                az = 0.0

                anchor_key = f"A{aid}"
                anchors_state[anchor_key] = {"x": ax, "y": az, "z": ay}

                print(f"ANCHOR {anchor_key} seq={seq} -> (x={ax} y={az} z={ay})")

                current_time = time.time()
                if current_time - last_anchor_send_time > 1.0:

                    async def send_anchors():
                        if sio.connected and anchors_state:
                            try:
                                await sio.emit("anchors-update", anchors_state.copy())
                            except:
                                pass

                    if loop:
                        loop.create_task(send_anchors())

                    last_anchor_send_time = current_time

            except Exception as e:
                print("Loi unpack Anchor:", e)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print("Loi:", e)