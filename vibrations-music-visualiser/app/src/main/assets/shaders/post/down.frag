// 4-tap box downsample with a soft knee so dim haze blooms gently and highlights bloom more.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uTexel;   // source texel size
uniform float uKnee;   // 1 for the first (prefilter) pass, 0 afterwards
void main() {
    vec2 o = uTexel;
    vec3 c = texture(uTex, vUv + vec2(-o.x, -o.y)).rgb + texture(uTex, vUv + vec2(o.x, -o.y)).rgb
           + texture(uTex, vUv + vec2(-o.x, o.y)).rgb + texture(uTex, vUv + vec2(o.x, o.y)).rgb;
    c *= 0.25;
    if (uKnee > 0.0) {
        float l = max(c.r, max(c.g, c.b));
        float w = smoothstep(0.04, 0.6, l);
        c *= mix(0.25, 1.0, w);
    }
    fragColor = vec4(c, 1.0);
}
