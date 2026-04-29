import * as THREE from 'three';
import { NoiseRenderer } from './NoiseRenderer';
import type { MaterialDef, ParamValues } from '../materials/types';
import { buildUniforms } from '../materials/types';
import fullscreenVert from '../shaders/fullscreen.vert?raw';

export interface GeneratedMaps {
  height: THREE.WebGLRenderTarget;
}

/**
 * Сгенерировать heightmap для материала в float-target указанного размера.
 * Вызывающий код владеет target и должен потом dispose'ить.
 */
export function generateHeight(
  noise: NoiseRenderer,
  def: MaterialDef,
  values: ParamValues,
  size: number,
): GeneratedMaps {
  const target = noise.createTarget(size, true, 'R');
  const material = new THREE.ShaderMaterial({
    uniforms: buildUniforms(def, values) as Record<string, THREE.IUniform>,
    vertexShader: fullscreenVert,
    fragmentShader: def.fragSource,
  });
  noise.renderToTarget(material, target);
  material.dispose();
  return { height: target };
}
