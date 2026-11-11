import * as THREE from 'three';
import { PAL } from '../../../render/palette';
import { ST_W, ST_H } from '../../sim/station';
import { softDisc, rng, groundY } from './kit';

/** Where the wind blows to (x, z), length 1: from the south-east, over the valley. */
export const WIND = { x: -0.8, z: -0.6 };

const ASH_N = 650;
const BOX = { w: 36, h: 9, d: 30 };   // m, the box of falling ash that follows the camera

/**
 * The air of Scene 2: low banks of mist that drift over the yard and the fields, and ash
 * that falls slowly and slides with the wind. Nothing here touches the game state.
 */
export class Atmosphere {
  readonly group = Object.assign(new THREE.Group(), { userData: { live: true } });
  private banks: { m: THREE.Mesh; v: number; a: number; ph: number; y: number }[] = [];
  private ash: THREE.Points;
  private seed: Float32Array;

  constructor() {
    const r = rng(77);
    const mistMat = () => new THREE.MeshBasicMaterial({ map: softDisc(), color: 0xd6d2c8, transparent: true, opacity: 0.2, depthWrite: false, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // rows of mist that slide along x: over the yard (never into the building) and behind the station
    const rows: [number, number, number][] = [[19, 0.5, 4], [23.5, 1.3, 3], [30, 0.9, 4], [36, 1.6, 4], [-4, 1.2, 3], [-9, 2.2, 3]];
    for (const [z, y, n] of rows) for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mistMat());
      m.scale.set(13 + r() * 10, 1, 5 + r() * 3.5);
      m.position.set(-14 + r() * (ST_W + 28), y + r() * 0.5, z + (r() - 0.5) * 2);
      m.renderOrder = 5;
      this.group.add(m);
      this.banks.push({ m, v: 0.25 + r() * 0.35, a: 0.1 + r() * 0.14, ph: r() * 6, y: m.position.y });
    }
    // ash
    const arr = new Float32Array(ASH_N * 3);
    this.seed = new Float32Array(ASH_N);
    for (let i = 0; i < ASH_N; i++) {
      arr[i * 3] = r() * BOX.w; arr[i * 3 + 1] = r() * BOX.h; arr[i * 3 + 2] = r() * BOX.d;
      this.seed[i] = r();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.ash = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xece8de, size: 3, sizeAttenuation: false, map: softDisc(), transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    this.ash.frustumCulled = false;
    this.group.add(this.ash);
  }

  update(dt: number, t: number, focus: THREE.Vector3) {
    for (const b of this.banks) {
      const p = b.m.position;
      p.x -= b.v * dt;
      if (p.x < -26) p.x += ST_W + 52;
      // thinner where it leaves the view, so banks never pop in at the edge
      const edge = Math.min(1, (p.x + 26) / 8, (ST_W + 26 - p.x) / 8);
      (b.m.material as THREE.MeshBasicMaterial).opacity = b.a * edge * (0.75 + 0.25 * Math.sin(t * 0.21 + b.ph));
      p.y = Math.max(groundY(p.x, p.z), 0) + b.y + Math.sin(t * 0.13 + b.ph) * 0.2;
    }
    // ash: each flake falls and slides with the wind; the box it wraps in travels with the camera
    const lx = focus.x - BOX.w / 2, lz = focus.z - BOX.d / 2 + 2;
    const dp = this.ash.geometry.attributes.position as THREE.BufferAttribute;
    const a = dp.array as Float32Array;
    for (let i = 0; i < ASH_N; i++) {
      const s = this.seed[i], k = i * 3;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.5 + s * 20);
      a[k] += (WIND.x * (0.5 + s * 0.6) * gust + Math.sin(t * 1.3 + s * 40) * 0.12) * dt;
      a[k + 1] -= (0.22 + s * 0.3) * dt;
      a[k + 2] += (WIND.z * (0.5 + s * 0.6) * gust + Math.cos(t * 1.1 + s * 31) * 0.12) * dt;
      a[k] = lx + (((a[k] - lx) % BOX.w) + BOX.w) % BOX.w;
      if (a[k + 1] < 0) a[k + 1] += BOX.h;
      a[k + 2] = lz + (((a[k + 2] - lz) % BOX.d) + BOX.d) % BOX.d;
    }
    dp.needsUpdate = true;
  }
}

/** Colour of something `far` metres beyond the map edge: already pale at the fence, melting into the fog further out. */
export function hazed(color: number, far: number, out = new THREE.Color()): THREE.Color {
  return out.setHex(color).lerp(new THREE.Color(PAL.fog), THREE.MathUtils.clamp(0.3 + far / 15, 0, 0.92));
}

/** Distance beyond the map rectangle (0 inside). */
export const beyond = (x: number, z: number) => Math.max(0, -x, x - ST_W, -z, z - ST_H);
