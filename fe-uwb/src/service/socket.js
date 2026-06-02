// D:/TN/web/fe-uwb/src/service/socket.js
import { io } from "socket.io-client";

// Trỏ về địa chỉ NodeJS Server của bạn
const SERVER_URL = "http://localhost:3000";

export const socket = io(SERVER_URL, {
    autoConnect: true,
    transports: ["websocket"],
});

socket.on("connect", () => {
    console.log("🟢 [WEB] Đã kết nối Socket.IO tới Server thành công!");
});

socket.on("disconnect", () => {
    console.log("🔴 [WEB] Mất kết nối Socket.IO tới Server.");
});