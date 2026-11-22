// Screen blit. uUvScale/uUvOffset allow 'cover' fitting for the ambient letterbox fill.
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform float uGain;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
void main() {
    vec2 uv = (vUv - 0.5) * uUvScale + 0.5 + uUvOffset;
    fragColor = vec4(texture(uTex, uv).rgb * uGain, 1.0);
}
