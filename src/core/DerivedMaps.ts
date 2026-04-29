import * as THREE from 'three';
import { NoiseRenderer } from './NoiseRenderer';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import normalFrag from '../shaders/normal.frag?raw';
import aoFrag from '../shaders/ao.frag?raw';
import roughnessFrag from '../shaders/roughness.frag?raw';

export interface DerivedSettings {
  normalStrength: number;   // 1..10
  flipY: boolean;           // false = OpenGL, true = DirectX
  aoStrength: number;       // 1..6
  roughnessBase: number;    // 0.3..0.95
  roughnessDetail: number;  // 0..10
}

export const defaultDerived: DerivedSettings = {
  normalStrength: 4.0,
  flipY: false,
  aoStrength: 3.0,
  roughnessBase: 0.7,
  roughnessDetail: 4.0,
};

export interface DerivedTargets {
  normal: THREE.WebGLRenderTarget;
  ao: THREE.WebGLRenderTarget;
  roughness: THREE.WebGLRenderTarget;
}

export function generateDerived(
  noise: NoiseRenderer,
  height: THREE.WebGLRenderTarget,
  settings: DerivedSettings,
): DerivedTargets {
  const size = height.width;
  const texel = new THREE.Vector2(1 / size, 1 / size);

  const normal = noise.createTarget(size, false, 'RGBA');
  const ao = noise.createTarget(size, false, 'RGBA');
  const roughness = noise.createTarget(size, false, 'RGBA');

  const baseUniforms = (extra: Record<string, THREE.IUniform>): Record<string, THREE.IUniform> => ({
    uHeight: { value: height.texture },
    uTexel: { value: texel },
    ...extra,
  });

  const normalMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: normalFrag,
    uniforms: baseUniforms({
      uStrength: { value: settings.normalStrength },
      uFlipY: { value: settings.flipY ? 1.0 : 0.0 },
    }),
  });
  noise.renderToTarget(normalMat, normal);
  normalMat.dispose();

  const aoMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: aoFrag,
    uniforms: baseUniforms({ uStrength: { value: settings.aoStrength } }),
  });
  noise.renderToTarget(aoMat, ao);
  aoMat.dispose();

  const roughMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: roughnessFrag,
    uniforms: baseUniforms({
      uBase: { value: settings.roughnessBase },
      uDetail: { value: settings.roughnessDetail },
    }),
  });
  noise.renderToTarget(roughMat, roughness);
  roughMat.dispose();

  return { normal, ao, roughness };
}
