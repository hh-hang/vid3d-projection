import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        three: "src/three-video-projection.ts",
        cesium: "src/cesium-video-projection.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    platform: "browser",
    external: ["three", "cesium"],
    loader: {
        ".glsl": "text",
    },
});
