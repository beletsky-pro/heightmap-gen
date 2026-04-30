<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let {
    target,
    label,
    renderer,
    onclick,
  }: {
    target: THREE.WebGLRenderTarget | undefined;
    label: string;
    renderer: THREE.WebGLRenderer | undefined;
    onclick?: () => void;
  } = $props();

  let canvasEl: HTMLCanvasElement;
  const SIZE = 96;

  let scene: THREE.Scene | undefined;
  let camera: THREE.OrthographicCamera | undefined;
  let mat: THREE.MeshBasicMaterial | undefined;

  function ensureScene() {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    mat = new THREE.MeshBasicMaterial();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);
  }

  function refresh() {
    if (!target || !renderer || !canvasEl) return;
    ensureScene();
    mat!.map = target.texture;
    mat!.needsUpdate = true;
    const prev = renderer.getRenderTarget();
    const tmp = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    renderer.setRenderTarget(tmp);
    renderer.render(scene!, camera!);
    renderer.setRenderTarget(prev);

    const buf = new Uint8Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(tmp, 0, 0, SIZE, SIZE, buf);
    tmp.dispose();

    const ctx = canvasEl.getContext('2d')!;
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const srcRow = (SIZE - 1 - y) * SIZE * 4;
      const dstRow = y * SIZE * 4;
      for (let x = 0; x < SIZE * 4; x++) {
        img.data[dstRow + x] = buf[srcRow + x];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  $effect(() => {
    void target;
    if (canvasEl && target && renderer) refresh();
  });

  onMount(refresh);
</script>

<button class="thumb" type="button" onclick={onclick} title="Скачать {label}" disabled={!onclick}>
  <canvas bind:this={canvasEl} width={SIZE} height={SIZE}></canvas>
  <span class="lbl">{label}</span>
</button>

<style>
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: var(--input-bg);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
  }
  .thumb:hover {
    background: var(--input-bg-hover);
    border-color: var(--primary);
  }
  .thumb:active { transform: scale(0.98); }
  .thumb:focus-visible { box-shadow: 0 0 0 3px var(--primary-ring); outline: none; }
  canvas {
    width: 96px; height: 96px;
    border-radius: var(--radius-sm);
    image-rendering: pixelated;
    background: var(--bg-canvas);
    pointer-events: none;
  }
  .lbl {
    font-size: var(--font-xs);
    color: var(--fg-muted);
    font-weight: 500;
  }
</style>
