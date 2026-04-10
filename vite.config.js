import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const GAS_PATH =
  "/macros/s/AKfycbyS-in9MQit54ZVujzwkKBwppWpr3d4FZx0LrR9jg2Z4p7FJ80y3au9rzcbEOVmLjHy/exec";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/kickoff-api": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => GAS_PATH,
      },
      // Local dev: proxy /api/travefy-send → Express server (node server.js)
      "/api/travefy-send": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: () => "/api/travefy/send",
      },
    },
  },
});
