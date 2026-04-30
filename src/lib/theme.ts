/**
 * Тема: 'light' | 'dark' | 'system'.
 * Применяется как `data-theme` на <html>. При 'system' берётся
 * из media query `prefers-color-scheme` и обновляется реактивно.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'heightmap-gen.theme';

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* localStorage unavailable */ }
  return 'system';
}

export function writeChoice(c: ThemeChoice) {
  try { localStorage.setItem(KEY, c); } catch { /* ignore */ }
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(choice: ThemeChoice) {
  const t = resolveTheme(choice);
  document.documentElement.setAttribute('data-theme', t);
}

/**
 * Подписаться на системные изменения темы. Возвращает unsubscribe.
 * Колбэк вызывается ТОЛЬКО когда choice = 'system' (передавать через ref).
 */
export function listenSystem(onChange: () => void): () => void {
  const m = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();
  m.addEventListener('change', handler);
  return () => m.removeEventListener('change', handler);
}
