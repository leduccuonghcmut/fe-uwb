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

    // === 3 CHẾ ĐỘ GRID ===
    const [gridMode, setGridMode] = useState(2); // 1=Small, 2=Medium, 3=Large
    const modes = [
        { name: "Small", size: 10 },
        { name: "Medium", size: 20 },
        { name: "Large", size: 40 },
    ];

    const cycleGridMode = () => {
        setGridMode((prev) => (prev % 3) + 1);
    };

    const currentGridSize = modes[gridMode - 1].size;

    // Visual Scale cho Forbidden Zones
    const [visualScaleFactor, setVisualScaleFactor] = useState(1.8);
    const scaleOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

    const cycleVisualScale = () => {
        const idx = scaleOptions.indexOf(visualScaleFactor);
        setVisualScaleFactor(scaleOptions[(idx + 1) % scaleOptions.length]);
    };

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Socket.IO
        let socket;
        try {
            socket = io("http://localhost:3000", {
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
            });
            socketRef.current = socket;
        } catch (err) {
            console.error("Socket.IO init failed:", err);
        }

        // THREE.JS
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);
        scene.fog = new THREE.FogExp2(0xf8f9fa, 0.012);

        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 2000);
        camera.position.set(8, 8, 15);

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

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(12, 18, 12);
        scene.add(dirLight);

        // Grid
        const grid = new THREE.GridHelper(currentGridSize, currentGridSize * 4, 0x888888, 0xcccccc);
        grid.material.transparent = true;
        grid.material.opacity = 0.25;
        scene.add(grid);
        scene.add(new THREE.AxesHelper(3));

        // === SCALE CHUNG ===
        const gridScale = currentGridSize / 20;   // Medium = 1.0

        // Anchor (cầu xanh)
        const anchorRadius = Math.max(0.12, Math.min(0.38, 0.22 * gridScale));
        const anchorMat = new THREE.MeshStandardMaterial({
            color: 0x0066ff,
            emissive: 0x0066ff,
            emissiveIntensity: 0.25
        });
        const anchorGeo = new THREE.SphereGeometry(anchorRadius, 32, 32);

        const spread = currentGridSize * 0.8;

        const anchors = {
            A0: new THREE.Mesh(anchorGeo, anchorMat),
            A1: new THREE.Mesh(anchorGeo, anchorMat),
            A2: new THREE.Mesh(anchorGeo, anchorMat),
            A3: new THREE.Mesh(anchorGeo, anchorMat),
        };
        Object.values(anchors).forEach(a => scene.add(a));

        anchors.A0.position.set(0, 2, 0);
        anchors.A1.position.set(spread, 2, 0);
        anchors.A2.position.set(0, 2, spread);
        anchors.A3.position.set(spread, 2, spread);

        // === TAG (quả cầu cam) – ĐÃ THAY ĐỔI KÍCH THƯỚC THEO GRID ===
        const tagRadius = Math.max(0.18, Math.min(0.45, 0.28 * gridScale));   // scale cùng tỷ lệ
        const tagMat = new THREE.MeshStandardMaterial({
            color: 0xff3b30,
            emissive: 0xff3b30,
            emissiveIntensity: 0.75
        });
        const tagGeo = new THREE.SphereGeometry(tagRadius, 32, 32);
        const tag = new THREE.Mesh(tagGeo, tagMat);
        scene.add(tag);
        tag.position.set(spread / 2, 1.6, spread / 2);

        // === HALO (VIỀN XUNG QUANH TAG) – ĐÃ LÀM ĐẬM & NỔI HƠN ===
        const haloTexture = new THREE.CanvasTexture(generateHaloTexture());
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: haloTexture,
            color: 0xff3b30,
            transparent: true,
            opacity: 0.75,                    // tăng độ đậm
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        halo.scale.set(2.8 * gridScale, 2.8 * gridScale, 1);   // to hơn theo grid + scale
        scene.add(halo);

        function generateHaloTexture() {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 256;   // tăng độ phân giải
            const ctx = canvas.getContext("2d");
            const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            gradient.addColorStop(0,   "rgba(255,59,48,1.0)");
            gradient.addColorStop(0.3, "rgba(255,59,48,0.7)");
            gradient.addColorStop(0.6, "rgba(255,59,48,0.25)");
            gradient.addColorStop(1,   "rgba(255,59,48,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);
            return canvas;
        }

        // Lines
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.75 });
        const lines = {};
        Object.keys(anchors).forEach(id => {
            const geometry = new THREE.BufferGeometry();
            const line = new THREE.Line(geometry, lineMat);
            scene.add(line);
            lines[id] = line;
        });

        // Forbidden Zones (giữ nguyên)
        const forbiddenGroup = new THREE.Group();
        scene.add(forbiddenGroup);

        const forbiddenMaterial = new THREE.MeshPhongMaterial({
            color: 0xefacac, transparent: true, opacity: 0.35, depthWrite: false, shininess: 5,
        });
        const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xd32f2f, transparent: true, opacity: 0.9 });

        let zonesUnsubscribe = null;

        const updateForbiddenZones = (data) => {
            forbiddenGroup.clear();
            if (!data) return;
            Object.keys(data).forEach(key => {
                const cfg = data[key];
                const realW = Math.max(0.5, cfg.w || 4);
                const realH = Math.max(0.5, cfg.h || 3);
                const realD = Math.max(0.5, cfg.d || 4);

                const maxReal = Math.max(realW, realH, realD);
                let auto = (maxReal < 2) ? 2.0 : (maxReal < 4) ? 1.4 : (maxReal > 10) ? 0.75 : 0.9;

                const finalScale = auto * visualScaleFactor;
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(realW * finalScale, realH * finalScale, realD * finalScale),
                    forbiddenMaterial
                );
                mesh.position.set(cfg.x || 0, cfg.y || 0, cfg.z || 0);

                const edges = new THREE.EdgesGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
                wireframe.position.copy(mesh.position);

                forbiddenGroup.add(mesh);
                forbiddenGroup.add(wireframe);
            });
        };

        zonesUnsubscribe = onValue(ref(rtdb, "uwb/forbidden/zones"), (snap) => {
            updateForbiddenZones(snap.val());
        });

        // Labels
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

        const labels = {
            A0: createLabel("A0", "#0066ff"),
            A1: createLabel("A1", "#0066ff"),
            A2: createLabel("A2", "#0066ff"),
            A3: createLabel("A3", "#0066ff"),
            T0: createLabel("T0", "#ff3b30")
        };
        Object.values(labels).forEach(lb => scene.add(lb));

        // Socket update
        if (socket) {
            socket.on("full-state-update", (state) => {
                if (!state) return;
                if (state.tag?.x !== undefined) {
                    tag.position.set(state.tag.x, state.tag.y, state.tag.z ?? 0);
                }
                if (state.anchors) {
                    Object.keys(anchors).forEach(id => {
                        const a = state.anchors[id];
                        if (a) anchors[id].position.set(a.x ?? 0, a.y ?? 2, a.z ?? 0);
                    });
                }
                window.dispatchEvent(new CustomEvent("tag-position-update", {
                    detail: { x: tag.position.x, y: tag.position.y, z: tag.position.z }
                }));
            });
        }

        // Keyboard
        const showLabelsState = { current: true };
        let showForbidden = true;
        const handleKey = (e) => {
            if (e.key.toLowerCase() === "l") {
                showLabelsState.current = !showLabelsState.current;
                Object.values(labels).forEach(lb => lb.visible = showLabelsState.current);
                Object.values(lines).forEach(ln => ln.visible = showLabelsState.current);
                halo.visible = showLabelsState.current;
            }
            if (e.key.toLowerCase() === "b") {
                showForbidden = !showForbidden;
                forbiddenGroup.visible = showForbidden;
            }
        };
        window.addEventListener("keydown", handleKey);

        // Animation
        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();

            const elapsed = clock.getElapsedTime();
            tagMat.emissiveIntensity = 0.75 + Math.sin(elapsed * 3.5) * 0.3;
            halo.material.opacity = 0.75 + Math.sin(elapsed * 3) * 0.15;
            halo.position.copy(tag.position);

            Object.keys(lines).forEach(id => {
                const positions = new Float32Array([
                    tag.position.x, tag.position.y, tag.position.z,
                    anchors[id].position.x, anchors[id].position.y, anchors[id].position.z
                ]);
                lines[id].geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                lines[id].geometry.attributes.position.needsUpdate = true;
            });

            Object.keys(anchors).forEach(id => {
                labels[id].position.copy(anchors[id].position).add(new THREE.Vector3(0, anchorRadius + 0.5, 0));
                labels[id].lookAt(camera.position);
            });
            labels.T0.position.copy(tag.position).add(new THREE.Vector3(0, tagRadius + 0.6, 0));
            labels.T0.lookAt(camera.position);

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (socket) socket.disconnect();
            window.removeEventListener("keydown", handleKey);
            resizeObserver.disconnect();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
            if (zonesUnsubscribe) zonesUnsubscribe();
        };
    }, [gridMode, visualScaleFactor]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

            {/* NÚT GRID */}
            <div
                onClick={cycleGridMode}
                style={{
                    position: "absolute",
                    bottom: "70px",
                    left: "20px",
                    background: "rgba(255,255,255,0.96)",
                    padding: "10px 16px",
                    borderRadius: "10px",
                    fontSize: "13.5px",
                    fontWeight: "700",
                    color: "#222",
                    boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
                    cursor: "pointer",
                    zIndex: 30,
                    userSelect: "none",
                    border: "2px solid #0066ff",
                    minWidth: "130px",
                    textAlign: "center",
                }}
            >
                Grid: <strong>{modes[gridMode - 1].name} ({currentGridSize}m)</strong>
                <div style={{ fontSize: "11px", color: "#555", marginTop: 4 }}>
                    Click để chuyển
                </div>
            </div>

            {/* NÚT ZONE SCALE */}
            <div
                onClick={cycleVisualScale}
                style={{
                    position: "absolute",
                    bottom: "130px",
                    left: "20px",
                    background: "rgba(255,255,255,0.96)",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#333",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    cursor: "pointer",
                    zIndex: 30,
                    userSelect: "none",
                }}
            >
                Zone Scale: <strong>{visualScaleFactor.toFixed(1)}x</strong>
            </div>
        </div>
    );
}