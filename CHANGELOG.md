# Changelog

## v0.1.1 — 2026-04-29

### Bug fixes
- `effect_update_depth_exceeded` при загрузке: `$effect` бесконечно перезапускался, потому что `regenerate()` писал в `$state`-переменные (heightTarget и др.), которые читал же сам через `disposeTargets()`. Обёрнут в `untrack(() => regenerate())`.
- Параметры материала теперь читаются явно через цикл по `currentDef.params` — `void currentValues` не подписывается на nested-мутации в Svelte 5 $state-прокси.

### UX
- Добавлен SVG-favicon (убирает 404 в консоли).

## v0.1.0 — 2026-04-29

Первый релиз. MVP онлайн-генератора heightmap/displacement текстур для 3ds Max.

### Материалы
- Бетон — FBM Perlin + микрозерно + опц. трещины (Voronoi-edges)
- Шпаклёвка — мягкие низкочастотные волны + микрозернистость
- Штукатурка — Voronoi cellular threshold (синхронен с MAXScript Stucco)
- Камень — крупный Voronoi (плиты) + FBM-детали внутри плит

У каждого 6 ползунков и 4 пресета.

### Карты
- Heightmap PNG 16-bit (UPNG.js + big-endian Uint16)
- Heightmap PNG 8-bit
- Normal map (Sobel, тогл OpenGL/DirectX)
- AO (cavity)
- Roughness (база + локальная дисперсия)

Все tileable через 4D-перлин на торе и Voronoi на целочисленной grid.

### UI
- 3D-превью на Three.js (plane / box / sphere, OrbitControls)
- Тогл бесшовного замощения 1×1 / 2×2 / 4×4
- 2D-превью каждой карты с кликом «скачать»
- Размеры экспорта 1024 / 2048 / 4096
- Random seed
- Инструкция «как подсунуть в 3ds Max»

### Стэк
TypeScript + Vite 5 + Svelte 5 + Three.js 0.169 + UPNG.js + vite-plugin-glsl. Деплой на GitHub Pages через `actions/deploy-pages@v4`.
