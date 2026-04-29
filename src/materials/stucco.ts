import fragSource from '../shaders/stucco.frag';
import type { MaterialDef } from './types';

export const stucco: MaterialDef = {
  id: 'stucco',
  name: 'Штукатурка',
  fragSource,
  displacementScale: 0.06,
  params: [
    { key: 'size',      label: 'Размер ячейки', min: 4,  max: 60,   step: 1,    default: 18,  uniform: 'uSize' },
    { key: 'thickness', label: 'Толщина шва',   min: 0.05,max: 1,   step: 0.01, default: 0.35,uniform: 'uThickness' },
    { key: 'threshold', label: 'Порог',         min: 0.1, max: 0.9, step: 0.01, default: 0.5, uniform: 'uThreshold' },
    { key: 'depth',     label: 'Глубина',       min: 0,   max: 1,   step: 0.01, default: 0.7, uniform: 'uDepth' },
    { key: 'seed',      label: 'Seed',          min: 0,   max: 1000,step: 1,    default: 7,   uniform: 'uSeed' },
    { key: 'contrast',  label: 'Контраст',      min: 0.5, max: 2,   step: 0.01, default: 1.1, uniform: 'uContrast' },
  ],
  presets: [
    // Имена/значения близки к ConcreteMoldTexture.ms-пресетам
    { name: 'Мелкая зернистая', values: { size: 8,  thickness: 0.20, threshold: 0.50, depth: 0.4 } },
    { name: 'Классическая',     values: { size: 16, thickness: 0.35, threshold: 0.50, depth: 0.6 } },
    { name: 'Грубая короед',    values: { size: 24, thickness: 0.50, threshold: 0.55, depth: 0.85 } },
    { name: 'Скала',            values: { size: 30, thickness: 0.40, threshold: 0.60, depth: 1.0 } },
  ],
};
