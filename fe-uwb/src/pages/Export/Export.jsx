// src/pages/Export/Export.jsx
import React, { useState, useEffect, useMemo } from 'react';
import styles from './Export.module.css';
import { rtdb } from "../../service/firebase";
import { ref, onValue } from "firebase/database";
import * as XLSX from 'xlsx';

export default function Export() {
    const [selectedTag, setSelectedTag] = useState("T1");
    // Đã nâng lên thêm 5 thiết bị nữa (T1 đến T10)
    const [availableTags, setAvailableTags] = useState(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"]);
    const [historyData, setHistoryData] = useState([]);

    const [workingThreshold, setWorkingThreshold] = useState(0.2);
    const [congestionThreshold, setCongestionThreshold] = useState(0.8);
    const [isExporting, setIsExporting] = useState(false);

    // ==========================================
    // 1. FETCH DATA TỪ FIREBASE
    // ==========================================
    useEffect(() => {
        const historyRef = ref(rtdb, `uwb/history/${selectedTag}`);
        const unsubscribe = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const dataArray = Object.keys(data).map(key => ({
                    id: key,
                    timestamp: data[key].timestamp || Date.now(),
                    x: parseFloat(data[key].x) || 0,
                    y: parseFloat(data[key].y) || 0
                }));
                dataArray.sort((a, b) => a.timestamp - b.timestamp);
                setHistoryData(dataArray);
            } else {
                setHistoryData([]);
            }
        });

        return () => unsubscribe();
    }, [selectedTag]);

    // ==========================================
    // 2. XỬ LÝ LOGIC (Áp dụng Rule m/s)
    // ==========================================
    const processedData = useMemo(() => {
        const result = [];
        for (let i = 0; i < historyData.length; i++) {
            const current = historyData[i];

            // Xử lý lỗi Excel: Format tay thành chuỗi chuẩn "HH:MM:SS DD/MM/YYYY"
            const d = new Date(current.timestamp);
            const pad = (n) => n.toString().padStart(2, '0');
            const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

            let speed = 0;
            let status = "N/A";

            if (i > 0) {
                const prev = historyData[i - 1];
                const dt = (current.timestamp - prev.timestamp) / 1000;
                const dist = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.y - prev.y, 2));

                if (dt > 0 && dt < 10) {
                    speed = parseFloat((dist / dt).toFixed(2));

                    if (speed < workingThreshold) {
                        status = "Working (Stationary)";
                    } else if (speed >= workingThreshold && speed < congestionThreshold) {
                        status = "Congested (Slow)";
                    } else {
                        status = "Transit (Normal)";
                    }
                }
            }

            result.push({
                ...current,
                timeStr,
                speed,
                status
            });
        }
        return result;
    }, [historyData, workingThreshold, congestionThreshold]);

    // ==========================================
    // 3. XUẤT FILE EXCEL (.XLSX)
    // ==========================================
    const handleDownloadExcel = () => {
        if (processedData.length === 0) return;
        setIsExporting(true);

        const headers = ["STT", "Thời gian", "Tọa độ X (m)", "Tọa độ Y (m)", "Vận tốc (m/s)", "Trạng thái"];
        const rows = [headers];

        processedData.forEach((row, index) => {
            rows.push([
                index + 1,
                row.timeStr, // Chuỗi format chuẩn, Excel sẽ không bị lỗi
                Number(row.x.toFixed(2)),
                Number(row.y.toFixed(2)),
                Number(row.speed),
                row.status
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch sử di chuyển");

        // Điều chỉnh độ rộng cột để không bị lỗi ###### (Đã tăng cột Thời gian lên 25)
        const columnWidths = [
            { wch: 8 },  // STT
            { wch: 25 }, // Thời gian (Rộng ra để vừa chuỗi ngày tháng)
            { wch: 15 }, // X
            { wch: 15 }, // Y
            { wch: 15 }, // Vận tốc
            { wch: 25 }  // Trạng thái
        ];
        worksheet['!cols'] = columnWidths;

        XLSX.writeFile(workbook, `UWB_Report_${selectedTag}_${new Date().getTime()}.xlsx`);

        setTimeout(() => setIsExporting(false), 800);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>Data Export</h1>
                    <p className={styles.pageSubtitle}>Download historical tracking data in Excel format with applied kinematic rules.</p>
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

            <div className={styles.mainGrid}>
                <div className={styles.leftCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-table-line"></i> Data Preview ({processedData.length} records)</h2>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>X (m)</th>
                                    <th>Y (m)</th>
                                    <th>Speed (m/s)</th>
                                    <th>Calculated Status</th>
                                </tr>
                                </thead>
                                <tbody>
                                {processedData.length > 0 ? (
                                    processedData.slice().reverse().slice(0, 100).map((row, idx) => (
                                        <tr key={row.id || idx}>
                                            <td className={styles.timeCell}>{row.timeStr}</td>
                                            <td className={styles.coordCell}>{row.x.toFixed(2)}</td>
                                            <td className={styles.coordCell}>{row.y.toFixed(2)}</td>
                                            <td className={styles.coordCell}>{row.speed}</td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${
                                                    row.status.includes('Working') ? styles.badgeGreen :
                                                        row.status.includes('Congested') ? styles.badgeRed : styles.badgeBlue
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className={styles.emptyState}>No history records found for {selectedTag}.</td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                        {processedData.length > 100 && (
                            <div className={styles.tableFooter}>
                                Hiển thị 100 dòng gần nhất. File Excel xuất ra sẽ bao gồm toàn bộ {processedData.length} dòng.
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.rightCol}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-file-excel-2-line"></i> Export Configuration</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.description}>
                                Export all current trajectory data to an Excel file (.xlsx). The file will include velocity and movement status based on the rules established below.
                                 </p>

                            <div className={styles.summaryBox}>
                                <div className={styles.summaryItem}>
                                    <span>Target Device:</span>
                                    <strong>{selectedTag}</strong>
                                </div>
                                <div className={styles.summaryItem}>
                                    <span>Total Records:</span>
                                    <strong>{processedData.length}</strong>
                                </div>
                            </div>

                            <button
                                className={styles.btnExcel}
                                onClick={handleDownloadExcel}
                                disabled={isExporting || processedData.length === 0}
                            >
                                {isExporting ? <><i className="ri-loader-4-line ri-spin"></i> Generating...</> : <><i className="ri-file-excel-2-line"></i> Download Excel (.xlsx)</>}
                            </button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2><i className="ri-settings-3-line"></i> Kinematic Rules</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <p className={styles.description}>
                                Adjust the speed thresholds to classify the data points in the exported file.
                            </p>

                            <div className={styles.verticalGroup}>
                                <label className={styles.label}>
                                    <span>Working Threshold</span>
                                    <strong style={{color: '#10b981'}}>{workingThreshold} m/s</strong>
                                </label>
                                <input
                                    type="range"
                                    className={styles.rangeInput}
                                    min="0.05" max="1.0" step="0.05"
                                    value={workingThreshold}
                                    onChange={(e) => setWorkingThreshold(parseFloat(e.target.value))}
                                />
                                <small className={styles.hint}>Speeds below this level are considered to be working (standing still).</small>
                            </div>

                            <div className={styles.verticalGroup} style={{ marginTop: '20px' }}>
                                <label className={styles.label}>
                                    <span>Congestion Threshold</span>
                                    <strong style={{color: '#f43f5e'}}>{congestionThreshold} m/s</strong>
                                </label>
                                <input
                                    type="range"
                                    className={styles.rangeInput}
                                    min="0.2" max="3.0" step="0.1"
                                    value={congestionThreshold}
                                    onChange={(e) => setCongestionThreshold(parseFloat(e.target.value))}
                                />
                                <small className={styles.hint}>Speeds below this level are considered slow/traffic congestion.</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}