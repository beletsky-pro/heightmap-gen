import fragSource from '../shaders/waves.frag';
import type { MaterialDef } from './types';

export const waves: MaterialDef = {
  id: 'waves',
  name: 'Волны',
  fragSource,
  displacementScale: 0.06,
  params: [
    { key: 'freq',       label: 'Частота',           min: 1,  max: 30, step: 1,    default: 8,   uniform: 'uFreq' },
    { key: 'rounding',   label: 'Скругление',        min: 0,  max: 1,  step: 0.01, default: 0.85,uniform: 'uRounding' },
    { key: 'convexity',  label: 'Амплитуда',         min: 0,  max: 1,  step: 0.01, default: 0.85,uniform: 'uConvexity' },
    { key: 'crossWaves', label: 'Перекрёстные волны',min: 0,  max: 1,  step: 0.01, default: 0,   uniform: 'uCrossWaves' },
    { key: 'angle',      label: 'Угол (0/45/90)',    min: 0,  max: 90, step: 45,   default: 0,   uniform: 'uAngle' },
    { key: 'seed',       label: 'Seed',              min: 0,  max: 1000,step: 1,   default: 1,   uniform: 'uSeed' },
    { key: 'depth',      label: 'Глубина',           min: 0,  max: 1,  step: 0.01, default: 0.7, uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Мягкая рябь', values: { freq: 6,  rounding: 1.0, convexity: 0.7, crossWaves: 0,   angle: 0, depth: 0.5 } },
    { name: 'Стиральная доска', values: { freq: 14, rounding: 0.3, convexity: 0.95, crossWaves: 0, angle: 0, depth: 0.85 } },
    { name: 'Сетка ряби', values: { freq: 12, rounding: 0.7, convexity: 0.7, crossWaves: 1.0, angle: 0, depth: 0.7 } },
    { name: 'Шёлк',       values: { freq: 4,  rounding: 1.0, convexity: 0.45,crossWaves: 0,   angle: 0, depth: 0.35 } },
  ],
};
