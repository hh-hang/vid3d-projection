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
  EllipseGeometry_default
} from "./chunk-EV3VGO6Y.js";
import "./chunk-Q3C6VQH6.js";
import "./chunk-XY6HMDGI.js";
import "./chunk-5A2SW66E.js";
import "./chunk-72VYSVEW.js";
import "./chunk-ISY4EZCA.js";
import "./chunk-UIGVOKKI.js";
import "./chunk-LXMCPFFS.js";
import "./chunk-6WLHJFD3.js";
import "./chunk-JCI63T3K.js";
import "./chunk-AF3MU2RL.js";
import "./chunk-6MPGQEHA.js";
import "./chunk-7TYLCBGK.js";
import "./chunk-HRHRYFHS.js";
import "./chunk-YQFTYQMZ.js";
import "./chunk-YJZGW74L.js";
import "./chunk-HKUES6UG.js";
import "./chunk-ILMFADZA.js";
import "./chunk-PVV64VFW.js";
import "./chunk-EDXL4W76.js";
import {
  Ellipsoid_default
} from "./chunk-GOQBUCXH.js";
import {
  Cartesian3_default
} from "./chunk-ZBZRTRJB.js";
import "./chunk-5GXYJQ2K.js";
import "./chunk-VLDEUTOP.js";
import {
  defined_default
} from "./chunk-AJLTU6PF.js";

// packages/engine/Source/Workers/createEllipseGeometry.js
function createEllipseGeometry(ellipseGeometry, offset) {
  if (defined_default(offset)) {
    ellipseGeometry = EllipseGeometry_default.unpack(ellipseGeometry, offset);
  }
  ellipseGeometry._center = Cartesian3_default.clone(ellipseGeometry._center);
  ellipseGeometry._ellipsoid = Ellipsoid_default.clone(ellipseGeometry._ellipsoid);
  return EllipseGeometry_default.createGeometry(ellipseGeometry);
}
var createEllipseGeometry_default = createEllipseGeometry;
export {
  createEllipseGeometry_default as default
};
