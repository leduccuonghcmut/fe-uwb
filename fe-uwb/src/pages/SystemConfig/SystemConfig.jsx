// src/pages/SystemConfig/SystemConfig.jsx
import styles from "./SystemConfig.module.css";
import { useEffect, useState } from "react";
import { fetchDevices, updateDevice } from "../../service/deviceService";
import Header from "../../components/Header/Header";
import { rtdb } from "../../service/firebase";
import { ref, onValue, push, remove, set } from "firebase/database";

export default function SystemConfig() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Forbidden Zones state
    const [zones, setZones] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newZone, setNewZone] = useState({ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 });

    const deviceTypes = ["Not selected", "Tag", "Anchor"];

    // Load devices (với dữ liệu mẫu nếu chưa có)
    useEffect(() => {
        fetchDevices()
            .then((data) => {
                if (!data || data.length === 0) {
                    const sampleDevices = [
                        { id: "dev1", name: "Device 1", type: "Not selected", status: "online" },
                        { id: "dev2", name: "Device 2", type: "Tag", status: "offline" },
                        { id: "dev3", name: "Device 3", type: "Anchor", status: "online" },
                    ];
                    setDevices(sampleDevices);
                } else {
                    const normalized = data.map(d => ({
                        ...d,
                        type: deviceTypes.includes(d.type) ? d.type : "Not selected",
                        status: d.status || "offline" // giả lập trạng thái nếu backend chưa có
                    }));
                    setDevices(normalized);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    // Load forbidden zones
    useEffect(() => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        const unsubscribe = onValue(zonesRef, (snap) => {
            const data = snap.val();
            if (data) {
                const zoneList = Object.keys(data).map((key) => ({
                    id: key,
                    ...data[key],
                }));
                setZones(zoneList);
            } else {
                setZones([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Change device type
    const handleChangeType = (deviceId, newType) => {
        setDevices((prev) =>
            prev.map((d) => (d.id === deviceId ? { ...d, type: newType } : d))
        );

        updateDevice(deviceId, { type: newType }).catch((err) =>
            console.error("Update device error:", err)
        );
    };

    // Add new forbidden zone
    const addZone = () => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        push(zonesRef, {
            x: parseFloat(newZone.x) || 0,
            y: parseFloat(newZone.y) || 0,
            z: parseFloat(newZone.z) || 0,
            w: parseFloat(newZone.w) || 4,
            h: parseFloat(newZone.h) || 3,
            d: parseFloat(newZone.d) || 4,
        });
        setNewZone({ x: 0, y: 0, z: 0, w: 4, h: 3, d: 4 });
        setShowAddForm(false);
    };

    // Remove zone
    const removeZone = (id) => {
        const zoneRef = ref(rtdb, `uwb/forbidden/zones/${id}`);
        remove(zoneRef);
    };

    // Clear all zones
    const clearAllZones = () => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        set(zonesRef, null);
    };

    return (
        <>
            <Header />

            <div className={styles.page}>
                <div className={styles.topRow}>
                    <h4 className={styles.title}>System Configuration</h4>
                </div>

                {/* Device Configuration Card */}
                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Device Configuration</div>
                    </div>

                    <div className={styles.deviceList}>
                        {loading ? (
                            <div className={styles.emptyState}>Loading devices...</div>
                        ) : devices.length === 0 ? (
                            <div className={styles.emptyState}>No devices found.</div>
                        ) : (
                            devices.map((device) => {
                                const typeClass =
                                    device.type === "Tag" ? styles.tag :
                                        device.type === "Anchor" ? styles.anchor :
                                            styles.notselected;

                                const statusClass = device.status === "online" ? styles.statusOnline : styles.statusOffline;

                                return (
                                    <div key={device.id} className={`${styles.deviceRow} ${typeClass}`}>
                                        <div className={styles.deviceInfo}>
                                            <div className={styles.deviceName}>
                                                {device.name || `Device ${device.id}`}
                                            </div>
                                            <div className={`${styles.statusBadge} ${statusClass}`}>
                                                ● {device.status === "online" ? "Online" : "Offline"}
                                            </div>
                                        </div>

                                        <select
                                            className={styles.typeSelect}
                                            value={device.type}
                                            onChange={(e) => handleChangeType(device.id, e.target.value)}
                                        >
                                            {deviceTypes.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Forbidden Zones Card */}
                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Forbidden Zones Management</div>
                        <div className={styles.cardControls}>
                            <button
                                className={styles.addBtn}
                                onClick={() => setShowAddForm(!showAddForm)}
                            >
                                {showAddForm ? "Cancel" : "+ Add New Zone"}
                            </button>
                            {zones.length > 0 && (
                                <button className={styles.clearAllBtn} onClick={clearAllZones}>
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>

                    {showAddForm && (
                        <div className={styles.addForm}>
                            <div className={styles.inputGrid}>
                                <div className={styles.inputGroup}>
                                    <label>X (meters)</label>
                                    <input type="number" step="0.1" value={newZone.x} onChange={(e) => setNewZone({ ...newZone, x: e.target.value })} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Y (meters)</label>
                                    <input type="number" step="0.1" value={newZone.y} onChange={(e) => setNewZone({ ...newZone, y: e.target.value })} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Z (meters)</label>
                                    <input type="number" step="0.1" value={newZone.z} onChange={(e) => setNewZone({ ...newZone, z: e.target.value })} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Width (m)</label>
                                    <input type="number" step="0.1" value={newZone.w} onChange={(e) => setNewZone({ ...newZone, w: e.target.value })} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Height (m)</label>
                                    <input type="number" step="0.1" value={newZone.h} onChange={(e) => setNewZone({ ...newZone, h: e.target.value })} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Depth (m)</label>
                                    <input type="number" step="0.1" value={newZone.d} onChange={(e) => setNewZone({ ...newZone, d: e.target.value })} />
                                </div>
                            </div>
                            <button className={styles.confirmAddBtn} onClick={addZone}>
                                Confirm Add Zone
                            </button>
                        </div>
                    )}

                    <div className={styles.forbiddenBody}>
                        {zones.length === 0 ? (
                            <div className={styles.emptyState}>No forbidden zones defined yet.</div>
                        ) : (
                            zones.map((zone) => (
                                <div key={zone.id} className={styles.forbiddenRow}>
                                    <div>
                                        <span className={styles.coordText}>
                                            Center: ({zone.x.toFixed(1)}, {zone.y.toFixed(1)}, {zone.z.toFixed(1)})
                                        </span>
                                        <span className={styles.coordSize}>
                                            Size: {zone.w.toFixed(1)} × {zone.h.toFixed(1)} × {zone.d.toFixed(1)} m
                                        </span>
                                    </div>
                                    <button className={styles.clearBtn} onClick={() => removeZone(zone.id)}>
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.forbiddenHint}>
                        Forbidden zones are synchronized in real-time with the 3D tracking system.
                    </div>
                </div>
            </div>
        </>
    );
}