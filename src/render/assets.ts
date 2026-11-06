import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Third-party CC0 models (see CREDITS.md): Quaternius (Stylized Nature, Modular Sci-Fi,
 * Downtown City megakits) and Kay Lousberg (KayKit Resource Bits). Converted to small
 * meshopt GLBs with 256 px textures by tools/pack-models.mjs.
 *
 * Every material gets "faded": partly desaturated and pulled towards ash, so the bright
 * stock palettes sit in the foggy, washed-out world.
 */
const urls = import.meta.glob('../assets/models/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** How much each pack is faded (0 = original colours, 1 = grey). */
const FADE: Record<string, number> = { kaykit: 0.7, nature: 0.55, scifi: 0.35, city: 0.6 };
const ASH = new THREE.Color(0xb9b2a5);

export type Models = Map<string, THREE.Object3D>;

function fade(m: THREE.Material, amount: number): THREE.Material {
  const mm = (m as THREE.MeshStandardMaterial).clone();
  mm.onBeforeCompile = sh => {
    sh.uniforms.uFade = { value: amount };
    sh.uniforms.uAsh = { value: ASH };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFade; uniform vec3 uAsh;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l), uFade);
          diffuseColor.rgb = mix(diffuseColor.rgb, uAsh * l * 1.4, uFade * 0.35);
        }`);
  };
  mm.customProgramCacheKey = () => 'fade' + amount;
  if ('roughness' in mm) { mm.roughness = Math.max(mm.roughness, 0.8); mm.metalness = Math.min(mm.metalness, 0.3); }
  return mm;
}

export async function loadModels(onProgress?: (done: number, total: number) => void): Promise<Models> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const out: Models = new Map();
  const entries = Object.entries(urls);
  let done = 0;
  await Promise.all(entries.map(async ([path, url]) => {
    const m = path.match(/models\/(\w+)\/(\w+)\.glb$/)!;
    const pack = m[1], name = m[2];
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    const cache = new Map<THREE.Material, THREE.Material>();
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const amount = name.startsWith('Pebble') || name.startsWith('Rock') ? 0.75 : FADE[pack] ?? 0.5;
      const faded = mats.map(mt => { if (!cache.has(mt)) cache.set(mt, fade(mt, amount)); return cache.get(mt)!; });
      mesh.material = Array.isArray(mesh.material) ? faded : faded[0];
    });
    out.set(name, root);
    onProgress?.(++done, entries.length);
  }));
  return out;
}

/**
 * A copy of a model scaled to fit a w × d footprint (metres) and standing on the ground,
 * centred on the origin. `height` overrides the vertical size; otherwise it scales uniformly.
 */
export function fit(models: Models, name: string, w: number, d: number, height?: number, rotY = 0): THREE.Object3D {
  const src = models.get(name);
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  o.rotation.y = rotY;
  const wrap = new THREE.Group();
  wrap.add(o);
  const b = new THREE.Box3().setFromObject(o);
  const size = b.getSize(new THREE.Vector3());
  const sx = w / size.x, sz = d / size.z;
  const s = Math.min(sx, sz);
  const sy = height ? height / size.y : s;
  o.scale.set(s, sy, s);
  const b2 = new THREE.Box3().setFromObject(o);
  const c = b2.getCenter(new THREE.Vector3());
  o.position.set(-c.x, -b2.min.y, -c.z);
  return wrap;
}

/** A copy at a uniform scale, standing on the ground. */
export function place(models: Models, name: string, scale = 1, rotY = 0): THREE.Object3D {
  const src = models.get(name);
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  o.scale.setScalar(scale); o.rotation.y = rotY;
  const wrap = new THREE.Group(); wrap.add(o);
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(new THREE.Vector3());
  o.position.set(-c.x, -b.min.y, -c.z); // centred on its footprint, standing on the ground
  return wrap;
}
