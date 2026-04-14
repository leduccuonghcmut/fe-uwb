// src/pages/SystemConfig/SystemConfig.jsx
import styles from "./SystemConfig.module.css";
import { useEffect, useState } from "react";
import Header from "../../components/Header/Header";
import { rtdb } from "../../service/firebase";
import { ref, onValue, push, remove, set, update } from "firebase/database";

export default function SystemConfig() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    const [zones, setZones] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newZone, setNewZone] = useState({ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 });

    const [showCalibModal, setShowCalibModal] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);

    const deviceTypes = [
        { label: "Pending (00)", type: "Pending", role: 0, id: 0 },
        { label: "Tag (1,1)", type: "Tag", role: 1, id: 1 },
        { label: "Anchor A0 (2,0)", type: "A0", role: 2, id: 0 },
        { label: "Anchor A1 (2,1)", type: "A1", role: 2, id: 1 },
        { label: "Anchor A2 (2,2)", type: "A2", role: 2, id: 2 },
        { label: "Anchor A3 (2,3)", type: "A3", role: 2, id: 3 },
        { label: "Anchor A4 (2,4)", type: "A4", role: 2, id: 4 },
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
            mac: "FFFF", role: 99, id: 0, timestamp: Date.now()
        });

        setTimeout(() => {
            alert("Đã gửi lệnh Auto Calibration (Role 99, ID 0) xuống thiết bị!");
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
                <div className={styles.topRow}><h4 className={styles.title}>System Configuration</h4></div>

                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Device Configuration</div>
                        <button className={styles.autoCalibBtn} onClick={() => setShowCalibModal(true)}>🔧 Auto Calibration</button>
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
                                const typeClass = device.type === "Tag" ? styles.tag : device.type.startsWith("A") ? styles.anchor : styles.notselected;
                                const statusClass = device.status === "online" ? styles.statusOnline : styles.statusOffline;
                                const currentOption = deviceTypes.find(opt => opt.type === device.type) || deviceTypes[0];

                                return (
                                    <div key={device.id} className={`${styles.deviceRow} ${typeClass}`}>
                                        <div className={styles.deviceInfo}>
                                            <div className={styles.deviceName}>MAC: {device.id}</div>
                                            <div className={`${styles.statusBadge} ${statusClass}`}>● {device.status === "online" ? "Online" : "Offline"}</div>
                                        </div>
                                        <select className={styles.typeSelect} value={currentOption.label} onChange={(e) => handleChangeType(device.id, e.target.value)}>
                                            {deviceTypes.map((opt) => (<option key={opt.label} value={opt.label}>{opt.label}</option>))}
                                        </select>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Forbidden Zones Management</div>
                        <div className={styles.cardControls}>
                            <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>{showAddForm ? "Cancel" : "+ Add New Zone"}</button>
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
        </>
    );
}