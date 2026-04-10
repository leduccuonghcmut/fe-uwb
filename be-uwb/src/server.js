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

// =========================================================
// HTTP ROUTE — fix "Cannot GET /"
// =========================================================
app.get("/", (req, res) => {
    res.send(`
        <h2>UWB Backend Server</h2>
        <p>Socket.IO running on port 3000</p>
        <ul>
            <li><b>tag-update</b>: nhận vị trí TAG từ Python</li>
            <li><b>anchors-update</b>: nhận drift anchor từ Python</li>
            <li><b>ble-scan-result</b>: nhận danh sách BLE từ Raspberry Pi</li>
            <li><b>anchor-select</b>: FE chọn slot anchor (1-4)</li>
            <li><b>full-state-update</b>: broadcast tới FE</li>
        </ul>
    `);
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

// Cache danh sách BLE mới nhất từ Raspberry Pi
let latestBleList = [];

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Gửi toàn bộ state ngay khi kết nối (tag + anchors)
    socket.emit("full-state-update", latestState);

    // Gửi BLE list hiện tại ngay khi client kết nối
    socket.emit("ble-scan-result", latestBleList);

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
                        y: anchorsData[key].y,
                        z: anchorsData[key].z
                    };
                    updated = true;
                }
            });

            if (updated) {
                //io.emit("full-state-update", latestState);
            }
        }
    });

    // =========================================================
    // 3. NHẬN KẾT QUẢ QUÉT BLE TỪ RASPBERRY PI
    //    Python gửi: [{ name, address, rssi }, ...]
    // =========================================================
    socket.on("ble-scan-result", (deviceList) => {
        if (Array.isArray(deviceList)) {
            latestBleList = deviceList;
            // Broadcast danh sách BLE cho tất cả FE clients
            io.emit("ble-scan-result", latestBleList);
            console.log(`[BLE] Received ${deviceList.length} devices from Raspberry Pi`);
        }
    });

    // =========================================================
    // 4. FE CHỌN SLOT ANCHOR (1-4) → RELAY XUỐNG PYTHON
    //    FE gửi: { slot: 1 }  (slot 1 đến 4)
    // =========================================================
    socket.on("anchor-select", (data) => {
        if (data && typeof data.slot === "number" && data.slot >= 1 && data.slot <= 4) {
            console.log(`[SLOT] Web selected slot: ${data.slot}`);
            // Broadcast cho tất cả client (kể cả Python đang lắng nghe)
            io.emit("anchor-select", { slot: data.slot });
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
    console.log(`   • Nhận Tag data       : Socket event "tag-update"`);
    console.log(`   • Nhận Anchor data    : Socket event "anchors-update"`);
    console.log(`   • Nhận BLE scan       : Socket event "ble-scan-result"`);
    console.log(`   • Nhận slot select    : Socket event "anchor-select"`);
    console.log(`   • Trả Frontend        : Socket event "full-state-update"`);
});