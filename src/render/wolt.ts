import * as THREE from 'three';
import { mat, mesh, box } from './models';
import { PAL } from './palette';

/**
 * Wolt, stage 1 ("Rdzeń"): a monocycle. One wheel, a capsule riding on a fork with the
 * Q-1 cell behind a narrow side window, a lamp in the nose, a cable reel at the back with
 * a swivelling cable guide, a two-joint service arm on top, and a tow hitch low at
 * the back. Facing +z in local space, about 1.1 m tall.
 *
 * Shared engine file: the tech demo uses it now; the game can use it for its body later.
 */
export const WHEEL_R = 0.32;
const BODY_Y = 0.86;

export interface WoltMono {
  group: THREE.Group;     // position + yaw (set by the caller)
  balance: THREE.Group;   // lean: pivot at the wheel's contact point
  body: THREE.Group;      // the capsule and everything on it
  wheel: THREE.Group;
  head: THREE.Mesh;       // lamp lens (emissive)
  spot: THREE.SpotLight;
  cell: THREE.Mesh;       // Q-1 window (emissive)
  reel: THREE.Group;
  guide: THREE.Group;     // cable guide, turns towards the cable
  cableExit: THREE.Object3D;
  hitch: THREE.Object3D;
  arm: { shoulder: THREE.Group; elbow: THREE.Group; fingers: THREE.Mesh[] };
}

export function woltMonoModel(): WoltMono {
  const group = new THREE.Group();
  const balance = new THREE.Group(); group.add(balance);
  const paint = mat(0x5b6670, { r: 0.6, m: 0.25 }), steel = mat(0x55595c, { r: 0.5, m: 0.5 });
  const dark = mat(0x1b1d1f, { r: 0.8 }), rubber = mat(0x141414, { r: 0.95 });
  const copper = mat(PAL.copper, { r: 0.45, m: 0.6 }), mustard = mat(0x8a7a4e, { r: 0.7 });

  // wheel: tyre, rim, spokes, hub (rotates about x)
  const wheel = new THREE.Group(); wheel.position.set(0, WHEEL_R, 0); balance.add(wheel);
  wheel.add(mesh(new THREE.TorusGeometry(WHEEL_R - 0.05, 0.05, 8, 28).rotateY(Math.PI / 2), rubber));
  wheel.add(mesh(new THREE.TorusGeometry(WHEEL_R - 0.1, 0.012, 4, 24).rotateY(Math.PI / 2), steel));
  for (let k = 0; k < 6; k++) { const sp = box(0.012, (WHEEL_R - 0.1) * 2, 0.012, steel); sp.rotation.x = k * Math.PI / 6; wheel.add(sp); }
  wheel.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10).rotateZ(Math.PI / 2), steel));

  // fork from the hub up to the capsule
  for (const x of [-0.075, 0.075]) {
    const f = box(0.03, BODY_Y - WHEEL_R - 0.1, 0.05, dark, x, (BODY_Y + WHEEL_R) / 2 - 0.05, 0);
    balance.add(f);
  }
  // tow hitch: a short strut back from the hub, ending in a hook
  const strut = box(0.03, 0.03, 0.34, dark, 0, WHEEL_R + 0.02, -0.2); balance.add(strut);
  const hook = mesh(new THREE.TorusGeometry(0.035, 0.01, 5, 10, Math.PI * 1.4).rotateY(Math.PI / 2), steel, 0, WHEEL_R - 0.01, -0.38);
  balance.add(hook);
  const hitch = new THREE.Object3D(); hitch.position.set(0, WHEEL_R - 0.04, -0.4); balance.add(hitch);

  // the capsule
  const body = new THREE.Group(); body.position.y = BODY_Y; balance.add(body);
  body.add(mesh(new THREE.CapsuleGeometry(0.19, 0.4, 4, 12).rotateX(Math.PI / 2), paint));
  body.add(box(0.4, 0.05, 0.42, steel, 0, -0.17, 0));
  for (const z of [-0.26, 0.24]) body.add(box(0.41, 0.04, 0.05, dark, 0, -0.02, z)); // docking clamps for later bodies
  // nose: lamp housing and lens
  body.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 12).rotateX(Math.PI / 2), dark, 0, 0.02, 0.36));
  const head = mesh(new THREE.CircleGeometry(0.06, 14), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 2 }), 0, 0.02, 0.405, false);
  body.add(head);
  // Q-1 cell behind a narrow window on the left flank (a panel is missing there)
  body.add(box(0.03, 0.15, 0.24, dark, -0.18, 0.01, 0.0));
  const cell = mesh(new THREE.BoxGeometry(0.012, 0.1, 0.035), new THREE.MeshStandardMaterial({ color: 0xcfe4ea, emissive: 0xcfe4ea, emissiveIntensity: 1 }), -0.197, 0.01, 0.02, false);
  body.add(cell);
  body.add(mesh(new THREE.BoxGeometry(0.012, 0.025, 0.025), mat(0xff9a50, { e: 0xff9a50, ei: 2 }), -0.197, 0.06, 0.08, false));
  // antenna stub and a faded mustard patch: a repaired plate
  body.add(box(0.012, 0.16, 0.012, dark, -0.09, 0.25, -0.12));
  body.add(box(0.14, 0.012, 0.12, mustard, -0.03, 0.185, 0.1));

  // cable reel at the back (axis x) and the guide that swings towards the cable
  const reel = new THREE.Group(); reel.position.set(0, 0.0, -0.38); body.add(reel);
  reel.add(mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 18).rotateY(Math.PI / 2), copper));
  reel.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 14).rotateZ(Math.PI / 2), dark, 0.07, 0, 0));
  reel.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 14).rotateZ(Math.PI / 2), dark, -0.07, 0, 0));
  for (let k = 0; k < 3; k++) { const s = box(0.15, 0.02, 0.02, steel); s.rotation.x = k * Math.PI / 3; reel.add(s); }
  const guide = new THREE.Group(); guide.position.set(0, -0.12, -0.38); body.add(guide);
  guide.add(box(0.02, 0.02, 0.2, steel, 0, 0, -0.1));
  guide.add(mesh(new THREE.TorusGeometry(0.03, 0.01, 5, 10).rotateX(Math.PI / 2), steel, 0, 0, -0.21));
  const cableExit = new THREE.Object3D(); cableExit.position.set(0, 0, -0.21); guide.add(cableExit);

  // service arm on top of the capsule, a little to the right: shoulder (pitch + spread), elbow, gripper
  body.add(box(0.1, 0.04, 0.1, dark, 0.1, 0.18, 0.12));
  const shoulder = new THREE.Group(); shoulder.position.set(0.1, 0.21, 0.12); body.add(shoulder);
  shoulder.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), steel));
  shoulder.add(box(0.045, 0.26, 0.05, steel, 0.02, -0.13, 0));
  const elbow = new THREE.Group(); elbow.position.set(0.02, -0.26, 0); shoulder.add(elbow);
  elbow.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), steel));
  elbow.add(box(0.035, 0.22, 0.04, steel, 0, -0.11, 0));
  elbow.add(box(0.012, 0.18, 0.012, dark, 0.026, -0.1, 0.015)); // hydraulic line
  const wrist = new THREE.Group(); wrist.position.set(0, -0.23, 0); elbow.add(wrist);
  wrist.add(box(0.06, 0.03, 0.04, dark));
  const fingers: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const f = box(0.015, 0.07, 0.02, dark, 0, -0.035, 0); f.geometry.translate(0, -0.035, 0); f.position.set(s * 0.022, -0.01, 0); wrist.add(f); fingers.push(f); }

  // lamp light: rides on the capsule, so it dips and sways with the lean
  const spot = new THREE.SpotLight(0xffb060, 5, 14, 0.6, 0.7, 1.3);
  spot.position.set(0, 0.02, 0.42); spot.castShadow = false;
  const tgt = new THREE.Object3D(); tgt.position.set(0, -0.9, 5); body.add(tgt); spot.target = tgt; body.add(spot);

  return { group, balance, body, wheel, head, spot, cell, reel, guide, cableExit, hitch, arm: { shoulder, elbow, fingers } };
}

export type ArmPose = 'rest' | 'work' | 'reach' | 'back';

/** One frame of what the animation needs, in Three's world space (x, z ground plane). */
export interface WoltFrame {
  dt: number;
  time: number;
  /** Forward speed in m/s. */
  speed: number;
  /** Yaw change in rad/s (Three's rotation.y). */
  yawRate: number;
  /** Forward acceleration in m/s². */
  accel: number;
  /** Driving but not getting anywhere: the cable or a snagged load holds Wolt back. */
  strain: boolean;
  /** Where the held cable leaves towards (world x/z), or null with no cable. */
  cableTo: THREE.Vector3 | null;
  /** 0..1, how hard the cable or the tow rope pulls back. */
  tension: number;
  /** World direction the pull comes from (x, z), length 1, or null. */
  pullFrom: THREE.Vector3 | null;
  /** Reel speed in rad/s: + pays out, - winds in. */
  reelSpin: number;
  arm: ArmPose;
  /** 0..1 */
  energy: number;
  /** Target lamp strength 0..1 (0 = off). */
  lamp: number;
}

const POSES: Record<ArmPose, [number, number, number, number]> = {
  //          shoulder pitch, spread, elbow, grip  (the arm sits on top of the capsule)
  rest: [-1.9, 0.1, 3.3, 0.2],  // folded like a small crane along the top
  work: [-0.9, 0.2, 0.6, 0.45], // down in front, into the scrap
  reach: [-1.6, 0.1, 0.4, 0.55], // forward at socket height
  back: [0.9, 0.15, -0.6, 0.6],  // behind and down, to the hitch
};

/** Balance, wheel, reel, cable guide and arm. Keeps its own springs between frames. */
export class WoltAnimator {
  private pitch = 0; private pitchV = 0;
  private roll = 0; private rollV = 0;
  private wheelA = 0;
  private arm = [...POSES.rest];
  private guideYaw = 0;
  private tmp = new THREE.Vector3();

  constructor(private m: WoltMono) {}

  update(f: WoltFrame) {
    const { dt, time: t } = f;
    const m = this.m;
    const low = 1 - Math.min(1, f.energy * 3); // 0 normally, up to 1 on an almost empty cell

    // ---- balance: lean into turns, lean to accelerate, rock on the spot, give in to the pull
    let tp = THREE.MathUtils.clamp(f.accel * 0.045, -0.22, 0.22) + Math.min(f.speed, 6) * 0.025;
    let tr = THREE.MathUtils.clamp(-f.speed * f.yawRate * 0.05, -0.38, 0.38);
    const still = f.speed < 0.2;
    const rock = (still ? 1 : 0.35) * (1 + low * 2.5);
    tp += (Math.sin(t * 1.7) * 0.022 + Math.sin(t * 3.1 + 1) * 0.01) * rock;
    tr += Math.sin(t * 1.3 + 2) * 0.014 * rock;
    if (f.pullFrom && f.tension > 0) {
      // the pull in local space: +z forward, +x to the right
      const yaw = m.group.rotation.y;
      const lz = f.pullFrom.x * Math.sin(yaw) + f.pullFrom.z * Math.cos(yaw);
      const lx = f.pullFrom.x * Math.cos(yaw) - f.pullFrom.z * Math.sin(yaw);
      tp += lz * f.tension * 0.2;
      tr += -lx * f.tension * 0.14;
    }
    if (f.strain) tp += 0.14 + Math.sin(t * 31) * 0.02; // digging in against the pull
    const k = 70, c = 11;
    this.pitchV += ((tp - this.pitch) * k - this.pitchV * c) * dt; this.pitch += this.pitchV * dt;
    this.rollV += ((tr - this.roll) * k - this.rollV * c) * dt; this.roll += this.rollV * dt;
    m.balance.rotation.set(this.pitch, 0, this.roll);

    // ---- wheel: rolls with the ground, plus the balancing nudges; spins in place on strain
    this.wheelA += (f.speed / WHEEL_R) * dt + this.pitchV * dt * 0.8 + (f.strain ? dt * 9 : 0);
    m.wheel.rotation.x = this.wheelA;

    // ---- reel and cable guide
    m.reel.rotation.x += f.reelSpin * dt;
    let gy = 0;
    if (f.cableTo) {
      const exit = m.guide.getWorldPosition(this.tmp);
      const dx = f.cableTo.x - exit.x, dz = f.cableTo.z - exit.z;
      // the guide points backwards (-z) at 0; aim it at the cable, relative to the body
      gy = Math.atan2(-dx, -dz) - m.group.rotation.y;
      gy = Math.atan2(Math.sin(gy), Math.cos(gy));
      gy = THREE.MathUtils.clamp(gy, -2.3, 2.3);
    }
    this.guideYaw += (gy - this.guideYaw) * Math.min(1, dt * 10);
    m.guide.rotation.y = this.guideYaw;

    // ---- arm
    const p = POSES[f.arm];
    const ease = Math.min(1, dt * 7);
    for (let i = 0; i < 4; i++) this.arm[i] += (p[i] - this.arm[i]) * ease;
    const work = f.arm === 'work';
    const jig = work ? Math.sin(t * 14) * 0.12 : Math.sin(t * 1.1) * 0.02;
    m.arm.shoulder.rotation.set(this.arm[0] + jig, 0, -this.arm[1]);
    m.arm.elbow.rotation.x = this.arm[2] + (work ? Math.sin(t * 14 + 1) * 0.15 : 0);
    const grip = this.arm[3] * (work ? 0.5 + 0.5 * Math.sin(t * 9) : 1);
    m.arm.fingers[0].rotation.z = -grip; m.arm.fingers[1].rotation.z = grip;

    // ---- lamp and cell follow the battery: dim and flickery when nearly empty
    const weak = f.energy < 0.12 ? (Math.sin(t * 23) > 0.6 ? 0.35 : 1) : 1;
    m.spot.intensity += (f.lamp * 5 * weak * (0.55 + 0.45 * Math.min(1, f.energy * 4)) - m.spot.intensity) * Math.min(1, dt * 14);
    (m.head.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + f.lamp * 1.75 * weak;
    (m.cell.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + f.energy * 1.2 + Math.sin(t * 2) * 0.08;
  }
}
