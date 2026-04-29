#include "lib.glsl"

varying vec2 vUv;

uniform float uScale;        // 0.5 .. 8 — крупность пористой основы
uniform float uRoughness;    // 0..1 — gain в fbm; больше = резче высокочастотный шум
uniform float uCrackAmount;  // 0..1 — сила трещин (0 = нет)
uniform float uSeed;         // 0..1000
uniform float uContrast;     // 0.5..2
uniform float uDepth;        // 0..1 — общая глубина

void main() {
  vec2 uv = vUv;
  float s = uSeed * 0.137;

  // Основа: FBM Perlin
  float baseScale = uScale + s * 0.0;
  float h = fbmTorus(uv + vec2(s, s * 1.3), baseScale, 5, 2.0, mix(0.4, 0.65, uRoughness));

  // Микрозерно
  float micro = fbmTorus(uv + vec2(s * 2.7, s * 0.7), baseScale * 8.0, 3, 2.0, 0.5);
  h = mix(h, h * 0.85 + micro * 0.15, 0.6);

  // Трещины через Voronoi F2-F1: узкая область рёбер ячеек
  if (uCrackAmount > 0.001) {
    float crackGrid = floor(uScale * 1.6) + 4.0;
    vec3 vor = voronoiTile(uv, crackGrid, floor(uSeed));
    float edge = vor.y - vor.x;
    float crack = 1.0 - smoothstep(0.0, 0.06, edge);  // 1 на ребре, 0 внутри
    h -= crack * uCrackAmount * 0.35;
  }

  h = remapContrast(clamp(h, 0.0, 1.0), uContrast);
  h *= mix(0.4, 1.0, uDepth);

  gl_FragColor = vec4(h, h, h, 1.0);
}
