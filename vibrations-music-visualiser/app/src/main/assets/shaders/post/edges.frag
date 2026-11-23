// Edge map for Neon. Sobel on luminance (+ alpha, so logos outline) sampled at a fixed
// "structure" scale via mipmaps, so a busy photo gives its main contours rather than texture
// noise, and line density is the same whatever the image resolution. R = gradient strength.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;     // mipmapped artwork
uniform vec2 uTexel;        // texel size at uLod
uniform float uLod;
float L(vec2 o) {
    vec4 c = textureLod(uTex, vUv + o * uTexel, uLod);
    return dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) + c.a * 0.35;
}
void main() {
    float tl = L(vec2(-1, -1)), t = L(vec2(0, -1)), tr = L(vec2(1, -1));
    float l = L(vec2(-1, 0)), c = L(vec2(0, 0)), r = L(vec2(1, 0));
    float bl = L(vec2(-1, 1)), b = L(vec2(0, 1)), br = L(vec2(1, 1));
    float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
    float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
    float g = length(vec2(gx, gy));
    fragColor = vec4(clamp(g * 0.5, 0.0, 1.0), 0.0, 0.0, 1.0);
}
