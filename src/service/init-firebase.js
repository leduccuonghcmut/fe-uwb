// src/service/init-firebase.js
// CHẠY 1 LẦN ĐỂ TẠO CẤU TRÚC uwb/... TRÊN FIREBASE

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// CẤU HÌNH CỦA BẠN
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

// DỮ LIỆU DEMO
const demoData = {
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
        config: {
            x: 3,
            y: 1.5,
            z: 3,
            w: 2,
            h: 3,
            d: 4
        }
    }
};

// GHI VÀO ĐÚNG ĐƯỜNG DẪN: /uwb
console.log("Đang tạo dữ liệu tại /uwb ...");

set(ref(db, "uwb"), demoData)
    .then(() => {
        console.log("THÀNH CÔNG!");
        console.log("Đã tạo đầy đủ key:");
        console.log("   /uwb/anchors/A0 → A3");
        console.log("   /uwb/tag/T0");
        console.log("   /uwb/base/B0");
        console.log("   /uwb/box/config\n");
        console.log("BÂY GIỜ:");
        console.log("   → Chạy: npm start");
        console.log("   → Vào: https://console.firebase.google.com/project/dauwb-58554/database");
        console.log("   → Sửa x, y, z → 3D cập nhật realtime!");
    })
    .catch((error) => {
        console.error("LỖI:", error.message);
        console.error("\nKIỂM TRA:");
        console.error("   1. Đã chạy: npm install firebase");
        console.error("   2. Internet ổn định?");
        console.error("   3. File này dùng import → project có \"type\": \"module\"");
    });