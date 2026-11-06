import * as THREE from "three";
import vertexShader from "./shaders/three-video-projection.vert.glsl";
import fragmentShader from "./shaders/three-video-projection.frag.glsl";
import computeQuadHomographyElements from "./utils/computeQuadHomographyElements";

// 由四角点计算Homography矩阵（投影UV空间 → 视频UV空间）
function computeQuadHomography(
    corners: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ]
): THREE.Matrix3 {
    const elements = computeQuadHomographyElements(corners);
    return new THREE.Matrix3().fromArray(elements);
}

export type ThreeProjectorToolOptions = {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    videoTexture: THREE.VideoTexture;
    projCamPosition?: [number, number, number];
    projCamParams?: {
        fov?: number;
        aspect?: number;
        near?: number;
        far?: number;
    };
    orientationParams?: {
        azimuthDeg?: number;
        elevationDeg?: number;
        rollDeg?: number;
    };
    depthSize?: number;
    projectionSide?: THREE.Side;
    intensity?: number;
    opacity?: number;
    projBias?: number;
    edgeFeather?: number;
    cropRect?: [number, number, number, number];
    quadCorners?: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
    isShowHelper?: boolean;
    enableOcclusionCulling?: boolean;
    showFarPlane?: boolean;
};

export interface ThreeProjectorTool {
    addTargetMesh: (mesh: THREE.Mesh) => void;
    removeTargetMesh: (mesh: THREE.Mesh) => void;
    update: () => void;
    dispose: () => void;
    azimuthDeg: number;
    elevationDeg: number;
    rollDeg: number;
    opacity: number;
    cropRect: [number, number, number, number];
    quadCorners: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
    uniforms: any;
    overlays: THREE.Mesh[];
    targetMeshes: THREE.Mesh[];
    projCam: THREE.PerspectiveCamera;
    camHelper: THREE.CameraHelper | null;
    orientationParams: {
        azimuthDeg: number;
        elevationDeg: number;
        rollDeg: number;
    };
    enableOcclusionCulling: boolean;
    showFarPlane: boolean;
}

export async function createThreeVideoProjector(
    opts: ThreeProjectorToolOptions
): Promise<ThreeProjectorTool> {
    const {
        scene,
        renderer,
        videoTexture,
        projCamPosition = [0, 0, 0],
        projCamParams = { fov: 30, aspect: 1, near: 0.1, far: 50 },
        orientationParams = { azimuthDeg: 0, elevationDeg: 0, rollDeg: 0 },
        depthSize = 1024,
        projectionSide = THREE.FrontSide,
        intensity = 1.0,
        opacity = 1.0,
        projBias = 0.0001,
        edgeFeather = 0.05,
        cropRect = [0, 0, 1, 1] as [number, number, number, number],
        quadCorners = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ] as [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
        ],
        isShowHelper = true,
    } = opts;
    let enableOcclusionCulling = opts.enableOcclusionCulling ?? true;

    let orientParams = {
        azimuthDeg: orientationParams.azimuthDeg ?? 0,
        elevationDeg: orientationParams.elevationDeg ?? 0,
        rollDeg: orientationParams.rollDeg ?? 0,
    };
    let projCam: THREE.PerspectiveCamera;
    let camHelper: THREE.CameraHelper | null = null;

    // 创建投影相机
    projCam = new THREE.PerspectiveCamera(
        projCamParams.fov ?? 30,
        projCamParams.aspect ?? 1,
        projCamParams.near ?? 0.1,
        projCamParams.far ?? 50
    );
    projCam.position.set(
        projCamPosition[0],
        projCamPosition[1],
        projCamPosition[2]
    );
    projCam.lookAt(0, 0, 0);
    scene.add(projCam);

    // 更新相机朝向
    applyOrientationFromAngles();

    // 创建相机辅助器
    camHelper = new THREE.CameraHelper(projCam);
    camHelper.name = "camHelper";
    camHelper.visible = isShowHelper;
    scene.add(camHelper);

    // 视频纹理
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;

    // 着色器
    const projectorUniforms: any = {
        projectorMap: { value: videoTexture },
        projectorMatrix: { value: new THREE.Matrix4() },
        intensity: { value: intensity },
        projectorDepthMap: { value: null },
        projBias: { value: projBias },
        edgeFeather: { value: edgeFeather },
        opacity: { value: opacity },
        cropRect: {
            value: new THREE.Vector4(
                cropRect[0],
                cropRect[1],
                cropRect[2],
                cropRect[3]
            ),
        },
        quadHomography: { value: computeQuadHomography(quadCorners) },
        enableOcclusionCulling: { value: enableOcclusionCulling },
    };

    const projectorMat = new THREE.ShaderMaterial({
        uniforms: projectorUniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: projectionSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
        alphaTest: 0.02,
    });

    const farPlaneMat = new THREE.ShaderMaterial({
        uniforms: projectorUniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
        alphaTest: 0.02,
    });

    const projectorDepthRT = new THREE.WebGLRenderTarget(depthSize, depthSize, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        stencilBuffer: false,
        depthBuffer: true,
    });
    projectorDepthRT.depthTexture = new THREE.DepthTexture(
        depthSize,
        depthSize,
        THREE.UnsignedShortType
    );

    const depthScene = new THREE.Scene();
    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.depthPacking = THREE.RGBADepthPacking;
    depthMaterial.side = projectionSide;

    const overlays: THREE.Mesh[] = [];
    const targetMeshes: THREE.Mesh[] = [];
    const depthProxies: THREE.Mesh[] = [];

    // 用于脏检测的缓存
    const _tmpProjMatrix = new THREE.Matrix4();
    const _lastProjCamMatrix = new THREE.Matrix4();
    const _lastProjCamProjectionMatrix = new THREE.Matrix4();
    const _lastMeshMatrices: THREE.Matrix4[] = [];

    // 远裁剪面 overlay
    let showFarPlane = opts.showFarPlane ?? false;
    let farPlaneOverlay: THREE.Mesh | null = null;
    let farPlaneGeometry: THREE.PlaneGeometry | null = null;
    const _farPlaneDir = new THREE.Vector3();

    update();
    buildFarPlaneOverlay();

    // 创建投影mesh
    function makeProjectorOverlayAndProxy(mesh: THREE.Mesh) {
        const overlay = new THREE.Mesh(mesh.geometry, projectorMat);
        overlay.matrixAutoUpdate = false;
        overlay.renderOrder = (mesh.renderOrder || 0) + 1;
        mesh.updateMatrixWorld(true);
        overlay.matrix.copy(mesh.matrixWorld);
        scene.add(overlay);

        const proxy = new THREE.Mesh(mesh.geometry, depthMaterial);
        proxy.matrixAutoUpdate = false;
        proxy.matrix.copy(mesh.matrixWorld);
        depthScene.add(proxy);

        overlays.push(overlay);
        depthProxies.push(proxy);
        _lastMeshMatrices.push(mesh.matrixWorld.clone());

        return { overlay, proxy };
    }

    // 添加目标mesh(投影)
    function addTargetMesh(mesh: THREE.Mesh) {
        if (targetMeshes.indexOf(mesh) !== -1) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        targetMeshes.push(mesh);
        makeProjectorOverlayAndProxy(mesh);
    }

    // 移除目标mesh
    function removeTargetMesh(mesh: THREE.Mesh) {
        const idx = targetMeshes.indexOf(mesh);
        if (idx === -1) return;
        targetMeshes.splice(idx, 1);

        const ov = overlays.splice(idx, 1)[0];
        if (ov) scene.remove(ov);

        const proxy = depthProxies.splice(idx, 1)[0];
        if (proxy) depthScene.remove(proxy);

        _lastMeshMatrices.splice(idx, 1);
    }

    // 同步远裁剪面位置与朝向
    function updateFarPlaneTransform() {
        if (!farPlaneOverlay) return;
        projCam.getWorldDirection(_farPlaneDir);
        farPlaneOverlay.position.copy(projCam.position).addScaledVector(_farPlaneDir, projCam.far * 0.9);
        farPlaneOverlay.quaternion.copy(projCam.quaternion);
        farPlaneOverlay.updateMatrix();
    }

    // 创建/销毁远裁剪面 overlay（showFarPlane 变化时调用）
    function buildFarPlaneOverlay() {
        if (farPlaneOverlay) {
            scene.remove(farPlaneOverlay);
            farPlaneGeometry?.dispose();
            farPlaneOverlay = null;
            farPlaneGeometry = null;
        }
        if (!showFarPlane) return;
        const fovRad = THREE.MathUtils.degToRad(projCam.fov);
        const h = 2 * Math.tan(fovRad / 2) * projCam.far * 0.9;
        const w = h * projCam.aspect;
        farPlaneGeometry = new THREE.PlaneGeometry(w, h);
        farPlaneOverlay = new THREE.Mesh(farPlaneGeometry, farPlaneMat);
        farPlaneOverlay.matrixAutoUpdate = false;
        updateFarPlaneTransform();
        scene.add(farPlaneOverlay);
    }

    // 每帧调用
    function update() {
        if (enableOcclusionCulling) {
            for (let i = 0; i < targetMeshes.length; i++) {
                const src = targetMeshes[i];
                src.updateMatrixWorld(true);
                depthProxies[i].matrix.copy(src.matrixWorld);
            }

            renderer.setRenderTarget(projectorDepthRT);
            renderer.clear();
            renderer.render(depthScene, projCam);
            renderer.setRenderTarget(null);

            projectorUniforms.projectorDepthMap.value = projectorDepthRT.depthTexture;
        }

        const _camMoved = !_lastProjCamMatrix.equals(projCam.matrixWorld);
        const _projChanged = !_lastProjCamProjectionMatrix.equals(projCam.projectionMatrix);
        if (_camMoved || _projChanged) {
            _tmpProjMatrix.multiplyMatrices(
                projCam.projectionMatrix,
                projCam.matrixWorldInverse
            );
            projectorUniforms.projectorMatrix.value.copy(_tmpProjMatrix);
            _lastProjCamMatrix.copy(projCam.matrixWorld);
            _lastProjCamProjectionMatrix.copy(projCam.projectionMatrix);
            // projectionMatrix 变化（fov/near/far）时需重建几何体，否则只更新位置朝向
            if (_projChanged) {
                buildFarPlaneOverlay();
            } else {
                updateFarPlaneTransform();
            }
        }

        for (let i = 0; i < targetMeshes.length; i++) {
            const src = targetMeshes[i];
            src.updateMatrixWorld(true);
            if (!_lastMeshMatrices[i].equals(src.matrixWorld)) {
                overlays[i].matrix.copy(src.matrixWorld);
                _lastMeshMatrices[i].copy(src.matrixWorld);
            }
        }
    }

    // 销毁
    function dispose() {
        for (let ov of overlays) scene.remove(ov);
        for (let p of depthProxies) depthScene.remove(p);
        overlays.length = 0;
        depthProxies.length = 0;
        targetMeshes.length = 0;

        if (farPlaneOverlay) scene.remove(farPlaneOverlay);
        farPlaneGeometry?.dispose();
        farPlaneMat.dispose();
        projectorMat.dispose();
        depthMaterial.dispose();
        try {
            projectorDepthRT.dispose();
        } catch (e) { }
        try {
            videoTexture.dispose();
        } catch (e) { }

        if (camHelper) {
            try {
                scene.remove(camHelper);
            } catch (e) { }
            camHelper = null;
        }
    }

    // 更新相机朝向及旋转角
    function applyOrientationFromAngles() {
        const az = THREE.MathUtils.degToRad(orientParams.azimuthDeg);
        const el = THREE.MathUtils.degToRad(orientParams.elevationDeg);
        const dir = new THREE.Vector3(
            Math.cos(el) * Math.cos(az),
            Math.sin(el),
            Math.cos(el) * Math.sin(az)
        ).normalize();
        const lookTarget = new THREE.Vector3().copy(projCam.position).add(dir);
        projCam.up.set(0, 1, 0);
        projCam.lookAt(lookTarget);
        projCam.updateMatrixWorld(true);
        const rollRad = THREE.MathUtils.degToRad(orientParams.rollDeg);
        projCam.rotateOnAxis(new THREE.Vector3(0, 0, 1), rollRad);
        projCam.updateMatrixWorld(true);
        if (camHelper) camHelper.update();
    }

    const tool = {
        addTargetMesh,
        removeTargetMesh,
        update,
        dispose,
        uniforms: projectorUniforms,
        overlays,
        targetMeshes,
        projCam,
        camHelper,
        orientationParams: orientParams,
    };

    Object.defineProperties(tool, {
        // 方位角
        azimuthDeg: {
            get: () => orientParams.azimuthDeg,
            set: (deg: number) => {
                orientParams.azimuthDeg = deg;
                applyOrientationFromAngles();
            },
            enumerable: true,
        },
        // 俯仰角
        elevationDeg: {
            get: () => orientParams.elevationDeg,
            set: (deg: number) => {
                orientParams.elevationDeg = deg;
                applyOrientationFromAngles();
            },
            enumerable: true,
        },
        // 横滚角
        rollDeg: {
            get: () => orientParams.rollDeg,
            set: (deg: number) => {
                orientParams.rollDeg = deg;
                applyOrientationFromAngles();
            },
            enumerable: true,
        },
        // 透明度
        opacity: {
            get: () => projectorUniforms.opacity.value,
            set: (v: number) => {
                projectorUniforms.opacity.value = Math.max(0, Math.min(1, v));
            },
            enumerable: true,
        },
        // 裁剪区域（UV空间，[x0, y0, x1, y1]，范围 0~1）
        cropRect: {
            get: () => {
                const v = projectorUniforms.cropRect.value;
                return [v.x, v.y, v.z, v.w];
            },
            set: (rect: [number, number, number, number]) => {
                projectorUniforms.cropRect.value.set(
                    rect[0],
                    rect[1],
                    rect[2],
                    rect[3]
                );
            },
            enumerable: true,
        },
        // 遮挡剔除开关
        enableOcclusionCulling: {
            get: () => enableOcclusionCulling,
            set: (v: boolean) => {
                enableOcclusionCulling = v;
                projectorUniforms.enableOcclusionCulling.value = v;
            },
            enumerable: true,
        },
        // 远裁剪面投影开关
        showFarPlane: {
            get: () => showFarPlane,
            set: (v: boolean) => {
                showFarPlane = v;
                buildFarPlaneOverlay();
            },
            enumerable: true,
        },
        // 四角点变换（投影UV空间，顺序：左下、右下、右上、左上）
        quadCorners: {
            set: (
                corners: [
                    [number, number],
                    [number, number],
                    [number, number],
                    [number, number],
                ]
            ) => {
                projectorUniforms.quadHomography.value.copy(
                    computeQuadHomography(corners)
                );
            },
            enumerable: true,
        },
    });

    return tool as ThreeProjectorTool;
}
