import axios from "axios";
import { auth } from "./firebase"; // giữ file firebase.js để auth

const API_BASE = "http://localhost:3000/api"; // sau deploy thay domain

const api = axios.create({
    baseURL: API_BASE,
});

// Interceptor tự động gắn token
api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const fetchDevices = () => api.get("/devices");
export const updateDevice = (docId, data) => api.patch(`/devices/${docId}`, data);