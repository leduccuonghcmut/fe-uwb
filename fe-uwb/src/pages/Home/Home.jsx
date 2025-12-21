import React, { useEffect } from "react";
import styles from "./Home.module.css";
import { Link } from "react-router-dom";

const Home = () => {
    useEffect(() => {
        const preloader = document.getElementById("preloader");
        const main = document.getElementById("mainContent");

        setTimeout(() => {
            if (preloader) {
                preloader.style.opacity = "0";
                preloader.style.visibility = "hidden";
            }
            if (main) {
                main.style.opacity = "1";
                main.style.visibility = "visible";
                main.classList.add(styles.fadeIn);
            }
        }, 1800);
    }, []);

    return (
        <>
            {/* PRELOADER */}
            <div id="preloader" className={styles.preloader}>
                <div className={styles.loaderContent}>
                    <div className={styles.brandLoader}>Positioning System</div>
                    <div className={styles.loaderBar}></div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className={styles.pageWrapper}>
                <div className={styles.frame} id="mainContent">

                    <div className={styles.brand}>Positioning System</div>

                    <div className={styles.topNavWrapper}>
                        <div className={styles.topNav}>
                            <div className={styles.topItem}>
                                Feature <i className="ri-arrow-down-s-fill"></i>
                            </div>
                            <div className={styles.topItem}>
                                About us <i className="ri-arrow-down-s-fill"></i>
                            </div>
                            <div className={`${styles.topItem} ${styles.active}`}>
                                Help <span className={styles.helpDot}></span>
                            </div>
                        </div>
                    </div>

                    <main className={styles.mainContent}>
                        <div className={styles.badge}>
                            <span className={styles.dot}>NEW</span> Latest integration just arrived
                        </div>

                        <h1 className={styles.h1}>Boost your</h1>
                        <div className={styles.headlineMain}>UWB localization accuracy</div>

                        <p className={styles.subtitle}>
                            Deliver precise, real-time location tracking with a scalable
                            multi-anchor system, designed for smart environments and seamless integration.
                        </p>

                        <Link to="/login">
                            <button className={styles.primaryBtn}>Enter Workspace</button>
                        </Link>

                        <p className={styles.authNote}>
                            Don’t have an account yet? Click
                            <Link to="/register">
                                <button className={styles.pill}>Sign up</button>
                            </Link> to get started.
                        </p>
                    </main>

                    <div className={styles.socials}>
                        <a href="#" aria-label="Facebook">
                            <i className="ri-facebook-fill"></i>
                        </a>
                        <a href="#" aria-label="Messenger">
                            <i className="ri-messenger-fill"></i>
                        </a>
                    </div>

                    <footer className={styles.footer}>
                        Terms of Service • Privacy Policy
                    </footer>
                </div>
            </div>

            {/* Fallback: Nếu CDN chậm, vẫn hiển thị icon bằng SVG inline */}
            <style jsx>{`
                @import url('https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css');

                /* Fallback icon nếu Remix Icons chưa load */
                .ri-arrow-down-s-line::before {
                    content: "↓";
                    font-family: sans-serif;
                    font-size: 12px;
                    margin-left: 4px;
                }
                .ri-facebook-fill::before {
                    content: "f";
                    font-family: sans-serif;
                    font-weight: bold;
                }
                .ri-messenger-fill::before {
                    content: "m";
                    font-family: sans-serif;
                    font-weight: bold;
                }
            `}</style>
        </>
    );
};

export default Home;