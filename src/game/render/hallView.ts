import * as THREE from 'three';
import { cableTube } from './cableTube';
import { mat, mesh, box } from '../../render/models';
import { woltMonoModel, WoltMono, WoltAnimator, ArmPose } from '../../render/wolt';
import { Models, fit } from '../../render/assets';
import { V2 } from '../../sim/vec';
import { Hall, HALL_W, HALL_H, layout, PRY_TIME, INSERT_TIME, WAKE_TIME } from '../sim/hall';
import { Post } from './post';

const CAM_OFFSET = new THREE.Vector3(0, 15, 15);
const WALL_H = 3.4;
const Q_GREEN = 0x5fe39a;

/**
 * Scene 1 in 3D: a dark concrete hall seen from above at an angle (the south wall is a
 * low cut-away lip). Pale light falls through one high window; the only colour is the
 * Q-1 battery's green pulse in the glass test chamber. Reads Hall every frame.
 */
export class HallView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  readonly post: Post;
  private wolt: WoltMono;
  private anim: WoltAnimator;
  private glow = new THREE.PointLight(0xe8e2d4, 0, 3.5, 1.5);
  private prevPos: THREE.Vector3 | null = null;
  private prevYaw = 0;
  private spd = 0;
  private acc = 0;
  private yawRate = 0;
  private reelSpin = 0;
  private prevTether = 0;
  private tetherMesh: THREE.Mesh | null = null;
  private tetherKey = '';
  private droppedTether = false;
  private camTarget = new THREE.Vector3();
  private battery: THREE.Group;
  private batteryMat: THREE.MeshStandardMaterial;
  private qLight: THREE.PointLight;
  private chamberEdges: THREE.MeshStandardMaterial;
  private frontGlass: THREE.Mesh;
  private leverArm: THREE.Group;
  private pipe: THREE.Mesh;
  private door: THREE.Group;
  private doorLight: THREE.SpotLight;
  private screenTex: THREE.CanvasTexture;
  private screenCtx: CanvasRenderingContext2D;
  private screenOn = 0;
  private beamMat: THREE.MeshBasicMaterial;
  private dust: THREE.Points;
  private hemi: THREE.HemisphereLight;
  private ripples: { m: THREE.Mesh; t: number }[] = [];
  private viewSize = 5.2;

  constructor(private hall: Hall, container: HTMLElement, private models: Models) {
    const r = new THREE.WebGLRenderer({ antialias: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.post = new Post(r);

    const s = this.scene;
    s.background = new THREE.Color(0x050606);
    s.fog = new THREE.Fog(0x0a0b0b, 24, 46);
    this.hemi = new THREE.HemisphereLight(0x9aa3a6, 0x1a1816, 0.32);
    s.add(this.hemi);

    this.buildRoom();
    this.beamMat = this.buildWindowLight();
    this.buildCradle();
    const ch = this.buildChamber();
    this.battery = ch.battery; this.batteryMat = ch.batteryMat; this.qLight = ch.light;
    this.chamberEdges = ch.edges; this.frontGlass = ch.front; this.leverArm = ch.lever;
    const sc = this.buildDesk();
    this.screenTex = sc.tex; this.screenCtx = sc.ctx;
    this.buildCables();
    this.buildClutter();
    const d = this.buildDoor(); this.door = d.door; this.doorLight = d.light;
    this.buildPuddle();

    this.pipe = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 10), new THREE.MeshStandardMaterial({ color: 0x5a4a3e, roughness: 0.6, metalness: 0.5, emissive: 0xd8dccf, emissiveIntensity: 0 }));
    this.pipe.rotation.z = Math.PI / 2; this.pipe.rotation.y = 0.4;
    s.add(this.pipe);

    // notes: pale sheets of paper on the floor
    for (const n of layout.notes) {
      const sheet = mesh(new THREE.PlaneGeometry(0.28, 0.38).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.9, emissive: 0xd9d6cc, emissiveIntensity: 0.12 }), n.x, 0.012, n.y, false);
      sheet.rotation.y = n.x * 1.7;
      s.add(sheet);
    }
    this.wolt = woltMonoModel();
    this.anim = new WoltAnimator(this.wolt);
    // the cell window stays dark until the battery is in; then it shows the Q-1 green
    const cm = (this.wolt.cell.material as THREE.MeshStandardMaterial).clone();
    cm.emissive.setHex(Q_GREEN); cm.color.setHex(0x0c140f); this.wolt.cell.material = cm;
    this.glow.position.set(0, 0.5, 0.4); this.wolt.body.add(this.glow);
    s.add(this.wolt.group);

    this.dust = this.buildDust(); s.add(this.dust);
    this.resize();
    addEventListener('resize', this.onResize);
  }

  private onResize = () => this.resize();

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    const a = w / h;
    const vs = a < 1 ? this.viewSize / a * 0.8 : this.viewSize;
    Object.assign(this.camera, { left: -vs * a, right: vs * a, top: vs, bottom: -vs });
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    removeEventListener('resize', this.onResize);
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Ground point → screen px. */
  project(p: V2, y = 0): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, y, p.y).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // ---------- building

  private buildRoom() {
    const s = this.scene;
    // concrete floor with stains (vertex colours)
    const g = new THREE.PlaneGeometry(HALL_W + 1, HALL_H + 1, 60, 44); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const cols: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + HALL_W / 2, z = p.getZ(i) + HALL_H / 2;
      p.setX(i, x); p.setZ(i, z);
      const n = Math.sin(x * 1.7 + Math.sin(z * 0.9) * 2) * Math.sin(z * 1.3 - x * 0.4) * 0.5 + 0.5;
      const stain = Math.exp(-((x - 7) ** 2 + (z - 8.2) ** 2) / 6);
      c.setRGB(0.24, 0.24, 0.23).multiplyScalar(0.75 + n * 0.3 - stain * 0.25);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const floor = mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 0, 0, 0, false);
    s.add(floor);
    // floor seams every 4 m
    const seam = mat(0x141515);
    for (let x = 4; x < HALL_W; x += 4) s.add(mesh(new THREE.PlaneGeometry(0.03, HALL_H).rotateX(-Math.PI / 2), seam, x, 0.005, HALL_H / 2, false));

    const wall = mat(0x2b2c2b, { r: 1 });
    const T = 0.5;
    const win = layout.window;
    // north wall with a window hole (x win.x..win.x+w, y 1.7..3.0)
    s.add(box(win.x, WALL_H, T, wall, win.x / 2, WALL_H / 2, -T / 2));
    s.add(box(HALL_W - win.x - win.w, WALL_H, T, wall, (win.x + win.w + HALL_W) / 2, WALL_H / 2, -T / 2));
    s.add(box(win.w, 1.7, T, wall, win.x + win.w / 2, 0.85, -T / 2));
    s.add(box(win.w, WALL_H - 3.0, T, wall, win.x + win.w / 2, (3.0 + WALL_H) / 2, -T / 2));
    // window frame and mullions
    const frame = mat(0x161717);
    for (let k = 0; k <= 4; k++) s.add(box(0.06, 1.3, 0.1, frame, win.x + k * win.w / 4, 2.35, -0.05));
    s.add(box(win.w, 0.06, 0.1, frame, win.x + win.w / 2, 2.35, -0.05));
    // west wall
    s.add(box(T, WALL_H, HALL_H + T, wall, -T / 2, WALL_H / 2, HALL_H / 2 - T / 2));
    // east wall with a door gap (y 4.5..6.5)
    s.add(box(T, WALL_H, 4.5 + T, wall, HALL_W + T / 2, WALL_H / 2, 4.5 / 2 - T / 2));
    s.add(box(T, WALL_H, HALL_H - 6.5 + T, wall, HALL_W + T / 2, WALL_H / 2, (6.5 + HALL_H) / 2 + T / 2));
    s.add(box(T, WALL_H - 2.6, 2, wall, HALL_W + T / 2, (2.6 + WALL_H) / 2, 5.5));
    // south wall: a low cut-away lip
    s.add(box(HALL_W + T * 2, 0.35, T, wall, HALL_W / 2, 0.175, HALL_H + T / 2));
    // roof beams catch a little light at the top of the walls
    const beam = mat(0x1c1d1d);
    for (let x = 2; x < HALL_W; x += 4) s.add(box(0.25, 0.35, 0.6, beam, x, WALL_H - 0.2, 0.05));
  }

  /** Pale daylight through the high window: a shadowed spot light plus a soft beam. */
  private buildWindowLight(): THREE.MeshBasicMaterial {
    const s = this.scene, win = layout.window;
    const light = new THREE.SpotLight(0xdfe4e6, 140, 40, 0.42, 0.65, 1.4);
    light.position.set(win.x + win.w / 2 - 1.2, 9.5, -5);
    light.target.position.set(win.x + win.w / 2 - 0.2, 0, 5.2);
    light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.0008; light.shadow.radius = 5;
    s.add(light); s.add(light.target);
    // the beam: a stretched, additive quad from the window to the floor
    const geo = new THREE.BufferGeometry();
    const x0 = win.x, x1 = win.x + win.w;
    const top = [[x0, 3.0, 0], [x1, 3.0, 0], [x0, 1.7, 0], [x1, 1.7, 0]];
    const bot = [[x0 + 0.5, 0.02, 6.4], [x1 + 0.5, 0.02, 6.4], [x0 + 0.5, 0.02, 3.6], [x1 + 0.5, 0.02, 3.6]];
    const pos: number[] = [], al: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[], ta: number, tb: number) => {
      pos.push(...a, ...b, ...c, ...b, ...d, ...c); al.push(ta, ta, tb, ta, tb, tb);
    };
    quad(top[0], top[1], bot[0], bot[1], 1, 0.15);
    quad(top[2], top[3], bot[2], bot[3], 1, 0.15);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(al.flatMap(a => [a, a, a]), 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xcfd6d8, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    s.add(new THREE.Mesh(geo, m));
    // the window glass itself
    s.add(mesh(new THREE.PlaneGeometry(win.w, 1.3), new THREE.MeshBasicMaterial({ color: 0x9fa7aa, transparent: true, opacity: 0.85, fog: false }), win.x + win.w / 2, 2.35, -0.2, false));
    return m;
  }

  private buildCradle() {
    const L = layout.cradle, s = this.scene;
    const g = new THREE.Group(); g.position.set(L.x + L.w / 2, 0, L.y + L.h / 2); s.add(g);
    const dark = mat(0x26343a, { r: 0.6, m: 0.5 }), pad = mat(0x4a3a2e, { r: 1 });
    g.add(box(L.w, 0.3, L.h, dark, 0, 0.15, 0));
    const bed = box(1.2, 0.12, 2.4, pad, 0.1, 0.55, 0); bed.rotation.z = 0.18; g.add(bed);
    g.add(box(0.12, 1.9, 0.12, dark, -0.85, 0.95, -1.35));
    g.add(box(0.12, 1.9, 0.12, dark, -0.85, 0.95, 1.35));
    g.add(box(0.12, 0.12, 2.8, dark, -0.85, 1.9, 0));
    // dead indicator lamps
    for (let k = 0; k < 3; k++) g.add(box(0.08, 0.08, 0.04, mat(0x3a1a14, { e: 0x2a0a06, ei: 0.4 }), -0.78, 1.5 - k * 0.15, -1.3));
    // hanging, disconnected cable
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.85, 1.85, 0.6), new THREE.Vector3(-0.4, 1.1, 0.75), new THREE.Vector3(0.1, 0.7, 0.9), new THREE.Vector3(0.6, 0.05, 1.6)]);
    g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.035, 6), mat(0x111213)));
  }

  private buildChamber() {
    const L = layout.chamber, s = this.scene;
    const g = new THREE.Group(); g.position.set(L.x + L.w / 2, 0, L.y + L.h / 2); s.add(g);
    const dark = mat(0x1a1c1d, { r: 0.5, m: 0.6 });
    g.add(box(L.w, 0.35, L.h, dark, 0, 0.175, 0));
    // hazard stripes on the base (faded yellow, grey in reserve mode)
    const stripe = mat(0x8a7434, { r: 0.8 });
    for (let k = 0; k < 6; k++) { const st = box(0.22, 0.2, 0.02, stripe, -L.w / 2 + 0.3 + k * 0.5, 0.2, L.h / 2 + 0.01); st.rotation.z = 0.6; g.add(st); }
    // open top: only a rim, so the battery is visible from above
    for (const z of [-1, 1]) g.add(box(L.w, 0.14, 0.14, dark, 0, 2.75, z * (L.h / 2 - 0.07)));
    for (const x of [-1, 1]) g.add(box(0.14, 0.14, L.h, dark, x * (L.w / 2 - 0.07), 2.75, 0));
    g.add(box(0.14, 0.14, L.h, dark, 0, 2.75, 0));
    const edges = new THREE.MeshStandardMaterial({ color: 0x0d1210, emissive: Q_GREEN, emissiveIntensity: 0.25, roughness: 0.6 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.1, 2.4, 0.1, edges, x * (L.w / 2 - 0.05), 1.55, z * (L.h / 2 - 0.05)));
    const glassM = new THREE.MeshStandardMaterial({ color: 0x9ab3a8, transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.2, depthWrite: false });
    const side = (w: number, x: number, z: number, ry: number) => { const m = mesh(new THREE.PlaneGeometry(w, 2.4), glassM, x, 1.55, z, false); m.rotation.y = ry; g.add(m); return m; };
    side(L.w, 0, -L.h / 2, 0); side(L.h, -L.w / 2, 0, Math.PI / 2); side(L.h, L.w / 2, 0, Math.PI / 2);
    const front = side(L.w - 0.1, 0, L.h / 2, 0);
    // the arm holding the battery
    g.add(box(0.12, 0.9, 0.12, dark, 0, 2.2, 0));
    const battery = new THREE.Group(); battery.position.set(0, 1.45, 0); g.add(battery);
    const batteryMat = new THREE.MeshStandardMaterial({ color: 0x0f1a14, emissive: Q_GREEN, emissiveIntensity: 1.4, roughness: 0.4 });
    battery.add(mesh(new THREE.BoxGeometry(0.42, 0.62, 0.3), mat(0x1d2420, { r: 0.4, m: 0.6 }), 0, 0, 0));
    battery.add(mesh(new THREE.BoxGeometry(0.3, 0.46, 0.32), batteryMat, 0, 0, 0, false));
    battery.add(mesh(new THREE.PlaneGeometry(0.16, 0.24), new THREE.MeshBasicMaterial({ color: 0xd8e4dc }), 0, 0.02, 0.165, false));
    const light = new THREE.PointLight(Q_GREEN, 6, 9, 1.6);
    light.position.set(0, 1.4, 0.4); g.add(light);
    // cables from the base
    const lever = new THREE.Group();
    lever.position.set(-L.w / 2 - 0.08, 1.1, 0.5);
    g.add(box(0.06, 0.5, 0.35, dark, -L.w / 2 - 0.04, 1.1, 0.5));
    const arm = box(0.07, 0.6, 0.07, mat(0x5b2a20, { r: 0.6 }), 0, 0.3, 0); lever.add(arm);
    lever.add(box(0.12, 0.12, 0.12, mat(0x2a1512), 0, 0.6, 0));
    lever.rotation.z = 0.25;
    g.add(lever);
    return { battery, batteryMat, light, edges, front, lever };
  }

  private buildDesk() {
    const s = this.scene, D = layout.desk;
    const g = new THREE.Group(); g.position.set(D.x + D.w / 2, 0, D.y + D.h / 2); s.add(g);
    const dark = mat(0x1e2021, { r: 0.7, m: 0.4 });
    g.add(box(D.w, 0.08, D.h, dark, 0, 0.9, 0));
    for (const x of [-1, 1]) g.add(box(0.08, 0.9, D.h - 0.1, dark, x * (D.w / 2 - 0.1), 0.45, 0));
    g.add(box(1.2, 0.8, 0.12, dark, 0.2, 1.4, -0.3));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#050706'; ctx.fillRect(0, 0, 256, 160);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const screen = mesh(new THREE.PlaneGeometry(1.05, 0.66), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0.2, 1.4, -0.235, false);
    g.add(screen);
    if (this.models.has('Prop_Computer')) { const c = fit(this.models, 'Prop_Computer', 0.7, 0.5); c.position.set(-0.8, 0.94, 0); g.add(c); }
    return { screen, tex, ctx };
  }

  private buildCables() {
    const s = this.scene, C = layout.chamber;
    const m = mat(0x101112, { r: 0.7 });
    const cx = C.x + C.w / 2;
    const run = (pts: [number, number][]) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.045, z)));
      s.add(mesh(new THREE.TubeGeometry(curve, 48, 0.045, 6), m, 0, 0, 0, false));
    };
    run([[cx - 0.6, C.y + C.h - 0.1], [cx - 2.4, 7.4], [5.5, 7.6], [3.4, 6.6], [2.9, 6.2]]);   // to the cradle
    run([[cx + 0.6, C.y + 0.1], [12.6, 2.6], [13.2, 2.1]]);                                     // to the desk
    run([[cx + 1.2, C.y + 1.6], [13.5, 4.4], [15.2, 3.6], [15.9, 3.2]]);                        // into the wall
    run([[cx, C.y + 0.1], [10.2, 1.8], [10.6, 0.2]]);
  }

  private buildClutter() {
    const s = this.scene, m = this.models;
    const shelf = mat(0x232526, { r: 0.8, m: 0.3 });
    const shelves = (x0: number, w: number) => {
      for (const y of [0.05, 0.75, 1.45, 2.1]) s.add(box(w, 0.05, 0.8, shelf, x0 + w / 2, y + 0.03, 0.45));
      for (const x of [x0 + 0.05, x0 + w - 0.05]) s.add(box(0.06, 2.2, 0.8, shelf, x, 1.1, 0.45));
    };
    shelves(0, 4); shelves(6, 2);
    const put = (name: string, w: number, d: number, x: number, z: number, ry = 0, y = 0) => {
      if (!m.has(name)) { s.add(box(w, w, d, mat(0x2a2b2a), x, w / 2 + y, z)); return; }
      const o = fit(m, name, w, d, undefined, ry); o.position.set(x, y, z); s.add(o);
    };
    put('Prop_Crate3', 0.8, 0.6, 0.9, 0.45, 0, 0.8);
    put('Prop_Chest', 0.9, 0.6, 2.6, 0.45, 0, 1.5);
    put('Parts_Pile_Small', 0.7, 0.6, 6.9, 0.45, 0, 0.8);
    put('Prop_Crate4', 1.6, 1.6, 15.0, 9.0, 0.1);
    put('Prop_Crate3', 1.1, 1.1, 14.6, 10.3, -0.3);
    put('Prop_Barrel_Large', 0.8, 0.8, 0.6, 9.6);
    put('Prop_Barrel_Large', 0.8, 0.8, 1.4, 10.3);
    put('Fuel_A_Barrel_Dirty', 0.7, 0.7, 0.55, 10.4, 1.2);
    put('Column_MetalSupport', 0.5, 0.5, 0.3, 3.2);
    put('Column_MetalSupport', 0.5, 0.5, 15.7, 7.4);
    put('Prop_Vent_Big', 1.4, 0.3, 12.0, 0.18, 0, 2.2);
    put('Pallet_Wood', 1.2, 0.9, 6.6, 10.2, 0.25);
    put('Prop_Light_Floor', 0.4, 0.4, 8.4, 2.4);
  }

  private buildDoor() {
    const s = this.scene;
    const hinge = new THREE.Group(); hinge.position.set(HALL_W + 0.25, 0, 4.5); s.add(hinge);
    const slab = box(0.18, 2.55, 2, mat(0x3a4a44, { r: 0.7, m: 0.5 }), 0, 1.275, 1); hinge.add(slab);
    hinge.add(box(0.06, 0.08, 0.5, mat(0x5a2c22), -0.13, 1.2, 1.7));
    // daylight outside, only visible when the door opens
    const light = new THREE.SpotLight(0xd8dcdc, 0, 16, 0.6, 0.8, 1.2);
    light.position.set(HALL_W + 5, 3, 5.5); light.target.position.set(HALL_W - 3, 0, 5.5);
    s.add(light); s.add(light.target);
    s.add(mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), mat(0x8c8982), HALL_W + 3.5, -0.01, 5.5, false));
    return { door: hinge, light };
  }

  private buildPuddle(): THREE.Mesh {
    const P = layout.puddle;
    const p = mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.05, metalness: 0.6 }), P.x, 0.008, P.y, false);
    p.scale.set(1.4, 1, 0.8);
    this.scene.add(p);
    return p;
  }

  private buildDust(): THREE.Points {
    const n = 160, arr = new Float32Array(n * 3), win = layout.window;
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      arr[i * 3] = win.x + Math.random() * win.w + t * 0.5;
      arr[i * 3 + 1] = 0.2 + (1 - t) * 2.6 + Math.random() * 0.4;
      arr[i * 3 + 2] = t * 5.8 + Math.random() * 0.6;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe6e6e0, size: 0.03, transparent: true, opacity: 0.45, depthWrite: false }));
  }

  // ---------- per frame

  /** The diagnostic cable: a dark tube along the cable's bends, with a faint green glow on each pulse. */
  private updateTether(pulse: number) {
    const h = this.hall;
    const pts = h.tether ? h.tether.points() : null;
    if (!pts) {
      // after the battery goes in, the cable drops where it lay
      if (this.tetherMesh && !this.droppedTether) {
        this.droppedTether = true;
        (this.tetherMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      }
      return;
    }
    const ex = this.wolt.cableExit.getWorldPosition(new THREE.Vector3());
    pts[pts.length - 1] = { x: ex.x, y: ex.z };
    const key = pts.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(';');
    if (key !== this.tetherKey) {
      this.tetherKey = key;
      const v: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i++) {
        const y = i === 0 ? 0.3 : i === pts.length - 1 ? this.wolt.cableExit.getWorldPosition(new THREE.Vector3()).y : 0.04;
        v.push(new THREE.Vector3(pts[i].x, y, pts[i].y));
        if (i < pts.length - 1) {
          const a = pts[i], b = pts[i + 1];
          // lies on the floor between bends
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.15, 0.03, a.y + (b.y - a.y) * 0.15));
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.85, 0.03, a.y + (b.y - a.y) * 0.85));
        }
      }
      const geo = cableTube(v, 0.03);
      if (!this.tetherMesh) {
        this.tetherMesh = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x141616, roughness: 0.7, emissive: Q_GREEN, emissiveIntensity: 0 }), 0, 0, 0, false);
        this.scene.add(this.tetherMesh);
      } else { this.tetherMesh.geometry.dispose(); this.tetherMesh.geometry = geo; }
    }
    const m = this.tetherMesh!.material as THREE.MeshStandardMaterial;
    const pull = Math.max(0, (h.tetherLength() - 6) / 3);
    m.emissiveIntensity = 0.05 + pulse * 0.25 + pull * 0.2;
  }

  /** A drop hit the puddle (the scene calls this when the sound plays). */
  ripple() {
    const P = layout.puddle;
    const m = mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a9294, transparent: true, opacity: 0.4, depthWrite: false }), P.x + (Math.random() - 0.5) * 1.2, 0.012, P.y + (Math.random() - 0.5) * 0.5, false);
    m.scale.setScalar(0.02);
    this.scene.add(m); this.ripples.push({ m, t: 0 });
  }

  /** Show the corrupted log on the test stand screen; 0 = off. */
  setScreen(on: number, text: string) {
    if (Math.abs(on - this.screenOn) < 0.01 && on === 0) return;
    this.screenOn = on;
    const c = this.screenCtx;
    c.fillStyle = '#050706'; c.fillRect(0, 0, 256, 160);
    if (on > 0) {
      c.globalAlpha = on;
      c.fillStyle = '#7fe0a4'; c.font = '15px "IBM Plex Mono", monospace';
      text.split('\n').forEach((l, i) => c.fillText(l, 14 + (Math.random() < 0.1 ? 3 : 0), 34 + i * 24));
      for (let y = 0; y < 160; y += 3) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, y, 256, 1); }
      c.globalAlpha = 1;
    }
    this.screenTex.needsUpdate = true;
  }

  frame(dt: number, pulse: number) {
    const h = this.hall, L = layout, w = this.wolt;
    const t = h.t;

    // the battery: glows with the pulse; after insertion it is in Wolt's chest
    const glow = 0.5 + pulse * 1.6;
    const inHand = h.insertT > 0 && h.insertT / INSERT_TIME > 0.35;
    this.battery.visible = !h.powered && !inHand;
    this.batteryMat.emissiveIntensity = glow;
    this.qLight.intensity = h.powered ? 0.5 : 2.5 + pulse * 8;
    this.chamberEdges.emissiveIntensity = h.powered ? 0.04 : 0.12 + pulse * 0.25;
    void inHand;
    this.frontGlass.position.y = 1.55 + h.chamberOpen * 2.35;
    this.leverArm.rotation.z = h.leverDown ? -1.9 : 0.25 - Math.min(1, h.pry / PRY_TIME) * 0.6 + (h.pry > 0 ? Math.sin(t * 40) * 0.03 : 0);
    this.door.rotation.y = -h.doorOpen * 1.4;
    this.doorLight.intensity = h.doorOpen * 60;
    this.beamMat.opacity = 0.07 + Math.sin(t * 0.3) * 0.015;

    // pipe: on the floor, in Wolt's hand, or wedged in the lever
    // after a bare-handed try at the lever, the pipe glints now and then to show where help lies
    (this.pipe.material as THREE.MeshStandardMaterial).emissiveIntensity = h.pipeDown && h.leverTried ? Math.max(0, Math.sin(t * 2.2)) ** 6 * 0.9 : 0;
    if (h.pipeDown) { this.pipe.visible = true; this.pipe.position.set(h.pipeDown.x, 0.05, h.pipeDown.y); this.pipe.rotation.set(0, 0.4, Math.PI / 2); }
    else if (h.hasPipe) {
      this.pipe.visible = true;
      // carried in the gripper, sticking forward over the nose
      const f = h.facing, side = { x: -Math.sin(f), y: Math.cos(f) };
      this.pipe.position.set(h.pos.x + Math.cos(f) * 0.45 - side.x * 0.1, 0.95, h.pos.y + Math.sin(f) * 0.45 - side.y * 0.1);
      this.pipe.rotation.set(0, -f, Math.PI / 2 - 0.15);
    } else if (h.leverDown) {
      this.pipe.visible = true; this.pipe.position.set(L.lever.x - 0.35, 0.05, L.lever.y + 0.5); this.pipe.rotation.set(0, 1.1, Math.PI / 2);
    }

    // the body (shared monocycle model): turns only towards where it rolls
    const target = Math.PI / 2 - h.facing;
    let dr = target - w.group.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    w.group.rotation.y += dr * Math.min(1, dt * (h.powered ? 9 : 4));
    const k = THREE.MathUtils.smoothstep(h.wake, 0, 1);
    const rest = { x: L.cradle.x + 1.2, y: 0.3, z: L.cradle.y + 1.5 };
    if (!h.awake) w.group.position.set(THREE.MathUtils.lerp(rest.x, h.pos.x, k), THREE.MathUtils.lerp(rest.y, 0, Math.min(1, k * 1.6)), THREE.MathUtils.lerp(rest.z, h.pos.y, k));
    else w.group.position.set(h.pos.x, 0, h.pos.y);
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

    // the diagnostic cable pulls the body back towards the chamber near its end
    const tl = h.tetherLength();
    const reelWant = dt > 0 && h.tether ? ((tl - this.prevTether) / dt) / 0.11 : 0;
    this.reelSpin += (reelWant - this.reelSpin) * Math.min(1, dt * 12);
    this.prevTether = tl;
    let tension = 0, pullFrom: THREE.Vector3 | null = null, cableTo: THREE.Vector3 | null = null;
    if (h.tether) {
      const last = h.tether.last;
      cableTo = new THREE.Vector3(last.x, 0, last.y);
      tension = Math.max(0, (tl - 6.5) / 2.5);
      if (tension > 0) pullFrom = new THREE.Vector3(last.x - h.pos.x, 0, last.y - h.pos.y).normalize();
    }
    const arm: ArmPose = h.pry > 0 ? 'work' : h.insertT > 0 || h.hasPipe ? 'reach' : h.reading ? 'reach' : 'rest';
    const pk = Math.min(1, h.poweredT / 3);
    this.anim.update({
      dt, time: t, speed: this.spd, yawRate: this.yawRate, accel: this.acc,
      strain: !!h.tether && tl > 8.85 && h.moving === false && this.spd < 0.05 && tension > 0.9,
      cableTo, tension, pullFrom, reelSpin: this.reelSpin, arm,
      // reserve: the body's own 4% (shaky, dim); with the battery: Q-1 charge
      energy: h.powered ? h.battery / 100 : h.reserve / 100, lamp: h.powered ? pk : 0,
      lookAt: (() => { const n = h.hint(); return n && h.awake ? new THREE.Vector3(n.at.x, 0, n.at.y) : null; })(),
    });
    if (!h.awake) {
      // slumped back in the cradle, then the jolt of rolling off
      w.balance.rotation.x = (1 - k) * -0.5 + (h.wake > 0 && h.wake < 0.6 ? Math.sin(t * 24) * 0.05 : 0);
      w.balance.rotation.z = h.wake > 0 ? Math.sin(k * 9) * 0.25 * (1 - k) : 0;
    }
    // indoors the lamp needs more punch than outside; the cell window shows the battery once it is in
    w.spot.intensity = h.powered ? pk * 22 : 0;
    (w.cell.material as THREE.MeshStandardMaterial).emissiveIntensity = h.powered ? 0.9 + pulse * 0.6 : 0;
    (w.head.material as THREE.MeshStandardMaterial).emissiveIntensity = h.powered ? 0.4 + pk * 1.6 : (h.t > 1 ? 0.3 + Math.random() * 0.2 : 0.05);
    this.glow.intensity = h.powered ? 2 : (h.t > 1 ? 5 + Math.random() * 1.2 : 0);
    this.updateTether(pulse);

    // light comes up slightly once he can see properly
    this.hemi.intensity = 0.32 + pk * 0.14;
    this.post.uniforms.uGrey.value = h.reserveLook();
    this.post.uniforms.uSat.value = 0.75;

    for (const r of this.ripples) { r.t += dt; r.m.scale.setScalar(0.02 + r.t * 0.35); (r.m.material as THREE.MeshBasicMaterial).opacity = 0.4 * Math.max(0, 1 - r.t / 1.2); }
    this.ripples = this.ripples.filter(r => { if (r.t > 1.2) { this.scene.remove(r.m); return false; } return true; });
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) dp.setY(i, dp.getY(i) + Math.sin(t * 0.5 + i) * 0.0008);
    dp.needsUpdate = true;

    // camera: follows Wolt, but keeps the room framed
    const tx = THREE.MathUtils.clamp(h.pos.x, 5.5, HALL_W - 5.5), tz = THREE.MathUtils.clamp(h.pos.y, 3.5, HALL_H - 3.5);
    const want = new THREE.Vector3(tx, 0, tz);
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 2));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.post.render(this.scene, this.camera);
    void WAKE_TIME;
  }
}
