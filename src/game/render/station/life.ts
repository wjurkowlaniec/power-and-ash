import * as THREE from 'three';
import { mat, mesh, box } from '../../../render/models';
import { V2 } from '../../../sim/vec';
import { WIND } from './atmosphere';

/** Small things that move on their own: a wind sock, anemometer cups, crows. (Grass sways in batch.ts.) */

/** A wind sock on a short arm: it droops and lifts with the gusts. Points down the wind. */
export function windSock(): { group: THREE.Group; update(t: number): void } {
  const group = new THREE.Group(); group.userData.live = true;
  const steel = mat(0x55595c, { r: 0.5, m: 0.5 });
  group.add(mesh(new THREE.TorusGeometry(0.13, 0.012, 5, 14).rotateY(Math.PI / 2), steel));
  const cloth = [mat(0xb0703c, { r: 0.9 }), mat(0xcfc9bb, { r: 0.9 })];
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = group;
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.position.x = i ? 0.26 : 0; parent.add(g);
    const r0 = 0.13 - i * 0.022, r1 = r0 - 0.022;
    const c = mesh(new THREE.CylinderGeometry(r1, r0, 0.26, 10, 1, true).rotateZ(-Math.PI / 2), cloth[i % 2], 0.13, 0, 0);
    (c.material as THREE.Material).side = THREE.DoubleSide;
    g.add(c); segs.push(g); parent = g;
  }
  group.rotation.y = Math.atan2(-WIND.z, WIND.x);
  return {
    group,
    update(t: number) {
      const gust = 0.55 + 0.45 * Math.sin(t * 0.7);
      segs.forEach((g, i) => { g.rotation.z = -(i ? 0.16 : 0.5) * (1.15 - gust) + Math.sin(t * 5.2 - i * 0.9) * 0.05; g.rotation.y = Math.sin(t * 3.7 - i * 1.1) * 0.07; });
    },
  };
}

/** Three cups on arms: they turn whenever the wind blows, power or no power. */
export function anemometer(arm: THREE.Material, cup: THREE.Material): THREE.Group {
  const g = new THREE.Group(); g.userData.live = true;
  for (let k = 0; k < 3; k++) {
    const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3;
    a.add(box(0.26, 0.015, 0.015, arm, 0.13, 0, 0));
    a.add(mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI), cup, 0.27, 0, 0));
    g.add(a);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5), arm, 0, -0.06, 0));
  return g;
}
/** How fast the cups turn in this wind, rad/s. */
export const cupSpeed = (t: number) => 3.2 + Math.sin(t * 0.5) * 1.2;

interface Crow { g: THREE.Group; wings: THREE.Group[]; head: THREE.Group; state: 'perched' | 'flying' | 'gone'; v: THREE.Vector3; t: number; ph: number }

const CROW_SCARE = 4.2;   // m: closer than this and they leave
const CROW_LIFE = 11;     // s in the air before they are out of sight for good

/** A few crows on the fence and the roofs. They watch Wolt come, and go when he gets close. */
export class Crows {
  readonly group = new THREE.Group();
  private crows: Crow[] = [];

  constructor(perches: THREE.Vector3[]) {
    this.group.userData.live = true;
    const dark = mat(0x1c1e20, { r: 0.9 });
    perches.forEach((p, i) => {
      const g = new THREE.Group(); g.position.copy(p); g.rotation.y = i * 2.3;
      const body = mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(0.75, 0.8, 1.6), dark, 0, 0.11, 0); g.add(body);
      const tail = box(0.07, 0.015, 0.16, dark, 0, 0.1, -0.2); tail.rotation.x = 0.25; g.add(tail);
      const head = new THREE.Group(); head.position.set(0, 0.18, 0.11); g.add(head);
      head.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), dark));
      head.add(mesh(new THREE.ConeGeometry(0.018, 0.08, 5).rotateX(Math.PI / 2), mat(0x2c2c2a, { r: 0.6 }), 0, -0.005, 0.08));
      const wings: THREE.Group[] = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(s * 0.05, 0.14, 0);
        const tri = new THREE.Shape(); tri.moveTo(0, 0.09); tri.lineTo(0.34, 0.02); tri.lineTo(0.3, -0.08); tri.lineTo(0, -0.12); tri.closePath();
        const m = mesh(new THREE.ShapeGeometry(tri).rotateX(-Math.PI / 2), dark); (m.material as THREE.Material).side = THREE.DoubleSide;
        m.scale.x = s; w.add(m); g.add(w); wings.push(w);
      }
      this.group.add(g);
      this.crows.push({ g, wings, head, state: 'perched', v: new THREE.Vector3(), t: 0, ph: i * 1.9 });
    });
  }

  update(dt: number, t: number, wolt: V2) {
    for (const c of this.crows) {
      if (c.state === 'gone') continue;
      const p = c.g.position;
      if (c.state === 'perched') {
        // folded wings, a look round now and then, a look at Wolt when he is near
        for (const [i, w] of c.wings.entries()) w.rotation.set(0, (i ? 1 : -1) * 1.35, (i ? -1 : 1) * 0.5);
        const dx = wolt.x - p.x, dz = wolt.y - p.z, d = Math.hypot(dx, dz);
        const look = d < 9 ? Math.atan2(dx, dz) - c.g.rotation.y : Math.sin(Math.floor(t * 0.4 + c.ph) * 2.4) * 1.1;
        c.head.rotation.y += (Math.atan2(Math.sin(look), Math.cos(look)) * 0.6 - c.head.rotation.y) * Math.min(1, dt * 6);
        c.head.rotation.x = Math.max(0, Math.sin(t * 0.9 + c.ph * 3) - 0.9) * 4;
        if (d < CROW_SCARE) {
          c.state = 'flying'; c.t = 0;
          // away from him, and with the wind
          const l = d || 1;
          c.v.set(-dx / l * 2.2 + WIND.x * 2 + Math.sin(c.ph) * 0.8, 2.6, -dz / l * 2.2 + WIND.z * 2 + Math.cos(c.ph) * 0.8);
        }
        continue;
      }
      c.t += dt;
      c.v.y += (0.9 - c.v.y) * Math.min(1, dt * 0.8);
      const sp = Math.min(1, c.t / 1.2);
      p.x += c.v.x * dt * (0.5 + sp); p.y += c.v.y * dt; p.z += c.v.z * dt * (0.5 + sp);
      const yaw = Math.atan2(c.v.x, c.v.z);
      let dy = yaw - c.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.g.rotation.y += dy * Math.min(1, dt * 5);
      c.g.rotation.x = -0.35 * (1 - sp * 0.6);
      c.head.rotation.set(0, 0, 0);
      // hard, quick beats on take-off, slower once in the air
      const beat = Math.sin(c.t * (17 - sp * 6) + c.ph);
      for (const [i, w] of c.wings.entries()) w.rotation.set(0, 0, (i ? 1 : -1) * (0.15 + beat * 0.85));
      if (c.t > CROW_LIFE) { c.state = 'gone'; c.g.visible = false; }
    }
  }
}
