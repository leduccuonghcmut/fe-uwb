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
    console.log(`Frontend connected: ${socket.id}`);

    // Gửi toàn bộ state ngay khi kết nối (tag + anchors)
    socket.emit("full-state-update", latestState);

    socket.on("disconnect", () => {
        console.log(`Frontend disconnected: ${socket.id}`);
    });
});

// HTTP push: nhận vị trí tag từ Python
app.get("/push", (req, res) => {
    const { x, y, z, ts } = req.query;

    if (x === undefined || y === undefined || z === undefined) {
        return res.status(400).send("Missing x, y, or z");
    }

    const tagData = {
        x: parseFloat(x),
        y: parseFloat(y), // Y = chiều cao
        z: parseFloat(z),
        timestamp: ts ? parseFloat(ts) : Date.now() / 1000,
    };

    latestState.tag = tagData;
    io.emit("full-state-update", latestState);

    console.log(`Tag → X=${tagData.x.toFixed(3)} Y=${tagData.y.toFixed(3)} Z=${tagData.z.toFixed(3)}`);

    res.sendStatus(200);
});

// Socket.IO: nhận anchors drift từ Python
io.on("connection", (socket) => {
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
                io.emit("full-state-update", latestState);
                console.log("Anchors drift updated →", latestState.anchors);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`   • /push → tag position`);
    console.log(`   • anchors-update → anchor drift`);
    console.log(`   • Clients nhận: full-state-update`);
});