import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3001,
  },
  build: {
    sourcemap: mode === "development",
  },
  define: {
    __DEV__: mode === "development",
  },
}));
