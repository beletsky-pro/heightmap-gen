#include "lib.glsl"

// Архитектурный (декоративный) бетон.
// Слои (по убыванию амплитуды):
//  1. Базовая шагрень — низкочастотный fbm, общая неравномерность поверхности.
//  2. Агрегат — высокочастотный fbm, мелкое каменистое зерно.
//  3. Поры (мелкие, плотные) — раковинки 1-3мм от воздушных пузырей.
//  4. Каверны (крупные, редкие) — большие неровные углубления.
//  5. Волосяные трещины — еле заметные тонкие линии.

varying vec2 vUv;

uniform float uScale;          // 1..8 — общий масштаб
uniform float uPores;          // 0..1 — интенсивность мелких пор
uniform float uCaverns;        // 0..1 — интенсивность крупных каверн
uniform float uCracks;         // 0..1 — волосяные трещины
uniform float uAggregate;      // 0..1 — зернистость
uniform float uSeed;           // 0..1000
uniform float uContrast;
uniform float uDepth;

void main() {
  vec2 uv = vUv;
  float seed = uSeed * 0.137;

  // ---- 1. Базовая шагрень — поверхность чуть неровная, плавно волнистая
  float base = fbmTorus(uv + vec2(seed, seed * 1.3), uScale * 1.2, 4, 2.0, 0.5);
  // Сжимаем диапазон базы — она должна быть «почти ровной»
  base = 0.55 + (base - 0.5) * 0.35;  // ~[0.37..0.72]

  // ---- 2. Агрегат — мелкое каменистое зерно, добавляет шероховатость
  float aggr = fbmTorus(uv + vec2(seed * 2.7, seed * 0.7), uScale * 14.0, 3, 2.0, 0.55);
  base += (aggr - 0.5) * 0.06 * uAggregate;

  // ---- 3. Мелкие поры — два слоя разных размеров, плотно
  float poresSmall = poresLayer(uv, max(20.0, uScale * 12.0), 0.55, 0.22, 0.55, floor(uSeed));
  float poresMid   = poresLayer(uv, max(10.0, uScale *  6.0), 0.30, 0.28, 0.55, floor(uSeed * 1.7) + 11.0);
  // Поры — это вмятины (вычитание)
  base -= poresSmall * 0.08 * uPores;
  base -= poresMid   * 0.14 * uPores;

  // ---- 4. Крупные каверны — большие, редкие, глубокие, неровной формы
  float cavernGrid = max(3.0, uScale * 1.5);
  float cavernsRaw = poresLayer(uv, cavernGrid, 0.18, 0.40, 0.7, floor(uSeed * 0.83) + 73.0);
  // Деформируем форму каверны fbm-шумом, чтобы она не была идеально круглой
  float cavernShape = fbmTorus(uv + vec2(seed * 4.2, seed * 1.9), uScale * 4.0, 3, 2.0, 0.5);
  cavernsRaw *= mix(0.6, 1.1, cavernShape);
  base -= clamp(cavernsRaw, 0.0, 1.0) * 0.22 * uCaverns;

  // ---- 5. Волосяные трещины — две сетки с разными размерами и направлениями
  float cracks1 = hairlineCracks(uv, max(8.0, uScale * 5.0),  0.012, 0.04, 8.0, floor(uSeed) + 0.0);
  float cracks2 = hairlineCracks(uv, max(5.0, uScale * 3.0),  0.008, 0.03, 12.0, floor(uSeed) + 41.0);
  float cracks = max(cracks1, cracks2 * 0.7);
  base -= cracks * 0.10 * uCracks;

  // ---- Финал
  float h = clamp(base, 0.0, 1.0);
  h = remapContrast(h, uContrast);
  h *= mix(0.4, 1.0, uDepth);

  gl_FragColor = vec4(h, h, h, 1.0);
}
