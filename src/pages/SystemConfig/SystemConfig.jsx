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

    const categories = ["Tag", "Anchor", "RTK Base"];

    // Load devices
    useEffect(() => {
        fetchDevices()
            .then((data) => setDevices(data || []))
            .finally(() => setLoading(false));
    }, []);

    // Load forbidden zones from Firebase
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

    const handleChangeCategory = (index, newType) => {
        const d = devices[index];
        if (!d) return;

        setDevices((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], type: newType };
            return copy;
        });

        updateDevice(d.id, { type: newType }).catch((err) =>
            console.error("Update device error:", err)
        );
    };

    // Add new zone
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

                    <div className={styles.switchGroup}>
                        <button className={`${styles.pillBtn} ${styles.pillActive}`}>
                            <span className={styles.pillIcon}>⏻</span>
                            Energy Saver
                            <span className={styles.toggleDot} />
                        </button>

                        <button className={styles.pillBtn}>
                            <span className={styles.pillIcon}>⟳</span>
                            Auto Calibration
                        </button>
                    </div>
                </div>

                {/* Device Config Card */}
                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Device Settings</div>

                        <div className={styles.cardControls}>
                            <div className={styles.innerSearch}>
                                <i className="ri-search-line" />
                                <input placeholder="Search by MAC or ID..." />
                            </div>

                            <div className={styles.sortBy}>
                                <span>Sort by:</span>
                                <button className={styles.sortBtn}>
                                    Alphabet <i className="ri-arrow-down-s-line" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.skeleton}>Loading devices...</div>
                    ) : (
                        <div className={styles.table}>
                            <div className={styles.headerRow}>
                                <span>Equipment ID</span>
                                <span>Coordinates</span>
                                <span>Category</span>
                                <span>Status</span>
                            </div>

                            {devices.map((d, i) => (
                                <div key={d.id || i} className={styles.row}>
                                    <span className={styles.equipId}>{d.mac || d.id}</span>
                                    <span>{d.coord || "N/A"}</span>

                                    <div className={styles.categoryCell}>
                                        <select
                                            value={d.type || ""}
                                            onChange={(e) => handleChangeCategory(i, e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            {categories.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <span className={(d.status || "").toLowerCase() === "online" ? styles.online : styles.offline}>
                                        {d.status || "Offline"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.cardFooter}>
                        <button className={styles.saveBtn}>Save Changes</button>
                    </div>
                </div>

                {/* Forbidden Zones Card */}
                <div className={styles.forbiddenCard}>
                    <div className={styles.forbiddenHeader}>
                        <div className={styles.forbiddenTitle}>Forbidden Zones</div>

                        <div className={styles.forbiddenActions}>
                            <button className={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
                                {showAddForm ? "Cancel" : "+ Add Zone"}
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
                                    <label>X</label>
                                    <input type="number" step="0.1" value={newZone.x} onChange={(e) => setNewZone({...newZone, x: e.target.value})} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Y</label>
                                    <input type="number" step="0.1" value={newZone.y} onChange={(e) => setNewZone({...newZone, y: e.target.value})} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Z</label>
                                    <input type="number" step="0.1" value={newZone.z} onChange={(e) => setNewZone({...newZone, z: e.target.value})} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Width</label>
                                    <input type="number" step="0.1" value={newZone.w} onChange={(e) => setNewZone({...newZone, w: e.target.value})} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Height</label>
                                    <input type="number" step="0.1" value={newZone.h} onChange={(e) => setNewZone({...newZone, h: e.target.value})} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Depth</label>
                                    <input type="number" step="0.1" value={newZone.d} onChange={(e) => setNewZone({...newZone, d: e.target.value})} />
                                </div>
                            </div>
                            <button className={styles.confirmAddBtn} onClick={addZone}>
                                Confirm Add
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
                                            Center: ({zone.x}, {zone.y}, {zone.z})
                                        </span>
                                        <span className={styles.coordSize}>
                                            Size: {zone.w} × {zone.h} × {zone.d} m
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