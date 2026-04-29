<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import * as THREE from 'three';
  import { createPreview3D, type Preview3D, type PreviewShape } from './core/preview3d';
  import { NoiseRenderer } from './core/NoiseRenderer';
  import { generateHeight } from './core/TextureGenerator';
  import { generateDerived, defaultDerived, type DerivedSettings } from './core/DerivedMaps';
  import {
    exportHeightmap,
    exportDerivedRGBA,
    type ExportBitDepth,
  } from './core/export';
  import { concrete } from './materials/concrete';
  import { plaster } from './materials/plaster';
  import { stone } from './materials/stone';
  import { lines } from './materials/lines';
  import { waves } from './materials/waves';
  import { ribs } from './materials/ribs';
  import type { MaterialDef, ParamValues } from './materials/types';
  import { paramDefaults, applyPreset } from './materials/types';
  import MaterialPicker from './ui/MaterialPicker.svelte';
  import ParamSlider from './ui/ParamSlider.svelte';
  import PresetMenu from './ui/PresetMenu.svelte';
  import MapThumbnail from './ui/MapThumbnail.svelte';

  const materials: MaterialDef[] = [concrete, plaster, stone, lines, waves, ribs];
  let selectedId = $state('concrete');
  let currentDef = $derived(materials.find((m) => m.id === selectedId)!);

  let paramsByMaterial: Record<string, ParamValues> = $state(
    Object.fromEntries(materials.map((m) => [m.id, paramDefaults(m)])),
  );
  let currentValues = $derived(paramsByMaterial[selectedId]);

  let derivedSet: DerivedSettings = $state({ ...defaultDerived });

  let previewCanvas: HTMLCanvasElement;
  let preview = $state<Preview3D | undefined>(undefined);
  let noiseRenderer: NoiseRenderer | undefined;

  let heightTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let normalTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let aoTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let roughnessTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);

  let shape = $state<PreviewShape>('plane');
  let exportSize = $state(2048);
  let previewSize = 512;
  let tileRepeat = $state(1);

  let baseColor = $state('#cccccc');
  let materialRoughness = $state(0.85);
  let materialMetalness = $state(0.0);

  $effect(() => {
    preview?.setBaseColor(baseColor);
  });
  $effect(() => {
    preview?.setRoughnessOverride(materialRoughness);
  });
  $effect(() => {
    preview?.setMetalness(materialMetalness);
  });

  let capsInfo = $state('');
  let exportBusy = $state(false);
  let exportStatus = $state('');

  function disposeTargets() {
    if (heightTarget) { heightTarget.dispose(); heightTarget = undefined; }
    if (normalTarget) { normalTarget.dispose(); normalTarget = undefined; }
    if (aoTarget) { aoTarget.dispose(); aoTarget = undefined; }
    if (roughnessTarget) { roughnessTarget.dispose(); roughnessTarget = undefined; }
  }

  function regenerate() {
    if (!noiseRenderer || !preview) return;
    disposeTargets();
    const { height } = generateHeight(noiseRenderer, currentDef, currentValues, previewSize);
    heightTarget = height;
    const d = generateDerived(noiseRenderer, height, derivedSet);
    normalTarget = d.normal;
    aoTarget = d.ao;
    roughnessTarget = d.roughness;

    preview.setHeightTexture(height.texture);
    preview.setNormalTexture(d.normal.texture);
    preview.setAOTexture(d.ao.texture);
    preview.setRoughnessTexture(d.roughness.texture);
    preview.setDisplacementScale(currentDef.displacementScale * (currentValues.depth ?? 1));
  }

  $effect(() => {
    // Явно читаем все скаляры, на которые должна реагировать регенерация —
    // void на $state-прокси не подписывается на nested-мутации.
    void selectedId;
    for (const p of currentDef.params) void currentValues[p.key];
    void derivedSet.normalStrength;
    void derivedSet.aoStrength;
    void derivedSet.roughnessBase;
    void derivedSet.roughnessDetail;
    void derivedSet.flipY;
    // untrack: regenerate читает и пишет $state-переменные (heightTarget и др.).
    // Без untrack effect триггерил бы сам себя через свои же writes (infinite loop).
    if (preview) untrack(() => regenerate());
  });

  onMount(() => {
    preview = createPreview3D(previewCanvas);
    noiseRenderer = new NoiseRenderer(preview.renderer);
    const caps = noiseRenderer.getCaps();
    capsInfo = `float:${caps.floatRender} half:${caps.halfFloatRender} R:${caps.redFormat}`;
    const ro = new ResizeObserver(() => preview?.resize());
    ro.observe(previewCanvas);
    preview.resize();
    regenerate();
    return () => ro.disconnect();
  });

  onDestroy(() => {
    disposeTargets();
    noiseRenderer?.dispose();
    preview?.dispose();
  });

  function onPreset(name: string) {
    paramsByMaterial[selectedId] = applyPreset(currentDef, name, currentValues);
  }

  function randomSeed() {
    paramsByMaterial[selectedId] = {
      ...currentValues,
      seed: Math.floor(Math.random() * 1000),
    };
  }

  function setShape(s: PreviewShape) {
    shape = s;
    preview?.setShape(s);
  }

  function setTile(n: number) {
    tileRepeat = n;
    preview?.setTileRepeat(n);
  }

  async function downloadHeight(depth: ExportBitDepth) {
    await runExport(`Heightmap ${depth}-bit`, async (h, _d) => {
      await exportHeightmap(noiseRenderer!, h, `${currentDef.id}_height_${depth}bit.png`, depth);
    });
  }

  async function downloadAll() {
    await runExport('Все карты', async (h, d) => {
      await exportHeightmap(noiseRenderer!, h, `${currentDef.id}_height_16bit.png`, 16);
      await exportHeightmap(noiseRenderer!, h, `${currentDef.id}_height_8bit.png`, 8);
      await exportDerivedRGBA(noiseRenderer!, d.normal, `${currentDef.id}_normal.png`);
      await exportDerivedRGBA(noiseRenderer!, d.ao, `${currentDef.id}_ao.png`);
      await exportDerivedRGBA(noiseRenderer!, d.roughness, `${currentDef.id}_roughness.png`);
    });
  }

  async function downloadDerived(kind: 'normal' | 'ao' | 'roughness') {
    await runExport(`${kind}.png`, async (_h, d) => {
      const t = kind === 'normal' ? d.normal : kind === 'ao' ? d.ao : d.roughness;
      await exportDerivedRGBA(noiseRenderer!, t, `${currentDef.id}_${kind}.png`);
    });
  }

  /**
   * Любой экспорт ренодит heightmap в полном `exportSize` (а не preview),
   * считает derived маршруты на этом разрешении, прогоняет колбэк, dispose.
   */
  async function runExport(
    label: string,
    fn: (h: THREE.WebGLRenderTarget, d: ReturnType<typeof generateDerived>) => Promise<void>,
  ) {
    if (!noiseRenderer || exportBusy) return;
    exportBusy = true;
    exportStatus = `${label} — генерация ${exportSize}×${exportSize}…`;
    try {
      const t0 = performance.now();
      const { height } = generateHeight(noiseRenderer, currentDef, currentValues, exportSize);
      const d = generateDerived(noiseRenderer, height, derivedSet);
      await fn(height, d);
      height.dispose();
      d.normal.dispose();
      d.ao.dispose();
      d.roughness.dispose();
      const ms = Math.round(performance.now() - t0);
      exportStatus = `${label} — готово за ${ms}мс`;
    } catch (e) {
      exportStatus = `Ошибка: ${(e as Error).message}`;
    } finally {
      exportBusy = false;
    }
  }
</script>

<main>
  <aside class="left">
    <h1>Heightmap Gen</h1>
    <p class="sub">Генератор текстур для 3ds Max</p>

    <h2>Материал</h2>
    <MaterialPicker {materials} bind:selected={selectedId} />

    <PresetMenu presets={currentDef.presets} onpick={onPreset} />

    <h2>Параметры материала</h2>
    {#each currentDef.params as p (p.key)}
      <ParamSlider spec={p} bind:value={paramsByMaterial[selectedId][p.key]} />
    {/each}

    <button onclick={randomSeed} style="width:100%;margin-top:8px;">🎲 Случайный seed</button>

    <h2>Деривация карт</h2>
    <ParamSlider
      spec={{ key: 'normalStrength', label: 'Normal сила', min: 0.5, max: 12, step: 0.1, default: 4, uniform: '' }}
      bind:value={derivedSet.normalStrength}
    />
    <ParamSlider
      spec={{ key: 'aoStrength', label: 'AO сила', min: 0.5, max: 8, step: 0.1, default: 3, uniform: '' }}
      bind:value={derivedSet.aoStrength}
    />
    <ParamSlider
      spec={{ key: 'roughnessBase', label: 'Roughness base', min: 0.2, max: 1, step: 0.01, default: 0.7, uniform: '' }}
      bind:value={derivedSet.roughnessBase}
    />
    <ParamSlider
      spec={{ key: 'roughnessDetail', label: 'Roughness detail', min: 0, max: 12, step: 0.1, default: 4, uniform: '' }}
      bind:value={derivedSet.roughnessDetail}
    />
    <label class="check">
      <input type="checkbox" bind:checked={derivedSet.flipY} />
      Normal: DirectX (Y inverted)
    </label>

    <h2>Экспорт</h2>
    <label for="exp-size">Размер</label>
    <select id="exp-size" bind:value={exportSize}>
      <option value={1024}>1024 × 1024</option>
      <option value={2048}>2048 × 2048</option>
      <option value={4096}>4096 × 4096</option>
    </select>

    <p class="caps">{capsInfo}</p>
  </aside>

  <section class="center">
    <canvas bind:this={previewCanvas}></canvas>
    <div class="overlay-bar">
      <div class="toggle">
        <button class:active={shape === 'plane'} onclick={() => setShape('plane')}>Плоскость</button>
        <button class:active={shape === 'box'} onclick={() => setShape('box')}>Куб</button>
        <button class:active={shape === 'cylinder'} onclick={() => setShape('cylinder')}>Цилиндр</button>
        <button class:active={shape === 'sphere'} onclick={() => setShape('sphere')}>Сфера</button>
      </div>
      <div class="toggle">
        <button class:active={tileRepeat === 1} onclick={() => setTile(1)}>1×1</button>
        <button class:active={tileRepeat === 2} onclick={() => setTile(2)}>2×2</button>
        <button class:active={tileRepeat === 4} onclick={() => setTile(4)}>4×4</button>
      </div>
    </div>
  </section>

  <aside class="right">
    <h2>Превью</h2>
    <div class="preview-controls">
      <div class="color-row">
        <label for="basecolor">Цвет</label>
        <input id="basecolor" type="color" bind:value={baseColor} />
        <span class="hex">{baseColor}</span>
      </div>
      <ParamSlider
        spec={{ key: 'matRough', label: 'Глянцевость (низ ↔ матово)', min: 0, max: 1, step: 0.01, default: 0.85, uniform: '' }}
        bind:value={materialRoughness}
      />
      <ParamSlider
        spec={{ key: 'matMetal', label: 'Металл', min: 0, max: 1, step: 0.01, default: 0, uniform: '' }}
        bind:value={materialMetalness}
      />
    </div>

    <h2>Карты</h2>
    <div class="thumbs">
      <MapThumbnail target={heightTarget} renderer={preview?.renderer} label="Height" onclick={() => downloadHeight(16)} />
      <MapThumbnail target={normalTarget} renderer={preview?.renderer} label="Normal" onclick={() => downloadDerived('normal')} />
      <MapThumbnail target={aoTarget} renderer={preview?.renderer} label="AO" onclick={() => downloadDerived('ao')} />
      <MapThumbnail target={roughnessTarget} renderer={preview?.renderer} label="Roughness" onclick={() => downloadDerived('roughness')} />
    </div>

    <h2>Скачать</h2>

    <button class="primary big" disabled={exportBusy} onclick={downloadAll}>
      ⬇ Все карты (5 файлов)
    </button>

    <div class="dl-row">
      <button disabled={exportBusy} onclick={() => downloadHeight(16)}>Height 16-bit</button>
      <button disabled={exportBusy} onclick={() => downloadHeight(8)}>Height 8-bit</button>
    </div>
    <div class="dl-row">
      <button disabled={exportBusy} onclick={() => downloadDerived('normal')}>Normal</button>
      <button disabled={exportBusy} onclick={() => downloadDerived('ao')}>AO</button>
    </div>
    <div class="dl-row">
      <button disabled={exportBusy} onclick={() => downloadDerived('roughness')}>Roughness</button>
    </div>

    {#if exportStatus}
      <p class="status">{exportStatus}</p>
    {/if}

    <h2>Подсказки для 3ds Max</h2>
    <ol class="hints">
      <li>Height 16-bit → Bitmap (галка «16-bit») → Displace модификатор.</li>
      <li>Normal → Normal Bump map → Bump-слот Physical Material.</li>
      <li>AO → Diffuse в режиме Multiply.</li>
      <li>Roughness → Roughness-слот Physical Material.</li>
    </ol>
  </aside>
</main>

<style>
  main {
    display: grid;
    grid-template-columns: 320px 1fr 280px;
    height: 100%;
  }
  aside {
    padding: 16px 16px 24px;
    overflow-y: auto;
    background: #161616;
    border-right: 1px solid #2a2a2a;
  }
  aside.right { border-right: none; border-left: 1px solid #2a2a2a; }
  .center { position: relative; background: #222; }
  canvas { width: 100%; height: 100%; display: block; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    margin: 18px 0 8px;
    border-bottom: 1px solid #2a2a2a;
    padding-bottom: 4px;
  }
  .sub { font-size: 12px; color: #888; margin: 0 0 12px; }
  .caps { font-size: 11px; color: #666; margin-top: 16px; font-family: monospace; }
  .check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #ccc; margin-top: 6px; cursor: pointer; }
  .check input { width: auto; }
  .overlay-bar {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }
  .toggle {
    display: flex;
    gap: 4px;
    background: #1a1a1adb;
    padding: 4px;
    border-radius: 6px;
    backdrop-filter: blur(6px);
  }
  .toggle button { padding: 6px 12px; font-size: 12px; }
  .toggle button.active { background: #4a7fb5; border-color: #5a8fc5; }
  .thumbs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 4px;
  }
  .preview-controls { margin-bottom: 6px; }
  .color-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }
  .color-row label { margin: 0; flex: 0 0 auto; }
  .color-row input[type="color"] {
    width: 50px; height: 32px; padding: 0; border: 1px solid #444;
    border-radius: 4px; cursor: pointer; background: transparent;
  }
  .hex { font-family: monospace; font-size: 12px; color: #aaa; }
  button.big { width: 100%; padding: 12px; font-size: 14px; margin-bottom: 10px; }
  .dl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
  .status { font-size: 12px; color: #8aa; margin: 10px 0; }
  .hints { font-size: 12px; color: #aaa; padding-left: 18px; line-height: 1.5; }
  .hints li { margin-bottom: 4px; }
</style>
