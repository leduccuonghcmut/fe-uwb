// src/pages/LiveTracking/LiveTracking.jsx
import React, { useState, useEffect } from "react";
import ThreeScene from "./ThreeScene";
import TwoDScene from "./TwoDScene";           // ← Import 2D
import styles from "./LiveTracking.module.css";
import { rtdb } from "../../service/firebase";
import { ref, onValue } from "firebase/database";

export default function LiveTracking() {
    const [viewMode, setViewMode] = useState("3D"); // "3D" hoặc "2D"
    const [collapsed, setCollapsed] = useState(false);
    const [collapsedForbidden, setCollapsedForbidden] = useState(true);
    const [forbiddenZones, setForbiddenZones] = useState([]);

    // Trạng thái cảnh báo (giữ nguyên hoàn toàn)
    const [inForbiddenZone, setInForbiddenZone] = useState(false);
    const [violatedZones, setViolatedZones] = useState([]);
    const [showAlert, setShowAlert] = useState(false);
    const [alertCountdown, setAlertCountdown] = useState(30);
    const [lastAlertTime, setLastAlertTime] = useState(0);
    const COOLDOWN_SECONDS = 60;

    // Lấy forbidden zones từ Firebase (giữ nguyên)
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

    // Theo dõi vị trí tag và kiểm tra vùng cấm (giữ nguyên)
    useEffect(() => {
        const handlePositionUpdate = (event) => {
            const { x, y, z } = event.detail;
            const now = Date.now() / 1000;

            const TOLERANCE = 0.02;
            const violated = forbiddenZones.filter((zone) => {
                const halfW = (zone.w || 4) / 2 + TOLERANCE;
                const halfH = (zone.h || 3) / 2 + TOLERANCE;
                const halfD = (zone.d || 4) / 2 + TOLERANCE;

                return (
                    x >= zone.x - halfW && x <= zone.x + halfW &&
                    y >= zone.y - halfH && y <= zone.y + halfH &&
                    z >= zone.z - halfD && z <= zone.z + halfD
                );
            });

            if (violated.length > 0) {
                setViolatedZones(violated);
                setInForbiddenZone(true);

                if (!showAlert && (now - lastAlertTime >= COOLDOWN_SECONDS)) {
                    setShowAlert(true);
                    setAlertCountdown(30);
                    setLastAlertTime(now);
                }
            } else {
                setInForbiddenZone(false);
                setViolatedZones([]);
            }
        };

        window.addEventListener("tag-position-update", handlePositionUpdate);
        return () => window.removeEventListener("tag-position-update", handlePositionUpdate);
    }, [forbiddenZones, showAlert, lastAlertTime]);

    // Countdown popup (giữ nguyên)
    useEffect(() => {
        if (showAlert) {
            const timer = setInterval(() => {
                setAlertCountdown((prev) => {
                    if (prev <= 1) {
                        setShowAlert(false);
                        clearInterval(timer);
                        return 30;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [showAlert]);

    return (
        <div className={styles.container}>
            {/* Header với nút chuyển mode */}
            <div className={styles.header}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    Live Tracking
                    <div style={{
                        display: "flex",
                        background: "#e5e7eb",
                        borderRadius: "8px",
                        padding: "3px"
                    }}>
                        <button
                            onClick={() => setViewMode("3D")}
                            className={`${styles.modeBtn} ${viewMode === "3D" ? styles.modeBtnActive : ""}`}
                        >
                            3D View
                        </button>
                        <button
                            onClick={() => setViewMode("2D")}
                            className={`${styles.modeBtn} ${viewMode === "2D" ? styles.modeBtnActive : ""}`}
                        >
                            2D Map
                        </button>
                    </div>
                </div>

                {inForbiddenZone && (
                    <span className={styles.warningBadge}>⚠ VIOLATION OF RESTRICTED ZONE</span>
                )}
            </div>

            {/* Legend - giữ nguyên */}
            <div className={`${styles.legend} ${collapsed ? styles.legendCollapsed : ""}`}>
                <div className={styles.toggleBtn} onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? "⯆" : "⯇"}
                </div>

                {!collapsed && (
                    <>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.blue}`} /> Anchor
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.orange}`} /> Tag
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.line} /> Line UWB
                        </div>
                        <div className={styles.legendItem}>
                            <span className={`${styles.dot} ${styles.red}`} /> Forbidden zones
                        </div>
                    </>
                )}
            </div>

            {/* Panel Forbidden Zones - giữ nguyên */}
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
                                    <div
                                        key={zone.id}
                                        className={`${styles.zoneItem} ${
                                            violatedZones.some((v) => v.id === zone.id) ? styles.zoneItemViolated : ""
                                        }`}
                                    >
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

            {/* Hướng dẫn */}
            <div className={styles.controlsHelp}>
                {viewMode === "3D"
                    ? "Left mouse: rotate | Right mouse: pan | Wheel: zoom | L: labels + paths | B: forbidden zones"
                    : "M + Drag = Move Map | Right-Click + Drag = Pan | Drag anchors | Click scale"
                }
            </div>

            {/* Canvas Area - chuyển đổi giữa 2D và 3D */}
            <div className={styles.canvasWrapper}>
                {viewMode === "3D" ? <ThreeScene /> : <TwoDScene />}
            </div>

            {/* POPUP CẢNH BÁO - giữ nguyên */}
            {showAlert && (
                <div className={styles.alertOverlay}>
                    <div className={styles.alertPopup}>
                        <button className={styles.alertCloseBtn} onClick={() => setShowAlert(false)}>
                            ×
                        </button>
                        <div className={styles.alertIcon}>⚠</div>
                        <div className={styles.alertTitle}>WARNING: YOU HAVE ENTERED A FORBIDDEN ZONE!</div>
                        <div className={styles.alertMessage}>
                            The tag is in {violatedZones.length} forbidden zone:
                        </div>
                        <div className={styles.alertZoneList}>
                            {violatedZones.map((zone) => (
                                <div key={zone.id} className={styles.alertZoneItem}>
                                    • Area at ({zone.x.toFixed(1)}, {zone.y.toFixed(1)}, {zone.z.toFixed(1)})
                                </div>
                            ))}
                        </div>
                        <div className={styles.alertCountdown}>
                            Automatically turns off after {alertCountdown}s
                        </div>
                        <div className={styles.alertProgressBar}>
                            <div
                                className={styles.alertProgressFill}
                                style={{ width: `${(alertCountdown / 30) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}