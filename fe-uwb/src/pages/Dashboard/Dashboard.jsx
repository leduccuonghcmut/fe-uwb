// src/pages/Dashboard/Dashboard.jsx
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./Dashboard.module.css";
import Welcome from "../Dashboard/Welcome";
import { useState, useEffect } from "react";

export default function Dashboard() {
    const [showWelcome, setShowWelcome] = useState(true);
    const [weather, setWeather] = useState({ city: "Ho Chi Minh City", temp: "25°C" });
    const [currentDate, setCurrentDate] = useState("");

    const handleWelcomeFinish = () => {
        setShowWelcome(false);
    };

    // Fetch real-time weather
    useEffect(() => {
        fetch("https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current=temperature_2m&timezone=Asia%2FBangkok")
            .then(res => res.json())
            .then(data => {
                const temp = Math.round(data.current.temperature_2m);
                setWeather({ city: "Ho Chi Minh City", temp: `${temp}°C` });
            })
            .catch(() => setWeather({ city: "Ho Chi Minh City", temp: "25°C" }));
    }, []);

    // Current date - auto update
    useEffect(() => {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const today = new Date().toLocaleDateString('en-GB', options);
        setCurrentDate(today); // Ví dụ: Sat, 20 Dec
    }, []);

    if (showWelcome) {
        return <Welcome onFinish={handleWelcomeFinish} />;
    }

    return (
        <div className={styles.wrapper}>
            <Sidebar />

            <main className={styles.main}>
                <Header />

                {/* TOP INFO CARD - Sang hơn với glass effect */}
                <div className={styles.topInfoCard}>
                    <div className={styles.topLeft}>
                        <div className={styles.goodRow}>
                            <span className={styles.goodMorning}>Good morning</span>
                            <div className={styles.separator} />
                        </div>
                        <span className={styles.dateText}>{currentDate}</span>
                    </div>

                    <div className={styles.topCenter}>
                        <span className={styles.city}>{weather.city}</span>
                        <span className={styles.temp}>{weather.temp}</span>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className={styles.content}>
                    <div className={styles.dashboardGrid}>
                        {/* OVERVIEW */}
                        <div className={styles.overviewCard}>
                            <h3>Overview</h3>
                            <p className={styles.sub}>System Overview</p>

                            <div className={styles.overviewRow}>
                                <div className={styles.overviewItem}>
                                    <div className={styles.iconSuccess} />
                                    <div>
                                        <h2>2</h2>
                                        <p>Tags</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconWarning} />
                                    <div>
                                        <h2>6</h2>
                                        <p>Anchors</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconAlert} />
                                    <div>
                                        <h2>0</h2>
                                        <p>Alarm</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconPurple} />
                                    <div>
                                        <h2>20 cm</h2>
                                        <p>Avg. Acy</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FREQUENCY */}
                        <div className={styles.chartCard}>
                            <h3>Frequency</h3>
                            <canvas id="freqChart" />
                        </div>

                        {/* PERFORMANCE */}
                        <div className={styles.performanceCard}>
                            <h3>Performance</h3>

                            <table className={styles.table}>
                                <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Popularity</th>
                                    <th>Percent</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>1</td>
                                    <td>Avg. RSSI</td>
                                    <td><div className={styles.barBlue} /></td>
                                    <td><span className={styles.percentBlue}>45%</span></td>
                                </tr>
                                <tr>
                                    <td>2</td>
                                    <td>Direct Path</td>
                                    <td><div className={styles.barGreen} /></td>
                                    <td><span className={styles.percentGreen}>29%</span></td>
                                </tr>
                                <tr>
                                    <td>3</td>
                                    <td>Noise Level</td>
                                    <td><div className={styles.barTeal} /></td>
                                    <td><span className={styles.percentTeal}>18%</span></td>
                                </tr>
                                <tr>
                                    <td>4</td>
                                    <td>Multipath</td>
                                    <td><div className={styles.barOrange} /></td>
                                    <td><span className={styles.percentOrange}>25%</span></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}