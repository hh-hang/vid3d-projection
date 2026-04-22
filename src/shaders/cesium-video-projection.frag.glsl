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

// 采样阴影图
float _czm_sampleShadowMap(sampler2D shadowMap, vec2 uv) {
    return texture(shadowMap, uv).r;
}

// 比较深度值
float _czm_shadowDepthCompare(sampler2D shadowMap, vec2 uv, float depth) {
    return step(depth, _czm_sampleShadowMap(shadowMap, uv));
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
            visibility += _czm_shadowDepthCompare(shadowMap, uv + offset, depth);
            sampleCount += 1.0;
        }
    }
    return visibility / sampleCount;
}

// 计算边缘羽化强度
float getFeatherAlpha(vec2 uv, float featherAmount) {
    float edgeDist = min(uv.x, 1.0 - uv.x);
    edgeDist = min(edgeDist, min(uv.y, 1.0 - uv.y));
    return smoothstep(0.0, featherAmount, edgeDist);
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
    vec4 videoColor = texture(videoTexture, shadowPosition.xy);
    float featherAlpha = getFeatherAlpha(shadowPosition.xy, featherAmount);

    // 输出
    if (visibility == 1.0) {
        // 可见区域
        czm_FragColor = mix(color, vec4(videoColor.rgb * intensity, 1.0), opacity * featherAlpha);
    } else {
        // 不可见区域
        czm_FragColor = color;
    }
}