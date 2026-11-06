/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// Two entries in one repo, sharing src/sim, src/render and src/audio:
//   index.html       -> the game (scenes from docs/POCZATEK.md), src/game/main.ts
//   demo/index.html  -> the tech demo (level "Rozruch"), src/main.ts
// `npm run build` -> dist/ for GitHub Pages (relative base so it works under /power-and-ash/)
// `npm run build:single` -> dist-single/, one self-contained file per page (PAGE=game|demo, default game)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const page = process.env.PAGE === 'demo' ? 'demo/index.html' : 'index.html';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2022',
      // the single-file build inlines the models as data: URIs
      assetsInlineLimit: single ? 100_000_000 : 4096,
      rollupOptions: {
        input: single
          ? resolve(__dirname, page)
          : { game: resolve(__dirname, 'index.html'), demo: resolve(__dirname, 'demo/index.html') },
      },
    },
    test: { include: ['test/**/*.test.ts'] },
  };
});
