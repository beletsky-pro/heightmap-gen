import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { applyTheme, readChoice } from './lib/theme';

// Сначала тема — чтобы избежать вспышки светлой темы при тёмных настройках.
applyTheme(readChoice());

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
