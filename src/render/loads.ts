import * as THREE from 'three';
import { mat, mesh, box } from './models';
import { LoadKind, LOADS } from '../sim/tow';

/** Things Wolt can tow. Facing +z (the rope eye is at the front, +z). */
export interface LoadModel { group: THREE.Group; eye: THREE.Object3D }

export function loadModel(kind: LoadKind): LoadModel {
  const g = new THREE.Group();
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
  return { group: g, eye };
}
