// Packs the extra CC0 models used by the crafting tech demo (/demo-craft/) into
// src/assets/craft/<pack>/<name>.glb. Same treatment as tools/pack-models.mjs: base colour
// only, 256 px WebP textures, meshopt. Kept apart from src/assets/models so the game and
// the first demo do not load them.
//
// The packs are public on GitHub (CC0, Kay Lousberg):
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0
// Run: ASSETS_SRC=<folder with the clones> node tools/pack-craft-models.mjs
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
const OUT = process.env.OUT ?? 'src/assets/craft';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const packs = {
  space: ['KayKit-Space-Base-Bits-1.0/addons/kaykit_space_base_bits/Assets/gltf', [
    'solarpanel', 'windturbine_low', 'windturbine_tall', 'spacetruck_trailer', 'drill_structure', 'cargo_A', 'cargo_B', 'cargo_A_stacked',
    'containers_A', 'containers_B', 'lights', 'structure_low', 'landingpad_small', 'basemodule_garage', 'roofmodule_solarpanels']],
  furniture: ['KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf', [
    'shelf_B_large_decorated', 'cabinet_medium', 'table_medium_long', 'book_set']],
  city: ['KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf', [
    'car_sedan', 'car_hatchback', 'car_stationwagon', 'dumpster', 'streetlight', 'trash_A', 'watertower', 'box_A', 'firehydrant']],
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
