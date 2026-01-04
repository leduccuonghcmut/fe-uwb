// src/services/deviceService.js
const admin = require("../config/firebaseAdmin");
const db = admin.firestore();

const DEVICE_COLLECTION = "devices";

// Lấy danh sách thiết bị
exports.fetchDevices = async () => {
    try {
        const snap = await db.collection(DEVICE_COLLECTION).get();
        return snap.docs.map((d) => ({
            id: d.id,
            mac: d.data().mac ?? d.id,
            coord: d.data().coord ?? "",
            type: d.data().type ?? "",
            status: d.data().status ?? "Offline",
        }));
    } catch (e) {
        console.error("FETCH ERROR:", e);
        throw e;
    }
};

// Cập nhật thiết bị
exports.updateDevice = async (docId, data) => {
    try {
        const ref = db.collection(DEVICE_COLLECTION).doc(docId);
        await ref.update(data);
    } catch (e) {
        console.error("UPDATE ERROR:", e);
        throw e;
    }
};