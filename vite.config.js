import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gasUrl = env.VITE_GAS_URL || "";
  const gasPath = gasUrl ? gasUrl.replace("https://script.google.com", "") : "";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/kickoff-api": {
          target: "https://script.google.com",
          changeOrigin: true,
          secure: true,
          rewrite: () => gasPath,
        },
        "/api/travefy-send": {
          target: "http://localhost:3001",
          changeOrigin: true,
          rewrite: () => "/api/travefy/send",
        },
      },
    },
  };
});
