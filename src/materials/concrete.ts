import fragSource from '../shaders/concrete.frag';
import type { MaterialDef } from './types';

export const concrete: MaterialDef = {
  id: 'concrete',
  name: 'Бетон',
  fragSource,
  displacementScale: 0.08,
  params: [
    { key: 'scale',       label: 'Масштаб',      min: 0.5, max: 8,    step: 0.1,  default: 3.5, uniform: 'uScale' },
    { key: 'roughness',   label: 'Шероховатость',min: 0,   max: 1,    step: 0.01, default: 0.55, uniform: 'uRoughness' },
    { key: 'crackAmount', label: 'Трещины',      min: 0,   max: 1,    step: 0.01, default: 0.0,  uniform: 'uCrackAmount' },
    { key: 'seed',        label: 'Seed',         min: 0,   max: 1000, step: 1,    default: 17,   uniform: 'uSeed' },
    { key: 'contrast',    label: 'Контраст',     min: 0.5, max: 2,    step: 0.01, default: 1.1,  uniform: 'uContrast' },
    { key: 'depth',       label: 'Глубина',      min: 0,   max: 1,    step: 0.01, default: 0.7,  uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Гладкий',    values: { scale: 2.0, roughness: 0.3, crackAmount: 0.0, contrast: 0.95, depth: 0.4 } },
    { name: 'Стандартный',values: { scale: 3.5, roughness: 0.55, crackAmount: 0.0, contrast: 1.1,  depth: 0.7 } },
    { name: 'Старый',     values: { scale: 4.5, roughness: 0.7,  crackAmount: 0.45, contrast: 1.25, depth: 0.9 } },
    { name: 'Грубый',     values: { scale: 6.0, roughness: 0.85, crackAmount: 0.2,  contrast: 1.4,  depth: 1.0 } },
  ],
};
