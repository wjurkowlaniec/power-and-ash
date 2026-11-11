import * as THREE from 'three';
import { mat, mesh, box, obstacleMesh } from '../../../render/models';
import { Models, fit } from '../../../render/assets';
import { Station, ST_W, ST_H, P, FENCE_WEST_Y, FENCE_EAST_Y } from '../../sim/station';
import { glow, groundRibbon, rng } from './kit';
import { WIND } from './atmosphere';
import { Crows, windSock, anemometer, cupSpeed } from './life';
import { wake } from './wake';

export const FENCE_Z = ST_H - 0.1;   // right on the map edge, so Wolt cannot roll through the pickets
const GATE_W = 2.6;
const GATE_AJAR = -0.16, GATE_OPEN = -1.85; // rad, the leaf swings outwards (south)
const MAST_H = 9;
const LAMP = 0xffe2b8;

/** Puddles in the yard: ellipses (x, z, rx, rz). The wheel comes out of them wet. */
export const PUDDLES: [number, number, number, number][] = [[9.6, 18.4, 1.3, 0.8], [29.2, 15.9, 1.0, 0.6], [15.5, 23.6, 0.9, 0.55]];
export const inPuddle = (x: number, z: number) => PUDDLES.some(([px, pz, rx, rz]) => ((x - px) / rx) ** 2 + ((z - pz) / rz) ** 2 < 1);

/**
 * The yard of the station: the measuring mast with its turbine, wind sock and floodlight,
 * the balloon launcher, the locked shed, the iron fence with its gate, paths trodden into
 * the ash, dry grass (it sways in batch.ts), crows. Reads Station, changes nothing in it.
 */
export class Yard {
  private rotor!: THREE.Group;
  private rotorSpeed = 0;
  private head!: THREE.Group;
  private cups!: THREE.Group;
  private sock = windSock();
  private crows!: Crows;
  private gate!: THREE.Group;
  private gateV = 0;
  private envelope!: THREE.Mesh;
  private flap!: THREE.Group;
  private flood!: { lens: THREE.MeshStandardMaterial; halo: THREE.Sprite; light: THREE.SpotLight };

  constructor(private scene: THREE.Scene, private st: Station, private models: Models) {
    this.paths();
    this.mast();
    this.launcher();
    this.shed();
    this.fence();
    this.scatter();
    for (const o of st.world.obstacles)
      if (['rock', 'scrap', 'barrel', 'tree'].includes(o.kind)) scene.add(obstacleMesh(o, models));
  }

  private put(name: string, w: number, d: number, x: number, z: number, rot = 0, h?: number, y = 0) {
    const o = fit(this.models, name, w, d, h, rot);
    o.position.set(x, y, z); this.scene.add(o);
    return o;
  }

  /** Where people walked for years: door to gate, a branch to the mast, another to the shed. */
  private paths() {
    const s = this.scene, col = 0x86827a;
    s.add(groundRibbon([[25.4, 14.8], [25.0, 18.2], [24.6, 22.5], [25.2, FENCE_Z + 0.4]], 1.5, col, 0.36));
    s.add(groundRibbon([[24.7, 21.6], [23.3, 22.6], [20.8, 23.1]], 1.1, col, 0.3));
    s.add(groundRibbon([[25.0, 19.2], [28, 20.2], [30.6, 21]], 1.1, col, 0.3));
    s.add(groundRibbon([[6, 14.8], [9, 16.4], [14.6, 17.4], [19, 17.2], [24.6, 17.6]], 1.2, col, 0.26));
    // a few flagstones somebody once laid towards the gate, half under the ash now
    const stones: [string, number, number, number][] = [['path_A', 25.2, 15.9, 0.3], ['path_C', 24.9, 19.6, 1.9], ['path_D', 24.7, 23.4, 4.1], ['path_C', 25.1, 26.2, 2.6]];
    for (const [n, x, z, r] of stones) { const o = this.put(n, 1.5, 1.5, x, z, r, undefined, -0.035); o.traverse(c => { c.castShadow = false; }); }
    for (const [x, z, rx, rz] of PUDDLES) {
      const g = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + Math.sin(a * 3 + x) * 0.12 + Math.sin(a * 5 + z) * 0.07; p.setX(i, p.getX(i) * rx * k); p.setZ(i, p.getZ(i) * rz * k); }
      const m = mesh(g, new THREE.MeshStandardMaterial({ color: 0x5c6162, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.86, emissive: 0x6c7274, emissiveIntensity: 0.16, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), x, 0.012, z, false);
      s.add(m);
    }
  }

  /** The measurement mast: lattice, a small turbine that turns into the wind, instruments, a floodlight. */
  private mast() {
    const s = this.scene, steel = mat(0x5a5e62, { r: 0.5, m: 0.6 }), dark = mat(0x3a3c3e, { r: 0.6, m: 0.4 });
    const g = new THREE.Group(); g.position.set(P.mast.x, 0, P.mast.y); s.add(g);
    const H = MAST_H, legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const at = (k: number, y: number) => 0.36 * (1 - y / H * 0.55) * k;   // the mast narrows towards the top
    for (const [x, z] of legs) {
      const leg = box(0.07, H, 0.07, steel, (at(x, 0) + at(x, H)) / 2, H / 2, (at(z, 0) + at(z, H)) / 2);
      leg.rotation.set(Math.atan2(at(z, H) - at(z, 0), H), 0, -Math.atan2(at(x, H) - at(x, 0), H)); g.add(leg);
    }
    // rings and zig-zag bracing on all four sides
    for (let y = 0.9, i = 0; y < H; y += 1.15, i++) {
      for (let k = 0; k < 4; k++) {
        const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4];
        const a = new THREE.Vector3(at(ax, y), y, at(az, y)), b = new THREE.Vector3(at(bx, y), y, at(bz, y));
        g.add(strut(a, b, 0.03, steel));
        if (y + 1.15 < H) {
          const c = new THREE.Vector3(at(i % 2 ? ax : bx, y + 1.15), y + 1.15, at(i % 2 ? az : bz, y + 1.15));
          g.add(strut(i % 2 ? b : a, c, 0.022, dark));
        }
      }
    }
    for (const [x, z] of legs) g.add(box(0.3, 0.12, 0.3, mat(0x6f6d67, { r: 1 }), at(x, 0), 0.06, at(z, 0)));
    // the head: nacelle, tail vane and rotor, turning on the mast top to face the wind
    const head = new THREE.Group(); head.position.y = H + 0.12; head.userData.live = true; g.add(head);
    head.rotation.y = Math.atan2(-WIND.x, -WIND.z);
    head.add(mesh(new THREE.CapsuleGeometry(0.15, 0.6, 4, 10).rotateX(Math.PI / 2), mat(0x6a6e70, { r: 0.5, m: 0.5 })));
    head.add(box(0.02, 0.05, 0.7, steel, 0, 0.02, -0.75));
    const vane = new THREE.Shape(); vane.moveTo(0, 0); vane.lineTo(-0.5, 0.28); vane.lineTo(-0.62, 0.28); vane.lineTo(-0.5, -0.2); vane.closePath();
    const vm = mesh(new THREE.ShapeGeometry(vane).rotateY(Math.PI / 2), mat(0x8a8780, { r: 0.8 }), 0, 0.02, -0.6);
    (vm.material as THREE.Material).side = THREE.DoubleSide; head.add(vm);
    const rotor = new THREE.Group(); rotor.position.set(0, 0, 0.52); head.add(rotor);
    rotor.add(mesh(new THREE.ConeGeometry(0.11, 0.26, 10).rotateX(Math.PI / 2), steel, 0, 0, 0.06));
    for (let k = 0; k < 3; k++) {
      const bg = new THREE.BoxGeometry(0.2, 1.55, 0.03, 1, 6);
      const p = bg.attributes.position;
      // a blade: wide at the root, narrow and twisted flat at the tip
      for (let i = 0; i < p.count; i++) { const u = (p.getY(i) + 0.775) / 1.55; p.setX(i, p.getX(i) * (1 - u * 0.68) + u * 0.03); p.setZ(i, p.getZ(i) + (1 - u) * p.getX(i) * 0.5); }
      bg.translate(0, 0.86, 0); bg.computeVertexNormals();
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI * 2 / 3 + 0.3;
      arm.add(mesh(bg, mat(0xbab4a6, { r: 0.8 }))); rotor.add(arm);
    }
    (rotor.children[2] as THREE.Group).rotation.x = 0.1;   // the cracked blade hangs a bit
    this.rotor = rotor; this.head = head;
    // guy wires
    const wireM = new THREE.LineBasicMaterial({ color: 0x3a3c3e });
    for (const [x, z] of [[-4, -3], [4, -3], [0, 4]])
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, H - 1, 0), new THREE.Vector3(x, 0, z)]), wireM));
    // instruments on a boom: anemometer, a thermometer screen, the wind sock lower down
    g.add(box(1.5, 0.035, 0.035, steel, 0.45, 6.2, 0));
    this.cups = anemometer(steel, dark); this.cups.position.set(1.15, 6.32, 0); g.add(this.cups);
    for (let k = 0; k < 4; k++) g.add(box(0.26, 0.03, 0.26, mat(0xcfcabd, { r: 0.9 }), -0.26, 6.02 - k * 0.07, 0));
    g.add(box(0.7, 0.03, 0.03, steel, 0.5, 4.5, 0.2));
    this.sock.group.position.set(0.86, 4.5, 0.2); g.add(this.sock.group);
    // the yard floodlight on its own pole at the mast foot, dead until the station wakes
    const fl = this.put('lights', 1.0, 1.0, P.mast.x - 0.78, P.mast.y - 0.72, 2.2, 3.6);
    const lens = new THREE.MeshStandardMaterial({ color: 0x3a3833, emissive: LAMP, emissiveIntensity: 0 });
    const lx = fl.position.x, lz = fl.position.z;
    s.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), lens, lx, 3.5, lz, false));
    const halo = glow(LAMP, 7); halo.position.set(lx, 3.5, lz + 0.3); s.add(halo);
    const light = new THREE.SpotLight(LAMP, 0, 26, 0.95, 0.8, 1.2);
    light.position.set(lx, 3.9, lz); light.target.position.set(lx + 1.5, 0, lz + 4.5);
    s.add(light); s.add(light.target);
    this.flood = { lens, halo, light };
  }

  /** The weather balloon launcher: an open hatch, a limp envelope that the wind keeps trying. */
  private launcher() {
    const s = this.scene, x = 18, z = 25;
    const paint = mat(0x565b5f, { r: 0.6, m: 0.4 }), dark = mat(0x2f3133, { r: 0.7, m: 0.3 });
    s.add(mesh(new THREE.CylinderGeometry(0.92, 1.0, 0.55, 8), paint, x, 0.275, z));
    s.add(mesh(new THREE.TorusGeometry(0.86, 0.05, 6, 8).rotateX(Math.PI / 2), dark, x, 0.56, z));
    s.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.04, 8), dark, x, 0.5, z, false));
    for (const sgn of [-1, 1]) {   // the two hatch lids, thrown open and leaning out
      const lid = new THREE.Group(); lid.position.set(x + sgn * 0.9, 0.56, z); lid.rotation.z = -sgn * 2.0;
      lid.add(box(0.84, 0.05, 1.5, paint, -sgn * 0.42, 0, 0));
      lid.add(box(0.7, 0.03, 1.3, dark, -sgn * 0.42, -0.035, 0));
      s.add(lid);
    }
    const cloth = mat(0xa9683a, { r: 0.9 });
    this.envelope = mesh(new THREE.SphereGeometry(0.62, 14, 9), cloth, x - 0.05, 0.62, z + 0.05);
    this.envelope.scale.set(1, 0.4, 0.92); this.envelope.userData.live = true; s.add(this.envelope);
    // a tongue of the envelope hangs over the rim and flaps
    this.flap = new THREE.Group(); this.flap.userData.live = true; this.flap.position.set(x - 0.5, 0.66, z - 0.3); this.flap.rotation.y = Math.atan2(-WIND.z, WIND.x);
    const fg = new THREE.PlaneGeometry(0.9, 0.5, 6, 1).rotateX(-Math.PI / 2).translate(0.45, 0, 0);
    const fm = mesh(fg, cloth); (fm.material as THREE.Material).side = THREE.DoubleSide; this.flap.add(fm); s.add(this.flap);
    // helium bottles in a rack beside it
    for (let k = 0; k < 3; k++) this.put('Can_A', 0.26, 0.26, x + 0.72 + (k % 2) * 0.04, z + 0.42 + k * 0.24, k, 0.9);
    s.add(box(0.36, 0.05, 0.86, dark, x + 0.74, 0.5, z + 0.66));
  }

  /** The service shed: a prefabricated garage module, shutter down, padlocked. */
  private shed() {
    const sh = P.shed, cx = sh.x + sh.w / 2, cz = sh.y + sh.h / 2;
    this.put('basemodule_garage', sh.w - 0.3, sh.h - 0.3, cx, cz, Math.PI);
    // stuff left leaning on it
    this.put('Pallet_Small', 1.1, 1.1, sh.x + 0.9, sh.y + sh.h - 0.35, 0.1).rotation.x = -1.25;
    this.put('Barrel_A', 0.6, 0.6, sh.x + sh.w - 0.7, sh.y + sh.h - 0.5, 1);
  }

  /** Iron pickets along the south and round the corners; the gate stands ajar. */
  private fence() {
    const s = this.scene, r = rng(31), gx = P.gate.x;
    const run = (x0: number, z0: number, x1: number, z1: number, broken: number[]) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 2), rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const o = fit(this.models, broken.includes(i) ? 'fence_seperate_broken' : 'fence_seperate', len / n, 0.3);
        const g = new THREE.Group(); g.add(o);
        g.position.set(x0 + (x1 - x0) * u, -0.03, z0 + (z1 - z0) * u); g.rotation.y = rot;
        // years of wind: every panel leans its own way
        o.rotation.x = (r() - 0.5) * 0.22; o.rotation.z = (r() - 0.5) * 0.05;
        s.add(g);
      }
    };
    run(0.2, FENCE_Z, gx - GATE_W / 2, FENCE_Z, [2, 7]);
    run(gx + GATE_W / 2, FENCE_Z, ST_W - 0.2, FENCE_Z, [4]);
    run(0.2, FENCE_Z, 0.2, FENCE_WEST_Y, [3]);
    run(ST_W - 0.2, FENCE_EAST_Y, ST_W - 0.2, FENCE_Z, [0]);
    for (const x of [gx - GATE_W / 2, gx + GATE_W / 2, 0.2, ST_W - 0.2]) this.put('fence_pillar', 0.3, 0.3, x, FENCE_Z);
    this.gate = new THREE.Group(); this.gate.userData.live = true; this.gate.position.set(gx - GATE_W / 2 + 0.12, 0, FENCE_Z);
    const leaf = fit(this.models, 'fence_seperate', GATE_W - 0.3, 0.3); leaf.position.x = (GATE_W - 0.3) / 2;
    this.gate.add(leaf); this.gate.rotation.y = GATE_AJAR; s.add(this.gate);
  }

  /** Dry grass, a few bushes, pebbles, and the crows. */
  private scatter() {
    const s = this.scene, m = this.models, r = rng(12), st = this.st;
    const free = (x: number, z: number) => x > 0.6 && x < ST_W - 0.6 && z > 14.9 && z < FENCE_Z - 0.4
      && !st.world.isBlocked(Math.floor(x), Math.floor(z)) && !inPuddle(x, z) && Math.hypot(x - P.tyre.x, z - P.tyre.y) > 1.2;
    // grass grows in tufts, thicker away from the door and the paths
    for (let k = 0; k < 46; k++) {
      const cx = 1 + r() * (ST_W - 2), cz = 15.2 + r() * 12, n = 1 + Math.floor(r() * 4);
      for (let j = 0; j < n; j++) {
        const x = cx + (r() - 0.5) * 1.6, z = cz + (r() - 0.5) * 1.6;
        if (!free(x, z) || Math.abs(x - 25) < 1.1) continue;
        const tall = r() < 0.3, size = (tall ? 0.75 : 0.55) * (0.8 + r() * 0.5);
        const o = fit(m, tall ? 'Grass_Wispy_Tall' : 'Grass_Wispy_Short', size, size);
        o.position.set(x, 0, z); o.rotation.y = r() * 6.28; o.userData.sway = true; s.add(o);
      }
    }
    for (const [x, z, sc] of [[3.2, 27.0, 1.5], [12.6, 27.2, 1.2], [37.8, 26.6, 1.6], [38.6, 19.4, 1.3], [1.4, 17.2, 1.2], [29.6, 27.1, 1.1]] as const) {
      const o = fit(m, 'Bush_Common', sc, sc); o.position.set(x, 0, z); o.rotation.y = x; s.add(o);
    }
    const pebbles = ['Pebble_Round_2', 'Pebble_Round_4', 'Pebble_Square_1', 'Pebble_Square_3', 'Pebble_Square_5'];
    for (let k = 0; k < 60; k++) {
      const x = 0.8 + r() * (ST_W - 1.6), z = 15 + r() * 12.4, size = 0.1 + r() * 0.16;
      if (!free(x, z)) continue;
      const o = fit(m, pebbles[k % pebbles.length], size, size); o.position.set(x, -0.01, z); o.rotation.y = r() * 6.28; s.add(o);
    }
    this.crows = new Crows([
      new THREE.Vector3(19.4, 0.98, FENCE_Z), new THREE.Vector3(20.3, 0.98, FENCE_Z), new THREE.Vector3(30.6, 0.98, FENCE_Z),
      new THREE.Vector3(18.7, 0.6, 25.75), new THREE.Vector3(15.2, 3.52, 13.22), new THREE.Vector3(27.3, 3.52, 13.22),
    ]);
    s.add(this.crows.group);
  }

  update(dt: number, t: number) {
    const st = this.st;
    // the rotor always turns in the wind: the fault is electrical, not mechanical
    this.rotorSpeed += ((st.turbine ? 6 : 4) * (0.85 + 0.15 * Math.sin(t * 0.7)) - this.rotorSpeed) * Math.min(1, dt * 0.4);
    this.rotor.rotation.z += this.rotorSpeed * dt;
    this.head.rotation.y = Math.atan2(-WIND.x, -WIND.z) + Math.sin(t * 0.31) * 0.12 + Math.sin(t * 0.83) * 0.04;
    this.cups.rotation.y -= cupSpeed(t) * dt;
    this.sock.update(t);
    this.crows.update(dt, t, st.pos);
    // the gate: a soft spring, so it swings open ahead of Wolt and rocks to rest
    const want = st.leaving > 0 ? GATE_OPEN : GATE_AJAR + Math.sin(t * 0.9) * 0.03;
    this.gateV += ((want - this.gate.rotation.y) * 14 - this.gateV * 3.2) * dt;
    this.gate.rotation.y += this.gateV * dt;
    // the balloon envelope breathes and its loose end flaps
    const gust = 0.55 + 0.45 * Math.sin(t * 0.7 - 5.2);
    this.envelope.scale.y = 0.36 + gust * 0.1 + Math.sin(t * 4.3) * 0.012;
    this.envelope.rotation.z = Math.sin(t * 1.9) * 0.05 * gust;
    const fp = (this.flap.children[0] as THREE.Mesh).geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setY(i, -x * x * 0.45 * (1.2 - gust) + Math.sin(t * 7 - x * 6) * 0.06 * x * gust); }
    fp.needsUpdate = true;
    const k = st.machinePowered ? wake(st.poweredT, 'yard') : 0;
    this.flood.lens.emissiveIntensity = k * 3; this.flood.halo.material.opacity = k * 0.28; this.flood.light.intensity = k * 60;
  }
}

/** A thin bar between two points. */
function strut(a: THREE.Vector3, b: THREE.Vector3, w: number, m: THREE.Material): THREE.Mesh {
  const o = box(w, a.distanceTo(b), w, m);
  o.position.copy(a).lerp(b, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return o;
}
