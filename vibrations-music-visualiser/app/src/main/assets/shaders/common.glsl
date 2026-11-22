// Shared header for every scene. Scenes define: vec3 scene(vec2 p)
// p: centred coords, short side spans [-1, 1].
// All motion goes through tph()/tdrift()/tloop() so that the whole field is
// periodic in uPeriod (240 s normally, the loop length in loop mode).

precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;     // 0 .. uPeriod
uniform float uPeriod;
uniform float uLevel;    // overall loudness 0..1
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uKick;     // kick envelope 0..1
uniform float uKickAge;  // seconds since last kick
uniform float uEnergy;   // slow moving loudness
uniform float uSpec[32];
uniform vec3 uPal[4];    // 0 background, 1 primary, 2 secondary, 3 highlight
uniform int uSym;        // 0 off, 1 mirror, 2 quad, n>=3 kaleidoscope
uniform float uSymRot;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// ---- time helpers (loop safe) ------------------------------------------
// Angle for an oscillation of roughly `hz` cycles per second, snapped to a
// whole number of cycles per period.
float tph(float hz) {
    float n = floor(hz * uPeriod + 0.5);
    return TAU * n * uTime / uPeriod;
}
// A point moving round a circle at roughly `speed` units per second.
vec2 tdrift(float speed) {
    float r = speed * uPeriod / TAU;
    float a = TAU * uTime / uPeriod;
    return r * vec2(cos(a), sin(a));
}
// Closed path through 3D noise space: drift + evolution.
vec3 tloop(float speed) {
    vec2 d = tdrift(speed);
    return vec3(d.x * 0.6, d.y * 0.6, d.x * 0.7 - d.y * 0.7);
}

// ---- noise ---------------------------------------------------------------
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
                   mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
                   mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 3.7, 9.2); a *= 0.5; }
    return s;
}
float fbm4(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 3.7, 9.2); a *= 0.5; }
    return s * 1.066;
}

// ---- audio / colour helpers ---------------------------------------------
float spec(float x) {
    x = clamp(x, 0.0, 1.0) * 31.0;
    int i = int(floor(x));
    int j = min(i + 1, 31);
    return mix(uSpec[i], uSpec[j], fract(x));
}
vec3 pal(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = mix(uPal[1], uPal[2], smoothstep(0.0, 0.6, t));
    return mix(a, uPal[3], smoothstep(0.6, 1.0, t));
}
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float pxSize() { return 2.0 / min(uRes.x, uRes.y); }

vec2 symmetry(vec2 p) {
    if (uSym == 0) return p;
    p = rot2(uSymRot) * p;
    if (uSym == 1) return vec2(abs(p.x), p.y);
    if (uSym == 2) return abs(p);
    float n = float(uSym);
    float seg = TAU / n;
    float a = atan(p.y, p.x);
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    return length(p) * vec2(cos(a), sin(a)) ;
}

vec3 scene(vec2 p);

void main() {
    vec2 p = (vUv - 0.5) * uRes / min(uRes.x, uRes.y) * 2.0;
    p = symmetry(p);
    vec3 c = scene(p);
    fragColor = vec4(max(c, vec3(0.0)), 1.0);
}
