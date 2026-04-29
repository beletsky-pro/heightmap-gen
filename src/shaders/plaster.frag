#include "lib.glsl"

varying vec2 vUv;

uniform float uScale;       // 0.5 .. 8 — крупность мягких волн
uniform float uMicroGrain;  // 0..0.3 — микрозернистость
uniform float uSmoothness;  // 0.5..1.5 — ширина smoothstep середины
uniform float uSeed;
uniform float uContrast;
uniform float uDepth;

void main() {
  vec2 uv = vUv;
  float s = uSeed * 0.137;

  // Низкочастотная мягкая основа
  float h = fbmTorus(uv + vec2(s, s * 1.7), uScale * 0.6, 3, 2.0, 0.45) * 0.95;

  // Микрозернистость — заметно тоньше
  if (uMicroGrain > 0.001) {
    float micro = fbmTorus(uv + vec2(s * 3.1, s * 0.9), uScale * 22.0, 2, 2.0, 0.5);
    h = h * (1.0 - uMicroGrain * 0.5) + (micro - 0.5) * uMicroGrain;
  }

  // Сглаживаем середину — больше плоских зон, как у выровненной шпаклёвки
  float mid = 0.5;
  float w = clamp(uSmoothness * 0.3, 0.05, 0.45);
  h = smoothstep(mid - w, mid + w, h);

  h = remapContrast(clamp(h, 0.0, 1.0), uContrast);
  h = mix(0.5, h, mix(0.4, 1.0, uDepth));

  gl_FragColor = vec4(h, h, h, 1.0);
}
