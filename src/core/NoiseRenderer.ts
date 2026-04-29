import * as THREE from 'three';

export interface RenderTargetCaps {
  floatRender: boolean;
  halfFloatRender: boolean;
  redFormat: boolean;
}

export function detectCaps(renderer: THREE.WebGLRenderer): RenderTargetCaps {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const isWebGL2 = gl instanceof WebGL2RenderingContext;
  const floatRender = isWebGL2 && !!gl.getExtension('EXT_color_buffer_float');
  const halfFloatRender = floatRender || (isWebGL2 && !!gl.getExtension('EXT_color_buffer_half_float'));
  return {
    floatRender,
    halfFloatRender,
    redFormat: isWebGL2,
  };
}

export type Uniforms = Record<string, { value: number | THREE.Vector2 | THREE.Texture | null }>;

export class NoiseRenderer {
  private fullscreenScene: THREE.Scene;
  private fullscreenCamera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;
  private caps: RenderTargetCaps;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.caps = detectCaps(renderer);
    this.fullscreenScene = new THREE.Scene();
    this.fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    this.fullscreenScene.add(this.quad);
  }

  getCaps(): RenderTargetCaps {
    return this.caps;
  }

  /**
   * Создаёт offscreen target для шейдерной генерации.
   * `wantFloat` — нужен ли точный float (для деривации normal/AO нужен).
   * Если float недоступен — fallback на half-float, затем на UnsignedByte.
   */
  createTarget(size: number, wantFloat: boolean, channels: 'R' | 'RGBA'): THREE.WebGLRenderTarget {
    let type: THREE.TextureDataType = THREE.UnsignedByteType;
    if (wantFloat) {
      if (this.caps.floatRender) type = THREE.FloatType;
      else if (this.caps.halfFloatRender) type = THREE.HalfFloatType;
    }
    const format =
      channels === 'R' && this.caps.redFormat ? THREE.RedFormat : THREE.RGBAFormat;
    return new THREE.WebGLRenderTarget(size, size, {
      format,
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
  }

  /** Рендер ShaderMaterial в target. Material должен использовать общий fullscreen.vert. */
  renderToTarget(
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ): void {
    this.quad.material = material;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fullscreenScene, this.fullscreenCamera);
    this.renderer.setRenderTarget(prev);
  }

  /**
   * Чтение всех пикселей target обратно в CPU как Float32 в диапазоне [0..1] (R-канал).
   * Работает с FloatType, HalfFloatType (через WebGL native readPixels HALF_FLOAT) или UnsignedByte.
   */
  readHeightField(target: THREE.WebGLRenderTarget): Float32Array {
    const w = target.width;
    const h = target.height;
    const isRGBA = target.texture.format === THREE.RGBAFormat;
    const stride = isRGBA ? 4 : 1;
    const totalElems = w * h * stride;

    let raw: Float32Array;
    if (target.texture.type === THREE.FloatType) {
      const buf = new Float32Array(totalElems);
      this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      raw = buf;
    } else if (target.texture.type === THREE.HalfFloatType) {
      // Three.js readRenderTargetPixels с HalfFloatType возвращает Uint16Array half-float bits.
      const buf = new Uint16Array(totalElems);
      this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      raw = new Float32Array(totalElems);
      for (let i = 0; i < totalElems; i++) raw[i] = halfToFloat(buf[i]);
    } else {
      const buf = new Uint8Array(totalElems);
      this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      raw = new Float32Array(totalElems);
      for (let i = 0; i < totalElems; i++) raw[i] = buf[i] / 255;
    }

    if (!isRGBA) return raw;

    // Извлекаем R-канал
    const out = new Float32Array(w * h);
    for (let i = 0, j = 0; j < w * h; i += 4, j++) out[j] = raw[i];
    return out;
  }

  /**
   * Чтение RGBA-target в Float32Array длины w*h*4.
   * Используется для normal/AO/roughness, которые рендерятся в RGBA8.
   */
  readRGBA(target: THREE.WebGLRenderTarget): Float32Array {
    const w = target.width;
    const h = target.height;
    const total = w * h * 4;
    if (target.texture.type === THREE.FloatType) {
      const buf = new Float32Array(total);
      this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      return buf;
    }
    if (target.texture.type === THREE.HalfFloatType) {
      const buf = new Uint16Array(total);
      this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      const out = new Float32Array(total);
      for (let i = 0; i < total; i++) out[i] = halfToFloat(buf[i]);
      return out;
    }
    const buf = new Uint8Array(total);
    this.renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
    const out = new Float32Array(total);
    for (let i = 0; i < total; i++) out[i] = buf[i] / 255;
    return out;
  }

  dispose() {
    (this.quad.material as THREE.Material).dispose();
    this.quad.geometry.dispose();
  }
}

// IEEE 754 half-precision (16-bit) → float32
function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
