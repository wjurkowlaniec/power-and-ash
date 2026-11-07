import * as THREE from 'three';
import { mat, mesh, box, obstacleMesh } from '../../render/models';
import { Models, fit } from '../../render/assets';
import { PAL } from '../../render/palette';
import { woltMonoModel, WoltMono, WoltAnimator, ArmPose } from '../../render/wolt';
import { loadModel, LoadModel } from '../../render/loads';
import { LOADS } from '../../sim/tow';
import { V2 } from '../../sim/vec';
import { Station, ST_W, ST_H, ROOMS, P, CABLE_MAX } from '../sim/station';
import { Post } from './post';

const CAM_OFFSET = new THREE.Vector3(0, 17, 16);
const WALL_H = 3.0;     // full walls under a roof; a round hole opens around Wolt instead of a cut-away
const ROOF_Y = 3.0;
const HOLE_R = 2.7;     // m, radius of the see-through hole around Wolt
const Q_GREEN = 0x5fe39a;

/**
 * Scene 2 in 3D: the yard and the roofless rooms of Stacja Olszanka in pale overcast
 * light, ash on the ground, fog over the valley. Reads Station every frame.
 */
export class StationView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  readonly post: Post;
  private wolt: WoltMono;
  private anim: WoltAnimator;
  private tyre: LoadModel;
  private bearingOnTyre: THREE.Mesh;
  private bearingOnShelf: THREE.Mesh;
  private greaseOnShelf: THREE.Mesh;
  private rope: THREE.Mesh | null = null;
  private ownCable: THREE.Mesh | null = null;
  private door: THREE.Mesh;
  private portLamp: THREE.MeshStandardMaterial;
  private rotor: THREE.Group;
  private rotorSpeed = 0;
  private camTarget = new THREE.Vector3();
  private prevPos: THREE.Vector3 | null = null;
  private prevYaw = 0; private spd = 0; private acc = 0; private yawRate = 0;
  private gesture: { pose: ArmPose; t: number } | null = null;
  private prevTowing = false;
  private viewSize = 7.5;
  private dust: THREE.Points;
  /** Shared by the building's materials: fragments in front of Wolt inside this circle are dropped. */
  private hole = { uHole: { value: new THREE.Vector2() }, uHoleR: { value: 0 }, uHoleZ: { value: 1 } };
  private holeOpen = 0;
  private cableMesh: THREE.Mesh | null = null;
  private cableKey = '';
  private machineLight!: THREE.PointLight;
  private machineGlass!: THREE.MeshStandardMaterial;
  private socketLamp!: THREE.MeshStandardMaterial;
  private drum!: THREE.Mesh;

  constructor(private st: Station, container: HTMLElement, private models: Models) {
    const r = new THREE.WebGLRenderer({ antialias: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.post = new Post(r);
    this.post.uniforms.uGrey.value = 0;
    this.post.uniforms.uSat.value = 0.6;
    this.post.uniforms.uVignette.value = 0.45;

    const s = this.scene;
    s.background = new THREE.Color(PAL.sky);
    s.fog = new THREE.Fog(PAL.fog, 34, 70);
    s.add(new THREE.HemisphereLight(0xe6e2d8, 0x5f5a52, 1.2));
    const sun = new THREE.DirectionalLight(0xf0ebe0, 1.3);
    sun.position.set(ST_W / 2 - 14, 30, -6); sun.target.position.set(ST_W / 2, 0, ST_H / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: 1, far: 90 });
    sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
    s.add(sun); s.add(sun.target);

    this.buildGround();
    this.buildRooms();
    const d = this.buildWorkshopDoor(); this.door = d.door; this.portLamp = d.lamp;
    this.buildFurniture();
    this.rotor = this.buildMast();
    this.buildYard();
    const sh = this.buildShelf(); this.bearingOnShelf = sh.bearing; this.greaseOnShelf = sh.grease;
    this.buildNotes();
    this.buildPowerLine();

    this.tyre = loadModel('tyre'); s.add(this.tyre.group);
    this.bearingOnTyre = mesh(new THREE.TorusGeometry(0.16, 0.07, 8, 18).rotateX(Math.PI / 2), mat(0x6f7478, { r: 0.4, m: 0.7 }), 0, 0.3, 0);
    this.tyre.group.add(this.bearingOnTyre);

    this.wolt = woltMonoModel();
    const cm = (this.wolt.cell.material as THREE.MeshStandardMaterial).clone();
    cm.emissive.setHex(Q_GREEN); cm.color.setHex(0x0c140f); this.wolt.cell.material = cm;
    this.anim = new WoltAnimator(this.wolt);
    s.add(this.wolt.group);

    this.dust = this.buildDust(); s.add(this.dust);
    this.resize();
    addEventListener('resize', this.onResize);
  }

  private onResize = () => this.resize();
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h); this.post.setSize(w, h);
    const a = w / h, vs = a < 1 ? this.viewSize / a * 0.8 : this.viewSize;
    Object.assign(this.camera, { left: -vs * a, right: vs * a, top: vs, bottom: -vs });
    this.camera.updateProjectionMatrix();
  }
  dispose() {
    removeEventListener('resize', this.onResize);
    this.post.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
  project(p: V2, y = 0): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, y, p.y).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // ---------- building

  private buildGround() {
    const g = new THREE.PlaneGeometry(ST_W + 80, ST_H + 70, 110, 90); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols: number[] = [];
    const c1 = new THREE.Color(PAL.ground), c2 = new THREE.Color(PAL.groundDark), grass = new THREE.Color(0x8d8f7c), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + ST_W / 2, z = p.getZ(i) + ST_H / 2;
      p.setX(i, x); p.setZ(i, z);
      const out = Math.max(0, -x, x - ST_W, -z, z - ST_H);
      // the valley falls away to the south towards the reservoir; low hills elsewhere
      const hill = Math.sin(x * 0.09 + z * 0.05) * 0.9 + Math.sin(x * 0.04 - z * 0.08) * 1.4;
      const k = THREE.MathUtils.smoothstep(out, 0, 8);
      p.setY(i, -0.01 + k * (z > ST_H ? -0.3 - out * 0.08 : 0.8 + hill + out * 0.12));
      const ripple = 0.5 + 0.5 * Math.sin(x * 0.3 + Math.sin(z * 0.2) * 2) * Math.sin(z * 0.27);
      // dry grass shows through the ash away from the buildings
      const g2 = THREE.MathUtils.smoothstep(z, 15, 27) * 0.35 + k * 0.3;
      tmp.copy(c1).lerp(c2, 0.25 * ripple).lerp(grass, g2 * (0.5 + 0.5 * ripple));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    this.scene.add(mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, 0, 0, false));
    // concrete floor slabs inside the building
    const slab = mat(0x8a877f, { r: 0.95 });
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    this.scene.add(mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 10), slab, (x0 + x1) / 2, 0.0, 8, false));
  }

  /** A material for the building that opens a soft round hole around Wolt when he is behind it. */
  private holeMat(color: number, o: { r?: number; m?: number } = {}): THREE.MeshStandardMaterial {
    const m = mat(color, o) as THREE.MeshStandardMaterial;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.hole);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `uniform vec2 uHole; uniform float uHoleR; uniform float uHoleZ;
void main() {
  if (uHoleR > 0.0 && gl_FragCoord.z < uHoleZ) {
    float hd = distance(gl_FragCoord.xy, uHole);
    float n = fract(sin(dot(floor(gl_FragCoord.xy / 2.0), vec2(12.9898, 78.233))) * 43758.5453);
    if (hd < uHoleR * mix(0.82, 1.0, n)) discard;
  }`);
    };
    m.customProgramCacheKey = () => 'hole';
    return m;
  }

  private buildRooms() {
    const s = this.scene;
    const wall = this.holeMat(0x6e6c66, { r: 0.95 }), trim = this.holeMat(0x55534e, { r: 0.9 });
    for (const o of this.st.world.obstacles) {
      if (o.kind !== 'container') continue;
      s.add(box(o.w, WALL_H, o.h, wall, o.x + o.w / 2, WALL_H / 2, o.y + o.h / 2));
    }
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    // lintels over the door gaps
    for (const r of ROOMS) for (const d of r.doors) s.add(box(d.w, 0.8, 1, wall, d.x + d.w / 2, WALL_H - 0.4, r.y + r.h - 0.5));
    // flat roof with an overhang, a parapet and a few things on top
    const roof = this.holeMat(0x5e5d58, { r: 0.95 });
    s.add(box(x1 - x0 + 0.6, 0.22, 10.6, roof, (x0 + x1) / 2, ROOF_Y + 0.11, 8));
    s.add(box(x1 - x0 + 0.6, 0.35, 0.15, trim, (x0 + x1) / 2, ROOF_Y + 0.38, 13.22));
    s.add(box(x1 - x0 + 0.6, 0.35, 0.15, trim, (x0 + x1) / 2, ROOF_Y + 0.38, 2.78));
    // tar-paper seams and moss-grey patches so the roof is not one flat slab
    const seam = this.holeMat(0x3c3b38, { r: 1 }), patch = this.holeMat(0x6f716a, { r: 1 });
    for (let x = x0 + 1.2; x < x1; x += 1.6) s.add(box(0.05, 0.02, 10.4, seam, x, ROOF_Y + 0.23, 8));
    for (const [px, pz, w, d] of [[6, 6, 2.2, 1.6], [17, 10.5, 3, 1.2], [27, 5.5, 1.8, 2.4], [31.5, 11, 2.4, 1]] as const)
      s.add(box(w, 0.015, d, patch, px, ROOF_Y + 0.235, pz));
    const metal = this.holeMat(0x5a5e62, { r: 0.6, m: 0.5 });
    s.add(box(1.2, 0.7, 1.2, metal, 34, ROOF_Y + 0.55, 6));        // machine room vent
    s.add(box(0.5, 0.9, 0.5, metal, 13, ROOF_Y + 0.65, 5));        // workshop flue
    s.add(box(2.4, 0.08, 0.08, metal, 20, ROOF_Y + 0.6, 4.2));     // antenna boom
    s.add(box(0.06, 1.4, 0.06, metal, 20, ROOF_Y + 0.9, 4.2));
    // windows: back wall and the front
    const glass = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.2, metalness: 0.3 });
    this.machineGlass = new THREE.MeshStandardMaterial({ color: 0x8a9396, roughness: 0.2, metalness: 0.3, emissive: 0xffd9a0, emissiveIntensity: 0 });
    for (const x of [3, 12, 19, 26, 33.5]) s.add(box(1.6, 0.9, 0.05, x === 33.5 ? this.machineGlass : glass, x, 2.1, 3.98));
    for (const x of [3, 9.3, 14.6, 21, 23.6, 28.4]) s.add(box(1.3, 0.8, 0.05, glass, x, 1.9, 13.02));
    s.add(box(1.3, 0.8, 0.05, this.machineGlass, 30.8 + 0.6, 1.9, 13.02));
    s.add(box(1.3, 0.8, 0.05, this.machineGlass, 35.4, 2.1, 13.02));
    // under the roof it is dim: a little grey light leaks in through each window
    for (const r of ROOMS) {
      const l = new THREE.PointLight(0xc8ccd0, r.id === 'machine' ? 0 : 3, 7, 1.6);
      l.position.set(r.x + r.w / 2, 2.4, r.y + r.h / 2); s.add(l);
      if (r.id === 'machine') { l.color.setHex(0xffd9a0); this.machineLight = l; }
    }
  }

  private buildPowerLine() {
    const s = this.scene;
    // the cable drum at the mast foot
    this.drum = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16).rotateZ(Math.PI / 2), mat(0x3e3f40, { r: 0.6, m: 0.5 }), P.junction.x, 0.4, P.junction.y);
    s.add(this.drum);
    s.add(box(0.7, 0.08, 0.5, mat(0x2f3133), P.junction.x, 0.04, P.junction.y));
    // the machine room inlet on its yard wall
    s.add(box(0.36, 0.46, 0.08, mat(0x2a2c2e), P.socket.x, 0.9, 13.06));
    this.socketLamp = new THREE.MeshStandardMaterial({ color: 0x220a06, emissive: PAL.off, emissiveIntensity: 0.2 });
    s.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), this.socketLamp, P.socket.x, 1.07, 13.11, false));
  }

  /** Cable from the drum: lies on the ground between bends, rises to Wolt's hand or to the inlet. */
  private updateCable() {
    const st = this.st;
    if (!st.cable) return;
    const pts = st.cable.points();
    let endY = 0.04;
    if (st.cableHeld) {
      const ex = this.wolt.cableExit.getWorldPosition(new THREE.Vector3());
      pts[pts.length - 1] = { x: ex.x, y: ex.z }; endY = ex.y;
    } else if (st.machinePowered) { pts[pts.length - 1] = { x: P.socket.x, y: 13.1 }; endY = 0.9; }
    const key = pts.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(';') + endY.toFixed(2);
    if (key !== this.cableKey) {
      this.cableKey = key;
      const v: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i++) {
        const y = i === 0 ? 0.4 : i === pts.length - 1 ? endY : 0.04;
        v.push(new THREE.Vector3(pts[i].x, y, pts[i].y));
        if (i < pts.length - 1) {
          const a = pts[i], b = pts[i + 1];
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.12, 0.03, a.y + (b.y - a.y) * 0.12));
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.88, 0.03, a.y + (b.y - a.y) * 0.88));
        }
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v, false, 'centripetal'), Math.max(16, v.length * 10), 0.035, 6);
      if (!this.cableMesh) {
        this.cableMesh = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x161818, roughness: 0.7, emissive: PAL.flow, emissiveIntensity: 0 }), 0, 0, 0, true);
        this.scene.add(this.cableMesh);
      } else { this.cableMesh.geometry.dispose(); this.cableMesh.geometry = geo; }
    }
    const m = this.cableMesh!.material as THREE.MeshStandardMaterial;
    const strain = Math.max(0, (st.cableLength() - (CABLE_MAX - 3)) / 3);
    m.emissive.setHex(st.machinePowered ? PAL.flow : PAL.warn);
    m.emissiveIntensity = st.machinePowered ? 0.5 + Math.sin(st.t * 6) * 0.15 : st.cableHeld ? strain * 0.8 : 0;
  }

  private buildWorkshopDoor() {
    const door = box(2, 2.0, 0.12, mat(0x4a5a54, { r: 0.7, m: 0.4 }), 12, 1.0, 12.5);
    this.scene.add(door);
    // the port on the left of the door, outside, with its dead lamp
    const plate = box(0.3, 0.4, 0.06, mat(0x2a2c2e), P.port.x, 0.9, 13.05);
    this.scene.add(plate);
    const lamp = new THREE.MeshStandardMaterial({ color: 0x220a06, emissive: PAL.off, emissiveIntensity: 0.15 });
    this.scene.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), lamp, P.port.x, 1.05, 13.1, false));
    return { door, lamp };
  }

  private buildFurniture() {
    const s = this.scene, m = this.models;
    const dark = mat(0x3a3d40, { r: 0.6, m: 0.4 }), wood = mat(0x6b5f50, { r: 0.95 });
    // fabricator: a squat machine with a dead panel
    s.add(box(2, 1.5, 2, mat(0x4d5257, { r: 0.6, m: 0.5 }), 11, 0.75, 5));
    s.add(box(0.8, 0.4, 0.04, mat(0x0c0d0e, { e: 0x111111 }), 11, 1.05, 6.02));
    s.add(box(1.0, 0.3, 0.8, dark, 11, 1.65, 5));
    // workbench with clutter
    s.add(box(2, 0.85, 1, wood, 14, 0.425, 4.5));
    if (m.has('Parts_Pile_Small')) { const o = fit(m, 'Parts_Pile_Small', 0.8, 0.6); o.position.set(14.2, 0.85, 4.5); s.add(o); }
    // duty room: desk, chair, mug, a jacket on the chair
    s.add(box(2, 0.78, 1, wood, 20, 0.39, 4.5));
    s.add(box(0.5, 0.5, 0.5, dark, 20, 0.25, 5.6));
    s.add(box(0.5, 0.06, 0.4, mat(0x5a4d3e), 20, 0.75, 5.7)); // the jacket, slumped
    s.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), mat(0xb8b2a6), 19.4, 0.83, 4.4));
    // the wall map: a pale sheet with seven dots and a line
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#d8d2c2'; c.fillRect(0, 0, 256, 160);
    c.strokeStyle = '#8a8476'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, 20 + i * 15 + Math.sin(i) * 6); c.bezierCurveTo(80, 10 + i * 16, 170, 40 + i * 12, 256, 25 + i * 15); c.stroke(); }
    const dots = [[30, 110], [62, 92], [95, 100], [128, 76], [160, 84], [190, 62], [222, 70]];
    c.strokeStyle = '#7a2a20'; c.lineWidth = 2.5; c.beginPath(); dots.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    c.fillStyle = '#7a2a20'; for (const [x, y] of dots) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    c.lineWidth = 3; c.beginPath(); c.moveTo(196, 18); c.lineTo(214, 36); c.moveTo(214, 18); c.lineTo(196, 36); c.stroke();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const map = mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 16.56, 1.6, 6.5, false);
    map.rotation.y = Math.PI / 2;
    s.add(map);
    // storage: crates
    if (m.has('Prop_Crate4')) { const o = fit(m, 'Prop_Crate4', 1.8, 1.8); o.position.set(24, 0, 10); s.add(o); }
    else s.add(box(1.8, 1.2, 1.8, wood, 24, 0.6, 10));
    // machine room: switchboard behind, and the fallen cabinet across the doorway
    s.add(box(3, 2.2, 0.6, mat(0x4a4e52, { r: 0.6, m: 0.5 }), 33.5, 1.1, 4.4));
    const cab = box(2.2, 0.7, 0.9, mat(0x5a5e60, { r: 0.6, m: 0.4 }), 33, 0.35, 12.3); cab.rotation.y = 0.12; s.add(cab);
  }

  private buildShelf() {
    const s = this.scene, sh = mat(0x4a4d50, { r: 0.7, m: 0.4 });
    for (const y of [0.05, 0.75, 1.45, 2.1]) s.add(box(6, 0.05, 0.8, sh, 26, y + 0.03, 4.45));
    for (const x of [23.05, 26, 28.95]) s.add(box(0.06, 2.2, 0.8, sh, x, 1.1, 4.45));
    // second shelf: a tin of grease and the heavy bearing
    const grease = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12), mat(0x7a6a30, { r: 0.6, m: 0.3 }), 25.6, 0.85, 4.6);
    const bearing = mesh(new THREE.TorusGeometry(0.16, 0.07, 8, 18).rotateX(Math.PI / 2), mat(0x6f7478, { r: 0.4, m: 0.7 }), 26.4, 0.86, 4.6);
    s.add(grease); s.add(bearing);
    return { grease, bearing };
  }

  /** The measurement mast with the small wind turbine on top. */
  private buildMast(): THREE.Group {
    const s = this.scene, steel = mat(0x5a5e62, { r: 0.5, m: 0.6 });
    const g = new THREE.Group(); g.position.set(P.mast.x, 0, P.mast.y); s.add(g);
    const H = 9;
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const leg = box(0.08, H, 0.08, steel, x * 0.6, H / 2, z * 0.6);
      leg.rotation.set(z * 0.035, 0, -x * 0.035); g.add(leg);
    }
    for (let y = 1; y < H; y += 1.2) g.add(box(0.8, 0.04, 0.04, steel, 0, y, 0.36));
    for (let y = 0.4; y < H - 0.5; y += 0.35) g.add(box(0.3, 0.025, 0.025, mat(0x3a3c3e), 0, y, 0.5)); // ladder rungs
    // nacelle, tail and rotor
    g.add(box(0.3, 0.3, 0.9, mat(0x6a6e70, { r: 0.5, m: 0.5 }), 0, H + 0.1, 0));
    g.add(box(0.03, 0.5, 0.6, steel, 0, H + 0.2, -0.75));
    const rotor = new THREE.Group(); rotor.position.set(0, H + 0.1, 0.5); g.add(rotor);
    rotor.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), steel));
    for (let k = 0; k < 3; k++) {
      const b = box(0.12, 1.5, 0.03, mat(0xbab4a6, { r: 0.8 }), 0, 0.8, 0);
      b.geometry.translate(0, 0, 0);
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI * 2 / 3 + 0.3; arm.add(b); rotor.add(arm);
    }
    // the cracked blade hangs a bit
    (rotor.children[1] as THREE.Group).rotation.x = 0.1;
    // guy wires
    const wireM = new THREE.LineBasicMaterial({ color: 0x3a3c3e });
    for (const [x, z] of [[-4, -3], [4, -3], [0, 4]]) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, H - 1, 0), new THREE.Vector3(x, 0, z)]);
      g.add(new THREE.Line(geo, wireM));
    }
    return rotor;
  }

  private buildYard() {
    const s = this.scene, m = this.models;
    for (const o of this.st.world.obstacles)
      if (['rock', 'scrap', 'barrel', 'tree'].includes(o.kind)) s.add(obstacleMesh(o, m));
    // weather balloon launcher: a hatch on a frame, a limp orange envelope
    s.add(box(2, 0.6, 2, mat(0x50555a, { r: 0.6, m: 0.4 }), 18, 0.3, 25));
    s.add(mesh(new THREE.SphereGeometry(0.7, 12, 8).scale(1, 0.35, 1), mat(0xb0703c, { r: 0.8 }), 18, 0.8, 25));
    // the shed (the ice yacht frame waits inside, for later)
    const sh = P.shed, wood = mat(0x5b5348, { r: 0.95 });
    s.add(box(sh.w, 2.4, sh.h, wood, sh.x + sh.w / 2, 1.2, sh.y + sh.h / 2));
    const roof = box(sh.w + 0.6, 0.12, sh.h + 0.6, mat(0x3f3a34), sh.x + sh.w / 2, 2.6, sh.y + sh.h / 2); roof.rotation.z = 0.08; s.add(roof);
    // a fallen fence along the south
    const fence = mat(0x6b6458, { r: 0.95 });
    for (let x = 2; x < ST_W - 2; x += 2.2) {
      const post = box(0.1, 1.1, 0.1, fence, x, 0.55, ST_H - 0.6); post.rotation.z = Math.sin(x) * 0.25; s.add(post);
      if (Math.sin(x * 3) > -0.3) s.add(box(2.1, 0.06, 0.04, fence, x + 1.1, 0.8 + Math.sin(x) * 0.15, ST_H - 0.6));
    }
    if (m.size) {
      for (let k = 0; k < 40; k++) {
        const x = 1 + ((k * 7.31) % (ST_W - 2)), z = 14.5 + ((k * 3.77) % 12.5);
        if (this.st.world.isBlocked(Math.floor(x), Math.floor(z))) continue;
        const name = k % 3 ? 'Grass_Wispy_Short' : 'Grass_Wispy_Tall';
        if (!m.has(name)) continue;
        const o = fit(m, name, 0.6, 0.6); o.position.set(x, 0, z); o.rotation.y = k; s.add(o);
      }
    }
  }

  private buildNotes() {
    const paper = new THREE.MeshStandardMaterial({ color: 0xe0dccf, roughness: 0.9, emissive: 0xe0dccf, emissiveIntensity: 0.08 });
    // the technician's note on the door frame
    this.scene.add(mesh(new THREE.PlaneGeometry(0.3, 0.4), paper, P.doorNote.x, 1.3, 13.04, false));
    // the drawer front
    this.scene.add(box(0.6, 0.15, 0.05, mat(0x4a4238), 20, 0.55, 5.03));
  }

  private buildDust(): THREE.Points {
    const n = 500, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = Math.random() * ST_W; arr[i * 3 + 1] = Math.random() * 6; arr[i * 3 + 2] = Math.random() * ST_H; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8e3d8, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }));
  }

  // ---------- per frame

  /** Round see-through hole in walls and roof around Wolt while he is inside the building. */
  private updateHole(dt: number) {
    const st = this.st;
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    const inside = st.pos.x > x0 - 0.3 && st.pos.x < x1 + 0.3 && st.pos.y > 2.7 && st.pos.y < 13.4;
    this.holeOpen += ((inside ? 1 : 0) - this.holeOpen) * Math.min(1, dt * 6);
    const v = new THREE.Vector3(st.pos.x, 0.7, st.pos.y).project(this.camera);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const ppm = size.y / (this.camera.top - this.camera.bottom);
    this.hole.uHole.value.set((v.x + 1) / 2 * size.x, (v.y + 1) / 2 * size.y);
    this.hole.uHoleZ.value = (v.z + 1) / 2 - 0.002;
    this.hole.uHoleR.value = this.holeOpen < 0.02 ? 0 : HOLE_R * ppm * this.holeOpen;
  }

  frame(dt: number) {
    const st = this.st, w = this.wolt, t = st.t;

    this.door.position.x = 12 + st.doorOpen * 1.9;
    this.portLamp.emissive.setHex(st.doorOpen > 0 ? PAL.ok : PAL.off);
    this.portLamp.emissiveIntensity = st.plugged > 0 ? 2 : st.doorOpen > 0 ? 0.8 : 0.15 + (Math.sin(t * 3) > 0.9 ? 0.4 : 0);
    this.greaseOnShelf.visible = !st.items.has('grease') && !st.turbine;
    this.bearingOnShelf.visible = !st.shelfTaken;
    this.bearingOnTyre.visible = st.bearingOnTyre;
    this.rotorSpeed += ((st.turbine ? 6 : 0) - this.rotorSpeed) * Math.min(1, dt * 0.4);
    this.rotor.rotation.z += this.rotorSpeed * dt + (st.turbine ? 0 : Math.sin(t * 0.7) * 0.0015);

    // Wolt
    w.group.position.set(st.pos.x, 0, st.pos.y);
    const target = Math.PI / 2 - st.facing;
    let dr = target - w.group.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    w.group.rotation.y += dr * Math.min(1, dt * (st.towing ? 6 : 9));
    w.group.updateMatrixWorld(true);
    const p = w.group.position;
    if (!this.prevPos) { this.prevPos = p.clone(); this.prevYaw = w.group.rotation.y; }
    const sd = dt > 0 ? p.distanceTo(this.prevPos) / dt : 0;
    const ns = this.spd + (sd - this.spd) * Math.min(1, dt * 10);
    this.acc += ((dt > 0 ? (ns - this.spd) / dt : 0) - this.acc) * Math.min(1, dt * 6);
    this.spd = ns;
    let dy = w.group.rotation.y - this.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yawRate += ((dt > 0 ? dy / dt : 0) - this.yawRate) * Math.min(1, dt * 8);
    this.prevPos.copy(p); this.prevYaw = w.group.rotation.y;
    if (st.towing !== this.prevTowing) this.gesture = { pose: 'back', t: 0.8 };
    if (st.plugged > 0) this.gesture = { pose: 'reach', t: 0.2 };
    this.prevTowing = st.towing;
    if (this.gesture && (this.gesture.t -= dt) <= 0) this.gesture = null;
    const arm: ArmPose = st.repair > 0 ? 'work' : st.reading ? 'reach' : this.gesture?.pose ?? 'rest';
    let tension = 0, pullFrom: THREE.Vector3 | null = null;
    if (st.towing && st.towTaut && this.spd > 0.1) {
      tension = LOADS.tyre.drag * (st.bearingOnTyre ? 3 : 1.6);
      pullFrom = new THREE.Vector3(st.tyre.pos.x - st.pos.x, 0, st.tyre.pos.y - st.pos.y).normalize();
    }
    const cableTo = st.plugged > 0 ? new THREE.Vector3(P.port.x, 0, 13.1) : null;
    this.anim.update({
      dt, time: t, speed: this.spd, yawRate: this.yawRate, accel: this.acc,
      strain: false, cableTo, tension, pullFrom, reelSpin: st.plugged > 0 ? 6 : 0, arm,
      energy: st.battery / 100, lamp: 0.6,
      lookAt: (() => { const h = st.hint(); return h ? new THREE.Vector3(h.at.x, 0, h.at.y) : null; })(),
    });
    (w.cell.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.15;

    // the tyre and its rope
    this.tyre.group.position.set(st.tyre.pos.x, st.towing && st.towTaut && this.spd > 0.2 ? Math.abs(Math.sin(t * 23)) * 0.015 : 0, st.tyre.pos.y);
    let tr = (Math.PI / 2 - st.tyre.angle) - this.tyre.group.rotation.y; tr = Math.atan2(Math.sin(tr), Math.cos(tr));
    this.tyre.group.rotation.y += tr * Math.min(1, dt * 8);
    if (this.rope) { this.scene.remove(this.rope); this.rope.geometry.dispose(); this.rope = null; }
    if (st.towing) {
      const a = w.hitch.getWorldPosition(new THREE.Vector3());
      const b = this.tyre.eye.getWorldPosition(new THREE.Vector3());
      const mid = a.clone().lerp(b, 0.5); mid.y = st.towTaut ? (a.y + b.y) / 2 : 0.03;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      this.rope = mesh(new THREE.TubeGeometry(curve, 10, 0.016, 5, false), mat(0x6b6355, { r: 0.9 }), 0, 0, 0, true);
      this.scene.add(this.rope);
    }
    // Wolt's own short cable into the port while it feeds the lock
    if (this.ownCable) { this.scene.remove(this.ownCable); this.ownCable.geometry.dispose(); this.ownCable = null; }
    if (st.plugged > 0) {
      const a = w.cableExit.getWorldPosition(new THREE.Vector3()), b = new THREE.Vector3(P.port.x, 0.9, 13.1);
      const mid = a.clone().lerp(b, 0.5); mid.y = 0.1;
      this.ownCable = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.02, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: PAL.flow, emissiveIntensity: 0.6 }), 0, 0, 0, false);
      this.scene.add(this.ownCable);
    }

    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) {
      let x = dp.getX(i) - dt * (0.6 + (i % 7) * 0.1);
      if (x < -2) x += ST_W + 4;
      dp.setX(i, x); dp.setY(i, dp.getY(i) + Math.sin(t + i) * 0.002);
    }
    dp.needsUpdate = true;

    // the cable and the machine room waking up
    this.updateCable();
    this.drum.rotation.x = st.cable ? -st.cableLength() * 1.8 : 0;
    const pw = st.machinePowered ? Math.min(1, st.poweredT / 2.5) * (st.poweredT < 1.2 ? (Math.random() < 0.5 ? 0.2 : 1) : 1) : 0;
    this.machineLight.intensity = pw * 9;
    this.machineGlass.emissiveIntensity = pw * 0.9;
    this.socketLamp.emissive.setHex(st.machinePowered ? PAL.ok : PAL.off);
    this.socketLamp.emissiveIntensity = st.machinePowered ? 2 : 0.15 + (st.turbine && Math.sin(t * 3) > 0.9 ? 0.5 : 0);

    // camera follows Wolt, kept a little inside the map
    const want = new THREE.Vector3(THREE.MathUtils.clamp(st.pos.x, 7, ST_W - 7), 0, THREE.MathUtils.clamp(st.pos.y, 7, ST_H - 5));
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 2.5));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
    this.updateHole(dt);
    this.post.render(this.scene, this.camera);
  }
}
