// Breathe — the picture as-is, pushed in on kicks, highlights swelling with the bass.
vec4 art(vec2 uv, vec2 p) {
    float z = 1.0 - 0.04 * uKick - 0.015 * uBass;
    vec2 drift = 0.008 * vec2(sin(tph(0.03)), cos(tph(0.022)));
    vec2 q = (uv - 0.5) * z + 0.5 + drift;
    vec4 c = img(imgUv(q));
    float l = luma(unpremul(c));
    c.rgb *= 1.0 + (0.35 * uBass + 0.55 * uKick) * smoothstep(0.45, 1.0, l);
    c.rgb += c.a * uHigh * 0.06 * vnoise(vec3(p * 40.0, 0.0) + tloop(1.0));
    return c;
}
