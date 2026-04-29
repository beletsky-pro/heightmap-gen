// Roughness: базовый уровень + локальная дисперсия (детализация шероховатости).
// На бетоне/камне даёт правильное «грубее в неоднородностях» поведение.

precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uBase;    // 0.3..0.95
uniform float uDetail;  // 0..10 — вес дисперсии

#define R 2

void main() {
  float sum = 0.0;
  float sqSum = 0.0;
  float count = 0.0;
  for (int y = -R; y <= R; y++) {
    for (int x = -R; x <= R; x++) {
      vec2 o = vec2(float(x), float(y)) * uTexel;
      float h = texture2D(uHeight, vUv + o).r;
      sum += h;
      sqSum += h * h;
      count += 1.0;
    }
  }
  float mean = sum / count;
  float variance = sqSum / count - mean * mean;
  float r = mix(uBase, 1.0, clamp(variance * uDetail, 0.0, 1.0));
  r = clamp(r, 0.0, 1.0);
  gl_FragColor = vec4(r, r, r, 1.0);
}
