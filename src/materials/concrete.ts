import fragSource from '../shaders/concrete.frag';
import type { MaterialDef } from './types';

export const concrete: MaterialDef = {
  id: 'concrete',
  name: 'Бетон',
  fragSource,
  displacementScale: 0.05,
  params: [
    { key: 'scale',     label: 'Масштаб',         min: 1,   max: 8,    step: 0.1,  default: 3.0, uniform: 'uScale' },
    { key: 'pores',     label: 'Поры (мелкие)',   min: 0,   max: 1,    step: 0.01, default: 0.65,uniform: 'uPores' },
    { key: 'caverns',   label: 'Каверны (крупн.)',min: 0,   max: 1,    step: 0.01, default: 0.4, uniform: 'uCaverns' },
    { key: 'cracks',    label: 'Волосяные трещины',min: 0,   max: 1,    step: 0.01, default: 0.25,uniform: 'uCracks' },
    { key: 'aggregate', label: 'Зернистость',     min: 0,   max: 1,    step: 0.01, default: 0.7, uniform: 'uAggregate' },
    { key: 'seed',      label: 'Seed',            min: 0,   max: 1000, step: 1,    default: 17,  uniform: 'uSeed' },
    { key: 'contrast',  label: 'Контраст',        min: 0.5, max: 2,    step: 0.01, default: 1.05,uniform: 'uContrast' },
    { key: 'depth',     label: 'Глубина',         min: 0,   max: 1,    step: 0.01, default: 0.7, uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Гладкий лофт',     values: { scale: 2.0, pores: 0.3,  caverns: 0.1,  cracks: 0.05, aggregate: 0.5, contrast: 0.95, depth: 0.45 } },
    { name: 'Архитектурный',    values: { scale: 3.0, pores: 0.65, caverns: 0.4,  cracks: 0.25, aggregate: 0.7, contrast: 1.05, depth: 0.7 } },
    { name: 'Опалубка',         values: { scale: 2.5, pores: 0.85, caverns: 0.55, cracks: 0.35, aggregate: 0.65,contrast: 1.15, depth: 0.85 } },
    { name: 'Старый',           values: { scale: 4.0, pores: 0.9,  caverns: 0.75, cracks: 0.6,  aggregate: 0.8, contrast: 1.25, depth: 1.0 } },
    { name: 'Полированный',     values: { scale: 1.5, pores: 0.15, caverns: 0.05, cracks: 0.0,  aggregate: 0.3, contrast: 0.9,  depth: 0.3 } },
  ],
};
