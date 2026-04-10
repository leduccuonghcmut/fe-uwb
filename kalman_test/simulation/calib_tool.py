import asyncio
import struct
from winsdk.windows.devices.bluetooth.advertisement import (
    BluetoothLEAdvertisementPublisher,
    BluetoothLEAdvertisement,
    BluetoothLEManufacturerData
)
from winsdk.windows.storage.streams import DataWriter

async def send_calib_cmd():
    # --- THÔNG SỐ ĐẶC BIỆT KÍCH HOẠT CALIB ---
    mac_hex = "FFFF"  # 0xFFFF: Phát broadcast để Tag nào cũng nhận được
    role = 99         # Role 99: Đã quy ước trong code C là cờ kích hoạt phát 0xEC
    node_id = 0       # Tham số này không quan trọng trong luồng Calib

    mac_int = int(mac_hex, 16)
    
    # '<BHBB' nghĩa là: L-Endian, 1 byte, 2 byte, 1 byte, 1 byte
    # 0x43 chính là ký tự 'C' (Magic byte)
    payload = struct.pack('<BHBB', 0x43, mac_int, role, node_id)

    writer = DataWriter()
    writer.write_bytes(payload)

    md = BluetoothLEManufacturerData()
    md.company_id = 0x0059 # ID của Nordic Semiconductor
    md.data = writer.detach_buffer()

    ad = BluetoothLEAdvertisement()
    ad.manufacturer_data.append(md)
    publisher = BluetoothLEAdvertisementPublisher(ad)

    print("==================================================")
    print(" BẮN LỆNH AUTO-CALIBRATION QUA BLE WINDOWS NATIVE")
    print(f" Payload: MAC: {mac_hex} | ROLE: {role} (Trigger) | ID: {node_id}")
    print("==================================================\n")
    print("[*] Đang phát sóng BLE...")
    print("[*] Hãy đợi khoảng 2-3 giây để Tag quét trúng gói tin.")
    print("[*] Nhấn Ctrl + C để tắt sóng và thoát chương trình.\n")

    try:
        # Bật phát sóng BLE liên tục (không chớp tắt như file roleconfig)
        # để đảm bảo Tag quét là dính ngay lập tức
        publisher.start()
        
        # Giữ cho script chạy ngầm để duy trì sóng BLE
        while True:
            await asyncio.sleep(1.0)
            
    except asyncio.CancelledError:
        pass
    finally:
        publisher.stop()
        print("\n[!] Đã tắt sóng BLE.")

if __name__ == "__main__":
    try:
        asyncio.run(send_calib_cmd())
    except KeyboardInterrupt:
        print("\nĐã dừng chương trình thành công.")