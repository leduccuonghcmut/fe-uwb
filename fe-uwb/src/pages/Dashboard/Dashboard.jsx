// src/pages/Dashboard/Dashboard.jsx
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./Dashboard.module.css";
import Welcome from "../Dashboard/Welcome";
import { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function Dashboard() {
    const [showWelcome, setShowWelcome] = useState(true);
    const [weather, setWeather] = useState({ city: "Ho Chi Minh City", temp: "25°C" });
    const [currentDate, setCurrentDate] = useState("");

    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const handleWelcomeFinish = () => {
        setShowWelcome(false);
    };

    // Fetch weather
    useEffect(() => {
        fetch("https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current=temperature_2m&timezone=Asia%2FBangkok")
            .then(res => res.json())
            .then(data => {
                const temp = Math.round(data.current.temperature_2m);
                setWeather({ city: "Ho Chi Minh City", temp: `${temp}°C` });
            })
            .catch(() => setWeather({ city: "Ho Chi Minh City", temp: "25°C" }));
    }, []);

    // Current date
    useEffect(() => {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const today = new Date().toLocaleDateString('en-GB', options);
        setCurrentDate(today);
    }, []);

    // Frequency Chart - User Access Frequency
    useEffect(() => {
        if (showWelcome || !chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const hours = Array.from({ length: 24 }, (_, i) => i === 0 ? '0h' : `${i}h`);

        const accessData = [5, 3, 2, 4, 8, 22, 48, 85, 105, 98, 72, 65, 58, 62, 71, 79, 88, 82, 64, 45, 31, 18, 12, 7];

        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Số lượt truy cập',
                    data: accessData,
                    backgroundColor: (context) => {
                        const colors = [
                            '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
                            '#ec4899', '#f43f5e', '#f97316', '#eab308'
                        ];
                        return colors[context.dataIndex % colors.length];
                    },
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    borderRadius: 6,
                    barThickness: 12,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e2937',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        padding: 10,
                        displayColors: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0', lineWidth: 0.8 },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            stepSize: 20
                        }
                    },
                    x: {
                        grid: { color: '#e2e8f0', lineWidth: 0.8 },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            maxRotation: 0,
                            autoSkipPadding: 8
                        }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) chartInstance.current.destroy();
        };
    }, [showWelcome]);

    if (showWelcome) {
        return <Welcome onFinish={handleWelcomeFinish} />;
    }

    return (
        <div className={styles.wrapper}>
            <Sidebar />

            <main className={styles.main}>
                <Header />

                {/* TOP INFO CARD */}
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
                            <p className={styles.sub}>User Access Frequency (24 hours)</p>
                            <div className={styles.chartContainer}>
                                <canvas ref={chartRef} id="freqChart" />
                            </div>
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