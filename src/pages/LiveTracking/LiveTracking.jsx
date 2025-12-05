// src/pages/LiveTracking/LiveTracking.jsx
import React from "react";
import ThreeScene from "./ThreeScene";
import styles from "./LiveTracking.module.css";

export default function LiveTracking() {
    return (
        <div className={styles.container}>
            {/* Thanh tiêu đề giống mẫu */}
            <div className={styles.header}>
                3D Live Tracking
            </div>

            {/* Legend nhỏ, responsive */}
            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.blue}`} />
                    Anchor
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.orange}`} />
                    Tag
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.line}`} />
                    Line UWB
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.green}`} />
                    Box
                </div>
            </div>

            {/* Hướng dẫn phím góc phải dưới */}
            <div className={styles.controlsHelp}>
                Left mouse: rotate | Right mouse: pan | Wheel: zoom | L: labels + paths | B: toggle box
            </div>

            {/* Vùng canvas 3D */}
            <div className={styles.canvasWrapper}>
                <ThreeScene />
            </div>
        </div>
    );
}
