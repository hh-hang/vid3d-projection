<template>
    <div id="cesium-viewer" ref="viewerDivRef"></div>
    <div class="model-credit">
        <span>注：视频中实际位置与模型位置不一致，仅作参考</span>
    </div>
    <a
        class="source"
        href="https://github.com/hh-hang/vid3d-projection/blob/main/example/src/cesium-monitor.vue"
        target="_blank"
        rel="noopener noreferrer"
    >
        <img src="/imgs/source.svg" alt="" />
    </a>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import * as Cesium from "cesium";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import "cesium/Build/CesiumUnminified/Widgets/widgets.css";
import {
    CesiumProjectorTool,
    createCesiumVideoProjector,
} from "../../src/cesium-video-projection";
import Hls from "hls.js";

const projectionConfig = {
    lon: 5.105393631024482,
    lat: 52.09300904272346,
    hei: 48,
    heading: 47,
    pitch: -22.6,
    roll: 0,
    far: 100,
    near: 0.1,
    fov: 36,
    aspect: 1,
};

let viewer: Cesium.Viewer | null = null;
let CesiumProjectorTool: CesiumProjectorTool;
let gui: GUI | null = null;

onMounted(async () => {
    viewer = new Cesium.Viewer("cesium-viewer", {
        infoBox: false,
        timeline: false,
        animation: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
    });

    viewer.scene.debugShowFramesPerSecond = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // 加载3DTILES
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
        "https://tiles.arcgis.com/tiles/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Utrecht_3D_Tiles_Integrated_Mesh/3DTilesServer/tileset.json"
    );
    viewer.scene.primitives.add(tileset);

    // 相机定位
    const position = Cesium.Cartesian3.fromDegrees(
        projectionConfig.lon,
        projectionConfig.lat,
        projectionConfig.hei
    );
    viewer.camera.flyTo({
        destination: position,
        orientation: {
            heading: Cesium.Math.toRadians(projectionConfig.heading),
            pitch: Cesium.Math.toRadians(projectionConfig.pitch),
            roll: Cesium.Math.toRadians(projectionConfig.roll),
        },
        duration: 0,
    });

    // 创建视频元素
    const video = document.createElement("video");
    video.src = "video/monitorTest2.mp4";
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.crossOrigin = "anonymous";
    await video.play();

    /** 视频流 */
    // 创建视频纹理
    // const video = document.createElement("video");
    // video.muted = true;
    // video.playsInline = true;
    // video.autoplay = true;
    // // hls视频流送
    // if (Hls.isSupported()) {
    //     const hls = new Hls();
    //     hls.attachMedia(video);
    //     hls.on(Hls.Events.MEDIA_ATTACHED, () => {
    //     hls.loadSource("https://test-streams.mux.dev/tos_ismc/main.m3u8");
    //     });
    // }
    // try {
    //     await video.play();
    //     console.log("视频播放成功");
    // } catch (error) {
    //     console.warn("视频自动播放失败", error);
    // }

    // 投影工具
    CesiumProjectorTool = createCesiumVideoProjector(viewer as Cesium.Viewer, {
        projCamPosition: [
            projectionConfig.lon,
            projectionConfig.lat,
            projectionConfig.hei,
        ],
        projCamParams: {
            fov: projectionConfig.fov,
            aspect: projectionConfig.aspect,
            near: projectionConfig.near,
            far: projectionConfig.far,
        },
        orientationParams: {
            azimuthDeg: projectionConfig.heading,
            elevationDeg: projectionConfig.pitch,
            rollDeg: projectionConfig.roll,
        },
        source: video,
        isShowHelper: false,
        opacity: 1,
    });

    // 初始化 GUI 控制面板
    gui = new GUI({ title: "投影相机控制" });
 
    const projGuiConfig = {
        intensity: 1.0,
        proFar: projectionConfig.far,
        proNear: projectionConfig.near,
        projFov: projectionConfig.fov,
        edgeFeather: 0.05,
        projBias: 0.0001,
        videoAspect: 1.0,
        azimuthDeg: projectionConfig.heading,
        elevationDeg: projectionConfig.pitch,
        rollDeg: projectionConfig.roll,
        showHelpers: false,
        isAutoOpacity: false,
        opacity: 1,
        lon: projectionConfig.lon,
        lat: projectionConfig.lat,
        hei: projectionConfig.hei,
    };
    let isAutoOpacity = projGuiConfig.isAutoOpacity;

    // 根据距离设置透明度
    function setOpacityByDistance() {
        if (!isAutoOpacity || !viewer) return;
        const camPos = CesiumProjectorTool.cameraPosition;
        const distance = Cesium.Cartesian3.distance(
            viewer.camera.position,
            Cesium.Cartesian3.fromDegrees(camPos[0], camPos[1], camPos[2])
        );
        const opacity = Math.max(0, (50 - distance) / 50);
        CesiumProjectorTool.opacity = opacity;
    }
    viewer.scene.preRender.addEventListener(setOpacityByDistance);

    const projFolder = gui.addFolder("投影参数");
    projFolder
        .add(projGuiConfig, "intensity", 0, 3, 0.01)
        .name("投影强度(intensity)")
        .onChange((v: number) => {
            CesiumProjectorTool.intensity = v;
        });
    projFolder
        .add(projGuiConfig, "proFar", 1, 500, 10)
        .name("(远裁剪)far")
        .onChange((v: number) => {
            CesiumProjectorTool.far = v;
        });
    projFolder
        .add(projGuiConfig, "proNear", 0.01, 10, 0.1)
        .name("(近裁剪)near")
        .onChange((v: number) => {
            CesiumProjectorTool.near = v;
        });
    projFolder
        .add(projGuiConfig, "projFov", 1, 120, 0.1)
        .name("投影视场角(FOV)")
        .onChange((v: number) => {
            CesiumProjectorTool.fov = v;
        });
    projFolder
        .add(projGuiConfig, "edgeFeather", 0, 0.5, 0.001)
        .name("边缘羽化(edgeFeather)")
        .onChange((v: number) => {
            CesiumProjectorTool.edgeFeather = v;
        });
    projFolder
        .add(projGuiConfig, "videoAspect", 0.1, 10, 0.01)
        .name("视频宽高比(aspect)")
        .onChange((v: number) => {
            CesiumProjectorTool.aspect = v;
        });
    projFolder
        .add(projGuiConfig, "azimuthDeg", -180, 180, 0.1)
        .name("方位角(azimuth)")
        .onChange((v: number) => {
            CesiumProjectorTool.azimuthDeg = v;
        });
    projFolder
        .add(projGuiConfig, "elevationDeg", -89, 89, 0.1)
        .name("俯仰角(elevation)")
        .onChange((v: number) => {
            CesiumProjectorTool.elevationDeg = v;
        });
    projFolder
        .add(projGuiConfig, "rollDeg", -180, 180, 0.1)
        .name("横滚(roll)")
        .onChange((v: number) => {
            CesiumProjectorTool.rollDeg = v;
        });
    projFolder
        .add(projGuiConfig, "projBias", 0, 0.01, 0.0001)
        .name("深度偏移(bias)")
        .onChange((v: number) => {
            CesiumProjectorTool.projBias = v;
        });
    projFolder
        .add(projGuiConfig, "opacity", 0, 1, 0.01)
        .name("透明度(opacity)")
        .onChange((v: number) => {
            CesiumProjectorTool.opacity = v;
        });
    projFolder
        .add(projGuiConfig, "showHelpers")
        .name("相机辅助器(helpers)")
        .onChange((v: boolean) => {
            CesiumProjectorTool.isShowHelper = v;
        });
    projFolder
        .add(projGuiConfig, "isAutoOpacity")
        .name("自动调节透明度")
        .onChange((v: boolean) => {
            isAutoOpacity = v;
            if (!isAutoOpacity) CesiumProjectorTool.opacity = 1;
        });

    const posFolder = gui.addFolder("相机坐标(position)");
    const updatePosition = () => {
        CesiumProjectorTool.cameraPosition = [
            projGuiConfig.lon,
            projGuiConfig.lat,
            projGuiConfig.hei,
        ];
    };
    posFolder
        .add(projGuiConfig, "lon", 5.0987, 5.1187, 0.00001)
        .name("经度(lon)")
        .onChange(updatePosition);
    posFolder
        .add(projGuiConfig, "lat", 52.0857, 52.1057, 0.00001)
        .name("纬度(lat)")
        .onChange(updatePosition);
    posFolder
        .add(projGuiConfig, "hei", 0, 100, 0.1)
        .name("高度(hei)")
        .onChange(updatePosition);
});

onBeforeUnmount(() => {
    // 销毁 GUI
    if (gui) {
        gui.destroy();
        gui = null;
    }

    // 销毁viewer
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }
});
</script>

<style scoped>
#cesium-viewer {
    width: 100%;
    height: 100%;
}

:deep(.cesium-performanceDisplay-defaultContainer) {
    top: 0;
    left: 0;
    right: auto;
}

.model-credit {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    font-size: 16px;
    color: #e6eef6;
    background: rgba(0, 0, 0, 0.35);
    padding: 6px 12px;
    border-radius: 999px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    font-family:
        system-ui,
        -apple-system,
        "Segoe UI",
        Roboto,
        Arial;
}

.model-credit a {
    color: #6ecbff;
    text-decoration: none;
}

.model-credit a:hover {
    text-decoration: underline;
}

.source {
    position: fixed;
    bottom: 16px;
    right: 16px;
    padding: 12px;
    border-radius: 50%;
    margin-bottom: 0px;
    background-color: #fff;
    opacity: 0.9;
    z-index: 999;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);

    img {
        display: block;
        width: 24px;
    }
}
@media (hover: none) and (pointer: coarse), (max-width: 768px) {
    .source {
        display: none !important;
    }
}
</style>
