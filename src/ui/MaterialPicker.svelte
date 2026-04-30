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
  .picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  button {
    padding: 10px 8px;
    font-size: var(--font-md);
    font-weight: 500;
  }
</style>
