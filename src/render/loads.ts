import * as THREE from 'three';
import { mat, mesh, box } from './models';
import { Load, LoadKind, LOADS } from '../sim/tow';

/** Things Wolt can tow. Facing +z (the rope eye is at the front, +z). */
export interface LoadModel {
  group: THREE.Group;
  eye: THREE.Object3D;
  /** What tilts and shudders while dragged (the group itself only moves and turns). */
  body: THREE.Group;
  /** 0..1, eased: how much it is being dragged right now. */
  drag: number;
}

export function loadModel(kind: LoadKind): LoadModel {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const r = LOADS[kind].radius;
  const eye = new THREE.Object3D();
  if (kind === 'tyre') {
    // an old truck tyre lying flat, a loop of wire through it
    g.add(mesh(new THREE.TorusGeometry(r - 0.13, 0.13, 8, 22).rotateX(Math.PI / 2), mat(0x1c1c1c, { r: 0.95 }), 0, 0.13, 0));
    g.add(mesh(new THREE.TorusGeometry(r - 0.13, 0.135, 3, 22).rotateX(Math.PI / 2).scale(1, 0.25, 1), mat(0x2a2a28, { r: 1 }), 0, 0.2, 0));
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), mat(0x55595c, { r: 0.5, m: 0.5 }), 0, 0.16, r - 0.02));
    eye.position.set(0, 0.16, r);
  } else {
    // a small sled: two runners, a plank deck, a stack of faded bricks
    const wood = mat(0x6b5f50, { r: 0.95 }), brick = mat(0x6f5046, { r: 0.95 }), brick2 = mat(0x7a5a4c, { r: 0.95 });
    for (const x of [-0.26, 0.26]) {
      g.add(box(0.06, 0.06, 0.86, mat(0x3a3530), x, 0.03, 0));
      g.add(box(0.06, 0.06, 0.12, mat(0x3a3530), x, 0.07, 0.43)); // runner tips bend up
    }
    g.add(box(0.66, 0.04, 0.8, wood, 0, 0.09, 0));
    let k = 0;
    for (let layer = 0; layer < 3; layer++)
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 3; j++) {
          const b = box(0.24, 0.08, 0.11, (k++ % 3) ? brick : brick2, (i - 0.5) * 0.26, 0.15 + layer * 0.085, (j - 1) * 0.2 + (layer % 2) * 0.03);
          b.rotation.y = (Math.sin(k * 7.1) * 0.06);
          g.add(b);
        }
    g.add(box(0.5, 0.03, 0.03, mat(0x3a3530), 0, 0.09, 0.42));
    eye.position.set(0, 0.09, 0.44);
  }
  g.add(eye);
  return { group: root, eye, body: g, drag: 0 };
}

/**
 * A dragged load: the rope lifts its front a little and it judders over the ground; it
 * eases into that and settles back when the pull stops, instead of jumping between the two.
 */
export function animateDragged(m: LoadModel, l: Load, dragged: boolean, t: number, dt: number) {
  m.drag += ((dragged ? 1 : 0) - m.drag) * Math.min(1, dt * (dragged ? 6 : 3));
  const k = m.drag, ph = l.id.length * 1.7;
  const lift = l.kind === 'tyre' ? 0.09 : 0.04;
  // smooth noise, not a sawtooth: two sines at odd rates
  const n1 = Math.sin(t * 13 + ph) * 0.6 + Math.sin(t * 21.7 + ph * 2) * 0.4;
  const n2 = Math.sin(t * 9.3 + ph * 3) * 0.6 + Math.sin(t * 17.1) * 0.4;
  m.body.rotation.x = -k * (lift + n1 * 0.025);
  m.body.rotation.z = k * n2 * 0.03;
  // lifted about the back edge, so the back does not sink into the ground
  m.body.position.y = k * (LOADS[l.kind].radius * lift + Math.abs(n1) * 0.008);
}

/** Tow rope from the hitch `a` to the load's eye `b`: straight when taut, sagging onto the ground when slack. */
export function ropeGeometry(a: THREE.Vector3, b: THREE.Vector3, ropeLen: number): THREE.TubeGeometry {
  const slack = Math.max(0, ropeLen - a.distanceTo(b));
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(0.02, (a.y + b.y) / 2 - slack * 1.1);
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 14, 0.016, 5, false);
}
