import path from "path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  root: "example",
  resolve: {
    alias: {
      "three-video-projection": path.resolve(__dirname, "src/index.ts"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "docs"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "example/index.html"),
        cinema: path.resolve(__dirname, "example/cinema.html"),
        monitor: path.resolve(__dirname, "example/monitor.html"),
      },
    },
  },
});
