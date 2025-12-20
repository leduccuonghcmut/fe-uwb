// src/pages/LiveTracking/LiveTracking.jsx
import React, { useState, useEffect } from "react";
import ThreeScene from "./ThreeScene";
import styles from "./LiveTracking.module.css";
import { rtdb } from "../../service/firebase";
import { ref, onValue } from "firebase/database";

export default function LiveTracking() {
    const [collapsed, setCollapsed] = useState(false);
    const [collapsedForbidden, setCollapsedForbidden] = useState(true);
    const [forbiddenZones, setForbiddenZones] = useState([]);

    useEffect(() => {
        const zonesRef = ref(rtdb, "uwb/forbidden/zones");
        const unsubscribe = onValue(zonesRef, (snap) => {
            const data = snap.val();
            if (data) {
                const zoneList = Object.keys(data).map((key) => ({
                    id: key,
                    ...data[key],
                }));
                setForbiddenZones(zoneList);
            } else {
                setForbiddenZones([]);
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className={styles.container}>
            {/* Thanh tiêu đề */}
            <div className={styles.header}>
                3D Live Tracking
            </div>

            {/* Legend */}
            <div className={`${styles.legend} ${collapsed ? styles.legendCollapsed : ""}`}>
                <div className={styles.toggleBtn} onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? "⯆" : "⯇"}
                </div>

                {!collapsed && (
                    <>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.blue}`} />
                            Anchor
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.orange}`} />
                            Tag
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.line} />
                            Line UWB
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.red}`} />
                            Forbidden zones
                        </div>
                    </>
                )}
            </div>

            {/* Panel Danh sách Vùng Cấm */}
            <div className={`${styles.forbiddenPanel} ${collapsedForbidden ? styles.forbiddenPanelCollapsed : ""}`}>
                <div className={styles.toggleBtn} onClick={() => setCollapsedForbidden(!collapsedForbidden)}>
                    {collapsedForbidden ? "⯆" : "⯇"}
                </div>

                {!collapsedForbidden && (
                    <>
                        <div className={styles.forbiddenTitle}>
                            Forbidden zones ({forbiddenZones.length})
                        </div>
                        <div className={styles.forbiddenList}>
                            {forbiddenZones.length === 0 ? (
                                <div className={styles.emptyZones}>Chưa có vùng cấm nào</div>
                            ) : (
                                forbiddenZones.map((zone) => (
                                    <div key={zone.id} className={styles.zoneItem}>
                                        <span className={styles.zoneCoords}>
                                            Center: ({zone.x.toFixed(1)}, {zone.y.toFixed(1)}, {zone.z.toFixed(1)})
                                        </span>
                                        <span className={styles.zoneSize}>
                                            Size: {zone.w}×{zone.h}×{zone.d} m
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.forbiddenHint}>
                            Managing restricted areas in System Configuration
                        </div>
                    </>
                )}
            </div>

            {/* Hướng dẫn phím - thêm B */}
            <div className={styles.controlsHelp}>
                Left mouse: rotate | Right mouse: pan | Wheel: zoom | L: labels + paths | B: forbidden zones
            </div>

            {/* Canvas 3D */}
            <div className={styles.canvasWrapper}>
                <ThreeScene />
            </div>
        </div>
    );
}