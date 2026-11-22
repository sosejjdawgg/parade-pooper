// Prism — nested rotating polygons with chromatic fringing (geometric light).
float polyD(vec2 p, float n, float r) {
    float an = TAU / n;
    float a = atan(p.x, p.y) + PI;
    float d = cos(floor(0.5 + a / an) * an - a) * length(p);
    return d - r * cos(an * 0.5);
}
float prismField(vec2 p) {
    float v = 0.0;
    float px = pxSize();
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        bool odd = mod(fi, 2.0) >= 1.0;
        float n = odd ? 6.0 : 3.0;
        float rot = tph(0.01 + 0.006 * fi) * (odd ? -1.0 : 1.0);
        vec2 q = rot2(rot) * p;
        float sp = spec(0.05 + fi / 8.0);
        float r = 0.2 + fi * 0.13 + 0.05 * uBass * (1.0 - fi / 7.0) + 0.03 * sp;
        float d = abs(polyD(q, n, r));
        float w = px * (0.8 + 2.0 * sp + 1.5 * uKick);
        v += (1.0 - smoothstep(w, w + px * 1.5, d)) * (0.55 + 0.9 * sp);
        v += 0.0025 / (d + 0.01) * (0.25 + 0.6 * sp);
    }
    return v;
}
vec3 scene(vec2 p) {
    float ca = 0.008 + 0.025 * uKick + 0.01 * uHigh;
    vec3 rgb = vec3(prismField(p * (1.0 - ca)), prismField(p), prismField(p * (1.0 + ca)));
    float m = (rgb.r + rgb.g + rgb.b) / 3.0;
    vec3 col = uPal[0] + uPal[1] * 0.06 * exp(-dot(p, p));
    col += mix(rgb, m * pal(0.5 + 0.4 * sin(atan(p.y, p.x) + tph(0.01))), 0.55);
    col += uPal[3] * exp(-dot(p, p) * 30.0) * (0.2 + 0.6 * uKick);
    return col;
}
