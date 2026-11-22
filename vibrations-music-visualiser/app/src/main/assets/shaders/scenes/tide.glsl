// Tide — stacked ridge lines shaped by the spectrum (graphic).
vec3 scene(vec2 p) {
    float px = pxSize();
    vec3 bg = uPal[0];
    vec3 col = bg;
    const int N = 26;
    float aspect = uRes.x / min(uRes.x, uRes.y);
    float x = p.x / max(aspect, 1.0);
    float env = exp(-x * x * 3.0);
    vec3 tl = tloop(0.22);
    for (int i = 0; i < N; i++) {
        float fi = float(i);
        float k = fi / float(N - 1);
        float base = mix(0.72, -0.78, k);
        float n = vnoise(vec3(x * 3.2, fi * 0.41, 0.0) + tl);
        float n2 = vnoise(vec3(x * 7.0, fi * 0.73, 3.0) + tl * 1.6);
        float s = spec(clamp(abs(x) * 0.9 + 0.04, 0.0, 1.0));
        float h = env * (0.03 + 0.2 * n * n + 0.32 * s * n + 0.06 * n2 * (uHigh + 0.3) + 0.12 * uKick * n);
        float d = p.y - (base + h);
        col = mix(col, bg, 1.0 - smoothstep(-1.5 * px, 0.0, d));
        float w = px * (0.55 + 0.6 * k);
        float line = 1.0 - smoothstep(w, w + px * 1.3, abs(d));
        vec3 lc = pal(0.15 + 0.85 * k);
        col += lc * line * (0.55 + 0.6 * s + 0.4 * uKick);
        col += lc * exp(-d * d / 0.0004) * 0.04 * step(0.0, d);
    }
    return col;
}
