import path from "path";
import vue from "@vitejs/plugin-vue";
import glsl from "vite-plugin-glsl";
import cesium from "vite-plugin-cesium";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [vue(), glsl(), cesium()],
    base: "/vid3d-projection/",
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