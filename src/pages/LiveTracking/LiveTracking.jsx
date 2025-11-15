// src/pages/LiveTracking/LiveTracking.jsx
import React from "react";
import ThreeScene from "./ThreeScene";
import styles from "./LiveTracking.module.css";

export default function LiveTracking() {
    return (
        <div className={styles.container}>
            {/* Thanh tiêu đề giống mẫu */}
            <div className={styles.header}>
                3D MAP
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
                    <span className={`${styles.dot} ${styles.yellow}`} />
                    RTK Base
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.line}`} />
                    Line UWB
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.dot} ${styles.green}`} />
                    Hộp 2×3×4 m (24 m³)
                </div>
            </div>

            {/* Hướng dẫn phím góc phải dưới */}
            <div className={styles.controlsHelp}>
                Chuột trái: xoay | Bánh xe: zoom | L: nhãn + đường | B: bật/tắt hộp
            </div>

            {/* Vùng canvas 3D */}
            <div className={styles.canvasWrapper}>
                <ThreeScene />
            </div>
        </div>
    );
}
