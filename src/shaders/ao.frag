// Cavity-AO: разница локального среднего и центра.
// Чёрный там, где центр ниже окружения (вмятины); белый на ровных и выпуклых.

precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uStrength;  // 1..6

#define R 4

void main() {
  float center = texture2D(uHeight, vUv).r;
  float sum = 0.0;
  float count = 0.0;
  for (int y = -R; y <= R; y++) {
    for (int x = -R; x <= R; x++) {
      vec2 o = vec2(float(x), float(y)) * uTexel;
      sum += texture2D(uHeight, vUv + o).r;
      count += 1.0;
    }
  }
  float avg = sum / count;
  float ao = 1.0 - max(0.0, avg - center) * uStrength;
  ao = clamp(ao, 0.0, 1.0);
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
