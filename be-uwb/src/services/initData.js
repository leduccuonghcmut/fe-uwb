// src/services/initData.js
// Chỉ chạy 1 lần để tạo dữ liệu mẫu (node src/services/initData.js)

const admin = require("../config/firebaseAdmin");
const db = admin.database(); // Realtime Database

const uwbData = {
    anchors: {
        A0: { x: 0, y: 0, z: 0 },
        A1: { x: 6, y: 0, z: 0 },
        A2: { x: 6, y: 0, z: 6 },
        A3: { x: 0, y: 0, z: 6 }
    },
    tag: {
        T0: { x: 3, y: 0.5, z: 3 }
    },
    base: {
        B0: { x: 3, y: 0, z: -2 }
    },
    box: {
        config: { x: 3, y: 1.5, z: 3, w: 2, h: 3, d: 4 }
    }
};

const uwbConfig = {
    devices: {
        "DD:4A:2E:AE:8E:B2": {
            coord: "2.0 3.0 7.0",
            type: "Anchor",
            status: "Online"
        },
        "U1": {
            coord: "2.0 3.0 7.0",
            type: "Tag",
            status: "Offline"
        },
        "D4:35:2F:6D:86:06": {
            coord: "2.0 3.0 7.0",
            type: "RTK Base",
            status: "Offline"
        }
    },
    forbidden: ["2.0 3.0 5.0"],
    general: {
        energySaver: true,
        autoCalibration: false
    }
};

async function init() {
    try {
        await db.ref("uwb").set(uwbData);
        await db.ref("uwbConfig").set(uwbConfig);
        console.log("THÀNH CÔNG! Đã tạo /uwb và /uwbConfig");
        process.exit(0);
    } catch (err) {
        console.error("Lỗi:", err);
        process.exit(1);
    }
}

init();