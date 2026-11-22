// Haze — soft volumetric field lit from within. The default ambient scene.
vec3 scene(vec2 p) {
    vec3 tl = tloop(0.05);
    vec2 q = p * vec2(0.85, 1.0);
    float a = fbm(vec3(q * 1.1, 0.0) + tl);
    float b = fbm(vec3(q * 1.5 + 1.7 * vec2(a, a * 0.8) + vec2(5.2, 1.3), 2.0) + tl * 1.4);
    float fog = smoothstep(0.28, 0.82, b);

    vec2 lp = vec2(0.0, -0.12 + 0.04 * sin(tph(0.02)));
    float d = length((p - lp) * vec2(0.9, 1.2));
    float core = exp(-d * d * (9.0 - 2.5 * uBass - 2.0 * uKick));
    float glow = 0.05 / (d * d + 0.05);

    vec3 col = uPal[0] * (1.0 + 0.6 * glow);
    float scatter = fog * (0.2 + 0.7 * glow);
    col += mix(uPal[1], uPal[2], smoothstep(0.3, 0.75, a)) * scatter * (0.55 + 0.45 * uLevel + 0.45 * uKick);
    col += mix(uPal[2], uPal[3], 0.6) * core * (0.16 + 0.32 * uBass + 0.38 * uKick);
    col += uPal[3] * fog * uHigh * 0.18 * vnoise(vec3(p * 9.0, 0.0) + tl * 5.0);
    return col;
}
