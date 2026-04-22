<template>
    <div
        ref="cont"
        style="
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            position: absolute;
        "
    ></div>
    <div class="model-credit">
        模型来源：
        <a
            href="https://sketchfab.com/3d-models/s5-wtrzebnica-112017-75914beaf05941e1a24b6bca530dc1a6"
            target="_blank"
            rel="noopener noreferrer"
        >
            Sketchfab
        </a>
        <br />
        <span>注：视频中实际位置与模型位置不一致，仅作参考</span>
    </div>

    <a
        class="source"
        href="https://github.com/hh-hang/vid3d-projection/blob/main/example/src/three-monitor.vue"
        target="_blank"
        rel="noopener noreferrer"
    >
        <img src="/imgs/source.svg" alt="" />
    </a>
</template>

<script setup lang="ts">
import Stats from "stats.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
    createThreeVideoProjector,
    ThreeProjectorTool,
} from "../../src/three-video-projection";

const cont = ref<HTMLDivElement | null>(null);
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;
let stats: any;
let ThreeProjectorTool: ThreeProjectorTool;
let projCam: THREE.PerspectiveCamera;
let camHelper: THREE.CameraHelper | null = null;
let gui: any = null;
let video: HTMLVideoElement;
let isAutoOpacity = true;

const position: [number, number, number] = [-65.39, 119, 254.18];

onMounted(async () => {
    const container = cont.value!;
    scene = new THREE.Scene();

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // 监视器
    stats = new Stats();
    container.appendChild(stats.dom);

    // 相机
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(position[0], position[1], position[2]);

    // 控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxDistance = 2000;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(position[0] - 1, position[1] + 1, position[2] + 1);

    //  环境光
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambient);

    video = document.createElement("video");
    video.src = "video/monitorTest.mp4";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    const videoTexture = new THREE.VideoTexture(video);
    try {
        await video.play();
        console.log("视频播放成功");
    } catch (error) {
        console.warn("视频自动播放失败", error);
    }

    // 投影工具
    ThreeProjectorTool = await createThreeVideoProjector({
        scene,
        renderer,
        projCamPosition: position,
        projCamParams: { fov: 36.6, aspect: 1, near: 0.1, far: 400 },
        orientationParams: { azimuthDeg: 90, elevationDeg: -18.2, rollDeg: 0 },
        videoTexture,
        isShowHelper: false,
    });

    projCam = ThreeProjectorTool.projCam;
    camHelper = ThreeProjectorTool.camHelper;

    camera.quaternion.copy(projCam.quaternion);
    camera.updateMatrixWorld();

    const dir = new THREE.Vector3();
    projCam.getWorldDirection(dir);
    const targetPoint = projCam
        .getWorldPosition(new THREE.Vector3())
        .add(dir.multiplyScalar(50));
    controls.target.copy(targetPoint);
    controls.update();

    // 调试
    gui = new GUI({ title: "投影相机控制" });
    const cfg: any = {
        showHelpers: ThreeProjectorTool.camHelper?.visible,
        intensity: ThreeProjectorTool.uniforms.intensity.value,
        projFov: projCam.fov,
        proFar: projCam.far,
        proNear: projCam.near,
        azimuthDeg: ThreeProjectorTool.orientationParams.azimuthDeg,
        elevationDeg: ThreeProjectorTool.orientationParams.elevationDeg,
        rollDeg: ThreeProjectorTool.orientationParams.rollDeg,
        projBias: ThreeProjectorTool.uniforms.projBias.value,
        projPosX: projCam.position.x,
        projPosY: projCam.position.y,
        projPosZ: projCam.position.z,
        edgeFeather: ThreeProjectorTool.uniforms.edgeFeather.value,
        videoAspect: projCam.aspect,
        isAutoOpacity: isAutoOpacity,
        cropX0: ThreeProjectorTool.uniforms.cropRect.value.x,
        cropY0: ThreeProjectorTool.uniforms.cropRect.value.y,
        cropX1: ThreeProjectorTool.uniforms.cropRect.value.z,
        cropY1: ThreeProjectorTool.uniforms.cropRect.value.w,
        quadBLx: 0,
        quadBLy: 0,
        quadBRx: 1,
        quadBRy: 0,
        quadTRx: 1,
        quadTRy: 1,
        quadTLx: 0,
        quadTLy: 1,
    };

    function updatePositionFromGUI() {
        projCam.position.set(cfg.projPosX, cfg.projPosY, cfg.projPosZ);
        if (camHelper) camHelper.update();
    }

    const projFolder = gui.addFolder("投影参数");
    projFolder
        .add(cfg, "intensity", 0, 3, 0.01)
        .name("投影强度(intensity)")
        .onChange((v: number) => {
            ThreeProjectorTool.uniforms.intensity.value = v;
        });
    projFolder
        .add(cfg, "proFar", 1, 500, 10)
        .name("(远裁剪)far")
        .onChange((v: number) => {
            projCam.far = v;
            projCam.updateProjectionMatrix();
            if (camHelper) camHelper.update();
        });
    projFolder
        .add(cfg, "proNear", 1, 10, 0.1)
        .name("(近裁剪)near")
        .onChange((v: number) => {
            projCam.near = v;
            projCam.updateProjectionMatrix();
            if (camHelper) camHelper.update();
        });
    projFolder
        .add(cfg, "projFov", 1, 120, 0.1)
        .name("投影视场角(FOV)")
        .onChange((v: number) => {
            projCam.fov = v;
            projCam.updateProjectionMatrix();
            if (camHelper) camHelper.update();
        });
    projFolder
        .add(cfg, "edgeFeather", 0, 0.5, 0.001)
        .name("边缘羽化(edgeFeather)")
        .onChange((v: number) => {
            ThreeProjectorTool.uniforms.edgeFeather.value = v;
        });
    projFolder
        .add(cfg, "videoAspect", 0.1, 10, 0.01)
        .name("视频宽高比(aspect)")
        .onChange((v: number) => {
            projCam.aspect = v;
            projCam.updateProjectionMatrix();
            if (camHelper) camHelper.update();
        });
    projFolder
        .add(cfg, "azimuthDeg", -180, 180, 0.1)
        .name("方位角(azimuth)")
        .onChange((v: number) => {
            ThreeProjectorTool.azimuthDeg = v;
        });
    projFolder
        .add(cfg, "elevationDeg", -89, 89, 0.1)
        .name("俯仰角(elevation)")
        .onChange((v: number) => {
            ThreeProjectorTool.elevationDeg = v;
        });
    projFolder
        .add(cfg, "rollDeg", -180, 180, 0.1)
        .name("横滚(roll)")
        .onChange((v: number) => {
            ThreeProjectorTool.rollDeg = v;
        });
    projFolder
        .add(cfg, "projBias", 0.0, 0.001, 0.00001)
        .name("深度偏移(bias)")
        .onChange((v: number) => {
            ThreeProjectorTool.uniforms.projBias.value = v;
        });
    projFolder
        .add(cfg, "showHelpers")
        .name("相机辅助器(helpers)")
        .onChange((v: boolean) => {
            if (camHelper) camHelper.visible = v;
        });
    projFolder
        .add(cfg, "isAutoOpacity")
        .name("自动调节透明度(isAutoOpacity)")
        .onChange((v: boolean) => {
            isAutoOpacity = v;
            if (!isAutoOpacity) ThreeProjectorTool.opacity = 1;
        });

    const posFolder = gui.addFolder("相机坐标(position)");
    posFolder
        .add(cfg, "projPosX", -500, 500, 0.01)
        .name("X")
        .onChange(updatePositionFromGUI);
    posFolder
        .add(cfg, "projPosY", -500, 500, 0.01)
        .name("Y")
        .onChange(updatePositionFromGUI);
    posFolder
        .add(cfg, "projPosZ", -500, 500, 0.01)
        .name("Z")
        .onChange(updatePositionFromGUI);

    // 裁剪区域
    function updateCropFromGUI() {
        ThreeProjectorTool.cropRect = [
            cfg.cropX0,
            cfg.cropY0,
            cfg.cropX1,
            cfg.cropY1,
        ];
    }

    const cropFolder = gui.addFolder("裁剪区域(cropRect)");
    cropFolder
        .add(cfg, "cropX0", 0, 1, 0.01)
        .name("左边界(x0)")
        .onChange(updateCropFromGUI);
    cropFolder
        .add(cfg, "cropY0", 0, 1, 0.01)
        .name("下边界(y0)")
        .onChange(updateCropFromGUI);
    cropFolder
        .add(cfg, "cropX1", 0, 1, 0.01)
        .name("右边界(x1)")
        .onChange(updateCropFromGUI);
    cropFolder
        .add(cfg, "cropY1", 0, 1, 0.01)
        .name("上边界(y1)")
        .onChange(updateCropFromGUI);

    // 四角点变换
    function updateQuadFromGUI() {
        ThreeProjectorTool.quadCorners = [
            [cfg.quadBLx, cfg.quadBLy],
            [cfg.quadBRx, cfg.quadBRy],
            [cfg.quadTRx, cfg.quadTRy],
            [cfg.quadTLx, cfg.quadTLy],
        ];
    }

    const quadFolder = gui.addFolder("四角点变换(quadCorners)");
    quadFolder
        .add(cfg, "quadBLx", -0.5, 1.5, 0.001)
        .name("左下X(BL.x)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadBLy", -0.5, 1.5, 0.001)
        .name("左下Y(BL.y)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadBRx", -0.5, 1.5, 0.001)
        .name("右下X(BR.x)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadBRy", -0.5, 1.5, 0.001)
        .name("右下Y(BR.y)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadTRx", -0.5, 1.5, 0.001)
        .name("右上X(TR.x)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadTRy", -0.5, 1.5, 0.001)
        .name("右上Y(TR.y)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadTLx", -0.5, 1.5, 0.001)
        .name("左上X(TL.x)")
        .onChange(updateQuadFromGUI);
    quadFolder
        .add(cfg, "quadTLy", -0.5, 1.5, 0.001)
        .name("左上Y(TL.y)")
        .onChange(updateQuadFromGUI);

    projFolder.open();
    posFolder.open();

    renderer.setAnimationLoop(() => {
        if (ThreeProjectorTool) ThreeProjectorTool.update();
        renderer.render(scene, camera);
        stats.update();
        setOpacityByDistance();
    });

    window.addEventListener("resize", resize);
    function resize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    }

    // 加载模型
    const gltfLoader = new GLTFLoader();
    gltfLoader.loadAsync("model/s5_w.trzebnica_11.2017.glb").then((gltf) => {
        const model = gltf.scene;
        model.traverse((child: any) => {
            if (child.isMesh) {
                if (ThreeProjectorTool) ThreeProjectorTool.addTargetMesh(child);
            }
        });
        scene.add(model);
    });

    // 根据距离设置透明度
    function setOpacityByDistance() {
        if (!isAutoOpacity) return;
        const distance = camera.position.distanceTo(projCam.position);
        const opacity = (50 - distance) / 50;
        ThreeProjectorTool.opacity = opacity;
        return distance;
    }
});

onBeforeUnmount(() => {
    try {
        renderer.setAnimationLoop(null);
        window.removeEventListener("resize", () => {});
        if (ThreeProjectorTool) ThreeProjectorTool.dispose();
        if (gui)
            try {
                gui.destroy();
            } catch (e) {}
        scene.traverse((child: any) => {
            if (child.material) {
                if (Array.isArray(child.material))
                    child.material.forEach((m: any) => m.dispose());
                else child.material.dispose();
            }
            if (child.geometry) child.geometry.dispose();
        });
        renderer.dispose();
    } catch (e) {}
});
</script>

<style scoped>
canvas {
    display: block;
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
