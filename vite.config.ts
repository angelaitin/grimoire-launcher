import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config de Vite pensada para Tauri: puerto fijo y sin ofuscar el host.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  // Tauri espera los assets en ../dist
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
