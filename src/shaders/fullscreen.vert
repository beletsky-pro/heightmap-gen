// Fullscreen quad vertex shader (Three.js will provide `position` attribute when used with PlaneGeometry(2,2)).
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
