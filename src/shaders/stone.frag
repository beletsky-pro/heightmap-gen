#include "lib.glsl"

// Камень — крупный Voronoi (плиты) + FBM-детали внутри каждой плиты.

varying vec2 vUv;

uniform float uScale;          // 2..15 — количество камней по стороне
uniform float uDetail;          // 0..1 — вес деталей внутри камня
uniform float uEdgeSharpness;   // 0.01..0.3 — ширина рёбер
uniform float uSeed;
uniform float uContrast;
uniform float uDepth;

void main() {
  vec2 uv = vUv;
  float seed = floor(uSeed);
  float grid = max(2.0, floor(uScale));

  vec3 vor = voronoiTile(uv, grid, seed);
  float edge = vor.y - vor.x;
  float plate = smoothstep(0.0, max(0.001, uEdgeSharpness), edge); // 0 на ребре, 1 в середине плиты

  // Деталь внутри камня, со сдвигом по cellHash, чтобы у каждой плиты свой шум
  vec2 detailOff = vec2(vor.z, fract(vor.z * 7.31)) * 100.0;
  float detail = fbmTorus(uv + detailOff, grid * 6.0, 4, 2.0, 0.55);

  // База: плата немного «округлая» — чуть выпуклая в середине
  float roundness = plate * 0.7 + 0.15;

  float h = mix(roundness, detail, uDetail);
  // На рёбрах сильно темнее (швы)
  h *= mix(0.4, 1.0, plate);

  h = remapContrast(clamp(h, 0.0, 1.0), uContrast);
  h *= mix(0.4, 1.0, uDepth);

  gl_FragColor = vec4(h, h, h, 1.0);
}
