// src/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const deviceRoutes = require("./routes/deviceRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Dev: sau thay bằng domain FE
});

app.use(cors());
app.use(express.json());

// Routes REST API
app.use("/api", deviceRoutes);

// === PHẦN SOCKET.IO CŨ GIỮ NGUYÊN (cho LiveTracking) ===
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
    socket.emit("full-state-update", latestState);

    socket.on("anchors-update", (anchorsData) => {
        // ... (giữ nguyên logic cũ của bạn)
        if (anchorsData && typeof anchorsData === "object") {
            let updated = false;
            ["A0", "A1", "A2", "A3"].forEach(key => {
                if (anchorsData[key]) {
                    latestState.anchors[key] = {
                        x: anchorsData[key].x,
                        y: anchorsData[key].y,
                        z: anchorsData[key].z
                    };
                    updated = true;
                }
            });
            if (updated) io.emit("full-state-update", latestState);
        }
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// HTTP push từ Python
app.get("/push", (req, res) => {
    const { x, y, z, ts } = req.query;
    if (x === undefined || y === undefined || z === undefined) {
        return res.status(400).send("Missing params");
    }

    latestState.tag = {
        x: parseFloat(x),
        y: parseFloat(y),
        z: parseFloat(z),
        timestamp: ts ? parseFloat(ts) : Date.now() / 1000,
    };

    io.emit("full-state-update", latestState);
    console.log(`Tag updated: ${x}, ${y}, ${z}`);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`BE running on http://localhost:${PORT}`);
    console.log(`   • REST API: /api/devices`);
    console.log(`   • Socket.IO: realtime tracking`);
    console.log(`   • /push: from Python`);
});