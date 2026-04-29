import * as THREE from 'three';
import UPNG from 'upng-js';
import { NoiseRenderer } from './NoiseRenderer';

export type ExportBitDepth = 8 | 16;

interface RawField {
  width: number;
  height: number;
  /** Либо Float32Array (R-канал, [0..1]), либо Uint8Array (R-канал, [0..255]) */
  data: Float32Array | Uint8Array;
}

/**
 * Сохранить heightmap в PNG.
 * 16-bit greyscale через UPNG.encodeLL — критичный момент: PNG требует big-endian, JS little-endian.
 */
export function encodeHeightmapPng(
  field: Float32Array,
  size: number,
  depth: ExportBitDepth,
): Blob {
  if (depth === 8) {
    // Через canvas быстрее всего
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(Math.min(1, Math.max(0, field[i])) * 255);
      const o = i * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Synchronous via toDataURL fallback не нужен — toBlob имеет сразу
    // но для синхронности возвращаем через dataURL
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToBlob(dataUrl);
  }

  // 16-bit greyscale
  const px = size * size;
  const buf = new ArrayBuffer(px * 2);
  const dv = new DataView(buf);
  for (let i = 0; i < px; i++) {
    const v = Math.round(Math.min(1, Math.max(0, field[i])) * 65535);
    dv.setUint16(i * 2, v, false); // big-endian — обязательно для PNG
  }
  const png = UPNG.encodeLL([buf], size, size, 1, 0, 16);
  return new Blob([png], { type: 'image/png' });
}

/** RGBA 8-bit PNG (для normal/AO/roughness). */
export function encodeRgbaPng(rgba: Float32Array, size: number, opaqueWhite = false): Blob {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    img.data[o] = clamp255(rgba[o] * 255);
    img.data[o + 1] = clamp255(rgba[o + 1] * 255);
    img.data[o + 2] = clamp255(rgba[o + 2] * 255);
    img.data[o + 3] = opaqueWhite ? 255 : clamp255(rgba[o + 3] * 255);
  }
  ctx.putImageData(img, 0, 0);
  return dataUrlToBlob(canvas.toDataURL('image/png'));
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function dataUrlToBlob(url: string): Blob {
  const [meta, b64] = url.split(',');
  const mime = meta.match(/data:([^;]+);base64/)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
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
 * Высокоуровневая обёртка: сгенерировать heightmap нужного размера в R-target,
 * прочитать как Float32, закодировать в PNG (8 или 16 бит), скачать.
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
