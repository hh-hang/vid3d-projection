varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}