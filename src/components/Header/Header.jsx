import React from 'react';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input type="text" placeholder="Search" className={styles.searchInput} />
        <button className={styles.enterButton}>Enter</button>
      </div>

      {/* Center Info */}
      <div className={styles.headerInfo}>
        <div className={styles.greeting}>Good morning</div>
        <div className={styles.dateTimeLocation}>
          <span className={styles.date}>Thu, 31 Oct</span>
          <span className={styles.divider}>|</span>
          <span className={styles.city}>Ho Chi Minh city</span>
          <span className={styles.divider}>|</span>
          <span className={styles.temperature}>25°C</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className={styles.headerActions}>
        <div className={styles.versionDropdown}>
          <span>BK B6 812</span>
          <span className={styles.dropdownIcon}>▼</span>
        </div>
        <div className={styles.notificationIcon}>
          🔔
          <span className={styles.notificationDot}></span>
        </div>
      </div>
    </header>
  );
};

export default Header;