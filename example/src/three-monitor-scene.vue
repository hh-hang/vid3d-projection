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
    <ThreeCameraCalibrationPanel
        v-if="calibrationOpen"
        :video-el="video"
        :renderer="renderer"
        :view-camera="camera"
        :projector="ThreeProjectorTool"
        @close="calibrationOpen = false"
        @parameters-change="syncCalibrationGui"
    />
    <div class="model-credit">
        <div v-if="kind === 'mesh'" class="credit-line">
            Model source:
            <a
                href="https://sketchfab.com/3d-models/s5-wtrzebnica-112017-75914beaf05941e1a24b6bca530dc1a6"
                target="_blank"
                rel="noopener noreferrer"
            >
                Sketchfab
            </a>
        </div>
        <div>
            Note: The video location does not match the model; for reference
            only.
        </div>
    </div>

    <div v-if="loading || loadError" class="scene-status" role="status">
        {{ loadError || "Loading 3D scene…" }}
    </div>
    <a
        class="source"
        href="https://github.com/hh-hang/vid3d-projection/blob/main/example/src/three-monitor-scene.vue"
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
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { onBeforeUnmount, onMounted, ref } from "vue";
import ThreeCameraCalibrationPanel from "./three-camera-calibration-panel.vue";
import {
    createThreeVideoProjector,
    ThreeProjectorTool,
} from "../../src/three-video-projection";

const props = defineProps<{
    kind: "mesh" | "gsplat";
    savedState: Record<string, any>;
}>();
const loading = ref(true);
const loadError = ref("");
let disposed = false;
let spark: import("@sparkjsdev/spark").SparkRenderer | undefined;
let splats: import("@sparkjsdev/spark").SplatMesh | undefined;
let videoTexture: THREE.VideoTexture | undefined;
let dracoLoader: DRACOLoader | undefined;
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
let isAutoOpacity = false;
let focusDistance = 50;
let guiConfig: any = null;
const calibrationOpen = ref(false);

const position: [number, number, number] = [-65.423, 119.9516, 250.5041];

const syncCalibrationGui = () => {
    if (!guiConfig || !ThreeProjectorTool || !projCam) return;
    guiConfig.projFov = projCam.fov;
    guiConfig.proFar = projCam.far;
    guiConfig.proNear = projCam.near;
    guiConfig.videoAspect = projCam.aspect;
    guiConfig.azimuthDeg = ThreeProjectorTool.azimuthDeg;
    guiConfig.elevationDeg = ThreeProjectorTool.elevationDeg;
    guiConfig.rollDeg = ThreeProjectorTool.rollDeg;
    guiConfig.projPosX = projCam.position.x;
    guiConfig.projPosY = projCam.position.y;
    guiConfig.projPosZ = projCam.position.z;
    gui?.controllersRecursive().forEach((controller: any) =>
        controller.updateDisplay()
    );
};

onMounted(async () => {
    try {
        const container = cont.value!;
        scene = new THREE.Scene();

        // 渲染器
        renderer = new THREE.WebGLRenderer({
            antialias: props.kind === "mesh",
        });
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
        video.src =
            props.kind === "gsplat"
                ? "video/monitorTest2.mp4"
                : "video/monitorTest.mp4";
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        videoTexture = new THREE.VideoTexture(video);
        try {
            await video.play();
            console.log("视频播放成功");
        } catch (error) {
            console.warn("视频自动播放失败", error);
        }

        if (disposed) return;
        // 模型解码器
        dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(
            "https://unpkg.com/three@0.180.0/examples/jsm/libs/draco/"
        );
        const gltf = await new GLTFLoader()
            .setDRACOLoader(dracoLoader)
            .loadAsync(
                props.kind === "gsplat"
                    ? "model/road-collider.glb"
                    : "model/road.glb"
            );
        const model = gltf.scene;
        if (disposed) {
            disposeObjects(model);
            return;
        }
        const assetGroup = new THREE.Group();
        if (props.kind === "gsplat") {
            assetGroup.rotation.z = Math.PI;
        }
        assetGroup.add(model);
        scene.add(assetGroup);
        assetGroup.updateMatrixWorld(true);
        let proxyMaterial: THREE.MeshBasicMaterial | undefined;
        let initialPosition: [number, number, number] = position;
        let initialOrientation = {
            azimuthDeg: 89.73154,
            elevationDeg: -16.9054,
            rollDeg: -2.8378,
        };
        let initialFar = 400;
        if (props.kind === "gsplat") {
            // 代理模型和高斯模型使用相同变换，保持空间对齐
            const bounds = new THREE.Box3().setFromObject(model);
            const radius = Math.max(
                bounds.getSize(new THREE.Vector3()).length() * 0.5,
                1
            );
            initialPosition = [0.7, -0.15, 7.9];
            initialOrientation = {
                azimuthDeg: -81.1,
                elevationDeg: -16,
                rollDeg: 0,
            };
            initialFar = 10;
            focusDistance = 5;
            camera.far = Math.max(1000, radius * 8);
            camera.near = 0.01;
            camera.updateProjectionMatrix();
            controls.maxDistance = radius * 12;
            controls.minDistance = radius * 0.01;
            proxyMaterial = new THREE.MeshBasicMaterial({
                colorWrite: false,
                depthWrite: false,
                transparent: true,
                wireframe: true,
                color: 0xffffff,
                side: THREE.DoubleSide,
            });
            const oldMaterials = new Set<THREE.Material>();
            model.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                for (const material of Array.isArray(object.material)
                    ? object.material
                    : [object.material])
                    oldMaterials.add(material);
                object.material = proxyMaterial;
                object.renderOrder = 3;
            });
            oldMaterials.forEach((material) => {
                disposeMaterial(material);
            });
            const { SparkRenderer, SplatMesh } =
                await import("@sparkjsdev/spark");
            if (disposed) return;
            spark = new SparkRenderer({ renderer, depthWrite: false });
            spark.renderOrder = 0;
            scene.add(spark);
            splats = new SplatMesh({
                url: "model/road.sog",
                raycastable: false,
            });
            assetGroup.add(splats);
            await splats.initialized;
            if (disposed) {
                splats.dispose();
                return;
            }
        }

        // 投影工具
        ThreeProjectorTool = await createThreeVideoProjector({
            scene,
            renderer,
            projCamPosition: initialPosition,
            projCamParams: {
                fov: props.kind === "gsplat" ? 26.4 : 33.18234,
                aspect: props.kind === "gsplat" ? 2.2 : 1,
                near: camera.near,
                far: initialFar,
            },
            orientationParams: initialOrientation,
            videoTexture,
            projectionSide:
                props.kind === "gsplat" ? THREE.BackSide : THREE.FrontSide,
            isShowHelper: false,
            enableOcclusionCulling: props.kind === "mesh",
        });

        if (disposed) {
            ThreeProjectorTool.dispose();
            return;
        }
        model.traverse((object) => {
            if (object instanceof THREE.Mesh)
                ThreeProjectorTool.addTargetMesh(object);
        });
        if (props.kind === "gsplat") {
            // 先渲染高斯模型，再写入代理模型深度，最后叠加视频投影
            const depthMaterial = new THREE.MeshBasicMaterial({
                colorWrite: false,
                transparent: true,
                side: THREE.BackSide,
            });
            const viewDepth = new THREE.Group();
            model.updateMatrixWorld(true);
            model.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                const mesh = new THREE.Mesh(object.geometry, depthMaterial);
                mesh.matrixAutoUpdate = false;
                mesh.matrix.copy(object.matrixWorld);
                mesh.renderOrder = 1;
                viewDepth.add(mesh);
            });
            scene.add(viewDepth);
            ThreeProjectorTool.overlays.forEach((overlay) => {
                overlay.renderOrder = 2;
            });
        }
        projCam = ThreeProjectorTool.projCam;
        camHelper = ThreeProjectorTool.camHelper;

        camera.position.copy(projCam.position);
        camera.quaternion.copy(projCam.quaternion);
        camera.updateMatrixWorld();

        const dir = new THREE.Vector3();
        projCam.getWorldDirection(dir);
        const targetPoint = projCam
            .getWorldPosition(new THREE.Vector3())
            .add(dir.multiplyScalar(focusDistance));
        controls.target.copy(targetPoint);
        controls.update();

        // 调试
        gui = new GUI({ title: "Projector Controls" });
        const cfg: any = {
            showMesh: false,
            showHelpers: ThreeProjectorTool.camHelper?.visible,
            enableOcclusionCulling: ThreeProjectorTool.enableOcclusionCulling,
            showFarPlane: ThreeProjectorTool.showFarPlane,
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
            opacityDistance: props.kind === "gsplat" ? 10 : 50,
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
            openCalibration: () => {
                if (!video.videoWidth || !video.videoHeight) {
                    console.warn("视频尚未就绪，暂时无法开始标定");
                    return;
                }
                if (!ThreeProjectorTool.targetMeshes.length) {
                    console.warn("模型尚未加载完成，暂时无法开始标定");
                    return;
                }
                calibrationOpen.value = true;
            },
            goToProjector: () => {
                camera.position.copy(projCam.position);
                camera.quaternion.copy(projCam.quaternion);
                camera.updateMatrixWorld();
                const dir = new THREE.Vector3();
                projCam.getWorldDirection(dir);
                controls.target
                    .copy(projCam.position)
                    .add(dir.multiplyScalar(focusDistance));
                controls.update();
            },
        };
        guiConfig = cfg;

        gui.add(cfg, "openCalibration").name("Open video spatial calibration");
        gui.add(cfg, "goToProjector").name("Go to projector camera");
        if (proxyMaterial) {
            gui.add(cfg, "showMesh")
                .name("Show mesh")
                .onChange((visible: boolean) => {
                    proxyMaterial.colorWrite = visible;
                });
        }

        function updatePositionFromGUI() {
            projCam.position.set(cfg.projPosX, cfg.projPosY, cfg.projPosZ);
            if (camHelper) camHelper.update();
        }

        const projFolder = gui.addFolder("Projection");
        projFolder
            .add(cfg, "intensity", 0, 3, 0.01)
            .name("Intensity")
            .onChange((v: number) => {
                ThreeProjectorTool.uniforms.intensity.value = v;
            });
        projFolder
            .add(cfg, "proFar", 1, Math.max(2000, initialFar * 2), 10)
            .name("Far")
            .onChange((v: number) => {
                projCam.far = v;
                projCam.updateProjectionMatrix();
                if (camHelper) camHelper.update();
            });
        projFolder
            .add(cfg, "proNear", 0.01, 10, 0.01)
            .name("Near")
            .onChange((v: number) => {
                projCam.near = v;
                projCam.updateProjectionMatrix();
                if (camHelper) camHelper.update();
            });
        projFolder
            .add(cfg, "projFov", 1, 120, 0.1)
            .name("FOV")
            .onChange((v: number) => {
                projCam.fov = v;
                projCam.updateProjectionMatrix();
                if (camHelper) camHelper.update();
            });
        projFolder
            .add(cfg, "edgeFeather", 0, 0.5, 0.001)
            .name("Edge feather")
            .onChange((v: number) => {
                ThreeProjectorTool.uniforms.edgeFeather.value = v;
            });
        projFolder
            .add(cfg, "videoAspect", 0.1, 10, 0.01)
            .name("Aspect")
            .onChange((v: number) => {
                projCam.aspect = v;
                projCam.updateProjectionMatrix();
                if (camHelper) camHelper.update();
            });
        projFolder
            .add(cfg, "azimuthDeg", -180, 180, 0.1)
            .name("Azimuth")
            .onChange((v: number) => {
                ThreeProjectorTool.azimuthDeg = v;
            });
        projFolder
            .add(cfg, "elevationDeg", -89, 89, 0.1)
            .name("Elevation")
            .onChange((v: number) => {
                ThreeProjectorTool.elevationDeg = v;
            });
        projFolder
            .add(cfg, "rollDeg", -180, 180, 0.1)
            .name("Roll")
            .onChange((v: number) => {
                ThreeProjectorTool.rollDeg = v;
            });
        projFolder
            .add(cfg, "projBias", 0.0, 0.001, 0.00001)
            .name("Depth bias")
            .onChange((v: number) => {
                ThreeProjectorTool.uniforms.projBias.value = v;
            });
        projFolder
            .add(cfg, "showHelpers")
            .name("Camera helper")
            .onChange((v: boolean) => {
                if (camHelper) camHelper.visible = v;
            });
        projFolder
            .add(cfg, "enableOcclusionCulling")
            .name("Occlusion culling")
            .onChange((v: boolean) => {
                ThreeProjectorTool.enableOcclusionCulling = v;
            });
        projFolder
            .add(cfg, "showFarPlane")
            .name("Far plane projection")
            .onChange((v: boolean) => {
                ThreeProjectorTool.showFarPlane = v;
            });
        projFolder
            .add(cfg, "isAutoOpacity")
            .name("Auto opacity")
            .onChange((v: boolean) => {
                isAutoOpacity = v;
                if (!isAutoOpacity) ThreeProjectorTool.opacity = 1;
            });
        projFolder
            .add(
                cfg,
                "opacityDistance",
                0.1,
                props.kind === "gsplat" ? 100 : 500,
                0.1
            )
            .name("Fade distance");

        const posFolder = gui.addFolder("Camera position");
        const positionRange = Math.max(500, initialFar);
        posFolder
            .add(cfg, "projPosX", -positionRange, positionRange, 0.01)
            .name("X")
            .onChange(updatePositionFromGUI);
        posFolder
            .add(cfg, "projPosY", -positionRange, positionRange, 0.01)
            .name("Y")
            .onChange(updatePositionFromGUI);
        posFolder
            .add(cfg, "projPosZ", -positionRange, positionRange, 0.01)
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

        const cropFolder = gui.addFolder("Crop rect");
        cropFolder
            .add(cfg, "cropX0", 0, 1, 0.01)
            .name("Left (x0)")
            .onChange(updateCropFromGUI);
        cropFolder
            .add(cfg, "cropY0", 0, 1, 0.01)
            .name("Bottom (y0)")
            .onChange(updateCropFromGUI);
        cropFolder
            .add(cfg, "cropX1", 0, 1, 0.01)
            .name("Right (x1)")
            .onChange(updateCropFromGUI);
        cropFolder
            .add(cfg, "cropY1", 0, 1, 0.01)
            .name("Top (y1)")
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

        const quadFolder = gui.addFolder("Quad corners");
        quadFolder
            .add(cfg, "quadBLx", -0.5, 1.5, 0.001)
            .name("BL.x")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadBLy", -0.5, 1.5, 0.001)
            .name("BL.y")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadBRx", -0.5, 1.5, 0.001)
            .name("BR.x")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadBRy", -0.5, 1.5, 0.001)
            .name("BR.y")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadTRx", -0.5, 1.5, 0.001)
            .name("TR.x")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadTRy", -0.5, 1.5, 0.001)
            .name("TR.y")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadTLx", -0.5, 1.5, 0.001)
            .name("TL.x")
            .onChange(updateQuadFromGUI);
        quadFolder
            .add(cfg, "quadTLy", -0.5, 1.5, 0.001)
            .name("TL.y")
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
        if (props.savedState.config) {
            gui.controllersRecursive().forEach((controller: any) => {
                const value = props.savedState.config[controller.property];
                if (value !== undefined && typeof value !== "function")
                    controller.setValue(value);
            });
        }
        if (props.savedState.camera) {
            camera.position.fromArray(props.savedState.camera);
            controls.target.fromArray(props.savedState.target);
            controls.update();
        }
        loading.value = false;

        // 根据观察相机到投影相机的距离设置透明度，达到阈值时完全淡出
        function setOpacityByDistance() {
            if (!isAutoOpacity) return;
            const distance = camera.position.distanceTo(projCam.position);
            const opacity = THREE.MathUtils.clamp(
                1 - distance / cfg.opacityDistance,
                0,
                1
            );
            ThreeProjectorTool.opacity = opacity;
            return distance;
        }
    } catch (error) {
        if (!disposed) {
            console.error("Scene loading failed", error);
            loadError.value = "Scene loading failed. Switch scenes to retry.";
            loading.value = false;
        }
    }
});

function resize() {
    if (!renderer || !camera || !cont.value) return;
    camera.aspect = cont.value.clientWidth / cont.value.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cont.value.clientWidth, cont.value.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

function disposeMaterial(material: THREE.Material) {
    for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
}

function disposeObjects(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object === spark) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
    });
    materials.forEach(disposeMaterial);
    geometries.forEach((geometry) => geometry.dispose());
}

onBeforeUnmount(() => {
    disposed = true;
    if (guiConfig && !loading.value && !loadError.value) {
        props.savedState.config = Object.fromEntries(
            Object.entries(guiConfig).filter(
                ([, value]) => typeof value !== "function"
            )
        );
        props.savedState.camera = camera.position.toArray();
        props.savedState.target = controls.target.toArray();
    }
    calibrationOpen.value = false;
    renderer?.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    controls?.dispose();
    gui?.destroy();
    video?.pause();
    video?.removeAttribute("src");
    video?.load();
    ThreeProjectorTool?.dispose();
    videoTexture?.dispose();
    camHelper?.dispose();
    if (scene) disposeObjects(scene);
    if (splats?.isInitialized) splats.dispose();
    spark?.dispose();
    dracoLoader?.dispose();
    renderer?.dispose();
});
</script>

<style scoped>
.scene-status {
    position: fixed;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 900;
    padding: 10px 16px;
    border-radius: 10px;
    background: #111d;
    color: #fff;
    font: 13px system-ui;
    text-align: center;
}
canvas {
    display: block;
}
.model-credit {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    max-width: calc(100vw - 32px);
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.45;
    text-align: center;
    color: #e6eef6;
    background: rgba(0, 0, 0, 0.45);
    padding: 7px 16px;
    border-radius: 8px;
    backdrop-filter: blur(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    font-family:
        system-ui,
        -apple-system,
        "Segoe UI",
        Roboto,
        sans-serif;
}

.model-credit .credit-line {
    white-space: nowrap;
}

.model-credit a {
    color: #79c0ff;
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
    .source,
    .model-credit {
        display: none !important;
    }
}
</style>
