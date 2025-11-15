import { useState } from "react";
import styles from "./Sidebar.module.css";

import { logoutUser } from "../../service/auth"; // 🔥 thêm
import { useNavigate } from "react-router-dom"; // 🔥 thêm

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate(); // 🔥 thêm

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const handleLogout = async () => {     // 🔥 thêm
    await logoutUser();                  // gọi Firebase signOut
    navigate("/login");                  // chuyển về login
  };

  return (
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>

        <div className={styles.topSection}>
          <span className={styles.logoText}>Positioning System</span>

          <button className={styles.toggleBtn} onClick={toggleSidebar}>
            <i className="ri-menu-line"></i>
          </button>
        </div>

        <nav className={styles.menu}>
          <a className={`${styles.menuItem} ${styles.active}`}>
            <i className="ri-pie-chart-2-fill"></i>
            <span>Dashboard</span>
          </a>
          <a className={styles.menuItem}>
            <i className="ri-focus-2-line"></i>
            <span>Live Tracking</span>
          </a>
          <a className={styles.menuItem}>
            <i className="ri-settings-3-line"></i>
            <span>System Config</span>
          </a>
          <a className={styles.menuItem}>
            <i className="ri-magic-line"></i>
            <span>Advance Feature</span>
          </a>
          <a className={styles.menuItem}>
            <i className="ri-download-2-line"></i>
            <span>Export</span>
          </a>
        </nav>

        <div className={styles.bottomMenu}>
          <div className={styles.userInfo}>
            <i className="ri-user-line" style={{ fontSize: "20px" }}></i>
            <div>
              <p className={styles.name}>Gustavo Xavier</p>
              <span className={styles.role}>Admin</span>
            </div>
          </div>

          <a className={styles.menuItem}>
            <i className="ri-settings-2-line"></i>
            <span>Settings</span>
          </a>

          {/* LOGOUT BUTTON */}
          <a
              className={`${styles.menuItem} ${styles.logout}`}
              onClick={handleLogout}   // 🔥 chỉ sửa dòng này
          >
            <i className="ri-logout-box-r-line"></i>
            <span>Log out</span>
          </a>
        </div>
      </aside>
  );
}
