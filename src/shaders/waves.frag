#include "lib.glsl"

// Синусоидальные волны (рябь). Tileable при целой частоте.

varying vec2 vUv;

uniform float uFreq;       // 1..30 — количество гребней по ширине
uniform float uRounding;   // 0..1 — резкость (0 = пикоподобно, 1 = чистая sin)
uniform float uConvexity;  // 0..1 — амплитуда
uniform float uAngle;      // 0 / 45 / 90
uniform float uCrossWaves; // 0..1 — добавить вторую волну под 90° (создаёт рябь-сетку)
uniform float uDepth;
uniform float uSeed;

void main() {
  vec2 uv = vUv;
  float a = uAngle * 3.14159265 / 180.0;
  vec2 dir = vec2(cos(a), sin(a));
  float freq = max(1.0, floor(uFreq + 0.5));
  float coord = dot(uv, dir) * freq;

  // sin → smooth, |sin|^p → пикоподобный с уменьшением p
  float s = sin(coord * 6.28318530718) * 0.5 + 0.5;
  // Резкость через power: rounding=1 → power=1 (чистая sin), rounding=0 → power=0.3 (пикоподобно)
  float power = mix(0.3, 1.0, uRounding);
  s = pow(s, power);

  // Кросс-волны
  if (uCrossWaves > 0.001) {
    vec2 dir2 = vec2(-dir.y, dir.x);
    float coord2 = dot(uv, dir2) * freq;
    float s2 = sin(coord2 * 6.28318530718) * 0.5 + 0.5;
    s2 = pow(s2, power);
    s = mix(s, (s + s2) * 0.5, uCrossWaves);
  }

  float h = (0.5 - 0.5 * uConvexity) + s * uConvexity;
  h = clamp(h, 0.0, 1.0);
  h *= mix(0.4, 1.0, uDepth);

  // Чтобы заглушить unused warning
  float _ = uSeed;

  gl_FragColor = vec4(h, h, h, 1.0);
}
