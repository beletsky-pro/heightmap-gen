#include "lib.glsl"

// Параллельные приподнятые линии (рёбрышки опалубки, рейки).
// Tileable: uFreq округляется до целого, угол 0/45/90 для бесшовности.

varying vec2 vUv;

uniform float uFreq;       // 1..40 — количество линий по ширине
uniform float uLineWidth;  // 0.05..0.95 — доля периода, занятая линией
uniform float uRounding;   // 0..1 — мягкость края (0 = резко, 1 = плавно)
uniform float uConvexity;  // 0..1 — высота линии относительно фона
uniform float uAngle;      // 0 / 45 / 90
uniform float uDepth;
uniform float uSeed;       // лёгкая нерегулярность

void main() {
  vec2 uv = vUv;
  float a = uAngle * 3.14159265 / 180.0;
  vec2 dir = vec2(cos(a), sin(a));
  // округляем частоту до целого для tileable
  float freq = floor(uFreq + 0.5);
  if (uAngle > 22.5 && uAngle < 67.5) {
    // диагональ — частота должна быть целой и по диагонали (sqrt(2) уже учтён в dir)
    freq = max(1.0, freq);
  }
  float coord = dot(uv, dir) * freq;
  float fc = fract(coord);
  // Расстояние от центра линии (центр линии при fc=0.5)
  float distFromCenter = abs(fc - 0.5);
  float halfWidth = uLineWidth * 0.5;
  // Внутри линии: distFromCenter < halfWidth
  float distFromEdge = halfWidth - distFromCenter;  // >0 в линии
  float edgeWidth = mix(0.001, 0.18, uRounding);
  float profile = smoothstep(0.0, edgeWidth, distFromEdge);

  // Слабая нерегулярность от seed (микро-волны на линии)
  float jitter = (fract(sin(coord * 13.0 + uSeed * 0.71) * 43758.5453) - 0.5) * 0.02;

  float h = (0.5 - 0.5 * uConvexity) + (profile + jitter) * uConvexity;
  h = clamp(h, 0.0, 1.0);
  h *= mix(0.4, 1.0, uDepth);

  gl_FragColor = vec4(h, h, h, 1.0);
}
