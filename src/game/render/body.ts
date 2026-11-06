import * as THREE from 'three';
import { mat, mesh, box } from '../../render/models';

/**
 * Body stage 1: the monocycle (docs/SWIAT.md, "Ciała i transfer"). One wheel, a narrow
 * upright frame with a battery cassette on the back, a camera head with a lamp, two
 * thin service arms. Facing +z in local space.
 */
export interface BodyModel {
  group: THREE.Group;   // position + yaw
  balance: THREE.Group; // lean and wobble (pivot at the wheel's contact point)
  wheel: THREE.Mesh;
  eye: THREE.Mesh;
  cassette: THREE.Mesh; // lights up when the battery is in
  spot: THREE.SpotLight;
  arms: THREE.Mesh[];
  /** A faint light from the camera eye, so the body reads in the dark. */
  glow: THREE.PointLight;
}

export const WHEEL_R = 0.3;

export function bodyModel(qColor: number): BodyModel {
  const group = new THREE.Group();
  const balance = new THREE.Group(); group.add(balance);
  const frameM = mat(0x4a5155, { r: 0.5, m: 0.5 }), dark = mat(0x151718, { r: 0.8 }), accent = mat(0x7a5634, { r: 0.6 });

  const wheel = mesh(new THREE.TorusGeometry(WHEEL_R - 0.06, 0.07, 10, 28).rotateY(Math.PI / 2), dark, 0, WHEEL_R, 0);
  wheel.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 12).rotateZ(Math.PI / 2), frameM));
  for (let k = 0; k < 3; k++) { const sp = box(0.03, WHEEL_R * 1.6, 0.03, frameM); sp.rotation.x = k * Math.PI / 3; wheel.add(sp); }
  balance.add(wheel);
  // fork and upright frame
  for (const x of [-0.1, 0.1]) balance.add(box(0.04, 0.42, 0.06, frameM, x, WHEEL_R + 0.18, 0));
  balance.add(box(0.3, 0.6, 0.22, frameM, 0, WHEEL_R + 0.62, -0.02));
  balance.add(box(0.32, 0.06, 0.24, accent, 0, WHEEL_R + 0.9, -0.02));
  // battery cassette on the back
  const cassette = mesh(new THREE.BoxGeometry(0.2, 0.3, 0.06), new THREE.MeshStandardMaterial({ color: 0x0c140f, emissive: qColor, emissiveIntensity: 0 }), 0, WHEEL_R + 0.6, -0.15, false);
  balance.add(cassette);
  // neck and camera head
  balance.add(box(0.05, 0.16, 0.05, frameM, 0, WHEEL_R + 1.0, 0));
  const head = box(0.26, 0.16, 0.2, frameM, 0, WHEEL_R + 1.14, 0.02); balance.add(head);
  const eye = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 0.1 }), 0.05, WHEEL_R + 1.14, 0.13, false);
  balance.add(eye);
  // thin arms
  const arms: THREE.Mesh[] = [];
  for (const x of [-0.19, 0.19]) { const a = box(0.04, 0.4, 0.04, frameM, x, WHEEL_R + 0.5, 0.06); a.geometry.translate(0, -0.18, 0); a.position.y += 0.18; balance.add(a); arms.push(a); }
  const spot = new THREE.SpotLight(0xffb060, 0, 14, 0.6, 0.7, 1.3);
  spot.position.set(0, WHEEL_R + 1.14, 0.15);
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 5); balance.add(tgt); spot.target = tgt; balance.add(spot);
  const glow = new THREE.PointLight(0xe8e2d4, 0, 3.5, 1.5);
  glow.position.set(0, WHEEL_R + 1.3, 0.3); balance.add(glow);
  return { group, balance, wheel, eye, cassette, spot, arms, glow };
}
