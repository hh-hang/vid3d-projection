import * as THREE from "three";

// 由四角点计算Homography矩阵（投影UV空间 → 视频UV空间）
// corners 顺序：左下、右下、右上、左上，对应视频UV的 (0,0)(1,0)(1,1)(0,1)
function computeQuadHomography(
  corners: [[number, number], [number, number], [number, number], [number, number]],
): THREE.Matrix3 {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dy1 = y1 - y2;
  const dx2 = x3 - x2, dy2 = y3 - y2;
  const dx3 = x0 - x1 + x2 - x3, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const pg = (dx3 * dy2 - dx2 * dy3) / den;
  const ph = (dx1 * dy3 - dx3 * dy1) / den;
  // 单位正方形到四边形的变换矩阵H
  const m00 = x1 - x0 + pg * x1, m01 = x3 - x0 + ph * x3, m02 = x0;
  const m10 = y1 - y0 + pg * y1, m11 = y3 - y0 + ph * y3, m12 = y0;
  const m20 = pg, m21 = ph, m22 = 1;
  // 求逆矩阵（四边形到单位正方形）
  const det =
    m00 * (m11 * m22 - m12 * m21) -
    m01 * (m10 * m22 - m12 * m20) +
    m02 * (m10 * m21 - m11 * m20);
  const inv = new THREE.Matrix3();
  inv.set(
    (m11 * m22 - m12 * m21) / det, -(m01 * m22 - m02 * m21) / det, (m01 * m12 - m02 * m11) / det,
    -(m10 * m22 - m12 * m20) / det, (m00 * m22 - m02 * m20) / det, -(m00 * m12 - m02 * m10) / det,
    (m10 * m21 - m11 * m20) / det, -(m00 * m21 - m01 * m20) / det, (m00 * m11 - m01 * m10) / det,
  );
  return inv;
}

export type ProjectorToolOptions = {
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
  quadCorners?: [[number, number], [number, number], [number, number], [number, number]];
  isShowHelper?: boolean;
};

export type ProjectorTool = {
  addTargetMesh: (mesh: THREE.Mesh) => void;
  removeTargetMesh: (mesh: THREE.Mesh) => void;
  update: () => void;
  dispose: () => void;
  updateAzimuthDeg: (deg: number) => void;
  updateElevationDeg: (deg: number) => void;
  updateRollDeg: (deg: number) => void;
  updateOpacity: (opacity: number) => void;
  updateCropRect: (rect: [number, number, number, number]) => void;
  updateQuadCorners: (corners: [[number, number], [number, number], [number, number], [number, number]]) => void;
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
};

export async function createVideoProjector(
  opts: ProjectorToolOptions,
): Promise<ProjectorTool> {
  const {
    scene,
    renderer,
    videoTexture,
    projCamPosition = [0, 0, 0],
    projCamParams = { fov: 30, aspect: 1, near: 0.5, far: 50 },
    orientationParams = { azimuthDeg: 0, elevationDeg: 0, rollDeg: 0 },
    depthSize = 1024,
    intensity = 1.0,
    opacity = 1.0,
    projBias = 0.0001,
    edgeFeather = 0.05,
    cropRect = [0, 0, 1, 1] as [number, number, number, number],
    quadCorners = [[0, 0], [1, 0], [1, 1], [0, 1]] as [[number, number], [number, number], [number, number], [number, number]],
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
    projCamParams.near ?? 0.5,
    projCamParams.far ?? 50,
  );
  projCam.position.set(
    projCamPosition[0],
    projCamPosition[1],
    projCamPosition[2],
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
    cropRect: { value: new THREE.Vector4(cropRect[0], cropRect[1], cropRect[2], cropRect[3]) },
    quadHomography: { value: computeQuadHomography(quadCorners) },
  };

  const vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

  const fragmentShader = `
      uniform sampler2D projectorMap;
      uniform sampler2D projectorDepthMap;
      uniform mat4 projectorMatrix;
      uniform float intensity;
      uniform float projBias;
      uniform float edgeFeather;
      uniform float opacity;
      uniform vec4 cropRect;
      uniform mat3 quadHomography;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 projPos = projectorMatrix * vec4(vWorldPos, 1.0);
        if (projPos.w <= 0.0) discard;
        vec2 uv = projPos.xy / projPos.w * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

        // 遮挡剔除
        float projNDCz = projPos.z / projPos.w;
        float projDepth01 = projNDCz * 0.5 + 0.5;
        float sceneDepth01 = texture(projectorDepthMap, uv).x;
        if (projDepth01 > sceneDepth01 + projBias) {
          discard;
        }

        // 四角点变换（投影UV → 视频纹理UV）
        vec3 hw = quadHomography * vec3(uv, 1.0);
        vec2 warpedUV = hw.xy / hw.z;

        // 自定义裁剪及羽化
        vec2 cropMin = cropRect.xy;
        vec2 cropMax = cropRect.zw;
        if (warpedUV.x < cropMin.x || warpedUV.x > cropMax.x || warpedUV.y < cropMin.y || warpedUV.y > cropMax.y) discard;
        float distX = min(warpedUV.x - cropMin.x, cropMax.x - warpedUV.x);
        float distY = min(warpedUV.y - cropMin.y, cropMax.y - warpedUV.y);
        float minDist = min(distX, distY);
        float edgeFactor = 1.0;
        if (edgeFeather > 0.0) {
            edgeFactor = smoothstep(0.0, edgeFeather, minDist);
        }
        vec4 color = texture(projectorMap, warpedUV);
        float effectiveAlpha = color.a * edgeFactor;

        // 输出
        vec3 outRGB = color.rgb * intensity * edgeFactor * opacity;
        float outA = effectiveAlpha * opacity;
        gl_FragColor = vec4(outRGB, outA);
      }
    `;

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
    THREE.UnsignedShortType,
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

    projectorUniforms.projectorDepthMap.value = projectorDepthRT.depthTexture;

    const projectorMatrix = new THREE.Matrix4();
    projectorMatrix.multiplyMatrices(
      projCam.projectionMatrix,
      projCam.matrixWorldInverse,
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
    } catch (e) {}
    try {
      videoTexture.dispose();
    } catch (e) {}

    if (camHelper) {
      try {
        scene.remove(camHelper);
      } catch (e) {}
      camHelper = null;
    }
  }

  // 更新方位角
  function updateAzimuthDeg(deg: number) {
    orientParams.azimuthDeg = deg;
    applyOrientationFromAngles();
  }

  // 更新俯仰角
  function updateElevationDeg(deg: number) {
    orientParams.elevationDeg = deg;
    applyOrientationFromAngles();
  }

  // 更新滚转角
  function updateRollDeg(deg: number) {
    orientParams.rollDeg = deg;
    applyOrientationFromAngles();
  }

  // 更新相机朝向及旋转角
  function applyOrientationFromAngles() {
    const az = THREE.MathUtils.degToRad(orientParams.azimuthDeg);
    const el = THREE.MathUtils.degToRad(orientParams.elevationDeg);
    const dir = new THREE.Vector3(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az),
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

  // 更新透明度
  function updateOpacity(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    projectorUniforms.opacity.value = clamped;
  }

  // 更新裁剪区域（UV空间，[x0, y0, x1, y1]，范围 0~1）
  function updateCropRect(rect: [number, number, number, number]) {
    projectorUniforms.cropRect.value.set(rect[0], rect[1], rect[2], rect[3]);
  }

  // 更新四角点变换（投影UV空间，顺序：左下、右下、右上、左上）
  function updateQuadCorners(
    corners: [[number, number], [number, number], [number, number], [number, number]],
  ) {
    projectorUniforms.quadHomography.value.copy(computeQuadHomography(corners));
  }

  return {
    addTargetMesh,
    removeTargetMesh,
    update,
    dispose,
    updateAzimuthDeg,
    updateElevationDeg,
    updateRollDeg,
    updateOpacity,
    updateCropRect,
    updateQuadCorners,
    uniforms: projectorUniforms,
    overlays,
    targetMeshes,
    projCam,
    camHelper,
    orientationParams: orientParams,
  };
}
