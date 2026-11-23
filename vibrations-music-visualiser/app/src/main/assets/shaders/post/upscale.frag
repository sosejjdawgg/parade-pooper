// Up-res pass 1: Catmull-Rom bicubic resample (9 bilinear taps). Keeps edges far crisper than
// bilinear without ringing too hard. When shrinking, falls back to trilinear (mipmapped) sampling.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uSrcSize;
uniform float uUp;   // 1 = enlarging (bicubic), 0 = shrinking
void main() {
    if (uUp < 0.5) { fragColor = texture(uTex, vUv); return; }
    vec2 samplePos = vUv * uSrcSize;
    vec2 tc1 = floor(samplePos - 0.5) + 0.5;
    vec2 f = samplePos - tc1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 off12 = w2 / w12;
    vec2 tc0 = (tc1 - 1.0) / uSrcSize;
    vec2 tc3 = (tc1 + 2.0) / uSrcSize;
    vec2 tc12 = (tc1 + off12) / uSrcSize;
    vec4 c = vec4(0.0);
    c += textureLod(uTex, vec2(tc0.x, tc0.y), 0.0) * w0.x * w0.y;
    c += textureLod(uTex, vec2(tc12.x, tc0.y), 0.0) * w12.x * w0.y;
    c += textureLod(uTex, vec2(tc3.x, tc0.y), 0.0) * w3.x * w0.y;
    c += textureLod(uTex, vec2(tc0.x, tc12.y), 0.0) * w0.x * w12.y;
    c += textureLod(uTex, vec2(tc12.x, tc12.y), 0.0) * w12.x * w12.y;
    c += textureLod(uTex, vec2(tc3.x, tc12.y), 0.0) * w3.x * w12.y;
    c += textureLod(uTex, vec2(tc0.x, tc3.y), 0.0) * w0.x * w3.y;
    c += textureLod(uTex, vec2(tc12.x, tc3.y), 0.0) * w12.x * w3.y;
    c += textureLod(uTex, vec2(tc3.x, tc3.y), 0.0) * w3.x * w3.y;
    fragColor = clamp(c, 0.0, 1.0);
}
