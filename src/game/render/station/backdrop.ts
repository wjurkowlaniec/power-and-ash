import * as THREE from 'three';
import { box } from '../../../render/models';
import { Models, fit } from '../../../render/assets';
import { ST_W, P } from '../../sim/station';
import { canvasTex, groundRibbon, groundY, rng } from './kit';
import { hazed, beyond } from './atmosphere';
import { FENCE_Z } from './yard';

const VIEW_DROP = 16 / 17;   // how far north (m) the camera's slant shifts the top of something 1 m tall

/** The road out: from the gate over the first rise, towards R-2. */
const ROAD: [number, number][] = [[P.gate.x, FENCE_Z + 0.2], [25.5, 31], [26.6, 35], [28.6, 39.5], [31.5, 45]];
const roadX = (z: number) => { for (let i = 0; i < ROAD.length - 1; i++) if (z <= ROAD[i + 1][1]) { const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1]; return ax + (bx - ax) * (z - az) / (bz - az); } return ROAD[ROAD.length - 1][0]; };

/**
 * Everything beyond the fence: spruce woods and dead trees as silhouettes that melt into
 * the fog with distance (the further, the paler), the road towards R-2, two pylons of the
 * dead grid, the station's name on a concrete marker by the gate. Nothing here collides.
 */
export function buildBackdrop(scene: THREE.Scene, models: Models) {
  const r = rng(404);
  const mats = new Map<number, THREE.MeshStandardMaterial>();
  /** Flat silhouette colour for something `far` metres out; a handful of shades, shared. */
  const sil = (base: number, far: number) => {
    const step = Math.min(8, Math.round(far / 2));
    const key = base * 16 + step;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hazed(base, step * 2), roughness: 1, fog: false }));
    return mats.get(key)!;
  };
  const tree = (x: number, z: number, h: number) => {
    const far = beyond(x, z), kind = r();
    const name = kind < 0.16 ? `DeadTree_${1 + Math.floor(r() * 5)}` : kind < 0.5 ? 'tree_pine_orange_large' : kind < 0.85 ? 'tree_pine_yellow_medium' : 'tree_pine_yellow_small';
    const dead = name.startsWith('Dead');
    const w = dead ? h * 0.7 : h * (0.3 + r() * 0.08);
    const o = fit(models, name, w, w, h, r() * 6.28);
    const m = sil(dead ? 0x34373a : 0x3c4441, far);
    o.traverse(c => { const me = c as THREE.Mesh; if (me.isMesh) { me.material = m; me.castShadow = dead && far < 4; me.receiveShadow = false; } });
    o.position.set(x, groundY(x, z) - 0.05, z);
    scene.add(o);
  };
  // woods on three sides: thick behind the station and to the east and west
  for (let k = 0; k < 150; k++) {
    const side = k % 3;
    let x: number, z: number;
    if (side === 0) { x = -9 + r() * (ST_W + 18); z = -10.5 + r() * 9.5; }             // north, behind the roof line
    else if (side === 1) { x = -10.4 + r() * 7; z = -6 + r() * 38; }                  // west
    else { x = ST_W + 3.4 + r() * 7; z = -6 + r() * 38; }                           // east
    tree(x, z, 4.5 + r() * 4.5 + (side === 0 ? 1.5 : 0));
  }
  // south, down the valley: only as tall as leaves the gate and the fence in clear view
  for (let k = 0; k < 46; k++) {
    const x = -8 + r() * (ST_W + 16), z = FENCE_Z + 2 + r() * 15;
    if (Math.abs(x - roadX(z)) < 3.2) continue;
    const max = (z - FENCE_Z - 0.8) / VIEW_DROP;
    if (max < 1.2) continue;
    tree(x, z, Math.min(max, 2 + r() * 4.5));
  }
  // low scrub right outside the fence
  for (let k = 0; k < 26; k++) {
    const x = -4 + r() * (ST_W + 8), z = FENCE_Z + 0.7 + r() * 2.2;
    if (Math.abs(x - roadX(z)) < 2) continue;
    const s = 0.7 + r() * 0.7, o = fit(models, r() < 0.5 ? 'Bush_Common' : 'Grass_Wispy_Tall', s, s);
    const m = sil(0x4a4c47, beyond(x, z) + 1);
    o.traverse(c => { const me = c as THREE.Mesh; if (me.isMesh) { me.material = m; me.castShadow = false; } });
    o.position.set(x, groundY(x, z) - 0.03, z); o.rotation.y = r() * 6; scene.add(o);
  }

  // the road: packed earth and two ruts, fading out over the rise
  scene.add(groundRibbon(ROAD, 3.0, 0x86827a, 0.45));
  for (const off of [-0.62, 0.62]) scene.add(groundRibbon(ROAD.map(([x, z]) => [x + off, z] as [number, number]), 0.45, 0x6a665e, 0.45, 0.022));

  // the station's marker by the gate: its sign and its name (signs in the world stay Polish)
  const tex = canvasTex(128, 256, c => {
    c.fillStyle = '#6f6d67'; c.fillRect(0, 0, 128, 256);
    c.strokeStyle = c.fillStyle = '#d6d1c4'; c.lineWidth = 5;
    for (const rad of [12, 24, 36]) { c.beginPath(); c.arc(64, 60, rad, 0, 7); c.stroke(); }
    c.save(); c.translate(64, 232); c.rotate(-Math.PI / 2); c.font = '600 30px monospace'; c.textBaseline = 'middle';
    c.fillText('OLSZANKA', 0, 0); c.restore();
  });
  const mx = P.gate.x - 2.9, mz = FENCE_Z + 0.9;
  const conc = new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: 1 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.28), [conc, conc, conc, conc, face, conc]);
  marker.position.set(mx, groundY(mx, mz) + 0.66, mz); marker.rotation.set(0.03, 0.12, -0.04); marker.castShadow = true; marker.receiveShadow = true;
  scene.add(marker);
  const bench = fit(models, 'bench', 1.7, 0.7); bench.position.set(P.gate.x + 3.4, groundY(P.gate.x + 3.4, FENCE_Z + 1.1) - 0.04, FENCE_Z + 1.1); bench.rotation.y = -0.08; scene.add(bench);

  // two pylons of the old grid march off north-east; their wires hang slack into the fog
  const pyl: THREE.Vector3[] = [];
  for (const [x, z, h] of [[41.5, 0.5, 11], [46.5, -8, 12]] as const) {
    const m = sil(0x34373a, beyond(x, z) + 2), y0 = groundY(x, z) - 0.2;
    for (const sx of [-1, 1]) {
      const leg = box(0.12, h, 0.12, m, x + sx * 0.5, y0 + h / 2, z); leg.rotation.z = sx * 0.09; scene.add(leg);
    }
    for (let y = 1.5; y < h - 1; y += 1.6) scene.add(box(1.0 - y / h * 0.9 + 0.1, 0.06, 0.06, m, x, y0 + y, z));
    scene.add(box(3.4, 0.09, 0.09, m, x, y0 + h - 0.6, z)); scene.add(box(2.2, 0.08, 0.08, m, x, y0 + h - 2, z));
    pyl.push(new THREE.Vector3(x, y0 + h - 0.75, z));
  }
  const wire = new THREE.LineBasicMaterial({ color: hazed(0x34373a, 5), fog: false });
  const span = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * sag; pts.push(p); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
  };
  for (const off of [-1.5, 1.5]) {
    const o = new THREE.Vector3(off, 0, 0);
    span(pyl[0].clone().add(o), pyl[1].clone().add(o), 1.6);
    span(pyl[1].clone().add(o), new THREE.Vector3(55 + off, pyl[1].y - 1, -20), 2.2);
  }
  // one wire still runs down to the machine room's roof
  span(pyl[0].clone(), new THREE.Vector3(36.6, 3.6, 4.4), 1.1);
}
