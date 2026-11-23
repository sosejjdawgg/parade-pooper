// Ripple — rings of refraction roll out from the centre on every kick.
vec4 art(vec2 uv, vec2 p) {
    float r = length(p);
    vec2 dir = p / max(r, 1e-4);
    float front = uKickAge * 1.3;
    float ring = exp(-pow(r - front, 2.0) * 22.0) * uKick;
    float wave = sin(r * 34.0 - front * 34.0) * ring + 0.25 * uBass * sin(r * 18.0 - tph(0.8));
    vec2 q = toUv(p - dir * wave * 0.035);
    vec4 c = img(imgUv(q));
    c.rgb *= 1.0 + wave * 0.35;
    return c;
}
