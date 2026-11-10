import * as THREE from 'three';
import { PAL } from '../../render/palette';
import { mat, mesh, obstacleMesh, rnd } from '../../render/models';
import { woltMonoModel, WoltMono, WoltAnimator, ArmPose } from '../../render/wolt';
import { GroundFx, SURFACES, pxPerMetre } from '../../render/groundFx';
import { ropeGeometry } from '../../render/loads';
import { Models, fit, place } from '../../render/assets';
import { Obstacle } from '../../sim/world';
import { V2 } from '../../sim/vec';
import { ROPE } from '../../sim/tow';
import { CraftGame, Target, Building, Scrap, Drop, Link } from '../sim/craftGame';
import { BUILD, BuildingId, SCRAP } from '../data';
import { buildingModel, BuildingModel, scrapModel, itemModel, moduleOnWolt } from './craftModels';
import { mastRig, runnerRig, balloonSailTexture, rod } from './yachtModels';
import { Sail } from '../../render/sail';

const CABLE_Y = 0.06;
const CAM_OFFSET = new THREE.Vector3(0, 40, 44);
const DAY_SKY = new THREE.Color(PAL.sky), NIGHT_SKY = new THREE.Color(0x2a2d33), DUSK_SKY = new THREE.Color(0x9a8778);

/** The crafting demo in 3D. Reads CraftGame every frame; never changes it. */
export class CraftView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private fog: THREE.Fog;
  private viewSize = 11;
  private zoom = 1;
  private raycaster = new THREE.Raycaster();
  private camTarget = new THREE.Vector3();

  private wolt: WoltMono;
  private anim: WoltAnimator;
  private moduleParts = new Map<string, THREE.Object3D>();
  private ground: GroundFx;
  private prevPos: THREE.Vector3 | null = null;
  private prevYaw = 0;
  private speed = 0; private yawRate = 0; private accel = 0;
  private prevLen = 0; private reelSpin = 0;
  private gesture: { pose: ArmPose; t: number } | null = null;
  private prevLinks = 0; private prevHeld: object | null = null;

  private scrapMeshes = new Map<Scrap, THREE.Object3D>();
  private buildMeshes = new Map<Building, BuildingModel>();
  private obstacleMeshes = new Map<Obstacle, THREE.Object3D>();
  private dropMeshes = new Map<Drop, THREE.Object3D>();
  private cableMeshes = new Map<object, { mesh: THREE.Mesh; key: string; curve: THREE.CurvePath<THREE.Vector3> }>();
  private cart: THREE.Group;
  private cartBody = new THREE.Group();
  private cartWheels: THREE.Object3D[] = [];
  /** The land yacht's rig on the cart, rebuilt when a part goes on. */
  private rig = new THREE.Group();
  private rigKey = '';
  private sail: Sail | null = null;
  private pennant: THREE.Group | null = null;
  private sailTex: THREE.Texture | null = null;
  private groundB: GroundFx;
  private sailZoom = 1;
  private rope: THREE.Mesh | null = null;
  private pulses: THREE.InstancedMesh;
  private ghost: THREE.Group | null = null;
  private ghostKind: BuildingId | null = null;
  private ghostMat = new THREE.MeshBasicMaterial({ color: PAL.ok, transparent: true, opacity: 0.35, depthWrite: false });
  private ring: THREE.Mesh;
  private cursor: THREE.LineSegments;
  private highlight: THREE.LineSegments;
  private dust: THREE.Points;
  private pickables: { obj: THREE.Object3D; target: () => Target | null }[] = [];
  private icons: Record<string, string> = {};
  overlay = false;

  constructor(private g: CraftGame, container: HTMLElement, private models: Models) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(r.domElement);
    this.renderer = r;
    const s = this.scene;
    s.background = DAY_SKY.clone();
    this.fog = new THREE.Fog(PAL.fog, 46, 92); s.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0xe6e2d8, 0x5f5a52, 1.25); s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xf3ecdf, 1.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
    sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
    s.add(sun); s.add(sun.target); this.sun = sun;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);

    this.buildGround();
    this.buildDecor();
    for (const o of g.world.obstacles) this.addObstacle(o);
    this.wolt = woltMonoModel(); s.add(this.wolt.group);
    this.anim = new WoltAnimator(this.wolt);
    this.ground = new GroundFx(() => SURFACES.ash); s.add(this.ground.group);
    // the second runner (or wheel) of the land yacht leaves its own track
    this.groundB = new GroundFx(() => SURFACES.ash); s.add(this.groundB.group);

    this.cart = this.buildCart(); s.add(this.cart);
    this.pickables.push({ obj: this.cart, target: () => ({ kind: 'cart' }) });
    this.pickables.push({ obj: this.wolt.group, target: () => ({ kind: 'self' }) });

    this.pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.flow, fog: false }), 160);
    this.pulses.count = 0; s.add(this.pulses);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.ring.rotation.x = -Math.PI / 2; s.add(this.ring);
    const cg = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)); cg.rotateX(-Math.PI / 2);
    this.cursor = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false }));
    s.add(this.cursor);
    this.highlight = new THREE.LineSegments(cg.clone(), new THREE.LineBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.8, fog: false }));
    s.add(this.highlight);
    this.dust = this.buildDust(); s.add(this.dust);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setIcons(i: Record<string, string>) { this.icons = i; }
  get iconMap() { return this.icons; }

  // ---------------------------------------------------------------- building the scene

  private buildGround() {
    const W = this.g.world.width, H = this.g.world.height;
    const geo = new THREE.PlaneGeometry(W + 140, H + 140, 120, 100); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors: number[] = [];
    const c1 = new THREE.Color(PAL.ground), c2 = new THREE.Color(PAL.groundDark), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + W / 2, z = p.getZ(i) + H / 2;
      const out = Math.max(0, -x, x - W, -z, z - H);
      const dune = Math.sin(x * 0.11 + z * 0.04) * 1.1 + Math.sin(x * 0.03 - z * 0.07) * 1.8 + Math.sin(z * 0.17) * 0.3;
      const k = THREE.MathUtils.smoothstep(out, 0, 6);
      p.setX(i, x); p.setZ(i, z);
      p.setY(i, -0.01 + k * (1.2 + dune + out * 0.18));
      // a darker, packed yard around the workshop
      const yard = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - 21, z - 13), 5, 11);
      const ripple = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 1.5) * Math.sin(z * 0.23 + x * 0.05);
      tmp.copy(c1).lerp(c2, 0.25 * ripple + k * 0.25 + yard * 0.35);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.scene.add(mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, 0, 0, false));
  }

  private buildDecor() {
    const g = this.g, m = this.models, s = this.scene;
    const W = g.world.width, H = g.world.height;
    const free = (x: number, y: number, r: number) => {
      for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) if (g.world.isBlocked(i, j)) return false;
      return Math.hypot(x - 21, y - 13) > 6;
    };
    const scatter = (names: string[], n: number, sc: [number, number], r: number) => {
      for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
        const x = 1 + rnd() * (W - 2), y = 1 + rnd() * (H - 2);
        if (!free(x, y, r)) continue;
        const o = place(m, names[Math.floor(rnd() * names.length)], sc[0] + rnd() * (sc[1] - sc[0]), rnd() * 6.28);
        o.position.set(x, 0, y); s.add(o); k++;
      }
    };
    // the plain around the workshop is bigger than the workshop: thinner there, not empty
    const k = Math.min(3.5, (W * H) / (46 * 34));
    scatter(['Pebble_Square_1', 'Pebble_Square_3', 'Pebble_Square_5', 'Pebble_Round_2', 'Pebble_Round_4'], Math.round(60 * k), [0.5, 1.3], 0.4);
    scatter(['Grass_Wispy_Short', 'Grass_Wispy_Tall'], Math.round(80 * k), [0.35, 0.7], 0.5);
    scatter(['Stone_Chunks_Small', 'Parts_Cog', 'trash_A', 'box_A'], Math.round(14 * k), [0.5, 0.9], 0.6);
    // the fog ring: dead trees close, half-buried ruins and wind turbines far
    const ring = (names: string[], n: number, a: number, b: number, fn: (o: THREE.Object3D) => void, sides = 4) => {
      for (let k = 0; k < n; k++) {
        const side = Math.floor(rnd() * sides), t = rnd(), out = a + rnd() * (b - a);
        const x = side === 0 ? -out : side === 1 ? W + out : t * W;
        const z = side === 2 ? -out : side === 3 ? H + out : t * H;
        const o = place(m, names[Math.floor(rnd() * names.length)], 1, rnd() * 6.28);
        o.position.set(x, 0, z); fn(o); s.add(o);
      }
    };
    ring(['DeadTree_1', 'DeadTree_2', 'DeadTree_3', 'DeadTree_4', 'DeadTree_5'], 60, 2, 14, o => o.scale.setScalar(0.5 + rnd() * 0.4), 3); // not south: the tilted camera would put them over the HUD
    ring(['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2'], 6, 24, 40, o => { o.position.y = -6 - rnd() * 8; o.rotation.z = (rnd() - 0.5) * 0.25; }, 3);
    ring(['windturbine_tall'], 4, 20, 34, o => { o.scale.setScalar(2.2); o.rotation.z = (rnd() - 0.5) * 0.3; }, 3);
    // the workshop yard: cable drums, cargo, a parked lander base gone to rust
    const at = (o: THREE.Object3D, x: number, z: number, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; s.add(o); };
    if (m.has('cargo_A_stacked')) at(fit(m, 'cargo_A_stacked', 1.6, 1.6), 15.2, 7.6, 0.3);
    if (m.has('containers_B')) at(fit(m, 'containers_B', 1.2, 1.2), 24.6, 7.2);
    if (m.has('lights')) at(fit(m, 'lights', 0.8, 0.8, 2.6), 16.3, 12.2);
    if (m.has('Pallet_Wood_Covered_A')) at(fit(m, 'Pallet_Wood_Covered_A', 1.2, 1.2), 22.8, 12.4, 0.2);
    if (m.has('firehydrant')) at(fit(m, 'firehydrant', 0.5, 0.5, 0.8), 13.4, 13.4);
  }

  private addObstacle(o: Obstacle) {
    if (this.obstacleMeshes.has(o)) return;
    const g = this.g;
    if (g.scrap.some(s => s.o === o) || g.buildings.some(b => b.o === o)) return;
    let m: THREE.Object3D;
    const md = this.models;
    if (o.name === 'garage' && md.has('basemodule_garage')) {
      m = new THREE.Group();
      const gar = fit(md, 'basemodule_garage', o.w * 0.95, o.h * 1.15, 3.2, Math.PI); m.add(gar);
      m.position.set(o.x + o.w / 2, 0, o.y + o.h / 2);
    } else if (o.name === 'watertower' && md.has('watertower')) {
      m = new THREE.Group(); m.add(fit(md, 'watertower', o.w, o.h, 9)); m.position.set(o.x + o.w / 2, 0, o.y + o.h / 2);
    } else if (o.name === 'shelf' && md.has('shelf_B_large_decorated')) {
      m = new THREE.Group(); m.add(fit(md, 'shelf_B_large_decorated', 1, 0.6, 2, Math.PI / 2)); m.position.set(o.x + 0.5, 0, o.y + 0.5);
    } else if (o.name === 'cabinet' && md.has('cabinet_medium')) {
      m = new THREE.Group(); m.add(fit(md, 'cabinet_medium', 0.9, 0.6, 1.1, -Math.PI / 2)); m.position.set(o.x + 0.5, 0, o.y + 0.5);
    } else m = obstacleMesh(o, md);
    this.scene.add(m);
    this.obstacleMeshes.set(o, m);
  }

  private buildCart(): THREE.Group {
    const g = new THREE.Group();
    const b = this.cartBody;
    const m = this.models;
    if (m.has('spacetruck_trailer')) {
      const t = fit(m, 'spacetruck_trailer', 1.15, 1.9, 0.75);
      b.add(t);
      for (const n of ['front_left', 'front_right', 'rear_left', 'rear_right']) { const w = t.getObjectByName('spacetruck_trailer_wheel_' + n); if (w) this.cartWheels.push(w); }
    } else b.add(mesh(new THREE.BoxGeometry(1.1, 0.5, 1.8), mat(PAL.steel), 0, 0.4, 0));
    // a drawbar to the hitch and a tarp-covered load that grows with the slots used
    b.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), mat(0x1e2022), 0, 0.3, 1.2));
    const load = new THREE.Group(); load.name = 'load'; b.add(load);
    g.add(b);
    g.add(this.rig);
    return g;
  }

  /** Height of the cart's bed above the ground (before runners lift it). */
  static readonly DECK = 0.56;
  static readonly MAST_H = 3.7;
  static readonly BOOM_Y = 1.2;   // above the deck: clears Wolt's head
  static readonly MAST_Z = 0.5;
  static readonly WOLT_Z = -0.35;

  /** Rebuild the mast, sail and runners on the cart when the rig changes. */
  private syncRig() {
    const r = this.g.cart.rig;
    const key = `${+r.mast}${+r.sail}${+r.runners}`;
    if (key === this.rigKey) return;
    this.rigKey = key;
    this.rig.clear();
    this.sail = null; this.pennant = null;
    const lift = r.runners ? 0.14 : 0;
    this.cartBody.position.y = lift;
    const deck = CraftView.DECK + lift;
    const steel = mat(0x50565b, { r: 0.5, m: 0.6 });
    let anchors = [new THREE.Vector3(-0.56, deck - 0.05, CraftView.MAST_Z - 0.15), new THREE.Vector3(0.56, deck - 0.05, CraftView.MAST_Z - 0.15), new THREE.Vector3(0, deck - 0.05, 1.45)];
    if (r.runners) {
      const rr = runnerRig();
      this.rig.add(rr.group);
      anchors = rr.ends;
    }
    if (r.mast) {
      const mr = mastRig(CraftView.MAST_H);
      mr.group.position.set(0, deck, CraftView.MAST_Z);
      this.rig.add(mr.group);
      this.pennant = mr.pennant;
      const head = mr.head.clone().add(mr.group.position);
      for (const a of anchors) this.rig.add(rod(head, a, 0.007, steel, 4));
      // a turnbuckle where each shroud meets its anchor
      for (const a of anchors) { const t = rod(a, a.clone().lerp(head, 0.06), 0.016, steel, 6); this.rig.add(t); }
    }
    if (r.mast && r.sail) {
      if (!this.sailTex) this.sailTex = balloonSailTexture();
      const sail = new Sail(1.95, CraftView.MAST_H - CraftView.BOOM_Y - 0.15, this.sailTex);
      // the sail's frame has the bow along +x: turn it onto the cart's +z
      const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2;
      holder.position.set(0, deck + CraftView.BOOM_Y, CraftView.MAST_Z);
      holder.add(sail.group);
      this.rig.add(holder);
      this.sail = sail;
    }
  }

  private buildDust(): THREE.Points {
    const n = 900, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (rnd() - 0.5) * 60; arr[i * 3 + 1] = rnd() * 8; arr[i * 3 + 2] = (rnd() - 0.5) * 50; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8e3d8, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }));
  }

  // ---------------------------------------------------------------- camera and picking

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.viewSize = Math.max(9, Math.min(13, 11 * (900 / Math.max(h, 500)) ** 0.2));
    const a = w / h;
    const vs = (a < 1 ? this.viewSize / a * 0.95 : this.viewSize) * this.zoom * this.sailZoom;
    Object.assign(this.camera, { left: -vs * a, right: vs * a, top: vs, bottom: -vs });
    this.camera.updateProjectionMatrix();
  }

  zoomBy(f: number) { this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.45, 2.4); this.resize(); }

  pick(nx: number, ny: number): V2 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const t = -this.raycaster.ray.origin.y / this.raycaster.ray.direction.y;
    if (!isFinite(t) || t < 0) return null;
    const p = this.raycaster.ray.at(t, new THREE.Vector3());
    return { x: p.x, y: p.z };
  }

  pickTarget(nx: number, ny: number): Target | null {
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    let best: { d: number; t: Target } | null = null;
    for (const p of this.pickables) {
      if (!p.obj.visible) continue;
      const t = p.target();
      if (!t) continue;
      const hit = this.raycaster.intersectObject(p.obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, t };
    }
    if (best) return best.t;
    const at = this.pick(nx, ny);
    return at ? this.g.targetAt(at) : null;
  }

  project(p: V2, y = 0): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, y, p.y).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // ---------------------------------------------------------------- per frame

  frame(dt: number, aim: V2 | null, hover: Target | null) {
    const g = this.g, t = g.time;
    this.syncEntities();
    this.updateDayNight();

    // under sail the camera pulls back a little, and looks ahead of the bow
    const zt = g.aboard ? 1 + Math.min(0.45, g.yacht.v * 0.06) : 1;
    if (Math.abs(zt - this.sailZoom) > 0.002) { this.sailZoom += (zt - this.sailZoom) * Math.min(1, dt * 1.5); this.resize(); }
    const lead = g.aboard ? Math.min(4, g.yacht.v * 0.5) : 0;
    const want = new THREE.Vector3(g.pos.x + Math.cos(g.facing) * lead, 0, g.pos.y + Math.sin(g.facing) * lead);
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 4));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.sun.target.position.copy(this.camTarget);

    this.updateCart(dt);
    this.updateWolt(dt, t, aim);
    this.updateYacht(dt, t);
    this.updateBuildings(dt, t);
    this.updateScrap(t);
    this.updateCables(t);
    this.updateGhost(aim);
    this.updateHighlight(hover);
    this.ground.setWind(Math.cos(g.wind.dir) * g.wind.strength * 0.3, Math.sin(g.wind.dir) * g.wind.strength * 0.3);
    this.ground.setScale(pxPerMetre(this.renderer, this.camera));
    this.ground.update(dt);

    if (aim && !g.placing) { this.cursor.visible = true; this.cursor.position.set(Math.floor(aim.x) + 0.5, 0.03, Math.floor(aim.y) + 0.5); }
    else this.cursor.visible = false;

    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const str = g.wind.strength;
    for (let i = 0; i < dp.count; i++) {
      const sp = (0.3 + str * 0.25) * (0.8 + (i % 7) * 0.06);
      let x = dp.getX(i) + Math.cos(g.wind.dir) * sp * dt, y = dp.getY(i) - dt * 0.12, z = dp.getZ(i) + Math.sin(g.wind.dir) * sp * dt;
      if (x > 30) x -= 60; if (x < -30) x += 60; if (z > 25) z -= 50; if (z < -25) z += 50; if (y < 0) y += 8;
      dp.setXYZ(i, x, y, z);
    }
    dp.needsUpdate = true;
    this.dust.position.set(this.camTarget.x, 0, this.camTarget.z);
    this.renderer.render(this.scene, this.camera);
  }

  /** Add meshes for new things, drop meshes for removed ones. */
  private syncEntities() {
    const g = this.g, s = this.scene;
    for (const o of g.removed) {
      const m = this.obstacleMeshes.get(o);
      if (m) { s.remove(m); this.obstacleMeshes.delete(o); }
    }
    g.removed.length = 0;
    for (const [sc, m] of this.scrapMeshes) if (!g.scrap.includes(sc)) { s.remove(m); this.scrapMeshes.delete(sc); }
    for (const sc of g.scrap) if (!this.scrapMeshes.has(sc)) {
      const m = scrapModel(sc.kind, sc.o.w, sc.o.h, this.models, sc.o.x * 31 + sc.o.y * 7);
      const holder = new THREE.Group(); holder.add(m);
      holder.position.set(sc.o.x + sc.o.w / 2, 0, sc.o.y + sc.o.h / 2);
      if (sc.kind !== 'car') m.rotation.y += sc.rot;
      s.add(holder); this.scrapMeshes.set(sc, holder);
      this.pickables.push({ obj: holder, target: () => g.scrap.includes(sc) && g.visible(sc) ? { kind: 'scrap', s: sc } : null });
    }
    for (const [b, m] of this.buildMeshes) if (!g.buildings.includes(b)) { s.remove(m.group); this.buildMeshes.delete(b); }
    for (const b of g.buildings) if (!this.buildMeshes.has(b)) {
      const m = buildingModel(b.kind, this.models);
      m.group.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
      s.add(m.group); this.buildMeshes.set(b, m);
      this.pickables.push({ obj: m.group, target: () => g.buildings.includes(b) ? { kind: 'build', b } : null });
    }
    for (const [d, m] of this.dropMeshes) if (!g.drops.includes(d)) { s.remove(m); this.dropMeshes.delete(d); }
    for (const d of g.drops) if (!this.dropMeshes.has(d)) {
      const holder = new THREE.Group();
      holder.add(fit(this.models, 'Prop_Crate4', 0.5, 0.5, undefined, rnd() * 6));
      const top = itemModel(d.items[0]?.id ?? 'iron', this.models);
      const bb = new THREE.Box3().setFromObject(top), sz = bb.getSize(new THREE.Vector3());
      top.scale.setScalar(0.35 / Math.max(sz.x, sz.z, 0.01)); top.position.y = 0.42;
      holder.add(top);
      holder.position.set(d.pos.x, 0, d.pos.y);
      s.add(holder); this.dropMeshes.set(d, holder);
      this.pickables.push({ obj: holder, target: () => g.drops.includes(d) ? { kind: 'drop', d } : null });
    }
    this.pickables = this.pickables.filter(p => p.obj.parent !== null);
  }

  private updateDayNight() {
    const g = this.g;
    const sun = g.sun();
    const dusk = Math.max(0, 1 - Math.abs(sun - 0.15) / 0.15) * 0.6;
    const k = THREE.MathUtils.smoothstep(sun, 0, 0.35);
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, k).lerp(DUSK_SKY, dusk * (1 - k * 0.5));
    (this.scene.background as THREE.Color).copy(sky);
    this.fog.color.copy(sky);
    this.hemi.intensity = 0.5 + 0.75 * k;
    this.hemi.color.set(0x8a96b0).lerp(new THREE.Color(0xe6e2d8), k);
    this.sun.intensity = 0.15 + 1.45 * k;
    this.sun.color.set(0xffb070).lerp(new THREE.Color(0xf3ecdf), k);
    // the sun crosses the sky (east to west); at night the light is the moon, high and cold
    const a = (g.day - 0.25) * Math.PI * 2;
    const dir = sun > 0 ? new THREE.Vector3(-Math.cos(a) * 30, 18 + Math.sin(a) * 26, 14) : new THREE.Vector3(-10, 40, 18);
    if (sun <= 0) this.sun.color.set(0x7d8aa8);
    this.sun.position.copy(this.camTarget).add(dir);
    this.renderer.toneMappingExposure = 0.85 + 0.15 * k;
  }

  private updateWolt(dt: number, t: number, aim: V2 | null) {
    const g = this.g, w = this.wolt;
    if (g.aboard) {
      // on the deck: the wheel sits in the socket behind the mast and turns with the yacht
      const p = new THREE.Vector3(0, CraftView.DECK + this.cartBody.position.y, CraftView.WOLT_Z).applyMatrix4(this.cart.matrixWorld);
      w.group.position.copy(p);
      w.group.rotation.y = this.cart.rotation.y;
    } else {
      w.group.position.set(g.pos.x, 0, g.pos.y);
      w.group.rotation.y = Math.PI / 2 - g.facing;
    }
    w.group.updateMatrixWorld(true);
    const p = w.group.position;
    if (!this.prevPos) { this.prevPos = p.clone(); this.prevYaw = w.group.rotation.y; }
    const yw = w.group.rotation.y;
    const sd = dt > 0 ? ((p.x - this.prevPos.x) * Math.sin(yw) + (p.z - this.prevPos.z) * Math.cos(yw)) / dt : 0;
    const ns = this.speed + (sd - this.speed) * Math.min(1, dt * 10);
    this.accel += ((dt > 0 ? (ns - this.speed) / dt : 0) - this.accel) * Math.min(1, dt * 6);
    this.speed = ns;
    let dy = yw - this.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yawRate += ((dt > 0 ? dy / dt : 0) - this.yawRate) * Math.min(1, dt * 8);
    this.prevPos.copy(p); this.prevYaw = yw;

    const L = g.heldLength();
    const dL = g.held && this.prevHeld === g.held ? L - this.prevLen : 0;
    this.reelSpin += ((dt > 0 ? dL / dt / 0.11 : 0) - this.reelSpin) * Math.min(1, dt * 12);
    this.prevLen = L;
    if (g.held && g.held !== this.prevHeld) this.gesture = { pose: 'reach', t: 0.6 };
    if (g.links.length > this.prevLinks) this.gesture = { pose: 'reach', t: 0.6 };
    this.prevHeld = g.held; this.prevLinks = g.links.length;
    if (this.gesture && (this.gesture.t -= dt) <= 0) this.gesture = null;
    const arm: ArmPose = g.salvage || g.craftJob ? 'work' : this.gesture?.pose ?? 'rest';

    let cableTo: THREE.Vector3 | null = null, tension = 0, pullFrom: THREE.Vector3 | null = null;
    if (g.held) {
      const last = g.held.cable.last;
      cableTo = new THREE.Vector3(last.x, 0, last.y);
      tension = Math.max(0, (L - g.cableMax() + 2) / 2);
      if (tension > 0) pullFrom = new THREE.Vector3(last.x - g.pos.x, 0, last.y - g.pos.y).normalize();
    }
    // the floodlight module: further, wider
    const lampMod = g.hasModule('m_lamp');
    w.spot.distance = lampMod ? 26 : 14; w.spot.angle = lampMod ? 0.85 : 0.6;
    if (g.aboard) { this.speed = 0; this.accel = 0; this.yawRate = 0; }
    this.anim.update({
      dt, time: t, speed: this.speed, yawRate: this.yawRate, accel: this.accel, strain: g.strain,
      cableTo, tension, pullFrom, reelSpin: this.reelSpin, arm, energy: g.energyPct(),
      lamp: g.light && !g.empty() ? 1 : g.isNight() && !g.empty() ? 0.25 : 0,
      lookAt: aim && !g.order && !g.aboard ? new THREE.Vector3(aim.x, 0, aim.y) : null,
    });
    if (!g.aboard) this.ground.wheel({ x: p.x, z: p.z, yaw: yw, speed: this.speed, accel: this.accel, yawRate: this.yawRate, slip: this.anim.slip }, dt);

    // modules show on the body
    for (const [id, part] of this.moduleParts) if (!g.modules.includes(id as never)) { w.body.remove(part); this.moduleParts.delete(id); }
    for (const id of g.modules) if (!this.moduleParts.has(id)) { const part = moduleOnWolt(id); w.body.add(part); this.moduleParts.set(id, part); }
  }

  private updateCart(dt: number) {
    const g = this.g, c = this.cart;
    this.syncRig();
    c.position.set(g.cart.pos.x, 0, g.cart.pos.y);
    let dr = (Math.PI / 2 - g.cart.angle) - c.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    const turn = dr * Math.min(1, dt * 5);
    c.rotation.y += turn;
    const moved = this.cartPrev ? Math.hypot(g.cart.pos.x - this.cartPrev.x, g.cart.pos.y - this.cartPrev.y) : 0;
    this.cartPrev = { ...g.cart.pos };
    if (!g.cart.rig.runners) for (const w of this.cartWheels) w.rotation.x += moved / 0.09; // on runners the wheels hang clear
    c.updateMatrixWorld(true);
    // unrepaired: sagging on a seized wheel
    c.rotation.z = g.cart.repaired ? 0 : 0.08;
    // what is in it: crates under a tarp
    const load = c.getObjectByName('load')!;
    load.visible = !g.aboard; // Wolt's socket is where the crates ride
    const used = g.cart.inv.used();
    if (used !== this.cartUsed) {
      this.cartUsed = used;
      load.clear();
      for (let i = 0; i < Math.min(used, 6); i++) {
        const b = fit(this.models, i % 3 === 2 ? 'cargo_B' : 'Prop_Crate4', 0.4, 0.4, undefined, i * 0.7);
        b.position.set(-0.22 + (i % 2) * 0.44, 0.62 + Math.floor(i / 4) * 0.36, -0.55 + (Math.floor(i / 2) % 2) * 0.55);
        load.add(b);
      }
    }
    if (this.rope) { this.scene.remove(this.rope); this.rope.geometry.dispose(); this.rope = null; }
    if (g.hitched) {
      const a = this.wolt.hitch.getWorldPosition(new THREE.Vector3());
      const b = new THREE.Vector3(0, 0.3, 1.5).applyMatrix4(c.matrixWorld);
      this.rope = mesh(ropeGeometry(a, b, ROPE * 0.6), mat(0x3a3d40, { r: 0.6, m: 0.4 }), 0, 0, 0, true);
      this.scene.add(this.rope);
    }
  }
  private cartPrev: V2 | null = null;
  private cartUsed = -1;

  /** The sail fills with the apparent wind, the pennant streams, the runners leave tracks. */
  private updateYacht(dt: number, t: number) {
    const g = this.g, y = g.yacht;
    const a = Math.PI / 2 - this.cart.rotation.y; // the cart's heading as drawn
    const v = g.aboard ? y.v : 0;
    const ax = Math.cos(g.wind.dir) * g.wind.strength - Math.cos(a) * v, ay = Math.sin(g.wind.dir) * g.wind.strength - Math.sin(a) * v;
    const app = Math.hypot(ax, ay), appDir = Math.atan2(ay, ax);
    if (this.pennant) this.pennant.rotation.y = -appDir - this.cart.rotation.y + Math.sin(t * 7) * 0.08 * Math.min(1, app / 6);
    if (this.sail) {
      // parked, the sheet is loose and the sail weathervanes; aboard it is trimmed
      const fill = g.aboard ? y.fill : 0;
      this.sail.update(dt, t, appDir - a, app * (0.25 + 0.75 * fill), g.aboard ? y.sheet : undefined);
      // see-through when it stands between the camera and Wolt
      const chest = this.wolt.group.position.clone(); chest.y += 0.7;
      const s = chest.project(this.camera);
      this.raycaster.setFromCamera(new THREE.Vector2(s.x, s.y), this.camera);
      const hit = this.raycaster.intersectObject(this.sail.cloth, false).length > 0;
      this.sail.setFade(hit ? 0.3 : 1, dt);
    }
    if (g.aboard) {
      // tracks: two runners at the plank ends (or the two rear wheels)
      const yaw = this.cart.rotation.y, half = g.cart.rig.runners ? 1.2 : 0.5, back = g.cart.rig.runners ? -0.5 : -0.55;
      const sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
      const at = (side: number) => ({ x: this.cart.position.x + sx * half * side + fx * back, z: this.cart.position.z + sz * half * side + fz * back });
      const l = at(-1), r = at(1);
      const f = { yaw, speed: v, accel: 0, yawRate: 0, slip: 0 };
      this.ground.wheel({ ...l, ...f }, dt);
      this.groundB.wheel({ ...r, ...f }, dt);
    }
    this.groundB.setWind(Math.cos(g.wind.dir) * g.wind.strength * 0.3, Math.sin(g.wind.dir) * g.wind.strength * 0.3);
    this.groundB.setScale(pxPerMetre(this.renderer, this.camera));
    this.groundB.update(dt);
  }

  private updateBuildings(dt: number, t: number) {
    const g = this.g;
    for (const [b, m] of this.buildMeshes) {
      const on = g.powered(b);
      const net = g.net(b);
      const wind = g.wind.strength;
      if (m.fan && b.ok && b.on) m.fan.rotation.z += dt * (0.4 + wind * 0.5);
      if (b.kind === 'oldturbine' && !b.ok && m.fan) m.fan.rotation.z = 0.6; // stuck
      if (m.drill) m.drill.position.y = 1 + (on && b.hopper > 0 ? Math.sin(t * 6) * 0.15 : 0);
      switch (b.kind) {
        case 'lamp': {
          const lit = on && b.watts < 0 ? 1 : 0;
          (m.glow[0].material as THREE.MeshStandardMaterial).emissiveIntensity = lit * 3;
          if (m.light) m.light.intensity = lit * 9;
          break;
        }
        case 'splitter': (m.glow[0].material as THREE.MeshStandardMaterial).emissive.set(net && net.nodes.length > 1 ? (net.supply > 0.99 ? PAL.ok : PAL.limit) : PAL.warn); break;
        case 'battery': (m.glow[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + (b.stored / 2000) * 2 + (net && net.balance > 0 ? Math.sin(t * 4) * 0.3 : 0); break;
        case 'charger': for (const r of m.glow) (r.material as THREE.MeshStandardMaterial).emissiveIntensity = on && g.docked ? 0.8 + Math.sin(t * 6) * 0.4 : on ? 0.15 : 0; break;
        case 'recycler': (m.glow[0].material as THREE.MeshStandardMaterial).emissive.set(on ? (b.hopper > 0 ? PAL.ok : PAL.warn) : PAL.off); break;
        case 'mast': {
          (m.glow[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (Math.sin(t * 3) > 0 ? 3 : 0.3) : 0.1;
          if (m.dish && on && g.radio.listening) m.dish.rotation.y = Math.sin(t * 0.3) * 1.2;
          break;
        }
        case 'bench': (m.glow[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (g.craftJob ? 2 + Math.sin(t * 20) * 0.5 : 1.2) : 0.15; break;
      }
    }
  }

  private updateScrap(t: number) {
    const g = this.g;
    for (const [s, m] of this.scrapMeshes) {
      m.visible = g.visible(s);
      const shake = g.salvage?.s === s;
      m.position.x = s.o.x + s.o.w / 2 + (shake ? Math.sin(t * 60) * 0.035 : 0);
      // big things sink a little with every round taken off them
      const d = SCRAP[s.kind];
      const k = d.rounds > 1 ? s.rounds / d.rounds : 1;
      m.scale.y = 0.6 + 0.4 * k;
    }
  }

  // ---------------------------------------------------------------- cables

  private portY(id: string): number {
    const b = this.g.buildings.find(x => x.id === id);
    if (!b) return 0.4;
    return this.buildMeshes.get(b)?.port.y ?? 0.4;
  }

  private cablePath(pts: V2[], fromY: number, toY: number | null): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const ground = (p: V2) => new THREE.Vector3(p.x, CABLE_Y, p.y);
    out.push(new THREE.Vector3(pts[0].x, fromY, pts[0].y));
    if (pts.length > 1) {
      const a = pts[0], b = pts[1], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > 0.7) out.push(ground({ x: a.x + (b.x - a.x) / d * 0.45, y: a.y + (b.y - a.y) / d * 0.45 }));
    }
    for (let i = 1; i < pts.length - 1; i++) out.push(ground(pts[i]));
    const end = pts[pts.length - 1], prev = pts[pts.length - 2] ?? pts[0];
    const d = Math.hypot(end.x - prev.x, end.y - prev.y);
    if (toY === null) {
      const exit = this.wolt.cableExit.getWorldPosition(new THREE.Vector3());
      const ex = exit.x - prev.x, ez = exit.z - prev.y, el = Math.hypot(ex, ez);
      if (el > 0.7) out.push(ground({ x: exit.x - ex / el * 0.45, y: exit.z - ez / el * 0.45 }));
      out.push(exit);
    } else {
      if (d > 0.7) out.push(ground({ x: end.x - (end.x - prev.x) / d * 0.45, y: end.y - (end.y - prev.y) / d * 0.45 }));
      out.push(new THREE.Vector3(end.x, toY, end.y));
    }
    return out;
  }

  private updateCables(t: number) {
    const g = this.g;
    const all: (Link | { held: true })[] = [...g.links, ...(g.held ? [{ held: true as const }] : [])];
    const alive = new Set<object>(g.links);
    if (g.held) alive.add(g.held);
    for (const [k, v] of this.cableMeshes) if (!alive.has(k)) { this.scene.remove(v.mesh); v.mesh.geometry.dispose(); this.cableMeshes.delete(k); }
    let pn = 0;
    const m4 = new THREE.Matrix4();
    const sees = this.overlay || g.hasModule('m_ai') || g.have('meter') > 0;
    for (const c of all) {
      const isHeld = 'held' in c;
      const key0: object = isHeld ? g.held! : c;
      const pts = isHeld ? g.held!.cable.points() : (c as Link).cable.points();
      const path = this.cablePath(pts, this.portY(isHeld ? g.held!.from : (c as Link).a), isHeld ? null : this.portY((c as Link).b));
      const key = path.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join('|');
      let e = this.cableMeshes.get(key0);
      if (!e || e.key !== key) {
        const cp = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < path.length; i++) cp.add(new THREE.LineCurve3(path[i - 1], path[i]));
        const geo = new THREE.TubeGeometry(cp, Math.max(8, Math.round(cp.getLength() * 3)), 0.04, 6, false);
        if (!e) {
          const me = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.6, metalness: 0.2 }), 0, 0, 0, true);
          this.scene.add(me); e = { mesh: me, key, curve: cp }; this.cableMeshes.set(key0, e);
        } else { e.mesh.geometry.dispose(); e.mesh.geometry = geo; e.key = key; e.curve = cp; }
      }
      const mm = e.mesh.material as THREE.MeshStandardMaterial;
      if (isHeld) {
        const near = g.heldLength() > g.cableMax() - 2;
        mm.emissive.set(near ? PAL.limit : 0); mm.emissiveIntensity = near ? 0.6 + Math.sin(t * 12) * 0.3 : 0;
        continue;
      }
      // power flowing: pulses towards consumers, seen with the meter, the AI module, or Alt
      const l = c as Link;
      const a = g.buildings.find(b => b.id === l.a), b = g.buildings.find(b => b.id === l.b);
      const net = a ? g.net(a) : undefined;
      const live = !!net && net.production > 0 && net.supply > 0.99;
      mm.emissive.set(sees && live ? PAL.flow : 0); mm.emissiveIntensity = sees && live ? 0.35 : 0;
      if (sees && live && a && b) {
        const L = e.curve.getLength();
        const n = Math.min(24, Math.floor(L / 1.2));
        // pulses move from the side that produces to the side that uses
        const fwd = a.watts >= b.watts;
        for (let i = 0; i < n && pn < 160; i++) {
          const u0 = ((i / n) + t * 0.15) % 1;
          const p = e.curve.getPointAt(fwd ? u0 : 1 - u0);
          m4.makeTranslation(p.x, p.y + 0.04, p.z);
          this.pulses.setMatrixAt(pn++, m4);
        }
      }
    }
    this.pulses.count = pn;
    this.pulses.instanceMatrix.needsUpdate = true;
    // the reach ring of the held cable
    if (g.held) {
      const c = g.held.cable;
      this.ring.visible = true;
      this.ring.scale.setScalar(Math.max(0.1, g.cableMax() - c.baseLength()));
      this.ring.position.set(c.last.x, 0.04, c.last.y);
    } else this.ring.visible = false;
  }

  // ---------------------------------------------------------------- placing and highlight

  private updateGhost(aim: V2 | null) {
    const g = this.g, k = g.placing;
    if (k !== this.ghostKind) {
      if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
      this.ghostKind = k;
      if (k) {
        const m = buildingModel(k, this.models).group;
        m.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) { me.material = this.ghostMat; me.castShadow = false; } });
        const foot = new THREE.Mesh(new THREE.PlaneGeometry(BUILD[k].w, BUILD[k].h).rotateX(-Math.PI / 2), this.ghostMat);
        foot.position.y = 0.03;
        this.ghost = new THREE.Group(); this.ghost.add(m); this.ghost.add(foot);
        this.scene.add(this.ghost);
      }
    }
    if (!this.ghost || !k) return;
    if (!aim) { this.ghost.visible = false; return; }
    const c = this.ghostCorner(aim);
    this.ghost.visible = true;
    this.ghost.position.set(c.x + BUILD[k].w / 2, 0, c.y + BUILD[k].h / 2);
    this.ghostMat.color.set(g.canPlace(k, c.x, c.y) ? PAL.limit : PAL.ok);
  }

  /** The footprint corner under the cursor for the building being placed. */
  ghostCorner(aim: V2): { x: number; y: number } {
    const k = this.g.placing;
    const d = k ? BUILD[k] : { w: 1, h: 1 };
    return { x: Math.round(aim.x - d.w / 2), y: Math.round(aim.y - d.h / 2) };
  }

  private updateHighlight(t: Target | null) {
    const h = this.highlight;
    let r: { x: number; y: number; w: number; h: number } | null = null;
    if (t?.kind === 'build') r = t.b;
    else if (t?.kind === 'scrap') r = t.s.o;
    if (!r) { h.visible = false; return; }
    h.visible = true;
    h.position.set(r.x + r.w / 2, 0.05, r.y + r.h / 2);
    h.scale.set(r.w + 0.1, 1, r.h + 0.1);
  }
}
