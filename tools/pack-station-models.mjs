// Packs the extra CC0 models used by Scene 2 „Martwa stacja” of the game into
// src/assets/station/<pack>/<name>.glb. Same treatment as tools/pack-craft-models.mjs: base
// colour only, 256 px WebP textures, meshopt. The scene also reuses models already packed
// for the crafting demo (src/assets/craft); see src/game/render/station/models.ts.
//
// The packs are public on GitHub (CC0, Kay Lousberg):
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Prototype-Bits-1.0
// Run: ASSETS_SRC=<folder with the clones> node tools/pack-station-models.mjs
// (needs @gltf-transform/core, extensions, functions, meshoptimizer and sharp installed)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
await MeshoptEncoder.ready;

const SRC = process.env.ASSETS_SRC ?? 'assets-src';
const OUT = process.env.OUT ?? 'src/assets/station';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const packs = {
  furniture: ['KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf', [
    'chair_C', 'cabinet_small', 'lamp_table', 'couch', 'rug_rectangle_A']],
  halloween: ['KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf', [
    'fence_seperate', 'fence_seperate_broken', 'fence_pillar', 'tree_pine_yellow_medium', 'tree_pine_yellow_small',
    'tree_pine_orange_large', 'path_A', 'path_C', 'path_D', 'bench']],
  proto: ['KayKit-Prototype-Bits-1.0/addons/kaykit_prototype_bits/Assets/gltf', [
    'Pallet_Small', 'Barrel_A', 'Box_A', 'Can_A']],
};
let total = 0;
for (const [pack, [dir, names]] of Object.entries(packs)) {
  fs.mkdirSync(path.join(OUT, pack), { recursive: true });
  for (const name of names) {
    const file = path.join(SRC, dir, name + '.gltf');
    if (!fs.existsSync(file)) { console.log('MISSING', file); continue; }
    const doc = await io.read(file);
    for (const m of doc.getRoot().listMaterials()) {
      m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null);
    }
    await doc.transform(prune(), dedup(), weld(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [256, 256], quality: 80 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = path.join(OUT, pack, name + '.glb');
    await io.write(out, doc);
    const sz = fs.statSync(out).size; total += sz;
    console.log(pack, name, (sz / 1024).toFixed(0) + ' KB');
  }
}
console.log('TOTAL', (total / 1024 / 1024).toFixed(2), 'MB');
