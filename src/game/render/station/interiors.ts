import * as THREE from 'three';
import { mat, mesh, box } from '../../../render/models';
import { Models, fit } from '../../../render/assets';
import { PAL } from '../../../render/palette';
import { Station } from '../../sim/station';
import { canvasTex, glow, rng } from './kit';
import { wake } from './wake';

/**
 * What stands under the roof: the workshop with the fabricator, the duty room people left
 * in a hurry (jacket on the chair, mug, a board of notes), the storeroom's racks, the
 * cabinet fallen across the machine room door. Seen through the hole around Wolt.
 */
export class Interiors {
  private fabPanel: THREE.MeshStandardMaterial;
  private deskHalo: THREE.Sprite;
  private screenHalo: THREE.Sprite;
  private bulb: THREE.MeshStandardMaterial;

  constructor(private scene: THREE.Scene, private st: Station, private models: Models) {
    const s = scene;
    const dark = mat(0x3a3d40, { r: 0.6, m: 0.4 });

    // ---- workshop: the fabricator (a frame, a bed, a head on rails), the bench, tools
    this.put('structure_low', 1.9, 1.9, 11, 5, 0, 1.5);
    s.add(box(1.1, 0.06, 1.1, dark, 11, 0.62, 5));
    s.add(box(1.3, 0.05, 0.08, mat(0x55595c, { r: 0.5, m: 0.5 }), 11, 1.18, 5.2));
    s.add(box(0.18, 0.2, 0.18, mat(0x8a5a32, { r: 0.6 }), 10.7, 1.08, 5.2));
    this.fabPanel = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, emissive: PAL.warn, emissiveIntensity: 0 });
    s.add(box(0.7, 0.34, 0.05, dark, 11, 1.0, 6.0)); s.add(mesh(new THREE.BoxGeometry(0.56, 0.22, 0.02), this.fabPanel, 11, 1.0, 6.03, false));
    this.put('table_medium_long', 2, 1, 14, 4.5, 0, 0.85);
    this.put('Parts_Pile_Small', 0.7, 0.5, 14.3, 4.5, 0, undefined, 0.85);
    this.put('Can_A', 0.14, 0.14, 13.5, 4.4, 1, 0.3, 0.85);
    this.put('Parts_Cog', 0.3, 0.3, 13.75, 4.72, 0.5, undefined, 0.85);
    this.put('cabinet_medium', 0.9, 1.9, 15.5, 8, Math.PI / 2, 1.05);
    this.flat('Prop_Cable_1', 1.1, 1.6, 13.2, 10.2, 0.6);

    // ---- duty room: desk with terminal and lamp, chair with a jacket, couch under the wall map
    this.put('table_medium_long', 2, 1, 20, 4.5, 0, 0.78);
    this.put('Prop_Computer', 0.3, 0.3, 19.55, 4.3, 0, 0.52, 0.78);
    this.put('lamp_table', 0.3, 0.3, 20.5, 4.3, 0, 0.42, 0.78);
    this.bulb = new THREE.MeshStandardMaterial({ color: 0x4a463e, emissive: 0xffd9a0, emissiveIntensity: 0 });
    s.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), this.bulb, 20.5, 1.02, 4.3, false));
    this.deskHalo = glow(0xffd9a0, 2.6); this.deskHalo.position.set(20.5, 1.1, 4.5); s.add(this.deskHalo);
    this.screenHalo = glow(PAL.flow, 1.2); this.screenHalo.position.set(19.55, 1.15, 4.5); s.add(this.screenHalo);
    s.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), mat(0xb8b2a6), 20.05, 0.83, 4.62));   // the mug
    const chair = this.put('chair_C', 0.5, 0.5, 19.75, 5.3, Math.PI + 0.35, 1.0);
    const jacket = box(0.46, 0.5, 0.1, mat(0x5a4d3e, { r: 1 }), 0, 0.78, -0.2); jacket.rotation.x = 0.1; chair.add(jacket);   // slumped over the backrest
    s.add(box(0.6, 0.15, 0.05, mat(0x4a4238), 20, 0.55, 5.03));                                          // the drawer front
    this.put('cabinet_small', 0.85, 0.85, 21.5, 4.5, 0, 1.0);
    this.put('couch', 0.95, 1.9, 17.5, 8, Math.PI / 2, 0.8);
    this.flat('rug_rectangle_A', 2.4, 1.7, 19.5, 7.6, 0.05);
    this.wallMap();
    this.noteBoard();
    this.bookshelf();

    // ---- storeroom: racks along the far wall, pallets and cargo
    const rack = mat(0x4a4d50, { r: 0.7, m: 0.4 });
    for (const y of [0.05, 0.75, 1.45, 2.1]) s.add(box(6, 0.05, 0.8, rack, 26, y + 0.03, 4.45));
    for (const x of [23.05, 24.5, 26, 27.5, 28.95]) for (const z of [4.08, 4.82]) s.add(box(0.05, 2.2, 0.05, rack, x, 1.1, z));
    const r = rng(9), goods = ['Box_A', 'cargo_A', 'cargo_B', 'Box_A', 'containers_A'];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
      const x = 23.5 + k * 0.82 + (r() - 0.5) * 0.2;
      if (r() < 0.3 || (row === 1 && Math.abs(x - 26) < 0.7)) continue;   // gaps, and room for the module on the second shelf
      const size = 0.4 + r() * 0.2;
      this.put(goods[Math.floor(r() * goods.length)], size, size, x, 4.45, Math.round(r() * 3) * Math.PI / 2 + (r() - 0.5) * 0.3, undefined, 0.1 + row * 0.7);
    }
    if (models.has('Prop_Crate4')) this.put('Prop_Crate4', 1.8, 1.8, 24, 10);
    this.put('Pallet_Small', 1.7, 1.7, 29, 10, 0.08);
    this.put('cargo_A_stacked', 1.3, 1.3, 29.1, 10.1, 0.3, undefined, 0.2);
    this.put('Barrel_A', 0.6, 0.6, 28.4, 9.3, 1);

    // ---- machine room: the cabinet fallen across its doorway
    const cab = new THREE.Group(); cab.position.set(33, 0.36, 12.3); cab.rotation.set(0, 0.12, 0.05);
    cab.add(box(2.2, 0.7, 0.9, mat(0x5a5e60, { r: 0.6, m: 0.4 })));
    for (const x of [-0.55, 0.55]) cab.add(box(1.0, 0.03, 0.8, mat(0x4a4e50, { r: 0.6, m: 0.4 }), x, 0.36, 0));
    for (const x of [-0.08, 0.08]) cab.add(box(0.03, 0.05, 0.3, mat(0x8a8780, { r: 0.5, m: 0.6 }), x, 0.39, 0));
    s.add(cab);
  }

  private put(name: string, w: number, d: number, x: number, z: number, rot = 0, h?: number, y = 0) {
    const o = fit(this.models, name, w, d, h, rot);
    o.position.set(x, y, z); this.scene.add(o);
    return o;
  }
  /** Something lying flat on the floor slab: drawn, but it throws no shadow. */
  private flat(name: string, w: number, d: number, x: number, z: number, rot: number) {
    this.put(name, w, d, x, z, rot, undefined, 0.03).traverse(c => { c.castShadow = false; });
  }

  /** The wall map: a pale sheet with seven dots and a line, one more dot crossed out. */
  private wallMap() {
    const tex = canvasTex(256, 160, c => {
      c.fillStyle = '#d8d2c2'; c.fillRect(0, 0, 256, 160);
      c.strokeStyle = '#8a8476'; c.lineWidth = 1;
      for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, 20 + i * 15 + Math.sin(i) * 6); c.bezierCurveTo(80, 10 + i * 16, 170, 40 + i * 12, 256, 25 + i * 15); c.stroke(); }
      const dots = [[30, 110], [62, 92], [95, 100], [128, 76], [160, 84], [190, 62], [222, 70]];
      c.strokeStyle = '#7a2a20'; c.lineWidth = 2.5; c.beginPath(); dots.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      c.fillStyle = '#7a2a20'; for (const [x, y] of dots) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
      c.lineWidth = 3; c.beginPath(); c.moveTo(196, 18); c.lineTo(214, 36); c.moveTo(214, 18); c.lineTo(196, 36); c.stroke();
    });
    const map = mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 17.03, 1.7, 6.3, false);
    map.rotation.y = Math.PI / 2;
    this.scene.add(map);
  }

  /** The board by the window: duty rosters nobody reads any more, and a child's drawing. */
  private noteBoard() {
    const s = this.scene, x = 20.9, y = 1.55, z = 4.03;
    s.add(box(1.3, 0.85, 0.03, mat(0x6a5a44, { r: 1 }), x, y, z));
    const r = rng(21), tints = [0xe0dccf, 0xd6d0bd, 0xcfd3cc, 0xe3d9b8];
    for (let k = 0; k < 7; k++) {
      const w = 0.2 + r() * 0.12, h = 0.24 + r() * 0.1;
      const p = mesh(new THREE.PlaneGeometry(w, h), mat(tints[k % tints.length], { r: 1 }), x - 0.5 + (k % 4) * 0.33 + (r() - 0.5) * 0.06, y + (k < 4 ? 0.18 : -0.2) + (r() - 0.5) * 0.06, z + 0.02 + k * 0.001, false);
      p.rotation.z = (r() - 0.5) * 0.25; s.add(p);
    }
    const kid = canvasTex(64, 64, c => {
      c.fillStyle = '#e6e0d0'; c.fillRect(0, 0, 64, 64); c.lineWidth = 2.5; c.lineCap = 'round';
      c.strokeStyle = '#6b7a55'; c.beginPath(); c.moveTo(4, 54); c.lineTo(60, 52); c.stroke();
      c.strokeStyle = '#7a4a3a'; c.strokeRect(14, 30, 22, 22); c.beginPath(); c.moveTo(12, 30); c.lineTo(25, 16); c.lineTo(38, 30); c.stroke();
      c.strokeStyle = '#b8903a'; c.beginPath(); c.arc(49, 14, 7, 0, 7); c.stroke();
      c.strokeStyle = '#4a5560'; c.beginPath(); c.arc(48, 40, 4, 0, 7); c.moveTo(48, 44); c.lineTo(48, 50); c.arc(48, 53, 3, -1.5, 4.7); c.stroke();   // a small one-wheeled robot
    });
    s.add(mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: kid, roughness: 1 }), x + 0.42, y - 0.2, z + 0.03, false));
  }

  /** The duty room's bookshelf: faded spines, some leaning. */
  private bookshelf() {
    const s = this.scene, shelfM = mat(0x4a4238, { r: 0.9 });
    s.add(box(0.9, 1.9, 2.9, shelfM, 21.5, 0.95, 9.5));
    const spines = [0x6b5a48, 0x5a6058, 0x7a6a52, 0x54504a, 0x6e5f5a];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) {
      const h = 0.32 + ((k * 7 + row) % 4) * 0.04;
      const b = box(0.3, h, 0.22, mat(spines[(k + row) % spines.length], { r: 0.95 }), 21.05, 0.3 + row * 0.6 + h / 2, 8.3 + k * 0.29);
      if ((k + row * 2) % 5 === 4) b.rotation.x = 0.16;
      s.add(b);
    }
  }

  update(t: number) {
    const st = this.st, pt = st.machinePowered ? st.poweredT : -1;
    const duty = pt < 0 ? 0 : wake(pt, 'duty', 2), shop = pt < 0 ? 0 : wake(pt, 'workshop', 2);
    this.bulb.emissiveIntensity = duty * 2.2;
    this.deskHalo.material.opacity = duty * 0.3;
    this.screenHalo.material.opacity = duty * (0.2 + 0.05 * Math.sin(t * 3));
    // the fabricator is ready but nothing asks it for anything yet: a slow amber breath
    this.fabPanel.emissiveIntensity = shop * (0.7 + 0.5 * Math.sin(t * 1.6));
  }
}
