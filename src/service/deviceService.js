import { db } from "./firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

const DEVICE_COLLECTION = "devices";

// Lấy danh sách thiết bị
export async function fetchDevices() {
    try {
        const snap = await getDocs(collection(db, DEVICE_COLLECTION));
        return snap.docs.map((d) => ({
            id: d.id,
            mac: d.data().mac ?? d.id,   // fallback an toàn
            coord: d.data().coord ?? "",
            type: d.data().type ?? "",
            status: d.data().status ?? "Offline",
        }));
    } catch (e) {
        console.error("FETCH ERROR:", e);
        return []; // tránh crash
    }
}


// Cập nhật type hoặc coord của thiết bị
export async function updateDevice(docId, data) {
    const ref = doc(db, DEVICE_COLLECTION, docId);
    await updateDoc(ref, data);
}

