<script lang="ts">
  import type { ParamSpec } from '../materials/types';

  let { spec, value = $bindable() }: { spec: ParamSpec; value: number } = $props();
</script>

<div class="row">
  <div class="head">
    <label for={spec.key}>{spec.label}</label>
    <input
      type="number"
      id="{spec.key}-num"
      min={spec.min}
      max={spec.max}
      step={spec.step}
      bind:value
    />
  </div>
  <input
    type="range"
    id={spec.key}
    min={spec.min}
    max={spec.max}
    step={spec.step}
    bind:value
  />
</div>

<style>
  .row { margin-bottom: 10px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .head label { margin: 0; flex: 1; }
  .head input[type="number"] { width: 70px; padding: 2px 6px; font-size: 12px; }
  input[type="range"] { width: 100%; }
</style>
