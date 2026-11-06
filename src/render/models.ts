import * as THREE from 'three';
import { PAL } from './palette';
import { Obstacle } from '../sim/world';

let seed = 11;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const cache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, o: { r?: number; m?: number; e?: number; ei?: number; flat?: boolean } = {}) {
  const key = JSON.stringify([color, o]);
  if (!cache.has(key))
    cache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.9, metalness: o.m ?? 0.05, flatShading: o.flat ?? false,
      emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1,
    }));
  return cache.get(key)!;
}

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = cast; o.receiveShadow = true;
  return o;
}
export const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);

/** Low, lumpy rock that still fills its rectangular footprint (the cable wraps on the rectangle). */
function rockGeo(w: number, h: number, d: number) {
  const g = new THREE.DodecahedronGeometry(0.5, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + (Math.sin(v.x * 9.1 + v.z * 5.3) + Math.sin(v.y * 7.7 - v.x * 3.1)) * 0.06;
    p.setXYZ(i, v.x * w * 1.12 * n, Math.max(-0.1, v.y) * h * 2 * n, v.z * d * 1.12 * n);
  }
  g.computeVertexNormals();
  return g;
}

export function obstacleMesh(o: Obstacle): THREE.Object3D {
  const g = new THREE.Group();
  const cx = o.x + o.w / 2, cz = o.y + o.h / 2;
  g.position.set(cx, 0, cz);
  switch (o.kind) {
    case 'rock': {
      const h = 0.6 + rnd() * 0.9;
      const r = mesh(rockGeo(o.w, h, o.h), mat(PAL.silhouette2, { flat: true }), 0, 0, 0);
      r.rotation.y = (rnd() - 0.5) * 0.2;
      g.add(r);
      break;
    }
    case 'container': {
      const h = 2.4;
      g.add(box(o.w - 0.04, h, o.h - 0.04, mat(PAL.rust, { r: 0.8, m: 0.3 }), 0, h / 2, 0));
      for (let z = -o.h / 2 + 0.3; z < o.h / 2; z += 0.45)
        g.add(box(o.w + 0.02, h - 0.2, 0.06, mat(0x3f342e, { r: 0.8, m: 0.3 }), 0, h / 2, z));
      g.rotation.z = (rnd() - 0.5) * 0.02;
      break;
    }
    case 'scrap': {
      for (let i = 0; i < 5 + o.w * o.h * 2; i++) {
        const s = 0.25 + rnd() * 0.5;
        const b = box(s * (0.8 + rnd()), s * (0.4 + rnd() * 0.6), s * (0.8 + rnd()),
          mat([PAL.silhouette, PAL.rust, PAL.steel][i % 3], { m: 0.3 }),
          (rnd() - 0.5) * (o.w - s), s * 0.3, (rnd() - 0.5) * (o.h - s));
        b.rotation.set(rnd() * 0.6, rnd() * 3, rnd() * 0.6);
        g.add(b);
      }
      break;
    }
    case 'crate':
      g.add(box(0.9, 0.9, 0.9, mat(0x5a4a3a), 0, 0.45, 0));
      g.rotation.y = (rnd() - 0.5) * 0.3;
      break;
    case 'barrel': {
      const b = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 12), mat(0x4a3a33, { m: 0.3 }), 0, 0.5, 0);
      g.add(b);
      break;
    }
    case 'pylon': {
      const h = 4 + rnd() * 4;
      const m = mat(PAL.silhouette, { m: 0.4 });
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.14, h, 0.14, m, dx * 0.8, h / 2, dz * 0.8));
      for (let y = 1; y < h; y += 1.5) {
        g.add(box(1.7, 0.08, 0.08, m, 0, y, -0.8)); g.add(box(1.7, 0.08, 0.08, m, 0, y, 0.8));
        g.add(box(0.08, 0.08, 1.7, m, -0.8, y, 0)); g.add(box(0.08, 0.08, 1.7, m, 0.8, y, 0));
      }
      g.rotation.z = (rnd() - 0.5) * 0.5;
      break;
    }
    default: break; // yacht and station are built separately
  }
  return g;
}

export interface YachtModel { group: THREE.Group; turbines: THREE.Object3D[]; port: THREE.Mesh }

export function yachtModel(r: { x: number; y: number; w: number; h: number }, portLocal: THREE.Vector3): YachtModel {
  const g = new THREE.Group();
  g.position.set(r.x + r.w / 2, 0, r.y + r.h / 2);
  const hull = mat(0x4a5055, { r: 0.6, m: 0.4 }), deck = mat(0x7d786e), paint = mat(0x8a4a2c, { r: 0.7 });
  g.add(box(r.w - 0.1, 0.9, r.h - 0.3, hull, 0, 1.1, 0));
  g.add(box(r.w, 0.2, r.h - 0.1, paint, 0, 0.7, 0));
  g.add(box(r.w - 0.5, 0.08, r.h - 0.7, deck, 0, 1.6, 0));
  const dark = mat(0x222426, { r: 0.7 });
  for (const [x, z] of [[-4, -r.h / 2], [3.6, -r.h / 2], [-4, r.h / 2], [3.6, r.h / 2]]) {
    const w = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 18), dark, x, 0.85, z);
    w.rotation.x = Math.PI / 2; g.add(w);
  }
  const pale = mat(PAL.pale), steel = mat(PAL.steel, { m: 0.5, r: 0.6 });
  g.add(box(2, 1.5, 2, pale, -4.2, 2.4, -1.3));
  g.add(box(1, 1.2, 1.8, mat(0x3c6f86, { r: 0.5, e: 0x2b5c72, ei: 0.25 }), -2.5, 2.2, -1.3));
  g.add(box(2.8, 1, 1.8, mat(0xbab4a8), -3.8, 2.1, 1.4));
  for (let i = 0; i < 3; i++) g.add(box(0.85, 0.85, 0.85, mat(0x5a4a3a), -1.2 + i * 0.95, 2.05, 2.0));
  // mast + sail
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 10, 8), steel, 1.2, 6.6, 0));
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 8.4); s.lineTo(5, 0.2); s.lineTo(0, 0);
  const sail = mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: 0xd9d4c7, side: THREE.DoubleSide, roughness: 1 }), 1.25, 2.1, 0);
  sail.rotation.y = -0.5; g.add(sail);
  // turbines
  const turbines: THREE.Object3D[] = [];
  for (const [x, z, h] of [[4, -1.6, 3.8], [-0.8, -2.0, 3.2]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.1, h, 8), steel, x, 1.6 + h / 2, z));
    const rotor = new THREE.Group(); rotor.position.set(x, 1.6 + h, z + 0.2);
    for (let i = 0; i < 3; i++) {
      const b = box(0.14, 1.7, 0.04, mat(0xd8d3c8), 0, 0, 0);
      b.geometry.translate(0, 0.85, 0); b.rotation.z = i * 2.094; rotor.add(b);
    }
    g.add(rotor); turbines.push(rotor);
  }
  const port = box(0.42, 0.42, 0.42, mat(0x1d1d1d, { e: PAL.warn, ei: 1.2 }), portLocal.x, portLocal.y, portLocal.z);
  g.add(port);
  return { group: g, turbines, port };
}

export interface StationModel {
  group: THREE.Group;
  relay: THREE.Mesh;
  relayLight: THREE.PointLight;
  lamps: { bulb: THREE.Mesh; light: THREE.PointLight }[];
  windows: THREE.Mesh[];
  port: THREE.Mesh;
}

export function stationModel(r: { x: number; y: number; w: number; h: number }, portLocal: THREE.Vector3): StationModel {
  const g = new THREE.Group();
  g.position.set(r.x + r.w / 2, 0, r.y + r.h / 2);
  g.add(box(r.w, 0.5, r.h, mat(0x7c7972), 0, 0.25, 0));
  const steel = mat(PAL.silhouette, { m: 0.4, r: 0.7 });
  const TH = 11;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.1, 0.15, TH, 6), steel, dx * 1.5, TH / 2, dz * 1.5);
    leg.rotation.set(dz * 0.08, 0, -dx * 0.08); g.add(leg);
  }
  for (let y = 1.6; y < TH; y += 1.7) {
    const s = 1.5 - y * 0.07;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const b = box(s * 2, 0.07, 0.07, steel, Math.sin(a) * s, y, Math.cos(a) * s); b.rotation.y = a; g.add(b);
    }
  }
  g.add(box(1.5, 1.1, 1.5, mat(0xc9c4b8), 0, TH + 0.55, 0));
  const relay = mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: PAL.off, emissiveIntensity: 2 }), 0, TH + 1.45, 0, false);
  g.add(relay);
  const relayLight = new THREE.PointLight(PAL.off, 2.5, 14, 1.5); relayLight.position.set(0, TH + 1.6, 0); g.add(relayLight);
  // control hut with windows
  const hut = box(2.4, 1.8, 1.8, mat(0x5e5c57), -1.8, 1.4, 2.2); g.add(hut);
  const windows: THREE.Mesh[] = [];
  for (const x of [-2.4, -1.4]) {
    const w = mesh(new THREE.PlaneGeometry(0.55, 0.45), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: PAL.lamp, emissiveIntensity: 0 }), x, 1.6, 3.11, false);
    g.add(w); windows.push(w);
  }
  // solar panels
  const sol = mat(0x23364a, { r: 0.3, m: 0.5 });
  for (let i = 0; i < 3; i++) {
    const p = box(2.0, 0.07, 1.2, sol, 2.4, 1.1, -2.4 + i * 1.5); p.rotation.z = -0.3; g.add(p);
  }
  // lamps on the platform corners
  const lamps: StationModel['lamps'] = [];
  for (const [x, z] of [[-3.1, -3.1], [3.1, 3.1], [3.1, -3.1]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6), mat(PAL.steel), x, 1.7, z));
    const bulb = mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: PAL.lamp, emissiveIntensity: 0 }), x, 2.95, z, false);
    const light = new THREE.PointLight(0xffb060, 0, 11, 1.6); light.position.set(x, 3, z);
    g.add(bulb); g.add(light); lamps.push({ bulb, light });
  }
  const port = box(0.42, 0.42, 0.42, mat(0x1d1d1d, { e: PAL.off, ei: 1.2 }), portLocal.x, portLocal.y, portLocal.z);
  port.material = (port.material as THREE.Material).clone();
  g.add(port);
  return { group: g, relay, relayLight, lamps, windows, port };
}

export interface WoltModel { group: THREE.Group; head: THREE.Mesh; spot: THREE.SpotLight; reel: THREE.Mesh; legs: THREE.Mesh[] }

export function woltModel(): WoltModel {
  const g = new THREE.Group();
  const body = mat(0x24282c, { r: 0.55, m: 0.4 }), acc = mat(0x8a5a32, { r: 0.6 });
  const inner = new THREE.Group(); inner.scale.setScalar(0.72); g.add(inner);
  inner.add(box(0.9, 0.85, 0.7, body, 0, 0.85, 0));
  inner.add(box(0.95, 0.16, 0.75, acc, 0, 1.15, 0));
  const head = mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 2 }), 0, 1.55, 0.05, false);
  inner.add(head);
  const reel = mesh(new THREE.TorusGeometry(0.3, 0.11, 8, 18), mat(PAL.copper, { r: 0.4, m: 0.6 }), 0, 0.95, -0.46);
  inner.add(reel);
  const legs: THREE.Mesh[] = [];
  for (const s of [-0.28, 0.28]) { const l = box(0.24, 0.42, 0.34, mat(0x1a1c1e), s, 0.21, 0); inner.add(l); legs.push(l); }
  inner.add(box(0.14, 0.5, 0.14, body, 0.55, 0.85, 0.22));
  inner.add(box(0.14, 0.5, 0.14, body, -0.55, 0.85, 0.22));
  const spot = new THREE.SpotLight(0xffb060, 5, 14, 0.6, 0.7, 1.3);
  spot.position.set(0, 1.2, 0.2); spot.castShadow = false;
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 5); g.add(tgt); spot.target = tgt; g.add(spot);
  return { group: g, head, spot, reel, legs };
}
