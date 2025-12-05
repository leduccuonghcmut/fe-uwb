// src/service/init-firebase.js
// TẠO TOÀN BỘ CẤU TRÚC UWB + CONFIG CHO GIAO DIỆN MỚI

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBGT9Cpfhj551AB05Q-L94OCxL5ARDth_8",
    authDomain: "dauwb-58554.firebaseapp.com",
    databaseURL: "https://dauwb-58554-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dauwb-58554",
    storageBucket: "dauwb-58554.firebasestorage.app",
    messagingSenderId: "1014353557520",
    appId: "1:1014353557520:web:bbfe59f7fd418bf529f295"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==== DỮ LIỆU UWB 3D CŨ (GIỮ NGUYÊN) ====
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

// ==== ★ DỮ LIỆU CONFIG MỚI THÊM CHO TRANG SYSTEM CONFIG ★ ====
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

    forbidden: [
        "2.0 3.0 5.0"
    ],

    general: {
        energySaver: true,
        autoCalibration: false
    }
};

// PUSH LÊN FIREBASE
console.log("Đang tạo cấu trúc /uwb và /uwbConfig ...");

Promise.all([
    set(ref(db, "uwb"), uwbData),
    set(ref(db, "uwbConfig"), uwbConfig)
])
    .then(() => {
        console.log("\n THÀNH CÔNG! ĐÃ TẠO:");
        console.log("   /uwb              → phục vụ LiveTracking");
        console.log("   /uwbConfig        → phục vụ SystemConfig UI");
        console.log("\n Giờ bạn có thể chạy npm start và thấy dữ liệu load realtime.");
    })
    .catch((err) => console.error("Lỗi:", err));
