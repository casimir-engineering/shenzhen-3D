import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./scripts/offline-plugin";
export default defineConfig({
  plugins: [react(), offlinePlugin()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  worker: { format: "es" },
});
