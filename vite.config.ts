/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// Two entries in one repo, sharing src/sim, src/render and src/audio:
//   index.html       -> the game (scenes from docs/POCZATEK.md), src/game/main.ts
//   demo/index.html  -> the tech demo (level "Rozruch"), src/main.ts
//   demo-craft/index.html -> the crafting tech demo ("Warsztat"), src/craft/main.ts
//   demo-sail/index.html -> the land yacht driving demo ("Żegluga"), src/sail/main.ts
//   demo-sun/index.html -> delivery in the sun ("Słońce"), src/sun/main.ts
//   demo-returns/index.html -> one homestead over the years ("Powroty"), src/returns/main.ts
// `npm run build` -> dist/ for GitHub Pages (relative base so it works under /power-and-ash/)
// `npm run build:single` -> dist-single/, one self-contained file per page (PAGE=game|demo|craft|sail|sun|returns, default game)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const page = process.env.PAGE === 'demo' ? 'demo/index.html' : process.env.PAGE === 'craft' ? 'demo-craft/index.html' : process.env.PAGE === 'sail' ? 'demo-sail/index.html' : process.env.PAGE === 'sun' ? 'demo-sun/index.html' : process.env.PAGE === 'returns' ? 'demo-returns/index.html' : 'index.html';
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
          : { game: resolve(__dirname, 'index.html'), demo: resolve(__dirname, 'demo/index.html'), craft: resolve(__dirname, 'demo-craft/index.html'), sail: resolve(__dirname, 'demo-sail/index.html'), sun: resolve(__dirname, 'demo-sun/index.html'), returns: resolve(__dirname, 'demo-returns/index.html') },
      },
    },
    test: { include: ['test/**/*.test.ts'] },
  };
});
