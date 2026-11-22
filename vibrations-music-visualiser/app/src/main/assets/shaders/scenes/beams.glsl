// Beams — slow sweeping shafts of light through haze.
vec3 scene(vec2 p) {
    vec3 col = uPal[0];
    float aspect = uRes.x / min(uRes.x, uRes.y);
    float haze = fbm4(vec3(p * 1.4, 0.0) + tloop(0.06));
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 src = vec2((fi / 4.0 - 0.5) * 2.0 * max(aspect, 0.8), 1.35);
        float ang = 0.38 * sin(tph(0.035 + 0.012 * fi) + fi * 1.7);
        vec2 dir = vec2(sin(ang), -cos(ang));
        vec2 v = p - src;
        float along = dot(v, dir);
        float across = dot(v, vec2(-dir.y, dir.x));
        float width = 0.03 + max(along, 0.0) * 0.11;
        float beam = exp(-across * across / (width * width)) * smoothstep(0.0, 0.4, along) * exp(-along * 0.3);
        float core = exp(-across * across / (width * width * 0.08));
        float e = 0.28 + 0.9 * spec(0.05 + fi * 0.16) + 0.5 * uKick;
        vec3 bc = pal(fi / 4.0);
        col += bc * beam * e * (0.35 + 0.9 * haze) + bc * core * beam * e * 0.35;
    }
    float floorGlow = exp(-pow(p.y + 1.0, 2.0) * 6.0);
    col += pal(0.5) * floorGlow * (0.06 + 0.25 * uBass);
    return col;
}
