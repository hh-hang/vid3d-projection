precision highp float;

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

uniform float opacity;
uniform float intensity;
uniform float projBias;
uniform sampler2D shadowMapTexture;
uniform sampler2D videoTexture;
uniform mat4 shadowMapMatrix;
uniform vec4 shadowMap_texelSizeDepthBiasAndNormalShadingSmooth;
uniform float featherAmount;
uniform vec4 cropRect;
uniform mat3 quadHomography;

in vec2 v_textureCoordinates;
out vec4 czm_FragColor;

// 将屏幕坐标和深度转换为相机空间坐标
vec4 toEye(in vec2 uv, in float depth) {
    vec2 xy = vec2(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0);
    vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
    return posInCamera / posInCamera.w;
}

// 获取深度值
float getDepth(in vec4 depth) {
    float z_window = czm_unpackDepth(depth);
    z_window = czm_reverseLogDepth(z_window);
    float n_range = czm_depthRange.near;
    float f_range = czm_depthRange.far;
    return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
}

// 计算阴影可见性
float _czm_shadowVisibility(sampler2D shadowMap, czm_shadowParameters shadowParameters) {
    float depthBias = shadowParameters.depthBias;
    float depth = shadowParameters.depth;
    vec2 uv = shadowParameters.texCoords;
    vec2 texelStepSize = shadowParameters.texelStepSize;

    depth -= depthBias;
    float radius = 1.0;
    float visibility = 0.0;
    float sampleCount = 0.0;

    // 采样求均值
    for (float x = -radius; x <= radius; x += 1.0) {
        for (float y = -radius; y <= radius; y += 1.0) {
            vec2 offset = vec2(x * texelStepSize.x, y * texelStepSize.y);
            // 检查是否超出范围
            visibility += step(depth, texture(shadowMap, uv + offset).r);
            sampleCount += 1.0;
        }
    }
    return visibility / sampleCount;
}

void main() {
    vec4 color = texture(colorTexture, v_textureCoordinates);
    vec4 currD = texture(depthTexture, v_textureCoordinates);

    // 重建视空间坐标
    float depth = getDepth(currD);
    vec4 positionEC = toEye(v_textureCoordinates, depth);
    // 填充阴影参数
    czm_shadowParameters shadowParameters;
    shadowParameters.texelStepSize = shadowMap_texelSizeDepthBiasAndNormalShadingSmooth.xy;
    shadowParameters.depthBias = shadowMap_texelSizeDepthBiasAndNormalShadingSmooth.z;
    shadowParameters.depthBias *= max(depth * 0.01, 1.0);

    // 投影到阴影图空间，并应用深度偏移
    vec4 shadowPosition = shadowMapMatrix * positionEC;
    shadowPosition /= shadowPosition.w;
    shadowPosition.z -= projBias;

    // 填充阴影参数
    shadowParameters.texCoords = shadowPosition.xy;
    shadowParameters.depth = shadowPosition.z;

    // 可见性与纹理采样
    float visibility = _czm_shadowVisibility(shadowMapTexture, shadowParameters);

    // 应用四角变换
    vec3 projCoords = vec3(shadowPosition.xy, 1.0);
    projCoords = quadHomography * projCoords;
    projCoords /= projCoords.z;

    // 检查裁剪区域
    if (projCoords.x < cropRect.x || projCoords.x > cropRect.z || projCoords.y < cropRect.y || projCoords.y > cropRect.w) {
        czm_FragColor = color;
        return;
    }

    vec4 videoColor = texture(videoTexture, projCoords.xy);

    // 计算边缘羽化
    float distX = min(projCoords.x - cropRect.x, cropRect.z - projCoords.x);
    float distY = min(projCoords.y - cropRect.y, cropRect.w - projCoords.y);
    float minDist = min(distX, distY);
    float edgeFactor = featherAmount > 0.0 ? smoothstep(0.0, featherAmount, minDist) : 1.0;

    // 输出
    if (visibility == 1.0) {
        // 可见区域
        czm_FragColor = mix(color, vec4(videoColor.rgb * intensity, 1.0), opacity * edgeFactor);
    } else {
        // 不可见区域
        czm_FragColor = color;
    }
}