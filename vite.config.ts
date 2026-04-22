import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import glsl from "vite-plugin-glsl";

export default defineConfig({
    root: "example",
    base: "./",
    plugins: [
        vue(),
        cesium(),
        glsl()
    ],
    build: {
        outDir: "../docs",
        emptyOutDir: true,
    }
});