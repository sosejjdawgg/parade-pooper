// Halftone — the picture as a printed dot screen; dots swell with the bass.
vec4 art(vec2 uv, vec2 p) {
    float cs = 0.022 * (1.0 + 0.18 * uKick);
    mat2 R = rot2(0.785398);
    vec2 q = R * p / cs;
    vec2 cell = floor(q) + 0.5;
    vec2 local = q - cell;
    vec2 pc = transpose(R) * (cell * cs);
    vec4 c = img(imgUv(toUv(pc)));
    vec3 col = unpremul(c);
    float l = luma(col);
    float rad = sqrt(l) * 0.66 * (0.82 + 0.35 * uBass);
    float px = pxSize() / cs;
    float dotm = 1.0 - smoothstep(rad - px, rad + px, length(local));
    vec3 ink = mix(col, col / max(max(col.r, max(col.g, col.b)), 0.05), 0.5);
    return vec4(ink * dotm * (1.0 + 0.4 * uKick), dotm * c.a);
}
