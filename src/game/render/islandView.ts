import * as THREE from 'three';
import { cableTube } from './cableTube';
import { mat, mesh, box } from '../../render/models';
import { PAL } from '../../render/palette';
import { woltMonoModel, WoltMono, WoltAnimator, ArmPose } from '../../render/wolt';
import { LoadModel, animateDragged, ropeGeometry } from '../../render/loads';
import { GroundFx, SURFACES, Surface, pxPerMetre } from '../../render/groundFx';
import { LOADS, ROPE } from '../../sim/tow';
import { V2 } from '../../sim/vec';
import { ItemId } from '../sim/craft';
import { Island, IS_W, IS_H, P, BUNKER, DOOR_W, CLOUDS, cloudX, Heap, Pad } from '../sim/island';
import { Post } from './post';
import { glow, softDisc, canvasTex } from './station/kit';

const CAM_OFFSET = new THREE.Vector3(0, 17, 16);
const VIEW = 7.8;
const Q_GREEN = 0x5fe39a;
const BEAM_TURN = 6;          // s per turn of the lighthouse
const CX = 22, CY = 17, RX = 23, RY = 17.5;
const ss = THREE.MathUtils.smoothstep;

const STEEL = mat(0x4b5155, { r: 0.6, m: 0.5 });
const DARK = mat(0x2c2f31, { r: 0.8, m: 0.3 });
const RUST = mat(0x5a4436, { r: 0.95 });
const PV = new THREE.MeshStandardMaterial({ color: 0x2f4656, roughness: 0.2, metalness: 0.5, emissive: 0x16303f, emissiveIntensity: 0.6 });
const CONCRETE = mat(0x8a877f, { r: 0.95 });
const WALL = mat(0x6d6a62, { r: 0.95 });

/** Item colours for piles and the sled: colour only says "what kind", like the HUD. */
const ITEM_COL: Partial<Record<ItemId, number>> = {
  copper: 0x8a5a3a, plastic: 0xc8c2b4, iron: 0x5d6266, glass: 0xaecbd0, oil: 0x2a2620,
  cell: 0x22313c, pane: 0x9fb8c0, cable: 0x1b1b1b, battery: 0x3a3d40, frame: 0x6a6f73, panel: 0x1d2a33,
};

function lamp(): { o: THREE.Mesh; m: THREE.MeshStandardMaterial } {
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: PAL.off, emissiveIntensity: 0.2 });
  return { o: mesh(new THREE.SphereGeometry(0.06, 8, 6), m, 0, 0, 0, false), m };
}
function setLamp(m: THREE.MeshStandardMaterial, s: 'ok' | 'bad' | 'off' | 'blink', t: number) {
  m.emissive.setHex(s === 'ok' ? PAL.ok : PAL.off);
  m.emissiveIntensity = s === 'ok' ? 1.8 : s === 'bad' ? 1.4 : s === 'blink' ? (Math.sin(t * 5) > 0.3 ? 1.6 : 0.1) : 0.12;
}

/**
 * Level "Wyspa" in 3D: a rocky island in a lagoon of glass under a high, bright sky with
 * drifting cloud shadows. Reads Island every frame and changes nothing in it.
 */
export class IslandView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  readonly post: Post;
  private wolt: WoltMono;
  private anim: WoltAnimator;
  private sled: LoadModel;
  private cargo = new THREE.Group();
  private cargoKey = '';
  private rope: THREE.Mesh | null = null;
  private ownCable: THREE.Mesh | null = null;
  private pads: { g: THREE.Group; panel: THREE.Group; crack: THREE.Object3D; conn: THREE.Object3D; lamp: THREE.MeshStandardMaterial }[] = [];
  private heaps = new Map<string, THREE.Group>();
  private piles = new Map<number, THREE.Object3D>();
  private cables = new Map<string, THREE.Mesh>();
  private flowMat = new THREE.MeshStandardMaterial({ color: 0x161818, roughness: 0.7, emissive: PAL.flow, emissiveIntensity: 0 });
  private shadows: THREE.Mesh[] = [];
  private junctionBox!: THREE.Object3D;
  private junctionLamp!: THREE.MeshStandardMaterial;
  private regLamp!: THREE.MeshStandardMaterial;
  private portLamp!: THREE.MeshStandardMaterial;
  private sparks!: THREE.Sprite;
  private crateLid!: THREE.Object3D;
  private door!: THREE.Object3D;
  private roof!: THREE.Mesh;
  private screen!: THREE.MeshStandardMaterial;
  private screenBar!: THREE.Mesh;
  private storage!: THREE.Group;
  private storeLamp!: THREE.MeshStandardMaterial;
  private benchLight!: THREE.PointLight;
  private beam!: THREE.Group;
  private beamLight!: THREE.SpotLight;
  private lantern!: THREE.MeshStandardMaterial;
  private domeBlink!: THREE.Sprite;
  private camTarget = new THREE.Vector3();
  private zoom = 1;
  private prevPos: THREE.Vector3 | null = null;
  private prevYaw = 0; private spd = 0; private acc = 0; private yawRate = 0;
  private gesture: { pose: ArmPose; t: number } | null = null;
  private prevTowing = false;
  private grey = 0;
  private ground: GroundFx;

  constructor(private st: Island, container: HTMLElement) {
    const r = new THREE.WebGLRenderer({ antialias: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.post = new Post(r);
    this.post.uniforms.uGrey.value = 0;
    this.post.uniforms.uSat.value = 0.62;
    this.post.uniforms.uVignette.value = 0.45;
    this.post.uniforms.uLift.value = 0.05;

    const s = this.scene;
    // the Glass Lagoon: a high, pale sky, the best sun in the game
    s.background = new THREE.Color(0xc4c3bd);
    s.fog = new THREE.Fog(0xc4c3bd, 34, 95);
    s.add(new THREE.HemisphereLight(0xeeeae0, 0x6d6a62, 1.2));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.9);
    sun.position.set(CX - 20, 30, CY + 14); sun.target.position.set(CX, 0, CY);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 28, bottom: -28, near: 1, far: 120 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    s.add(sun); s.add(sun.target);

    this.buildLagoon();
    this.buildIsland();
    this.buildPanels();
    this.buildMachines();
    this.buildBunker();
    this.buildHeaps();
    this.buildLighthouse();
    this.buildJetty();
    this.buildClouds();

    this.sled = sledModel(); s.add(this.sled.group); this.sled.body.add(this.cargo);
    this.wolt = woltMonoModel();
    const cm = (this.wolt.cell.material as THREE.MeshStandardMaterial).clone();
    cm.emissive.setHex(Q_GREEN); cm.color.setHex(0x0c140f); this.wolt.cell.material = cm;
    this.anim = new WoltAnimator(this.wolt);
    s.add(this.wolt.group);

    const rock: Surface = { ...SURFACES.ash, y: 0.005 }, floor: Surface = { ...SURFACES.dustyConcrete, y: 0.04 };
    const b = BUNKER;
    this.ground = new GroundFx((x, z) => x > b.x && x < b.x + b.w && z > b.y && z < b.y + b.h ? floor : rock);
    s.add(this.ground.group);
    this.resize();
    addEventListener('resize', this.onResize);
  }

  private onResize = () => this.resize();
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h); this.post.setSize(w, h);
    this.frustum();
  }
  private frustum() {
    const a = innerWidth / innerHeight, vs = (a < 1 ? VIEW / a * 0.8 : VIEW) * this.zoom;
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
  pick(x: number, y: number): V2 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const d = ray.ray.direction.y;
    if (Math.abs(d) < 1e-6) return null;
    const p = ray.ray.at(-ray.ray.origin.y / d, new THREE.Vector3());
    return { x: p.x, y: p.z };
  }

  // ---------- the set

  private buildLagoon() {
    // the lake that turned to glass: pale, almost a mirror, with long cracks and shards
    const tex = canvasTex(512, 512, c => {
      c.fillStyle = '#9aa3a2'; c.fillRect(0, 0, 512, 512);
      let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 70; i++) {
        c.strokeStyle = `rgba(235,240,238,${0.15 + r() * 0.35})`; c.lineWidth = 0.6 + r() * 1.2;
        c.beginPath(); let x = r() * 512, y = r() * 512; c.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; c.lineTo(x, y); }
        c.stroke();
      }
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.25})`; c.fillRect(r() * 512, r() * 512, 2, 2); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8);
    const glass = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.12, metalness: 0.55, color: 0xd0d6d4 });
    const g = new THREE.PlaneGeometry(400, 400); g.rotateX(-Math.PI / 2);
    const m = mesh(g, glass, CX, -0.12, CY, false); this.scene.add(m);
    // shards standing up out of the glass near the shore
    let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const shard = new THREE.MeshStandardMaterial({ color: 0xbfcac8, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, k = 1.08 + r() * 0.5;
      const sh = mesh(new THREE.TetrahedronGeometry(0.25 + r() * 0.5), shard, CX + Math.cos(a) * RX * k, 0, CY + Math.sin(a) * RY * k);
      sh.rotation.set(r() * 2, r() * 3, r() * 2); sh.scale.y = 1.6 + r();
      this.scene.add(sh);
    }
  }

  private buildIsland() {
    // the rock: an ellipse with a gravel shoulder of glass and stone that slopes into the lake
    const g = new THREE.CircleGeometry(1, 72, 0, Math.PI * 2); g.rotateX(-Math.PI / 2);
    const seg = new THREE.RingGeometry(0, 1.14, 96, 10); seg.rotateX(-Math.PI / 2);
    const p = seg.attributes.position, cols: number[] = [];
    const c1 = new THREE.Color(0xa29d92), c2 = new THREE.Color(0x8b867c), gravel = new THREE.Color(0xbcc2bf), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uz = p.getZ(i), rr = Math.hypot(ux, uz);
      const x = CX + ux * RX, z = CY + uz * RY;
      p.setX(i, x); p.setZ(i, z);
      const bump = Math.sin(x * 0.7) * Math.sin(z * 0.6) * 0.05 + Math.sin(x * 0.23 + z * 0.31) * 0.06;
      p.setY(i, rr < 1 ? bump : -0.12 * ss(rr, 1, 1.14) + bump * (1 - ss(rr, 1, 1.14)));
      const n = 0.5 + 0.5 * Math.sin(x * 1.3 + Math.sin(z * 0.9) * 2);
      tmp.copy(c1).lerp(c2, n * 0.4).lerp(gravel, ss(rr, 0.93, 1.03));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    seg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    seg.computeVertexNormals();
    this.scene.add(mesh(seg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, 0, 0, false));
    g.dispose();
    // rocks (solid in the logic too)
    for (const o of this.st.world.obstacles) if (o.kind === 'rock') {
      const rk = mesh(new THREE.DodecahedronGeometry(0.5, 1), mat(0x6f6b64, { r: 1, flat: true }), o.x + o.w / 2, 0.3, o.y + o.h / 2);
      rk.scale.set(o.w * 1.1, Math.max(o.w, o.h) * 0.8, o.h * 1.1); this.scene.add(rk);
    }
  }

  private buildPanels() {
    for (const pad of this.st.pads) {
      const g = new THREE.Group(); g.position.set(pad.x, 0, 5.5);
      // the stand: two legs and a beam, always there
      for (const dx of [-0.8, 0.8]) g.add(box(0.08, 0.9, 0.08, STEEL, dx, 0.45, 0.25));
      g.add(box(1.8, 0.06, 0.06, STEEL, 0, 0.9, 0.25));
      const panel = new THREE.Group();
      const pv = box(1.9, 0.05, 1.05, PV, 0, 0, 0); panel.add(pv);
      // a thin bright frame
      panel.add(box(1.94, 0.06, 0.04, STEEL, 0, 0.01, 0.53)); panel.add(box(1.94, 0.06, 0.04, STEEL, 0, 0.01, -0.53));
      panel.position.set(0, 1.0, 0.05); panel.rotation.x = 0.4; // tilted to the southern sun, so the camera sees its face
      g.add(panel);
      // the cracked pane (panel 2) and the burnt connector box (panel 3)
      const crack = new THREE.Group();
      for (let k = 0; k < 4; k++) { const l = box(0.6 + k * 0.1, 0.004, 0.015, mat(0xdde6e8, { e: 0xdde6e8, ei: 0.4 }), 0.1 * k - 0.1, 0.03, -0.2 + k * 0.12); l.rotation.y = 0.5 + k * 0.7; crack.add(l); }
      panel.add(crack);
      const conn = box(0.18, 0.12, 0.1, mat(0x231c18), 0.7, 0.55, 0.62); g.add(conn);
      const l = lamp(); l.o.position.set(-0.7, 0.95, 0.32); g.add(l.o);
      this.scene.add(g);
      this.pads.push({ g, panel, crack, conn, lamp: l.m });
    }
  }

  private buildMachines() {
    const s = this.scene;
    // the regulator cabinet, its port, the splitter post
    s.add(box(2, 1.5, 0.9, mat(0x5b6164, { r: 0.7, m: 0.4 }), P.reg.x, 0.75, 12.5));
    s.add(box(1.6, 0.04, 0.02, DARK, P.reg.x, 1.1, 12.96));
    const rl = lamp(); rl.o.position.set(P.reg.x - 0.6, 1.3, 12.97); s.add(rl.o); this.regLamp = rl.m;
    s.add(box(0.3, 0.36, 0.2, STEEL, P.port.x - 0.2, 0.8, 13.05));
    const pl = lamp(); pl.o.position.set(P.port.x - 0.2, 1.05, 13.16); s.add(pl.o); this.portLamp = pl.m;
    this.sparks = glow(0xffd28a, 1.6); this.sparks.position.set(P.reg.x, 1.0, 13.1); s.add(this.sparks);
    s.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 8), STEEL, P.junction.x, 0.7, P.junction.y - 0.7));
    this.junctionBox = box(0.5, 0.4, 0.3, mat(0x50565b, { r: 0.6, m: 0.5 }), P.junction.x, 1.15, P.junction.y - 0.55); s.add(this.junctionBox);
    const jl = lamp(); jl.o.position.set(P.junction.x, 1.4, P.junction.y - 0.38); s.add(jl.o); this.junctionLamp = jl.m;
    // container A with the service crate and the note
    const ca = box(4, 2.2, 2, RUST, 5, 1.1, 14); s.add(ca);
    for (let i = 0; i < 9; i++) s.add(box(0.05, 2.1, 2.02, mat(0x4a382d), 3.2 + i * 0.45, 1.1, 14));
    s.add(box(0.9, 0.5, 0.6, mat(0x55616a, { r: 0.7, m: 0.3 }), P.crateA.x, 0.25, P.crateA.y - 0.75));
    this.crateLid = box(0.92, 0.06, 0.62, mat(0x55616a, { r: 0.7, m: 0.3 }), 0, 0, 0);
    const hinge = new THREE.Group(); hinge.position.set(P.crateA.x, 0.5, P.crateA.y - 1.05); this.crateLid.position.set(0, 0, 0.31); hinge.add(this.crateLid); s.add(hinge);
    const paper = new THREE.MeshStandardMaterial({ color: 0xe0dccf, roughness: 0.9, emissive: 0xe0dccf, emissiveIntensity: 0.1 });
    const note = mesh(new THREE.PlaneGeometry(0.32, 0.42), paper, P.noteA.x, 1.3, 15.02, false); note.rotation.z = 0.06; s.add(note);
  }

  private buildBunker() {
    const s = this.scene, b = BUNKER;
    // half sunk into the rock: low walls, a turf of ash on the roof
    for (const o of this.st.world.obstacles) if (o.kind === 'container' && o.x >= b.x && o.x < b.x + b.w && o.y >= b.y && o.y < b.y + b.h)
      s.add(box(o.w, 2.0, o.h, WALL, o.x + o.w / 2, 1.0, o.y + o.h / 2));
    s.add(box(b.w - 2, 0.06, b.h - 2, CONCRETE, b.x + b.w / 2, 0.02, b.y + b.h / 2));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 1, transparent: true, opacity: 1 });
    this.roof = mesh(new THREE.BoxGeometry(b.w + 0.4, 0.25, b.h + 0.4), roofMat, b.x + b.w / 2, 2.12, b.y + b.h / 2);
    s.add(this.roof);
    this.door = box(DOOR_W, 1.9, 0.18, mat(0x48504f, { r: 0.6, m: 0.5 }), b.door + DOOR_W / 2, 0.95, b.y + 0.5); s.add(this.door);
    // bench, terminal, cradle, the dead accumulators, the slot for the storage
    s.add(box(2, 0.9, 1, mat(0x5c5348), 14, 0.45, 21.5));
    s.add(box(0.3, 0.2, 0.2, DARK, 13.3, 1.0, 21.4));
    this.benchLight = new THREE.PointLight(0xffd9a0, 0, 5, 1.6); this.benchLight.position.set(14, 1.8, 22); s.add(this.benchLight);
    s.add(box(2, 1.3, 1, mat(0x3c4245, { r: 0.6, m: 0.4 }), 22, 0.65, 20.5));
    this.screen = new THREE.MeshStandardMaterial({ color: 0x0a0d0c, emissive: Q_GREEN, emissiveIntensity: 0 });
    s.add(mesh(new THREE.PlaneGeometry(1.3, 0.6), this.screen, 22, 1.05, 21.02, false));
    this.screenBar = mesh(new THREE.PlaneGeometry(1.1, 0.06), new THREE.MeshBasicMaterial({ color: Q_GREEN }), 22, 0.85, 21.03, false);
    this.screenBar.scale.x = 0.001; s.add(this.screenBar);
    for (const dx of [-0.3, 0.3]) s.add(box(0.08, 0.06, 1.4, mat(0x8a5a3a, { r: 0.4, m: 0.7 }), P.cradle.x + dx, 0.07, P.cradle.y));
    for (let i = 0; i < 4; i++) s.add(box(0.42, 0.5, 0.6, mat(0x33363a), 21.3 + i * 0.47, 0.25, 25.5));
    this.storage = new THREE.Group();
    for (let i = 0; i < 4; i++) this.storage.add(box(0.42, 0.55, 0.6, mat(0x3a3d40), -0.7 + i * 0.47, 0.28, 0));
    this.storage.add(box(1.9, 0.08, 0.66, STEEL, 0, 0.6, 0));
    const sl = lamp(); sl.o.position.set(0.85, 0.7, 0.33); this.storage.add(sl.o); this.storeLamp = sl.m;
    this.storage.position.set(P.storeSlot.x, 0, P.storeSlot.y + 0.6); this.storage.visible = false; s.add(this.storage);
  }

  private buildHeaps() {
    for (const h of this.st.heaps) { const g = heapModel(h); this.heaps.set(h.id, g); this.scene.add(g); }
  }

  private buildLighthouse() {
    const s = this.scene, { x, y } = P.lighthouse;
    const white = mat(0xd8d4ca, { r: 0.9 }), red = mat(0x7a3a30, { r: 0.9 });
    for (let i = 0; i < 5; i++) s.add(mesh(new THREE.CylinderGeometry(0.62 - i * 0.04 - 0.04, 0.62 - i * 0.04, 1.1, 14), i % 2 ? red : white, x, 1.1 * i + 0.55 + 0.6, y));
    this.lantern = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe6b0, emissiveIntensity: 0 });
    s.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 12), this.lantern, x, 6.75, y));
    s.add(mesh(new THREE.ConeGeometry(0.55, 0.5, 12), DARK, x, 7.3, y));
    this.beam = new THREE.Group(); this.beam.position.set(x, 6.75, y);
    const cone = new THREE.ConeGeometry(2.6, 26, 20, 1, true); cone.translate(0, -13, 0); cone.rotateZ(Math.PI / 2);
    const bm = new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.beam.add(new THREE.Mesh(cone, bm));
    this.beam.visible = false; s.add(this.beam);
    this.beamLight = new THREE.SpotLight(0xffe6b0, 0, 40, 0.25, 0.6, 1); this.beamLight.position.set(x, 6.75, y);
    s.add(this.beamLight); s.add(this.beamLight.target);
    // the dome of the greenhouse, far out on the glass, and its answer
    const dome = mesh(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9c0bd, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.7 }), P.dome.x, -0.1, P.dome.y, false);
    s.add(dome);
    this.domeBlink = glow(0xffffff, 6); this.domeBlink.position.set(P.dome.x - 3, 4, P.dome.y + 6); this.domeBlink.material.opacity = 0; s.add(this.domeBlink);
  }

  private buildJetty() {
    const s = this.scene, wood = mat(0x6b5f50, { r: 0.95 });
    for (let i = 0; i < 7; i++) s.add(box(2.2, 0.08, 0.32, wood, 22.5, 0.05, 31.8 + i * 0.42));
    // the land yacht that brought Wolt here, its sail down
    const g = new THREE.Group(); g.position.set(26.2, 0, 33.6); g.rotation.y = 0.3;
    g.add(box(1.4, 0.12, 3.4, wood, 0, 0.32, 0));
    for (const dx of [-0.7, 0.7]) g.add(box(0.08, 0.08, 3.6, STEEL, dx, 0.12, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 6), STEEL, 0, 2.4, 0.4));
    const sail = mesh(new THREE.BoxGeometry(0.12, 0.4, 2.2), mat(0xb0703e, { r: 1 }), 0.2, 0.55, -0.4);
    g.add(sail);
    s.add(g);
  }

  private buildClouds() {
    const tex = softDisc();
    for (const c of CLOUDS) {
      const m = mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0x1e2226, transparent: true, opacity: 0.32, depthWrite: false }), 0, 0.08, c.y, false);
      m.scale.set(c.r * 2.6, 1, c.r * 2.4); m.renderOrder = 2;
      this.scene.add(m); this.shadows.push(m);
    }
  }

  // ---------- per frame

  private cable(key: string, a: V2, b: V2, ya: number, yb: number) {
    let m = this.cables.get(key);
    if (!m) {
      const pts = [new THREE.Vector3(a.x, ya, a.y), new THREE.Vector3(a.x + (b.x - a.x) * 0.15, 0.03, a.y + (b.y - a.y) * 0.15), new THREE.Vector3(a.x + (b.x - a.x) * 0.85, 0.03, a.y + (b.y - a.y) * 0.85), new THREE.Vector3(b.x, yb, b.y)];
      m = mesh(cableTube(pts, 0.035), this.flowMat, 0, 0, 0, true);
      this.cables.set(key, m); this.scene.add(m);
    }
  }

  frame(dt: number) {
    const st = this.st, t = st.t, w = this.wolt;
    const flowing = (st.regOk || st.bridged) && st.supply > 1;

    // panels: on their stands, cracked or burnt until fitted, a lamp that says linked
    st.pads.forEach((p: Pad, i) => {
      const v = this.pads[i];
      v.panel.visible = p.panel;
      v.crack.visible = p.fault === 'pane';
      (v.conn as THREE.Mesh).material = p.fault === 'connector' ? mat(0x231c18) : STEEL;
      setLamp(v.lamp, !p.panel ? 'off' : p.fault ? 'blink' : p.linked && flowing ? 'ok' : 'off', t + i);
      if (p.linked) this.cable('pad' + i, { x: p.x, y: 5.9 }, { x: P.junction.x, y: P.junction.y - 0.5 }, 0.5, 0.95);
    });
    this.junctionBox.visible = st.junction;
    setLamp(this.junctionLamp, st.junction ? (flowing ? 'ok' : 'off') : 'off', t);
    if (st.junction) this.cable('junction', { x: P.junction.x, y: P.junction.y - 0.4 }, { x: P.reg.x, y: 12.1 }, 0.95, 0.6);
    if (st.fed) this.cable('feed', { x: P.reg.x + 0.6, y: 12.9 }, { x: BUNKER.door - 0.3, y: BUNKER.y }, 0.4, 1.2);
    setLamp(this.regLamp, st.regOk ? 'ok' : st.bridged ? 'blink' : st.overloaded ? 'bad' : 'blink', t);
    setLamp(this.portLamp, st.plugged ? 'ok' : flowing ? 'blink' : 'off', t);
    this.sparks.material.opacity = st.overloaded && !st.regOk ? (Math.random() < 0.15 ? 0.9 : 0.05) : st.bridged ? 0.3 + Math.random() * 0.4 : 0;
    this.flowMat.emissiveIntensity = flowing ? 0.45 + Math.sin(t * 6) * 0.15 : 0;
    this.crateLid.parent!.rotation.x = st.crateOpen ? -1.9 : 0;

    // the bunker: the door slides aside, the roof lifts away while Wolt is inside
    this.door.position.x = BUNKER.door + DOOR_W / 2 + ss(st.doorOpen, 0, 1) * (DOOR_W - 0.2);
    const b = BUNKER, inside = st.pos.x > b.x && st.pos.x < b.x + b.w && st.pos.y > b.y - 0.3 && st.pos.y < b.y + b.h;
    const rm = this.roof.material as THREE.MeshStandardMaterial;
    rm.opacity += ((inside ? 0.08 : 1) - rm.opacity) * Math.min(1, dt * 5); this.roof.castShadow = rm.opacity > 0.5;
    this.screen.emissiveIntensity = st.scanned.has('terminal') ? (st.terminalOn ? 0.9 : 0.25 + (Math.sin(t * 4) > 0 ? 0.15 : 0)) : 0;
    this.screenBar.scale.x = Math.max(0.001, st.progress); this.screenBar.position.x = 22 - 0.55 + 0.55 * st.progress;
    this.storage.visible = st.storage;
    setLamp(this.storeLamp, st.soc > 0.95 ? 'ok' : 'blink', t);
    this.benchLight.intensity = st.doorOpen >= 1 && flowing ? (st.benchOn ? 2.4 + Math.sin(t * 30) * 0.6 : 1.2) : 0;

    // heaps sink to rubble when taken apart
    for (const h of st.heaps) { const g = this.heaps.get(h.id)!; g.scale.y += ((h.done ? 0.15 : 1) - g.scale.y) * Math.min(1, dt * 3); }
    // piles on the ground
    const live = new Set<number>();
    for (const p of st.piles) {
      live.add(p.id);
      if (!this.piles.has(p.id)) { const o = pileModel(p.item); o.position.set(p.at.x, 0, p.at.y); this.piles.set(p.id, o); this.scene.add(o); }
    }
    for (const [id, o] of this.piles) if (!live.has(id)) { this.scene.remove(o); this.piles.delete(id); }

    // clouds drift over the island
    CLOUDS.forEach((c, i) => { this.shadows[i].position.x = cloudX(c, t); });

    // Wolt
    w.group.position.set(st.pos.x, -st.bog * 0.12, st.pos.y);
    w.group.rotation.y = Math.PI / 2 - st.facing;
    w.group.updateMatrixWorld(true);
    const p = w.group.position;
    if (!this.prevPos) { this.prevPos = p.clone(); this.prevYaw = w.group.rotation.y; }
    const yw = w.group.rotation.y;
    const sd = dt > 0 ? ((p.x - this.prevPos.x) * Math.sin(yw) + (p.z - this.prevPos.z) * Math.cos(yw)) / dt : 0;
    const ns = this.spd + (sd - this.spd) * Math.min(1, dt * 10);
    this.acc += ((dt > 0 ? (ns - this.spd) / dt : 0) - this.acc) * Math.min(1, dt * 6);
    this.spd = ns;
    let dy = w.group.rotation.y - this.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yawRate += ((dt > 0 ? dy / dt : 0) - this.yawRate) * Math.min(1, dt * 8);
    this.prevPos.copy(p); this.prevYaw = w.group.rotation.y;
    if (st.towing !== this.prevTowing) this.gesture = { pose: 'back', t: 0.8 };
    this.prevTowing = st.towing;
    if (this.gesture && (this.gesture.t -= dt) <= 0) this.gesture = null;
    const arm: ArmPose = st.work || st.crafting ? 'work' : st.bridged || st.plugged || st.reading ? 'reach' : this.gesture?.pose ?? 'rest';
    let tension = 0, pullFrom: THREE.Vector3 | null = null;
    if (st.towing && st.towTaut && this.spd > 0.1) {
      tension = LOADS.bricks.drag * (1 + st.cargo.length * 0.4);
      pullFrom = new THREE.Vector3(st.sled.pos.x - st.pos.x, 0, st.sled.pos.y - st.pos.y).normalize();
    }
    const plugTo = st.plugged ? new THREE.Vector3(P.port.x - 0.2, 0, 13.1) : st.bridged ? new THREE.Vector3(P.reg.x, 0, 13) : null;
    this.anim.update({
      dt, time: t, speed: this.spd, yawRate: this.yawRate, accel: this.acc, strain: st.strain,
      cableTo: plugTo, tension, pullFrom, reelSpin: 0, arm, energy: st.battery / 100, lamp: 0.4,
      lookAt: (() => { const h = st.hint(); return h ? new THREE.Vector3(h.at.x, 0, h.at.y) : null; })(),
    });
    const cm = w.cell.material as THREE.MeshStandardMaterial;
    cm.emissiveIntensity = st.bridged ? 1.4 + Math.random() * 0.8 : 0.7 + Math.sin(t * 2) * 0.15;
    this.ground.wheel({ x: p.x, z: p.z, yaw: yw, speed: this.spd, accel: this.acc, yawRate: this.yawRate, slip: this.anim.slip }, dt);

    // Wolt's own cable into the port, or his arm in the regulator as the fuse
    if (this.ownCable) { this.scene.remove(this.ownCable); this.ownCable.geometry.dispose(); this.ownCable = null; }
    if (st.plugged) {
      const a = w.cableExit.getWorldPosition(new THREE.Vector3()), bb = new THREE.Vector3(P.port.x - 0.2, 0.8, 13.15);
      const mid = a.clone().lerp(bb, 0.5); mid.y = 0.1;
      this.ownCable = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, bb), 10, 0.02, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: PAL.flow, emissiveIntensity: 0.6 }), 0, 0, 0, false);
      this.scene.add(this.ownCable);
    }

    // the sled, its cargo and the rope
    this.sled.group.position.set(st.sled.pos.x, 0, st.sled.pos.y);
    let rr = (Math.PI / 2 - st.sled.angle) - this.sled.group.rotation.y; rr = Math.atan2(Math.sin(rr), Math.cos(rr));
    this.sled.group.rotation.y += rr * Math.min(1, dt * 5);
    animateDragged(this.sled, st.sled, st.towing && st.towTaut && this.spd > 0.15, t, dt);
    const key = st.cargo.join(',');
    if (key !== this.cargoKey) { this.cargoKey = key; this.cargo.clear(); st.cargo.forEach((c, i) => { const o = cargoModel(c); o.position.set(0, 0.12 + Math.floor(i / 2) * 0.32, (i % 2 - 0.5) * 0.36); this.cargo.add(o); }); }
    this.ground.drag(st.sled, { x: st.sled.pos.x, z: st.sled.pos.y, yaw: this.sled.group.rotation.y, width: 0.6, dragging: this.sled.drag > 0.4, speed: this.spd }, dt);
    if (this.rope) { this.scene.remove(this.rope); this.rope.geometry.dispose(); this.rope = null; }
    if (st.towing) {
      this.sled.group.updateMatrixWorld(true);
      this.rope = mesh(ropeGeometry(w.hitch.getWorldPosition(new THREE.Vector3()), this.sled.eye.getWorldPosition(new THREE.Vector3()), ROPE), mat(0x6b6355, { r: 0.9 }), 0, 0, 0, true);
      this.scene.add(this.rope);
    }
    this.ground.setWind(0.6, 0.1);
    this.ground.setScale(pxPerMetre(this.renderer, this.camera));
    this.ground.update(dt);

    // the ending: the lighthouse turns, the dome answers (docs/SPOILER-WYSPA.md)
    const L = st.lighthouseT;
    this.beam.visible = L >= 0;
    if (L >= 0) {
      const on = ss(L, 0.5, 3);
      this.lantern.emissiveIntensity = on * 3;
      this.beam.rotation.y = -L / BEAM_TURN * Math.PI * 2;
      (this.beam.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.18 * on;
      this.beamLight.intensity = 60 * on;
      const a = this.beam.rotation.y;
      this.beamLight.target.position.set(P.lighthouse.x + Math.cos(a) * 20, 0, P.lighthouse.y - Math.sin(a) * 20);
      // three short, a pause, three short
      const k = L - 14;
      const blink = k > 0 ? ((): number => { const c = k % 4.2; const i = Math.floor(c / 0.45); return i < 3 && c % 0.45 < 0.25 ? 1 : 0; })() : 0;
      this.domeBlink.material.opacity += (blink * 0.95 - this.domeBlink.material.opacity) * Math.min(1, dt * 20);
    }

    // reserve look: grey but green when Wolt runs out (and while he is the fuse)
    this.grey += ((st.battery < 5 ? 1 : 0) - this.grey) * Math.min(1, dt * 2);
    this.post.uniforms.uGrey.value = this.grey;

    // camera: follows Wolt; at the end it rises and turns to the lighthouse and the dome
    const end = L >= 0 ? ss(L, 1, 9) : 0;
    const zoom = 1 + 0.25 * Math.exp(-t / 2.5) + end * 1.4;
    if (Math.abs(zoom - this.zoom) > 1e-4) { this.zoom = zoom; this.frustum(); }
    const follow = new THREE.Vector3(THREE.MathUtils.clamp(st.pos.x, 7, IS_W - 7), 0, THREE.MathUtils.clamp(st.pos.y, 6, IS_H - 4));
    const want = follow.lerp(new THREE.Vector3(36, 0, 6), end);
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 2.5));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
    this.post.render(this.scene, this.camera);
  }
}

/** The sled: runners and a plank deck (the cargo rides on top). */
function sledModel(): LoadModel {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const wood = mat(0x6b5f50, { r: 0.95 });
  for (const x of [-0.3, 0.3]) { g.add(box(0.06, 0.06, 0.95, DARK, x, 0.03, 0)); g.add(box(0.06, 0.06, 0.12, DARK, x, 0.08, 0.48)); }
  g.add(box(0.72, 0.04, 0.9, wood, 0, 0.09, 0));
  const eye = new THREE.Object3D(); eye.position.set(0, 0.09, 0.48); g.add(eye);
  return { group: root, eye, body: g, drag: 0 };
}

function cargoModel(id: ItemId): THREE.Object3D {
  const g = new THREE.Group();
  if (id === 'battery') { g.add(box(0.32, 0.26, 0.3, mat(0x3a3d40), 0, 0.13, 0)); g.add(box(0.05, 0.05, 0.05, mat(0x8a5a3a, { m: 0.7, r: 0.4 }), -0.08, 0.28, 0)); g.add(box(0.05, 0.05, 0.05, mat(0x8a5a3a, { m: 0.7, r: 0.4 }), 0.08, 0.28, 0)); }
  else if (id === 'frame') { for (const z of [-0.2, 0.2]) g.add(box(0.66, 0.04, 0.04, STEEL, 0, 0.04, z)); for (const x of [-0.31, 0.31]) g.add(box(0.04, 0.04, 0.44, STEEL, x, 0.04, 0)); }
  else g.add(box(0.68, 0.05, 0.42, PV, 0, 0.04, 0));
  return g;
}

function pileModel(id: ItemId): THREE.Object3D {
  const g = new THREE.Group();
  const big = id === 'battery' || id === 'frame' || id === 'panel';
  if (big) return cargoModel(id);
  for (let i = 0; i < 3; i++) { const b = box(0.16, 0.08, 0.12, mat(ITEM_COL[id] ?? 0x777777, { r: 0.8 }), (i - 1) * 0.12, 0.04 + (i % 2) * 0.06, (i % 2) * 0.08); b.rotation.y = i * 0.7; g.add(b); }
  return g;
}

function heapModel(h: Heap): THREE.Group {
  const g = new THREE.Group(), o = h.obstacle;
  g.position.set(o.x + o.w / 2, 0, o.y + o.h / 2);
  if (h.id.startsWith('wreck')) {
    const pv = box(1.8, 0.05, 1.0, PV, 0, 0.25, 0); pv.rotation.set(0.3, 0.4, -0.25); g.add(pv);
    for (let i = 0; i < 3; i++) { const l = box(0.06, 0.6, 0.06, STEEL, -0.6 + i * 0.6, 0.15, 0.3); l.rotation.z = 0.9 + i; g.add(l); }
  } else if (h.id === 'lamp') {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6), STEEL, 0, 1.2, 0));
    const head = box(0.4, 0.14, 0.2, DARK, 0.18, 2.4, 0); head.rotation.z = -0.3; g.add(head);
  } else if (h.id === 'barrel') {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.85, 12), RUST, 0, 0.42, 0));
  } else if (h.id === 'crateB') {
    const c = box(4, 2, 2, mat(0x4f5b55, { r: 0.9 }), 0, 1, 0); c.rotation.z = 0.06; g.add(c);
    for (let i = 0; i < 9; i++) g.add(box(0.05, 1.96, 2.02, mat(0x3d4842), -1.8 + i * 0.45, 1, 0));
  } else if (h.id === 'boat') {
    const hull = mesh(new THREE.CylinderGeometry(0.6, 0.6, 3, 10, 1, true, 0, Math.PI), mat(0x5a5248, { r: 0.95 }), 0, 0.6, 0);
    hull.rotation.set(0, 0, Math.PI / 2); hull.rotation.x = Math.PI; g.add(hull);
    g.add(box(0.3, 0.3, 0.4, mat(0x3a3d40), 0.6, 0.25, 0.1)); g.add(box(0.3, 0.3, 0.4, mat(0x3a3d40), -0.4, 0.25, -0.1));
  } else {
    let s = h.id.charCodeAt(1) * 31; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 7; i++) { const b = box(0.2 + r() * 0.4, 0.1 + r() * 0.25, 0.2 + r() * 0.3, [RUST, STEEL, DARK, mat(0x8a5a3a)][i % 4], (r() - 0.5) * 0.9, 0.1, (r() - 0.5) * 0.7); b.rotation.set(r(), r() * 3, r()); g.add(b); }
  }
  g.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; } });
  return g;
}
