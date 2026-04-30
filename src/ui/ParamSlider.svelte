<script lang="ts">
  import type { ParamSpec } from '../materials/types';

  let { spec, value = $bindable() }: { spec: ParamSpec; value: number } = $props();

  let pct = $derived(
    Math.max(0, Math.min(100, ((value - spec.min) / (spec.max - spec.min)) * 100)),
  );
  // CSS-gradient track даёт визуальный fill от 0 до текущего value.
  let trackBg = $derived(
    `linear-gradient(to right,
      var(--primary) 0%,
      var(--primary) ${pct}%,
      var(--panel-divider) ${pct}%,
      var(--panel-divider) 100%)`,
  );
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
    style="background: {trackBg};"
  />
</div>

<style>
  .row { margin-bottom: 12px; }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .head label { margin: 0; flex: 1; }
  .head input[type="number"] {
    width: 76px;
    padding: 4px 8px;
    font-size: var(--font-sm);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
