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

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);
        scene.fog = new THREE.FogExp2(0xf8f9fa, 0.015);

        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 2000);
        camera.position.set(6, 6, 12);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;

        const handleResize = () => {
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        };
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(mount);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        scene.add(new THREE.DirectionalLight(0xffffff, 0.8).position.set(10, 15, 10));

        const grid = new THREE.GridHelper(20, 40, 0xaaaaaa, 0xcccccc);
        grid.material.transparent = true;
        grid.material.opacity = 0.15;
        scene.add(grid);
        scene.add(new THREE.AxesHelper(3));

        // Materials
        const anchorMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0066ff, emissiveIntensity: 0.2 });
        const tagMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.7 });
        const anchorGeo = new THREE.SphereGeometry(0.22, 32, 32);
        const tagGeo = new THREE.SphereGeometry(0.28, 32, 32);

        // Anchors & Tag
        const anchors = { A0: new THREE.Mesh(anchorGeo, anchorMat), A1: new THREE.Mesh(anchorGeo, anchorMat), A2: new THREE.Mesh(anchorGeo, anchorMat), A3: new THREE.Mesh(anchorGeo, anchorMat) };
        Object.values(anchors).forEach(a => scene.add(a));
        const tag = new THREE.Mesh(tagGeo, tagMat);
        scene.add(tag);

        // Halo
        const haloTexture = new THREE.CanvasTexture(generateHaloTexture());
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: haloTexture, color: 0xff3b30, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        halo.scale.set(2.2, 2.2, 1);
        scene.add(halo);

        function generateHaloTexture() {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, "rgba(255,59,48,0.9)");
            gradient.addColorStop(0.4, "rgba(255,59,48,0.4)");
            gradient.addColorStop(1, "rgba(255,59,48,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
            return canvas;
        }

        // Lines
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.7 });
        const lines = {};
        Object.keys(anchors).forEach(id => {
            const geometry = new THREE.BufferGeometry();
            const line = new THREE.Line(geometry, lineMat);
            scene.add(line);
            lines[id] = line;
        });

        // Forbidden Zones Group
        const forbiddenGroup = new THREE.Group();
        scene.add(forbiddenGroup);

        const forbiddenMaterial = new THREE.MeshBasicMaterial({
            color: 0xefacac,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });

        // Render nhiều vùng cấm
        onValue(ref(rtdb, "uwb/forbidden/zones"), snap => {
            const data = snap.val();
            forbiddenGroup.clear();

            if (data) {
                Object.keys(data).forEach(key => {
                    const cfg = data[key];
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(cfg.w || 4, cfg.h || 3, cfg.d || 4),
                        forbiddenMaterial
                    );
                    mesh.position.set(cfg.x || 0, cfg.y || 0, cfg.z || 0);
                    forbiddenGroup.add(mesh);
                });
            }
        });

        // Labels
        const createLabel = (text, color) => {
            const canvas = document.createElement("canvas");
            canvas.width = 128; canvas.height = 48;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillRect(0, 0, 128, 48);
            ctx.strokeStyle = "#cccccc";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 128, 48);
            ctx.fillStyle = color;
            ctx.font = "bold 28px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 64, 24);
            const texture = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
            sprite.scale.set(1.5, 0.6, 1);
            return sprite;
        };

        const labels = {
            A0: createLabel("A0", "#0066ff"), A1: createLabel("A1", "#0066ff"),
            A2: createLabel("A2", "#0066ff"), A3: createLabel("A3", "#0066ff"),
            T0: createLabel("T0", "#ff3b30")
        };
        Object.values(labels).forEach(lb => scene.add(lb));

        // Firebase anchors & tag
        onValue(ref(rtdb, "uwb/anchors"), snap => {
            const data = snap.val();
            if (data) Object.keys(anchors).forEach(id => data[id] && anchors[id].position.set(data[id].x, data[id].y, data[id].z));
        });

        onValue(ref(rtdb, "uwb/tag/T0"), snap => {
            const d = snap.val();
            if (d) tag.position.set(d.x, d.y, d.z);
        });

        // Keyboard controls
        const showLabels = { current: true };
        let showForbidden = true; // mặc định bật vùng cấm

        const handleKey = (e) => {
            if (e.key.toLowerCase() === "l") {
                showLabels.current = !showLabels.current;
                Object.values(labels).forEach(lb => lb.visible = showLabels.current);
                Object.values(lines).forEach(ln => ln.visible = showLabels.current);
                halo.visible = showLabels.current;
            }
            if (e.key.toLowerCase() === "b") {
                showForbidden = !showForbidden;
                forbiddenGroup.visible = showForbidden;
            }
        };
        window.addEventListener("keydown", handleKey);

        // Animation loop
        const clock = new THREE.Clock();
        const loop = () => {
            requestAnimationFrame(loop);
            const elapsed = clock.getElapsedTime();
            controls.update();

            const pulse = 0.7 + Math.sin(elapsed * 3) * 0.25;
            tagMat.emissiveIntensity = pulse;
            halo.material.opacity = 0.5 + Math.sin(elapsed * 3) * 0.2;
            halo.position.copy(tag.position);

            Object.keys(lines).forEach(id => {
                const positions = new Float32Array([
                    tag.position.x, tag.position.y, tag.position.z,
                    anchors[id].position.x, anchors[id].position.y, anchors[id].position.z
                ]);
                lines[id].geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            });

            Object.keys(anchors).forEach(id => {
                labels[id].position.copy(anchors[id].position).add(new THREE.Vector3(0, 0.6, 0));
                labels[id].lookAt(camera.position);
            });
            labels.T0.position.copy(tag.position).add(new THREE.Vector3(0, 0.6, 0));
            labels.T0.lookAt(camera.position);

            renderer.render(scene, camera);
        };
        loop();

        return () => {
            window.removeEventListener("keydown", handleKey);
            resizeObserver.disconnect();
            mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}