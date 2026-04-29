import * as THREE from 'three';
import { encode as encodePng } from 'fast-png';
import { NoiseRenderer } from './NoiseRenderer';

export type ExportBitDepth = 8 | 16;

/**
 * Сохранить heightmap в PNG.
 * 16-bit greyscale через fast-png — endianness обрабатывается библиотекой.
 */
export function encodeHeightmapPng(
  field: Float32Array,
  size: number,
  depth: ExportBitDepth,
): Blob {
  if (depth === 8) {
    const data = new Uint8Array(size * size);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.round(Math.min(1, Math.max(0, field[i])) * 255);
    }
    const png = encodePng({ width: size, height: size, data, depth: 8, channels: 1 });
    return new Blob([toArrayBuffer(png)], { type: 'image/png' });
  }
  // 16-bit greyscale
  const data = new Uint16Array(size * size);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(Math.min(1, Math.max(0, field[i])) * 65535);
  }
  const png = encodePng({ width: size, height: size, data, depth: 16, channels: 1 });
  return new Blob([toArrayBuffer(png)], { type: 'image/png' });
}

/** RGBA 8-bit PNG (для normal/AO/roughness). */
export function encodeRgbaPng(rgba: Float32Array, size: number, opaqueWhite = false): Blob {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o] = clamp255(rgba[o] * 255);
    data[o + 1] = clamp255(rgba[o + 1] * 255);
    data[o + 2] = clamp255(rgba[o + 2] * 255);
    data[o + 3] = opaqueWhite ? 255 : clamp255(rgba[o + 3] * 255);
  }
  const png = encodePng({ width: size, height: size, data, depth: 8, channels: 4 });
  return new Blob([toArrayBuffer(png)], { type: 'image/png' });
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Преобразовать Uint8Array, который может быть view на SharedArrayBuffer/non-transferable buffer,
 * в свежий ArrayBuffer для Blob.
 */
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  if (arr.byteOffset === 0 && arr.byteLength === arr.buffer.byteLength && arr.buffer instanceof ArrayBuffer) {
    return arr.buffer;
  }
  const out = new ArrayBuffer(arr.byteLength);
  new Uint8Array(out).set(arr);
  return out;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Высокоуровневая обёртка: прочитать heightmap-target как Float32, закодировать в PNG, скачать.
 */
export async function exportHeightmap(
  noise: NoiseRenderer,
  target: THREE.WebGLRenderTarget,
  filename: string,
  depth: ExportBitDepth,
): Promise<void> {
  const field = noise.readHeightField(target);
  const blob = encodeHeightmapPng(field, target.width, depth);
  downloadBlob(blob, filename);
}

export async function exportDerivedRGBA(
  noise: NoiseRenderer,
  target: THREE.WebGLRenderTarget,
  filename: string,
): Promise<void> {
  const rgba = noise.readRGBA(target);
  const blob = encodeRgbaPng(rgba, target.width, true);
  downloadBlob(blob, filename);
}
