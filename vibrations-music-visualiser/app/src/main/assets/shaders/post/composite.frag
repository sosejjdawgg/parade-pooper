// Bloom + tone mapping + vignette + grain/dither + text overlay. Output is final sRGB-ish.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uText;
uniform float uBloomAmt;
uniform float uPunch;     // 0 luminous (soft shoulder) .. 1 punchy (contrasty)
uniform float uGrain;
uniform float uTextAlpha;
uniform vec3 uTextColor;
uniform float uSeed;
uniform vec2 uRes;

float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec3 c = texture(uScene, vUv).rgb;
    vec3 b = texture(uBloom1, vUv).rgb * 0.7 + texture(uBloom2, vUv).rgb * 0.9;
    c += b * uBloomAmt;
    vec3 soft = 1.0 - exp(-c * 1.15);
    vec3 punchy = aces(c * 1.1);
    c = mix(soft, punchy, uPunch);
    vec2 q = vUv - 0.5;
    c *= 1.0 - 0.28 * dot(q, q) * 1.6;
    float n = h12(vUv * uRes + uSeed) + h12(vUv * uRes * 1.37 - uSeed * 1.9) - 1.0;
    c += n * (1.2 / 255.0 + uGrain * 0.035);
    vec4 t = texture(uText, vec2(vUv.x, 1.0 - vUv.y));
    c = mix(c, uTextColor, t.a * uTextAlpha);
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
