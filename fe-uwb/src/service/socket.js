import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

export const socket = io(SERVER_URL, {
    autoConnect: true,
    transports: ["websocket"],
});

socket.on("connect", () => {
    console.log("Socket.IO connected to server");
});

socket.on("disconnect", () => {
    console.log("Socket.IO disconnected from server");
});