import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, textureCompress, simplify, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Unzip the packs into SRC first (see CREDITS.md for where to get them).
const SRC = process.env.ASSETS_SRC ?? 'assets-src';
const OUT = 'src/assets/models';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const K = 'kaykit/KayKit_ResourceBits_1.0_FREE/Assets/gltf';
const S = 'scifi/Modular SciFi MegaKit[Standard]/glTF';
const pick = {
  nature: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Pebble_Square_1', 'Pebble_Square_3', 'Pebble_Square_5', 'Pebble_Round_2', 'Pebble_Round_4',
    'DeadTree_1', 'DeadTree_2', 'DeadTree_3', 'DeadTree_4', 'DeadTree_5', 'Grass_Wispy_Short', 'Grass_Wispy_Tall', 'Bush_Common'].map(n => [`nature/glTF/${n}.gltf`, n]),
  kaykit: ['Parts_Pile_Large', 'Parts_Pile_Medium', 'Parts_Pile_Small', 'Parts_Cog', 'Fuel_A_Barrel_Dirty', 'Fuel_B_Barrel_Dirty', 'Fuel_C_Barrels', 'Pallet_Wood',
    'Pallet_Wood_Covered_A', 'Pallet_Wood_Covered_B', 'Copper_Nuggets', 'Iron_Nuggets', 'Wood_Planks_Stack_Small', 'Textiles_Stack_Small', 'Stone_Chunks_Small'].map(n => [`${K}/${n}.gltf`, n]),
  scifi: [['Props', 'Prop_Crate3'], ['Props', 'Prop_Crate4'], ['Props', 'Prop_Barrel_Large'], ['Props', 'Prop_Computer'], ['Props', 'Prop_Vent_Big'], ['Props', 'Prop_AccessPoint'],
    ['Props', 'Prop_Chest'], ['Props', 'Prop_Light_Floor'], ['Columns', 'Column_MetalSupport'], ['Props', 'Prop_Cable_1']].map(([d, n]) => [`${S}/${d}/${n}.gltf`, n]),
  city: ['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2', 'Prop_ACUnit', 'Prop_Bollard'].map(n => [`city/Exports/gltf/${n}.gltf`, n]),
};
const MAX = { nature: 256, kaykit: 256, scifi: 256, city: 256 };
let total = 0;
for (const [pack, list] of Object.entries(pick)) {
  fs.mkdirSync(path.join(OUT, pack), { recursive: true });
  for (const [rel, name] of list) {
    const file = path.join(SRC, rel);
    if (!fs.existsSync(file)) { console.log('MISSING', rel); continue; }
    // missing images (normal/ORM maps we don't ship) get a 1×1 placeholder so the loader doesn't fail
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const im of json.images ?? []) {
      const f = path.join(path.dirname(file), decodeURIComponent(im.uri ?? ''));
      if (im.uri && !fs.existsSync(f)) fs.writeFileSync(f, await sharp({ create: { width: 1, height: 1, channels: 3, background: '#808080' } }).png().toBuffer());
    }
    const doc = await io.read(file);
    // keep only base colour: the game's look is flat and foggy, normal/ORM maps cost size
    for (const m of doc.getRoot().listMaterials()) {
      m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null);
    }
    const heavy = pack === 'city' || name.startsWith('DeadTree');
    await doc.transform(
      prune(), dedup(), weld(),
      ...(heavy ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.004 })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX[pack], MAX[pack]], quality: 80 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const out = path.join(OUT, pack, name + '.glb');
    await io.write(out, doc);
    const sz = fs.statSync(out).size; total += sz;
    console.log(pack, name, (sz / 1024).toFixed(0) + ' KB');
  }
}
console.log('TOTAL', (total / 1024 / 1024).toFixed(2), 'MB');
