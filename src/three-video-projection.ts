import * as THREE from "three";
import vertexShader from "./shaders/three-video-projection.vert.glsl";
import fragmentShader from "./shaders/three-video-projection.frag.glsl";

/**
 * 由四角点计算Homography矩阵的逆矩阵（投影UV空间 -> 视频UV空间）
 * 返回 3x3 矩阵的 9 个元素数组 (行优先)
 */
export function computeQuadHomographyElements(
    corners: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ]
): number[] {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
    const dx1 = x1 - x2,
        dy1 = y1 - y2;
    const dx2 = x3 - x2,
        dy2 = y3 - y2;
    const dx3 = x0 - x1 + x2 - x3,
        dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const pg = (dx3 * dy2 - dx2 * dy3) / den;
    const ph = (dx1 * dy3 - dx3 * dy1) / den;

    const m00 = x1 - x0 + pg * x1,
        m01 = x3 - x0 + ph * x3,
        m02 = x0;
    const m10 = y1 - y0 + pg * y1,
        m11 = y3 - y0 + ph * y3,
        m12 = y0;
    const m20 = pg,
        m21 = ph,
        m22 = 1;

    const det =
        m00 * (m11 * m22 - m12 * m21) -
        m01 * (m10 * m22 - m12 * m20) +
        m02 * (m10 * m21 - m11 * m20);

    return [
        (m11 * m22 - m12 * m21) / det,
        -(m01 * m22 - m02 * m21) / det,
        (m01 * m12 - m02 * m11) / det,
        -(m10 * m22 - m12 * m20) / det,
        (m00 * m22 - m02 * m20) / det,
        -(m00 * m12 - m02 * m10) / det,
        (m10 * m21 - m11 * m20) / det,
        -(m00 * m21 - m01 * m20) / det,
        (m00 * m11 - m01 * m10) / det,
    ];
}

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
    };

    const projectorMat = new THREE.ShaderMaterial({
        uniforms: projectorUniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
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
    depthMaterial.side = THREE.FrontSide;

    const overlays: THREE.Mesh[] = [];
    const targetMeshes: THREE.Mesh[] = [];
    const depthProxies: THREE.Mesh[] = [];

    update();

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
        depthScene.add(proxy);

        overlays.push(overlay);
        depthProxies.push(proxy);

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
    }

    // 每帧调用
    function update() {
        for (let i = 0; i < targetMeshes.length; i++) {
            const src = targetMeshes[i];
            const proxy = depthProxies[i];
            src.updateMatrixWorld(true);
            proxy.matrix.copy(src.matrixWorld);
        }

        renderer.setRenderTarget(projectorDepthRT);
        renderer.clear();
        renderer.render(depthScene, projCam);
        renderer.setRenderTarget(null);

        projectorUniforms.projectorDepthMap.value =
            projectorDepthRT.depthTexture;

        const projectorMatrix = new THREE.Matrix4();
        projectorMatrix.multiplyMatrices(
            projCam.projectionMatrix,
            projCam.matrixWorldInverse
        );
        projectorUniforms.projectorMatrix.value.copy(projectorMatrix);

        for (let i = 0; i < targetMeshes.length; i++) {
            const src = targetMeshes[i];
            const overlay = overlays[i];
            src.updateMatrixWorld(true);
            overlay.matrix.copy(src.matrixWorld);
        }
    }

    // 销毁
    function dispose() {
        for (let ov of overlays) scene.remove(ov);
        for (let p of depthProxies) depthScene.remove(p);
        overlays.length = 0;
        depthProxies.length = 0;
        targetMeshes.length = 0;

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
