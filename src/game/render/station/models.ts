import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Models, fade } from '../../../render/assets';

/**
 * Extra CC0 models for Scene 2 (Kay Lousberg's KayKit packs, see CREDITS.md): what is in
 * src/assets/station (tools/pack-station-models.mjs) plus a few that the crafting demo
 * already ships in src/assets/craft. Faded to ash and dimmed like the rest of the world.
 */
const stationUrls = import.meta.glob('../../../assets/station/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const craftUrls = import.meta.glob('../../../assets/craft/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Models borrowed from the crafting demo's set. */
const FROM_CRAFT = ['solarpanel', 'lights', 'cargo_A', 'cargo_A_stacked', 'cargo_B', 'containers_A', 'basemodule_garage', 'structure_low',
  'book_set', 'cabinet_medium', 'table_medium_long', 'shelf_B_large_decorated'];

/** How far each pack is pulled to grey (0..1) and darkened: KayKit's palette is bright and clean. */
const FADE: Record<string, number> = { furniture: 0.72, halloween: 0.7, proto: 0.75, space: 0.78, city: 0.7 };
const DIM: Record<string, number> = { furniture: 0.62, halloween: 0.8, proto: 0.6, space: 0.6, city: 0.7 };
/** Single models that want their own darkness: dead solar glass is nearly black. */
const DIM_ONE: Record<string, number> = { solarpanel: 0.3 };

export async function loadStationModels(into: Models, onProgress?: (done: number, total: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const entries = [
    ...Object.entries(stationUrls),
    ...Object.entries(craftUrls).filter(([p]) => FROM_CRAFT.some(n => p.endsWith(`/${n}.glb`))),
  ];
  let done = 0;
  await Promise.all(entries.map(async ([path, url]) => {
    const m = path.match(/(\w+)\/(\w+)\.glb$/)!;
    const pack = m[1], name = m[2];
    const gltf = await loader.loadAsync(url);
    const cache = new Map<THREE.Material, THREE.Material>();
    gltf.scene.traverse(o => {
      const me = o as THREE.Mesh;
      if (!me.isMesh) return;
      me.castShadow = true; me.receiveShadow = true;
      const mats = Array.isArray(me.material) ? me.material : [me.material];
      const f = mats.map(x => {
        if (!cache.has(x)) {
          const c = fade(x, FADE[pack] ?? 0.7) as THREE.MeshStandardMaterial;
          c.color.multiplyScalar(DIM_ONE[name] ?? DIM[pack] ?? 0.7);
          cache.set(x, c);
        }
        return cache.get(x)!;
      });
      me.material = Array.isArray(me.material) ? f : f[0];
    });
    into.set(name, gltf.scene);
    onProgress?.(++done, entries.length);
  }));
}
