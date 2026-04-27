// src/pages/LiveTracking/TwoDScene.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Circle, Line, Text, Group, Image as KonvaImage, Rect } from "react-konva";
import styles from "./TwoDScene.module.css";
import { rtdb } from "../../service/firebase";
import { ref, onValue, set } from "firebase/database";
import io from "socket.io-client";

const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
};

const DEFAULT_ANCHORS = {
    A0: { x: 0,  y: 0, color: "#0004fc" },
    A1: { x: 0, y: 1, color: "#7c3aed" },
    A2: { x: 1,  y: 0, color: "#0891b2" },
    A3: { x: 1, y: 1, color: "#059669" },
};

const BASE_SCALE = 50;
const GRID_MODES = [0.1, 0.2, 0.5, 1, 2, 5];

export default function TwoDScene() {
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [roomList, setRoomList] = useState({});
    const [currentRoom, setCurrentRoom] = useState("");

    const [anchors, setAnchors] = useState({});
    const [tags, setTags] = useState({});
    const [forbiddenZones, setForbiddenZones] = useState([]);

    const [scale, setScale] = useState(() => parseInt(localStorage.getItem("twoD_scale")) || BASE_SCALE);
    const [gridStep, setGridStep] = useState(() => parseFloat(localStorage.getItem("twoD_gridStep")) || 5);
    const [originPx, setOriginPx] = useState(() => {
        const saved = localStorage.getItem("twoD_originPx");
        return saved ? JSON.parse(saved) : { x: 100, y: 600 };
    });
    const [stagePos, setStagePos] = useState(() => {
        const saved = localStorage.getItem("twoD_stagePos");
        return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    });
    const [stageSize, setStageSize] = useState({ width: 1200, height: 700 });

    const [showGrid, setShowGrid] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [showForbidden, setShowForbidden] = useState(true);

    const [mapImage, setMapImage] = useState(null);
    const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
    const [mapScale, setMapScale] = useState(1);

    const [editAnchor, setEditAnchor] = useState(null);
    const [inputName, setInputName] = useState("");
    const [inputX, setInputX] = useState("");
    const [inputY, setInputY] = useState("");
    const [lockedAnchors, setLockedAnchors] = useState({});

    const [isMovingMap, setIsMovingMap] = useState(false);
    const isMovingMapRef = useRef(false);
    const isPanningRef = useRef(false);
    const stageRef = useRef(null);
    const containerRef = useRef(null);
    const socketRef = useRef(null);
    const isDraggingAnchorRef = useRef(false);
    const isDraggingTagRef = useRef(false);
    const lastMousePos = useRef(null);
    const lastPanPos = useRef(null);
    const currentImgStr = useRef(null);
    const mapOffsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => { mapOffsetRef.current = mapOffset; }, [mapOffset]);

    const updateScale = (newScale) => {
        setScale(newScale);
        localStorage.setItem("twoD_scale", newScale);
    };

    const updateOriginPx = (newPos) => {
        setOriginPx(newPos);
        localStorage.setItem("twoD_originPx", JSON.stringify(newPos));
    };

    const updateStagePos = (newPos) => {
        setStagePos(newPos);
        localStorage.setItem("twoD_stagePos", JSON.stringify(newPos));
    };

    const getPxPerM = useCallback(() => scale / gridStep, [scale, gridStep]);

    const toScreen = useCallback((physX, physY) => {
        const ppm = getPxPerM();
        return {
            x: originPx.x + physX * ppm,
            y: originPx.y - physY * ppm
        };
    }, [originPx, getPxPerM]);

    const toPhysical = useCallback((screenX, screenY) => {
        const ppm = getPxPerM();
        return {
            x: (screenX - originPx.x) / ppm,
            y: (originPx.y - screenY) / ppm
        };
    }, [originPx, getPxPerM]);

    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setStageSize({ width: rect.width, height: rect.height });
            if (!localStorage.getItem("twoD_originPx")) {
                updateOriginPx({ x: 100, y: rect.height - 100 });
            }
        }
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setStageSize({ width: rect.width, height: rect.height });
            }
        };
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // ĐÃ SỬA LỖI NHẬN SOCKET Ở ĐÂY
    useEffect(() => {
        const socket = io("http://localhost:3000", { transports: ["websocket"], reconnection: true });
        socketRef.current = socket;

        socket.on("full-state-update", (state) => {
            if (!isDraggingTagRef.current) {
                // Nếu server gửi dạng danh sách tags (multi-tag)
                if (state.tags) {
                    setTags(prev => ({ ...prev, ...state.tags }));
                }
                // Nếu server gửi dạng 1 tag (single-tag như file server.js hiện tại)
                if (state.tag) {
                    setTags(prev => {
                        const tagId = state.tag.id ? `T${state.tag.id}` : "T1";
                        return {
                            ...prev,
                            [tagId]: {
                                x: state.tag.x,
                                y: state.tag.y !== undefined ? state.tag.y : state.tag.z
                            }
                        };
                    });
                }
            }
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        const unsub = onValue(ref(rtdb, "uwb/roomList"), (snap) => {
            const data = snap.val();
            if (data) {
                setRoomList(data);
                setCurrentRoom(prev => (prev && data[prev]) ? prev : Object.keys(data)[0]);
            } else {
                const defaultId = "room_default";
                set(ref(rtdb, `uwb/roomList/${defaultId}`), { name: "Default Room" });
                set(ref(rtdb, `uwb/rooms/${defaultId}/anchors`), DEFAULT_ANCHORS);
                setCurrentRoom(defaultId);
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!currentRoom) return;

        setMapImage(null);
        setAnchors({});
        currentImgStr.current = null;

        const roomPath = `uwb/rooms/${currentRoom}`;

        const unsubTags = onValue(ref(rtdb, `${roomPath}/tags`), (snap) => {
            const data = snap.val() || {};
            if (!isDraggingTagRef.current) {
                setTags(prev => ({ ...prev, ...data }));
            }
        });

        const unsubMap = onValue(ref(rtdb, `${roomPath}/map`), (snap) => {
            const data = snap.val();
            if (data) {
                if (data.scale !== undefined) setMapScale(data.scale);
                if (data.offset && !isMovingMapRef.current) setMapOffset(data.offset);
                if (data.image && data.image !== currentImgStr.current) {
                    currentImgStr.current = data.image;
                    const img = new window.Image();
                    img.onload = () => setMapImage(img);
                    img.src = data.image;
                } else if (!data.image) {
                    currentImgStr.current = null;
                    setMapImage(null);
                }
            } else {
                setMapScale(1);
                setMapOffset({x: 0, y: 0});
                setMapImage(null);
                currentImgStr.current = null;
            }
        });

        const unsubAnchors = onValue(ref(rtdb, `${roomPath}/anchors`), (snap) => {
            const data = snap.val();
            if (data) {
                setAnchors(prev => {
                    const merged = {};
                    Object.keys(data).forEach(id => {
                        merged[id] = { ...data[id], color: data[id].color || prev[id]?.color || getRandomColor() };
                    });
                    return merged;
                });
            } else {
                Object.keys(DEFAULT_ANCHORS).forEach(id => saveAnchor(id, DEFAULT_ANCHORS[id]));
            }
        });

        const unsubZones = onValue(ref(rtdb, `uwb/forbidden/zones`), (snap) => {
            const data = snap.val();
            const zonesList = data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : [];
            setForbiddenZones(zonesList);
        });

        return () => {
            unsubMap();
            unsubAnchors();
            unsubZones();
            unsubTags();
        };
    }, [currentRoom]);

    useEffect(() => {
        if (socketRef.current && socketRef.current.connected && currentRoom) {
            socketRef.current.emit("update_zones", { roomId: currentRoom, zones: forbiddenZones });
        }
    }, [forbiddenZones, currentRoom]);

    useEffect(() => {
        const down = (e) => {
            if (e.key.toLowerCase() === 'm' && e.target.tagName !== "INPUT") {
                setIsMovingMap(true);
                isMovingMapRef.current = true;
            }
        };
        const up = (e) => {
            if (e.key.toLowerCase() === 'm') {
                setIsMovingMap(false);
                isMovingMapRef.current = false;
            }
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    const saveAnchor = (id, pos) => set(ref(rtdb, `uwb/rooms/${currentRoom}/anchors/${id}`), pos);

    const lockAnchor = (id) => {
        setLockedAnchors(prev => ({ ...prev, [id]: true }));
        setTimeout(() => {
            setLockedAnchors(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }, 10000);
    };

    const changeGridStep = (newStep) => {
        if (newStep === gridStep) return;
        const ratio = newStep / gridStep;

        const updatedAnchors = {};
        Object.keys(anchors).forEach(id => {
            const pos = anchors[id];
            const newX = pos.x * ratio;
            const newY = pos.y * ratio;
            updatedAnchors[id] = { ...pos, x: newX, y: newY };
            saveAnchor(id, updatedAnchors[id]);
            if (socketRef.current) socketRef.current.emit("update_anchor", { roomId: currentRoom, id: id, x: newX, y: newY });
        });
        setAnchors(updatedAnchors);

        const newTags = {};
        Object.keys(tags).forEach(id => {
            newTags[id] = { x: tags[id].x * ratio, y: tags[id].y * ratio };
            set(ref(rtdb, `uwb/rooms/${currentRoom}/tags/${id}`), newTags[id]);
        });

        setGridStep(newStep);
        localStorage.setItem("twoD_gridStep", newStep);
    };

    const getGridLabel = (step) => step < 1 ? `${Math.round(step * 100)}cm` : `${step}m`;

    const handleAnchorDragStart = () => isDraggingAnchorRef.current = true;

    const handleAnchorClick = (id) => {
        if (lockedAnchors[id]) return;
        setEditAnchor(id);
        setInputName(id);
        setInputX(anchors[id].x.toString());
        setInputY(anchors[id].y.toString());
    };

    const applyAnchorEdit = () => {
        if (!editAnchor) return;
        let x = parseFloat(inputX) || 0;
        let y = parseFloat(inputY) || 0;
        const newName = inputName.trim() || editAnchor;
        const currentColor = anchors[editAnchor]?.color || getRandomColor();
        const updated = { ...anchors };

        if (newName !== editAnchor) {
            delete updated[editAnchor];
            set(ref(rtdb, `uwb/rooms/${currentRoom}/anchors/${editAnchor}`), null);
        }

        updated[newName] = { x, y, color: currentColor };
        setAnchors(updated);
        saveAnchor(newName, { x, y, color: currentColor });

        if (socketRef.current) {
            socketRef.current.emit("update_anchor", { roomId: currentRoom, id: newName, x, y });
        }

        lockAnchor(newName);
        setEditAnchor(null);
    };

    const addNewAnchor = () => {
        const ids = Object.keys(anchors).map(k => parseInt(k.replace(/\D/g, '')) || 0);
        const maxId = ids.length ? Math.max(...ids) : 3;
        const newId = `A${maxId + 1}`;
        const newPos = { x: 5, y: 5, color: getRandomColor() };

        const updated = { ...anchors, [newId]: newPos };
        setAnchors(updated);
        saveAnchor(newId, newPos);

        if (socketRef.current) {
            socketRef.current.emit("update_anchor", { roomId: currentRoom, id: newId, x: newPos.x, y: newPos.y });
        }
    };

    const addNewTag = () => {
        const ids = Object.keys(tags).map(k => parseInt(k.replace(/\D/g, '')) || 0);
        const maxId = ids.length ? Math.max(...ids) : 0;
        const newId = `T${maxId + 1}`;

        const initialPos = { x: 2, y: 2 };
        set(ref(rtdb, `uwb/rooms/${currentRoom}/tags/${newId}`), initialPos);
    };

    const deleteAnchor = (id) => {
        if (!window.confirm(`Delete Anchor ${id}?`)) return;
        const updated = { ...anchors };
        delete updated[id];
        setAnchors(updated);
        set(ref(rtdb, `uwb/rooms/${currentRoom}/anchors/${id}`), null);
        if (editAnchor === id) setEditAnchor(null);
    };

    const handleAddRoom = () => {
        const name = prompt("Enter new room name (e.g., Floor 1, Warehouse...):");
        if (!name || !name.trim()) return;
        const newRoomId = "room_" + Date.now();
        set(ref(rtdb, `uwb/roomList/${newRoomId}`), { name: name.trim() });
        set(ref(rtdb, `uwb/rooms/${newRoomId}/anchors`), DEFAULT_ANCHORS);
        setCurrentRoom(newRoomId);
    };

    const handleDeleteRoom = () => {
        if (Object.keys(roomList).length <= 1) {
            alert("The system must have at least 1 room, cannot be deleted!");
            return;
        }
        const roomName = roomList[currentRoom]?.name || currentRoom;
        if (window.confirm(`Are you sure you want to delete the map and configuration for room [${roomName}]?`)) {
            set(ref(rtdb, `uwb/roomList/${currentRoom}`), null);
            set(ref(rtdb, `uwb/rooms/${currentRoom}`), null);
        }
    };

    const handleLoadMap = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 1800;
                    const MAX_HEIGHT = 1800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64 = canvas.toDataURL("image/jpeg", 0.7);

                    currentImgStr.current = base64;
                    setMapImage(img);
                    set(ref(rtdb, `uwb/rooms/${currentRoom}/map`), {
                        image: base64,
                        scale: 1,
                        offset: { x: 0, y: -height }
                    });
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const updateMapScale = (newScale) => {
        const scaled = Math.max(0.01, Math.min(newScale, 3));
        setMapScale(scaled);
        set(ref(rtdb, `uwb/rooms/${currentRoom}/map/scale`), scaled);
    };

    const handleStageMouseDown = (e) => {
        if (e.evt.button === 2) {
            isPanningRef.current = true;
            lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        } else if (isMovingMapRef.current) {
            lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
    };

    const handleStageMouseMove = (e) => {
        if (isPanningRef.current && lastPanPos.current) {
            const dx = e.evt.clientX - lastPanPos.current.x;
            const dy = e.evt.clientY - lastPanPos.current.y;
            setStagePos(prev => {
                const next = { x: prev.x + dx, y: prev.y + dy };
                localStorage.setItem("twoD_stagePos", JSON.stringify(next));
                return next;
            });
            lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        } else if (isMovingMapRef.current && lastMousePos.current) {
            const dx = e.evt.clientX - lastMousePos.current.x;
            const dy = e.evt.clientY - lastMousePos.current.y;
            const zoomRatio = scale / BASE_SCALE;
            setMapOffset(prev => ({ x: prev.x + dx / zoomRatio, y: prev.y + dy / zoomRatio }));
            lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
    };

    const handleStageMouseUp = (e) => {
        if (e.evt.button === 2 || isPanningRef.current) {
            isPanningRef.current = false;
            lastPanPos.current = null;
        }
        if (isMovingMapRef.current && lastMousePos.current !== null) {
            set(ref(rtdb, `uwb/rooms/${currentRoom}/map/offset`), mapOffsetRef.current);
            lastMousePos.current = null;
        }
    };

    const resetView = () => {
        updateOriginPx({ x: 100, y: stageSize.height - 100 });
        updateStagePos({ x: 0, y: 0 });
    };

    const renderGrid = () => {
        if (!showGrid) return null;
        const stepPx = scale;
        const startX = originPx.x;
        const startY = originPx.y;
        const viewMinX = -stagePos.x;
        const viewMinY = -stagePos.y;
        const viewMaxX = viewMinX + stageSize.width;
        const viewMaxY = viewMinY + stageSize.height;

        const firstX = Math.floor((viewMinX - startX) / stepPx) * stepPx + startX;
        const firstY = Math.floor((viewMinY - startY) / stepPx) * stepPx + startY;

        const lines = [];
        for (let x = firstX; x <= viewMaxX + stepPx; x += stepPx) {
            lines.push(<Line key={`v${x}`} points={[x, viewMinY - stepPx, x, viewMaxY + stepPx]} stroke="#e5e7eb" strokeWidth={1} listening={false} />);
        }
        for (let y = firstY; y <= viewMaxY + stepPx; y += stepPx) {
            lines.push(<Line key={`h${y}`} points={[viewMinX - stepPx, y, viewMaxX + stepPx, y]} stroke="#e5e7eb" strokeWidth={1} listening={false} />);
        }

        lines.push(<Line key="axisY" points={[startX, viewMinY - stepPx, startX, viewMaxY + stepPx]} stroke="#cbd5e1" strokeWidth={2} listening={false} />);
        lines.push(<Line key="axisX" points={[viewMinX - stepPx, startY, viewMaxX + stepPx, startY]} stroke="#cbd5e1" strokeWidth={2} listening={false} />);

        return lines;
    };

    const zoomRatio = scale / BASE_SCALE;
    const effectiveMapScale = mapScale * zoomRatio;

    return (
        <div className={styles.container}>
            <div className={styles.topControlContainer}>
                <div className={styles.compactBar}>
                    <select
                        value={currentRoom}
                        onChange={(e) => setCurrentRoom(e.target.value)}
                        className={styles.select}
                    >
                        {Object.entries(roomList).map(([id, info]) => (
                            <option key={id} value={id}>{info.name}</option>
                        ))}
                    </select>

                    <div className={styles.divider} />

                    <div className={styles.toggleGroup}>
                        <button className={`${styles.toggleBtn} ${showGrid ? styles.active : ""}`} onClick={() => setShowGrid(v => !v)}>Grid</button>
                        <button className={`${styles.toggleBtn} ${showLabels ? styles.active : ""}`} onClick={() => setShowLabels(v => !v)}>Labels</button>
                        <button className={`${styles.toggleBtn} ${showForbidden ? styles.active : ""}`} onClick={() => setShowForbidden(v => !v)}>Zones</button>
                    </div>

                    <div className={styles.divider} />

                    <button
                        className={`${styles.expandBtn} ${isPanelExpanded ? styles.expanded : ""}`}
                        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                    >
                        {isPanelExpanded ? "Collapse ▴" : "Settings ▾"}
                    </button>
                </div>

                {isPanelExpanded && (
                    <div className={styles.expandedPanel}>
                        <div className={styles.panelGrid}>
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Room & Devices</div>
                                <div className={styles.row}>
                                    <button className={styles.btn} onClick={handleAddRoom}>+ Add Room</button>
                                    <button className={`${styles.btn} ${styles.danger}`} onClick={handleDeleteRoom}>Delete room</button>
                                </div>
                                <div className={styles.row}>
                                    <button className={styles.btn} onClick={addNewAnchor}>+ Add Anchor</button>
                                    <button className={styles.btn} onClick={addNewTag}>+ Add Tag</button>
                                </div>
                            </div>

                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Background Map</div>
                                <button className={styles.btn} onClick={handleLoadMap} style={{ width: '100%' }}>✚ Upload Map</button>
                                <div className={styles.row}>
                                    <span className={styles.labelSpan}>Scale</span>
                                    <input
                                        type="range"
                                        min="0.05"
                                        max="3"
                                        step="0.01"
                                        value={mapScale}
                                        onChange={(e) => updateMapScale(parseFloat(e.target.value))}
                                        className={styles.slider}
                                    />
                                    <input
                                        type="number"
                                        min="0.05"
                                        max="3"
                                        step="0.05"
                                        value={mapScale}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) updateMapScale(val);
                                        }}
                                        className={styles.numberInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>View & Grid</div>
                                <div className={styles.row}>
                                    <span className={styles.labelSpan}>Grid Size:</span>
                                    <button className={styles.btn} onClick={() => {
                                        const idx = GRID_MODES.indexOf(gridStep);
                                        const nextStep = GRID_MODES[(idx + 1) % GRID_MODES.length];
                                        changeGridStep(nextStep);
                                    }}>
                                        {getGridLabel(gridStep)}
                                    </button>
                                </div>
                                <div className={styles.row}>
                                    <span className={styles.labelSpan}>Zoom</span>
                                    <div className={styles.zoomControls}>
                                        <button className={styles.iconBtn} onClick={() => updateScale(Math.max(20, scale - 5))}>−</button>
                                        <span className={styles.valueSpan}>{scale}px</span>
                                        <button className={styles.iconBtn} onClick={() => updateScale(Math.min(150, scale + 5))}>+</button>
                                    </div>
                                </div>
                                <button className={styles.btn} onClick={resetView} style={{ width: '100%' }}>Reset to Default</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div ref={containerRef} className={styles.canvasWrapper} onContextMenu={(e) => e.preventDefault()}>
                <Stage
                    ref={stageRef}
                    x={stagePos.x}
                    y={stagePos.y}
                    width={stageSize.width}
                    height={stageSize.height}
                    draggable={false}
                    onContextMenu={(e) => e.evt.preventDefault()}
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={handleStageMouseMove}
                    onMouseUp={handleStageMouseUp}
                    onMouseLeave={handleStageMouseUp}
                >
                    <Layer>
                        {mapImage && (
                            <KonvaImage
                                image={mapImage}
                                x={originPx.x + mapOffset.x * zoomRatio}
                                y={originPx.y + mapOffset.y * zoomRatio}
                                width={(mapImage?.width || 0) * effectiveMapScale}
                                height={(mapImage?.height || 0) * effectiveMapScale}
                                opacity={0.92}
                                listening={false}
                            />
                        )}

                        {renderGrid()}

                        {showForbidden && forbiddenZones.map(zone => {
                            const physX = zone.x || 0;
                            const physY = zone.z || 0;
                            const physW = zone.w || 4;
                            const physH = zone.d || 4;

                            const wPx = physW * getPxPerM();
                            const hPx = physH * getPxPerM();
                            const topLeftScreen = toScreen(physX - physW / 2, physY + physH / 2);

                            return (
                                <Rect
                                    key={zone.id}
                                    x={topLeftScreen.x}
                                    y={topLeftScreen.y}
                                    width={wPx}
                                    height={hPx}
                                    fill="rgba(239, 172, 172, 0.35)"
                                    stroke="#d32f2f"
                                    strokeWidth={1}
                                    listening={false}
                                />
                            );
                        })}

                        <Group
                            x={originPx.x}
                            y={originPx.y}
                            draggable
                            onDragEnd={(e) => updateOriginPx({ x: e.target.x(), y: e.target.y() })}
                        >
                            <Circle x={0} y={0} radius={6} fill="#ef4444" />
                            <Circle x={0} y={0} radius={3} fill="#ffffff" />
                            {showLabels && <Text x={14} y={-20} text="(0,0)" fontSize={13} fill="#ef4444" fontStyle="bold" listening={false} />}
                        </Group>

                        {Object.entries(tags).map(([tagId, tagPos]) => {
                            const screenTag = toScreen(tagPos.x, tagPos.y);
                            return Object.entries(anchors).map(([id, pos]) => {
                                const screenAnchor = toScreen(pos.x, pos.y);
                                return (
                                    <Line
                                        key={`line-${tagId}-${id}`}
                                        points={[screenTag.x, screenTag.y, screenAnchor.x, screenAnchor.y]}
                                        stroke={pos.color || "#0004fc"} strokeWidth={1.5} opacity={0.35} dash={[5,4]} listening={false}
                                    />
                                );
                            });
                        })}

                        {Object.entries(anchors).map(([id, pos]) => {
                            const color = pos.color || "#0004fc";
                            const screenPos = toScreen(pos.x, pos.y);
                            const isLocked = lockedAnchors[id];

                            return (
                                <Group
                                    key={id}
                                    x={screenPos.x}
                                    y={screenPos.y}
                                    draggable={!isLocked}
                                    onDragStart={handleAnchorDragStart}
                                    onDragEnd={(e) => {
                                        isDraggingAnchorRef.current = false;
                                        const phys = toPhysical(e.target.x(), e.target.y());
                                        const newX = phys.x;
                                        const newY = phys.y;

                                        const updated = { ...anchors, [id]: { ...anchors[id], x: newX, y: newY } };
                                        setAnchors(updated);
                                        saveAnchor(id, updated[id]);

                                        if (socketRef.current) socketRef.current.emit("update_anchor", { roomId: currentRoom, id, x: newX, y: newY });
                                        e.target.position(toScreen(newX, newY));
                                    }}
                                    onClick={() => handleAnchorClick(id)}
                                    onTap={() => handleAnchorClick(id)}
                                >
                                    <Circle x={0} y={0} radius={20} fill="transparent" stroke={color} strokeWidth={isLocked ? 4 : 2} opacity={isLocked ? 0.8 : 0.25} dash={isLocked ? [4, 4] : undefined} listening={false} />
                                    <Circle x={0} y={0} radius={11} fill={color} shadowBlur={12} shadowColor={color} shadowOpacity={0.6} />
                                    {showLabels && (
                                        <>
                                            <Text x={18} y={-12} text={id} fontSize={14} fill={color} fontStyle="bold" listening={false} />
                                            <Text x={18} y={6} text={`(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`} fontSize={10.5} fill="#64748b" listening={false} />
                                            {isLocked && <Text x={18} y={20} text="Locked (10s)" fontSize={10} fill="#f59e0b" fontStyle="bold" listening={false} />}
                                        </>
                                    )}
                                </Group>
                            );
                        })}

                        {Object.entries(tags).map(([tagId, tagPos]) => (
                            <Group
                                key={tagId}
                                x={toScreen(tagPos.x, tagPos.y).x}
                                y={toScreen(tagPos.x, tagPos.y).y}
                                draggable
                                onDragStart={() => { isDraggingTagRef.current = true; }}
                                onDragEnd={(e) => {
                                    isDraggingTagRef.current = false;
                                    const phys = toPhysical(e.target.x(), e.target.y());
                                    const newX = phys.x;
                                    const newY = phys.y;

                                    set(ref(rtdb, `uwb/rooms/${currentRoom}/tags/${tagId}`), { x: newX, y: newY });
                                    e.target.position(toScreen(newX, newY));

                                    if (socketRef.current) {
                                        socketRef.current.emit("sim_tag_update", { roomId: currentRoom, id: tagId, x: newX, y: newY });
                                    }
                                }}
                                onClick={() => {
                                    if (window.confirm(`Bạn có chắc muốn xóa Tag ${tagId} không?`)) {
                                        set(ref(rtdb, `uwb/rooms/${currentRoom}/tags/${tagId}`), null);
                                    }
                                }}
                                onTap={() => {
                                    if (window.confirm(`Bạn có chắc muốn xóa Tag ${tagId} không?`)) {
                                        set(ref(rtdb, `uwb/rooms/${currentRoom}/tags/${tagId}`), null);
                                    }
                                }}
                            >
                                <Circle x={0} y={0} radius={28} fill="transparent" stroke="#ff5500" strokeWidth={2.5} opacity={0.3} listening={true} />
                                <Circle x={0} y={0} radius={14} fill="#ff5500" shadowBlur={18} shadowColor="#ff5500" shadowOpacity={0.7} />
                                {showLabels && (
                                    <>
                                        <Text x={20} y={-12} text={tagId} fontSize={14} fill="#ff5500" fontStyle="bold" listening={false} />
                                        <Text x={20} y={6} text={`(${tagPos.x?.toFixed(2)}, ${tagPos.y?.toFixed(2)})`} fontSize={10.5} fill="#64748b" listening={false} />
                                    </>
                                )}
                            </Group>
                        ))}
                    </Layer>
                </Stage>

                {editAnchor && (
                    <div className={styles.popup}>
                        <div className={styles.popupHeader}>
                            <span className={styles.popupDot} style={{ background: anchors[editAnchor]?.color || "#000" }} />
                            Edit Anchor <strong>{editAnchor}</strong>
                        </div>
                        <div className={styles.popupBody}>
                            <div>
                                <div className={styles.popupLabel}>Name</div>
                                <input className={styles.popupInput} type="text" value={inputName} onChange={e => setInputName(e.target.value)} autoFocus />
                            </div>
                            <div>
                                <div className={styles.popupLabel}>X (meters)</div>
                                <input className={styles.popupInput} type="number" step="0.01" value={inputX} onChange={e => setInputX(e.target.value)} />
                            </div>
                            <div>
                                <div className={styles.popupLabel}>Y (meters)</div>
                                <input className={styles.popupInput} type="number" step="0.01" value={inputY} onChange={e => setInputY(e.target.value)}
                                       onKeyDown={e => { if (e.key === "Enter") applyAnchorEdit(); if (e.key === "Escape") setEditAnchor(null); }} />
                            </div>
                        </div>
                        <div className={styles.popupFooter}>
                            <button className={`${styles.popupCancel} ${styles.danger}`} onClick={() => deleteAnchor(editAnchor)}>Delete</button>
                            <button className={styles.popupCancel} onClick={() => setEditAnchor(null)}>Cancel</button>
                            <button className={styles.popupApply} onClick={applyAnchorEdit}>Apply</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}