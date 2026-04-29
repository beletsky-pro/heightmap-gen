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

  // Scene/camera/quad для отрисовки текстуры → canvas
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
    // WebGL Y-down → flip vertical
    for (let y = 0; y < SIZE; y++) {
      const srcRow = (SIZE - 1 - y) * SIZE * 4;
      const dstRow = y * SIZE * 4;
      for (let x = 0; x < SIZE * 4; x++) {
        img.data[dstRow + x] = buf[srcRow + x];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Реактивно обновляем при смене target
  $effect(() => {
    void target;
    if (canvasEl && target && renderer) refresh();
  });

  onMount(refresh);
</script>

<div class="thumb">
  <canvas bind:this={canvasEl} width={SIZE} height={SIZE} onclick={onclick} title="Скачать {label}"></canvas>
  <span class="lbl">{label}</span>
</div>

<style>
  .thumb { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  canvas {
    width: 96px; height: 96px;
    border-radius: 4px;
    border: 1px solid #333;
    cursor: pointer;
    image-rendering: pixelated;
    background: #111;
  }
  canvas:hover { border-color: #4a7fb5; }
  .lbl { font-size: 11px; color: #aaa; }
</style>
