# Heightmap Gen

Онлайн-генератор heightmap / displacement / normal / AO / roughness текстур для 3ds Max, Blender, ZBrush, Substance.

Открой в браузере → выбери материал → подкрути ползунки → скачай PNG → подсунь в Displace-модификатор.

## Материалы

- **Бетон** — FBM Perlin + микрозерно + опциональные трещины (Voronoi-edges).
- **Шпаклёвка** — мягкие низкочастотные волны + микрозернистость.
- **Штукатурка** — Voronoi cellular threshold (как Stucco-шейдер 3ds Max).
- **Камень** — крупный Voronoi (плиты) + детализация внутри плит.

Каждый материал — 6 ползунков и 4 пресета.

## Карты на выходе

- **Heightmap PNG 16-bit** (greyscale) — главный, для Displace-модификатора. Без полос на пологих градиентах.
- **Heightmap PNG 8-bit** — стандартная серая карта.
- **Normal map** (RGB tangent-space, тогл OpenGL/DirectX).
- **AO** (cavity).
- **Roughness** (база + локальная дисперсия).

Все карты — tileable (бесшовные).

## Как использовать в 3ds Max

1. Скачай Height 16-bit → `Bitmap` (галка «16-bit») → `Displace`-модификатор на тесселированной плоскости.
2. Normal → `Normal Bump` map → Bump-слот `Physical Material`.
3. AO → Diffuse в режиме `Multiply`.
4. Roughness → Roughness-слот `Physical Material`.

## Локально

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Деплой

GitHub Actions автоматически собирает и публикует на GitHub Pages при push в `main` (см. [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

В Settings → Pages выбери source: "GitHub Actions".

## Стек

- TypeScript + Vite 5 + Svelte 5 (runes)
- Three.js 0.169 — 3D-превью с MeshStandardMaterial (displacement/normal/AO/roughness)
- WebGL fragment shaders — все шумы (Perlin 4D на торе + Worley/Voronoi)
- UPNG.js — 16-bit greyscale PNG (с big-endian упаковкой)

## Архитектура

- [src/shaders/](src/shaders/) — GLSL: lib (шумы), 4 материала, normal/AO/roughness.
- [src/core/NoiseRenderer.ts](src/core/NoiseRenderer.ts) — offscreen RT + readback.
- [src/core/TextureGenerator.ts](src/core/TextureGenerator.ts) — рендер шейдера материала.
- [src/core/DerivedMaps.ts](src/core/DerivedMaps.ts) — пайплайн normal/AO/roughness.
- [src/core/export.ts](src/core/export.ts) — Float32 → big-endian Uint16 → UPNG → download.
- [src/core/preview3d.ts](src/core/preview3d.ts) — Three.js scene с OrbitControls.
- [src/materials/](src/materials/) — определения материалов (params + presets) на TS.

## Лицензия

MIT.
