import type * as THREE from 'three';

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  uniform: string; // имя в шейдере (с префиксом u)
}

export interface Preset {
  name: string;
  values: Record<string, number>;
}

export interface MaterialDef {
  id: string;
  name: string;
  fragSource: string;
  params: ParamSpec[];
  presets: Preset[];
  /** Глубина displacement в превью (множитель displacementScale у MeshStandardMaterial). */
  displacementScale: number;
}

export type ParamValues = Record<string, number>;

export function paramDefaults(def: MaterialDef): ParamValues {
  const out: ParamValues = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}

export function buildUniforms(def: MaterialDef, values: ParamValues): Record<string, { value: number }> {
  const u: Record<string, { value: number }> = {};
  for (const p of def.params) {
    u[p.uniform] = { value: values[p.key] ?? p.default };
  }
  return u;
}

export function applyPreset(def: MaterialDef, presetName: string, current: ParamValues): ParamValues {
  const preset = def.presets.find((p) => p.name === presetName);
  if (!preset) return current;
  return { ...current, ...preset.values };
}

export type MaterialUniforms = ReturnType<typeof buildUniforms>;
export type _U = THREE.Uniform; // pin import
