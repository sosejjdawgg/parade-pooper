// Artwork pass. Appended after "#define ART_PASS" + common.glsl, followed by one mode file
// that defines: vec4 art(vec2 uv, vec2 p)  -> premultiplied colour + coverage.
uniform sampler2D uImage;   // up-res'd artwork (premultiplied alpha), row 0 = top of the picture
uniform sampler2D uEdge;    // R = edge strength, mipmapped (thicker lines at higher LOD)
uniform sampler2D uScene;   // scene rendered behind the art
uniform vec2 uImgSize;
uniform float uFit;         // 0 = fill (crop to cover), 1 = fit (whole picture)
uniform float uAmount;      // 0 = untouched picture, 1 = full mode
uniform float uTint;        // 0 = artwork colours, 1 = palette colours
uniform float uBehind;      // how much of the scene shows behind / through the art
uniform float uLine;        // neon line weight 0..1
uniform float uFill;        // neon: how much of the original picture stays under the lines
uniform float uDetail;      // neon: 0 = only the strongest contours, 1 = fine detail

vec2 imgUv(vec2 uv) {
    float ca = uRes.x / uRes.y;
    float ia = uImgSize.x / uImgSize.y;
    vec2 cover = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
    vec2 contain = ca > ia ? vec2(ca / ia, 1.0) : vec2(1.0, ia / ca);
    return (uv - 0.5) * mix(cover, contain, uFit) + 0.5;
}
float inside(vec2 iu) {
    vec2 e = step(vec2(0.0), iu) * step(iu, vec2(1.0));
    return e.x * e.y;
}
vec4 img(vec2 iu) { return texture(uImage, vec2(iu.x, 1.0 - iu.y)) * inside(iu); }
vec4 imgLod(vec2 iu, float lod) { return textureLod(uImage, vec2(iu.x, 1.0 - iu.y), lod) * inside(iu); }
float edgeAt(vec2 iu, float lod) { return textureLod(uEdge, vec2(iu.x, 1.0 - iu.y), lod).r * inside(iu); }
vec3 unpremul(vec4 c) { return c.rgb / max(c.a, 1e-4); }
// canvas uv <-> centred p (short side = [-1, 1])
vec2 toUv(vec2 p) { return p * min(uRes.x, uRes.y) / uRes * 0.5 + 0.5; }

vec4 art(vec2 uv, vec2 p);

void main() {
    vec2 p = (vUv - 0.5) * uRes / min(uRes.x, uRes.y) * 2.0;
    p = symmetry(p);
    vec2 uv = toUv(p);
    vec4 a = art(uv, p);
    vec4 dry = img(imgUv(uv));
    a = mix(dry, a, uAmount);
    // palette tint: map the art's tones onto the current palette ramp
    float l = luma(unpremul(a));
    vec3 tinted = mix(uPal[0], pal(l), smoothstep(0.0, 0.25, l)) * a.a * (0.6 + 0.8 * l);
    a.rgb = mix(a.rgb, tinted, uTint);
    vec3 behind = mix(uPal[0], texture(uScene, vUv).rgb, uBehind);
    vec3 c = behind * (1.0 - clamp(a.a, 0.0, 1.0)) + a.rgb;
    fragColor = vec4(max(c, vec3(0.0)), 1.0);
}
