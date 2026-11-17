import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skinnedClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Models } from '../render/assets';
import { Entry, Ctx } from './catalog';

/**
 * Every packed GLB in src/assets, one entry each. By default a model is shown the way the
 * game shows it (the copy from the game's own loader, faded to ash); "original colours"
 * loads the untouched file. Baked animation clips (only Prop_Chest has them now) come from
 * the untouched file and play on either copy, as the node names are the same.
 */
const urls = import.meta.glob('../assets/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export interface GlbEntry extends Entry { url: string; dir: string; pack: string; file: string }

/** Which loaded set holds the game's copy of a model from this directory. */
const setOf = (dir: string, ctx: Ctx): Models => (dir === 'station' ? ctx.station : ctx.models);

export function glbEntries(): GlbEntry[] {
  return Object.entries(urls).map(([path, url]) => {
    const m = path.match(/assets\/(\w+)\/(\w+)\/(\w+)\.glb$/)!;
    const [, dir, pack, file] = m;
    const entry: GlbEntry = {
      id: `glb:${dir}/${pack}/${file}`, group: `glb:${dir}/${pack}`, name: file, src: `src/assets/${dir}/${pack}/${file}.glb`, url, dir, pack, file,
      async build(ctx) {
        const raw = await loadRaw(url);
        const game = setOf(dir, ctx).get(file);
        // SkeletonUtils: a plain clone would leave skinned meshes bound to the source's bones
        return { object: skinnedClone(game ?? raw.scene), clips: raw.animations };
      },
    };
    return entry;
  }).sort((a, b) => a.id.localeCompare(b.id));
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const raws = new Map<string, Promise<GLTF>>();

/** The file as it is, loaded once. */
export function loadRaw(url: string): Promise<GLTF> {
  if (!raws.has(url)) raws.set(url, loader.loadAsync(url));
  return raws.get(url)!;
}

/** The untouched copy for "original colours". */
export async function rawCopy(e: GlbEntry): Promise<THREE.Object3D> {
  return skinnedClone((await loadRaw(e.url)).scene);
}
