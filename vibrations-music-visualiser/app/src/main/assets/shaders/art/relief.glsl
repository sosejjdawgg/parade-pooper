// Relief — brightness becomes depth: the picture tilts in 3D under a raking light.
vec4 art(vec2 uv, vec2 p) {
    vec2 iu = imgUv(uv);
    float a = tph(0.04);
    vec2 tilt = 0.022 * vec2(cos(a), sin(a)) * (1.0 + 1.5 * uBass + 1.5 * uKick);
    vec2 q = iu;
    float h = 0.5;
    for (int i = 0; i < 4; i++) { h = luma(unpremul(imgLod(q, 1.0))); q = iu - tilt * (h - 0.5); }
    vec2 e = vec2(2.0 / uImgSize.x, 0.0);
    float hx = luma(unpremul(imgLod(q + e.xy, 1.0))) - luma(unpremul(imgLod(q - e.xy, 1.0)));
    float hy = luma(unpremul(imgLod(q + e.yx * uImgSize.x / uImgSize.y, 1.0))) - luma(unpremul(imgLod(q - e.yx * uImgSize.x / uImgSize.y, 1.0)));
    vec3 n = normalize(vec3(-hx * 6.0, hy * 6.0, 1.0));
    float la = tph(0.025) + 0.8;
    vec3 L = normalize(vec3(cos(la), sin(la), 0.9));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0), 24.0);
    vec4 c = img(q);
    c.rgb *= 0.55 + 0.7 * diff;
    c.rgb += c.a * spec * (0.25 + 0.8 * uKick) * pal(0.9);
    return c;
}
