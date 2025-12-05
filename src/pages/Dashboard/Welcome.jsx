// src/components/Welcome/Welcome.jsx
import { useState, useEffect } from "react";
import styles from "./Welcome.module.css";

export default function Welcome({ onFinish }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onFinish, 800); // fade out mượt
        }, 2000); // chính xác 2 giây là biến mất

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className={`${styles.welcomeOverlay} ${!isVisible ? styles.fadeOut : ""}`}>
            <div className={styles.welcomeContent}>
                <h1 className={styles.welcomeText}>WELCOME</h1>
                <p className={styles.subtitle}>UWB Dashboard System</p>
            </div>
        </div>
    );
}