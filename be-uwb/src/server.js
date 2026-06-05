// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

// =========================================================
// 1. KHỞI TẠO FIREBASE ADMIN
// =========================================================
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // ⚠️ LƯU Ý: Đảm bảo URL này phải khớp 100% với Firebase Console của bạn
    databaseURL: "https://dauwb-58554-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = admin.database();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// Hiển thị trạng thái kết nối Database để dễ debug
db.ref(".info/connected").on("value", (snap) => {
    if (snap.val() === true) {
        console.log("✅ [FIREBASE] ĐÃ KẾT NỐI THÀNH CÔNG ĐẾN DATABASE!");
    }
});

let latestState = {
    tag: { id: 1, x: 0.0, y: 0.0, z: 0.0, timestamp: Date.now() / 1000 },
    anchors: {
        A0: { x: 0.0, y: 2.0, z: 0.0 }, A1: { x: 12.0, y: 2.0, z: 0.0 },
        A2: { x: 0.0, y: 2.0, z: 12.0 }, A3: { x: 12.0, y: 2.0, z: 12.0 }
    }
};

// Bộ nhớ đệm chống Spam từ Pi (chỉ ghi DB 3 giây 1 lần cho mỗi MAC)
let deviceCache = {};

io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    socket.emit("full-state-update", latestState);

    // =========================================================
    // 2. NHẬN LỆNH TỪ PI -> LỌC SPAM -> LƯU VÀO DATABASE
    // =========================================================
    socket.on("new-device", (data) => {
        if (!data || !data.mac) return;

        const now = Date.now();
        // CHỐNG SPAM: Nếu MAC này vừa được ghi trong vòng 3 giây trước, bỏ qua lệnh này
        if (deviceCache[data.mac] && (now - deviceCache[data.mac]) < 3000) {
            return;
        }
        deviceCache[data.mac] = now; // Cập nhật thời gian ghi gần nhất

        console.log(`[SOCKET] Nhan thiet bi PENDING: MAC=${data.mac} -> Dang luu vao DB...`);

        const deviceRef = db.ref(`uwb/devices/${data.mac}`);

        // Dùng .update() để ghi đè hoặc tạo mới mà không bị chặn tiến trình
        deviceRef.update({
            status: "online",
            type: "Pending", // Mặc định là thiết bị chờ cấp quyền
            role: data.role !== undefined ? data.role : 0,
            node_id: data.id !== undefined ? data.id : 0,
            last_seen: now,
            config_trigger: now // Tạo trigger mặc định
        }).then(() => {
            console.log(`[FIREBASE] 💾 Đã lưu thành công thiết bị MAC: ${data.mac}`);
        }).catch((err) => {
            console.error(`[FIREBASE] ❌ Lỗi khi ghi MAC ${data.mac}:`, err);
        });
    });

    // Tracking siêu tốc (Tag & Anchor)
    socket.on("tag-update", (data) => {
        if (data && typeof data.x === "number" && typeof data.y === "number") {
            latestState.tag = {
                id: data.id !== undefined ? data.id : 1, // Lấy ID của tag để web nhận diện
                x: data.x,
                y: data.y,
                z: data.z || 0,
                timestamp: Date.now() / 1000
            };
            io.emit("full-state-update", latestState);
        }
    });

    socket.on("anchors-update", (anchorsData) => {
        if (anchorsData) {
            ["A0", "A1", "A2", "A3"].forEach(key => {
                if (anchorsData[key] && typeof anchorsData[key].x === "number") {
                    latestState.anchors[key] = { x: anchorsData[key].x, y: anchorsData[key].y, z: anchorsData[key].z };
                }
            });
        }
    });

    // =========================================================
    // 3. NHẬN LỆNH TỪ WEB VÀ CHUYỂN TIẾP (RELAY) CHO PI / PYTHON
    // =========================================================

    // Relay tọa độ Anchor
    socket.on("update_anchor", (data) => {
        console.log(`[SOCKET -> PI] Web vua sua toa do Anchor:`, data);
        socket.broadcast.emit("update_anchor", data);
    });

    // Relay Vùng cấm
    socket.on("update_zones", (data) => {
        console.log(`[SOCKET -> PI] Web cap nhat ${data ? data.length : 0} vung cam.`);
        socket.broadcast.emit("update_zones", data);
    });

    // Relay kéo thả Tag mô phỏng
    socket.on("sim_tag_update", (data) => {
        console.log(`[SOCKET -> PI] Web mo phong keo tha Tag:`, data);
        socket.broadcast.emit("sim_tag_update", data);
    });

    // --- [MỚI] RELAY LUỒNG AI ---
    // Relay câu hỏi từ Web chuyển xuống Python Gateway
    socket.on("ask_ai_question", (data) => {
        console.log(`[SOCKET -> PYTHON AI] Web hoi: ${data.question}`);
        socket.broadcast.emit("ask_ai_question", data);
    });

    // Relay câu trả lời từ Python Gateway đẩy ngược lên Web
    socket.on("ai_chat_response", (data) => {
        console.log(`[PYTHON AI -> SOCKET] AI tra loi xong.`);
        socket.broadcast.emit("ai_chat_response", data);
    });

    // Relay bản đồ nhiệt tương lai (nếu sau này Web muốn vẽ Heatmap)
    socket.on("ai-heatmap-update", (data) => {
        socket.broadcast.emit("ai-heatmap-update", data);
    });

    socket.on("disconnect", () => console.log(`[SOCKET] Client disconnected: ${socket.id}`));
});

// =========================================================
// 4. LẮNG NGHE FIREBASE ĐỔI ROLE -> BẮN LỆNH XUỐNG PYTHON
// =========================================================
let lastTriggers = {};

db.ref("uwb/devices").on("child_changed", (snapshot) => {
    const deviceData = snapshot.val();
    const mac = snapshot.key;

    if (deviceData.config_trigger && deviceData.config_trigger !== lastTriggers[mac]) {
        if (Math.abs(deviceData.config_trigger - deviceData.last_seen) > 1000) {
            lastTriggers[mac] = deviceData.config_trigger;
            console.log(`[FIREBASE -> PI] 🚀 Phat lenh cau hinh cho MAC ${mac} -> Role: ${deviceData.role}, ID: ${deviceData.node_id}`);

            io.emit("set-device-role", {
                mac: mac,
                role: deviceData.role,
                id: deviceData.node_id
            });
        }
    }
});

// Lệnh Auto Calibration
let lastCalibTime = 0;
db.ref("uwb/commands/calibrate").on("value", (snapshot) => {
    const calibData = snapshot.val();
    if (calibData && calibData.timestamp && calibData.timestamp !== lastCalibTime) {
        lastCalibTime = calibData.timestamp;
        console.log(`[FIREBASE -> PI] 🔧 Phat lenh AUTO CALIB (Role: ${calibData.role}, ID: ${calibData.id})`);

        io.emit("set-device-role", {
            mac: calibData.mac || "FFFF",
            role: calibData.role,
            id: calibData.id
        });
    }
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`BỘ LỌC CHỐNG SPAM: ĐÃ BẬT (3 giây/lệnh)`);
});