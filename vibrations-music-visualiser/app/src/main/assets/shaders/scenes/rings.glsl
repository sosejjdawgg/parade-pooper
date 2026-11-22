// Rings — crisp concentric arcs driven by the spectrum (geometric).
vec3 scene(vec2 p) {
    float px = pxSize();
    float r = length(p);
    float a = atan(p.y, p.x);
    vec3 col = uPal[0] + uPal[1] * 0.05 * exp(-r * r);
    const int N = 15;
    for (int i = 0; i < N; i++) {
        float fi = float(i);
        float k = fi / float(N - 1);
        float s = spec(0.02 + k * 0.85);
        float rad = 0.14 + k * 0.8 + 0.025 * s;
        float w = px * (0.6 + 2.2 * s);
        float d = abs(r - rad);
        float line = 1.0 - smoothstep(w, w + px * 1.2, d);
        float dirn = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
        float rot = tph(0.012 + 0.02 * hash11(fi * 7.1)) * dirn;
        float span = mix(0.18, 0.9, hash11(fi * 3.1)) + 0.2 * s;
        float aa = fract((a + rot) / TAU + hash11(fi * 1.7));
        float soft = 0.004;
        float arc = smoothstep(0.0, soft, aa) * (1.0 - smoothstep(span - soft, span, aa));
        float glow = exp(-d * d / (0.00015 + 0.0025 * s));
        vec3 rc = pal(k);
        col += rc * line * (arc * (0.45 + 1.4 * s) + 0.07);
        col += rc * glow * arc * 0.35 * s;
    }
    float pr = 0.1 + uKickAge * 1.7;
    float pd = abs(r - pr);
    col += uPal[3] * exp(-pd * pd / 0.0005) * uKick * 1.1;
    col += uPal[3] * exp(-r * r / 0.0018) * (0.5 + 0.9 * uBass);
    return col;
}
