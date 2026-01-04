// src/config/firebaseAdmin.js
const admin = require("firebase-admin");

// Tải service account key (đặt file này ở root BE)
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://dauwb-58554-default-rtdb.asia-southeast1.firebasedatabase.app"
});

module.exports = admin;