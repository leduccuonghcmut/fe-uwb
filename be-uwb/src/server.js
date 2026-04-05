// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Dev mode
        methods: ["GET", "POST"]
    }
});

// Trạng thái mới nhất – đúng trục: Y là chiều cao
let latestState = {
    tag: { x: 6.0, y: 1.6, z: 6.0, timestamp: Date.now() / 1000 },
    anchors: {
        A0: { x: 0.0,  y: 2.0, z: 0.0 },
        A1: { x: 12.0, y: 2.0, z: 0.0 },
        A2: { x: 0.0,  y: 2.0, z: 12.0 },
        A3: { x: 12.0, y: 2.0, z: 12.0 }
    }
};

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Gửi toàn bộ state ngay khi kết nối (tag + anchors)
    socket.emit("full-state-update", latestState);

    // =========================================================
    // 1. NHẬN VỊ TRÍ TAG TỪ PYTHON QUA SOCKET.IO (Tốc độ cao)
    // =========================================================
    socket.on("tag-update", (data) => {
        if (data && typeof data.x === "number" && typeof data.z === "number") {
            latestState.tag = {
                x: data.x,
                // Lấy Y từ Python, nếu không có thì set mặc định 1.6 làm chiều cao
                y: data.y !== undefined ? data.y : 1.6,
                z: data.z,
                timestamp: Date.now() / 1000
            };

            // Gửi thẳng cho Frontend React/Three.js
            io.emit("full-state-update", latestState);

            // Comment log để tối ưu tốc độ, tránh thắt cổ chai I/O khi chạy thực tế
            // console.log(`Tag → X=${latestState.tag.x.toFixed(3)} Y=${latestState.tag.y.toFixed(3)} Z=${latestState.tag.z.toFixed(3)}`);
        }
    });

    // =========================================================
    // 2. NHẬN ANCHORS DRIFT TỪ PYTHON QUA SOCKET.IO
    // =========================================================
    socket.on("anchors-update", (anchorsData) => {
        if (anchorsData && typeof anchorsData === "object") {
            let updated = false;
            ["A0", "A1", "A2", "A3"].forEach(key => {
                if (anchorsData[key] &&
                    typeof anchorsData[key].x === "number" &&
                    typeof anchorsData[key].y === "number" &&
                    typeof anchorsData[key].z === "number") {
                    latestState.anchors[key] = {
                        x: anchorsData[key].x,
                        y: anchorsData[key].y, // Y vẫn là chiều cao
                        z: anchorsData[key].z
                    };
                    updated = true;
                }
            });

            if (updated) {
                //io.emit("full-state-update", latestState);
                //console.log("Anchors drift updated →", latestState.anchors);
            }
        }
    });

    // Xử lý ngắt kết nối
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`   • Nhận Tag data    : Socket event "tag-update" (Siêu tốc)`);
    console.log(`   • Nhận Anchor data : Socket event "anchors-update"`);
    console.log(`   • Trả Frontend     : Socket event "full-state-update"`);
});