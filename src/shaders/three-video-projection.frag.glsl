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

    // 深度遮挡剔除
    float projNDCz = projPos.z / projPos.w;
    float projDepth01 = projNDCz * 0.5 + 0.5;
    float sceneDepth01 = texture(projectorDepthMap, uv).x;
    if (projDepth01 > sceneDepth01 + projBias) discard;

    // 四角点变换（投影UV -> 视频纹理UV）
    vec3 hw = quadHomography * vec3(uv, 1.0);
    vec2 warpedUV = hw.xy / hw.z;

    // 裁剪区域判断
    vec2 cropMin = cropRect.xy;
    vec2 cropMax = cropRect.zw;
    if (warpedUV.x < cropMin.x || warpedUV.x > cropMax.x || warpedUV.y < cropMin.y || warpedUV.y > cropMax.y) discard;

    // 计算边缘羽化
    float distX = min(warpedUV.x - cropMin.x, cropMax.x - warpedUV.x);
    float distY = min(warpedUV.y - cropMin.y, cropMax.y - warpedUV.y);
    float minDist = min(distX, distY);
    float edgeFactor = edgeFeather > 0.0 ? smoothstep(0.0, edgeFeather, minDist) : 1.0;

    vec4 color = texture(projectorMap, warpedUV);
    vec3 outRGB = color.rgb * intensity * edgeFactor * opacity;
    float outA = color.a * edgeFactor * opacity;
    gl_FragColor = vec4(outRGB, outA);
}