import * as THREE from 'three';
import { mat, mesh, box } from '../../../render/models';
import { Models, fit } from '../../../render/assets';
import { PAL } from '../../../render/palette';
import { Station, ROOMS } from '../../sim/station';
import { canvasTex, glow, Hole, holeify, holeifyObject } from './kit';
import { wake, WakePart } from './wake';
import { anemometer, cupSpeed } from './life';

export const WALL_H = 3.0;     // full walls under a roof; a round hole opens around Wolt instead of a cut-away
export const ROOF_Y = 3.0;
const FACADE_Z = 13;           // the yard side of the south wall
const WARM = 0xffd9a0;         // the station's own lamps
const WARM_C = new THREE.Color(WARM);
const WINDOWS: Record<string, number[]> = { hall: [3], workshop: [9.3, 14.6], duty: [21], storage: [23.6, 28.4], machine: [31.4, 35.4] };
const NORTH_WINDOWS: Record<string, number> = { hall: 3, workshop: 12, duty: 19, storage: 26, machine: 33.5 };

/** What a door says without words: one pictogram per room. */
const ICONS: Record<string, (c: CanvasRenderingContext2D) => void> = {
  hall: c => { for (const r of [7, 15, 23]) { c.beginPath(); c.arc(32, 32, r, 0, 7); c.stroke(); } },
  workshop: c => {
    c.beginPath(); c.arc(32, 32, 11, 0, 7); c.stroke();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15); c.lineTo(32 + Math.cos(a) * 23, 32 + Math.sin(a) * 23); c.stroke(); }
  },
  duty: c => { c.beginPath(); c.moveTo(8, 32); c.quadraticCurveTo(32, 10, 56, 32); c.quadraticCurveTo(32, 54, 8, 32); c.stroke(); c.beginPath(); c.arc(32, 32, 7, 0, 7); c.fill(); },
  storage: c => { c.strokeRect(12, 16, 40, 34); c.beginPath(); c.moveTo(12, 28); c.lineTo(52, 28); c.moveTo(32, 16); c.lineTo(32, 28); c.stroke(); },
  machine: c => { c.beginPath(); c.moveTo(37, 8); c.lineTo(20, 36); c.lineTo(31, 36); c.lineTo(26, 57); c.lineTo(45, 27); c.lineTo(34, 27); c.closePath(); c.fill(); },
};

interface RoomLook { id: WakePart; glass: THREE.MeshStandardMaterial; light: THREE.PointLight | null; halos: THREE.Sprite[]; base: number }

/**
 * Stacja Pomiarowa „Olszanka”: pale panels, a dark plinth, a band of windows, canopies over
 * the doors with a pictogram each, a flat roof with dusty solar panels and instruments.
 * Dead at first; `update` lights it room by room once the machine room has power.
 */
export class Building {
  private rooms: RoomLook[] = [];
  private doorLamps: { m: THREE.MeshStandardMaterial; halo: THREE.Sprite; k: number }[] = [];
  private doorLight: THREE.PointLight;
  private fan = Object.assign(new THREE.Group(), { userData: { live: true } });
  private fanSpeed = 0;
  private cups!: THREE.Group;
  private x0 = ROOMS[0].x;
  private x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;

  constructor(private scene: THREE.Scene, private st: Station, private models: Models, private hole: Hole) {
    this.walls();
    this.facade();
    this.roof();
    this.doorLight = new THREE.PointLight(WARM, 0, 14, 1.4);
    this.doorLight.position.set((this.x0 + this.x1) / 2, 2.2, FACADE_Z + 1.6);
    scene.add(this.doorLight);
  }

  private holeMats = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  /** A material with the hole, one per colour: private copies, so the shared cache stays whole. */
  private hm(color: number, o: { r?: number; m?: number } = {}) {
    const src = mat(color, o);
    if (!this.holeMats.has(src)) this.holeMats.set(src, holeify(src.clone(), this.hole));
    return this.holeMats.get(src)!;
  }

  private walls() {
    const s = this.scene, wall = this.hm(0x8d8b84, { r: 0.95 });
    for (const o of this.st.world.obstacles) {
      if (o.kind !== 'container' || (o.x === 5 && o.y === 12)) continue; // the hall door is a door, not a wall
      s.add(box(o.w, WALL_H, o.h, wall, o.x + o.w / 2, WALL_H / 2, o.y + o.h / 2));
    }
    // lintels over the door gaps
    for (const r of ROOMS) for (const d of r.doors) s.add(box(d.w, 0.8, 1, wall, d.x + d.w / 2, WALL_H - 0.4, r.y + r.h - 0.5));
    // the hall door, shut behind Wolt: two leaves and a dead lock
    const leaf = this.hm(0x4a5a54, { r: 0.7, m: 0.4 }), rib = this.hm(0x3d4a45, { r: 0.7, m: 0.4 });
    for (const x of [5.5, 6.5]) {
      s.add(box(0.98, 2.2, 0.12, leaf, x, 1.1, 12.6));
      for (const y of [0.5, 1.1, 1.7]) s.add(box(0.8, 0.05, 0.14, rib, x, y, 12.6));
    }
  }

  private facade() {
    const s = this.scene, L = this.x1 - this.x0, cx = (this.x0 + this.x1) / 2;
    const dark = this.hm(0x4b4c4c, { r: 0.9 }), joint = this.hm(0x74726c, { r: 1 }), steel = this.hm(0x55595c, { r: 0.6, m: 0.5 });
    s.add(box(L + 0.06, 0.4, 0.06, dark, cx, 0.2, FACADE_Z + 0.03));        // plinth
    s.add(box(L + 0.06, 0.22, 0.05, dark, cx, 2.87, FACADE_Z + 0.025));     // fascia under the roof
    const inDoor = (x: number) => ROOMS.some(r => r.doors.some(d => x > d.x - 0.3 && x < d.x + d.w + 0.3));
    for (let x = this.x0 + 1; x < this.x1; x += 2) if (!inDoor(x)) s.add(box(0.03, 2.36, 0.02, joint, x, 1.58, FACADE_Z + 0.01));

    const frame = this.hm(0x3a3d3f, { r: 0.6, m: 0.4 });
    for (const r of ROOMS) {
      const id = r.id as WakePart;
      const glass = holeify(new THREE.MeshStandardMaterial({ color: 0x7f888b, roughness: 0.25, metalness: 0.3, emissive: WARM, emissiveIntensity: 0 }), this.hole);
      const halos: THREE.Sprite[] = [];
      for (const x of WINDOWS[r.id]) {
        s.add(box(1.46, 0.96, 0.06, frame, x, 1.9, FACADE_Z + 0.005));
        s.add(box(1.3, 0.8, 0.05, glass, x, 1.9, FACADE_Z + 0.02));
        s.add(box(0.03, 0.8, 0.06, frame, x, 1.9, FACADE_Z + 0.025));          // mullion
        s.add(box(1.54, 0.05, 0.14, frame, x, 1.44, FACADE_Z + 0.06));         // sill
        const h = glow(WARM, 3.4); h.position.set(x, 1.9, FACADE_Z + 0.35); s.add(h); halos.push(h);
      }
      // the window to the valley on the far wall, seen from inside
      const nx = NORTH_WINDOWS[r.id];
      s.add(box(1.76, 1.06, 0.05, frame, nx, 2.0, 3.99));
      s.add(box(1.6, 0.9, 0.05, glass, nx, 2.0, 4.0));
      // under the roof it is dim: a little grey light leaks in through each window
      // (not in the hall: its door is shut for good, nobody sees inside)
      let light: THREE.PointLight | null = null;
      if (r.id !== 'hall') {
        light = new THREE.PointLight(0xc8ccd0, 0, 7.5, 1.6);
        light.position.set(r.x + r.w / 2 + 0.5, 2.4, r.y + r.h / 2); s.add(light);
      }
      this.rooms.push({ id, glass, light, halos, base: r.id === 'machine' ? 0 : 3 });

      // the door: frame, canopy with a lamp strip along its edge, pictogram above
      const d = r.doors[0], dx = d.x + d.w / 2;
      for (const x of [d.x - 0.05, d.x + d.w + 0.05]) s.add(box(0.1, 2.2, 0.18, steel, x, 1.1, FACADE_Z - 0.02));
      s.add(box(d.w + 0.2, 0.1, 0.18, steel, dx, 2.25, FACADE_Z - 0.02));
      s.add(box(d.w + 0.9, 0.07, 0.8, this.hm(0x5d5e5c, { r: 0.8, m: 0.2 }), dx, 2.36, FACADE_Z + 0.4));
      const lm = holeify(new THREE.MeshStandardMaterial({ color: 0x2a2826, emissive: WARM, emissiveIntensity: 0 }), this.hole);
      s.add(mesh(new THREE.BoxGeometry(d.w * 0.7, 0.035, 0.05), lm, dx, 2.31, FACADE_Z + 0.76, false));
      const halo = glow(WARM, 4.2); halo.position.set(dx, 1.9, FACADE_Z + 1.0); s.add(halo);
      this.doorLamps.push({ m: lm, halo, k: this.doorLamps.length });
      const icon = canvasTex(64, 64, c => {
        c.fillStyle = '#2b2d2e'; c.fillRect(0, 0, 64, 64);
        c.strokeStyle = c.fillStyle = '#c9c4b6'; c.lineWidth = 4; c.lineJoin = 'round';
        ICONS[r.id](c);
      });
      const plate = mesh(new THREE.PlaneGeometry(0.3, 0.3), holeify(new THREE.MeshStandardMaterial({ map: icon, roughness: 0.8 }), this.hole), dx + d.w / 2 + 0.42, 2.05, FACADE_Z + 0.012, false);
      s.add(plate);
    }
    // the concrete apron along the front, in slabs that have sunk a little, each its own way
    const slab = mat(0x8a877f, { r: 0.95 }), slab2 = mat(0x827f78, { r: 0.95 });
    s.add(mesh(new THREE.BoxGeometry(L + 0.9, 0.04, 1.7), mat(0x55534e, { r: 1 }), cx, -0.01, FACADE_Z + 0.85, false));   // dark joints
    for (let x = this.x0 - 0.5, i = 0; x < this.x1 + 0.4; x += 1.5, i++) {
      const b = box(1.46, 0.08, 1.66, i % 3 ? slab : slab2, x + 0.75, -0.012 + Math.sin(i * 2.3) * 0.006, FACADE_Z + 0.85);
      b.rotation.set(Math.sin(i * 1.7) * 0.006, 0, Math.sin(i * 3.1) * 0.006); b.castShadow = false;
      s.add(b);
    }
  }

  private roof() {
    const s = this.scene, L = this.x1 - this.x0, cx = (this.x0 + this.x1) / 2, top = ROOF_Y + 0.22;
    // tar paper in strips, ash drifted against the parapets, old stains
    const tex = canvasTex(1024, 300, c => {
      c.fillStyle = '#787670'; c.fillRect(0, 0, 1024, 300);
      let q = 5; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        c.fillStyle = i % 3 ? `rgba(168,164,154,${0.05 + r() * 0.1})` : `rgba(70,70,66,${0.06 + r() * 0.1})`;
        c.beginPath(); c.ellipse(r() * 1024, r() * 300, 20 + r() * 70, 8 + r() * 30, r() * 3, 0, 7); c.fill();
      }
      c.strokeStyle = 'rgba(48,48,46,0.55)'; c.lineWidth = 1.5;
      for (let x = 44.8; x < 1024; x += 44.8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 3, 300); c.stroke(); }
      for (const [y0, y1] of [[0, 26], [300, 274]]) {
        const g = c.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(176,172,162,0.55)'); g.addColorStop(1, 'rgba(176,172,162,0)');
        c.fillStyle = g; c.fillRect(0, Math.min(y0, y1), 1024, 26);
      }
    });
    const roofM = holeify(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), this.hole);
    s.add(box(L + 0.6, 0.22, 10.6, roofM, cx, ROOF_Y + 0.11, 8));
    const trim = this.hm(0x55534e, { r: 0.9 });
    for (const z of [13.22, 2.78]) s.add(box(L + 0.6, 0.3, 0.16, trim, cx, top + 0.15, z));
    for (const x of [this.x0 - 0.22, this.x1 + 0.22]) s.add(box(0.16, 0.3, 10.6, trim, x, top + 0.15, 8));

    const put = (name: string, w: number, d: number, x: number, z: number, rot = 0, h?: number) => {
      const o = holeifyObject(fit(this.models, name, w, d, h, rot), this.hole);
      o.position.set(x, top, z); s.add(o); return o;
    };
    // two rows of solar panels under years of ash; one has slipped off its frame
    for (let i = 0; i < 7; i++) for (const z of [5.4, 10.4]) {
      if (i === 4 && z > 6) continue;
      const o = put('solarpanel', 1.75, 1.1, 2.6 + i * 1.95, z);
      if (i === 2 && z < 6) { o.rotation.z = 0.16; o.position.y -= 0.05; }
    }
    put('Prop_ACUnit', 1.5, 0.6, 18.2, 10.3);
    put('Prop_Vent_Big', 1.9, 1.0, 26.5, 5.2, 0.2);
    const metal = this.hm(0x5a5e62, { r: 0.6, m: 0.5 }), darkM = this.hm(0x2c2e30, { r: 0.7, m: 0.3 });
    s.add(box(0.5, 0.9, 0.5, metal, 13.6, top + 0.45, 3.6));                 // workshop flue
    s.add(box(0.62, 0.06, 0.62, darkM, 13.6, top + 0.95, 3.6));
    s.add(box(0.08, 0.06, 8.4, darkM, 30.4, top + 0.03, 8.2));              // conduit to the machine room
    // skylights: a low glazed box over every room, glowing with it
    for (const rm of this.rooms) {
      const r = ROOMS.find(q => q.id === rm.id)!;
      s.add(box(1.9, 0.16, 1.2, trim, r.x + r.w / 2 + 0.5, top + 0.08, 8));
      s.add(box(1.7, 0.05, 1.0, rm.glass, r.x + r.w / 2 + 0.5, top + 0.17, 8));
    }
    // the machine room's exhaust fan: still until there is power
    const fx = 34.3, fz = 5.2;
    s.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 14, 1, true), metal, fx, top + 0.25, fz));
    for (let k = 0; k < 5; k++) { const b = box(0.52, 0.02, 0.16, darkM, 0.3, 0, 0); b.rotation.x = 0.4; const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 5; a.add(b); this.fan.add(a); }
    this.fan.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8), darkM));
    this.fan.position.set(fx, top + 0.42, fz); s.add(this.fan);
    // the instrument mast of a measuring station: a dish, a vane, anemometer cups that always turn
    const ax = 20, az = 4.4;
    s.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.4, 6), metal, ax, top + 1.2, az));
    s.add(box(1.5, 0.04, 0.04, metal, ax, top + 1.9, az));
    const dish = mesh(new THREE.SphereGeometry(0.45, 14, 6, 0, Math.PI * 2, 0, 0.9), this.hm(0x8f8d86, { r: 0.8 }), ax - 0.7, top + 1.5, az);
    dish.rotation.set(Math.PI * 0.62, 0, 0.3); s.add(dish);
    this.cups = anemometer(metal, darkM);
    this.cups.position.set(ax + 0.72, top + 2.02, az); s.add(this.cups);
  }

  /** Lights the rooms one after another once the machine room has power; turns what the wind turns. */
  update(dt: number, t: number) {
    const st = this.st, pt = st.machinePowered ? st.poweredT : -1;
    let sum = 0;
    for (const r of this.rooms) {
      const k = pt < 0 ? 0 : wake(pt, r.id);
      r.glass.emissiveIntensity = k * 0.8;
      if (r.light) { r.light.intensity = r.base + (9 - r.base) * k; r.light.color.setHex(0xc8ccd0).lerp(WARM_C, k); }
      for (const h of r.halos) h.material.opacity = k * 0.16;
    }
    for (const l of this.doorLamps) {
      const k = pt < 0 ? 0 : wake(pt, 'doors', l.k);
      l.m.emissiveIntensity = k * 2.4; l.halo.material.opacity = k * 0.2; sum += k;
    }
    this.doorLight.intensity = sum / this.doorLamps.length * 10;
    this.fanSpeed += ((pt > 0.6 ? 9 : 0) - this.fanSpeed) * Math.min(1, dt * 0.6);
    this.fan.rotation.y += this.fanSpeed * dt;
    this.cups.rotation.y -= cupSpeed(t) * dt;
  }

  /** Port plates and status lamps on the facade share this look. */
  static plate(x: number, y: number, w = 0.3, h = 0.4): THREE.Mesh {
    return box(w, h, 0.06, mat(0x2a2c2e), x, y, FACADE_Z + 0.05);
  }
  static statusLamp(x: number, y: number): { m: THREE.MeshStandardMaterial; o: THREE.Mesh } {
    const m = new THREE.MeshStandardMaterial({ color: 0x220a06, emissive: PAL.off, emissiveIntensity: 0.15 });
    return { m, o: mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), m, x, y, FACADE_Z + 0.1, false) };
  }
}
