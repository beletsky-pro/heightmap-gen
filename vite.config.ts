import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  base: process.env.GHPAGES_BASE || '/',
  plugins: [
    svelte(),
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      compress: false,
      watch: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
