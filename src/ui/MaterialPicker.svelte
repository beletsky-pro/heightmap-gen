<script lang="ts">
  import type { MaterialDef } from '../materials/types';

  let {
    materials,
    selected = $bindable(),
  }: { materials: MaterialDef[]; selected: string } = $props();
</script>

<div class="picker">
  {#each materials as m}
    <button
      class:active={selected === m.id}
      onclick={() => (selected = m.id)}
    >
      {m.name}
    </button>
  {/each}
</div>

<style>
  .picker { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  button { padding: 10px 8px; font-size: 13px; }
  button.active { background: #4a7fb5; border-color: #5a8fc5; }
</style>
