#include "lib.glsl"

// Штукатурка — Voronoi (F2-F1) с порогом, имитирует Stucco-шейдер 3ds Max.
// Имена ползунков синхронны с ConcreteMoldTexture.ms: size / thickness / threshold / depth.

varying vec2 vUv;

uniform float uSize;        // crisp grid count
uniform float uThickness;   // 0.01..1 — ширина перехода
uniform float uThreshold;   // 0.1..0.9 — где «срез»
uniform float uDepth;
uniform float uSeed;
uniform float uContrast;

void main() {
  vec2 uv = vUv;
  float seed = floor(uSeed);
  float grid = max(2.0, floor(uSize));

  vec3 vor = voronoiTile(uv, grid, seed);
  float cells = vor.y - vor.x;  // F2-F1 — большие в плоскости, узкие на стыках

  float w = max(0.001, uThickness * 0.5);
  float h = smoothstep(uThreshold - w, uThreshold + w, cells);

  // Лёгкий FBM сверху — текстура самой штукатурки
  float bump = fbmTorus(uv + vec2(seed * 0.13, seed * 0.07), grid * 4.0, 2, 2.0, 0.5);
  h = h * 0.9 + (bump - 0.5) * 0.1;

  h = remapContrast(clamp(h, 0.0, 1.0), uContrast);
  h *= mix(0.4, 1.0, uDepth);

  gl_FragColor = vec4(h, h, h, 1.0);
}
