// src/pages/LiveTracking/ThreeScene.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../../service/firebase";

export default function ThreeScene() {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // === SCENE SETUP ===
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        const camera = new THREE.PerspectiveCamera(
            60,
            mount.clientWidth / mount.clientHeight,
            0.1,
            2000
        );
        camera.position.set(6, 6, 12);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;

        // ⭐ QUAN TRỌNG: TỰ RESIZE THEO KHUNG (khi thu nhỏ sidebar)
        function handleResize() {
            if (!mount) return;
            const width = mount.clientWidth;
            const height = mount.clientHeight;
            if (!width || !height) return;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }

        // Gọi 1 lần cho chắc
        handleResize();

        let resizeObserver;
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                handleResize();
            });
            resizeObserver.observe(mount);
        } else {
            window.addEventListener("resize", handleResize);
        }

        // === LIGHT ===
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(10, 10, 10);
        scene.add(dl);

        // === GRID ===
        const grid = new THREE.GridHelper(20, 40);
        grid.material.transparent = true;
        grid.material.opacity = 0.18;
        scene.add(grid);
        scene.add(new THREE.AxesHelper(3));

        // === MATERIALS ===
        const anchorMat = new THREE.MeshStandardMaterial({ color: 0x0004fc });
        const tagMat = new THREE.MeshStandardMaterial({
            color: 0xff5500,
            emissive: 0xff5500,
            emissiveIntensity: 0.3,
        });
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.3,
        });

        const anchorGeo = new THREE.SphereGeometry(0.22, 32, 32);
        const tagGeo = new THREE.SphereGeometry(0.26, 32, 32);
        const baseGeo = new THREE.SphereGeometry(0.26, 32, 32);

        // === CREATE OBJECTS ===
        const anchors = {
            A0: new THREE.Mesh(anchorGeo, anchorMat),
            A1: new THREE.Mesh(anchorGeo, anchorMat),
            A2: new THREE.Mesh(anchorGeo, anchorMat),
            A3: new THREE.Mesh(anchorGeo, anchorMat),
        };
        Object.values(anchors).forEach((a) => scene.add(a));

        const tag = new THREE.Mesh(tagGeo, tagMat);
        const base = new THREE.Mesh(baseGeo, baseMat);
        scene.add(tag, base);

        // === LINES ===
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xff8c42,
            transparent: true,
            opacity: 0.7,
        });
        const lines = {};
        Object.keys(anchors).forEach((id) => {
            const geo = new THREE.BufferGeometry();
            const ln = new THREE.Line(geo, lineMat);
            scene.add(ln);
            lines[id] = ln;
        });

        // === BOX ===
        const boxGroup = new THREE.Group();
        let showBox = true;
        scene.add(boxGroup);

        // === LABELS ===
        function createLabel(text, color) {
            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 48;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillRect(0, 0, 128, 48);
            ctx.strokeStyle = "#ddd";
            ctx.strokeRect(0, 0, 128, 48);
            ctx.fillStyle = color;
            ctx.font = "bold 26px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 64, 24);
            const tex = new THREE.CanvasTexture(canvas);
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
            sp.scale.set(1.4, 0.55, 1);
            return sp;
        }

        const labels = {
            A0: createLabel("A0", "#0004FC"),
            A1: createLabel("A1", "#0004FC"),
            A2: createLabel("A2", "#0004FC"),
            A3: createLabel("A3", "#0004FC"),
            T0: createLabel("T0", "#d43f00"),
            B0: createLabel("B0", "#b45309"),
        };
        Object.values(labels).forEach((lb) => scene.add(lb));

        // === FIREBASE REALTIME ===
        onValue(ref(rtdb, "uwb/anchors"), (snap) => {
            const data = snap.val();
            if (!data) return;
            Object.keys(anchors).forEach((id) => {
                if (data[id]) {
                    anchors[id].position.set(
                        data[id].x,
                        data[id].y,
                        data[id].z
                    );
                }
            });
        });

        onValue(ref(rtdb, "uwb/tag/T0"), (snap) => {
            const d = snap.val();
            if (!d) return;
            tag.position.set(d.x, d.y, d.z);
        });

        onValue(ref(rtdb, "uwb/base/B0"), (snap) => {
            const d = snap.val();
            if (!d) return;
            base.position.set(d.x, d.y, d.z);
        });

        onValue(ref(rtdb, "uwb/box/config"), (snap) => {
            const cfg = snap.val();
            if (!cfg) return;
            boxGroup.clear();
            const boxMesh = new THREE.Mesh(
                new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
                new THREE.MeshBasicMaterial({
                    color: 0xff4d4d,
                    transparent: true,
                    opacity: 0.25,
                })
            );
            boxMesh.position.set(cfg.x, cfg.y, cfg.z);
            boxGroup.add(boxMesh);
        });

        // === KEYBOARD: L = nhãn + đường, B = hộp ===
        const showLabels = { current: true };
        const handleKey = (e) => {
            if (e.key.toLowerCase() === "l") {
                showLabels.current = !showLabels.current;
                Object.values(labels).forEach(
                    (lb) => (lb.visible = showLabels.current)
                );
                Object.values(lines).forEach(
                    (ln) => (ln.visible = showLabels.current)
                );
            }
            if (e.key.toLowerCase() === "b") {
                showBox = !showBox;
                boxGroup.visible = showBox;
            }
        };
        window.addEventListener("keydown", handleKey);

        // === ANIMATE ===
        function loop() {
            requestAnimationFrame(loop);
            controls.update();

            // Update labels
            Object.keys(anchors).forEach((id) => {
                labels[id].position
                    .copy(anchors[id].position)
                    .add({ x: 0, y: 0.6, z: 0 });
                labels[id].lookAt(camera.position);
            });
            labels.T0.position
                .copy(tag.position)
                .add({ x: 0, y: 0.6, z: 0 });
            labels.T0.lookAt(camera.position);
            labels.B0.position
                .copy(base.position)
                .add({ x: 0, y: 0.8, z: 0 });
            labels.B0.lookAt(camera.position);

            // Update lines
            Object.keys(lines).forEach((id) => {
                const pos = new Float32Array([
                    tag.position.x,
                    tag.position.y,
                    tag.position.z,
                    anchors[id].position.x,
                    anchors[id].position.y,
                    anchors[id].position.z,
                ]);
                lines[id].geometry.setAttribute(
                    "position",
                    new THREE.BufferAttribute(pos, 3)
                );
            });

            renderer.render(scene, camera);
        }
        loop();

        // Cleanup
        return () => {
            window.removeEventListener("keydown", handleKey);
            if (resizeObserver) {
                resizeObserver.disconnect();
            } else {
                window.removeEventListener("resize", handleResize);
            }
            mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
