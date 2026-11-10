import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, mesh } from '../../render/models';
import { Models, fit } from '../../render/assets';
import { Sail } from '../../render/sail';
import { woltMonoModel, WoltMono, WoltAnimator } from '../../render/wolt';
import { mastRig, runnerRig, balloonSailTexture, rod } from '../../craft/render/yachtModels';
import { YACHT, YachtState, Gear } from '../sim/landYacht';

/**
 * The land yacht in 3D: the service cart from the workshop demo with Wolt's mast, the
 * balloon-skin sail and either a wheel axle or the runners (the same parts as in
 * /demo-craft/), Wolt himself on the deck. Local frame: +z forward, +x to the left.
 *
 * Hierarchy: root (position on the ground, yaw) → tilt (the ground's slope) → heel (rotates
 * about the leeward wheel's contact line) → body.
 */
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m, x, y, z);

export const RIG = { deck: 0.7, mastH: 4.4, boomY: 1.25, mastZ: 0.5, woltZ: -0.4, wheelR: 0.3 } as const;

const M = {
  steel: mat(0x5d6367, { r: 0.45, m: 0.6 }),
  dark: mat(0x1e2022, { r: 0.7, m: 0.3 }),
  wood: mat(0x4f463c, { r: 0.95 }),
  rubber: mat(0x161616, { r: 0.95 }),
  hub: mat(0x7a5236, { r: 0.6, m: 0.4 }),
};

/** A spoked wheel, axis along x, centre at the origin. */
function wheel(r: number, w = 0.1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(r - 0.055, 0.055, 10, 30).rotateY(Math.PI / 2), M.rubber));
  // tread blocks
  for (let k = 0; k < 18; k++) {
    const b = rbox(w * 0.9, 0.03, 0.06, 0.01, M.rubber);
    const a = (k / 18) * Math.PI * 2;
    b.position.set(0, Math.cos(a) * (r - 0.005), Math.sin(a) * (r - 0.005)); b.rotation.x = -a;
    g.add(b);
  }
  g.add(mesh(new THREE.TorusGeometry(r - 0.11, 0.014, 5, 26).rotateY(Math.PI / 2), M.steel));
  for (let k = 0; k < 6; k++) { const s = rbox(0.016, (r - 0.11) * 2, 0.02, 0.005, M.steel); s.rotation.x = (k * Math.PI) / 6; g.add(s); }
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, w + 0.04, 10).rotateZ(Math.PI / 2), M.hub));
  return g;
}

/** The wheel axle: a timber cross beam at the back with a wheel on each end, a steering wheel in front. */
export function wheelRig(track: number) {
  const g = new THREE.Group();
  const r = RIG.wheelR, plankY = 0.42, back = -0.5;
  g.add(rbox(track * 2 + 0.1, 0.09, 0.18, 0.025, M.wood, 0, plankY, back));
  for (const x of [-0.45, 0.45]) g.add(rbox(0.12, 0.11, 0.21, 0.015, M.steel, x, plankY + 0.01, back));
  const wheels: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    // a fork down to each axle stub
    g.add(rbox(0.05, plankY - r + 0.05, 0.06, 0.01, M.steel, s * (track - 0.09), (plankY + r) / 2, back));
    g.add(rod(new THREE.Vector3(s * (track - 0.09), r, back), new THREE.Vector3(s * (track - 0.35), plankY - 0.03, back), 0.012, M.steel));
    const w = wheel(r); w.position.set(s * track, r, back); g.add(w); wheels.push(w);
  }
  // front: a beam forward under the drawbar and a castor fork that steers
  g.add(rbox(0.09, 0.08, 0.9, 0.02, M.wood, 0, plankY - 0.02, 0.95));
  const steer = new THREE.Group(); steer.position.set(0, 0, 1.35); g.add(steer);
  for (const s of [-1, 1]) steer.add(rbox(0.03, plankY - r + 0.04, 0.05, 0.008, M.steel, s * 0.07, (plankY + r) / 2 - 0.02, 0));
  const front = wheel(r * 0.85, 0.08); front.position.set(0, r * 0.85, 0); steer.add(front); wheels.push(front);
  return { group: g, wheels, steer, anchors: [new THREE.Vector3(-track, plankY + 0.04, back), new THREE.Vector3(track, plankY + 0.04, back), new THREE.Vector3(0, plankY, 1.3)] };
}

export class YachtView {
  readonly root = new THREE.Group();
  private tilt = new THREE.Group();
  private heelPivot = new THREE.Group();
  private body = new THREE.Group();
  private rig = new THREE.Group();
  private gearKey: Gear | '' = '';
  private spin: THREE.Group[] = [];
  private steerGroup: THREE.Group | null = null;
  private wheelA = 0;
  readonly sail: Sail;
  readonly pennant: THREE.Group;
  readonly wolt: WoltMono;
  private anim: WoltAnimator;
  private hikeX = 0;
  private sheetVis = 0.6;

  constructor(models: Models) {
    this.root.add(this.tilt); this.tilt.add(this.heelPivot); this.heelPivot.add(this.body);
    // the cart (its own wheels hidden: it stands on the rig)
    const lift = 0.16;
    if (models.has('spacetruck_trailer')) {
      const t = fit(models, 'spacetruck_trailer', 1.15, 1.9, 0.75);
      for (const n of ['front_left', 'front_right', 'rear_left', 'rear_right']) { const w = t.getObjectByName('spacetruck_trailer_wheel_' + n); if (w) w.visible = false; }
      t.position.y = lift;
      this.body.add(t);
    } else this.body.add(rbox(1.1, 0.5, 1.8, 0.05, M.steel, 0, 0.4 + lift, 0));
    this.body.add(rbox(0.05, 0.05, 0.6, 0.01, M.dark, 0, 0.3 + lift, 1.2));
    this.body.add(this.rig);

    const deck = RIG.deck;
    const mr = mastRig(RIG.mastH);
    mr.group.position.set(0, deck, RIG.mastZ);
    this.body.add(mr.group);
    this.pennant = mr.pennant;
    this.headPos = mr.head.clone().add(mr.group.position);

    const sail = new Sail(2.3, RIG.mastH - RIG.boomY - 0.15, balloonSailTexture());
    const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2; // the sail's bow is +x
    holder.position.set(0, deck + RIG.boomY, RIG.mastZ);
    holder.add(sail.group);
    this.body.add(holder);
    this.sail = sail;

    this.wolt = woltMonoModel();
    this.wolt.group.position.set(0, deck, RIG.woltZ);
    this.wolt.spot.intensity = 0;
    this.body.add(this.wolt.group);
    this.anim = new WoltAnimator(this.wolt);
    this.root.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  }
  private headPos: THREE.Vector3;

  /** Rebuild the wheel axle or the runners, with shrouds down to them. */
  private syncGear(gear: Gear) {
    if (gear === this.gearKey) return;
    this.gearKey = gear;
    this.rig.clear();
    this.spin = []; this.steerGroup = null;
    let anchors: THREE.Vector3[];
    if (gear === 'runners') {
      const rr = runnerRig();
      rr.group.position.y = 0;
      this.rig.add(rr.group);
      anchors = rr.ends;
    } else {
      const wr = wheelRig(YACHT.track.wheels);
      this.rig.add(wr.group);
      this.spin = wr.wheels; this.steerGroup = wr.steer;
      anchors = wr.anchors;
    }
    for (const a of anchors) this.rig.add(rod(this.headPos, a, 0.007, M.steel, 4));
    for (const a of anchors) this.rig.add(rod(a, a.clone().lerp(this.headPos, 0.06), 0.016, M.steel, 6));
    this.rig.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** Track half-width for the marks the rig leaves. */
  get trackHalf() { return this.gearKey === 'runners' ? 1.2 : YACHT.track.wheels; }

  update(dt: number, t: number, y: YachtState, ground: (x: number, z: number) => number, hike: boolean) {
    const swapT = y.swap;
    this.syncGear(y.gear);
    const yaw = Math.PI / 2 - y.heading;
    const h = ground(y.x, y.y);
    this.root.position.set(y.x, h, y.y);
    this.root.rotation.y = yaw;
    // pitch and roll with the ground under the axle and the bow
    const fx = Math.cos(y.heading), fy = Math.sin(y.heading);
    const hf = ground(y.x + fx * 1.3, y.y + fy * 1.3), hb = ground(y.x - fx * 0.5, y.y - fy * 0.5);
    const hl = ground(y.x + fy * 0.9, y.y - fx * 0.9), hr = ground(y.x - fy * 0.9, y.y + fx * 0.9);
    const pitch = -Math.atan2(hf - hb, 1.8), roll = Math.atan2(hl - hr, 1.8);
    this.tilt.rotation.x += (pitch - this.tilt.rotation.x) * Math.min(1, dt * 12);
    this.tilt.rotation.z += (roll - this.tilt.rotation.z) * Math.min(1, dt * 12);
    this.root.position.y = h + Math.max(0, (hf + hb) / 2 - h) * 0.5;

    // heel about the leeward wheel's contact line (+heel leans to local −x)
    const track = this.trackHalf;
    const side = Math.sign(y.heel);
    const px = side > 0 ? -track : side < 0 ? track : 0;
    this.heelPivot.position.x = px; this.body.position.x = -px;
    this.heelPivot.rotation.z = y.heel;
    // a swap: the body is jacked up a little while Wolt changes them
    this.body.position.y = swapT > 0 ? Math.sin(Math.min(1, (YACHT.swapTime - swapT) / 0.4) * Math.PI / 2) * 0.12 * Math.min(1, swapT / 0.4) : 0;

    // wheels roll, the front one steers
    this.wheelA += (y.u * dt) / RIG.wheelR;
    for (const w of this.spin) w.rotation.x = this.wheelA;
    if (this.steerGroup) this.steerGroup.rotation.y = y.steer;

    // the sail fills with the apparent wind, the pennant streams
    const appLocal = y.appDir - y.heading;
    this.sheetVis += (y.sheet - this.sheetVis) * Math.min(1, dt * 8);
    this.sail.update(dt, t, appLocal, y.capsized > 0 ? 0 : y.app * (0.2 + 0.8 * Math.min(1, y.cn / 1.0)), this.sheetVis);
    this.pennant.rotation.y = -y.appDir - yaw + Math.sin(t * 9) * 0.07 * Math.min(1, y.app / 6);

    // Wolt hikes out to windward (the side the wind comes from: opposite the boom)
    const hikeTo = hike ? y.side * 0.42 : 0; // local +x is left; side +1 = boom to the right, wind from the left
    this.hikeX += (hikeTo - this.hikeX) * Math.min(1, dt * 5);
    this.wolt.group.position.x = this.hikeX;
    this.wolt.group.rotation.z = -this.hikeX * 0.5;
    this.anim.update({ dt, time: t, speed: 0, yawRate: y.yawRate, accel: 0, strain: false, cableTo: null, tension: 0, pullFrom: null, reelSpin: 0, arm: y.swap > 0 ? 'work' : 'rest', energy: 1, lamp: 0, lookAt: null });
  }
}

/** Load-time list of stock models this demo needs from the workshop pack. */
export const CART_MODELS = ['spacetruck_trailer'];
