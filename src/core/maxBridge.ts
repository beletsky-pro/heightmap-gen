/**
 * Клиент HeightmapGen Bridge — POST карт на локальный helper.
 *
 * Сервер должен слушать http://127.0.0.1:7878 (запускается отдельно
 * через bridge/run.cmd; см. bridge/README.md).
 */

const DEFAULT_HOST = 'http://127.0.0.1:7878';

export interface BridgeStatus {
  online: boolean;
  version?: string;
  error?: string;
}

export interface BridgeApplyMaps {
  /** data URL формата `data:image/png;base64,...`. Ключи произвольные, но
   *  apply_template.ms ожидает: height16, height8, normal, ao, roughness, mask. */
  height16?: string;
  height8?: string;
  normal?: string;
  ao?: string;
  roughness?: string;
  mask?: string;
}

export interface BridgeApplyConfig {
  /** Сила Displace-модификатора (units 3ds Max). По умолчанию 1.5. */
  displacementScale?: number;
  /** Итерации Tessellate (0..4). По умолчанию 2. */
  tessellate?: number;
  /** Добавлять ли UVWMap shrinkwrap. По умолчанию true. */
  addUVW?: boolean;
  /** Применять ли PhysicalMaterial. По умолчанию true. */
  applyMaterial?: boolean;
  /** Имя материала. По умолчанию "HeightmapGen". */
  materialName?: string;
  /** "auto" (по face-selection), "object" (всегда весь объект), "faces" (только грани). */
  applyMode?: 'auto' | 'object' | 'faces';
  /** "full" (rebuild material + modifier stack) | "live" (refresh bitmaps only). */
  mode?: 'full' | 'live';
  /** Тип UVWMap-проекции. "auto" — по классу объекта. */
  mappingType?: 'auto' | 'planar' | 'cylindrical' | 'spherical' | 'shrinkwrap' | 'box';
}

export interface BridgeSelection {
  hasSelection: boolean;
  name?: string;
  class?: string;
  bboxMin?: [number, number, number];
  bboxMax?: [number, number, number];
  size?: [number, number, number];
  selectedFaces?: number;
  unit?: string;
}

export interface BridgeApplyResponse {
  status: 'queued';
  session: string;
  assets: string;
  ms: string;
}

export class MaxBridge {
  constructor(public host: string = DEFAULT_HOST) {}

  async ping(timeoutMs = 1500): Promise<BridgeStatus> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`${this.host}/ping`, { signal: ctl.signal });
      if (!r.ok) return { online: false, error: `HTTP ${r.status}` };
      const j = await r.json();
      return { online: true, version: j.version };
    } catch (e) {
      return { online: false, error: (e as Error).message };
    } finally {
      clearTimeout(t);
    }
  }

  async selection(timeoutMs = 1500): Promise<BridgeSelection> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`${this.host}/selection`, { signal: ctl.signal });
      if (!r.ok) return { hasSelection: false };
      return await r.json();
    } catch {
      return { hasSelection: false };
    } finally {
      clearTimeout(t);
    }
  }

  async apply(maps: BridgeApplyMaps, config: BridgeApplyConfig = {}): Promise<BridgeApplyResponse> {
    const r = await fetch(`${this.host}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maps, config }),
    });
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { msg = (await r.json()).error ?? msg; } catch { /* */ }
      throw new Error(msg);
    }
    return r.json();
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
