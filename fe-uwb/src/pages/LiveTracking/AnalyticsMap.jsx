// src/pages/LiveTracking/AnalyticsMap.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Stage, Layer, Circle, Line } from "react-konva";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import styles from "./AnalyticsMap.module.css";
import { rtdb } from "../../service/firebase";
import { ref, onValue, set } from "firebase/database";

const BASE_SCALE = 50;           // Pixels per meter
const MAX_GAP_THRESHOLD = 10000; // ms. Gap > 10s means disconnected

export default function AnalyticsMap() {
    const [selectedTag, setSelectedTag] = useState("T1");
    // Lưu trữ dữ liệu của TẤT CẢ các tag
    const [allHistoryData, setAllHistoryData] = useState({});

    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
    const containerRef = useRef(null);

    // Map Interactivity
    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const originPx = { x: 100, y: stageSize.height - 100 };

    // Dynamic Rule Configs
    const [workingSpeedThreshold, setWorkingSpeedThreshold] = useState(0.2); // m/s
    const [congestionSpeedThreshold, setCongestionSpeedThreshold] = useState(0.8); // m/s

    // 1. Lấy dữ liệu Lịch sử của TẤT CẢ các tag từ Firebase
    useEffect(() => {
        const historyRef = ref(rtdb, `uwb/history`);
        const unsubscribe = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const parsedData = {};
                Object.keys(data).forEach(tagId => {
                    const tagData = data[tagId];
                    const dataArray = Object.keys(tagData).map(key => ({
                        id: key,
                        x: parseFloat(tagData[key].x) || 0,
                        y: parseFloat(tagData[key].y) || 0,
                        timestamp: tagData[key].timestamp || Date.now()
                    }));
                    dataArray.sort((a, b) => a.timestamp - b.timestamp);
                    parsedData[tagId] = dataArray;
                });
                setAllHistoryData(parsedData);
            } else {
                setAllHistoryData({});
            }
        });
        return () => unsubscribe();
    }, []);

    // 2. Xử lý Resize bản đồ
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setStageSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    const handleClearHistory = () => {
        if (window.confirm(`Xóa lịch sử quỹ đạo của ${selectedTag}?`)) {
            set(ref(rtdb, `uwb/history/${selectedTag}`), null);
        }
    };

    const toScreen = (physX, physY) => ({
        x: originPx.x + physX * BASE_SCALE,
        y: originPx.y - physY * BASE_SCALE
    });

    const handleWheel = (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        setStageScale(newScale);

        setStagePos({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    // ==========================================
    // RULE-BASED ANALYTICS LOGIC
    // ==========================================
    const analytics = useMemo(() => {
        const allTrajectories = {};
        const globalCongestionPoints = [];

        let selectedWorkingTime = 0;
        let selectedCongestedTime = 0;
        let selectedTransitTime = 0;
        let selectedTotalDistance = 0;
        let selectedCongestionHits = 0;

        Object.keys(allHistoryData).forEach(tag => {
            const hData = allHistoryData[tag];
            if (hData.length < 2) return;

            const points = [];
            const firstScreen = toScreen(hData[0].x, hData[0].y);
            points.push(firstScreen.x, firstScreen.y);

            for (let i = 1; i < hData.length; i++) {
                const point = hData[i];
                const prevPoint = hData[i - 1];
                const screenPos = toScreen(point.x, point.y);
                points.push(screenPos.x, screenPos.y);

                const dtSeconds = (point.timestamp - prevPoint.timestamp) / 1000;
                const dx = point.x - prevPoint.x;
                const dy = point.y - prevPoint.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dtSeconds * 1000 > MAX_GAP_THRESHOLD) continue;

                const speed = dtSeconds > 0 ? dist / dtSeconds : 0;

                // Heatmap điểm nghẽn toàn cục
                if (speed >= workingSpeedThreshold && speed < congestionSpeedThreshold) {
                    globalCongestionPoints.push({ x: point.x, y: point.y });
                }

                // Tính toán thống kê riêng cho Tag đang chọn
                if (tag === selectedTag) {
                    selectedTotalDistance += dist;
                    if (speed < workingSpeedThreshold) {
                        selectedWorkingTime += dtSeconds;
                    } else if (speed >= workingSpeedThreshold && speed < congestionSpeedThreshold) {
                        selectedCongestedTime += dtSeconds;
                        selectedCongestionHits += 1;
                    } else {
                        selectedTransitTime += dtSeconds;
                    }
                }
            }
            allTrajectories[tag] = points;
        });

        const stats = [
            { name: "Working (Stationary)", value: Math.round(selectedWorkingTime), color: "#10b981" },
            { name: "Transit (Normal)", value: Math.round(selectedTransitTime), color: "#0ea5e9" },
            { name: "Congested (Slow)", value: Math.round(selectedCongestedTime), color: "#f43f5e" }
        ];

        return {
            allTrajectories,
            globalCongestionPoints,
            stats,
            selectedTotalDistance,
            selectedCongestionHits
        };
    }, [allHistoryData, selectedTag, workingSpeedThreshold, congestionSpeedThreshold]);

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {/* LEFT: MAP (Chiếm diện tích lớn hơn - full height) */}
                <div className={styles.mapArea} ref={containerRef}>
                    <div className={styles.mapToolBar}>
                        <div className={styles.mapHint}>
                            <i className="ri-drag-move-2-fill"></i> Cuộn để Zoom - Kéo để Pan
                        </div>
                    </div>

                    <Stage width={stageSize.width} height={stageSize.height} draggable onWheel={handleWheel} scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y}>
                        <Layer>
                            <Line points={[originPx.x, -5000, originPx.x, 5000]} stroke="#cbd5e1" strokeWidth={1/stageScale} dash={[5, 5]} />
                            <Line points={[-5000, originPx.y, 5000, originPx.y]} stroke="#cbd5e1" strokeWidth={1/stageScale} dash={[5, 5]} />
                            <Circle x={originPx.x} y={originPx.y} radius={4/stageScale} fill="#94a3b8" />

                            {/* GLOBAL CONGESTION HEATMAP */}
                            {analytics.globalCongestionPoints.map((pt, idx) => {
                                const screenPos = toScreen(pt.x, pt.y);
                                return (
                                    <Circle
                                        key={`cong-${idx}`}
                                        x={screenPos.x}
                                        y={screenPos.y}
                                        radius={18}
                                        fill="#f43f5e"
                                        opacity={0.04}
                                    />
                                );
                            })}

                            {/* OTHER TAGS (Nền mờ) */}
                            {Object.keys(analytics.allTrajectories).map(tag => {
                                if (tag === selectedTag) return null;
                                return (
                                    <Line
                                        key={`traj-${tag}`}
                                        points={analytics.allTrajectories[tag]}
                                        stroke="#94a3b8"
                                        strokeWidth={1.5 / stageScale}
                                        opacity={0.3}
                                        tension={0.2}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                );
                            })}

                            {/* SELECTED TAG (In đậm) */}
                            {analytics.allTrajectories[selectedTag] && (
                                <Line
                                    points={analytics.allTrajectories[selectedTag]}
                                    stroke="#8b5cf6"
                                    strokeWidth={3 / stageScale}
                                    opacity={0.9}
                                    tension={0.2}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                        </Layer>
                    </Stage>

                    <div className={styles.mapLegend}>
                        <div className={styles.legendItem}><span className={styles.dotPurple}></span> {selectedTag} Trajectory</div>
                        <div className={styles.legendItem}><span className={styles.lineGray}></span> Other Tags</div>
                        <div className={styles.legendItem}><span className={styles.dotRed}></span> Global Traffic Heatmap</div>
                    </div>
                </div>

                {/* RIGHT: STATS & CONTROLS */}
                <div className={styles.statsArea}>

                    {/* BẢNG ĐIỀU KHIỂN CHUNG (Đã dời từ trên xuống đây) */}
                    <div className={styles.statCard}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.mainTitle}>Traffic Analytics Map</h3>
                        </div>

                        <div className={styles.controlRow}>
                            <select className={styles.select} value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                                {['T1', 'T2', 'T3', 'T4', 'T5'].map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                            <button className={styles.btnClear} onClick={handleClearHistory}>
                                <i className="ri-delete-bin-line"></i> Clear {selectedTag}
                            </button>
                        </div>

                        <div className={styles.ruleControlsCol}>
                            <div className={styles.controlGroup}>
                                <label>Working Threshold: <strong>{workingSpeedThreshold} m/s</strong></label>
                                <input type="range" min="0.05" max="1.0" step="0.05" value={workingSpeedThreshold} onChange={(e)=>setWorkingSpeedThreshold(parseFloat(e.target.value))} />
                            </div>
                            <div className={styles.controlGroup}>
                                <label>Congestion Threshold: <strong>{congestionSpeedThreshold} m/s</strong></label>
                                <input type="range" min="0.2" max="3.0" step="0.1" value={congestionSpeedThreshold} onChange={(e)=>setCongestionSpeedThreshold(parseFloat(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* PIE CHART THỐNG KÊ CHO TAG */}
                    <div className={styles.statCard}>
                        <div className={styles.cardHeader}>
                            <i className="ri-focus-3-line" style={{color: '#8b5cf6', fontSize: '22px'}}></i>
                            <h3>{selectedTag} Analytics</h3>
                        </div>
                        <div className={styles.chartWrapper}>
                            {analytics.stats.some(s => s.value > 0) ? (
                                <>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <PieChart>
                                            <Pie
                                                data={analytics.stats}
                                                innerRadius={50}
                                                outerRadius={75}
                                                paddingAngle={4}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {analytics.stats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value) => `${value} seconds`}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', fontWeight: '600' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className={styles.customLegend}>
                                        {analytics.stats.map((stat, idx) => (
                                            <div key={idx} className={styles.legendRow}>
                                                <div className={styles.legendLabelWrap}>
                                                    <span className={styles.legendColorDot} style={{ backgroundColor: stat.color }}></span>
                                                    <span className={styles.legendName}>{stat.name}</span>
                                                </div>
                                                <span className={styles.legendTime}>{stat.value}s</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className={styles.emptyState}>
                                    <i className="ri-radar-line"></i>
                                    <p>Chưa có dữ liệu di chuyển cho {selectedTag}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* OVERVIEW TAG CARD */}
                    <div className={styles.statCard}>
                        <div className={styles.cardHeader}>
                            <i className="ri-ruler-line" style={{color: '#0ea5e9'}}></i>
                            <h3>{selectedTag} Overview</h3>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={`${styles.infoBox} ${styles.boxBlue}`}>
                                <span className={styles.infoLabel}>Total Distance</span>
                                <div className={styles.infoValue}>
                                    {analytics.selectedTotalDistance?.toFixed(2)} <span>m</span>
                                </div>
                            </div>
                            <div className={`${styles.infoBox} ${styles.boxRed}`}>
                                <span className={styles.infoLabel}>Slow/Congested Hits</span>
                                <div className={styles.infoValue}>
                                    {analytics.selectedCongestionHits} <span>hits</span>
                                </div>
                            </div>
                        </div>

                        {analytics.selectedCongestionHits > 30 && (
                            <div className={`${styles.ruleSuggestion} ${styles.warn}`}>
                                <i className="ri-alert-line"></i>
                                <div>
                                    <strong>Cảnh báo Luồng đi: </strong>
                                    Thiết bị {selectedTag} gặp nhiều điểm nghẽn hoặc đi qua khu vực đông đúc làm giảm tốc độ.
                                </div>
                            </div>
                        )}
                        {analytics.selectedCongestionHits <= 30 && analytics.stats.some(s => s.value > 0) && (
                            <div className={`${styles.ruleSuggestion} ${styles.good}`}>
                                <i className="ri-check-double-line"></i>
                                <div>
                                    <strong>Hoạt động tối ưu: </strong>
                                    {selectedTag} di chuyển thông thoáng, thời gian trễ do kẹt xe rất thấp.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}