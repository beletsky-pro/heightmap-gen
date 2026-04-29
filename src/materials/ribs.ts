import fragSource from '../shaders/ribs.frag';
import type { MaterialDef } from './types';

export const ribs: MaterialDef = {
  id: 'ribs',
  name: 'Рёбра',
  fragSource,
  displacementScale: 0.08,
  params: [
    { key: 'freq',      label: 'Частота',         min: 1,    max: 30,  step: 1,    default: 10,  uniform: 'uFreq' },
    { key: 'size',      label: 'Размер ребра',    min: 0.2,  max: 1,   step: 0.01, default: 0.7, uniform: 'uSize' },
    { key: 'rounding',  label: 'Скругление (трг↔круг)', min: 0, max: 1, step: 0.01, default: 0.7, uniform: 'uRounding' },
    { key: 'convexity', label: 'Выпуклость',      min: 0,    max: 1,   step: 0.01, default: 1.0, uniform: 'uConvexity' },
    { key: 'angle',     label: 'Угол (0/45/90)',  min: 0,    max: 90,  step: 45,   default: 0,   uniform: 'uAngle' },
    { key: 'seed',      label: 'Seed',            min: 0,    max: 1000,step: 1,    default: 1,   uniform: 'uSeed' },
    { key: 'depth',     label: 'Глубина',         min: 0,    max: 1,   step: 0.01, default: 0.85,uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Полу-цилиндры', values: { freq: 10, size: 0.95, rounding: 1.0, convexity: 1.0, angle: 0, depth: 0.85 } },
    { name: 'Острые',        values: { freq: 14, size: 0.9,  rounding: 0.0, convexity: 1.0, angle: 0, depth: 0.85 } },
    { name: 'Тонкие',        values: { freq: 24, size: 0.4,  rounding: 0.6, convexity: 0.9, angle: 0, depth: 0.7 } },
    { name: 'Диагональ',     values: { freq: 12, size: 0.7,  rounding: 0.8, convexity: 1.0, angle: 45,depth: 0.85 } },
  ],
};
