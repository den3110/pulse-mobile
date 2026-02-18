import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

let socket: Socket | null = null;

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.8:5012/api"
).replace("/api", "");

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem("accessToken");

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Disconnected");
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
