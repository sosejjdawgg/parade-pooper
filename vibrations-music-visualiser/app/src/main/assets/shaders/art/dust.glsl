// Dust — the picture breaks into points of light that scatter on hits and settle back.
vec4 art(vec2 uv, vec2 p) {
    float cs = 0.014;
    vec2 g = p / cs;
    vec2 id0 = floor(g);
    vec4 acc = vec4(0.0);
    float scatter = 0.25 * uBass + 0.9 * uKick;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
        vec2 id = id0 + vec2(float(i), float(j));
        float h1 = hash12(id), h2 = hash12(id + 7.13);
        float ph = tph(0.05) + h1 * TAU;
        vec2 home = (id + 0.5) * cs;
        vec2 off = (vec2(h1, h2) - 0.5) * scatter + 0.12 * vec2(cos(ph), sin(ph));
        vec2 pos = id + 0.5 + off;
        vec4 c = img(imgUv(toUv(home)));
        float l = luma(unpremul(c));
        float size = 0.3 + 0.3 * l;
        float d = length(g - pos);
        float m = exp(-d * d / (size * size * 0.6)) * c.a;
        float tw = 1.0 + uHigh * 0.8 * sin(tph(0.6) + h2 * 30.0);
        acc += vec4(unpremul(c) * m * tw * (1.5 + 0.7 * uKick), m);
    }
    return vec4(acc.rgb, clamp(acc.a, 0.0, 1.0));
}
