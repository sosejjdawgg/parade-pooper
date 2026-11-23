// Split — colour channels pull apart and rows slip sideways on hits.
vec4 art(vec2 uv, vec2 p) {
    float s = 0.003 + 0.022 * uKick + 0.01 * uHigh;
    vec2 dir = p / max(length(p), 0.2);
    float band = floor(uv.y * 28.0);
    float h = hash12(vec2(band, floor(uTime * 9.0)));
    float slip = (h - 0.5) * 0.09 * step(0.72, h) * smoothstep(0.25, 0.7, uKick);
    vec2 q = uv + vec2(slip, 0.0);
    vec4 r = img(imgUv(toUv(p + dir * s * 2.0) + vec2(slip, 0.0)));
    vec4 g = img(imgUv(q));
    vec4 b = img(imgUv(toUv(p - dir * s * 2.0) + vec2(slip, 0.0)));
    return vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}
