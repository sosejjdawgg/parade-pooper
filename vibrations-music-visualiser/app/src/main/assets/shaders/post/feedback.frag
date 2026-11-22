// Scene crossfade + light trails (max-blend feedback with a gentle outward drift).
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform sampler2D uHist;
uniform float uFade;   // 0 = current scene only, 1 = previous scene only
uniform float uTrail;  // per-frame retention 0..~0.97
uniform float uZoom;   // per-frame outward drift
uniform float uFloor;  // subtractive floor so 8-bit targets still fade out
void main() {
    vec3 c = texture(uCur, vUv).rgb;
    if (uFade > 0.0) c = mix(c, texture(uPrev, vUv).rgb, uFade);
    if (uTrail > 0.0) {
        vec2 huv = (vUv - 0.5) * (1.0 - uZoom) + 0.5;
        vec3 h = texture(uHist, huv).rgb * uTrail - uFloor;
        c = max(c, h);
    }
    fragColor = vec4(c, 1.0);
}
