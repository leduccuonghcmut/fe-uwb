import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';

const Home = () => {
  return (
    <div className={styles.homePage}>
      <nav className={styles.navbar}>
        <div className={styles.brand}>Positioning System</div>
        <div className={styles.navLinks}>
          <a href="#" className={styles.navItem}>Feature</a>
          <a href="#" className={styles.navItem}>About us</a>
          {/* Sửa 'Help' thành nút <Link> */}
          <Link to="/login" className={`${styles.navItem} ${styles.helpButton}`}>Help</Link>
        </div>
      </nav>

      <main className={styles.heroSection}>
        <span className={styles.newIntegration}>NEW Latest integration just arrived</span>
        <h1 className={styles.mainTitle}>
          Boost your <br /> UWB localization accuracy
        </h1>
        <p className={styles.description}>
          Deliver precise, real-time location tracking with a scalable multi-anchor system, <br />
          designed for smart environments and seamless integration
        </p>
        <Link to="/login" className={styles.enterWorkspaceButton}>
          Enter Workspace
        </Link>
      </main>

      <div className={styles.authPrompt}>
        Don't have an account yet? Click <Link to="/register" className={styles.signUpLink}>Sign up</Link> to get started.
      </div>

      <div className={styles.socialIcons}>
        {/* Bạn cần có 2 ảnh này trong thư mục /public */}
        <a href="#" className={styles.socialIcon}>
          <img src="/facebook-icon.png" alt="Facebook" onError={(e) => e.target.style.display='none'} />
        </a>
        <a href="#" className={styles.socialIcon}>
          <img src="/messenger-icon.png" alt="Messenger" onError={(e) => e.target.style.display='none'} />
        </a>
      </div>

      <footer className={styles.footer}>
        <a href="#">Terms of Service</a> • <a href="#">Privacy Policy</a>
      </footer>
    </div>
  );
};

export default Home;