import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The yacht's body: a scavenged frame of steel I-beams, scaffold tubes and X-braces
 * with a deck of weathered euro pallets lashed on top. Everything is merged into a
 * few meshes (one per material) to keep draw calls low.
 */

let seed = 4242;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

class Builder {
  parts: THREE.BufferGeometry[] = [];
  private c = new THREE.Color();
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, rot?: THREE.Euler) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rot));
    g.translate(x, y, z);
    this.paint(g, color);
    this.parts.push(g);
  }
  tube(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number) {
    const d = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 6, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.paint(g, color);
    this.parts.push(g);
  }
  private paint(g: THREE.BufferGeometry, color: number) {
    // slight per-part variation so merged boards don't look stamped
    this.c.set(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.05);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = this.c.r; arr[i * 3 + 1] = this.c.g; arr[i * 3 + 2] = this.c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  mesh(m: THREE.Material): THREE.Mesh {
    const geo = mergeGeometries(this.parts.map(p => p.index ? p.toNonIndexed() : p), false)!;
    geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }
}

const WOOD = [0x8c8374, 0x7d7466, 0x958c7d, 0x6e665b, 0x857a68, 0x9a9384];
const PAINTED = [0x5f6e78, 0x7b5d50]; // a faded blue and a faded red pallet here and there

/** One euro pallet, 1.2 × 0.8 m, 0.144 m tall, origin at the bottom centre. */
function pallet(b: Builder, x: number, y: number, z: number, yaw: number, color: number, wear: number) {
  const e = new THREE.Euler(0, yaw, 0);
  const put = (w: number, h: number, d: number, lx: number, ly: number, lz: number, col = color) => {
    const v = new THREE.Vector3(lx, ly, lz).applyEuler(e);
    b.box(w, h, d, x + v.x, y + v.y, z + v.z, col, e);
  };
  const dark = new THREE.Color(color).multiplyScalar(0.78).getHex();
  // 3 bottom boards, 9 blocks, 3 stringer boards, 5 top boards
  for (const lz of [-0.33, 0, 0.33]) put(1.2, 0.022, 0.1, 0, 0.011, lz, dark);
  for (const lx of [-0.53, 0, 0.53]) for (const lz of [-0.33, 0, 0.33]) put(0.145, 0.078, lz === 0 ? 0.145 : 0.1, lx, 0.061, lz, dark);
  for (const lx of [-0.53, 0, 0.53]) put(0.145, 0.022, 0.8, lx, 0.111, 0);
  const tops = [-0.3275, -0.1675, 0, 0.1675, 0.3275];
  tops.forEach((lz, i) => {
    if (i > 0 && i < 4 && rnd() < wear) return; // a missing board
    const w = i % 2 ? 0.1 : 0.145;
    const sag = (rnd() - 0.5) * 0.008;
    put(1.2 - (rnd() < wear ? 0.25 : 0), 0.022, w, (rnd() - 0.5) * 0.02, 0.133 + sag, lz);
  });
}

export interface Deck { group: THREE.Group; top: number }

export function yachtDeck(W: number, D: number): Deck {
  const group = new THREE.Group();
  const steel = new Builder(), wood = new Builder(), rust = new Builder();
  const RUST = 0x6a4a3a, STEEL = 0x4f5458, DARK = 0x3a3e41;

  // --- chassis: two long I-beams over the axles, cross beams every ~1.5 m
  const beamY = 0.9, railZ = D / 2 - 0.75;
  for (const s of [-1, 1]) {
    const z = s * railZ;
    steel.box(W - 0.2, 0.05, 0.22, 0, beamY + 0.2, z, STEEL);   // top flange
    steel.box(W - 0.2, 0.05, 0.22, 0, beamY - 0.2, z, STEEL);   // bottom flange
    steel.box(W - 0.2, 0.36, 0.04, 0, beamY, z, DARK);          // web
  }
  for (let x = -W / 2 + 0.4; x <= W / 2 - 0.3; x += 1.45)
    steel.box(0.16, 0.18, 2 * railZ + 0.2, x, beamY + 0.12, 0, DARK);

  // --- scaffold posts from the beams up to the deck frame, with X-braces on the long sides
  const frameY = 1.38;
  const postsX: number[] = [];
  for (let x = -W / 2 + 0.25; x <= W / 2 - 0.2; x += (W - 0.5) / 6) postsX.push(x);
  for (const s of [-1, 1]) {
    const z = s * (D / 2 - 0.2);
    for (const x of postsX) steel.tube(new THREE.Vector3(x, beamY - 0.25, z), new THREE.Vector3(x, frameY, z), 0.045, STEEL);
    // outriggers from the I-beam to the outer posts
    for (const x of postsX) steel.box(0.08, 0.08, D / 2 - 0.2 - railZ, x, beamY + 0.15, s * (railZ + (D / 2 - 0.2 - railZ) / 2), DARK);
    for (let i = 0; i < postsX.length - 1; i++) {
      const a = postsX[i], b2 = postsX[i + 1];
      if (i % 2 === 0) steel.tube(new THREE.Vector3(a, beamY - 0.2, z), new THREE.Vector3(b2, frameY - 0.05, z), 0.03, STEEL);
      else steel.tube(new THREE.Vector3(a, frameY - 0.05, z), new THREE.Vector3(b2, beamY - 0.2, z), 0.03, STEEL);
    }
    steel.tube(new THREE.Vector3(-W / 2 + 0.2, frameY, z), new THREE.Vector3(W / 2 - 0.2, frameY, z), 0.05, STEEL); // top rail tube
    steel.tube(new THREE.Vector3(-W / 2 + 0.2, beamY - 0.25, z), new THREE.Vector3(W / 2 - 0.2, beamY - 0.25, z), 0.04, STEEL);
  }
  // deck joists across the width
  for (const x of postsX) steel.box(0.1, 0.1, D - 0.3, x, frameY, 0, DARK);
  for (const z of [-D / 4, D / 4]) steel.box(W - 0.4, 0.08, 0.08, 0, frameY, z, DARK);
  // ends: a bent bow plate and a stern bumper
  rust.box(0.06, 0.6, D - 0.6, W / 2 - 0.05, beamY + 0.05, 0, RUST, new THREE.Euler(0, 0, 0.35));
  rust.box(0.2, 0.25, D - 0.4, -W / 2 + 0.1, beamY, 0, RUST);
  // a few rusty sheets wired to the frame as a half skirt
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1;
    const x = -W / 2 + 1.2 + i * 2.6 + rnd() * 0.6;
    rust.box(1.1 + rnd() * 0.7, 0.5, 0.03, x, beamY + 0.05, s * (D / 2 - 0.16), [RUST, 0x5b4c42, 0x6f5a49][i % 3], new THREE.Euler(0, 0, (rnd() - 0.5) * 0.12));
  }

  // --- the pallet deck: 1.2 × 0.8 m pallets on the joists, a bit uneven
  const top = frameY + 0.05;
  const nx = Math.floor((W - 0.1) / 1.2), nz = Math.floor((D - 0.2) / 0.8);
  const x0 = -nx * 1.2 / 2 + 0.6, z0 = -nz * 0.8 / 2 + 0.4;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const col = rnd() < 0.08 ? PAINTED[Math.floor(rnd() * PAINTED.length)] : WOOD[Math.floor(rnd() * WOOD.length)];
      pallet(wood, x0 + i * 1.2 + (rnd() - 0.5) * 0.04, top + (rnd() - 0.5) * 0.02, z0 + j * 0.8 + (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.03, col, 0.12);
    }
  // spare pallets stacked at the bow and leaning on the rail
  for (let k = 0; k < 3; k++) pallet(wood, W / 2 - 1.0, top + 0.145 * (k + 1), -D / 2 + 0.75, 0.04 * k, WOOD[k], 0.05);
  // ratchet straps holding the deck (darker bands)
  for (const x of [-W / 4, W / 6]) rust.box(0.05, 0.02, D - 0.2, x, top + 0.16, 0, 0x4a4036);

  // --- a pipe railing on posts along both long edges
  for (const s of [-1, 1]) {
    const z = s * (D / 2 - 0.12);
    const ys = top + 0.16;
    for (const x of postsX) steel.tube(new THREE.Vector3(x, ys, z), new THREE.Vector3(x, ys + 0.75, z), 0.03, STEEL);
    steel.tube(new THREE.Vector3(postsX[0], ys + 0.75, z), new THREE.Vector3(postsX[postsX.length - 1], ys + 0.75, z), 0.025, STEEL);
  }

  const vc = (r: number, m: number) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: m });
  group.add(steel.mesh(vc(0.65, 0.45)));
  group.add(wood.mesh(vc(0.95, 0)));
  group.add(rust.mesh(vc(0.85, 0.25)));
  return { group, top: top + 0.155 };
}
