import { db } from "./firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

const DEVICE_COLLECTION = "devices";

/**
 * Fetch all devices from Firestore
 * @returns {Promise<Array>} Array of device objects
 */
export async function fetchDevices() {
    try {
        const snap = await getDocs(collection(db, DEVICE_COLLECTION));
        return snap.docs.map((d) => ({
            id: d.id,
            mac: d.data().mac ?? d.id,
            coord: d.data().coord ?? "",
            type: d.data().type ?? "",
            status: d.data().status ?? "Offline",
        }));
    } catch (e) {
        console.error("Fetch devices error:", e);
        return [];
    }
}

/**
 * Update device properties in Firestore
 * @param {string} docId - Device document ID
 * @param {Object} data - Data to update { type, coord, status... }
 */
export async function updateDevice(docId, data) {
    const ref = doc(db, DEVICE_COLLECTION, docId);
    await updateDoc(ref, data);
}

