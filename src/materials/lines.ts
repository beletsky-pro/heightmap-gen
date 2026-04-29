import fragSource from '../shaders/lines.frag';
import type { MaterialDef } from './types';

export const lines: MaterialDef = {
  id: 'lines',
  name: 'Линии',
  fragSource,
  displacementScale: 0.06,
  params: [
    { key: 'freq',      label: 'Частота (линий)',  min: 1,    max: 40,  step: 1,    default: 12,  uniform: 'uFreq' },
    { key: 'lineWidth', label: 'Ширина линии',     min: 0.05, max: 0.95,step: 0.01, default: 0.4, uniform: 'uLineWidth' },
    { key: 'rounding',  label: 'Скругление края',  min: 0,    max: 1,   step: 0.01, default: 0.3, uniform: 'uRounding' },
    { key: 'convexity', label: 'Выпуклость',       min: 0,    max: 1,   step: 0.01, default: 0.85,uniform: 'uConvexity' },
    { key: 'angle',     label: 'Угол (0/45/90)',   min: 0,    max: 90,  step: 45,   default: 0,   uniform: 'uAngle' },
    { key: 'seed',      label: 'Seed',             min: 0,    max: 1000,step: 1,    default: 1,   uniform: 'uSeed' },
    { key: 'depth',     label: 'Глубина',          min: 0,    max: 1,   step: 0.01, default: 0.7, uniform: 'uDepth' },
  ],
  presets: [
    { name: 'Опалубка',     values: { freq: 8,  lineWidth: 0.7, rounding: 0.15, convexity: 0.6, angle: 0, depth: 0.5 } },
    { name: 'Тонкие рейки', values: { freq: 24, lineWidth: 0.3, rounding: 0.4,  convexity: 0.85, angle: 0, depth: 0.7 } },
    { name: 'Гофре',        values: { freq: 16, lineWidth: 0.5, rounding: 1.0,  convexity: 1.0, angle: 0, depth: 0.85 } },
    { name: 'Диагональ',    values: { freq: 14, lineWidth: 0.4, rounding: 0.3,  convexity: 0.8, angle: 45,depth: 0.7 } },
  ],
};
