// Sobel-нормаль из heightmap. tangent-space, по умолчанию OpenGL (Y up).
// Если uFlipY = 1.0 → DirectX (Y inverted).

precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform vec2 uTexel;       // 1.0 / size
uniform float uStrength;   // 1..10
uniform float uFlipY;      // 0 = OpenGL, 1 = DirectX

void main() {
  float hL = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
  float hU = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;

  vec3 n;
  n.x = (hL - hR) * uStrength;
  n.y = (hD - hU) * uStrength;
  if (uFlipY > 0.5) n.y = -n.y;
  n.z = 1.0;
  n = normalize(n);

  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}
