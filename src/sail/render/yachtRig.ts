import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mat, mesh } from '../../render/models';
import { Models, fit } from '../../render/assets';
import { Sail } from '../../render/sail';
import { woltMonoModel, WoltMono, WoltAnimator, WHEEL_R } from '../../render/wolt';
import { mastRig, runnerRig, runnerBlade, balloonSailTexture, rod } from '../../craft/render/yachtModels';
import { YACHT, YachtState, Gear } from '../sim/landYacht';
import { Rope, ROPE, sagOf } from './rope';

/**
 * The land yacht in 3D: the service cart from the workshop demo with Wolt's mast, the
 * balloon-skin sail and either a wheel axle or the runners at the back (the same parts as in
 * /demo-craft/). Wolt is the bow wheel: docked under a steering head in front of the cart,
 * he turns with the helm and his own wheel rolls (on runners it sits in a short runner).
 * The battery box slides on a rail across the deck as ballast. Local frame: +z forward,
 * +x to the left.
 *
 * The rigging is modelled line by line, the way it would really be led:
 * - standing: two shrouds swept a little aft to chainplates on the cart's sides and a
 *   forestay to the steering head, steel wire with turnbuckles; the leeward shroud goes
 *   slack as the mast leans on the windward one;
 * - the mainsheet: made fast on the boom block, down to the block on the horse at the aft
 *   edge of the deck, back up through the boom block (2:1), forward along the boom to a block
 *   at the gooseneck, down to a block at the mast foot, along the deck to a fairlead at the
 *   bow and onto Wolt's own cable reel, which winds it in and pays it out. When the boom does
 *   not pull on it (luffing, a lull), the falls hang slack and swing;
 * - the vang from the boom down to the mast foot, the halyard over the masthead sheave down
 *   to a cleat with its tail coiled, the luff laced round the mast, the clew and the tack
 *   lashed to the boom;
 * - the ballast line: an endless loop from both sides of the box through blocks at the rail
 *   ends and round a capstan under the rail.
 *
 * Hierarchy: root (position on the ground, yaw) → tilt (the ground's slope) → heel (rotates
 * about the leeward wheel's contact line) → body.
 */
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m, x, y, z);

export const RIG = {
  /** The cart is a tub: `deck` is its floor (the mast step), `rim` the top of its sides. */
  deck: 0.7, rim: 0.91, mastH: 4.4, boomY: 1.25, mastZ: 0.5, wheelR: 0.3,
  /** Wolt's wheel: the steering axis, ahead of the cart. */
  woltZ: 1.7,
  /** The ballast rail across the deck and how far the box travels each way. */
  railZ: -0.3, travel: 0.6,
  /** Mainsheet: the boom block's distance from the mast; the lower block rides a horse on the aft rim. */
  sheetR: 1.5, horseZ: -0.9,
} as const;

const M = {
  steel: mat(0x5d6367, { r: 0.45, m: 0.6 }),
  dark: mat(0x1e2022, { r: 0.7, m: 0.3 }),
  wood: mat(0x4f463c, { r: 0.95 }),
  rubber: mat(0x161616, { r: 0.95 }),
  hub: mat(0x7a5236, { r: 0.6, m: 0.4 }),
  copper: mat(0x9a6a48, { r: 0.5, m: 0.6 }),
  case: mat(0x3a4046, { r: 0.75, m: 0.2 }),
  mustard: mat(0x8a7a4e, { r: 0.7 }),
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

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

/** Docking, in the steering group's frame (origin under the steering head, +z ahead): where Wolt waits and where he lines up. */
const DOCK = { away: V(1.5, 0, 1.5), front: V(0, 0, 1.35) };

/** A block: two cheeks, a sheave between them and a shackle on top. About 7 cm. */
function block(k = 1): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.016, 0.016]) g.add(rbox(0.008, 0.075, 0.05, 0.004, M.dark, x, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12).rotateZ(Math.PI / 2), M.hub));
  g.add(mesh(new THREE.TorusGeometry(0.016, 0.005, 5, 10), M.steel, 0, 0.048, 0));
  g.scale.setScalar(k);
  return g;
}

/** The wheel axle: a timber cross beam at the back with a wheel on each end and a beam forward under the drawbar. */
export function wheelRig(track: number) {
  const g = new THREE.Group();
  const r = RIG.wheelR, plankY = 0.42, back = -0.5;
  g.add(rbox(track * 2 + 0.1, 0.09, 0.18, 0.025, M.wood, 0, plankY, back));
  for (const x of [-0.45, 0.45]) g.add(rbox(0.12, 0.11, 0.21, 0.015, M.steel, x, plankY + 0.01, back));
  const wheels: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    // a fork down to each axle stub
    g.add(rbox(0.05, plankY - r + 0.05, 0.06, 0.01, M.steel, s * (track - 0.09), (plankY + r) / 2, back));
    g.add(rod(V(s * (track - 0.09), r, back), V(s * (track - 0.35), plankY - 0.03, back), 0.012, M.steel));
    const w = wheel(r); w.position.set(s * track, r, back); g.add(w); wheels.push(w);
  }
  g.add(rbox(0.09, 0.08, 0.7, 0.02, M.wood, 0, plankY - 0.02, 0.95));
  return { group: g, wheels };
}

/** The battery that rides the rail as ballast: a case on a carriage with terminals, a strap and eyes for the line. */
function ballastBox(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.34, 0.03, 0.36, 0.01, M.steel, 0, 0.045, 0));               // carriage
  for (const x of [-0.12, 0.12]) for (const z of [-0.12, 0.12]) g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8).rotateX(Math.PI / 2), M.dark, x, 0.03, z));
  g.add(rbox(0.3, 0.22, 0.32, 0.025, M.case, 0, 0.17, 0));
  g.add(rbox(0.31, 0.03, 0.33, 0.012, M.dark, 0, 0.285, 0));               // lid
  for (const x of [-0.08, 0.08]) g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), M.copper, x, 0.315, 0.08));
  g.add(rbox(0.05, 0.235, 0.335, 0.01, M.mustard, 0, 0.172, 0));           // a faded strap round it
  g.add(mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 12, Math.PI), M.steel, 0, 0.3, -0.07)); // carry handle
  for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.016, 0.005, 5, 10).rotateY(Math.PI / 2), M.steel, s * 0.17, 0.15, 0));
  return g;
}

export class YachtView {
  readonly root = new THREE.Group();
  private tilt = new THREE.Group();
  private heelPivot = new THREE.Group();
  private body = new THREE.Group();
  private rig = new THREE.Group();
  private gearKey: Gear | '' = '';
  private spin: THREE.Group[] = [];
  private wheelA = 0;
  readonly sail: Sail;
  readonly pennant: THREE.Group;
  readonly wolt: WoltMono;
  private anim: WoltAnimator;
  private sheetVis = 0.6;
  private headPos: THREE.Vector3;

  // Wolt's dock
  private steer = new THREE.Group();
  private shoe = new THREE.Group();
  private jaws: THREE.Group[] = [];
  private props: THREE.Group[] = [];
  private woltWas = new THREE.Vector3();
  private hangEnd = new THREE.Vector3();
  // ballast
  private box = ballastBox();
  private capstan = new THREE.Group();
  private ballastVis = 0;
  // running rigging that moves
  private falls: Rope[] = [];
  private lead: Rope; private toReel: Rope;
  private ballastLines: Rope[] = [];
  private shrouds: Rope[] = [];
  private shroudLoad = [0, 0];
  private boomBlock = new THREE.Object3D();
  private neckBlock = new THREE.Object3D();
  private slackVis = 0;
  private tmpA = new THREE.Vector3(); private tmpB = new THREE.Vector3(); private tmpC = new THREE.Vector3();

  // fixed points, body frame
  private readonly deckBlock = V(0, RIG.rim + 0.1, RIG.horseZ);
  private readonly footBlock = V(0.1, RIG.deck + 0.09, RIG.mastZ);
  private readonly fairlead = V(0.1, RIG.rim + 0.035, 0.92);
  private readonly chain = [V(0.62, RIG.rim + 0.1, RIG.mastZ - 0.14), V(-0.62, RIG.rim + 0.1, RIG.mastZ - 0.14)];
  private readonly stem = V(0, 1.4, RIG.woltZ + 0.02);

  constructor(models: Models) {
    this.root.add(this.tilt); this.tilt.add(this.heelPivot); this.heelPivot.add(this.body);
    const deck = RIG.deck, body = this.body;
    // the cart (its own wheels hidden: it stands on the rig)
    const lift = 0.16;
    if (models.has('spacetruck_trailer')) {
      const t = fit(models, 'spacetruck_trailer', 1.15, 1.9, 0.75);
      for (const n of ['front_left', 'front_right', 'rear_left', 'rear_right']) { const w = t.getObjectByName('spacetruck_trailer_wheel_' + n); if (w) w.visible = false; }
      t.position.y = lift;
      body.add(t);
    } else body.add(rbox(1.1, 0.5, 1.8, 0.05, M.steel, 0, 0.4 + lift, 0));
    body.add(rbox(0.05, 0.05, 0.6, 0.01, M.dark, 0, 0.3 + lift, 1.2));
    body.add(this.rig);

    // ---- mast, sail
    const mr = mastRig(RIG.mastH);
    mr.group.position.set(0, deck, RIG.mastZ);
    body.add(mr.group);
    this.pennant = mr.pennant;
    this.headPos = mr.head.clone().add(mr.group.position);

    const sail = new Sail(2.3, RIG.mastH - RIG.boomY - 0.15, balloonSailTexture());
    const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2; // the sail's bow is +x
    holder.position.set(0, deck + RIG.boomY, RIG.mastZ);
    holder.add(sail.group);
    body.add(holder);
    this.sail = sail;

    // ---- Wolt in the bow: a steering head on an A-frame, a saddle that grips his docking clamps
    const wz = RIG.woltZ, headY = 1.3;
    for (const s of [-1, 1]) {
      body.add(rod(V(s * 0.42, RIG.rim + 0.02, 0.82), V(s * 0.05, headY, wz - 0.04), 0.022, M.steel, 8));
      body.add(rbox(0.1, 0.03, 0.12, 0.01, M.dark, s * 0.42, RIG.rim + 0.012, 0.82));
    }
    body.add(rod(V(-0.27, 1.06, 1.13), V(0.27, 1.06, 1.13), 0.014, M.steel, 6));
    body.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14), M.dark, 0, headY, wz));
    body.add(mesh(new THREE.TorusGeometry(0.02, 0.006, 5, 10), M.steel, this.stem.x, this.stem.y - 0.03, this.stem.z)); // forestay eye
    this.steer.position.set(0, 0, wz);
    body.add(this.steer);
    this.wolt = woltMonoModel();
    this.wolt.spot.intensity = 0;
    this.steer.add(this.wolt.group);
    this.anim = new WoltAnimator(this.wolt);
    const st = this.steer;
    st.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 10), M.steel, 0, 1.29, 0));         // kingpin
    // the saddle: an open frame over his back, so he stays in sight
    for (const x of [-0.228, 0.228]) st.add(rbox(0.03, 0.03, 0.56, 0.01, M.steel, x, 1.215, -0.01));
    for (const z of [-0.26, 0, 0.24]) st.add(rbox(0.48, 0.03, 0.035, 0.01, M.steel, 0, 1.215, z));
    // clamp arms hinged on the saddle's sides: they swing in and shut on his docking rails
    for (const x of [-0.228, 0.228]) {
      const jaw = new THREE.Group(); jaw.position.set(x, 1.215, 0); st.add(jaw); this.jaws.push(jaw);
      for (const z of [-0.26, 0.24]) {
        jaw.add(rbox(0.024, 0.37, 0.05, 0.008, M.steel, 0, -0.185, z));
        jaw.add(rbox(0.04, 0.06, 0.075, 0.01, M.dark, -x * 0.03, -0.375, z));
      }
    }
    // bow props: two legs that hold the bow up while Wolt is away, folded back along the frame once he is in
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sx * 0.27, 1.04, wz - 0.5); body.add(leg); this.props.push(leg);
      leg.add(rod(V(0, 0, 0), V(sx * 0.2, -1.03, 0.1), 0.016, M.steel, 6));
      leg.add(rbox(0.1, 0.02, 0.12, 0.008, M.dark, sx * 0.2, -1.03, 0.1));
      leg.add(mesh(new THREE.SphereGeometry(0.026, 8, 6), M.dark));
    }
    // on runners: his wheel stands in a short runner, strapped down
    const blade = runnerBlade(0.85); this.shoe.add(blade);
    for (const x of [-0.07, 0.07]) this.shoe.add(rbox(0.014, 0.17, 0.3, 0.006, M.steel, x, 0.12, 0));
    for (const z of [-0.11, 0.11]) this.shoe.add(rbox(0.17, 0.02, 0.03, 0.006, M.mustard, 0, 0.2, z));
    this.shoe.visible = false;
    st.add(this.shoe);

    // ---- the ballast: rail, box, capstan and its endless line
    const rz = RIG.railZ, ry = RIG.rim + 0.02, re = RIG.travel + 0.26; // the rail lies across the gunwales
    for (const z of [-0.12, 0.12]) body.add(rod(V(-re, ry, rz + z), V(re, ry, rz + z), 0.016, M.steel, 8));
    for (const s of [-1, 1]) {
      body.add(rbox(0.05, 0.05, 0.34, 0.01, M.wood, s * re, ry, rz));
      body.add(rbox(0.03, 0.12, 0.05, 0.008, M.dark, s * (re - 0.01), ry + 0.07, rz));            // end stop
      const b = block(0.9); b.position.set(s * re, ry + 0.15, rz); b.rotation.z = Math.PI / 2; body.add(b);
      for (const x of [0.3, 0.52]) body.add(rbox(0.04, 0.04, 0.3, 0.008, M.wood, s * x, ry - 0.005, rz));
    }
    this.box.position.set(0, ry - 0.02, rz);
    body.add(this.box);
    this.capstan.position.set(0, ry + 0.01, rz - 0.24);
    this.capstan.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), M.steel, 0, 0.05, 0));
    this.capstan.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12), M.dark, 0, 0.105, 0));
    this.capstan.add(rbox(0.012, 0.012, 0.13, 0.004, M.dark, 0, 0.115, 0));
    body.add(this.capstan);
    body.add(rbox(0.14, 0.02, 0.14, 0.008, M.dark, 0, ry, rz - 0.24));
    const hemp = ROPE.hemp(), cord = ROPE.cord(), wire = ROPE.wire();
    const eyeY = ry + 0.15, capY = ry + 0.06;
    // the return run: from the end blocks down and aft, round the capstan
    body.add(new Rope(5, 0.008, hemp).path([V(-re, eyeY, rz), V(-re, capY, rz - 0.2), V(-0.05, capY, rz - 0.24), V(0.05, capY, rz - 0.24), V(re, capY, rz - 0.2)]).mesh);
    body.add(new Rope(2, 0.008, hemp).path([V(re, capY, rz - 0.2), V(re, eyeY, rz)]).mesh);
    body.add(new Rope(26, 0.008, hemp).helix(V(0, ry + 0.025, rz - 0.24), V(0, ry + 0.095, rz - 0.24), 0.054, 4).mesh);
    for (let i = 0; i < 2; i++) { const r = new Rope(6, 0.008, hemp); this.ballastLines.push(r); body.add(r.mesh); }

    // ---- standing rigging: wire with turnbuckles, chainplates on a timber beam across the gunwales
    body.add(rbox(1.3, 0.07, 0.15, 0.02, M.wood, 0, RIG.rim + 0.035, RIG.mastZ - 0.14));
    for (const x of [-0.4, 0.4]) body.add(rbox(0.1, 0.085, 0.17, 0.012, M.steel, x, RIG.rim + 0.035, RIG.mastZ - 0.14));
    // the ballast rail's ends stand on posts from the axle plank
    for (const x of [-1, 1]) body.add(rbox(0.045, 0.5, 0.045, 0.01, M.wood, x * (RIG.travel + 0.14), RIG.rim - 0.24, RIG.railZ - 0.16));
    const ends = [...this.chain, this.stem];
    for (const [i, a] of ends.entries()) {
      const dir = this.headPos.clone().sub(a).normalize();
      body.add(rod(a.clone().addScaledVector(dir, 0.05), a.clone().addScaledVector(dir, 0.21), 0.013, M.steel, 6)); // turnbuckle
      body.add(rod(a.clone().addScaledVector(dir, 0.1), a.clone().addScaledVector(dir, 0.16), 0.017, M.hub, 6));
      if (i < 2) body.add(rbox(0.012, 0.13, 0.05, 0.004, M.dark, a.x, a.y - 0.03, a.z));
      const r = new Rope(i < 2 ? 9 : 2, 0.006, wire, 4); body.add(r.mesh);
      if (i < 2) this.shrouds.push(r); else r.span(a.clone().addScaledVector(dir, 0.2), this.headPos);
    }
    body.add(mesh(new THREE.TorusGeometry(0.062, 0.008, 5, 14).rotateX(Math.PI / 2), M.dark, this.headPos.x, this.headPos.y, this.headPos.z)); // the hounds band

    // ---- halyard: sail head, over the masthead sheave, down the front of the mast to a cleat, tail coiled
    const mz = RIG.mastZ, top = deck + RIG.mastH;
    body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 10).rotateZ(Math.PI / 2), M.hub, 0, top - 0.02, mz + 0.03));
    body.add(new Rope(6, 0.007, hemp).path([V(0, top - 0.17, mz - 0.05), V(0, top - 0.03, mz - 0.01), V(0, top + 0.01, mz + 0.04), V(0, top - 0.06, mz + 0.062), V(0, deck + 0.95, mz + 0.068), V(0.05, deck + 0.9, mz + 0.07)]).mesh);
    body.add(rbox(0.13, 0.022, 0.03, 0.008, M.dark, 0, deck + 0.9, mz + 0.07));
    body.add(new Rope(14, 0.007, hemp).helix(V(-0.05, deck + 0.9, mz + 0.07), V(0.05, deck + 0.9, mz + 0.07), 0.022, 2.5).mesh);
    const coil = new Rope(40, 0.007, hemp).helix(V(0, deck + 0.78, mz + 0.075), V(0, deck + 0.78, mz + 0.115), 0.075, 4).mesh;
    coil.scale.set(0.8, 1.25, 1); coil.position.y = -(deck + 0.78) * 0.25 - 0.02; body.add(coil);
    // the luff laced round the mast
    body.add(new Rope(150, 0.005, cord, 4).helix(V(0, deck + RIG.boomY + 0.12, mz), V(0, top - 0.2, mz), 0.06, 12).mesh);

    // ---- on the boom (they swing with it): blocks, the sheet's run forward, vang, lashings
    const sg = sail.group, by = -0.105;
    this.boomBlock.position.set(RIG.sheetR, by - 0.05, 0);
    this.neckBlock.position.set(0.16, by - 0.03, 0);
    sg.add(this.boomBlock, this.neckBlock);
    for (const o of [this.boomBlock, this.neckBlock]) {
      const b = block(); b.position.copy(o.position); b.position.y += 0.02; b.rotation.y = Math.PI / 2; sg.add(b);
      sg.add(mesh(new THREE.TorusGeometry(0.066, 0.007, 5, 14).rotateY(Math.PI / 2), M.dark, o.position.x, 0, 0)); // strap round the boom
    }
    sg.add(new Rope(2, 0.009, hemp).path([V(RIG.sheetR - 0.03, by - 0.03, 0.012), V(0.19, by - 0.02, 0.012)]).mesh);
    // vang: a two-part tackle from the boom down to the mast foot
    const vTop = V(0.62, by, 0), vBot = V(0.085, -0.93, 0);
    const vb1 = block(0.85); vb1.position.copy(vTop).add(V(0, -0.02, 0)); vb1.rotation.set(0, Math.PI / 2, -0.5); sg.add(vb1);
    const vb2 = block(0.85); vb2.position.copy(vBot).add(V(0.03, 0.03, 0)); vb2.rotation.set(0, Math.PI / 2, Math.PI - 0.5); sg.add(vb2);
    sg.add(mesh(new THREE.TorusGeometry(0.066, 0.007, 5, 14).rotateY(Math.PI / 2), M.dark, vTop.x, 0, 0));
    for (const z of [-0.012, 0.012]) sg.add(new Rope(2, 0.006, hemp, 4).path([V(vTop.x - 0.03, vTop.y - 0.06, z), V(vBot.x + 0.06, vBot.y + 0.07, z)]).mesh);
    // clew outhaul and tack lashing: turns of cord round the boom
    sg.add(new Rope(60, 0.005, cord, 4).helix(V(2.24, 0, 0), V(2.36, 0, 0), 0.068, 7).mesh);
    sg.add(new Rope(30, 0.005, cord, 4).helix(V(0.07, 0, 0), V(0.13, 0, 0), 0.068, 3.5).mesh);
    sg.add(rbox(0.03, 0.14, 0.14, 0.01, M.dark, 2.43, 0, 0)); // boom end cap

    // ---- the mainsheet
    // the horse: a low arch at the aft edge of the deck that the lower block rides on
    const D = this.deckBlock;
    body.add(mesh(new THREE.TorusGeometry(0.11, 0.009, 5, 14, Math.PI), M.steel, D.x, D.y - 0.1, D.z));
    const db = block(); db.position.set(D.x, D.y - 0.035, D.z); db.rotation.set(Math.PI, Math.PI / 2, 0); body.add(db);
    for (let i = 0; i < 2; i++) { const r = new Rope(12, 0.009, hemp); this.falls.push(r); body.add(r.mesh); }
    this.lead = new Rope(4, 0.009, hemp); body.add(this.lead.mesh);
    const fb = block(); fb.position.copy(this.footBlock); fb.rotation.x = Math.PI / 2; body.add(fb);
    body.add(new Rope(2, 0.009, hemp).path([this.footBlock, this.fairlead]).mesh);
    body.add(mesh(new THREE.TorusGeometry(0.022, 0.007, 5, 10).rotateY(0), M.steel, this.fairlead.x, this.fairlead.y, this.fairlead.z));
    body.add(rbox(0.03, 0.05, 0.03, 0.006, M.dark, this.fairlead.x, this.fairlead.y - 0.04, this.fairlead.z));
    this.toReel = new Rope(7, 0.009, hemp); body.add(this.toReel.mesh);

    this.root.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  }

  /** Rebuild the wheel axle or the runners at the back. */
  private syncGear(gear: Gear) {
    if (gear === this.gearKey) return;
    this.gearKey = gear;
    this.rig.clear();
    this.spin = [];
    if (gear === 'runners') this.rig.add(runnerRig(false).group);
    else {
      const wr = wheelRig(YACHT.track.wheels);
      this.rig.add(wr.group);
      this.spin = wr.wheels;
    }
    // his wheel in its runner stands a blade higher
    const up = gear === 'runners' ? 0.045 : 0;
    this.shoe.visible = gear === 'runners';
    this.steer.position.y = up; this.shoe.position.y = -up;
    this.rig.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** Track half-width for the marks the rig leaves. */
  get trackHalf() { return this.gearKey === 'runners' ? 1.2 : YACHT.track.wheels; }

  /** A point of some part of the yacht, in the body's frame. */
  private inBody(o: THREE.Object3D, out: THREE.Vector3) { return this.body.worldToLocal(o.getWorldPosition(out)); }

  update(dt: number, t: number, y: YachtState, ground: (x: number, z: number) => number) {
    const swapT = y.swap;
    this.syncGear(y.gear);
    const yaw = Math.PI / 2 - y.heading;
    const h = ground(y.x, y.y);
    this.root.position.set(y.x, h, y.y);
    this.root.rotation.y = yaw;
    // pitch and roll with the ground under the axle and the bow
    const fx = Math.cos(y.heading), fy = Math.sin(y.heading);
    const hf = ground(y.x + fx * 1.7, y.y + fy * 1.7), hb = ground(y.x - fx * 0.5, y.y - fy * 0.5);
    const hl = ground(y.x + fy * 0.9, y.y - fx * 0.9), hr = ground(y.x - fy * 0.9, y.y + fx * 0.9);
    const pitch = -Math.atan2(hf - hb, 2.2), roll = Math.atan2(hl - hr, 1.8);
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

    // wheels roll; Wolt, the bow wheel, steers
    const roll1 = y.u * dt;
    this.wheelA += roll1 / RIG.wheelR;
    for (const w of this.spin) w.rotation.x = this.wheelA;
    this.steer.rotation.y = y.steer;

    // the sail fills with the apparent wind, the pennant streams
    const appLocal = y.appDir - y.heading;
    const sheetWas = this.sheetVis;
    this.sheetVis += (y.sheet - this.sheetVis) * Math.min(1, dt * 8);
    this.sail.update(dt, t, appLocal, y.capsized > 0 ? 0 : y.app * (0.2 + 0.8 * Math.min(1, y.cn / 1.0)), this.sheetVis);
    this.pennant.rotation.y = -y.appDir - yaw + Math.sin(t * 9) * 0.07 * Math.min(1, y.app / 6);

    // docking: Wolt rides up beside the bow, turns his back to the yacht, backs in under the
    // steering head, the jaws shut on his rails, the props fold away, the sheet goes on his reel
    const p = y.dock, sm = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
    const ride = sm(p / 0.34), turn = sm((p - 0.34) / 0.16), back = sm((p - 0.5) / 0.3), lock = sm((p - 0.8) / 0.2);
    const wg = this.wolt.group;
    const awayYaw = Math.atan2(DOCK.front.x - DOCK.away.x, DOCK.front.z - DOCK.away.z);
    wg.position.lerpVectors(DOCK.away, DOCK.front, ride);
    wg.position.z *= 1 - back; wg.position.x *= 1 - back;
    wg.position.y = -this.steer.position.y * (1 - back);
    wg.rotation.y = awayYaw * (1 - turn);
    for (const [i, j] of this.jaws.entries()) j.rotation.z = (i === 0 ? -1 : 1) * 0.6 * (1 - lock);
    for (const l of this.props) l.rotation.x = 1.45 * lock;

    // Wolt: clamped in the saddle he cannot lean, but his wheel rolls and his reel works the sheet
    const fallsRate = dt > 0 ? (this.sheetVis - sheetWas) / dt : 0;
    const moved = wg.position.distanceTo(this.woltWas);
    const free = dt > 0 && p < 1 ? (moved / dt) * (p > 0.5 === y.docking > 0 ? -1 : 1) : 0; // backing in, or riding out
    this.woltWas.copy(wg.position);
    this.anim.update({ dt, time: t, speed: Math.max(-3, Math.min(3, free)), yawRate: 0, accel: 0, strain: false, cableTo: null, tension: 0, pullFrom: null, reelSpin: fallsRate * 2 * RIG.sheetR / 0.11 + (p > 0.8 && p < 1 ? -y.docking * 9 : 0), arm: y.swap > 0 ? 'work' : 'rest', energy: Math.max(0.34, y.energy), lamp: 0, lookAt: null });
    if (p >= 1) {
      this.wolt.balance.rotation.set(0, 0, 0);
      this.woltA = y.gear === 'runners' ? this.woltA : this.woltA + roll1 / WHEEL_R + y.thrust * (1 - Math.min(1, Math.abs(y.u) / 2)) * 3 * dt;
      this.wolt.wheel.rotation.x = this.woltA;
    } else {
      this.wolt.balance.rotation.x *= 1 - lock; this.wolt.balance.rotation.z *= 1 - lock;
      this.woltA = this.wolt.wheel.rotation.x;
    }
    this.lockVis = lock;
    this.wolt.guide.rotation.set(0.5, 0, 0); // the guide points down and aft, at the fairlead

    // the ballast box on its rail, the capstan hauling it
    const bx = -y.ballast * RIG.travel;
    const was = this.ballastVis;
    this.ballastVis += (bx - this.ballastVis) * Math.min(1, dt * 18);
    this.box.position.x = this.ballastVis;
    this.capstan.rotation.y += (this.ballastVis - was) / 0.05;
    const re = RIG.travel + 0.26, eyeY = RIG.rim + 0.17, rz = RIG.railZ;
    for (const [i, s] of [-1, 1].entries()) {
      this.ballastLines[i].span(this.tmpA.set(this.ballastVis + s * 0.18, eyeY - 0.02, rz), this.tmpB.set(s * re, eyeY, rz), 0.004);
    }

    this.updateRigging(dt, t, y);
  }
  private woltA = 0;
  private lockVis = 1;

  /** The lines that move: the mainsheet's falls and lead, the shrouds. */
  private updateRigging(dt: number, t: number, y: YachtState) {
    const A = this.tmpA, B = this.tmpB, C = this.tmpC;
    // the falls between the boom block and the block on the horse. The sheet is as long as
    // the boom may go out; when the boom is not out that far the rest hangs slack.
    this.inBody(this.boomBlock, A);
    const D = this.deckBlock;
    const now = A.distanceTo(D);
    const drop = A.y - D.y;
    const allowed = Math.hypot(RIG.sheetR * Math.sin(this.sheetVis), RIG.mastZ - RIG.sheetR * Math.cos(this.sheetVis) - D.z, drop);
    const slack = Math.max(0, allowed - now - 0.01);
    this.slackVis += (slack - this.slackVis) * Math.min(1, dt * 6);
    const sag = Math.min(0.45, sagOf(this.slackVis, now));
    // a slack sheet swings with the flapping sail; a loaded one only hums
    const flap = Math.sin(t * 6.3) * 0.6 + Math.sin(t * 9.7 + 1) * 0.4;
    const swing = sag * 0.5 * flap * Math.min(1, y.app / 6) + 0.003 * Math.sin(t * 40) * Math.min(1, y.drive / 3);
    C.set(swing, 0, -sag * 0.35);
    const floor = RIG.rim + 0.02;
    B.copy(D).x += 0.014; this.falls[0].span(B, this.tmpD.copy(A).setX(A.x + 0.014), sag, C, floor);
    B.copy(D).x -= 0.014; C.x *= 0.7; this.falls[1].span(B, this.tmpD.copy(A).setX(A.x - 0.014), sag * 0.85, C, floor);

    // from the gooseneck block down to the mast-foot block
    this.inBody(this.neckBlock, A);
    this.lead.span(A, this.footBlock);
    // from the bow fairlead onto Wolt's reel (it follows him as he steers)
    // (while he is away its end hangs from the fairlead; as the jaws shut he takes it up)
    this.inBody(this.wolt.cableExit, A);
    this.hangEnd.copy(this.fairlead).add(B.set(0.01, -0.3, 0.06 + 0.02 * Math.sin(t * 2.1)));
    A.lerpVectors(this.hangEnd, A, this.lockVis);
    this.toReel.span(this.fairlead, A, (0.015 + this.slackVis * 0.05) * this.lockVis + 0.05 * this.lockVis * (1 - this.lockVis) * 4);

    // shrouds: the windward one carries the mast, the leeward one goes slack
    const load = y.capsized > 0 ? 0 : Math.min(1, Math.abs(y.tip));
    for (let i = 0; i < 2; i++) {
      // chain[0] is to port (+x); side +1 = boom to starboard, wind from port
      const lee = (i === 0 ? -1 : 1) * y.side > 0 ? load : 0;
      this.shroudLoad[i] += (lee - this.shroudLoad[i]) * Math.min(1, dt * 5);
      const a = this.chain[i];
      B.subVectors(this.headPos, a).normalize();
      A.copy(a).addScaledVector(B, 0.2);
      const k = this.shroudLoad[i];
      C.set((i === 0 ? 1 : -1) * 0.02 * k * (1 + 0.4 * Math.sin(t * 11 + i)), 0, 0);
      this.shrouds[i].span(A, this.headPos, 0.045 * k, C);
    }
  }
  private tmpD = new THREE.Vector3();
}

/** Load-time list of stock models this demo needs from the workshop pack. */
export const CART_MODELS = ['spacetruck_trailer'];
