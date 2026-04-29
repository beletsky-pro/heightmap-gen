#include "lib.glsl"

// Рёбра — треугольный/полукруглый профиль (полу-цилиндры на поверхности).

varying vec2 vUv;

uniform float uFreq;       // 1..30 — количество рёбер
uniform float uRounding;   // 0..1 — 0 = острый треугольник, 1 = полукруг
uniform float uConvexity;  // 0..1 — высота
uniform float uSize;       // 0.2..1 — ширина ребра как доля периода (1 = ребро соприкасается со следующим)
uniform float uAngle;
uniform float uDepth;
uniform float uSeed;

void main() {
  vec2 uv = vUv;
  float a = uAngle * 3.14159265 / 180.0;
  vec2 dir = vec2(cos(a), sin(a));
  float freq = max(1.0, floor(uFreq + 0.5));
  float coord = dot(uv, dir) * freq;
  float fc = fract(coord);

  // Расстояние от центра ребра (нормированное)
  float distFromCenter = abs(fc - 0.5) * 2.0;  // [0..1]
  float halfWidth = clamp(uSize, 0.05, 1.0);
  float t = distFromCenter / halfWidth;  // 0 в центре, 1 на краю ребра, >1 за пределами
  t = clamp(t, 0.0, 1.0);

  // Профиль
  // rounding=0: треугольник h = 1 - t
  // rounding=1: полукруг h = sqrt(1 - t^2)
  float tri = 1.0 - t;
  float circ = sqrt(max(0.0, 1.0 - t * t));
  float profile = mix(tri, circ, uRounding);

  // За пределами размера ребра — h = 0 (плоская канавка между рёбрами)
  if (distFromCenter > halfWidth) profile = 0.0;

  float h = (0.5 - 0.5 * uConvexity) + profile * uConvexity;
  h = clamp(h, 0.0, 1.0);
  h *= mix(0.4, 1.0, uDepth);

  float _ = uSeed;

  gl_FragColor = vec4(h, h, h, 1.0);
}
