// Neon — the artwork redrawn as glowing tubes of light along its edges.
vec4 art(vec2 uv, vec2 p) {
    vec2 iu = imgUv(uv);
    float w = uLine;
    float e0 = edgeAt(iu, 0.0 + w * 0.8);
    float e1 = edgeAt(iu, 1.6 + w * 1.4);
    float e2 = edgeAt(iu, 3.2 + w * 1.6);
    float thr = mix(0.5, 0.06, uDetail);
    float core = smoothstep(thr, thr * 1.8, e0);
    float tube = smoothstep(thr * 0.7, thr * 1.6, e1) * (0.35 + 0.8 * uBass);
    float halo = smoothstep(thr * 0.3, thr * 1.5, e2) * (0.25 + 0.6 * uLevel);
    // light travelling through the tubes
    float flow = vnoise(vec3(iu * vec2(7.0, 7.0 * uImgSize.y / uImgSize.x), 0.0) + tloop(0.5));
    float pulse = 0.5 + 0.6 * smoothstep(0.3, 0.8, flow) + 1.3 * uKick + 0.3 * uHigh;
    vec4 src = imgLod(iu, 1.5);
    vec3 hue = unpremul(src);
    float m = max(hue.r, max(hue.g, hue.b));
    hue = m > 0.02 ? hue / m : vec3(1.0);                          // full-brightness version of the colour
    hue = mix(vec3(luma(hue)), hue, 2.2);                          // push saturation
    hue = clamp(hue, 0.0, 1.0);
    hue = mix(pal(0.55), hue, smoothstep(0.08, 0.3, length(hue - vec3(luma(hue))))); // greys take the palette
    float I = (core * 1.2 + tube * 0.6 + halo * 0.35) * pulse;
    vec3 rgb = hue * I + vec3(1.0) * core * 0.12 * pulse;         // white-hot centre line
    vec3 under = unpremul(src) * src.a * uFill * (0.25 + 0.2 * uBass);
    float a = clamp(I * 0.8 + uFill * src.a * 0.85, 0.0, 1.0);
    return vec4(rgb + under, a);
}
