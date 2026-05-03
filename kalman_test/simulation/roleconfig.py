import asyncio
import struct
from winsdk.windows.devices.bluetooth.advertisement import (
    BluetoothLEAdvertisementPublisher,
    BluetoothLEAdvertisement,
    BluetoothLEManufacturerData
)
from winsdk.windows.storage.streams import DataWriter

async def send_ble_windows():
    mac_hex = "8629"
    role = 2
    node_id = 0
    mac_int = int(mac_hex, 16)
    # '<BHBB' nghĩa là: L-Endian, 1 byte, 2 byte, 1 byte, 1 byte
    payload = struct.pack('<BHBB', 0x43, mac_int, role, node_id)

    writer = DataWriter()
    # SỬA Ở ĐÂY: Truyền trực tiếp payload (vì nó đã là bytes object)
    writer.write_bytes(payload)

    md = BluetoothLEManufacturerData()
    md.company_id = 0x0059
    md.data = writer.detach_buffer()

    ad = BluetoothLEAdvertisement()
    ad.manufacturer_data.append(md)
    publisher = BluetoothLEAdvertisementPublisher(ad)

    print("=========================================")
    print(f"CẤU HÌNH SẼ PHÁT - MAC: {mac_hex} | ROLE: {role} | ID: {node_id}")
    print("Chế độ: Phát định kỳ mỗi 5 giây (Nhấn Ctrl+C để thoát)")
    print("=========================================\n")

    count = 1
    try:
        while True:
            print(f"[Lần {count}] Đang bật sóng (5s)...")
            publisher.start()
            
            # Phát liên tục trong 5 giây
            await asyncio.sleep(7.0)
            
            # Dừng phát và nghỉ 3 giây (Tổng chu kỳ = 5s)
            publisher.stop()
            print(f"[Lần {count}] Đã tắt. Chờ 3 giây tới nhịp tiếp theo...\n")
            await asyncio.sleep(3.0)
            
            count += 1
            
    except asyncio.CancelledError:
        publisher.stop()

if __name__ == "__main__":
    try:
        asyncio.run(send_ble_windows())
    except KeyboardInterrupt:
        print("\nĐã dừng chương trình thành công.")