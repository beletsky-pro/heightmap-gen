<script lang="ts">
  import { onMount } from 'svelte';
  import { applyTheme, listenSystem, readChoice, writeChoice, type ThemeChoice } from '../lib/theme';

  let choice = $state<ThemeChoice>('system');

  onMount(() => {
    choice = readChoice();
    applyTheme(choice);
    return listenSystem(() => {
      if (choice === 'system') applyTheme('system');
    });
  });

  function set(c: ThemeChoice) {
    choice = c;
    writeChoice(c);
    applyTheme(c);
  }
</script>

<div class="theme-toggle" role="group" aria-label="Тема">
  <button class="seg" class:active={choice === 'light'} aria-label="Светлая" title="Светлая" onclick={() => set('light')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  </button>
  <button class="seg" class:active={choice === 'system'} aria-label="Системная" title="Системная" onclick={() => set('system')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  </button>
  <button class="seg" class:active={choice === 'dark'} aria-label="Тёмная" title="Тёмная" onclick={() => set('dark')}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
</div>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    background: var(--input-bg);
    padding: 3px;
    border-radius: var(--radius-md);
    gap: 2px;
  }
  .seg {
    width: 32px; height: 28px;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast), color var(--transition-fast);
  }
  .seg:hover { background: var(--input-bg-hover); color: var(--fg); }
  .seg.active {
    background: var(--bg-elevated);
    color: var(--fg);
    box-shadow: var(--shadow-sm);
  }
  :global(html[data-theme="dark"]) .seg.active {
    background: var(--bg-canvas);
  }
</style>
