// Orb — a single luminous body with a living corona.
vec3 scene(vec2 p) {
    float px = pxSize();
    float R = 0.4 + 0.045 * uBass + 0.025 * uKick;
    float r = length(p);
    vec3 col = uPal[0] + uPal[1] * 0.09 * exp(-r * 1.4);
    vec3 tl = tloop(0.07);
    float a = atan(p.y, p.x);
    vec2 dir = vec2(cos(a), sin(a));
    float rays = fbm4(vec3(dir * 1.7, r * 0.9) + tl);
    float outside = max(r - R, 0.0);
    float corona = pow(rays, 2.2) * exp(-outside * (3.2 - 1.4 * uLevel));
    col += pal(0.55) * corona * step(R, r) * (0.7 + 0.9 * uMid + 0.7 * uKick) * 1.3;
    col += uPal[3] * 0.025 / (outside * outside * 10.0 + 0.025) * (0.3 + 0.6 * uBass + 0.8 * uKick);
    if (r < R + 2.0 * px) {
        float z = sqrt(max(R * R - r * r, 0.0)) / R;
        vec3 n = vec3(p / R, z);
        float fres = pow(1.0 - z, 2.5);
        float swirl = fbm4(n * 2.6 + tl * 1.6);
        vec3 inner = mix(uPal[1], uPal[2], smoothstep(0.3, 0.75, swirl)) * (0.12 + 0.45 * swirl);
        inner *= 1.0 + 0.35 * uMid * sin(r * 55.0 - tph(0.4));
        inner += uPal[3] * fres * (0.65 + 1.1 * uKick + 0.4 * uBass);
        float edge = 1.0 - smoothstep(R - px * 1.5, R + px * 0.5, r);
        col = mix(col, inner, edge);
    }
    return col;
}
