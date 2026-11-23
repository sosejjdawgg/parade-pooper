// Print — screen-printed posterisation in palette inks; the cut points move with the music.
vec4 art(vec2 uv, vec2 p) {
    vec2 reg = vec2(0.003, -0.002) * (1.0 + 4.0 * uKick);
    vec4 c = imgLod(imgUv(uv), 0.6);
    float l = luma(unpremul(c));
    float shift = 0.08 * uBass - 0.04;
    float lvl = clamp(floor((l + shift) * 4.0) / 3.0, 0.0, 1.0);
    vec3 ink = lvl < 0.01 ? uPal[0] * 1.6 : pal(lvl);
    // offset second pass, like a mis-registered layer
    float l2 = luma(unpremul(imgLod(imgUv(uv + reg), 0.6)));
    float top = step(0.72 - 0.1 * uMid, l2);
    ink = mix(ink, uPal[3], top * 0.55);
    float grain = vnoise(vec3(p * 220.0, 1.0)) * 0.08;
    return vec4((ink - grain) * c.a, c.a);
}
