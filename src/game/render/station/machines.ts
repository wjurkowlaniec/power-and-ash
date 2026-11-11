import * as THREE from 'three';
import { mat, mesh, box } from '../../../render/models';
import { PAL } from '../../../render/palette';
import { Station, P, REPAIR_TIME } from '../../sim/station';
import { canvasTex, glow, softDisc } from './kit';
import { WIND } from './atmosphere';
import { wake } from './wake';

/** The machines of Scene 2 that move: transformer cabinet, pen plotter, cable drum, workshop door. */

const ss = THREE.MathUtils.smoothstep;
const LOAD_TIME = 0.9;   // s, the module's way from the shelf onto the tyre
const SEAL_TIME = 0.9;   // s, the cabinet door closing after the swap
const PLOT_TIME = 5.2;   // s, the pen plotter drawing the route map
const SHELF_AT = new THREE.Vector3(26, 0.8, 4.55);

/** A transformer module: a heavy block with cooling fins and two terminals. Charred when burnt. */
export function moduleModel(burnt = false): THREE.Group {
  const g = new THREE.Group();
  const steel = burnt ? mat(0x1f1d1b, { r: 0.95 }) : mat(0x5d6366, { r: 0.5, m: 0.6 });
  const fin = burnt ? mat(0x141312, { r: 1 }) : mat(0x4a4f52, { r: 0.5, m: 0.6 });
  g.add(box(0.5, 0.32, 0.36, steel, 0, 0.16, 0));
  for (let i = -2; i <= 2; i++) g.add(box(0.02, 0.26, 0.4, fin, i * 0.09, 0.16, 0));
  for (const x of [-0.12, 0.12]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), burnt ? fin : mat(0x8a5a3a, { r: 0.4, m: 0.8 }), x, 0.36, 0));
  g.add(box(0.3, 0.02, 0.02, fin, 0, 0.38, 0.12));   // carrying handle
  return g;
}

/**
 * The transformer cabinet at the mast foot, at wheel height. Burnt: red lamp, sparks, a thread
 * of smoke. While E is held the swap plays out from `st.repair`: the door swings open, the
 * charred module comes out and is dropped beside it, the new one leaves the tyre and slides in.
 * Letting go runs it backwards. Then the door shuts and the lamp turns green.
 */
export class Transformer {
  private door = new THREE.Group();
  private burnt = moduleModel(true);
  private fresh = moduleModel();
  private lamp: THREE.MeshStandardMaterial;
  private lampHalo: THREE.Sprite;
  private spark: THREE.PointLight;
  private flash: THREE.Sprite;
  private smoke: THREE.Sprite[] = [];
  private seal = 0;
  private x = 20.5; private z = 21.5;
  /** True while the new module is in the air or in the cabinet: the one on the tyre is hidden. */
  carrying = false;

  constructor(scene: THREE.Scene, private st: Station) {
    const s = scene, { x, z } = this;
    const paint = mat(0x566059, { r: 0.65, m: 0.4 }), dark = mat(0x343b38, { r: 0.7, m: 0.4 }), black = mat(0x111312, { r: 1 });
    s.add(box(1.0, 0.1, 0.9, mat(0x6f6d67, { r: 1 }), x, 0.05, z));                 // concrete foot
    s.add(box(0.9, 1.15, 0.78, paint, x, 0.675, z - 0.02));
    s.add(box(0.98, 0.06, 0.88, dark, x, 1.28, z));                                  // rain cap
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) s.add(box(0.03, 0.8, 0.07, dark, x + sx * 0.46, 0.7, z - 0.28 + k * 0.13));
    s.add(box(0.72, 0.92, 0.02, black, x, 0.63, z + 0.375));                         // the dark inside
    // door, hinged on the left, with the sign everyone reads: a lightning bolt
    this.door.userData.live = this.burnt.userData.live = this.fresh.userData.live = true;
    this.door.position.set(x - 0.37, 0, z + 0.4);
    this.door.add(box(0.74, 0.94, 0.03, dark, 0.37, 0.63, 0));
    this.door.add(box(0.03, 0.14, 0.03, mat(0x8a8780, { r: 0.5, m: 0.6 }), 0.66, 0.63, 0.03));
    const sign = canvasTex(64, 64, c => {
      c.fillStyle = '#d9b23a'; c.beginPath(); c.moveTo(32, 4); c.lineTo(60, 58); c.lineTo(4, 58); c.closePath(); c.fill();
      c.fillStyle = '#1d1f20'; c.beginPath(); c.moveTo(35, 18); c.lineTo(24, 40); c.lineTo(32, 40); c.lineTo(28, 54); c.lineTo(42, 32); c.lineTo(34, 32); c.closePath(); c.fill();
    });
    this.door.add(mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshStandardMaterial({ map: sign, transparent: true, roughness: 0.8 }), 0.34, 0.74, 0.02, false));
    s.add(this.door);
    this.lamp = new THREE.MeshStandardMaterial({ color: 0x220a06, emissive: PAL.off, emissiveIntensity: 0.4 });
    s.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), this.lamp, x + 0.3, 1.2, z + 0.4, false));
    this.lampHalo = glow(PAL.off, 1.1); this.lampHalo.position.set(x + 0.3, 1.2, z + 0.5); s.add(this.lampHalo);
    // the cable from the cabinet up the mast leg
    s.add(box(0.05, 2.6, 0.05, mat(0x1a1a1a), x + 0.5, 1.3, z - 0.3));
    this.spark = new THREE.PointLight(0xbfe6ff, 0, 3.5, 2); this.spark.position.set(x, 0.9, z + 0.55); s.add(this.spark);
    this.flash = glow(0xcfeaff, 1.6); this.flash.position.set(x + 0.2, 0.75, z + 0.48); s.add(this.flash);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color: 0x2f2e2c, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.add(sp); this.smoke.push(sp);
    }
    s.add(this.burnt); s.add(this.fresh);
  }

  /** `tyreAt`: where the module rides on the tyre right now (world). */
  update(dt: number, t: number, tyreAt: THREE.Vector3) {
    const st = this.st, { x, z } = this;
    if (st.turbine) this.seal = Math.min(1, this.seal + dt / SEAL_TIME);
    const u = st.turbine ? 1 : st.repair / REPAIR_TIME;
    const open = st.turbine ? 1 - ss(this.seal, 0.15, 1) : ss(u, 0, 0.2);
    this.door.rotation.y = -open * 1.95;

    // the burnt module: in the slot, pulled out, dropped on the ash beside the cabinet
    const out = ss(u, 0.2, 0.4), drop = ss(u, 0.4, 0.52);
    this.burnt.position.set(x - drop * 0.95, 0.42 * (1 - drop) + Math.sin(drop * Math.PI) * 0.12, z + 0.05 + out * 0.62 + drop * 0.2);
    this.burnt.rotation.set(0, drop * 0.7, drop * 0.22);
    // the new one: off the tyre in an arc to the slot, then in
    const lift = ss(u, 0.5, 0.74), slide = ss(u, 0.74, 0.93);
    this.carrying = u > 0.5;
    this.fresh.visible = this.carrying;
    if (this.carrying) {
      const mouth = new THREE.Vector3(x, 0.42, z + 0.7);
      this.fresh.position.copy(tyreAt).lerp(mouth, lift);
      this.fresh.position.y += Math.sin(lift * Math.PI) * 0.35;
      this.fresh.position.z -= slide * 0.65;
    }

    this.lamp.emissive.setHex(st.turbine ? PAL.ok : PAL.off);
    const blink = st.turbine ? 2 : 0.3 + (Math.sin(t * 5) > 0.7 ? 0.8 : 0);
    this.lamp.emissiveIntensity = blink;
    this.lampHalo.material.color.setHex(st.turbine ? PAL.ok : PAL.off);
    this.lampHalo.material.opacity = blink * 0.16;
    // sparks: rare and on their own while burnt, quick and bright while the module is being pulled
    const working = !st.turbine && st.repair > 0;
    const p = st.turbine ? 0 : working ? 0.22 : 0.035;
    this.spark.intensity = Math.random() < p ? (working ? 9 : 6) : this.spark.intensity * 0.7;
    this.flash.material.opacity = Math.min(0.9, this.spark.intensity / 9);
    // a thread of smoke from the cap, taken by the wind; it stops with the swap
    const smoking = st.turbine ? 0 : 1 - out;
    this.smoke.forEach((sp, i) => {
      const k = (t * 0.22 + i / this.smoke.length) % 1;
      sp.position.set(x - 0.2 + WIND.x * k * k * 1.6, 1.34 + k * 2.2, z + WIND.z * k * k * 1.6);
      sp.scale.setScalar(0.25 + k * 1.1);
      sp.material.opacity = smoking * Math.sin(k * Math.PI) * 0.3;
    });
  }
}

/**
 * The spare module's short flight from the shelf onto the tyre (the logic flips `shelfTaken`
 * in one step; the view shows the arm's work).
 */
export class ModuleLoad {
  private fly = moduleModel();
  private onShelf = moduleModel();
  private tl = -1;

  constructor(scene: THREE.Scene, private st: Station) {
    this.fly.userData.live = this.onShelf.userData.live = true;
    this.onShelf.position.copy(SHELF_AT); scene.add(this.onShelf);
    this.fly.visible = false; scene.add(this.fly);
    if (st.shelfTaken) this.tl = LOAD_TIME;
  }
  /** True once the module really lies on the tyre. */
  get landed() { return this.tl >= LOAD_TIME; }
  get busy() { return this.tl >= 0 && this.tl < LOAD_TIME; }

  update(dt: number, tyreAt: THREE.Vector3) {
    const st = this.st;
    if (st.shelfTaken && this.tl < 0) this.tl = 0;
    if (!st.shelfTaken) this.tl = -1;
    this.onShelf.visible = !st.shelfTaken;
    if (this.tl >= 0 && this.tl < LOAD_TIME) {
      this.tl += dt;
      const u = ss(this.tl / LOAD_TIME, 0, 1);
      this.fly.visible = true;
      this.fly.position.copy(SHELF_AT).lerp(tyreAt, u);
      this.fly.position.y += Math.sin(u * Math.PI) * 0.3;
      this.fly.rotation.y = u * 0.6;
    } else this.fly.visible = false;
  }
}

/**
 * The weather plotter in the duty room: a slanted board with a pen carriage. Once the
 * station has power it draws the page it had queued: the route to R-2, line by line.
 */
export class Plotter {
  private bar = new THREE.Group();
  private pen: THREE.Mesh;
  private cover: THREE.Mesh;
  private led: THREE.MeshStandardMaterial;
  private k = 0;
  private static readonly TILT = 0.75;   // rad from the floor: the board leans back, facing the room and the camera
  private static readonly H = 0.86;      // board length up the slope

  constructor(scene: THREE.Scene, private st: Station) {
    const x = 17.5, z = 10.5, body = mat(0x6a6c68, { r: 0.7, m: 0.3 }), dark = mat(0x2a2c2e, { r: 0.6, m: 0.4 });
    scene.add(box(0.96, 0.62, 0.7, body, x, 0.31, z - 0.06));
    scene.add(box(1.0, 0.05, 0.78, dark, x, 0.64, z - 0.06));
    for (const sx of [-1, 1]) scene.add(box(0.05, 0.2, 0.6, dark, x + sx * 0.46, 0.1, z - 0.06));
    const board = new THREE.Group(); board.position.set(x, 0.68, z + 0.3); board.rotation.x = Plotter.TILT; scene.add(board);
    const H = Plotter.H;
    board.add(box(0.96, 0.03, H + 0.08, body, 0, -0.02, -H / 2));
    scene.add(box(0.9, 0.62, 0.05, dark, x, 0.95, z - 0.36));   // the stand behind the board
    // the route map, the same drawing the note shows: station, mast, dashed way over the hill, the building with the bolt
    const map = canvasTex(300, 300, c => {
      c.fillStyle = '#cfcabd'; c.fillRect(0, 0, 300, 300);
      c.translate(0, 70); c.lineWidth = 2.6; c.lineJoin = 'round'; c.lineCap = 'round';
      const ink = (d: string, col = '#2c2f31', dash: number[] = []) => { c.strokeStyle = col; c.setLineDash(dash); c.stroke(new Path2D(d)); };
      ink('M14 98 H48 V124 H14 Z M14 98 L31 84 L48 98'); ink('M58 122 V70 M52 76 L58 64 L64 76');
      ink('M48 112 C80 112 90 90 120 84 S150 52 175 60 S205 100 230 96 L262 68', '#8a2a1e', [7, 6]);
      ink('M110 96 C130 60 160 44 190 62'); ink('M196 104 H226 M196 98 H226 M200 98 V108 M222 98 V108');
      ink('M252 40 H286 V68 H252 Z'); ink('M268 44 L262 54 L270 54 L265 64', '#8a2a1e');
      ink('M20 20 L20 44 M14 26 L20 20 L26 26');
      c.fillStyle = '#8a2a1e'; c.font = '600 20px monospace'; c.fillText('4,2 km', 128, 146);
    });
    const paper = new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
    const sheet = mesh(new THREE.PlaneGeometry(0.8, H - 0.08).rotateX(-Math.PI / 2), paper, 0, 0, -H / 2, false); board.add(sheet);
    // a blank sheet over the drawing that the carriage "uncovers" from the top down
    this.cover = mesh(new THREE.PlaneGeometry(0.8, H - 0.08).rotateX(-Math.PI / 2).translate(0, 0, (H - 0.08) / 2), new THREE.MeshStandardMaterial({ color: 0xcfcabd, roughness: 0.9 }), 0, 0.004, -0.04 - (H - 0.08), false);
    board.add(this.cover);
    // carriage: a bar across the board, a pen head that runs along it
    this.bar.userData.live = this.cover.userData.live = true;
    this.bar.add(box(0.94, 0.03, 0.035, dark, 0, 0.03, 0));
    this.pen = box(0.07, 0.05, 0.07, mat(0x8a5a32, { r: 0.6 }), 0, 0.03, 0); this.bar.add(this.pen);
    board.add(this.bar);
    this.led = new THREE.MeshStandardMaterial({ color: 0x1a1a18, emissive: PAL.ok, emissiveIntensity: 0 });
    scene.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), this.led, x + 0.38, 0.5, z + 0.3, false));
  }

  update(dt: number, t: number) {
    const st = this.st, H = Plotter.H - 0.08;
    if (st.plotted) this.k = Math.min(1, this.k + dt / PLOT_TIME);
    const k = this.k, drawing = st.plotted && k < 1;
    // the bar walks down the sheet; the blank cover shrinks ahead of it
    this.bar.position.z = -0.04 - H + k * H;
    this.cover.scale.z = Math.max(0.001, 1 - k);
    this.cover.position.z = -0.04 - H + k * H;
    this.pen.position.x = drawing ? Math.sin(t * 9) * 0.36 * (0.6 + 0.4 * Math.sin(t * 2.3)) : this.pen.position.x * (1 - Math.min(1, dt * 3));
    const awake = st.machinePowered ? wake(st.poweredT, 'duty') : 0;
    this.led.emissiveIntensity = awake * (drawing ? (Math.sin(t * 14) > 0 ? 2.5 : 0.4) : 1.6);
  }
}

/** The cable drum at the mast foot: a wooden reel on a cradle. Turns as cable is paid out. */
export function cableDrum(scene: THREE.Scene): THREE.Group {
  const x = P.junction.x, z = P.junction.y;
  const wood = mat(0x6b5f50, { r: 0.95 }), steel = mat(0x3e3f40, { r: 0.6, m: 0.5 });
  const reel = new THREE.Group(); reel.position.set(x, 0.42, z); reel.userData.live = true;
  for (const sx of [-1, 1]) {
    reel.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 18).rotateZ(Math.PI / 2), wood, sx * 0.2, 0, 0));
    for (let k = 0; k < 4; k++) { const b = box(0.02, 0.74, 0.05, steel, sx * 0.225, 0, 0); b.rotation.x = k * Math.PI / 4; reel.add(b); }
  }
  reel.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12).rotateZ(Math.PI / 2), wood));
  for (let k = 0; k < 6; k++) reel.add(mesh(new THREE.TorusGeometry(0.2 + (k % 2) * 0.035, 0.03, 5, 16).rotateY(Math.PI / 2), mat(0x161818, { r: 0.7 }), -0.15 + k * 0.06, 0, 0));
  scene.add(reel);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // the cradle's splayed legs
    const leg = box(0.05, 0.5, 0.05, steel, x + sx * 0.3, 0.25, z + sz * 0.18); leg.rotation.x = sz * 0.35; scene.add(leg);
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6).rotateZ(Math.PI / 2), steel, x, 0.42, z));
  scene.add(box(0.8, 0.05, 0.6, mat(0x2f3133), x, 0.025, z));
  return reel;
}

/** The workshop's sliding door with its window slit, and the lock port beside it. */
export function workshopDoor(scene: THREE.Scene): THREE.Group {
  const g = new THREE.Group(); g.position.set(12, 0, 12.5); g.userData.live = true;
  const leaf = mat(0x4a5a54, { r: 0.7, m: 0.4 }), rib = mat(0x3d4a45, { r: 0.7, m: 0.4 });
  g.add(box(2, 2.2, 0.1, leaf, 0, 1.1, 0));
  for (const y of [0.35, 0.95]) g.add(box(1.84, 0.05, 0.13, rib, 0, y, 0));
  g.add(box(0.9, 0.22, 0.12, mat(0x8a9396, { r: 0.2, m: 0.3 }), 0, 1.62, 0));
  g.add(box(0.05, 0.5, 0.14, mat(0x8a8780, { r: 0.5, m: 0.6 }), -0.8, 1.05, 0.02));
  scene.add(g);
  scene.add(box(2.3, 0.05, 0.08, mat(0x2f3133, { r: 0.6, m: 0.5 }), 13.1, 2.22, 12.44));   // the rail it runs on
  return g;
}
