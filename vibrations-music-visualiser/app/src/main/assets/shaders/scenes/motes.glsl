// Motes — layered drifting light particles with depth and bokeh.
vec3 scene(vec2 p) {
    float r = length(p);
    vec3 col = uPal[0] + mix(uPal[1], uPal[2], 0.5 + 0.4 * p.y) * 0.045;
    for (int L = 0; L < 5; L++) {
        float fl = float(L);
        float near = 1.0 - fl / 4.0;
        float scale = mix(11.0, 2.4, near);
        vec2 pp = p * (1.0 - 0.09 * uKick * near);
        vec2 g = pp * scale + tdrift(mix(0.18, 0.45, near)) + vec2(fl * 13.7, fl * 5.3);
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float h = hash12(id + fl * 31.0);
        if (h > mix(0.7, 0.35, near)) continue;
        float hh = fract(h * 17.31);
        float ph = tph(0.07) + hh * TAU;
        vec2 o = (vec2(fract(h * 43.7), fract(h * 91.3)) - 0.5) * 0.45 + 0.07 * vec2(cos(ph), sin(ph));
        float d = length(f - o);
        float size = mix(0.035, 0.2, near * near) * (0.55 + 0.6 * hh);
        float gauss = exp(-d * d / (size * size * 0.18));
        float disk = (1.0 - smoothstep(size * 0.8, size, d)) * (0.55 + 0.45 * smoothstep(size * 0.45, size * 0.95, d));
        float shape = mix(gauss, disk, smoothstep(0.55, 0.9, near));
        float tw = 0.65 + 0.35 * sin(tph(0.25) + hh * 40.0);
        float e = (0.45 + 0.8 * uLevel * near + 1.1 * uKick * near + 0.9 * uHigh * (1.0 - near)) * tw;
        col += pal(hh) * shape * e * mix(1.5, 0.45, near);
    }
    col += uPal[3] * 0.07 * exp(-r * r * 1.5) * (0.4 + uBass);
    return col;
}
