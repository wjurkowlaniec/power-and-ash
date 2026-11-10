import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Models, fit, fade } from '../../render/assets';
import { mat, mesh } from '../../render/models';
import { PAL } from '../../render/palette';
import { ItemId, BuildKind, ScrapKind } from '../data';
import { sailclothIcon, yachtMastIcon, sailIcon, runnersIcon, iceYachtWreck, fallenBalloon } from './yachtModels';

/**
 * Models for the crafting demo. Stock CC0 models from Kay Lousberg's KayKit packs
 * (Space Base Bits, Furniture Bits, City Builder Bits; src/assets/craft, packed by
 * tools/pack-craft-models.mjs) next to the shared Quaternius/KayKit set, faded to ash
 * like everything else. What no pack has (the splitter, the radio mast, small parts
 * for the inventory icons) is modelled here in code, with bevels and real detail.
 */
const urls = import.meta.glob('../../assets/craft/**/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const FADE: Record<string, number> = { space: 0.72, furniture: 0.6, city: 0.65 };
const DIM: Record<string, number> = { space: 0.62, furniture: 0.8, city: 0.72 };

export async function loadCraftModels(into: Models, onProgress?: (d: number, t: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const entries = Object.entries(urls);
  let done = 0;
  await Promise.all(entries.map(async ([path, url]) => {
    const m = path.match(/craft\/(\w+)\/(\w+)\.glb$/)!;
    const gltf = await loader.loadAsync(url);
    const cache = new Map<THREE.Material, THREE.Material>();
    gltf.scene.traverse(o => {
      const me = o as THREE.Mesh;
      if (!me.isMesh) return;
      me.castShadow = true; me.receiveShadow = true;
      const mats = Array.isArray(me.material) ? me.material : [me.material];
      const f = mats.map(x => {
        if (!cache.has(x)) {
          const c = fade(x, FADE[m[1]] ?? 0.6) as THREE.MeshStandardMaterial;
          // the KayKit palettes are bright and clean: pull them down so white reads as weathered paint
          c.color.multiplyScalar(DIM[m[1]] ?? 0.8);
          cache.set(x, c);
        }
        return cache.get(x)!;
      });
      me.material = Array.isArray(me.material) ? f : f[0];
    });
    into.set(m[2], gltf.scene);
    onProgress?.(++done, entries.length);
  }));
}

// ---------------------------------------------------------------- materials

const M = {
  steel: () => mat(0x5d6367, { r: 0.45, m: 0.6 }),
  dark: () => mat(0x1e2022, { r: 0.7, m: 0.3 }),
  paint: () => mat(0x6b7378, { r: 0.6, m: 0.25 }),
  mustard: () => mat(0x8a7a4e, { r: 0.7 }),
  rust: () => mat(PAL.rust, { r: 0.85, m: 0.3 }),
  copper: () => mat(PAL.copper, { r: 0.4, m: 0.7 }),
  rubber: () => mat(0x161616, { r: 0.95 }),
  pcb: () => mat(0x2f4a3c, { r: 0.6 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 }),
  pv: () => mat(0x22344a, { r: 0.25, m: 0.55 }),
  pale: () => mat(0xbdb7aa, { r: 0.8 }),
};
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m, x, y, z);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
/** A glowing bit (LED, socket ring) whose material the view can light up. */
export const led = (color: number, r = 0.03) => mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 1.5 }), 0, 0, 0, false);

// ---------------------------------------------------------------- procedural models

/** Splitter: a weatherproof junction box on a stake, four sockets on its faces, a status LED. */
export function splitterModel(): { group: THREE.Group; led: THREE.Mesh } {
  const g = new THREE.Group();
  g.add(put(cyl(0.035, 0.05, 0.5, M.steel(), 8), 0, 0.25, 0));
  g.add(rbox(0.46, 0.34, 0.46, 0.05, M.paint(), 0, 0.62, 0));
  g.add(rbox(0.5, 0.05, 0.5, 0.02, M.dark(), 0, 0.81, 0)); // lid
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const s = new THREE.Group(); s.rotation.y = a; g.add(s);
    const sock = cyl(0.07, 0.07, 0.06, M.dark(), 14); sock.rotation.x = Math.PI / 2; sock.position.set(0, 0.6, 0.255); s.add(sock);
    const pin = cyl(0.035, 0.035, 0.02, M.copper(), 10); pin.rotation.x = Math.PI / 2; pin.position.set(0, 0.6, 0.29); s.add(pin);
    s.add(rbox(0.16, 0.03, 0.03, 0.01, M.dark(), 0, 0.7, 0.245)); // rain lip
  }
  const l = led(PAL.warn, 0.025); l.position.set(0.15, 0.85, 0.15); g.add(l);
  // warning plate
  g.add(mesh(new THREE.PlaneGeometry(0.16, 0.08), mat(0x8a7a4e, { r: 0.7 }), 0, 0.52, 0.232));
  return { group: g, led: l };
}

/** Radio mast: a three-legged tapering lattice tower, about 12 m, with a dish, a whip aerial and a red light. */
export function mastModel(): { group: THREE.Group; light: THREE.Mesh; dish: THREE.Group } {
  const g = new THREE.Group();
  const H = 11, base = 0.75, top = 0.22;
  const st = mat(0x4a4f53, { r: 0.55, m: 0.55 });
  const legs: THREE.Vector3[][] = [];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + Math.PI / 2;
    legs.push([new THREE.Vector3(Math.cos(a) * base, 0.35, Math.sin(a) * base), new THREE.Vector3(Math.cos(a) * top, H, Math.sin(a) * top)]);
  }
  const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = b.clone().sub(a), l = d.length();
    const m = mesh(new THREE.CylinderGeometry(r, r, l, 6), st);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(m);
  };
  const at = (leg: number, t: number) => legs[leg][0].clone().lerp(legs[leg][1], t);
  for (const [a, b] of legs) strut(a, b, 0.045);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      strut(at(k, t0), at(k2, t0), 0.018);           // ring
      strut(at(k, t0), at(k2, t1), 0.014);           // diagonal
    }
  }
  // concrete footings and a cable tray down one leg
  for (const [a] of legs) g.add(put(cyl(0.22, 0.26, 0.35, mat(0x8d8a83), 10), a.x, 0.175, a.z));
  g.add(rbox(0.5, 0.6, 0.35, 0.04, M.paint(), 0, 0.65, 0.95)); // equipment box at the foot
  g.add(rbox(0.52, 0.05, 0.37, 0.02, M.dark(), 0, 0.97, 0.95));
  // platform, dish, whip
  g.add(put(cyl(0.45, 0.45, 0.05, st, 12), 0, H - 1.2, 0));
  const dish = new THREE.Group(); dish.position.set(0, H - 0.6, 0.25); g.add(dish);
  const bowl = mesh(new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, 0.75), M.pale()); bowl.rotation.x = Math.PI / 2 + 0.25; dish.add(bowl);
  (bowl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const feed = cyl(0.015, 0.015, 0.45, st, 6); feed.rotation.x = Math.PI / 2 + 0.25; feed.position.set(0, -0.05, 0.25); dish.add(feed);
  const whip = cyl(0.012, 0.02, 2.4, st, 6); whip.position.set(0, H + 1.2, 0); g.add(whip);
  for (let i = 0; i < 3; i++) { const r = cyl(0.12 - i * 0.03, 0.12 - i * 0.03, 0.02, st, 10); r.position.set(0, H + 0.3 + i * 0.5, 0); g.add(r); }
  const light = led(PAL.off, 0.07); light.position.set(0, H + 2.45, 0); g.add(light);
  return { group: g, light, dish };
}

/** Charging cradle: a low pad with two copper contact rails and a pantograph arm. */
export function cradleModel(models: Models): { group: THREE.Group; rails: THREE.Mesh[] } {
  const g = new THREE.Group();
  if (models.has('landingpad_small')) g.add(fit(models, 'landingpad_small', 1.9, 1.9, 0.18));
  else g.add(rbox(1.9, 0.18, 1.9, 0.08, M.paint(), 0, 0.09, 0));
  const rails: THREE.Mesh[] = [];
  for (const x of [-0.25, 0.25]) {
    const r = rbox(0.06, 0.04, 1.3, 0.015, new THREE.MeshStandardMaterial({ color: PAL.copper, roughness: 0.35, metalness: 0.7, emissive: PAL.flow, emissiveIntensity: 0 }), x, 0.2, 0);
    g.add(r); rails.push(r);
  }
  // pantograph post at the back with a contact shoe
  g.add(rbox(0.16, 1.0, 0.16, 0.03, M.dark(), 0, 0.6, -0.85));
  const arm = rbox(0.06, 0.06, 0.55, 0.02, M.steel(), 0, 1.05, -0.62); arm.rotation.x = 0.35; g.add(arm);
  g.add(rbox(0.22, 0.04, 0.1, 0.015, M.copper(), 0, 0.95, -0.38));
  return { group: g, rails };
}

/** The workbench: a long table with a vice, a tool board and a lamp; KayKit table if loaded. */
export function benchModel(models: Models): { group: THREE.Group; lamp: THREE.Mesh } {
  const g = new THREE.Group();
  if (models.has('table_medium_long')) g.add(fit(models, 'table_medium_long', 2.8, 0.9, 0.9));
  else g.add(rbox(2.8, 0.9, 0.9, 0.05, M.rust(), 0, 0.45, 0));
  // steel top plate, vice, a coil of cable, a box of bits
  g.add(rbox(2.7, 0.04, 0.85, 0.015, M.steel(), 0, 0.92, 0));
  const vice = new THREE.Group(); vice.position.set(-1.1, 0.94, 0.2); g.add(vice);
  vice.add(rbox(0.22, 0.1, 0.16, 0.02, M.paint(), 0, 0.05, 0));
  vice.add(rbox(0.06, 0.14, 0.16, 0.015, M.paint(), -0.08, 0.17, 0));
  vice.add(rbox(0.06, 0.14, 0.16, 0.015, M.paint(), 0.06, 0.17, 0));
  const screw = cyl(0.012, 0.012, 0.3, M.steel(), 6); screw.rotation.z = Math.PI / 2; screw.position.set(0.2, 0.17, 0); vice.add(screw);
  const coil = mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), M.copper(), 0.7, 0.98, 0.1); coil.rotation.x = Math.PI / 2; g.add(coil);
  g.add(rbox(0.36, 0.12, 0.22, 0.02, M.mustard(), 0.1, 1.0, -0.2));
  // tool board behind
  g.add(rbox(2.6, 1.0, 0.05, 0.02, mat(0x4b4842, { r: 0.9 }), 0, 1.55, -0.42));
  for (let i = 0; i < 7; i++) {
    const t = rbox(0.04, 0.3 + (i % 3) * 0.08, 0.03, 0.01, i % 2 ? M.steel() : M.dark(), -1.05 + i * 0.33, 1.5, -0.38);
    t.rotation.z = (i % 2 ? 0.1 : -0.08); g.add(t);
  }
  const lamp = mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.12, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: PAL.lamp, emissiveIntensity: 0.2, side: THREE.DoubleSide }), 0.9, 2.15, -0.2);
  g.add(lamp);
  g.add(put(cyl(0.012, 0.012, 0.55, M.dark(), 5), 0.9, 2.45, -0.3));
  return { group: g, lamp };
}

// ---------------------------------------------------------------- small parts (inventory icons and loose items)

function cableSpool(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const f = cyl(0.42, 0.42, 0.05, mat(0x6b5f50, { r: 0.9 }), 20); f.rotation.z = Math.PI / 2; f.position.x = s * 0.27; g.add(f); }
  for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.28 - i * 0.01, 0.045, 8, 26), M.copper()); t.rotation.y = Math.PI / 2; t.position.x = -0.19 + i * 0.125; g.add(t); }
  const hub = cyl(0.08, 0.08, 0.6, M.dark(), 10); hub.rotation.z = Math.PI / 2; g.add(hub);
  const tail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 0.3, 0.1), new THREE.Vector3(0.35, 0.1, 0.4), new THREE.Vector3(0.5, -0.3, 0.45)]), 12, 0.035, 6), M.copper());
  g.add(tail);
  g.position.y = 0.42;
  return wrap(g);
}

function pcb(chips = 4, color?: number): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.9, 0.05, 0.6, 0.02, color ? mat(color, { r: 0.6 }) : M.pcb(), 0, 0.025, 0));
  for (let i = 0; i < chips; i++) g.add(rbox(0.16, 0.05, 0.16, 0.01, M.dark(), -0.28 + (i % 3) * 0.28, 0.07, -0.12 + Math.floor(i / 3) * 0.26));
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.6, 0.006, 0.012), M.copper(), 0, 0.053, -0.25 + i * 0.1));
  const cap = cyl(0.05, 0.05, 0.12, mat(0x3b5c7a, { r: 0.5 }), 10); cap.position.set(0.33, 0.11, 0.18); g.add(cap);
  g.add(rbox(0.12, 0.08, 0.2, 0.01, mat(0xd8d3c8), -0.38, 0.09, 0.15));
  return wrap(g);
}

function bearing(): THREE.Group {
  const g = new THREE.Group();
  const outer = mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 28), M.steel()); outer.rotation.x = Math.PI / 2; g.add(outer);
  const inner = mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 24), M.steel()); inner.rotation.x = Math.PI / 2; g.add(inner);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x9aa0a4, { r: 0.25, m: 0.9 }), Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26)); }
  g.position.y = 0.08; g.rotation.x = 0.5;
  return wrap(g);
}

function motor(): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.28, 0.28, 0.6, M.paint(), 20); body.rotation.z = Math.PI / 2; g.add(body);
  for (let i = 0; i < 12; i++) { const f = rbox(0.5, 0.03, 0.04, 0.01, M.paint()); const a = i / 12 * Math.PI * 2; f.position.set(0, Math.cos(a) * 0.3, Math.sin(a) * 0.3); f.rotation.x = a; g.add(f); }
  const cap1 = cyl(0.24, 0.27, 0.08, M.dark(), 20); cap1.rotation.z = Math.PI / 2; cap1.position.x = 0.33; g.add(cap1);
  const shaft = cyl(0.04, 0.04, 0.25, M.steel(), 8); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.48; g.add(shaft);
  g.add(rbox(0.18, 0.12, 0.16, 0.02, M.dark(), -0.05, 0.32, 0));
  g.add(rbox(0.6, 0.06, 0.5, 0.02, M.dark(), 0, -0.3, 0));
  g.position.y = 0.33;
  return wrap(g);
}

function frame(): THREE.Group {
  const g = new THREE.Group();
  const m = M.rust();
  for (const z of [-0.3, 0.3]) for (const y of [0, 0.5]) g.add(rbox(1.0, 0.06, 0.06, 0.01, m, 0, y + 0.03, z));
  for (const x of [-0.47, 0.47]) for (const z of [-0.3, 0.3]) g.add(rbox(0.06, 0.56, 0.06, 0.01, m, x, 0.28, z));
  for (const z of [-0.3, 0.3]) { const d = rbox(1.05, 0.04, 0.04, 0.01, m, 0, 0.28, z); d.rotation.z = Math.atan2(0.5, 0.94); g.add(d); }
  for (const x of [-0.47, 0.47]) g.add(rbox(0.05, 0.05, 0.6, 0.01, m, x, 0.03, 0));
  return wrap(g);
}

function cells(n = 6, pack = false): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group();
    c.add(cyl(0.11, 0.11, 0.5, mat(i % 2 ? 0x3d5a6b : 0x4a5f4a, { r: 0.5 }), 14));
    c.add(put(cyl(0.06, 0.06, 0.04, M.steel(), 8), 0, 0.27, 0));
    c.position.set(-0.24 + (i % 3) * 0.24, 0.25, -0.12 + Math.floor(i / 3) * 0.24);
    g.add(c);
  }
  if (pack) {
    g.add(rbox(0.82, 0.08, 0.6, 0.02, M.dark(), 0, 0.04, 0));
    g.add(rbox(0.82, 0.04, 0.6, 0.02, M.mustard(), 0, 0.53, 0));
    g.add(rbox(0.2, 0.08, 0.08, 0.02, M.copper(), 0.2, 0.58, 0));
  }
  return wrap(g);
}

function pvModule(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.0, 0.04, 0.62, 0.01, M.steel(), 0, 0.02, 0));
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) g.add(mesh(new THREE.BoxGeometry(0.15, 0.02, 0.13), M.pv(), -0.4 + i * 0.16, 0.05, -0.21 + j * 0.14));
  g.rotation.x = 0.4;
  return wrap(g);
}

function wafer(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const w = cyl(0.3, 0.3, 0.02, mat(0x3a4250, { r: 0.2, m: 0.7 }), 6); w.position.set(i * 0.12 - 0.12, 0.02 + i * 0.03, i * 0.05); w.rotation.y = i * 0.4; g.add(w); }
  return wrap(g);
}

function shards(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.3 + i * 0.03, 0.05), new THREE.Vector2(0.12, 0.35 - i * 0.03)]);
    const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), M.glass());
    m.rotation.set(-Math.PI / 2 + (i - 2) * 0.15, 0, i * 1.3); m.position.set((i - 2) * 0.12, 0.03 + i * 0.01, (i % 2) * 0.1);
    g.add(m);
  }
  return wrap(g);
}

function wrench(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.9, 0.05, 0.1, 0.02, M.steel(), 0, 0, 0));
  const head = mesh(new THREE.TorusGeometry(0.1, 0.045, 8, 16), M.steel(), 0.5, 0, 0); head.rotation.x = Math.PI / 2; g.add(head);
  const sock = cyl(0.08, 0.08, 0.16, M.steel(), 6); sock.position.set(0.5, -0.08, 0); g.add(sock);
  g.add(rbox(0.4, 0.07, 0.12, 0.03, M.rubber(), -0.3, 0, 0));
  g.rotation.set(0.3, 0.6, 0); g.position.y = 0.2;
  return wrap(g);
}

function cutter(): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.11, 0.11, 0.6, M.mustard(), 14); body.rotation.z = Math.PI / 2; g.add(body);
  g.add(rbox(0.2, 0.18, 0.2, 0.04, M.dark(), 0.38, 0, 0));
  const disc = cyl(0.3, 0.3, 0.02, mat(0x8a8f92, { r: 0.4, m: 0.7 }), 24); disc.position.set(0.42, -0.14, 0); g.add(disc);
  const guard = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20, 1, true, 0, Math.PI), M.dark()); guard.position.set(0.42, -0.1, 0); g.add(guard);
  const handle = cyl(0.035, 0.035, 0.3, M.rubber(), 8); handle.position.set(0.38, 0.12, 0.15); handle.rotation.x = 0.6; g.add(handle);
  g.rotation.y = 0.5; g.position.y = 0.4;
  return wrap(g);
}

function solderIron(): THREE.Group {
  const g = new THREE.Group();
  const h = cyl(0.06, 0.07, 0.45, mat(0x3b5c7a, { r: 0.6 }), 12); h.rotation.z = Math.PI / 2; g.add(h);
  const t = cyl(0.025, 0.04, 0.3, M.steel(), 10); t.rotation.z = Math.PI / 2; t.position.x = 0.36; g.add(t);
  const tip = mesh(new THREE.ConeGeometry(0.02, 0.1, 8), M.copper(), 0.55, 0, 0); tip.rotation.z = -Math.PI / 2; g.add(tip);
  const cord = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.22, 0, 0), new THREE.Vector3(-0.4, -0.1, 0.1), new THREE.Vector3(-0.45, -0.2, 0.35)]), 10, 0.015, 5), M.rubber());
  g.add(cord);
  g.rotation.y = 0.5; g.position.y = 0.2;
  return wrap(g);
}

function multimeter(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.42, 0.12, 0.7, 0.05, M.mustard(), 0, 0.06, 0));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.01, 0.2), new THREE.MeshStandardMaterial({ color: 0x9fb39a, emissive: 0x5f7a5a, emissiveIntensity: 0.6 }), 0, 0.125, -0.18));
  const knob = cyl(0.1, 0.1, 0.04, M.dark(), 14); knob.position.set(0, 0.14, 0.1); g.add(knob);
  for (const [x, c] of [[-0.1, 0x1b1b1b], [0.1, 0xb04030]] as const) {
    const lead = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.08, 0.35), new THREE.Vector3(x * 3, 0.03, 0.55), new THREE.Vector3(x * 4, 0.02, 0.8)]), 10, 0.015, 5), mat(c, { r: 0.8 }));
    g.add(lead);
  }
  g.rotation.x = 0.3;
  return wrap(g);
}

/** A plug-in module for Wolt's frame: a sealed casing with a coloured band, pins, and the part that shows what it does. */
export function moduleModel(id: ItemId): THREE.Group {
  const g = new THREE.Group();
  const band: Partial<Record<ItemId, number>> = { m_lamp: 0xd9b36a, m_arm: 0x8a8f92, m_cells: 0x6fa08a, m_radio: 0xb07a50, m_remote: 0x7a8fb0, m_ai: 0xcfe4ea };
  g.add(rbox(0.6, 0.3, 0.4, 0.06, M.paint(), 0, 0.15, 0));
  g.add(rbox(0.62, 0.06, 0.42, 0.02, mat(band[id] ?? 0x888888, { r: 0.6 }), 0, 0.2, 0));
  for (let i = 0; i < 4; i++) g.add(rbox(0.04, 0.06, 0.04, 0.01, M.copper(), -0.15 + i * 0.1, -0.02, 0.12));
  switch (id) {
    case 'm_lamp': { const l = cyl(0.13, 0.1, 0.12, M.dark(), 16); l.rotation.x = Math.PI / 2; l.position.set(0, 0.17, 0.25); g.add(l); g.add(put(mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 1.5 })), 0, 0.17, 0.315)); break; }
    case 'm_arm': { const a = rbox(0.1, 0.5, 0.1, 0.03, M.steel(), 0.2, 0.45, 0); a.rotation.z = -0.5; g.add(a); g.add(put(mesh(new THREE.SphereGeometry(0.07, 10, 8), M.steel()), 0.08, 0.3, 0)); break; }
    case 'm_cells': for (let i = 0; i < 3; i++) g.add(put(cyl(0.06, 0.06, 0.28, mat(0x4a5f4a, { r: 0.5 }), 10), -0.15 + i * 0.15, 0.42, 0)); break;
    case 'm_radio': { const w = cyl(0.012, 0.018, 0.7, M.dark(), 6); w.position.set(0.18, 0.62, -0.05); g.add(w); g.add(put(led(PAL.warn, 0.03), -0.15, 0.33, 0.15)); break; }
    case 'm_remote': { const d = mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, 1.2), M.pale()); d.position.set(0, 0.31, 0); g.add(d); (d.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; break; }
    case 'm_ai': { g.add(rbox(0.3, 0.06, 0.3, 0.02, M.dark(), 0, 0.33, 0)); g.add(put(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xcfe4ea, emissive: 0xcfe4ea, emissiveIntensity: 1.2 })), 0, 0.37, 0)); break; }
    default: break;
  }
  return wrap(g);
}

/** Put an object at a local position and return it. */
function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T { o.position.set(x, y, z); return o; }

const wrap = (o: THREE.Object3D) => { const g = new THREE.Group(); g.add(o); return g; };

/** A 3D model for an inventory item (for icons and things lying on the ground). */
export function itemModel(id: ItemId, models: Models): THREE.Object3D {
  const has = (n: string) => models.has(n);
  switch (id) {
    case 'iron': return has('Iron_Nuggets') ? fit(models, 'Iron_Nuggets', 1, 1) : frame();
    case 'copper': return has('Copper_Nuggets') ? fit(models, 'Copper_Nuggets', 1, 1) : cableSpool();
    case 'plastic': return has('Textiles_Stack_Small') ? fit(models, 'Textiles_Stack_Small', 1, 1) : pcb(0, 0x8a8a80);
    case 'glass': return shards();
    case 'electronics': return pcb(5);
    case 'cells': return cells(6);
    case 'bearings': return bearing();
    case 'silicon': return wafer();
    case 'scrapmix': return has('Parts_Pile_Small') ? fit(models, 'Parts_Pile_Small', 1, 1) : frame();
    case 'cable': return cableSpool();
    case 'circuit': return pcb(3, 0x29405a);
    case 'motor': return motor();
    case 'pvcell': return pvModule();
    case 'frame': return frame();
    case 'cellpack': return cells(6, true);
    case 'wrench': return wrench();
    case 'cutter': return cutter();
    case 'solder': return solderIron();
    case 'meter': return multimeter();
    case 'sailcloth': return sailclothIcon();
    case 'yachtmast': return yachtMastIcon();
    case 'sail': return sailIcon();
    case 'runners': return runnersIcon();
    case 'm_lamp': case 'm_arm': case 'm_cells': case 'm_radio': case 'm_remote': case 'm_ai': return moduleModel(id);
    default: return buildingModel(id as BuildKind, models).group;
  }
}

// ---------------------------------------------------------------- buildings and scrap

export interface BuildingModel {
  group: THREE.Group;
  /** What spins (turbine rotors), bobs (the recycler's drill), glows. */
  fan?: THREE.Object3D;
  drill?: THREE.Object3D;
  glow: THREE.Mesh[];
  light?: THREE.PointLight;
  dish?: THREE.Group;
  /** Socket marker the cables run to (local position). */
  port: THREE.Vector3;
}

/** A model standing on a w × h footprint, centred on the origin. */
export function buildingModel(kind: BuildKind, models: Models): BuildingModel {
  const g = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  let fan: THREE.Object3D | undefined, drill: THREE.Object3D | undefined, light: THREE.PointLight | undefined, dish: THREE.Group | undefined;
  let port = new THREE.Vector3(0, 0.45, 0);
  const named = (o: THREE.Object3D, n: string) => o.getObjectByName(n) ?? undefined;
  switch (kind) {
    case 'bench': { const b = benchModel(models); g.add(b.group); glow.push(b.lamp); port = new THREE.Vector3(0, 0.5, 0.5); break; }
    case 'oldturbine': {
      const t = fit(models, 'windturbine_tall', 1.8, 1.8, 6.5); g.add(t);
      fan = named(t, 'windturbine_tall_fan');
      port = new THREE.Vector3(0, 0.4, 1.0); break;
    }
    case 'wind': {
      const t = fit(models, 'windturbine_low', 1.7, 1.7, 3.2); g.add(t);
      fan = named(t, 'windturbine_low_fan');
      port = new THREE.Vector3(0, 0.4, 1.0); break;
    }
    case 'splitter': { const s = splitterModel(); g.add(s.group); glow.push(s.led); port = new THREE.Vector3(0, 0.6, 0); break; }
    case 'lamp': {
      const l = fit(models, 'streetlight', 0.9, 0.3, 3.4, Math.PI / 2); g.add(l);
      const bulb = mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: PAL.lamp, emissiveIntensity: 0 }), 0, 3.15, 0.55, false);
      g.add(bulb); glow.push(bulb);
      light = new THREE.PointLight(0xffb060, 0, 12, 1.6); light.position.set(0, 3.0, 0.6); g.add(light);
      port = new THREE.Vector3(0, 0.35, 0.5); break;
    }
    case 'solar': {
      g.add(fit(models, 'solarpanel', 1.9, 1.9, 1.0));
      port = new THREE.Vector3(0, 0.3, 1.0); break;
    }
    case 'battery': {
      g.add(fit(models, 'containers_A', 1.9, 0.95, 0.9));
      const l = led(PAL.flow, 0.04); l.position.set(0.8, 0.95, 0.35); g.add(l); glow.push(l);
      port = new THREE.Vector3(0, 0.3, 0.5); break;
    }
    case 'charger': { const c = cradleModel(models); g.add(c.group); glow.push(...c.rails); port = new THREE.Vector3(0, 0.3, 1.0); break; }
    case 'recycler': {
      const r = fit(models, 'drill_structure', 1.9, 1.9, 2.4); g.add(r);
      drill = named(r, 'drill_module');
      const l = led(PAL.warn, 0.06); l.position.set(0, 2.5, 0); g.add(l); glow.push(l);
      port = new THREE.Vector3(0, 0.3, 1.0); break;
    }
    case 'mast': { const m = mastModel(); m.group.scale.setScalar(0.95); g.add(m.group); glow.push(m.light); dish = m.dish; port = new THREE.Vector3(0, 0.6, 1.0); break; }
  }
  return { group: g, fan, drill, glow, light, dish, port };
}

/** Scrap: stock models where they exist, laid down as wrecks and junk. */
export function scrapModel(kind: ScrapKind, w: number, h: number, models: Models, seed: number): THREE.Object3D {
  const r = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const g = new THREE.Group();
  switch (kind) {
    case 'pile': g.add(fit(models, r(1) < 0.5 ? 'Parts_Pile_Medium' : 'Parts_Pile_Small', w * 1.05, h * 1.05, undefined, r(2) * 6)); break;
    case 'crate': g.add(fit(models, r(1) < 0.5 ? 'cargo_A' : 'Prop_Crate3', 0.95, 0.95, undefined, Math.round(r(2) * 4) * Math.PI / 2 + (r(3) - 0.5) * 0.3)); break;
    case 'bearingbox': g.add(fit(models, 'Prop_Crate4', 0.9, 0.9, undefined, r(2) * 6)); break;
    case 'barrel': g.add(fit(models, r(1) < 0.5 ? 'Fuel_A_Barrel_Dirty' : 'Fuel_B_Barrel_Dirty', 0.85, 0.85, undefined, r(2) * 6)); break;
    case 'dumpster': g.add(fit(models, 'dumpster', w, h, undefined, 0)); break;
    case 'car': {
      const names = ['car_sedan', 'car_hatchback', 'car_stationwagon'];
      const turned = w > h;
      const c = fit(models, names[Math.floor(r(1) * 3)], turned ? h : w, turned ? w : h, undefined, turned ? Math.PI / 2 : 0);
      // a wreck: sunk into the ash, leaning on a flat tyre
      c.rotation.z = (r(2) - 0.5) * 0.12; c.position.y = -0.08;
      g.add(c);
      break;
    }
    case 'solarwreck': {
      const p = fit(models, 'solarpanel', w * 0.95, h * 0.95, 0.8, r(1) * 0.5);
      p.rotation.z = 0.35; p.position.y = 0.1; g.add(p);
      { const sh = shards(); sh.position.set(0.5, 0, 0.6); sh.scale.setScalar(0.8); g.add(sh); }
      break;
    }
    case 'streetlight': {
      const l = fit(models, 'streetlight', 0.9, 0.3, 3.0);
      const lie = new THREE.Group(); lie.add(l); lie.rotation.z = -Math.PI / 2 + 0.05; lie.position.set(-1.4, 0.18, 0);
      g.add(lie); break;
    }
    case 'server': { const s = fit(models, 'Prop_Computer', 0.9, 0.9, 1.6); s.rotation.x = -0.25; g.add(s); break; }
    case 'radiobox': g.add(fit(models, 'Prop_AccessPoint', 0.9, 0.9, 1.3)); break;
    case 'iceyacht': g.add(iceYachtWreck(w, h)); break;
    case 'balloon': g.add(fallenBalloon(w, h, seed)); break;
    case 'buried': {
      // a low ridge in the ash with a glint of copper sheath where it breaks the surface
      const ridge = mesh(new THREE.CapsuleGeometry(0.22, h - 0.6, 4, 10).rotateX(Math.PI / 2).scale(1, 0.35, 1), mat(0x8f8b82, { r: 1 }), 0, 0, 0);
      g.add(ridge);
      for (let i = 0; i < 3; i++) { const c = cyl(0.05, 0.05, 0.5, M.copper(), 8); c.rotation.set(Math.PI / 2, 0, 0.3 * (i - 1)); c.position.set((i - 1) * 0.08, 0.06, -h / 2 + 0.7 + i * 1.1); g.add(c); }
      break;
    }
  }
  return g;
}

/** Wolt's module parts on his body, so upgrades show: lamp hood, aerial, dome, cell rack, AI fin, arm brace. */
export function moduleOnWolt(id: ItemId): THREE.Object3D {
  const g = new THREE.Group();
  switch (id) {
    case 'm_lamp': { const h = cyl(0.06, 0.05, 0.08, M.dark(), 12); h.rotation.x = Math.PI / 2; h.position.set(0.12, 0.08, 0.37); g.add(h); const lens = mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 1.5 }), 0.12, 0.08, 0.412, false); g.add(lens); break; }
    case 'm_radio': { const w = cyl(0.006, 0.009, 0.55, M.dark(), 5); w.position.set(-0.12, 0.45, -0.2); g.add(w); g.add(put(led(PAL.warn, 0.012), -0.12, 0.73, -0.2)); break; }
    case 'm_remote': { const d = mesh(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, 1.3), M.pale(), 0.0, 0.2, -0.16); g.add(d); break; }
    case 'm_cells': for (let i = 0; i < 3; i++) g.add(put(cyl(0.025, 0.025, 0.16, mat(0x4a5f4a, { r: 0.5 }), 8), 0.2, -0.02, -0.08 + i * 0.07)); break;
    case 'm_ai': { g.add(rbox(0.04, 0.09, 0.22, 0.015, M.dark(), -0.02, 0.22, -0.02)); g.add(mesh(new THREE.BoxGeometry(0.045, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xcfe4ea, emissive: 0xcfe4ea, emissiveIntensity: 1.4 }), -0.02, 0.27, -0.02, false)); break; }
    case 'm_arm': g.add(rbox(0.1, 0.05, 0.12, 0.015, M.steel(), 0.1, 0.205, 0.12)); break;
    default: break;
  }
  return g;
}
