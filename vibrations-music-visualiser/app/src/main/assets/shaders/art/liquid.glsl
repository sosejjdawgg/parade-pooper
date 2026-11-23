// Liquid — the picture flows like it's under moving water; mids stir it, kicks surge.
vec4 art(vec2 uv, vec2 p) {
    vec3 tl = tloop(0.06);
    vec2 w = vec2(fbm4(vec3(p * 1.4, 0.0) + tl), fbm4(vec3(p * 1.4 + vec2(5.2, 1.3), 0.0) + tl)) - 0.5;
    vec2 w2 = vec2(fbm4(vec3(p * 3.0 + w * 2.0, 4.0) + tl * 1.5), fbm4(vec3(p * 3.0 + w * 2.0 + 3.1, 4.0) + tl * 1.5)) - 0.5;
    float amt = 0.035 + 0.09 * uMid + 0.07 * uKick;
    vec2 q = uv + (w + 0.5 * w2) * amt;
    vec4 c = img(imgUv(q));
    c.rgb *= 1.0 + 0.4 * uKick * smoothstep(0.1, 0.3, length(w2));
    return c;
}
