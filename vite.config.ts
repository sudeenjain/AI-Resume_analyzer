import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  define: {
    "process.env": {},
  },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000", // your express backend
    },
  },
});