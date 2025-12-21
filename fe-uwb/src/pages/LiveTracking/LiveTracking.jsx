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

    // Trạng thái cảnh báo
    const [inForbiddenZone, setInForbiddenZone] = useState(false); // Đang vi phạm → badge nhấp nháy
    const [violatedZones, setViolatedZones] = useState([]);
    const [showAlert, setShowAlert] = useState(false); // Hiện popup
    const [alertCountdown, setAlertCountdown] = useState(30); // 30 giây
    const [lastAlertTime, setLastAlertTime] = useState(0); // Timestamp lần cuối hiện popup
    const COOLDOWN_SECONDS = 60; // 60 giây mới được hiện lại popup

    // Lấy forbidden zones từ Firebase
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

    // Theo dõi vị trí tag và kiểm tra vùng cấm
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

            // === CẬP NHẬT TRẠNG THÁI ===
            if (violated.length > 0) {
                setViolatedZones(violated);
                setInForbiddenZone(true); // Bật badge ngay

                // Chỉ hiện popup nếu đã qua cooldown
                if (!showAlert && (now - lastAlertTime >= COOLDOWN_SECONDS)) {
                    setShowAlert(true);
                    setAlertCountdown(30);
                    setLastAlertTime(now);
                }
            } else {
                // === RA KHOI VÙNG CẤM → TẮT NGAY LẬP TỨC ===
                setInForbiddenZone(false);     // Tắt badge ngay
                setViolatedZones([]);          // Xóa danh sách vi phạm
                // Popup sẽ tự tắt theo countdown, không cần can thiệp
            }
        };

        window.addEventListener("tag-position-update", handlePositionUpdate);
        return () => window.removeEventListener("tag-position-update", handlePositionUpdate);
    }, [forbiddenZones, showAlert, lastAlertTime]);

    // Countdown tự động tắt popup
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
            {/* Header với badge nhấp nháy khi vi phạm */}
            <div className={styles.header}>
                3D Live Tracking
                {inForbiddenZone && <span className={styles.warningBadge}>⚠ VIOLATION OF RESTRICTED ZONE</span>}
            </div>

            {/* Legend */}
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

            {/* Panel Forbidden Zones */}
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

            {/* Hướng dẫn phím */}
            <div className={styles.controlsHelp}>
                Left mouse: rotate | Right mouse: pan | Wheel: zoom | L: labels + paths | B: forbidden zones
            </div>

            {/* Canvas 3D */}
            <div className={styles.canvasWrapper}>
                <ThreeScene />
            </div>

            {/* POPUP CẢNH BÁO */}
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