// Void — near-empty: one horizon of light. For minimal artwork.
vec3 scene(vec2 p) {
    float px = pxSize();
    float aspect = uRes.x / min(uRes.x, uRes.y);
    vec3 col = uPal[0];
    col += uPal[1] * 0.045 * (1.0 - smoothstep(-1.0, 1.2, p.y));
    float x = p.x / max(aspect, 1.0);
    float bend = (0.05 * uBass + 0.03 * uKick) * exp(-x * x * 4.0) + 0.008 * sin(x * 2.3 + tph(0.02));
    float d = abs(p.y - bend);
    float fade = 1.0 - smoothstep(0.15, 1.1, abs(x));
    float w = px * (0.5 + 1.2 * uKick);
    float line = 1.0 - smoothstep(w, w + px * 1.4, d);
    col += uPal[3] * line * fade * (0.55 + 0.6 * uLevel);
    col += uPal[2] * exp(-d * d / (0.0008 + 0.004 * uBass)) * fade * (0.08 + 0.3 * uBass + 0.25 * uKick);
    col += uPal[3] * exp(-(x * x * 40.0 + d * d * 900.0)) * (0.15 + 0.5 * uKick);
    return col;
}
