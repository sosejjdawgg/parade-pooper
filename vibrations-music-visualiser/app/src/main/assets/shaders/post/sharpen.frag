// Up-res pass 2: contrast-adaptive sharpening with a light edge-preserving smooth first,
// so JPEG blockiness is calmed while real edges get crisper.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uStrength;   // 0..1
void main() {
    vec4 e = texture(uTex, vUv);
    vec4 b = texture(uTex, vUv + vec2(0.0, -uTexel.y));
    vec4 d = texture(uTex, vUv + vec2(-uTexel.x, 0.0));
    vec4 f = texture(uTex, vUv + vec2(uTexel.x, 0.0));
    vec4 h = texture(uTex, vUv + vec2(0.0, uTexel.y));
    // edge-preserving smooth: average neighbours that are close in value
    vec4 acc = e; float wsum = 1.0;
    for (int i = 0; i < 4; i++) {
        vec4 n = i == 0 ? b : i == 1 ? d : i == 2 ? f : h;
        float w = exp(-dot(n.rgb - e.rgb, n.rgb - e.rgb) * 400.0) * 0.6;
        acc += n * w; wsum += w;
    }
    vec4 base = acc / wsum;
    vec3 mn = min(base.rgb, min(min(b.rgb, d.rgb), min(f.rgb, h.rgb)));
    vec3 mx = max(base.rgb, max(max(b.rgb, d.rgb), max(f.rgb, h.rgb)));
    vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
    float peak = -1.0 / mix(8.0, 4.6, uStrength);
    vec3 w = amp * peak;
    vec3 c = (base.rgb + (b.rgb + d.rgb + f.rgb + h.rgb) * w) / (1.0 + 4.0 * w);
    fragColor = vec4(clamp(c, 0.0, base.a), base.a);
}
