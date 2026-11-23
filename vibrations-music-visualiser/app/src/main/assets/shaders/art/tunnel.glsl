// Tunnel — the picture framed inside itself, falling forward forever in time with the music.
vec4 art(vec2 uv, vec2 p) {
    float phase = fract(uTime / uPeriod * floor(0.12 * uPeriod + 0.5));
    float k = 0.58;
    vec4 acc = vec4(0.0);
    float pump = 1.0 + 0.05 * uKick;
    for (int i = 0; i < 6; i++) {
        float sc = pow(k, float(i) - phase) * pump;
        vec2 q = (uv - 0.5) / sc + 0.5;
        float ins = inside(q);
        vec4 c = img(imgUv(q));
        vec2 dEdge = min(q, 1.0 - q) * sc * uRes / min(uRes.x, uRes.y);
        float border = (1.0 - smoothstep(0.0, 0.006 + 0.01 * uKick, min(dEdge.x, dEdge.y))) * ins;
        c = mix(c, vec4(pal(0.9), 1.0), 0.0);
        acc = mix(acc, c, ins * c.a);
        acc.rgb += pal(0.85) * border * (0.4 + 1.5 * uKick + 0.5 * uBass);
        acc.a = max(acc.a, border);
    }
    return acc;
}
