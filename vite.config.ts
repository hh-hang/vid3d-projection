import path from "path";
import vue from "@vitejs/plugin-vue";
import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";

export default defineConfig({
    base: "/vid3d-projection/",
    root: "example",
    define: {
        CESIUM_BASE_URL: JSON.stringify("/vid3d-projection/cesium/"),
    },
    plugins: [vue(), glsl()],
    resolve: {
        alias: {
            "vid3d-projection": path.resolve(__dirname, "src/index.ts"),
        },
    },
    build: {
        outDir: path.resolve(__dirname, "docs"),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: path.resolve(__dirname, "example/index.html"),
                "three-cinema": path.resolve(__dirname, "example/three-cinema.html"),
                "three-monitor": path.resolve(__dirname, "example/three-monitor.html"),
                "cesium-monitor": path.resolve(__dirname, "example/cesium-monitor.html"),
            },
        },
    },
});