import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { NavLink, Link } from 'react-router-dom'; 

const icons = {
  dashboard: '📊',
  tracking: '📍',
  config: '⚙️',
  advance: '➡️',
  export: '📤',
  settings: '🔧',
  logout: '🚪'
};

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        <span 
          className={styles.toggleButton} 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '»' : '«'}
        </span>
        <div className={styles.brand}>Positioning System</div>
      </div>
      
      <nav className={styles.nav}>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.icon}>{icons.dashboard}</span> <span className={styles.text}>Dashboard</span>
        </NavLink>
        <NavLink to="/live-tracking" className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.icon}>{icons.tracking}</span> <span className={styles.text}>Live Tracking</span>
        </NavLink>
        <NavLink to="/system-config" className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.icon}>{icons.config}</span> <span className={styles.text}>System Config</span>
        </NavLink>
        <NavLink to="/advance-feature" className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.icon}>{icons.advance}</span> <span className={styles.text}>Advance feature</span>
        </NavLink>
        <NavLink to="/export" className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.icon}>{icons.export}</span> <span className={styles.text}>Export</span>
        </NavLink>
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userSection}>
          <img 
            src="/gustavo-avatar.png" 
            alt="Gustavo Xavier" 
            className={styles.userAvatar} 
          />
          <div className={styles.userInfo}>
            <div className={styles.userName}>Gustavo Xavier</div>
            <div className={styles.userRole}>Admin</div>
          </div>
        </div>
        <div className={styles.settings}>
          <NavLink to="/settings" className={styles.settingsItem}>
            <span className={styles.icon}>{icons.settings}</span> <span className={styles.text}>Settings</span>
          </NavLink>
          
          {/*hoạt động */}
          <Link to="/login" className={styles.settingsItem}>
            <span className={styles.icon}>{icons.logout}</span> <span className={styles.text}>Log out</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;