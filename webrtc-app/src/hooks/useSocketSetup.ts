import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import { getSocketURL } from "../Service/api";
import { SOCKET_CONFIG } from "../constants/webrtc";

export const useSocketSetup = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");

  useEffect(() => {
    const newSocket = io(getSocketURL(), SOCKET_CONFIG);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      setConnectionStatus("Connected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionStatus(`Error: ${error.message}`);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setConnectionStatus(`Disconnected: ${reason}`);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return {
    socketRef,
    connectionStatus,
  };
};
