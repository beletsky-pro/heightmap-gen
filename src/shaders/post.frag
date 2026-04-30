// Post-process для heightmap: гамма + контраст вокруг 0.5 + опц. бинаризация.
// Используется для получения «чёрно-белой» (высококонтрастной) карты displacement.

precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform float uContrast;   // 1 = identity, >1 = резче, <1 = мягче
uniform float uGamma;      // 1 = identity, <1 = темнее, >1 = светлее
uniform float uInvert;     // 0..1, инвертирует результат (1 = инверт)
uniform float uBinarize;   // 0..1, 0 = плавно, 1 = чистая B&W бинаризация по 0.5

void main() {
  float h = texture2D(uHeight, vUv).r;
  h = clamp(h, 0.0, 1.0);

  // Гамма
  h = pow(h, 1.0 / max(uGamma, 0.01));

  // Контраст вокруг 0.5
  h = (h - 0.5) * uContrast + 0.5;
  h = clamp(h, 0.0, 1.0);

  // Бинаризация — мягкий smoothstep, ширина зависит от уровня
  if (uBinarize > 0.001) {
    float binW = mix(0.5, 0.005, uBinarize);
    float binH = smoothstep(0.5 - binW, 0.5 + binW, h);
    h = mix(h, binH, uBinarize);
  }

  // Инверсия
  h = mix(h, 1.0 - h, uInvert);

  gl_FragColor = vec4(h, h, h, 1.0);
}
