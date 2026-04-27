// src/pages/LiveTracking/ThreeScene.jsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../../service/firebase";
import io from "socket.io-client";

export default function ThreeScene() {
    const mountRef = useRef(null);
    const socketRef = useRef(null);

    // === CHẾ ĐỘ GRID ===
    const [gridMode, setGridMode] = useState(2);
    const modes = [
        { name: "Small", size: 10 },
        { name: "Medium", size: 20 },
        { name: "Large", size: 40 },
    ];
    const cycleGridMode = () => setGridMode((prev) => (prev % 3) + 1);
    const currentGridSize = modes[gridMode - 1].size;

    // === Visual Scale cho Forbidden Zones ===
    const [visualScaleFactor, setVisualScaleFactor] = useState(1.8);
    const scaleOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    const cycleVisualScale = () => {
        const idx = scaleOptions.indexOf(visualScaleFactor);
        setVisualScaleFactor(scaleOptions[(idx + 1) % scaleOptions.length]);
    };

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // 1. Khởi tạo Socket.IO
        let socket;
        try {
            socket = io("http://localhost:3000", { transports: ["websocket"], reconnection: true });
            socketRef.current = socket;
        } catch (err) {
            console.error("Socket.IO init failed:", err);
        }

        // 2. Cài đặt Scene cơ bản
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);
        scene.fog = new THREE.FogExp2(0xf8f9fa, 0.012);

        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 2000);
        camera.position.set(8, 6, 15);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        const handleResize = () => {
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        };
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(mount);

        // Ánh sáng & Lưới
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(12, 18, 12);
        scene.add(dirLight);

        const grid = new THREE.GridHelper(currentGridSize, currentGridSize * 4, 0x888888, 0xcccccc);
        grid.material.transparent = true;
        grid.material.opacity = 0.25;
        scene.add(grid);
        scene.add(new THREE.AxesHelper(3));

        const gridScale = currentGridSize / 20;

        // 3. Quản lý Động (Dynamic Groups) cho nhiều Tags & Anchors
        const anchorsGroup = new THREE.Group(); scene.add(anchorsGroup);
        const tagsGroup = new THREE.Group(); scene.add(tagsGroup);
        const linesGroup = new THREE.Group(); scene.add(linesGroup);
        const forbiddenGroup = new THREE.Group(); scene.add(forbiddenGroup);

        const anchors3D = {};
        const tags3D = {};
        const lines3D = {};

        // Helper tạo Text Label
        const createLabel = (text, color) => {
            const canvas = document.createElement("canvas");
            canvas.width = 128; canvas.height = 48;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillRect(0, 0, 128, 48);
            ctx.strokeStyle = "#cccccc"; ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 128, 48);
            ctx.fillStyle = color;
            ctx.font = "bold 28px Arial";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(text, 64, 24);
            const texture = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
            sprite.scale.set(1.6, 0.65, 1);
            return sprite;
        };

        // Helper tạo Anchor
        const createAnchor = (id, colorHex) => {
            const radius = Math.max(0.12, Math.min(0.38, 0.22 * gridScale));
            const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.25 });
            const geo = new THREE.SphereGeometry(radius, 32, 32);
            const mesh = new THREE.Mesh(geo, mat);
            const label = createLabel(id, colorHex);

            anchorsGroup.add(mesh);
            anchorsGroup.add(label);
            return { mesh, label, radius };
        };

        // Helper tạo Tag (kèm vầng sáng Halo)
        const createTag = (id, colorHex) => {
            const radius = Math.max(0.18, Math.min(0.45, 0.28 * gridScale));
            const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.75 });
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), mat);

            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 256;
            const ctx = canvas.getContext("2d");
            const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            gradient.addColorStop(0,   `rgba(255,59,48,1.0)`);
            gradient.addColorStop(0.3, `rgba(255,59,48,0.7)`);
            gradient.addColorStop(0.6, `rgba(255,59,48,0.25)`);
            gradient.addColorStop(1,   `rgba(255,59,48,0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);

            const halo = new THREE.Sprite(new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(canvas),
                color: colorHex, transparent: true, opacity: 0.75,
                blending: THREE.AdditiveBlending, depthWrite: false,
            }));
            halo.scale.set(2.8 * gridScale, 2.8 * gridScale, 1);
            const label = createLabel(id, "#ff3b30");

            tagsGroup.add(mesh);
            tagsGroup.add(halo);
            tagsGroup.add(label);
            return { mesh, halo, label, radius };
        };

        // Material cho Tia Laser
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.75 });

        // 4. Lắng nghe Dữ Liệu từ Firebase (Đồng bộ đa thiết bị giống 2D)
        let currentRoom = null;
        let anchorsUnsub = null;
        let tagsUnsub = null;

        const roomListUnsub = onValue(ref(rtdb, "uwb/roomList"), (snap) => {
            const rooms = snap.val();
            if (!rooms) return;
            currentRoom = Object.keys(rooms)[0];

            if (currentRoom) {
                // Đọc Anchors
                if (anchorsUnsub) anchorsUnsub();
                anchorsUnsub = onValue(ref(rtdb, `uwb/rooms/${currentRoom}/anchors`), (aSnap) => {
                    const data = aSnap.val() || {};
                    Object.keys(data).forEach(id => {
                        if (!anchors3D[id]) anchors3D[id] = createAnchor(id, data[id].color || "#0066ff");
                        // CHÚ Ý: Đổi hệ tọa độ! 2D.y -> 3D.z. Chiều cao Y cố định là 1.0 cho Anchor
                        anchors3D[id].mesh.position.set(data[id].x || 0, 1.0, data[id].y || 0);
                    });
                    Object.keys(anchors3D).forEach(id => {
                        if (!data[id]) {
                            anchorsGroup.remove(anchors3D[id].mesh, anchors3D[id].label);
                            delete anchors3D[id];
                        }
                    });
                });

                // Đọc Tags
                if (tagsUnsub) tagsUnsub();
                tagsUnsub = onValue(ref(rtdb, `uwb/rooms/${currentRoom}/tags`), (tSnap) => {
                    const data = tSnap.val() || {};
                    Object.keys(data).forEach(id => {
                        if (!tags3D[id]) tags3D[id] = createTag(id, "#ff3b30");
                        // CHÚ Ý: Đổi hệ tọa độ! 2D.y -> 3D.z. Chiều cao Y cố định là 0.2 cho Tag (bám sát mặt đất)
                        tags3D[id].mesh.position.set(data[id].x || 0, 0.2, data[id].y || 0);
                    });
                    Object.keys(tags3D).forEach(id => {
                        if (!data[id]) {
                            tagsGroup.remove(tags3D[id].mesh, tags3D[id].halo, tags3D[id].label);
                            delete tags3D[id];
                        }
                    });
                });
            }
        });

        // 5. Cập nhật vị trí Tags theo Real-time Socket (Đè lên Firebase data nếu có)
        if (socket) {
            socket.on("full-state-update", (state) => {
                if (state.tags) {
                    Object.keys(state.tags).forEach(id => {
                        if (tags3D[id]) {
                            const t = state.tags[id];
                            // Cập nhật mượt mà, vẫn quy tắc: 2D.y -> 3D.z
                            tags3D[id].mesh.position.set(t.x || 0, 0.2, t.y || 0);
                        }
                    });
                }
            });
        }

        // 6. Xử lý Vùng Cấm (Forbidden Zones)
        const forbiddenMaterial = new THREE.MeshPhongMaterial({ color: 0xefacac, transparent: true, opacity: 0.35, depthWrite: false, shininess: 5 });
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xd32f2f, transparent: true, opacity: 0.9 });

        const zonesUnsubscribe = onValue(ref(rtdb, "uwb/forbidden/zones"), (snap) => {
            forbiddenGroup.clear();
            const data = snap.val();
            if (!data) return;

            Object.keys(data).forEach(key => {
                const cfg = data[key];
                const realW = Math.max(0.5, cfg.w || 4);
                const realH = Math.max(0.5, cfg.h || 3);
                const realD = Math.max(0.5, cfg.d || 4);

                const maxReal = Math.max(realW, realH, realD);
                let auto = (maxReal < 2) ? 2.0 : (maxReal < 4) ? 1.4 : (maxReal > 10) ? 0.75 : 0.9;
                const finalScale = auto * visualScaleFactor;

                const mesh = new THREE.Mesh(new THREE.BoxGeometry(realW * finalScale, realH * finalScale, realD * finalScale), forbiddenMaterial);
                // Hệ tọa độ Vùng Cấm giữ nguyên cấu trúc chuẩn 3D X, Y, Z
                mesh.position.set(cfg.x || 0, cfg.y || 0, cfg.z || 0);

                const edges = new THREE.EdgesGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
                wireframe.position.copy(mesh.position);

                forbiddenGroup.add(mesh);
                forbiddenGroup.add(wireframe);
            });
        });

        // Toggle UI Key
        const showLabelsState = { current: true };
        let showForbidden = true;
        const handleKey = (e) => {
            if (e.key.toLowerCase() === "l") {
                showLabelsState.current = !showLabelsState.current;
                Object.values(anchors3D).forEach(a => a.label.visible = showLabelsState.current);
                Object.values(tags3D).forEach(t => { t.label.visible = showLabelsState.current; t.halo.visible = showLabelsState.current; });
                linesGroup.visible = showLabelsState.current;
            }
            if (e.key.toLowerCase() === "b") {
                showForbidden = !showForbidden;
                forbiddenGroup.visible = showForbidden;
            }
        };
        window.addEventListener("keydown", handleKey);

        // 7. Vòng lặp Animation & Vẽ tia Laser
        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();

            const elapsed = clock.getElapsedTime();

            // Vẽ Laser động cho TẤT CẢ tags nối tới TẤT CẢ anchors
            Object.keys(tags3D).forEach(tId => {
                Object.keys(anchors3D).forEach(aId => {
                    const lineId = `${tId}-${aId}`;
                    if (!lines3D[lineId]) {
                        const geo = new THREE.BufferGeometry();
                        const line = new THREE.Line(geo, lineMat);
                        linesGroup.add(line);
                        lines3D[lineId] = line;
                    }
                    const p1 = tags3D[tId].mesh.position;
                    const p2 = anchors3D[aId].mesh.position;
                    const positions = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
                    lines3D[lineId].geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                    lines3D[lineId].geometry.attributes.position.needsUpdate = true;
                });
            });

            // Dọn dẹp laser nếu bị xóa
            Object.keys(lines3D).forEach(lineId => {
                const [tId, aId] = lineId.split('-');
                if (!tags3D[tId] || !anchors3D[aId]) {
                    linesGroup.remove(lines3D[lineId]);
                    delete lines3D[lineId];
                }
            });

            // Cập nhật Animation & Label Position
            Object.values(tags3D).forEach(tag => {
                tag.mesh.material.emissiveIntensity = 0.75 + Math.sin(elapsed * 3.5) * 0.3;
                tag.halo.material.opacity = 0.75 + Math.sin(elapsed * 3) * 0.15;
                tag.halo.position.copy(tag.mesh.position);

                tag.label.position.copy(tag.mesh.position).add(new THREE.Vector3(0, tag.radius + 0.6, 0));
                tag.label.lookAt(camera.position);
            });

            Object.values(anchors3D).forEach(anchor => {
                anchor.label.position.copy(anchor.mesh.position).add(new THREE.Vector3(0, anchor.radius + 0.5, 0));
                anchor.label.lookAt(camera.position);
            });

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (socket) socket.disconnect();
            window.removeEventListener("keydown", handleKey);
            resizeObserver.disconnect();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
            roomListUnsub();
            if (anchorsUnsub) anchorsUnsub();
            if (tagsUnsub) tagsUnsub();
            zonesUnsubscribe();
        };
    }, [gridMode, visualScaleFactor]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

            {/* NÚT GRID */}
            <div
                onClick={cycleGridMode}
                style={{
                    position: "absolute", bottom: "70px", left: "20px", background: "rgba(255,255,255,0.96)",
                    padding: "10px 16px", borderRadius: "10px", fontSize: "13.5px", fontWeight: "700",
                    color: "#222", boxShadow: "0 3px 12px rgba(0,0,0,0.18)", cursor: "pointer", zIndex: 30,
                    userSelect: "none", border: "2px solid #0066ff", minWidth: "130px", textAlign: "center",
                }}
            >
                Grid: <strong>{modes[gridMode - 1].name} ({currentGridSize}m)</strong>
                <div style={{ fontSize: "11px", color: "#555", marginTop: 4 }}>Click để chuyển</div>
            </div>

            {/* NÚT ZONE SCALE */}
            <div
                onClick={cycleVisualScale}
                style={{
                    position: "absolute", bottom: "130px", left: "20px", background: "rgba(255,255,255,0.96)",
                    padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "#333",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer", zIndex: 30, userSelect: "none",
                }}
            >
                Zone Scale: <strong>{visualScaleFactor.toFixed(1)}x</strong>
            </div>
        </div>
    );
}