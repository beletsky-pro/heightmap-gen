<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import * as THREE from 'three';
  import { createPreview3D, type Preview3D, type PreviewShape } from './core/preview3d';
  import { NoiseRenderer } from './core/NoiseRenderer';
  import { generateHeight, defaultPost, type PostSettings } from './core/TextureGenerator';
  import { generateDerived, defaultDerived, generateMask, defaultMask, type DerivedSettings, type MaskSettings } from './core/DerivedMaps';
  import {
    exportHeightmap,
    exportDerivedRGBA,
    encodeHeightmapPng,
    encodeRgbaPng,
    type ExportBitDepth,
  } from './core/export';
  import { MaxBridge, blobToDataUrl, type BridgeStatus } from './core/maxBridge';
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
  import ThemeToggle from './ui/ThemeToggle.svelte';

  const materials: MaterialDef[] = [concrete, plaster, stone, lines, waves, ribs];
  let selectedId = $state('concrete');
  let currentDef = $derived(materials.find((m) => m.id === selectedId)!);

  let paramsByMaterial: Record<string, ParamValues> = $state(
    Object.fromEntries(materials.map((m) => [m.id, paramDefaults(m)])),
  );
  let currentValues = $derived(paramsByMaterial[selectedId]);

  let derivedSet: DerivedSettings = $state({ ...defaultDerived });
  let postSet: PostSettings = $state({ ...defaultPost });
  let maskSet: MaskSettings = $state({ ...defaultMask });
  let bwPreview = $state(false);

  let previewCanvas: HTMLCanvasElement;
  let preview = $state<Preview3D | undefined>(undefined);
  let noiseRenderer: NoiseRenderer | undefined;

  let heightTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let normalTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let aoTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let roughnessTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);
  let maskTarget = $state<THREE.WebGLRenderTarget | undefined>(undefined);

  let shape = $state<PreviewShape>('plane');
  let exportSize = $state(2048);
  let previewSize = 512;
  let tileRepeat = $state(1);

  let baseColor = $state('#cccccc');
  let materialRoughness = $state(0.85);
  let materialMetalness = $state(0.0);

  // 3ds Max Bridge
  const bridge = new MaxBridge();
  let bridgeStatus = $state<BridgeStatus>({ online: false });
  let bridgeBusy = $state(false);
  let bridgeMsg = $state('');
  let bridgeDisplaceScale = $state(1.5);
  let bridgeTessellate = $state(2);
  let bridgeAddUVW = $state(true);
  let bridgeApplyMaterial = $state(true);
  let bridgeIncludeMask = $state(false);

  // Live mode — debounced auto-apply при любом изменении
  let bridgeLive = $state(false);
  let bridgeLiveSize = $state(1024);
  let bridgeLiveDebounceMs = $state(500);
  let livePending = false;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let liveDirty = $state(false);  // показывает «есть несохранённые изменения»

  async function pingBridge() {
    bridgeStatus = await bridge.ping();
  }

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
    if (maskTarget) { maskTarget.dispose(); maskTarget = undefined; }
  }

  function regenerate() {
    if (!noiseRenderer || !preview) return;
    disposeTargets();
    const { height } = generateHeight(noiseRenderer, currentDef, currentValues, previewSize, postSet);
    heightTarget = height;
    const d = generateDerived(noiseRenderer, height, derivedSet);
    normalTarget = d.normal;
    aoTarget = d.ao;
    roughnessTarget = d.roughness;
    maskTarget = generateMask(noiseRenderer, height, maskSet);

    preview.setHeightTexture(height.texture);
    preview.setNormalTexture(d.normal.texture);
    preview.setAOTexture(d.ao.texture);
    preview.setRoughnessTexture(d.roughness.texture);
    preview.setDisplacementScale(currentDef.displacementScale * (currentValues.depth ?? 1));

    scheduleLiveApply();
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
    void postSet.contrast;
    void postSet.gamma;
    void postSet.invert;
    void postSet.binarize;
    void maskSet.threshold;
    void maskSet.softness;
    void maskSet.invert;
    // untrack: regenerate читает и пишет $state-переменные (heightTarget и др.).
    // Без untrack effect триггерил бы сам себя через свои же writes (infinite loop).
    if (preview) untrack(() => regenerate());
  });

  // Bridge-config изменения, не запускающие regenerate (выбор tessellate, displace etc).
  // Если live mode включён, всё равно надо переотправить.
  $effect(() => {
    void bridgeDisplaceScale;
    void bridgeTessellate;
    void bridgeAddUVW;
    void bridgeApplyMaterial;
    void bridgeIncludeMask;
    void bridgeLive;
    if (bridgeLive && bridgeStatus.online) untrack(() => scheduleLiveApply());
  });

  // При выключении Live — отменить запланированное.
  $effect(() => {
    if (!bridgeLive) {
      if (liveTimer !== undefined) { clearTimeout(liveTimer); liveTimer = undefined; }
      livePending = false;
      liveDirty = false;
    }
  });

  $effect(() => {
    if (!preview) return;
    if (bwPreview) {
      // B&W-режим: чисто-белая основа, низкий roughness override, без AO/нормали (только displacement)
      preview.material.color.set('#ffffff');
      preview.material.metalness = 0;
      preview.material.roughness = 1.0;
      preview.material.aoMapIntensity = 0;
      preview.material.normalScale.set(0, 0);
    } else {
      preview.material.color.set(baseColor);
      preview.material.metalness = materialMetalness;
      preview.material.roughness = materialRoughness;
      preview.material.aoMapIntensity = 1.2;
      preview.material.normalScale.set(1, 1);
    }
    preview.material.needsUpdate = true;
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
    // Bridge: пинг при загрузке + раз в 5 сек
    pingBridge();
    const pingId = setInterval(pingBridge, 5000);
    return () => {
      ro.disconnect();
      clearInterval(pingId);
    };
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
    await runExport('Все карты', async (h, d, m) => {
      await exportHeightmap(noiseRenderer!, h, `${currentDef.id}_height_16bit.png`, 16);
      await exportHeightmap(noiseRenderer!, h, `${currentDef.id}_height_8bit.png`, 8);
      await exportDerivedRGBA(noiseRenderer!, d.normal, `${currentDef.id}_normal.png`);
      await exportDerivedRGBA(noiseRenderer!, d.ao, `${currentDef.id}_ao.png`);
      await exportDerivedRGBA(noiseRenderer!, d.roughness, `${currentDef.id}_roughness.png`);
      await exportDerivedRGBA(noiseRenderer!, m, `${currentDef.id}_mask_bw.png`);
    });
  }

  async function downloadDerived(kind: 'normal' | 'ao' | 'roughness') {
    await runExport(`${kind}.png`, async (_h, d) => {
      const t = kind === 'normal' ? d.normal : kind === 'ao' ? d.ao : d.roughness;
      await exportDerivedRGBA(noiseRenderer!, t, `${currentDef.id}_${kind}.png`);
    });
  }

  async function downloadMask() {
    await runExport('B&W mask', async (_h, _d, m) => {
      await exportDerivedRGBA(noiseRenderer!, m, `${currentDef.id}_mask_bw.png`);
    });
  }

  /**
   * Применить текущие карты в запущенный 3ds Max через локальный bridge.
   * Размер по умолчанию = `exportSize`. Для live-режима передаётся `bridgeLiveSize`
   * (меньшее разрешение для скорости).
   */
  async function applyToMax(size: number = exportSize, silent = false) {
    if (!noiseRenderer || bridgeBusy) return;
    if (!bridgeStatus.online) {
      if (!silent) bridgeMsg = 'Bridge offline. Запустите server.py.';
      return;
    }
    bridgeBusy = true;
    if (!silent) bridgeMsg = `Кодирование ${size}×${size}…`;
    try {
      const t0 = performance.now();
      const { height } = generateHeight(noiseRenderer, currentDef, currentValues, size, postSet);
      const d = generateDerived(noiseRenderer, height, derivedSet);
      const m = generateMask(noiseRenderer, height, maskSet);

      const heightField = noiseRenderer.readHeightField(height);
      const heightBlob16 = encodeHeightmapPng(heightField, height.width, 16);
      const heightBlob8  = encodeHeightmapPng(heightField, height.width, 8);
      const normalBlob = encodeRgbaPng(noiseRenderer.readRGBA(d.normal), d.normal.width, true);
      const aoBlob = encodeRgbaPng(noiseRenderer.readRGBA(d.ao), d.ao.width, true);
      const roughBlob = encodeRgbaPng(noiseRenderer.readRGBA(d.roughness), d.roughness.width, true);
      const maskBlob = bridgeIncludeMask ? encodeRgbaPng(noiseRenderer.readRGBA(m), m.width, true) : null;

      height.dispose();
      d.normal.dispose();
      d.ao.dispose();
      d.roughness.dispose();
      m.dispose();

      if (!silent) bridgeMsg = 'Отправка в Max…';
      const maps = {
        height16: await blobToDataUrl(heightBlob16),
        height8:  await blobToDataUrl(heightBlob8),
        normal:   await blobToDataUrl(normalBlob),
        ao:       await blobToDataUrl(aoBlob),
        roughness:await blobToDataUrl(roughBlob),
        ...(maskBlob ? { mask: await blobToDataUrl(maskBlob) } : {}),
      };
      const resp = await bridge.apply(maps, {
        displacementScale: bridgeDisplaceScale,
        tessellate: bridgeTessellate,
        addUVW: bridgeAddUVW,
        applyMaterial: bridgeApplyMaterial,
        materialName: `HeightmapGen_${currentDef.id}`,
      });
      const ms = Math.round(performance.now() - t0);
      bridgeMsg = silent ? `Live ${size}px — ${ms}мс` : `Готово за ${ms}мс — session ${resp.session}`;
      liveDirty = false;
    } catch (e) {
      bridgeMsg = `Ошибка: ${(e as Error).message}`;
    } finally {
      bridgeBusy = false;
      // если за время апплая накопились изменения — стартуем ещё раз
      if (livePending && bridgeLive && bridgeStatus.online) {
        livePending = false;
        // микро-задержка чтобы не зацикливаться, если пользователь быстро двигает слайдер
        setTimeout(() => applyToMax(bridgeLiveSize, true), 30);
      }
    }
  }

  /**
   * Trailing-debounce для live-режима. Каждое изменение откладывает таймер,
   * по истечении вызывается applyToMax с пониженным разрешением. Если апплай
   * уже выполняется — флаг livePending запустит ещё один сразу после.
   */
  function scheduleLiveApply() {
    if (!bridgeLive || !bridgeStatus.online) return;
    liveDirty = true;
    if (liveTimer !== undefined) clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      liveTimer = undefined;
      if (bridgeBusy) {
        livePending = true;
      } else {
        applyToMax(bridgeLiveSize, true);
      }
    }, bridgeLiveDebounceMs);
  }

  /**
   * Любой экспорт рендерит heightmap в полном `exportSize` (а не preview),
   * считает derived и маску на этом разрешении, прогоняет колбэк, dispose.
   */
  async function runExport(
    label: string,
    fn: (h: THREE.WebGLRenderTarget, d: ReturnType<typeof generateDerived>, m: THREE.WebGLRenderTarget) => Promise<void>,
  ) {
    if (!noiseRenderer || exportBusy) return;
    exportBusy = true;
    exportStatus = `${label} — генерация ${exportSize}×${exportSize}…`;
    try {
      const t0 = performance.now();
      const { height } = generateHeight(noiseRenderer, currentDef, currentValues, exportSize, postSet);
      const d = generateDerived(noiseRenderer, height, derivedSet);
      const m = generateMask(noiseRenderer, height, maskSet);
      await fn(height, d, m);
      height.dispose();
      d.normal.dispose();
      d.ao.dispose();
      d.roughness.dispose();
      m.dispose();
      const ms = Math.round(performance.now() - t0);
      exportStatus = `${label} — готово за ${ms}мс`;
    } catch (e) {
      exportStatus = `Ошибка: ${(e as Error).message}`;
    } finally {
      exportBusy = false;
    }
  }
</script>

<div class="app">
  <header class="topbar">
    <div class="brand">
      <div class="logo" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 18l4-7 4 4 5-9 5 12"/>
        </svg>
      </div>
      <div class="title">
        <h1>Heightmap Gen</h1>
        <p>Генератор текстур для 3ds Max</p>
      </div>
    </div>
    <div class="topbar-right">
      <div class="bridge-pill" class:online={bridgeStatus.online} title={bridgeStatus.online ? `Bridge ${bridgeStatus.version ?? 'OK'}` : 'Bridge offline — запусти bridge/run.cmd'}>
        <span class="dot"></span>
        <span class="lbl">{bridgeStatus.online ? 'Max Bridge' : 'Bridge offline'}</span>
      </div>
      <a class="ghost-link" href="https://github.com/beletsky-pro/heightmap-gen" target="_blank" rel="noopener" aria-label="GitHub">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.07 3.29 9.37 7.86 10.89.58.11.79-.25.79-.56v-2.18c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.16 1.17.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.48 3.16-1.17 3.16-1.17.62 1.57.23 2.73.11 3.02.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.18c0 .31.21.68.8.56 4.57-1.52 7.86-5.82 7.86-10.89C23.5 5.65 18.35.5 12 .5z"/></svg>
      </a>
      <ThemeToggle />
    </div>
  </header>

  <main>
    <aside class="left">
      <h2 class="section-heading">Материал</h2>
      <MaterialPicker {materials} bind:selected={selectedId} />

      <PresetMenu presets={currentDef.presets} onpick={onPreset} />

      <h2 class="section-heading">Параметры материала</h2>
      {#each currentDef.params as p (p.key)}
        <ParamSlider spec={p} bind:value={paramsByMaterial[selectedId][p.key]} />
      {/each}

      <button onclick={randomSeed} style="width:100%;margin-top:6px;">🎲 Случайный seed</button>

      <h2 class="section-heading">Карта displacement</h2>
      <ParamSlider
        spec={{ key: 'mapContrast', label: 'Контраст', min: 0.5, max: 4, step: 0.05, default: 1, uniform: '' }}
        bind:value={postSet.contrast}
      />
      <ParamSlider
        spec={{ key: 'mapGamma', label: 'Гамма', min: 0.3, max: 3, step: 0.05, default: 1, uniform: '' }}
        bind:value={postSet.gamma}
      />
      <label class="check">
        <input type="checkbox" bind:checked={postSet.invert} />
        Инвертировать (выпуклое ↔ вогнутое)
      </label>
      <button style="width:100%;margin-top:10px;" onclick={() => { postSet.contrast = 1; postSet.gamma = 1; postSet.binarize = 0; postSet.invert = false; }}>Сброс контраста</button>

      <h2 class="section-heading">B&W маска</h2>
      <ParamSlider
        spec={{ key: 'maskThreshold', label: 'Порог', min: 0, max: 1, step: 0.01, default: 0.5, uniform: '' }}
        bind:value={maskSet.threshold}
      />
      <ParamSlider
        spec={{ key: 'maskSoftness', label: 'Мягкость края', min: 0, max: 1, step: 0.01, default: 0, uniform: '' }}
        bind:value={maskSet.softness}
      />
      <label class="check">
        <input type="checkbox" bind:checked={maskSet.invert} />
        Инвертировать маску
      </label>

      <h2 class="section-heading">Деривация карт</h2>
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

      <h2 class="section-heading">Экспорт</h2>
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
        <div class="seg" role="group" aria-label="Форма">
          <button class:active={shape === 'plane'} onclick={() => setShape('plane')}>Плоскость</button>
          <button class:active={shape === 'box'} onclick={() => setShape('box')}>Куб</button>
          <button class:active={shape === 'cylinder'} onclick={() => setShape('cylinder')}>Цилиндр</button>
          <button class:active={shape === 'sphere'} onclick={() => setShape('sphere')}>Сфера</button>
        </div>
        <div class="seg" role="group" aria-label="Tile">
          <button class:active={tileRepeat === 1} onclick={() => setTile(1)}>1×1</button>
          <button class:active={tileRepeat === 2} onclick={() => setTile(2)}>2×2</button>
          <button class:active={tileRepeat === 4} onclick={() => setTile(4)}>4×4</button>
        </div>
      </div>
    </section>

    <aside class="right">
      <h2 class="section-heading">Превью</h2>
      <div class="preview-controls">
        <div class="color-row">
          <label for="basecolor">Цвет</label>
          <input id="basecolor" type="color" bind:value={baseColor} />
          <span class="hex">{baseColor}</span>
        </div>
        <ParamSlider
          spec={{ key: 'matRough', label: 'Глянцевость (глянец ↔ мат)', min: 0, max: 1, step: 0.01, default: 0.85, uniform: '' }}
          bind:value={materialRoughness}
        />
        <ParamSlider
          spec={{ key: 'matMetal', label: 'Металличность', min: 0, max: 1, step: 0.01, default: 0, uniform: '' }}
          bind:value={materialMetalness}
        />
        <label class="check">
          <input type="checkbox" bind:checked={bwPreview} />
          Чёрно-белый предпросмотр
        </label>
      </div>

      <h2 class="section-heading">Карты</h2>
      <div class="thumbs">
        <MapThumbnail target={heightTarget} renderer={preview?.renderer} label="Height" onclick={() => downloadHeight(16)} />
        <MapThumbnail target={normalTarget} renderer={preview?.renderer} label="Normal" onclick={() => downloadDerived('normal')} />
        <MapThumbnail target={aoTarget} renderer={preview?.renderer} label="AO" onclick={() => downloadDerived('ao')} />
        <MapThumbnail target={roughnessTarget} renderer={preview?.renderer} label="Roughness" onclick={() => downloadDerived('roughness')} />
        <MapThumbnail target={maskTarget} renderer={preview?.renderer} label="B&W маска" onclick={downloadMask} />
      </div>

      <h2 class="section-heading">Скачать</h2>

      <button class="primary big" disabled={exportBusy} onclick={downloadAll}>
        Все карты (6 файлов)
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
        <button disabled={exportBusy} onclick={downloadMask}>B&W mask</button>
      </div>

      {#if exportStatus}
        <p class="status">{exportStatus}</p>
      {/if}

      <h2 class="section-heading">3ds Max Bridge</h2>
      <div class="bridge-card" class:online={bridgeStatus.online}>
        <div class="bridge-status">
          <span class="dot"></span>
          {#if bridgeStatus.online}
            <span>Подключено · v{bridgeStatus.version ?? '?'}</span>
          {:else}
            <span>Helper не запущен</span>
          {/if}
        </div>
        {#if !bridgeStatus.online}
          <p class="bridge-help">Запустите <code>bridge/run.cmd</code> и подгрузите <code>MaxBridge.ms</code> в 3ds Max. <a href="https://github.com/beletsky-pro/heightmap-gen/tree/main/bridge" target="_blank" rel="noopener">Инструкция</a>.</p>
        {/if}
      </div>

      <ParamSlider
        spec={{ key: 'dispScale', label: 'Displace strength', min: 0.1, max: 20, step: 0.1, default: 1.5, uniform: '' }}
        bind:value={bridgeDisplaceScale}
      />
      <ParamSlider
        spec={{ key: 'tessIters', label: 'Tessellate итераций', min: 0, max: 4, step: 1, default: 2, uniform: '' }}
        bind:value={bridgeTessellate}
      />
      <label class="check">
        <input type="checkbox" bind:checked={bridgeAddUVW} />
        UVWMap shrinkwrap
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={bridgeApplyMaterial} />
        PhysicalMaterial (bump + roughness)
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={bridgeIncludeMask} />
        Включить B&W mask
      </label>

      <label class="check live-check" class:on={bridgeLive}>
        <input type="checkbox" bind:checked={bridgeLive} disabled={!bridgeStatus.online} />
        <span>Live update — Max обновляется автоматически</span>
        {#if bridgeLive}
          <span class="live-dot" class:syncing={bridgeBusy} class:dirty={liveDirty}></span>
        {/if}
      </label>
      {#if bridgeLive}
        <ParamSlider
          spec={{ key: 'liveSize', label: 'Live разрешение', min: 256, max: 2048, step: 256, default: 1024, uniform: '' }}
          bind:value={bridgeLiveSize}
        />
      {/if}

      <button class="primary big" disabled={!bridgeStatus.online || bridgeBusy} onclick={() => applyToMax()} style="margin-top:10px;">
        ⚡ Применить в 3ds Max
      </button>
      {#if bridgeMsg}
        <p class="status">{bridgeMsg}</p>
      {/if}

      <h2 class="section-heading">Подсказки для 3ds Max</h2>
      <ol class="hints">
        <li>Height 16-bit → Bitmap (галка «16-bit») → Displace модификатор.</li>
        <li>Normal → Normal Bump map → Bump-слот Physical Material.</li>
        <li>AO → Diffuse в режиме Multiply.</li>
        <li>Roughness → Roughness-слот Physical Material.</li>
        <li>B&W mask → Opacity / Cutout / Stencil / blend-маска.</li>
      </ol>
    </aside>
  </main>
</div>

<style>
  .app {
    display: grid;
    grid-template-rows: 56px 1fr;
    height: 100dvh;
    min-height: 100vh;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid var(--panel-border);
    background: var(--bg);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 36px; height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white;
    box-shadow: var(--shadow-sm);
  }
  .title h1 { font-size: var(--font-lg); margin: 0; line-height: 1.1; font-weight: 600; }
  .title p { margin: 0; font-size: var(--font-xs); color: var(--fg-muted); }
  .topbar-right { display: inline-flex; align-items: center; gap: 8px; }
  .ghost-link {
    width: 34px; height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-muted);
    border-radius: var(--radius-md);
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .ghost-link:hover { background: var(--input-bg-hover); color: var(--fg); }

  .bridge-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    background: var(--input-bg);
    font-size: var(--font-xs);
    font-weight: 500;
    color: var(--fg-muted);
    cursor: default;
    user-select: none;
  }
  .bridge-pill .dot {
    width: 8px; height: 8px;
    border-radius: var(--radius-full);
    background: var(--danger);
    flex-shrink: 0;
    box-shadow: 0 0 0 0 transparent;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .bridge-pill.online {
    color: var(--fg);
    background: color-mix(in srgb, var(--success) 15%, transparent);
  }
  .bridge-pill.online .dot {
    background: var(--success);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 25%, transparent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 35%, transparent); }
    50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--success) 0%,  transparent); }
  }

  main {
    display: grid;
    grid-template-columns: 320px 1fr 300px;
    min-height: 0;
  }
  aside {
    padding: 18px 18px 24px;
    overflow-y: auto;
    background: var(--panel);
    border-right: 1px solid var(--panel-border);
    min-height: 0;
  }
  aside.right {
    border-right: none;
    border-left: 1px solid var(--panel-border);
  }

  .center {
    position: relative;
    background: var(--bg-canvas);
    overflow: hidden;
    min-height: 0;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .overlay-bar {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 10;
    pointer-events: auto;
  }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: color-mix(in srgb, var(--bg-elevated) 85%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius-md);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--shadow-md);
  }
  .seg button {
    padding: 6px 12px;
    font-size: var(--font-sm);
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
  }
  .seg button:hover { background: var(--input-bg-hover); color: var(--fg); }
  .seg button.active {
    background: var(--primary);
    color: var(--primary-fg);
    box-shadow: var(--shadow-sm);
  }
  .seg button.active:hover { background: var(--primary-hover); }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-sm);
    color: var(--fg);
    margin-top: 8px;
    cursor: pointer;
    user-select: none;
    font-weight: 400;
  }
  .check input { width: auto; margin: 0; }

  .preview-controls { margin-bottom: 4px; }
  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .color-row label { margin: 0; flex: 0 0 auto; }
  .hex {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: var(--font-xs);
    color: var(--fg-muted);
  }

  .thumbs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 4px;
  }

  button.big {
    width: 100%;
    padding: 12px;
    font-size: var(--font-md);
    margin-bottom: 10px;
  }
  .dl-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 6px;
  }
  .status {
    font-size: var(--font-sm);
    color: var(--fg-muted);
    margin: 12px 0;
    padding: 8px 10px;
    background: var(--input-bg);
    border-radius: var(--radius-sm);
  }
  .bridge-card {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--input-bg);
    border: 1px solid var(--panel-border);
    margin-bottom: 12px;
  }
  .bridge-card.online { border-color: color-mix(in srgb, var(--success) 50%, transparent); }
  .bridge-status {
    display: flex; align-items: center; gap: 8px;
    font-size: var(--font-sm);
    color: var(--fg);
    font-weight: 500;
  }
  .bridge-card .dot {
    width: 8px; height: 8px;
    border-radius: var(--radius-full);
    background: var(--danger);
    flex-shrink: 0;
  }
  .bridge-card.online .dot { background: var(--success); }
  .bridge-help {
    margin: 6px 0 0;
    font-size: var(--font-xs);
    color: var(--fg-muted);
    line-height: 1.5;
  }
  .bridge-help code {
    background: var(--bg-canvas);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
  }
  .bridge-help a {
    color: var(--primary);
    text-decoration: none;
  }
  .bridge-help a:hover { text-decoration: underline; }

  .live-check {
    padding: 8px 10px;
    background: var(--input-bg);
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    margin-top: 4px;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .live-check.on {
    border-color: color-mix(in srgb, var(--primary) 50%, transparent);
    background: color-mix(in srgb, var(--primary) 10%, var(--input-bg));
  }
  .live-dot {
    width: 8px; height: 8px;
    border-radius: var(--radius-full);
    background: var(--success);
    margin-left: auto;
    flex-shrink: 0;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
  }
  .live-dot.dirty { background: var(--accent); }
  .live-dot.syncing {
    background: var(--primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 30%, transparent);
    animation: pulse 1s ease-in-out infinite;
  }
  .hints {
    font-size: var(--font-sm);
    color: var(--fg-muted);
    padding-left: 18px;
    line-height: 1.55;
    margin: 0;
  }
  .hints li { margin-bottom: 4px; }
  .caps {
    font-size: var(--font-xs);
    color: var(--fg-subtle);
    margin-top: 14px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }

  @media (max-width: 1100px) {
    main { grid-template-columns: 280px 1fr 260px; }
  }
</style>
