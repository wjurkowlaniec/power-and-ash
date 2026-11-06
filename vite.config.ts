/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> dist/ for GitHub Pages (relative base so it works under /power-and-ash/)
// `npm run build:single` -> dist-single/index.html, one self-contained file
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    // the single-file build inlines the models as data: URIs
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
  test: { include: ['test/**/*.test.ts'] },
}));
