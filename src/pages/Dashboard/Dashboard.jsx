import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
    return (
        <div className={styles.wrapper}>

            <Sidebar />

            <main className={styles.main}>
                <Header />

                {/* ===================== CONTENT DASHBOARD ===================== */}
                <div className={styles.content}>

                    {/* ======= GRID LAYOUT ======= */}
                    <div className={styles.dashboardGrid}>

                        {/* ================== OVERVIEW CARD ================== */}
                        <div className={styles.overviewCard}>
                            <h3>Overview</h3>
                            <p className={styles.sub}>System Overview</p>

                            <div className={styles.overviewRow}>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconSuccess}></div>
                                    <div>
                                        <h2>2</h2>
                                        <p>Tags</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconWarning}></div>
                                    <div>
                                        <h2>6</h2>
                                        <p>Anchors</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconAlert}></div>
                                    <div>
                                        <h2>Warning</h2>
                                        <p>Alarm</p>
                                    </div>
                                </div>

                                <div className={styles.overviewItem}>
                                    <div className={styles.iconPurple}></div>
                                    <div>
                                        <h2>20 cm</h2>
                                        <p>Avg. Acy</p>
                                    </div>
                                </div>

                            </div>
                        </div>


                        {/* ================== FREQUENCY CHART ================== */}
                        <div className={styles.chartCard}>
                            <h3>Frequency</h3>
                            <canvas id="freqChart"></canvas>
                        </div>


                        {/* ================== PERFORMANCE TABLE ================== */}
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
                                    <td><div className={styles.barBlue}></div></td>
                                    <td>45%</td>
                                </tr>

                                <tr>
                                    <td>2</td>
                                    <td>Direct Path</td>
                                    <td><div className={styles.barGreen}></div></td>
                                    <td>29%</td>
                                </tr>

                                <tr>
                                    <td>3</td>
                                    <td>Noise Level</td>
                                    <td><div className={styles.barTeal}></div></td>
                                    <td>18%</td>
                                </tr>

                                <tr>
                                    <td>4</td>
                                    <td>BioBright Detergent</td>
                                    <td><div className={styles.barOrange}></div></td>
                                    <td>25%</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
                {/* ================= END CONTENT ================= */}

            </main>

        </div>
    );
}
