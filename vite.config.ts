import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    chunkSizeWarningLimit: 4096,
    assetsInlineLimit: mode === "single" ? 100_000_000 : 0,
  },
  server: {
    watch: {
      ignored: ["**/_work/**"],
    },
  },
}));
