import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, mesh } from '../../render/models';
import { PAL } from '../../render/palette';

/**
 * The land yacht (Żaglowóz) in the crafting demo, modelled in code because no stock
 * pack has one: what Wolt builds onto the service cart (a pipe mast with shrouds and a
 * pennant, the boom, runners on a cross plank) and what it is built from (an old ice
 * yacht wreck, a fallen weather balloon), plus their inventory icons. The look follows
 * the concept "Bojerek z żaglem z balonu meteo" (docs/img/koncepty/bojerek.jpg): dark
 * timber, steel pipe, a faded orange balloon-skin sail.
 */

const M = {
  steel: () => mat(0x5d6367, { r: 0.45, m: 0.6 }),
  dark: () => mat(0x1e2022, { r: 0.7, m: 0.3 }),
  wood: () => mat(0x4f463c, { r: 0.95 }),
  woodOld: () => mat(0x5f574d, { r: 1 }),
  rust: () => mat(PAL.rust, { r: 0.85, m: 0.3 }),
  blade: () => mat(0x7d8286, { r: 0.3, m: 0.85 }),
  skin: () => mat(0xa8663a, { r: 0.85 }),
  skinPale: () => mat(0xb98a62, { r: 0.9 }),
  cord: () => mat(0xc8c0b0, { r: 0.9 }),
  pale: () => mat(0xbdb7aa, { r: 0.8 }),
};
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m, x, y, z);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

/** A thin rod (shroud, strut, cord) from a to b. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 5): THREE.Mesh {
  const d = b.clone().sub(a), l = d.length();
  const o = mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

/** One runner blade, length along +z, the tip curling up at the front. Sits on y = 0. */
export function runnerBlade(L = 1.3, m: THREE.Material = M.blade()): THREE.Mesh {
  const sh = new THREE.Shape();
  const h = 0.045;
  sh.moveTo(-L / 2, 0.012);
  sh.lineTo(-L / 2 + 0.03, 0);
  sh.lineTo(L / 2 - 0.2, 0);
  sh.quadraticCurveTo(L / 2 - 0.02, 0, L / 2 + 0.03, 0.17);
  sh.lineTo(L / 2 - 0.01, 0.185);
  sh.quadraticCurveTo(L / 2 - 0.06, h, L / 2 - 0.22, h);
  sh.lineTo(-L / 2, h);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 10 });
  geo.translate(0, 0, -0.02);
  geo.rotateY(-Math.PI / 2); // +x (the tip) to +z (forward)
  return mesh(geo, m);
}

/** A runner on its post: blade, a shoe clamp and a strut up to `top`. */
function runnerOnPost(top: number, L = 1.3): THREE.Group {
  const g = new THREE.Group();
  g.add(runnerBlade(L));
  g.add(rbox(0.09, 0.06, 0.26, 0.015, M.steel(), 0, 0.07, -0.05));
  g.add(rbox(0.055, top - 0.08, 0.055, 0.01, M.steel(), 0, 0.08 + (top - 0.08) / 2, -0.05));
  // a diagonal brace forward
  g.add(rod(new THREE.Vector3(0, 0.1, 0.18), new THREE.Vector3(0, top - 0.02, -0.05), 0.012, M.steel()));
  return g;
}

/**
 * Runners for the cart, in its local frame (+z forward, origin under the middle):
 * a timber cross plank at the back with a runner at each end, a steering runner forward.
 * `deckY` is how high the cart's bed sits once lifted onto them.
 */
export function runnerRig(): { group: THREE.Group; ends: THREE.Vector3[]; lift: number } {
  const g = new THREE.Group();
  const plankY = 0.32, back = -0.5, span = 1.2;
  g.add(rbox(span * 2 + 0.25, 0.08, 0.17, 0.025, M.wood(), 0, plankY, back));
  // bolts and a steel strap where the plank takes the cart
  for (const x of [-0.45, 0.45]) g.add(rbox(0.12, 0.1, 0.2, 0.015, M.steel(), x, plankY + 0.01, back));
  for (const s of [-1, 1]) { const r = runnerOnPost(plankY - 0.03); r.position.set(s * span, 0, back); g.add(r); }
  // the steering runner: a short beam forward under the drawbar
  g.add(rbox(0.09, 0.07, 0.7, 0.02, M.wood(), 0, plankY - 0.02, 0.95));
  const f = runnerOnPost(plankY - 0.06, 1.0); f.position.set(0, 0, 1.2); g.add(f);
  return { group: g, ends: [new THREE.Vector3(-span, plankY + 0.04, back), new THREE.Vector3(span, plankY + 0.04, back), new THREE.Vector3(0, plankY, 1.25)], lift: 0.14 };
}

/** The mast on the cart: a steel pipe on a step plate, collars, a cap, a pennant that shows the wind. */
export function mastRig(height: number): { group: THREE.Group; pennant: THREE.Group; head: THREE.Vector3 } {
  const g = new THREE.Group();
  g.add(rbox(0.28, 0.05, 0.28, 0.015, M.steel(), 0, 0.025, 0));
  for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]) g.add(put(cyl(0.015, 0.015, 0.03, M.dark(), 6), x, 0.06, z));
  const pipe = cyl(0.038, 0.048, height, M.steel(), 14); pipe.position.y = height / 2; g.add(pipe);
  for (const y of [0.2, height * 0.5, height - 0.15]) g.add(put(cyl(0.058, 0.058, 0.05, M.dark(), 14), 0, y, 0));
  g.add(put(cyl(0.05, 0.04, 0.06, M.dark(), 10), 0, height + 0.03, 0));
  // the pennant: a strip of balloon skin on a swivel; it streams downwind
  const pennant = new THREE.Group(); pennant.position.y = height + 0.06; g.add(pennant);
  const sh = new THREE.Shape(); sh.moveTo(0, 0.05); sh.lineTo(0.42, 0.0); sh.lineTo(0.0, -0.05); sh.closePath();
  const flag = mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xc0703a, roughness: 0.9, side: THREE.DoubleSide }));
  flag.position.y = 0.06;
  pennant.add(flag);
  pennant.add(put(cyl(0.008, 0.008, 0.14, M.dark(), 5), 0, 0.05, 0));
  return { group: g, pennant, head: new THREE.Vector3(0, height - 0.1, 0) };
}

/** The balloon-skin sail: faded orange gores, seams, a stencil, a patch. Canvas, no image files. */
export function balloonSailTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 41;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#b0683a'; g.fillRect(0, 0, S, S);
  // gores: the balloon's panels, slightly different in fade
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(${200 + r() * 40},${150 + r() * 40},${110 + r() * 30},${0.08 + r() * 0.12})`;
    g.beginPath(); g.moveTo(i * S / 9, S); g.lineTo((i + 1) * S / 9, S); g.lineTo((i + 0.9) * S / 9 - 30, 0); g.lineTo(i * S / 9 - 30, 0); g.fill();
    g.strokeStyle = '#00000030'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(i * S / 9, S); g.lineTo(i * S / 9 - 30, 0); g.stroke();
  }
  // sewn hems along the luff and the foot (u = 0 is the mast, v = 0 the boom)
  g.strokeStyle = '#2a1a1080'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(4, S); g.lineTo(4, 0); g.stroke();
  g.beginPath(); g.moveTo(0, S - 4); g.lineTo(S, S - 4); g.stroke();
  g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeStyle = '#e8d8c060';
  g.beginPath(); g.moveTo(14, S); g.lineTo(14, 0); g.stroke();
  g.beginPath(); g.moveTo(0, S - 14); g.lineTo(S, S - 14); g.stroke();
  g.setLineDash([]);
  // ash stains, streaks from the rain
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, rr = 6 + r() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(40,32,26,${0.08 + r() * 0.14})`); gr.addColorStop(1, 'rgba(40,32,26,0)');
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(60,48,40,${0.05 + r() * 0.08})`; g.fillRect(r() * S, r() * S * 0.6, 2 + r() * 3, 40 + r() * 120); }
  // a stencil from the weather service, mirrored like the main sail (the camera sees the back face)
  g.save(); g.translate(S * 0.36, S * 0.72); g.scale(-1, 1); g.rotate(-0.04);
  g.fillStyle = '#20140c99'; g.font = 'bold 34px monospace'; g.fillText('METEO', -60, 0);
  g.font = '20px monospace'; g.fillText('SONDA R-2', -60, 28);
  g.restore();
  // a square patch with stitches
  g.fillStyle = '#c69a6c'; g.fillRect(S * 0.12, S * 0.32, 70, 58);
  g.strokeStyle = '#3a2416a0'; g.lineWidth = 2; g.setLineDash([4, 5]); g.strokeRect(S * 0.12 + 4, S * 0.32 + 4, 62, 50); g.setLineDash([]);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- what it is built from

/** An old ice yacht left on the plain: a cross plank on three runners, a snapped mast, a rag of sail. */
export function iceYachtWreck(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  const long = Math.max(w, h), across = Math.min(w, h);
  // backbone along x, cross plank along z
  inner.add(rbox(long * 0.92, 0.09, 0.2, 0.03, M.woodOld(), 0, 0.32, 0));
  inner.add(rbox(0.2, 0.09, across * 1.05, 0.03, M.woodOld(), -long * 0.22, 0.3, 0));
  for (const s of [-1, 1]) {
    const r = runnerOnPost(0.27, 1.2); r.rotation.y = Math.PI / 2; r.position.set(-long * 0.22, 0, s * across * 0.5); inner.add(r);
  }
  // the front runner has come off and lies on its side
  const loose = runnerBlade(1.0, M.rust()); loose.rotation.set(0, Math.PI / 2 + 0.4, Math.PI / 2); loose.position.set(long * 0.5, 0.05, 0.35); inner.add(loose);
  inner.add(rbox(0.12, 0.2, 0.12, 0.02, M.rust(), long * 0.4, 0.17, 0));
  // the mast snapped a metre up; the rest lies in the ash
  inner.add(put(cyl(0.045, 0.05, 1.0, M.rust(), 10), long * 0.12, 0.8, 0));
  const top = cyl(0.04, 0.045, 2.4, M.rust(), 10); top.rotation.set(0.1, 0, Math.PI / 2 - 0.12); top.position.set(-long * 0.05, 0.12, -across * 0.55); inner.add(top);
  // a rag of old sail cloth caught under the plank
  const rag = mesh(new THREE.PlaneGeometry(0.9, 0.6, 4, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c857a, roughness: 1, side: THREE.DoubleSide }));
  const p = rag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(i * 1.7) * 0.04 + 0.03);
  rag.geometry.computeVertexNormals();
  rag.position.set(long * 0.25, 0, across * 0.35); rag.rotation.y = 0.5; inner.add(rag);
  // sunk and settled
  inner.rotation.set(0.03, 0, -0.04);
  inner.position.y = -0.04;
  if (h > w) inner.rotation.y = Math.PI / 2;
  return g;
}

/** A weather balloon that came down long ago: a crumpled orange skin, its cords and the radiosonde. */
export function fallenBalloon(w: number, h: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rr = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.75 + 0.25 * Math.sin(v.x * 5 + seed) * Math.cos(v.z * 4 - seed) + 0.12 * Math.sin(v.x * 13 + v.z * 9);
    v.multiplyScalar(n);
    v.y = Math.max(-0.05, v.y) * 0.28 + Math.abs(Math.sin(v.x * 7 + v.z * 6)) * 0.06;
    p.setXYZ(i, v.x * w * 0.45, v.y, v.z * h * 0.42);
  }
  geo.computeVertexNormals();
  const skin = mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa8663a, roughness: 0.85, flatShading: true }), 0, 0.02, 0);
  g.add(skin);
  // the neck, tied off, and the cords to the sonde
  const neck = new THREE.Vector3(w * 0.42, 0.12, h * 0.1);
  g.add(put(cyl(0.05, 0.08, 0.16, M.skinPale(), 8), neck.x, neck.y, neck.z));
  const sonde = new THREE.Vector3(w * 0.75, 0.08, h * 0.38 + rr(1) * 0.2);
  for (let i = 0; i < 4; i++) {
    const mid = neck.clone().lerp(sonde, 0.5); mid.y = 0.02; mid.x += (i - 1.5) * 0.06;
    g.add(rod(neck, mid, 0.006, M.cord(), 4)); g.add(rod(mid, sonde, 0.006, M.cord(), 4));
  }
  const box = rbox(0.2, 0.14, 0.14, 0.02, M.pale(), sonde.x, sonde.y, sonde.z); box.rotation.y = rr(2) * 3; g.add(box);
  g.add(put(cyl(0.004, 0.004, 0.22, M.dark(), 4), sonde.x + 0.05, sonde.y + 0.17, sonde.z));
  return g;
}

// ---------------------------------------------------------------- inventory icons

export function sailclothIcon(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const l = rbox(0.9 - i * 0.04, 0.09, 0.55 - i * 0.02, 0.04, i % 2 ? M.skinPale() : M.skin(), (i % 2) * 0.03, 0.05 + i * 0.09, -(i % 2) * 0.02);
    l.rotation.y = (i - 1.5) * 0.05; g.add(l);
  }
  const cord = mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 24), M.cord()); cord.rotation.y = Math.PI / 2; cord.scale.set(1, 0.65, 1); cord.position.y = 0.2; g.add(cord);
  return wrapG(g);
}

export function yachtMastIcon(): THREE.Group {
  const g = new THREE.Group();
  const pipe = cyl(0.045, 0.05, 2.0, M.steel(), 12); pipe.rotation.z = Math.PI / 2; pipe.position.y = 0.06; g.add(pipe);
  const boom = cyl(0.035, 0.035, 1.2, M.steel(), 10); boom.rotation.set(0, 0.8, Math.PI / 2); boom.position.set(0.1, 0.16, 0.1); g.add(boom);
  for (const x of [-0.95, 0, 0.95]) { const c = put(cyl(0.06, 0.06, 0.05, M.dark(), 12), x, 0.06, 0); c.rotation.z = Math.PI / 2; g.add(c); }
  const step = rbox(0.26, 0.05, 0.26, 0.015, M.steel(), -1.05, 0.06, 0); step.rotation.z = Math.PI / 2; g.add(step);
  // a coil of shroud wire
  const coil = mesh(new THREE.TorusGeometry(0.18, 0.015, 6, 22), M.dark()); coil.rotation.x = Math.PI / 2; coil.position.set(0.4, 0.03, -0.28); g.add(coil);
  return wrapG(g);
}

export function sailIcon(): THREE.Group {
  const g = new THREE.Group();
  const roll = cyl(0.13, 0.13, 1.25, M.skin(), 14); roll.rotation.z = Math.PI / 2; roll.position.y = 0.2; g.add(roll);
  const boom = cyl(0.035, 0.035, 1.55, M.steel(), 10); boom.rotation.z = Math.PI / 2; boom.position.set(0, 0.04, 0.05); g.add(boom);
  for (const x of [-0.45, 0, 0.45]) { const t = mesh(new THREE.TorusGeometry(0.135, 0.015, 6, 18), M.cord()); t.rotation.y = Math.PI / 2; t.position.set(x, 0.2, 0); g.add(t); }
  return wrapG(g);
}

export function runnersIcon(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.2, 0.07, 1.3, 0.02, M.wood(), 0, 0.28, 0));
  for (const z of [-0.55, 0.55]) { const r = runnerOnPost(0.26, 1.1); r.rotation.y = Math.PI / 2; r.position.z = z; g.add(r); }
  const third = runnerBlade(0.9); third.position.set(0.5, 0, 0); third.rotation.y = Math.PI / 2 + 0.2; g.add(third);
  return wrapG(g);
}

function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T { o.position.set(x, y, z); return o; }
const wrapG = (o: THREE.Object3D) => { const g = new THREE.Group(); g.add(o); return g; };
