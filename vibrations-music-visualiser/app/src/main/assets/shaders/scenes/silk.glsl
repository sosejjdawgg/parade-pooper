// Silk — flowing luminous ribbons (fluid).
vec3 scene(vec2 p) {
    vec2 w = p * 1.05;
    float t1 = tph(0.03), t2 = tph(0.042), t3 = tph(0.015);
    float amp = 0.5 + 0.3 * uMid + 0.18 * uKick;
    for (int i = 1; i < 6; i++) {
        float fi = float(i);
        w += amp / fi * vec2(sin(fi * 0.9 * w.y + t1 + fi * 1.3), cos(fi * 0.8 * w.x + t2 - fi * 0.7));
    }
    float v = w.x * 0.9 + w.y * 0.55 + 0.4 * sin(t3);
    float s = 0.5 + 0.5 * sin(v * 3.0);
    float ribbon = pow(s, 7.0);
    float fine = pow(0.5 + 0.5 * sin(v * 11.0), 14.0) * smoothstep(0.2, 0.9, s);
    float hue = 0.5 + 0.5 * sin(v * 0.55 + w.y * 0.35);
    vec3 c = uPal[0];
    c += pal(hue * 0.85) * ribbon * (0.65 + 0.55 * uBass + 0.6 * uKick);
    c += pal(0.9) * fine * (0.12 + 0.6 * uHigh);
    c += uPal[3] * pow(ribbon, 5.0) * (0.25 + 0.9 * uKick);
    c *= 0.55 + 0.45 * smoothstep(2.4, 0.2, length(p));
    return c;
}
