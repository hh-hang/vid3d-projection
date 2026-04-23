/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.140.0
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  Cesium3DTilesTerrainGeometryProcessor_default
} from "./chunk-UQU4RXLT.js";
import "./chunk-7O5XJTVE.js";
import "./chunk-NKT5K3K3.js";
import {
  createTaskProcessorWorker_default
} from "./chunk-AMIHNSST.js";
import "./chunk-DVB56LG7.js";
import "./chunk-BJD6QGXZ.js";
import "./chunk-72VYSVEW.js";
import "./chunk-Y7HNNPNK.js";
import "./chunk-44EMEGKW.js";
import "./chunk-6WLHJFD3.js";
import "./chunk-JCI63T3K.js";
import "./chunk-AF3MU2RL.js";
import "./chunk-HRHRYFHS.js";
import "./chunk-YQFTYQMZ.js";
import "./chunk-YJZGW74L.js";
import "./chunk-HKUES6UG.js";
import "./chunk-ILMFADZA.js";
import "./chunk-PVV64VFW.js";
import "./chunk-EDXL4W76.js";
import "./chunk-GOQBUCXH.js";
import "./chunk-ZBZRTRJB.js";
import "./chunk-5GXYJQ2K.js";
import "./chunk-VLDEUTOP.js";
import "./chunk-AJLTU6PF.js";

// packages/engine/Source/Workers/createVerticesFromCesium3DTilesTerrain.js
function createVerticesFromCesium3DTilesTerrain(options, transferableObjects) {
  const meshPromise = Cesium3DTilesTerrainGeometryProcessor_default.createMesh(options);
  return meshPromise.then(function(mesh) {
    const verticesBuffer = mesh.vertices.buffer;
    const indicesBuffer = mesh.indices.buffer;
    const westIndicesBuffer = mesh.westIndicesSouthToNorth.buffer;
    const southIndicesBuffer = mesh.southIndicesEastToWest.buffer;
    const eastIndicesBuffer = mesh.eastIndicesNorthToSouth.buffer;
    const northIndicesBuffer = mesh.northIndicesWestToEast.buffer;
    transferableObjects.push(
      verticesBuffer,
      indicesBuffer,
      westIndicesBuffer,
      southIndicesBuffer,
      eastIndicesBuffer,
      northIndicesBuffer
    );
    return {
      verticesBuffer,
      indicesBuffer,
      vertexCountWithoutSkirts: mesh.vertexCountWithoutSkirts,
      indexCountWithoutSkirts: mesh.indexCountWithoutSkirts,
      encoding: mesh.encoding,
      westIndicesBuffer,
      southIndicesBuffer,
      eastIndicesBuffer,
      northIndicesBuffer
    };
  });
}
var createVerticesFromCesium3DTilesTerrain_default = createTaskProcessorWorker_default(
  createVerticesFromCesium3DTilesTerrain
);
export {
  createVerticesFromCesium3DTilesTerrain_default as default
};
