import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    proxy: {
      // Proxy API requests
      "/api": {
        target: "https://liger-kind-tapir.ngrok-free.app",
        changeOrigin: true,
        secure: true,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      },
      // Proxy Socket.IO requests
      "/socket.io": {
        target: "https://liger-kind-tapir.ngrok-free.app",
        ws: true,
        changeOrigin: true,
        secure: true,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      },
    },
  },
});
