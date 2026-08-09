import { io } from "socket.io-client";

// Aapka Render Par Live Backend URL
export const BACKEND_URL = "https://hayaty-backend.onrender.com";

export const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
});
