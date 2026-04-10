// src/pages/AnchorSetup/AnchorSetup.jsx
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import styles from "./AnchorSetup.module.css";

const SLOT_LABELS = ["A0", "A1", "A2", "A3"];
const SOCKET_URL = "http://localhost:3000";

export default function AnchorSetup() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [bleDevices, setBleDevices] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);      // slot đang active (1-4)
    const [slotDevices, setSlotDevices] = useState({             // device gắn vào từng slot
        1: null, 2: null, 3: null, 4: null,
    });
    const [scanTime, setScanTime] = useState(null);
    const [log, setLog] = useState([]);

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString("vi-VN");
        setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 80));
    };

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
            addLog("✅ Kết nối tới BE thành công");
        });

        socket.on("disconnect", () => {
            setConnected(false);
            addLog("❌ Mất kết nối BE");
        });

        // Nhận danh sách BLE từ Raspberry Pi (qua BE relay)
        socket.on("ble-scan-result", (devices) => {
            if (Array.isArray(devices)) {
                setBleDevices(devices);
                setScanTime(new Date().toLocaleTimeString("vi-VN"));
                addLog(`📡 BLE scan: ${devices.length} thiết bị`);
            }
        });

        // Phản hồi khi BE xác nhận slot đã được chọn
        socket.on("anchor-select", (data) => {
            addLog(`🎯 BE xác nhận slot ${data.slot} → đã gửi tới Raspberry Pi`);
        });

        return () => socket.disconnect();
    }, []);

    const handleSlotClick = (slotNumber) => {
        setSelectedSlot(slotNumber);
        socketRef.current?.emit("anchor-select", { slot: slotNumber });
        addLog(`🖱 Chọn slot ${slotNumber} (A${slotNumber - 1}) → gửi lệnh tới Raspberry Pi`);
    };

    const handleAssignDevice = (slotNumber, device) => {
        setSlotDevices((prev) => ({ ...prev, [slotNumber]: device }));
        addLog(`📌 Gán ${device.name || device.address} → Slot ${slotNumber} (A${slotNumber - 1})`);
    };

    const getRssiColor = (rssi) => {
        if (rssi >= -60) return "#22c55e";
        if (rssi >= -75) return "#f59e0b";
        return "#ef4444";
    };

    const getRssiLabel = (rssi) => {
        if (rssi >= -60) return "Mạnh";
        if (rssi >= -75) return "Trung bình";
        return "Yếu";
    };

    return (
        <div className={styles.page}>
            {/* HEADER */}
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1 className={styles.title}>Anchor Setup</h1>
                    <p className={styles.subtitle}>Quét BLE và gán thiết bị vào từng slot anchor</p>
                </div>
                <div className={`${styles.statusBadge} ${connected ? styles.online : styles.offline}`}>
                    <span className={styles.statusDot} />
                    {connected ? "BE Connected" : "BE Offline"}
                </div>
            </div>

            <div className={styles.mainGrid}>
                {/* PANEL TRÁI: 4 ANCHOR SLOTS */}
                <div className={styles.leftPanel}>
                    <div className={styles.panelTitle}>
                        <i className="ri-router-line" /> Anchor Slots
                    </div>
                    <p className={styles.panelHint}>
                        Bấm vào slot → Raspberry Pi sẽ in số slot ra terminal
                    </p>

                    <div className={styles.slotGrid}>
                        {[1, 2, 3, 4].map((slot) => (
                            <div
                                key={slot}
                                id={`anchor-slot-${slot}`}
                                className={`${styles.slotCard} ${selectedSlot === slot ? styles.slotActive : ""}`}
                                onClick={() => handleSlotClick(slot)}
                            >
                                <div className={styles.slotLabel}>A{slot - 1}</div>
                                <div className={styles.slotNumber}>Slot {slot}</div>

                                {slotDevices[slot] ? (
                                    <div className={styles.slotAssigned}>
                                        <div className={styles.assignedName}>
                                            {slotDevices[slot].name || "Unknown"}
                                        </div>
                                        <div className={styles.assignedAddr}>
                                            {slotDevices[slot].address}
                                        </div>
                                        <div
                                            className={styles.assignedRssi}
                                            style={{ color: getRssiColor(slotDevices[slot].rssi) }}
                                        >
                                            RSSI: {slotDevices[slot].rssi} dBm
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.slotEmpty}>Chưa gán thiết bị</div>
                                )}

                                {selectedSlot === slot && (
                                    <div className={styles.slotPulse} />
                                )}
                            </div>
                        ))}
                    </div>

                    {selectedSlot && (
                        <div className={styles.selectedInfo}>
                            ✅ Đang chọn: <strong>Slot {selectedSlot} (A{selectedSlot - 1})</strong>
                            <br />
                            <span className={styles.selectedHint}>
                                Click vào thiết bị BLE bên phải để gán vào slot này
                            </span>
                        </div>
                    )}
                </div>

                {/* PANEL PHẢI: BLE DEVICE LIST */}
                <div className={styles.rightPanel}>
                    <div className={styles.panelTitleRow}>
                        <div className={styles.panelTitle}>
                            <i className="ri-bluetooth-line" /> BLE Devices
                        </div>
                        {scanTime && (
                            <span className={styles.scanTime}>Cập nhật lúc {scanTime}</span>
                        )}
                    </div>
                    <p className={styles.panelHint}>
                        Danh sách thiết bị BLE do Raspberry Pi quét và gửi lên realtime
                    </p>

                    {bleDevices.length === 0 ? (
                        <div className={styles.emptyBle}>
                            <div className={styles.emptyIcon}>📡</div>
                            <div className={styles.emptyText}>Đang chờ kết quả quét BLE...</div>
                            <div className={styles.emptyHint}>
                                Chạy <code>rasp_ble_client.py</code> trên Raspberry Pi
                            </div>
                        </div>
                    ) : (
                        <div className={styles.deviceList}>
                            {bleDevices.map((device, idx) => (
                                <div
                                    key={device.address || idx}
                                    id={`ble-device-${idx}`}
                                    className={styles.deviceCard}
                                    onClick={() => selectedSlot && handleAssignDevice(selectedSlot, device)}
                                    style={{ cursor: selectedSlot ? "pointer" : "default" }}
                                    title={selectedSlot ? `Gán vào Slot ${selectedSlot}` : "Chọn slot trước"}
                                >
                                    <div className={styles.deviceLeft}>
                                        <div className={styles.deviceIcon}>
                                            <i className="ri-bluetooth-line" />
                                        </div>
                                        <div className={styles.deviceInfo}>
                                            <div className={styles.deviceName}>
                                                {device.name || <span className={styles.unknown}>Unknown</span>}
                                            </div>
                                            <div className={styles.deviceAddr}>{device.address}</div>
                                        </div>
                                    </div>
                                    <div className={styles.deviceRight}>
                                        <div
                                            className={styles.rssiBar}
                                            style={{ color: getRssiColor(device.rssi) }}
                                        >
                                            <span className={styles.rssiValue}>{device.rssi}</span>
                                            <span className={styles.rssiUnit}>dBm</span>
                                        </div>
                                        <div
                                            className={styles.rssiLabel}
                                            style={{ color: getRssiColor(device.rssi) }}
                                        >
                                            {getRssiLabel(device.rssi)}
                                        </div>
                                        {selectedSlot && (
                                            <div className={styles.assignBtn}>
                                                → A{selectedSlot - 1}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* LOG PANEL */}
            <div className={styles.logPanel}>
                <div className={styles.logTitle}>
                    <i className="ri-terminal-line" /> Event Log
                    <button className={styles.clearLog} onClick={() => setLog([])}>Clear</button>
                </div>
                <div className={styles.logContent}>
                    {log.length === 0 ? (
                        <div className={styles.logEmpty}>Chưa có sự kiện nào...</div>
                    ) : (
                        log.map((entry, i) => (
                            <div key={i} className={styles.logEntry}>{entry}</div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
