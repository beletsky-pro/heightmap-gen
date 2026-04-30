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
  .presets { margin-bottom: 14px; }
  .cap {
    font-size: var(--font-sm);
    color: var(--fg-muted);
    font-weight: 500;
    margin-bottom: 6px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button {
    padding: 5px 10px;
    font-size: var(--font-sm);
    font-weight: 500;
  }
</style>
