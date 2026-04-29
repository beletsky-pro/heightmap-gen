import fragSource from '../shaders/stone.frag';
import type { MaterialDef } from './types';

export const stone: MaterialDef = {
  id: 'stone',
  name: 'Камень',
  fragSource,
  displacementScale: 0.12,
  params: [
    { key: 'scale',         label: 'Размер плиты', min: 2,    max: 15,   step: 1,    default: 6,   uniform: 'uScale' },
    { key: 'detail',        label: 'Детализация',  min: 0,    max: 1,    step: 0.01, default: 0.55,uniform: 'uDetail' },
    { key: 'edgeSharpness', label: 'Резкость швов',min: 0.01, max: 0.3,  step: 0.005,default: 0.08,uniform: 'uEdgeSharpness' },
    { key: 'seed',          label: 'Seed',         min: 0,    max: 1000, step: 1,    default: 99,  uniform: 'uSeed' },
    { key: 'contrast',      label: 'Контраст',     min: 0.5,  max: 2,    step: 0.01, default: 1.15,uniform: 'uContrast' },
    { key: 'depth',         label: 'Глубина',      min: 0,    max: 1,    step: 0.01, default: 0.85,uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Брусчатка',       values: { scale: 6,  detail: 0.45, edgeSharpness: 0.06, contrast: 1.15, depth: 0.85 } },
    { name: 'Дикий камень',    values: { scale: 4,  detail: 0.7,  edgeSharpness: 0.10, contrast: 1.25, depth: 1.0 } },
    { name: 'Кладка крупная',  values: { scale: 3,  detail: 0.35, edgeSharpness: 0.05, contrast: 1.05, depth: 0.7 } },
    { name: 'Галька',          values: { scale: 12, detail: 0.6,  edgeSharpness: 0.15, contrast: 1.1,  depth: 0.6 } },
  ],
};
