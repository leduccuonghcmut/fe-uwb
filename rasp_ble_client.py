#!/usr/bin/env python3
"""
rasp_ble_client.py — Chạy trên Raspberry Pi
============================================
Chức năng:
  1. Quét BLE liên tục và gửi danh sách lên Web qua Socket.IO
  2. Nhận lệnh chọn slot từ Web (1-4) và in ra terminal

Yêu cầu:
  pip install python-socketio[asyncio] bleak asyncio

Cách chạy:
  python3 rasp_ble_client.py --server http://<IP_BE>:3000
  Ví dụ:
  python3 rasp_ble_client.py --server http://192.168.1.100:3000
"""

import asyncio
import argparse
import json
import time
from datetime import datetime

try:
    import socketio
except ImportError:
    print("[ERROR] Thiếu thư viện: pip install 'python-socketio[asyncio]'")
    exit(1)

try:
    from bleak import BleakScanner
    BLEAK_AVAILABLE = True
except ImportError:
    BLEAK_AVAILABLE = False
    print("[WARN] Bleak không có — chạy ở chế độ GIẢ LẬP (mock BLE)")


# ─── CONFIG ───────────────────────────────────────────────────
SCAN_INTERVAL_SEC = 3.0    # Quét BLE mỗi X giây
SCAN_DURATION_SEC = 2.0    # Thời gian mỗi lần quét
SERVER_URL        = "http://localhost:3000"   # Mặc định, override bằng --server


# ─── SOCKET.IO CLIENT ─────────────────────────────────────────
sio = socketio.AsyncClient(reconnection=True, reconnection_attempts=0, logger=False)


@sio.event
async def connect():
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n[{ts}] ✅ Kết nối tới BE thành công\n")


@sio.event
async def disconnect():
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] ❌ Mất kết nối BE — đang thử lại...")


@sio.on("anchor-select")
async def on_anchor_select(data):
    """
    Web bấm vào slot → BE relay về đây → in ra terminal
    """
    slot = data.get("slot")
    ts = datetime.now().strftime("%H:%M:%S")
    # ═══════════════════════════════════════════════
    print(f"\n[{ts}] 🎯 Web đã chọn Slot: {slot}  (A{slot-1})")
    print(f"       {'━' * 36}")
    print(f"       Anchor A{slot-1} → chuẩn bị đo lường...")
    print(f"       {'━' * 36}\n")
    # ═══════════════════════════════════════════════


# ─── BLE SCAN ─────────────────────────────────────────────────
async def scan_ble_real():
    """Thực quét BLE bằng Bleak (cần Raspberry Pi / Linux với BlueZ)."""
    devices = await BleakScanner.discover(timeout=SCAN_DURATION_SEC)
    result = []
    for d in devices:
        result.append({
            "name":    d.name or "",
            "address": d.address,
            "rssi":    d.rssi if hasattr(d, "rssi") else -99,
        })
    # Sắp xếp theo RSSI mạnh nhất lên đầu
    result.sort(key=lambda x: x["rssi"], reverse=True)
    return result


async def scan_ble_mock():
    """Giả lập BLE khi không có Bleak (để test trên Windows/Mac)."""
    await asyncio.sleep(0.5)
    import random
    mock_devices = [
        {"name": "UWB-Anchor-A0", "address": "AA:BB:CC:DD:EE:01", "rssi": random.randint(-55, -45)},
        {"name": "UWB-Anchor-A1", "address": "AA:BB:CC:DD:EE:02", "rssi": random.randint(-70, -58)},
        {"name": "ESP32-Tag-T0",  "address": "FF:EE:DD:CC:BB:01", "rssi": random.randint(-80, -65)},
        {"name": "",               "address": "11:22:33:44:55:66", "rssi": random.randint(-95, -82)},
        {"name": "BT-Speaker",     "address": "AA:11:BB:22:CC:33", "rssi": random.randint(-88, -75)},
    ]
    mock_devices.sort(key=lambda x: x["rssi"], reverse=True)
    return mock_devices


async def ble_scan_loop():
    """Vòng lặp quét BLE và gửi lên BE."""
    scan_fn = scan_ble_real if BLEAK_AVAILABLE else scan_ble_mock
    mode_label = "THỰC" if BLEAK_AVAILABLE else "GIẢ LẬP"

    print(f"[BLE] Bắt đầu quét BLE ({mode_label}) — interval={SCAN_INTERVAL_SEC}s")

    while True:
        if sio.connected:
            try:
                devices = await scan_fn()
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] 📡 BLE scan: {len(devices)} thiết bị → gửi lên Web")

                # In bảng thiết bị ra terminal
                if devices:
                    print(f"       {'TÊN':<22} {'ĐỊA CHỈ':<20} {'RSSI':>6}")
                    print(f"       {'─'*22} {'─'*20} {'─'*6}")
                    for d in devices:
                        name = (d['name'] or 'Unknown')[:22]
                        print(f"       {name:<22} {d['address']:<20} {d['rssi']:>5} dBm")
                    print()

                await sio.emit("ble-scan-result", devices)

            except Exception as e:
                print(f"[BLE ERROR] {e}")

        await asyncio.sleep(SCAN_INTERVAL_SEC)


# ─── MAIN ─────────────────────────────────────────────────────
async def main(server_url: str):
    print("=" * 50)
    print("  UWB Raspberry Pi — BLE Client")
    print(f"  Server : {server_url}")
    print(f"  BLE    : {'bleak (thực)' if BLEAK_AVAILABLE else 'mock (giả lập)'}")
    print("=" * 50)
    print()

    while True:
        try:
            await sio.connect(server_url, transports=["websocket"])
            # Chạy song song: BLE scan loop
            await asyncio.gather(
                sio.wait(),
                ble_scan_loop(),
            )
        except Exception as e:
            print(f"[CONNECT ERROR] {e} — thử lại sau 5s...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UWB Raspberry Pi BLE Client")
    parser.add_argument(
        "--server",
        default=SERVER_URL,
        help=f"URL của BE server (default: {SERVER_URL})"
    )
    args = parser.parse_args()

    try:
        asyncio.run(main(args.server))
    except KeyboardInterrupt:
        print("\n[EXIT] Dừng chương trình.")
