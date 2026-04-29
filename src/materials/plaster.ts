import fragSource from '../shaders/plaster.frag';
import type { MaterialDef } from './types';

export const plaster: MaterialDef = {
  id: 'plaster',
  name: 'Шпаклёвка',
  fragSource,
  displacementScale: 0.04,
  params: [
    { key: 'scale',      label: 'Масштаб',         min: 0.5, max: 8,    step: 0.1,  default: 2.5, uniform: 'uScale' },
    { key: 'microGrain', label: 'Микрозерно',      min: 0,   max: 0.3,  step: 0.005,default: 0.05,uniform: 'uMicroGrain' },
    { key: 'smoothness', label: 'Гладкость',       min: 0.5, max: 1.5,  step: 0.01, default: 1.0, uniform: 'uSmoothness' },
    { key: 'seed',       label: 'Seed',            min: 0,   max: 1000, step: 1,    default: 42,  uniform: 'uSeed' },
    { key: 'contrast',   label: 'Контраст',        min: 0.5, max: 2,    step: 0.01, default: 0.95,uniform: 'uContrast' },
    { key: 'depth',      label: 'Глубина',         min: 0,   max: 1,    step: 0.01, default: 0.4, uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Свежая',   values: { scale: 2.5, microGrain: 0.04, smoothness: 1.1, contrast: 0.95, depth: 0.35 } },
    { name: 'Стандарт', values: { scale: 3.0, microGrain: 0.07, smoothness: 1.0, contrast: 1.0,  depth: 0.5 } },
    { name: 'С разводами', values: { scale: 1.5, microGrain: 0.05, smoothness: 0.8, contrast: 1.15, depth: 0.6 } },
    { name: 'Зернистая', values: { scale: 4.0, microGrain: 0.18, smoothness: 1.2, contrast: 1.05, depth: 0.45 } },
  ],
};
