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
    pass  # Không in log khi kết nối

@sio.event
async def connect_error(data):
    print("Socket.IO ket noi loi:", data)

@sio.event
async def disconnect():
    pass  # Không in log khi ngắt kết nối

async def main():
    global loop
    loop = asyncio.get_running_loop()

    # Chỉ in thông tin khởi động tối thiểu
    print("Dang quet UWB/BLE va gui du lieu len server...")
    print("Su dung Payload rut gon (11 Bytes).")
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

        # ==================== TAG ====================
        if len(data) == 11 and data[0] == 123:  # '{'
            try:
                unpacked = struct.unpack('<c B B f f', data)

                x = round(unpacked[3], 2)
                y = round(unpacked[4], 2)

                async def send_tag():
                    if sio.connected:
                        try:
                            await sio.emit("tag-update", {"x": x, "y": 1.6, "z": y})
                        except:
                            pass

                if loop:
                    loop.create_task(send_tag())

            except Exception as e:
                print("Loi unpack Tag:", e)

        # ==================== ANCHOR ====================
        elif len(data) == 11 and data[0] == 91:  # '['
            try:
                unpacked = struct.unpack('<c B B f f', data)
                aid = unpacked[1]
                ax = round(unpacked[3], 2)
                ay = round(unpacked[4], 2)

                anchor_key = f"A{aid}"

                anchors_state[anchor_key] = {"x": ax, "y": 2.0, "z": ay}

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
        pass  # Không in thông báo dừng
    except Exception as e:
        print("Loi:", e)