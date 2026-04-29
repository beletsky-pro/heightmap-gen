<script lang="ts">
  import type { Preset } from '../materials/types';

  let {
    presets,
    onpick,
  }: { presets: Preset[]; onpick: (name: string) => void } = $props();

  let active = $state('');

  function pick(name: string) {
    active = name;
    onpick(name);
  }
</script>

<div class="presets">
  <div class="cap">Пресет</div>
  <div class="row">
    {#each presets as p}
      <button class:active={active === p.name} onclick={() => pick(p.name)}>{p.name}</button>
    {/each}
  </div>
</div>

<style>
  .presets { margin-bottom: 12px; }
  .cap { font-size: 12px; color: #aaa; margin-bottom: 4px; }
  .row { display: flex; flex-wrap: wrap; gap: 4px; }
  button { padding: 4px 10px; font-size: 12px; }
  button.active { background: #4a7fb5; border-color: #5a8fc5; }
</style>
