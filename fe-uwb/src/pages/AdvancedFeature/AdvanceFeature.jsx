// src/pages/AdvanceFeature/AdvanceFeature.jsx
import React, { useState, useEffect, useMemo } from 'react';
import styles from './AdvanceFeature.module.css';
import { rtdb } from "../../service/firebase";
import { ref, onValue, set, get } from "firebase/database";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdvanceFeature() {
    const [selectedTag, setSelectedTag] = useState("T1");
    // Đã nâng lên thêm 5 thiết bị nữa (T1 đến T10)
    const [availableTags, setAvailableTags] = useState(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"]);
    const [historyData, setHistoryData] = useState([]);

    // API & Webhook States
    const [apiToken, setApiToken] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // ==========================================
    // 1. DATABASE CONNECTION: Fetch History
    // ==========================================
    useEffect(() => {
        const historyRef = ref(rtdb, `uwb/history/${selectedTag}`);

        const unsubscribe = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const dataArray = Object.keys(data).map(key => {
                    const ts = data[key].timestamp || Date.now();
                    const d = new Date(ts);
                    const pad = (n) => n.toString().padStart(2, '0');
                    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

                    return {
                        id: key,
                        ...data[key],
                        timestamp: ts,
                        time: data[key].time || timeStr,
                        x: parseFloat(data[key].x) || 0,
                        y: parseFloat(data[key].y) || 0
                    };
                });
                dataArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                setHistoryData(dataArray);
            } else {
                setHistoryData([]);
            }
        });

        return () => unsubscribe();
    }, [selectedTag]);

    // ==========================================
    // 2. DATABASE CONNECTION: Fetch Configs
    // ==========================================
    useEffect(() => {
        const fetchConfigs = async () => {
            const snap = await get(ref(rtdb, 'uwb/config'));
            if (snap.exists()) {
                const conf = snap.val();
                if (conf.webhookUrl) setWebhookUrl(conf.webhookUrl);
                if (conf.apiToken) setApiToken(conf.apiToken);
            }
        };
        fetchConfigs();
    }, []);

    // ==========================================
    // 3. STATISTICAL CALCULATIONS
    // ==========================================
    const stats = useMemo(() => {
        let totalDistance = 0;
        let lastActive = "N/A";
        let status = "Offline";

        if (historyData.length > 0) {
            lastActive = historyData[historyData.length - 1].time;
            status = "Active";

            for (let i = 1; i < historyData.length; i++) {
                const dx = historyData[i].x - historyData[i - 1].x;
                const dy = historyData[i].y - historyData[i - 1].y;
                totalDistance += Math.sqrt(dx * dx + dy * dy);
            }
        }

        return {
            totalPoints: historyData.length,
            distance: totalDistance.toFixed(2),
            lastActive,
            status
        };
    }, [historyData]);

    // ==========================================
    // HANDLERS
    // ==========================================
    const handleGenerateToken = () => {
        const newToken = "uwb_sec_" + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
        setApiToken(newToken);
        set(ref(rtdb, 'uwb/config/apiToken'), newToken);
        setIsCopied(false);
    };

    const handleCopyToken = () => {
        if (apiToken) {
            navigator.clipboard.writeText(apiToken);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handleSaveWebhook = () => {
        setIsSaving(true);
        set(ref(rtdb, 'uwb/config/webhookUrl'), webhookUrl)
            .then(() => {
                setTimeout(() => setIsSaving(false), 800);
            });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>Advanced Data & Analytics</h1>
                    <p className={styles.pageSubtitle}>Monitor real-time history, analyze movement statistics, and configure API integrations.</p>
                </div>

                <div className={styles.tagSelector}>
                    <i className="ri-rfid-line"></i>
                    <select
                        className={styles.select}
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                    >
                        {availableTags.map(tag => (
                            <option key={tag} value={tag}>Target: {tag}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* STATISTICAL WIDGETS */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#0004fc', background: '#e0e7ff' }}>
                        <i className="ri-database-2-line"></i>
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Data Points Collected</span>
                        <span className={styles.statValue}>{stats.totalPoints}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: '#10b981', background: '#d1fae5' }}>
                        <i className="ri-route-line"></i>
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Distance (m)</span>
                        <span className={styles.statValue}>{stats.distance} <small>m</small></span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ color: stats.status === 'Active' ? '#f59e0b' : '#64748b', background: stats.status === 'Active' ? '#fef3c7' : '#f1f5f9' }}>
                        <i className="ri-pulse-line"></i>
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Status & Last Active</span>
                        <span className={styles.statValue}>
                            {stats.status}
                            <span className={styles.timeSubtext}>{stats.lastActive}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.mainGrid}>
                {/* LEFT COLUMN: History Table & Chart */}
                <div className={styles.leftCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-line-chart-line"></i> Movement Trajectory Chart</h2>
                        </div>
                        <div className={styles.chartContainer}>
                            {historyData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="time" tick={{fontSize: 12, fill: '#64748b'}} />
                                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Line type="monotone" dataKey="x" stroke="#0004fc" strokeWidth={2} name="X Axis (m)" dot={false} activeDot={{r: 6}} />
                                        <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={2} name="Y Axis (m)" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className={styles.emptyState}>No chart data available. Waiting for backend...</div>
                            )}
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-history-line"></i> Raw Coordinate Logs</h2>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>X (m)</th>
                                    <th>Y (m)</th>
                                    <th>Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {historyData.length > 0 ? (
                                    historyData.slice().reverse().map((row, idx) => (
                                        <tr key={row.id || idx}>
                                            <td className={styles.timeCell}>{row.time}</td>
                                            <td className={styles.coordCell}>{row.x.toFixed(2)}</td>
                                            <td className={styles.coordCell}>{row.y.toFixed(2)}</td>
                                            <td><span className={styles.statusBadge}>Recorded</span></td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className={styles.emptyState}>No history records found for {selectedTag}.</td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: API & Webhook */}
                <div className={styles.rightCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-key-2-line"></i> RESTful API Access</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.description}>
                                Generate a secure token to authenticate your external requests and fetch real-time JSON data from the Gateway.
                            </p>

                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    className={styles.inputMono}
                                    value={apiToken}
                                    readOnly
                                    placeholder="No token generated..."
                                />
                                <button
                                    className={`${styles.btnIcon} ${isCopied ? styles.copied : ""}`}
                                    onClick={handleCopyToken}
                                    disabled={!apiToken}
                                    title="Copy to clipboard"
                                >
                                    <i className={isCopied ? "ri-check-line" : "ri-file-copy-line"}></i>
                                </button>
                                <button className={styles.btnPrimary} onClick={handleGenerateToken}>
                                    <i className="ri-refresh-line"></i> New
                                </button>
                            </div>

                            <div className={styles.apiExample}>
                                <div className={styles.apiExampleHeader}>
                                    <span>cURL Example</span>
                                    <span className={styles.methodBadge}>GET</span>
                                </div>
                                <pre className={styles.codeBlock}>
{`curl -X GET "http://localhost:3000/api/tags/${selectedTag}" \\
-H "Authorization: Bearer ${apiToken || "YOUR_TOKEN"}"`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-webhook-line"></i> Data Forwarding (Webhook)</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.description}>
                                The system will automatically POST JSON payloads to this endpoint whenever coordinates change.
                            </p>
                            <div className={styles.verticalGroup}>
                                <label className={styles.label}>Destination URL</label>
                                <input
                                    type="url"
                                    className={styles.input}
                                    placeholder="https://api.yourdomain.com/uwb-hook"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <button
                                    className={styles.btnPrimaryFull}
                                    onClick={handleSaveWebhook}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <><i className="ri-loader-4-line ri-spin"></i> Saving...</> : <><i className="ri-save-3-line"></i> Save Configuration</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}