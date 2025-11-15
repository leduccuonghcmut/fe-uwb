// src/components/Header/Header.jsx
import styles from "./Header.module.css";
import { useLocation } from "react-router-dom";

export default function Header() {
    const location = useLocation();

    // ❗ ẨN HEADER khi đang ở trang Live Tracking
    const hideHeader = location.pathname === "/live";

    if (hideHeader) return null;

    return (
        <header className={styles.topbar}>

            {/* CỘT TRÁI – tạo đối xứng để search đứng giữa */}
            <div className={styles.leftSpace}></div>

            {/* SEARCH – nằm giữa */}
            <div className={styles.searchWrapper}>
                <div className={styles.searchIcon}>
                    <i className="ri-search-line"></i>
                </div>
                <input type="text" placeholder="Search" />
                <button className={styles.enterBtn}>Enter</button>
            </div>

            {/* CỘT PHẢI */}
            <div className={styles.rightGroup}>
                <div className={styles.locationSelect}>
                    BK B6 812 <i className="ri-arrow-down-s-line"></i>
                </div>

                <i className={`ri-notification-3-line ${styles.notificationIcon}`}></i>
            </div>

        </header>
    );
}
