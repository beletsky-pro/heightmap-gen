// B&W-маска: heightmap → бинарный/мягкий порог.
// Отдельный output (не модифицирует displacement-карту).

precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform float uThreshold;  // 0..1 — где «срез»
uniform float uSoftness;   // 0..1 — ширина переходной зоны (0 = жёсткий, 1 = очень мягкий)
uniform float uInvert;     // 0 / 1

void main() {
  float h = texture2D(uHeight, vUv).r;
  // ширина перехода: при softness=0 → 0.001 (почти hard), при 1 → 0.5
  float w = max(0.001, uSoftness * 0.25);
  float m = smoothstep(uThreshold - w, uThreshold + w, h);
  m = mix(m, 1.0 - m, uInvert);
  gl_FragColor = vec4(m, m, m, 1.0);
}
