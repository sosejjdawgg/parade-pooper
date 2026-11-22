// Nebula — slow billowing ink clouds (fluid), warped twice.
vec3 scene(vec2 p) {
    vec3 tl = tloop(0.035);
    vec2 s = p * 1.1;
    vec2 q = vec2(fbm4(vec3(s, 0.0) + tl), fbm4(vec3(s + vec2(5.2, 1.3), 0.0) + tl));
    vec2 r = vec2(fbm4(vec3(s + 3.2 * q + vec2(1.7, 9.2), 0.0) + tl * 1.3),
                  fbm4(vec3(s + 3.2 * q + vec2(8.3, 2.8), 0.0) + tl * 1.3));
    float f = fbm4(vec3(s + 3.0 * r, 0.0) + tl * 0.7);
    vec3 c = mix(uPal[0], uPal[1], clamp(f * f * 2.6, 0.0, 1.0));
    c = mix(c, uPal[2], clamp(length(q) * 0.75, 0.0, 1.0) * 0.65);
    c = mix(c, uPal[3], clamp(r.x * r.x * 1.4, 0.0, 1.0) * (0.25 + 0.5 * uBass + 0.6 * uKick));
    float lum = smoothstep(0.25, 0.95, f);
    lum = lum * lum * (0.8 + 0.6 * length(r - 0.5));
    return c * lum * (0.85 + 0.35 * uLevel + 0.35 * uKick) + uPal[0] * 0.7;
}
