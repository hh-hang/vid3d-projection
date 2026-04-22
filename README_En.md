[中文](README.md)

⭐ Open source is hard work — give it a star if you like it! ⭐

---

# vid3d-projection

[![NPM Package][npm]][npm-url]

A spatial video projection utility for **Three.js** and **Cesium.js**.

> This tool supports:
> - Three.js: Projects `THREE.VideoTexture` from a projection camera onto target models in the scene, with support for depth-based occlusion, edge feathering, intensity and opacity controls, and more.
> - Cesium.js: Enables video projection in 3D globe scenes, supporting geographic coordinate positioning and projection transformations.

---

## Live Demo

Click on the images to view the live demos:

### Three.js Video Fusion

[![Three.js Video Fusion](https://raw.githubusercontent.com/hh-hang/vid3d-projection/main/example/public/imgs/2.gif "Click to view Three.js Video Fusion demo")](https://hh-hang.github.io/vid3d-projection/three-monitor.html)

### Three.js Cinema

[![Three.js Cinema](https://raw.githubusercontent.com/hh-hang/vid3d-projection/main/example/public/imgs/1.gif "Click to view Cinema demo")](https://hh-hang.github.io/vid3d-projection/three-cinema.html)

### Cesium.js Video Fusion

[![Cesium.js Video Fusion](https://raw.githubusercontent.com/hh-hang/vid3d-projection/main/example/public/imgs/3.gif "Click to view Cesium.js Video Fusion demo")](https://hh-hang.github.io/vid3d-projection/cesium-monitor.html)

---

## Run Examples Locally

```bash
# Clone the repository
git clone https://github.com/hh-hang/vid3d-projection.git

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open your browser and visit `http://localhost:5173` to view the examples.

---

## Installation

```bash
npm install vid3d-projection
```

## Quick start

### Three.js Example

```ts
import * as THREE from "three";
import { createThreeVideoProjector } from "vid3d-projection/three";

// Create a video element and a VideoTexture
const video = document.createElement("video");
video.src = "path/to/video.mp4";
video.loop = true;
video.muted = true;
video.playsInline = true;
await video.play();
const videoTexture = new THREE.VideoTexture(video);

// Note: you can also use a video stream as long as a VideoTexture is successfully created.

// Create the projector
const projector = await createThreeVideoProjector({
  scene, // three.js Scene
  renderer, // three.js WebGLRenderer
  videoTexture, // the video texture to project
  projCamPosition: [2, 2, 2], // projector camera world position
  projCamParams: { fov: 30, aspect: 1, near: 0.5, far: 50 }, // projector camera params
  orientationParams: { azimuthDeg: 180, elevationDeg: -10, rollDeg: 0 }, // azimuth / elevation / roll in degrees
  intensity: 1.0, // projection color intensity
  opacity: 1.0, // projection opacity
  projBias: 0.0001, // depth bias
  edgeFeather: 0.05, // edge feather amount
  cropRect: [0, 0, 1, 1], // crop region in UV space [x0, y0, x1, y1], range 0–1
  quadCorners: [[0, 0], [1, 0], [1, 1], [0, 1]], // quad corner warp (projection UV space, order: bottom-left, bottom-right, top-right, top-left)
  isShowHelper: true, // show CameraHelper for the projector
});

// Add meshes to be projected onto
projector.addTargetMesh(Mesh1);
projector.addTargetMesh(Mesh2);
...

// Rendering loop
function animate() {
  // ... update scene, controls, etc.
  projector.update(); //( If the model position and projection parameters are fixed, there is no need to call the update() function. )
}
animate();

// Dispose when done
projector.dispose();
```

### Cesium.js Example

```ts
import * as Cesium from "cesium";
import { createCesiumVideoProjector } from "vid3d-projection/cesium";

// Create a video element
const video = document.createElement("video");
video.src = "path/to/video.mp4";
video.loop = true;
video.muted = true;
video.playsInline = true;
await video.play();

// Create Cesium viewer
const viewer = new Cesium.Viewer("cesiumContainer");

// Create the projector
const projector = await createCesiumVideoProjector({
  viewer, // Cesium Viewer instance
  video, // video element
  position: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 100), // projection position (longitude, latitude, height)
  orientation: {
    heading: Cesium.Math.toRadians(0), // heading angle
    pitch: Cesium.Math.toRadians(-30), // pitch angle
    roll: 0 // roll angle
  },
  fov: 45, // field of view
  aspectRatio: 16 / 9, // aspect ratio
  intensity: 1.0, // projection intensity
  opacity: 1.0, // projection opacity
  edgeFeather: 0.05, // edge feather amount
});

// Dispose when done
projector.dispose();
```

---

## API

### Three.js API

#### `createThreeVideoProjector(opts: ThreeProjectorToolOptions): Promise<ThreeProjectorTool>`

##### `ThreeProjectorToolOptions`

- `scene: THREE.Scene` — the three.js scene (required).
- `renderer: THREE.WebGLRenderer` — the renderer (required).
- `videoTexture: THREE.VideoTexture` — the video texture to project (required).
- `projCamPosition?: [number, number, number]` — projector camera world position. Default: `[0, 0, 0]`.
- `projCamParams?: { fov?: number; aspect?: number; near?: number; far?: number }` — projector camera params. Default: `{ fov: 30, aspect: 1, near: 0.5, far: 50 }`.
- `orientationParams?: { azimuthDeg?: number; elevationDeg?: number; rollDeg?: number }` — azimuth / elevation / roll in degrees. Defaults: `0` for each.
- `depthSize?: number` — resolution (width/height) of the depth render target. Default: `1024`.
- `intensity?: number` — projection color intensity. Default: `1.0`.
- `opacity?: number` — global opacity (0–1). Default: `1.0`.
- `projBias?: number` — depth bias. Default: `0.0001`.
- `edgeFeather?: number` — edge feather width. Default: `0.05`.
- `cropRect?: [number, number, number, number]` — crop region of the video texture in UV space `[x0, y0, x1, y1]`, range `0–1`. Default: `[0, 0, 1, 1]` (no crop).
- `quadCorners?: [[number, number], [number, number], [number, number], [number, number]]` — four-corner warp in projection UV space (order: bottom-left, bottom-right, top-right, top-left), used for keystone/perspective correction. Default: unit square.
- `isShowHelper?: boolean` — show a `CameraHelper` to visualize the projector camera. Default: `true`.

##### `ThreeProjectorTool` (returned object)

**Methods:**

- `addTargetMesh(mesh: THREE.Mesh): void` — add a target mesh to the projection list. The tool creates an overlay mesh (for projection) and a depth proxy (for depth rendering) in the scene.
- `removeTargetMesh(mesh: THREE.Mesh): void` — remove a mesh from the projection list and clean up associated resources.
- `update(): void` — call each frame to update the depth render target, projector matrix, and sync overlays' matrices.
- `dispose(): void` — destroy internal resources and remove created objects from the scene.
- `updateAzimuthDeg(deg: number): void` — set the azimuth (degrees) on the projector camera.
- `updateElevationDeg(deg: number): void` — set the elevation (degrees).
- `updateRollDeg(deg: number): void` — set the roll (degrees).
- `updateOpacity(opacity: number): void` — update projection opacity (0–1).
- `updateCropRect(rect: [number, number, number, number]): void` — dynamically update the crop region (UV space, `[x0, y0, x1, y1]`).
- `updateQuadCorners(corners: [[number, number], [number, number], [number, number], [number, number]]): void` — dynamically update the four-corner warp (projection UV space, order: bottom-left, bottom-right, top-right, top-left).

**Properties:**

- `uniforms` — exposed shader uniform object (contains `projectorMap`, `projectorDepthMap`, `projectorMatrix`, `intensity`, `projBias`, `edgeFeather`, `opacity`, `cropRect`, `quadHomography`, etc.).
- `overlays: THREE.Mesh[]` — list of internal overlay meshes (used for rendering the projection).
- `targetMeshes: THREE.Mesh[]` — current list of meshes being projected onto.
- `projCam: THREE.PerspectiveCamera` — the projector camera.
- `camHelper: THREE.CameraHelper | null` — optional CameraHelper instance.
- `orientationParams` — current azimuth/elevation/roll (degrees).

### Cesium API

#### `createCesiumVideoProjector(opts: CesiumProjectorOptions): Promise<CesiumProjectorTool>`

##### `CesiumProjectorOptions`

- `viewer: Cesium.Viewer` — Cesium Viewer instance (required).
- `video: HTMLVideoElement` — video element (required).
- `position: Cesium.Cartesian3` — projection position (required).
- `orientation: { heading: number; pitch: number; roll: number }` — projection orientation (radians).
- `fov: number` — field of view (degrees), default `45`.
- `aspectRatio: number` — aspect ratio, default `16/9`.
- `intensity: number` — projection intensity, default `1.0`.
- `opacity: number` — projection opacity, default `1.0`.
- `edgeFeather: number` — edge feather amount, default `0.05`.

##### `CesiumProjectorTool` (returned object)

**Methods:**

- `updatePosition(position: Cesium.Cartesian3): void` — update projection position.
- `updateOrientation(orientation: { heading: number; pitch: number; roll: number }): void` — update projection orientation.
- `updateOpacity(opacity: number): void` — update projection opacity.
- `dispose(): void` — destroy projector and clean up resources.

---

[npm]: https://img.shields.io/npm/v/vid3d-projection
[npm-url]: https://www.npmjs.com/package/vid3d-projection