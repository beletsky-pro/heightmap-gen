import * as THREE from 'three';
import { NoiseRenderer } from './NoiseRenderer';
import type { MaterialDef, ParamValues } from '../materials/types';
import { buildUniforms } from '../materials/types';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import postFrag from '../shaders/post.frag?raw';

export interface PostSettings {
  contrast: number;  // 1 = identity, >1 = резче
  gamma: number;     // 1 = identity
  invert: boolean;
  binarize: number;  // 0..1
}

export const defaultPost: PostSettings = {
  contrast: 1.0,
  gamma: 1.0,
  invert: false,
  binarize: 0,
};

export interface GeneratedMaps {
  /** Финальный heightmap (после пост-обработки). Это canonical карта для preview/export/derived. */
  height: THREE.WebGLRenderTarget;
}

/**
 * Сгенерировать heightmap: рендер материала → пост-обработка контраста/гаммы.
 * Возвращает float-target нужного размера. Caller владеет и должен dispose.
 */
export function generateHeight(
  noise: NoiseRenderer,
  def: MaterialDef,
  values: ParamValues,
  size: number,
  post: PostSettings = defaultPost,
): GeneratedMaps {
  // 1. Сырая heightmap из шейдера материала
  const raw = noise.createTarget(size, true, 'R');
  const matMaterial = new THREE.ShaderMaterial({
    uniforms: buildUniforms(def, values) as Record<string, THREE.IUniform>,
    vertexShader: fullscreenVert,
    fragmentShader: def.fragSource,
  });
  noise.renderToTarget(matMaterial, raw);
  matMaterial.dispose();

  // Если пост-обработка идентичная, возвращаем сырую
  if (post.contrast === 1 && post.gamma === 1 && !post.invert && post.binarize === 0) {
    return { height: raw };
  }

  // 2. Пост-пасс: контраст / гамма / бинаризация / инверсия
  const final = noise.createTarget(size, true, 'R');
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      uHeight:   { value: raw.texture },
      uContrast: { value: post.contrast },
      uGamma:    { value: post.gamma },
      uInvert:   { value: post.invert ? 1.0 : 0.0 },
      uBinarize: { value: post.binarize },
    },
    vertexShader: fullscreenVert,
    fragmentShader: postFrag,
  });
  noise.renderToTarget(postMat, final);
  postMat.dispose();
  raw.dispose();

  return { height: final };
}
