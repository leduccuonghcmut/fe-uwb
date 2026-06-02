import styles from "./SystemConfig.module.css";
import { useEffect, useState } from "react";
import Header from "../../components/Header/Header";
import { rtdb } from "../../service/firebase";
import { ref, onValue, push, remove, set, update } from "firebase/database";

export default function SystemConfig() {
    // Device state
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lockedDevices, setLockedDevices] = useState({});

    // Geofence state
    const [zones, setZones] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newZone, setNewZone] = useState({ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 });

    // Calibration state
    const [showCalibModal, setShowCalibModal] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Device type options with role/node_id mapping
    const deviceTypes = [
        { label: "Pending (00)", type: "Pending", role: 0, id: 0 },
        { label: "Tag (1,1)", type: "Tag", role: 1, id: 1 },
        { label: "Tag (1,2)", type: "Tag", role: 1, id: 2 },
        { label: "Tag (1,3)", type: "Tag", role: 1, id: 3 },
        { label: "Tag (1,4)", type: "Tag", role: 1, id: 4 },
        { label: "Tag (1,5)", type: "Tag", role: 1, id: 5 },
        { label: "Anchor A0 (2,0)", type: "A0", role: 2, id: 0 },
        { label: "Anchor A1 (2,1)", type: "A1", role: 2, id: 1 },
        { label: "Anchor A2 (2,2)", type: "A2", role: 2, id: 2 },
        { label: "Anchor A3 (2,3)", type: "A3", role: 2, id: 3 },
        { label: "Anchor A4 (2,4)", type: "A4", role: 2, id: 4 },
        { label: "Anchor A5 (2,5)", type: "A5", role: 2, id: 5 },
        { label: "Anchor A6 (2,6)", type: "A6", role: 2, id: 6 },
        { label: "Anchor A7 (2,7)", type: "A7", role: 2, id: 7 },
        { label: "Anchor A8 (2,8)", type: "A8", role: 2, id: 8 },
        { label: "Anchor A9 (2,9)", type: "A9", role: 2, id: 9 },
    ];

    useEffect(() => {
        const devicesRef = ref(rtdb, "uwb/devices");
        const unsubscribe = onValue(devicesRef, (snap) => {
            const data = snap.val();
            if (data) {
                const deviceList = Object.keys(data).map((key) => ({
                    id: key,
                    ...data[key],
                    type: data[key].type || "Pending",
                    status: data[key].status || "offline",
                    role: data[key].role !== undefined ? data[key].role : 0,
                    node_id: data[key].node_id !== undefined ? data[key].node_id : 0,
                }));
                setDevices(deviceList);
            } else {
                setDevices([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        const unsubscribe = onValue(zonesRef, (snap) => {
            const data = snap.val();
            if (data) {
                const zoneList = Object.keys(data).map((key) => ({
                    id: key, ...data[key],
                }));
                setZones(zoneList);
            } else {
                setZones([]);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChangeType = (deviceId, selectedLabel) => {
        const selectedOption = deviceTypes.find(opt => opt.label === selectedLabel);
        if (!selectedOption) return;

        // Khóa giao diện thiết bị này trong 15 giây
        setLockedDevices(prev => ({ ...prev, [deviceId]: true }));
        setTimeout(() => {
            setLockedDevices(prev => {
                const newState = { ...prev };
                delete newState[deviceId];
                return newState;
            });
        }, 10000);

        // Cập nhật Firebase
        const deviceRef = ref(rtdb, `uwb/devices/${deviceId}`);
        update(deviceRef, {
            type: selectedOption.type,
            role: selectedOption.role,
            node_id: selectedOption.id,
            config_trigger: Date.now()
        }).catch((err) => console.error("Update device type error:", err));
    };

    const startAutoCalibration = () => {
        setIsCalibrating(true);
        const calibRef = ref(rtdb, "uwb/commands/calibrate");
        set(calibRef, {
            mac: "FFFF",
            role: 99,
            id: 0,
            timestamp: Date.now()
        });

        // Tự động đóng modal sau 1.8 giây
        setTimeout(() => {
            setIsCalibrating(false);
            setShowCalibModal(false);
        }, 1800);
    };

    const addZone = () => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        push(zonesRef, {
            x: parseFloat(newZone.x) || 0, y: parseFloat(newZone.y) || 0, z: parseFloat(newZone.z) || 0,
            w: parseFloat(newZone.w) || 4, h: parseFloat(newZone.h) || 3, d: parseFloat(newZone.d) || 4,
        });
        setNewZone({ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 });
        setShowAddForm(false);
    };

    const removeZone = (id) => remove(ref(rtdb, `uwb/forbidden/zones/${id}`));
    const clearAllZones = () => set(ref(rtdb, "uwb/forbidden/zones"), null);

    return (
        <>
            <Header />
            <div className={styles.page}>
                <div className={styles.topRow}>
                    <h4 className={styles.title}>System Configuration</h4>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Device Configuration</div>
                        <button
                            className={styles.autoCalibBtn}
                            onClick={() => setShowCalibModal(true)}
                        >
                            🔧 Auto Calibration
                        </button>
                    </div>

                    <div className={styles.deviceList}>
                        {loading ? (
                            <div className={styles.loadingState}>
                                <div className={styles.skeleton}></div>
                                <div className={styles.skeleton}></div>
                            </div>
                        ) : devices.length === 0 ? (
                            <div className={styles.emptyState}>No devices found. Vui lòng bật thiết bị và quét BLE...</div>
                        ) : (
                            devices.map((device) => {
                                // Xác định chính xác option hiện tại dựa trên role và node_id
                                const currentOption = deviceTypes.find(opt => opt.role === device.role && opt.id === device.node_id) || deviceTypes[0];

                                const typeClass = device.role === 1 ? styles.tag : device.role === 2 ? styles.anchor : styles.notselected;
                                const statusClass = device.status === "online" ? styles.statusOnline : styles.statusOffline;

                                // Node Tên Ngắn gọn: T1, A0, P (Pending)
                                const nodeShortName = device.role === 1 ? `T${device.node_id}` : device.role === 2 ? `A${device.node_id}` : "P";

                                const isLocked = lockedDevices[device.id];

                                return (
                                    <div key={device.id} className={`${styles.deviceRow} ${typeClass} ${isLocked ? styles.lockedRow : ""}`}>
                                        <div className={styles.deviceInfo}>
                                            {/* Cột hiển thị Badge: T1, A0... */}
                                            <div className={styles.nodeBadge}>
                                                {nodeShortName}
                                            </div>
                                            <div>
                                                <div className={styles.deviceName}>MAC: {device.id}</div>
                                                <div className={`${styles.statusBadge} ${statusClass}`}>● {device.status === "online" ? "Online" : "Offline"}</div>
                                            </div>
                                        </div>
                                        <div className={styles.deviceAction}>
                                            {isLocked && <span className={styles.lockedText}>Updating (10 seconds)...</span>}
                                            <select
                                                className={styles.typeSelect}
                                                value={currentOption.label}
                                                onChange={(e) => handleChangeType(device.id, e.target.value)}
                                                disabled={isLocked}
                                            >
                                                {deviceTypes.map((opt) => (<option key={opt.label} value={opt.label}>{opt.label}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ==================== FORBIDDEN ZONES CARD ==================== */}
                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Forbidden Zones Management</div>
                        <div className={styles.cardControls}>
                            <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
                                {showAddForm ? "Cancel" : "+ Add New Zone"}
                            </button>
                            {zones.length > 0 && <button className={styles.clearAllBtn} onClick={clearAllZones}>Clear All</button>}
                        </div>
                    </div>

                    {showAddForm && (
                        <div className={styles.addForm}>
                            <div className={styles.inputGrid}>
                                <div className={styles.inputGroup}><label>X (m)</label><input type="number" step="0.1" value={newZone.x} onChange={(e) => setNewZone({ ...newZone, x: e.target.value })} /></div>
                                <div className={styles.inputGroup}><label>Y (m)</label><input type="number" step="0.1" value={newZone.y} onChange={(e) => setNewZone({ ...newZone, y: e.target.value })} /></div>
                                <div className={styles.inputGroup}><label>Z (m)</label><input type="number" step="0.1" value={newZone.z} onChange={(e) => setNewZone({ ...newZone, z: e.target.value })} /></div>
                                <div className={styles.inputGroup}><label>Width (m)</label><input type="number" step="0.1" value={newZone.w} onChange={(e) => setNewZone({ ...newZone, w: e.target.value })} /></div>
                                <div className={styles.inputGroup}><label>Height (m)</label><input type="number" step="0.1" value={newZone.h} onChange={(e) => setNewZone({ ...newZone, h: e.target.value })} /></div>
                                <div className={styles.inputGroup}><label>Depth (m)</label><input type="number" step="0.1" value={newZone.d} onChange={(e) => setNewZone({ ...newZone, d: e.target.value })} /></div>
                            </div>
                            <button className={styles.confirmAddBtn} onClick={addZone}>Confirm Add Zone</button>
                        </div>
                    )}

                    <div className={styles.forbiddenBody}>
                        {zones.length === 0 ? (
                            <div className={styles.emptyState}>No forbidden zones defined yet.</div>
                        ) : (
                            zones.map((zone) => (
                                <div key={zone.id} className={styles.forbiddenRow}>
                                    <div>
                                        <span className={styles.coordText}>Center: ({zone.x.toFixed(1)}, {zone.y.toFixed(1)}, {zone.z.toFixed(1)})</span>
                                        <span className={styles.coordSize}>Size: {zone.w.toFixed(1)} × {zone.h.toFixed(1)} × {zone.d.toFixed(1)} m</span>
                                    </div>
                                    <button className={styles.clearBtn} onClick={() => removeZone(zone.id)}>Remove</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ==================== MODAL AUTO CALIBRATION ==================== */}
            {showCalibModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <h3>🔧 Auto Calibration</h3>
                        <p>
                            Gửi lệnh tự động hiệu chỉnh (Role 99, ID 0) cho toàn bộ hệ thống UWB.<br />
                            Thiết bị sẽ tự recalibrate vị trí anchors.
                        </p>
                        <div className={styles.modalButtons}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => {
                                    setShowCalibModal(false);
                                    setIsCalibrating(false);
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                className={styles.confirmBtn}
                                disabled={isCalibrating}
                                onClick={startAutoCalibration}
                            >
                                {isCalibrating ? "Đang gửi lệnh..." : "Xác nhận gửi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}