import * as THREE from 'three';
import { mat, mesh, box } from '../../render/models';
import { Models, place } from '../../render/assets';
import { woltMonoModel, WoltMono, WoltAnimator } from '../../render/wolt';
import { Returns, PLACE, P2 } from '../sim/returns';

/**
 * Renders "Powroty" with the game's own camera (orthographic, tilted, looking north) at dusk,
 * so lights carry the meaning: a lit window is a living home. No text in the world.
 */
const CAM_DIR = new THREE.Vector3(0, 40, 44).normalize();
const CAM_DIST = 70;
const VIEW_H = 8; // half the visible height in metres
const DUSK = 0x566164;
const WARM = 0xffb866;
const GLOW = 0xbfe6d0;
const N_MOTES = 260, N_ASH = 500;

const v3 = (p: P2, y = 0) => new THREE.Vector3(p.x, y, p.y);

/** The wall sign in its three ages. Wojtek: a wheel, a rectangle on it, an arm sticking out. */
export function drawSymbol(c: CanvasRenderingContext2D, stage: number, s: number) {
  c.save(); c.translate(s / 2, s * 0.52); c.scale(s / 64, s / 64); c.lineCap = 'round'; c.lineJoin = 'round';
  if (stage === 1) {
    c.strokeStyle = 'rgba(214,168,92,.9)'; c.lineWidth = 1.8;
    const j = (a: number) => Math.sin(a * 12.9898) * 1.6;
    c.beginPath(); for (let a = 0; a <= 6.6; a += 0.5) c.lineTo(Math.cos(a) * 7 + j(a), 10 + Math.sin(a) * 7 + j(a + 3)); c.stroke();
    c.beginPath(); c.moveTo(-9, 3); c.lineTo(-8, -13); c.lineTo(9, -12); c.lineTo(8, 4); c.closePath(); c.stroke(); c.strokeRect(-4, -9, 6, 5);
    c.beginPath(); c.moveTo(9, -6); c.lineTo(18, -11); c.lineTo(22, -15); c.moveTo(18, -11); c.lineTo(23, -9); c.stroke();
  } else if (stage === 2) {
    c.strokeStyle = 'rgba(214,168,92,.95)'; c.lineWidth = 2.2;
    c.beginPath(); c.arc(0, 10, 7, 0, 7); c.stroke(); c.strokeRect(-9, -13, 18, 16); c.strokeRect(-4, -9, 7, 5);
    c.beginPath(); c.moveTo(9, -6); c.lineTo(19, -12); c.lineTo(23, -16); c.moveTo(19, -12); c.lineTo(24, -10); c.stroke();
  } else if (stage === 3) {
    c.fillStyle = c.strokeStyle = 'rgba(190,100,62,.97)'; c.lineWidth = 3.2;
    c.beginPath(); c.arc(0, 10, 7, 0, 7); c.fill(); c.fillRect(-9, -13, 18, 16);
    c.beginPath(); c.moveTo(9, -6); c.lineTo(22, -14); c.stroke();
  }
  c.restore();
}

function canvasTex(size: number) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return { c: cv.getContext('2d')!, tex, size };
}

function glowTex(rgb: string) {
  const t = canvasTex(128), g = t.c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.25, `rgba(${rgb},.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
  t.c.fillStyle = g; t.c.fillRect(0, 0, 128, 128); t.tex.needsUpdate = true;
  return t.tex;
}

interface PersonMesh { group: THREE.Group; body: THREE.Group; arm: THREE.Mesh; cane: THREE.Mesh }

export class ReturnsView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  readonly renderer: THREE.WebGLRenderer;
  private camTarget = new THREE.Vector3();
  private wolt: WoltMono; private woltAnim: WoltAnimator;
  private lastYaw = 0; private lastSpeed = 0;
  private lampLight: THREE.PointLight; private lampBulb: THREE.MeshStandardMaterial;
  private winLight: THREE.PointLight; private winMat: THREE.MeshStandardMaterial;
  private cableOn: THREE.Line; private cableOff: THREE.Line; private cableMat: THREE.LineBasicMaterial;
  private symbolTex = canvasTex(128); private symbolPlane: THREE.Mesh; private symbolShown = -1;
  private tallyTex = canvasTex(256); private tallyShown = -1;
  private people: PersonMesh[] = [];
  private deer: { group: THREE.Group; antlers: THREE.Group; coat: THREE.MeshStandardMaterial };
  private antlersLeft: THREE.Group;
  private gifts: THREE.Object3D[] = [];
  private giftLight: THREE.PointLight;
  private grass: { o: THREE.Object3D; k: number }[] = [];
  private path!: THREE.Mesh;
  private ringCable: THREE.Mesh; private ringShelter: THREE.Mesh;
  private shelterLight: THREE.PointLight;
  private farGlows: THREE.Sprite[] = [];
  private horizon: THREE.Sprite; private horizonCore: THREE.Sprite;
  private motes: THREE.Points; private motePos: Float32Array; private moteVel: Float32Array; private moteLife: Float32Array; private moteNext = 0;
  private ash: THREE.Points; private ashPos: Float32Array;
  private hemi: THREE.HemisphereLight;

  constructor(private game: Returns, container: HTMLElement, private models: Models = new Map()) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);
    this.renderer = r;
    const s = this.scene;
    s.background = new THREE.Color(DUSK);
    s.fog = new THREE.Fog(DUSK, CAM_DIST - 12, CAM_DIST + 62);
    this.hemi = new THREE.HemisphereLight(0xa9bbc0, 0x4a4f4d, 1.7); s.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xc3d2da, 1.0);
    moon.position.set(22, 70, 38); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -80, right: 80, top: 50, bottom: -50, near: 1, far: 240 });
    moon.shadow.bias = -0.0008; moon.target.position.set(60, 0, -5); s.add(moon, moon.target);

    this.buildGround();
    this.buildShelter();
    this.cableMat = new THREE.LineBasicMaterial({ color: 0x1e2325 });
    [this.cableOn, this.cableOff] = this.buildLine();
    const h = this.buildHouse();
    this.winMat = h.winMat; this.winLight = h.winLight; this.symbolPlane = h.symbol;
    const lamp = this.buildLamp(); this.lampLight = lamp.light; this.lampBulb = lamp.bulb;
    this.buildBench();
    this.buildFar();
    this.deer = this.buildDeer(); s.add(this.deer.group);
    this.antlersLeft = this.buildAntlers(0xc9cdc4); this.antlersLeft.rotation.z = 1.2; this.antlersLeft.visible = false; s.add(this.antlersLeft);
    for (let i = 0; i < 5; i++) { const p = this.buildPerson(); p.group.visible = false; s.add(p.group); this.people.push(p); }
    this.giftLight = new THREE.PointLight(WARM, 0, 7, 1.6); this.buildGifts();

    this.wolt = woltMonoModel(); s.add(this.wolt.group);
    this.woltAnim = new WoltAnimator(this.wolt);

    const ring = (color: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.06; s.add(m); return m;
    };
    this.ringCable = ring(WARM); this.ringCable.position.x = PLACE.cableEnd.x; this.ringCable.position.z = PLACE.cableEnd.y;
    this.ringShelter = ring(GLOW); this.ringShelter.position.x = PLACE.shelter.x; this.ringShelter.position.z = PLACE.shelter.y;
    this.shelterLight = new THREE.PointLight(GLOW, 1.2, 9, 1.5); this.shelterLight.position.set(PLACE.shelter.x, 1.2, PLACE.shelter.y - 0.6); s.add(this.shelterLight);

    // what is beyond the cliff: a pale glow that everything bright leaks towards
    const gt = glowTex('191,230,208');
    this.horizon = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, depthTest: false, transparent: true, opacity: 0.3, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.horizon.scale.setScalar(60); this.horizon.position.set(PLACE.cliffX + 12, 1, -5); s.add(this.horizon);
    this.horizonCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, depthTest: false, transparent: true, opacity: 0.4, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.horizonCore.scale.setScalar(12); this.horizonCore.position.copy(this.horizon.position); s.add(this.horizonCore);

    // motes: every light sheds them and they all drift the same way
    this.motePos = new Float32Array(N_MOTES * 3).fill(-999); this.moteVel = new Float32Array(N_MOTES * 3); this.moteLife = new Float32Array(N_MOTES).fill(99);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffd08a, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.motes.frustumCulled = false; s.add(this.motes);
    this.ashPos = new Float32Array(N_ASH * 3);
    for (let i = 0; i < N_ASH; i++) { this.ashPos[i * 3] = Math.random() * 80 - 40; this.ashPos[i * 3 + 1] = Math.random() * 16; this.ashPos[i * 3 + 2] = Math.random() * 50 - 30; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(this.ashPos, 3));
    this.ash = new THREE.Points(ag, new THREE.PointsMaterial({ color: 0xc9ccc6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    this.ash.frustumCulled = false; s.add(this.ash);

    this.camTarget.set(game.wolt.x + 6, 0, game.wolt.y - 2);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight, a = w / h;
    this.renderer.setSize(w, h);
    const hh = a < 1.2 ? VIEW_H * 1.2 / a : VIEW_H;
    Object.assign(this.camera, { left: -hh * a, right: hh * a, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- build
  private buildGround() {
    const s = this.scene;
    // a slab of ash that ends in a cliff on the right
    const g = box(220, 30, 160, mat(0x8a8d86, { r: 1 }), PLACE.cliffX - 110, -15, -20); g.castShadow = false; s.add(g);
    // the drop beyond the cliff: dark, so the glow down there reads
    s.add(mesh(new THREE.PlaneGeometry(120, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x232a2c, fog: false }), PLACE.cliffX + 60, -28, -20, false));
    this.path = mesh(new THREE.PlaneGeometry(PLACE.lamp.x - PLACE.shelter.x, 1.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x5c5f5a, transparent: true, opacity: 0, depthWrite: false }), (PLACE.lamp.x + PLACE.shelter.x) / 2, 0.02, 0.8, false);
    s.add(this.path);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const scatter = (names: string[], n: number, scale: [number, number], area: [number, number, number, number]) => {
      for (let i = 0; i < n; i++) {
        const x = area[0] + rnd() * (area[1] - area[0]), z = area[2] + rnd() * (area[3] - area[2]);
        if (Math.abs(z) < 2.2 && rnd() < 0.8) continue; // keep the track clear
        if (Math.abs(x - PLACE.house.x) < 6 && Math.abs(z - PLACE.house.y) < 5) continue;
        if (Math.abs(x - PLACE.shelter.x) < 5 && Math.abs(z - PLACE.shelter.y + 3) < 5) continue;
        const o = place(this.models, names[Math.floor(rnd() * names.length)], scale[0] + rnd() * (scale[1] - scale[0]), rnd() * 6.3);
        o.position.set(x, 0, z); s.add(o);
      }
    };
    scatter(['DeadTree_1', 'DeadTree_2', 'DeadTree_3', 'DeadTree_4', 'DeadTree_5'], 26, [0.45, 0.85], [-20, PLACE.cliffX - 4, -34, -9]);
    scatter(['DeadTree_2', 'DeadTree_4'], 5, [0.4, 0.7], [14, 70, 5, 12]);
    scatter(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], 22, [0.35, 0.9], [-20, PLACE.cliffX - 2, -30, 14]);
    scatter(['Pebble_Round_2', 'Pebble_Square_1', 'Pebble_Square_3', 'Pebble_Round_4'], 70, [0.6, 1.4], [-10, PLACE.cliffX - 1, -14, 12]);
    scatter(['Grass_Wispy_Short'], 60, [0.7, 1.2], [-10, PLACE.cliffX - 2, -14, 12]);
    // grass that comes back around the lamp once it has light for years
    for (let i = 0; i < 46; i++) {
      const a = rnd() * 6.3, d = 1.5 + rnd() * 9;
      const x = PLACE.lamp.x + 2 + Math.cos(a) * d, z = PLACE.lamp.y + 1 + Math.sin(a) * d * 0.7;
      if (x > 82.5 && x < 98 && z > -10 && z < 0.8) continue; // keep the yard and the house clear
      const o = place(this.models, 'Grass_Wispy_Tall', 1, rnd() * 6.3);
      o.traverse(m => { const mm = m as THREE.Mesh; if (mm.isMesh) { const nm = (mm.material as THREE.MeshStandardMaterial).clone(); nm.color.set(0x7fae6a); nm.onBeforeCompile = () => {}; mm.material = nm; mm.castShadow = false; } });
      o.position.set(x, 0, z); o.visible = false; s.add(o);
      this.grass.push({ o, k: 0.25 + (d / 10.5) * 0.75 });
    }
  }

  private buildShelter() {
    const s = this.scene, g = new THREE.Group(), R = 3, L = 6;
    const hull = mat(0x3a4143, { r: 0.85, m: 0.3 });
    const arch = mesh(new THREE.CylinderGeometry(R, R, L, 22, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), hull, 0, 0, 0);
    (arch.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; g.add(arch);
    for (const z of [L / 2, -L / 2]) g.add(mesh(new THREE.CircleGeometry(R, 22, 0, Math.PI), hull, 0, 0, z));
    for (let k = -2; k <= 2; k++) g.add(mesh(new THREE.TorusGeometry(R + 0.03, 0.05, 5, 20, Math.PI), mat(0x2a2f31, { r: 0.7, m: 0.4 }), 0, 0, k * 1.4));
    g.add(box(1.5, 2.1, 0.08, mat(0x101314), 0, 1.05, L / 2 + 0.03));
    g.add(mesh(new THREE.PlaneGeometry(1.1, 1.7), new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.16, fog: false }), 0, 1, L / 2 + 0.08, false));
    g.position.set(PLACE.shelter.x, 0, PLACE.shelter.y - 3.6); s.add(g);
    // a standing slab with a scratch for every year
    const slab = new THREE.Group();
    slab.add(box(2.4, 3, 0.45, mat(0x4b5052, { r: 1 }), 0, 1.5, 0));
    const face = mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.MeshBasicMaterial({ map: this.tallyTex.tex, transparent: true, fog: false }), 0, 1.5, 0.235, false);
    slab.add(face); slab.rotation.x = -0.12; slab.rotation.y = 0.2;
    slab.position.set(PLACE.slab.x, 0, PLACE.slab.y); s.add(slab);
  }

  private curve(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 18) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  private buildLine(): [THREE.Line, THREE.Line] {
    const s = this.scene, wood = mat(0x23282a, { r: 0.95 }), H = 7;
    const tops: THREE.Vector3[] = [];
    for (const p of PLACE.poles) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.15, H, 7), wood, 0, H / 2, 0));
      g.add(box(1.8, 0.12, 0.12, wood, 0, H - 0.5, 0));
      g.position.set(p.x, 0, p.y); g.rotation.z = (p.x % 7 - 3) * 0.012; s.add(g);
      tops.push(new THREE.Vector3(p.x, H - 0.45, p.y));
    }
    const dead = new THREE.LineBasicMaterial({ color: 0x1e2325 });
    tops.unshift(new THREE.Vector3(PLACE.poles[0].x - 15, H - 0.45, PLACE.poles[0].y));
    for (let i = 0; i < tops.length - 1; i++) s.add(new THREE.Line(this.curve(tops[i], tops[i + 1], 1.1), dead));
    const last = tops[tops.length - 1];
    const eave = new THREE.Vector3(PLACE.house.x - PLACE.house.w / 2, 4.6, PLACE.house.y + 1);
    const on = new THREE.Line(this.curve(last, eave, 1.6, 24), this.cableMat);
    const end = v3(PLACE.cableEnd, 0.05), mid = last.clone().lerp(end, 0.5); mid.y = 2.2; mid.x -= 0.6;
    const off = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(last, mid, end).getPoints(18)), this.cableMat);
    s.add(on, off);
    return [on, off];
  }

  private buildHouse() {
    const s = this.scene, { x, y, w, d } = PLACE.house, FL = 1.3, WH = 2.7;
    const g = new THREE.Group(); g.position.set(x, 0, y);
    const wood = mat(0x2b3133, { r: 0.95 }), darkWood = mat(0x1d2223, { r: 0.95 });
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, FL, 6), darkWood, sx * (w / 2 - 0.3), FL / 2, sz * (d / 2 - 0.3)));
    g.add(box(w + 0.5, 0.16, d + 1.6, darkWood, 0, FL, 0.5));                 // floor with a porch
    g.add(box(w, WH, d, wood, 0, FL + WH / 2, 0));
    const tri = new THREE.Shape(); tri.moveTo(-w / 2 - 0.5, 0); tri.lineTo(0, 1.9); tri.lineTo(w / 2 + 0.5, 0); tri.closePath();
    const roof = mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 0.9, bevelEnabled: false }), darkWood, 0, FL + WH, -(d + 0.9) / 2); g.add(roof);
    const front = d / 2 + 0.02;
    g.add(box(1, 1.9, 0.06, mat(0x0e1112), 1.9, FL + 0.95, front));          // the doorway
    for (let k = 0; k < 4; k++) g.add(box(1.2, 0.1, 0.34, darkWood, 1.9, FL - 0.16 - k * 0.3, d / 2 + 1.5 + k * 0.34)); // steps
    const winMat = new THREE.MeshStandardMaterial({ color: 0x15191a, emissive: WARM, emissiveIntensity: 0, roughness: 0.6 });
    g.add(mesh(new THREE.PlaneGeometry(1.25, 1.05), winMat, -1.9, FL + 1.55, front, false));
    g.add(box(1.4, 0.07, 0.08, darkWood, -1.9, FL + 1.55, front + 0.02)); g.add(box(0.07, 1.15, 0.08, darkWood, -1.9, FL + 1.55, front + 0.02));
    const winLight = new THREE.PointLight(WARM, 0, 13, 1.5); winLight.position.set(-1.9, FL + 1.4, front + 1.2); g.add(winLight);
    const symbol = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: this.symbolTex.tex, transparent: true, fog: false }), 0.1, FL + 1.35, front + 0.01, false);
    symbol.visible = false; g.add(symbol);
    s.add(g);
    return { winMat, winLight, symbol };
  }

  private buildLamp() {
    const s = this.scene, g = new THREE.Group(), steel = mat(0x23282a, { r: 0.7, m: 0.4 });
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), steel, 0, 1.8, 0));
    g.add(box(0.7, 0.06, 0.06, steel, 0.3, 3.6, 0));
    const bulb = new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: WARM, emissiveIntensity: 0 });
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.14, 0.2), bulb, 0.6, 3.5, 0, false));
    const light = new THREE.PointLight(WARM, 0, 20, 1.4); light.position.set(0.6, 3.3, 0.2); g.add(light);
    g.position.set(PLACE.lamp.x, 0, PLACE.lamp.y); s.add(g);
    return { light, bulb };
  }

  private buildBench() {
    const g = new THREE.Group(), w = mat(0x1d2223, { r: 0.95 });
    g.add(box(1.5, 0.08, 0.4, w, 0, 0.45, 0)); g.add(box(1.5, 0.4, 0.06, w, 0, 0.75, -0.2));
    for (const x of [-0.65, 0.65]) g.add(box(0.07, 0.45, 0.36, w, x, 0.22, 0));
    g.position.set(PLACE.bench.x, 0, PLACE.bench.y - 0.35); this.scene.add(g);
  }

  private buildFar() {
    const wt = glowTex('255,190,110');
    for (const f of PLACE.far) {
      const g = new THREE.Group(), m = mat(0x2a3032, { r: 1 });
      g.add(box(5, 3, 4, m, 0, 3, 0)); const roof = mesh(new THREE.ConeGeometry(4.2, 2.4, 4).rotateY(Math.PI / 4), m, 0, 5.7, 0); g.add(roof);
      g.add(box(12, 2, 9, mat(0x7c8079, { r: 1 }), 0, 0.6, 0)); // a low rise it stands on
      g.position.set(f.x, 0, f.y); this.scene.add(g);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wt, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(4.5); sp.position.set(f.x - 0.8, 3.4, f.y + 2.2); this.scene.add(sp); this.farGlows.push(sp);
    }
  }

  private buildPerson(): PersonMesh {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const m = mat(0x15191a, { r: 1 });
    body.add(mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.3, 8), m, 0, 0.65, 0));
    body.add(mesh(new THREE.SphereGeometry(0.17, 10, 8), m, 0, 1.5, 0));
    const arm = box(0.07, 0.6, 0.07, m, 0, 0, 0); arm.geometry.translate(0, 0.3, 0); arm.position.set(0.22, 1.15, 0); arm.visible = false; body.add(arm);
    const cane = box(0.04, 0.9, 0.04, m, 0.32, 0.45, 0.15); cane.visible = false; group.add(cane);
    return { group, body, arm, cane };
  }

  private buildAntlers(color: number) {
    const g = new THREE.Group(), m = mat(color, { r: 0.8 });
    for (const sx of [-1, 1]) {
      const a = new THREE.Group();
      a.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.6, 5), m, 0, 0.3, 0));
      const t1 = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5), m, 0, 0.3, 0.12); t1.rotation.x = 0.9; a.add(t1);
      const t2 = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5), m, 0, 0.52, 0.1); t2.rotation.x = 0.7; a.add(t2);
      a.position.x = sx * 0.08; a.rotation.z = -sx * 0.45; a.rotation.x = -0.25; g.add(a);
    }
    return g;
  }

  private buildDeer() {
    const group = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x3a3f3c, roughness: 1 });
    group.add(mesh(new THREE.CapsuleGeometry(0.26, 0.75, 4, 8).rotateX(Math.PI / 2), coat, 0, 1.05, 0));
    for (const [x, z] of [[-0.14, 0.42], [0.14, 0.42], [-0.14, -0.4], [0.14, -0.4]]) group.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.85, 5), coat, x, 0.42, z));
    const neck = mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 6), coat, 0, 1.45, 0.62); neck.rotation.x = 0.55; group.add(neck);
    group.add(mesh(new THREE.CapsuleGeometry(0.09, 0.2, 3, 6).rotateX(Math.PI / 2), coat, 0, 1.72, 0.86));
    const antlers = this.buildAntlers(0x8d928a); antlers.position.set(0, 1.8, 0.76); group.add(antlers);
    return { group, antlers, coat };
  }

  private buildGifts() {
    const s = this.scene, base = v3(PLACE.shelter); base.x += 2.6; base.z += 0.6;
    const lantern = new THREE.Group();
    lantern.add(box(0.22, 0.34, 0.22, mat(0x1c2021), 0, 0.17, 0));
    lantern.add(mesh(new THREE.BoxGeometry(0.14, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: WARM, emissiveIntensity: 2.2 }), 0, 0.2, 0, false));
    this.giftLight.position.set(0, 0.5, 0); lantern.add(this.giftLight);
    const t = canvasTex(128); t.c.fillStyle = '#c9c6b4'; t.c.fillRect(0, 0, 128, 128); drawSymbol(t.c, 1, 128); t.tex.needsUpdate = true;
    const drawing = mesh(new THREE.PlaneGeometry(0.6, 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t.tex }), 0, 0.03, 0, false); drawing.rotation.y = 0.3;
    const bundle = this.models.has('Textiles_Stack_Small') ? place(this.models, 'Textiles_Stack_Small', 0.9, 0.4) : box(0.4, 0.25, 0.3, mat(0x55624a));
    [lantern, drawing, bundle].forEach((o, i) => { o.position.set(base.x + i * 0.9, o.position.y, base.z + (i % 2) * 0.5); o.visible = false; s.add(o); this.gifts.push(o); });
  }

  // ---------------------------------------------------------------- frame
  private emit(x: number, y: number, z: number) {
    const i = this.moteNext = (this.moteNext + 1) % N_MOTES;
    this.motePos.set([x, y, z], i * 3);
    this.moteVel.set([0.3 + Math.random() * 0.5, 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 0.3], i * 3);
    this.moteLife[i] = 0;
  }

  private redrawTally() {
    const { c, tex, size } = this.tallyTex, n = Math.min(this.game.year, 80);
    c.clearRect(0, 0, size, size); c.strokeStyle = 'rgba(214,220,210,.9)'; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const gr = Math.floor(i / 5), k = i % 5, bx = 22 + (gr % 4) * 58, by = 18 + Math.floor(gr / 4) * 58;
      c.beginPath();
      if (k === 4) { c.moveTo(bx - 6, by + 34); c.lineTo(bx + 40, by + 6); } else { c.moveTo(bx + k * 10, by); c.lineTo(bx + k * 10 + 1, by + 40); }
      c.stroke();
    }
    tex.needsUpdate = true;
  }

  update(dt: number) {
    const g = this.game, t = g.time, w = g.wolt;
    // the glow beyond the cliff pulses, and every light dips with it
    const pulse = Math.pow(Math.max(0, Math.sin(t * 0.8)), 14), dim = 1 - 0.4 * pulse;
    const lit = (g.powered ? 1 : 0) + [0, 1, 2].filter(i => g.farLit(i)).length;
    (this.horizon.material as THREE.SpriteMaterial).opacity = 0.2 + 0.04 * lit + 0.22 * pulse;
    (this.horizonCore.material as THREE.SpriteMaterial).opacity = 0.3 + 0.5 * pulse;

    // Wolt
    const speed = g.sleep ? 0 : w.speed;
    this.wolt.group.position.set(w.x, 0, w.y); this.wolt.group.rotation.y = w.yaw; this.wolt.group.visible = !g.sleep;
    let dyaw = w.yaw - this.lastYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.woltAnim.update({ dt, time: t, speed, yawRate: dt > 0 ? dyaw / dt : 0, accel: dt > 0 ? (speed - this.lastSpeed) / dt : 0, strain: false, cableTo: null, tension: 0, pullFrom: null,
      reelSpin: 0, arm: g.fixFlash > 0 ? 'reach' : 'rest', energy: 0.8 * dim, lamp: dim, lookAt: null });
    this.lastYaw = w.yaw; this.lastSpeed = speed;

    // cable, lamp, window
    const pw = g.powered;
    this.cableOn.visible = pw; this.cableOff.visible = !pw;
    this.cableMat.color.setRGB(0.1 + 0.36 * g.rust, 0.12 + 0.1 * g.rust, 0.13);
    const k = Math.min(1, dt * 3);
    this.lampLight.intensity += ((pw ? 26 : 0) * dim - this.lampLight.intensity) * k;
    this.lampBulb.emissiveIntensity += ((pw ? 3 : 0) * dim - this.lampBulb.emissiveIntensity) * k;
    this.winLight.intensity += ((g.windowLit ? 16 : 0) * dim - this.winLight.intensity) * k;
    this.winMat.emissiveIntensity += ((g.windowLit ? 2.6 : 0) * dim - this.winMat.emissiveIntensity) * k;
    this.farGlows.forEach((sp, i) => { const m = sp.material as THREE.SpriteMaterial; m.opacity += ((g.farLit(i) ? 0.95 * dim : 0) - m.opacity) * k; });
    this.shelterLight.intensity = 1 + 0.4 * Math.sin(t * 1.5);

    if (g.symbol !== this.symbolShown) {
      this.symbolShown = g.symbol; const { c, tex, size } = this.symbolTex;
      c.clearRect(0, 0, size, size); drawSymbol(c, g.symbol, size); tex.needsUpdate = true; this.symbolPlane.visible = g.symbol > 0;
    }
    if (g.year !== this.tallyShown) { this.tallyShown = g.year; this.redrawTally(); }

    // people
    this.people.forEach((pm, i) => {
      const p = g.people[i]; pm.group.visible = !!p; if (!p) return;
      const a = g.age(p), old = a > 58, sit = g.sitting(p), h = a < 16 ? 0.42 + a * 0.036 : old ? 0.92 : 1;
      pm.group.position.set(p.x, sit ? 0.12 : g.hiding(p) ? 1.3 : 0, p.y);
      pm.group.scale.setScalar(h);
      pm.body.rotation.x = old ? 0.16 : 0; pm.body.scale.y = sit ? 0.72 : 1;
      pm.group.rotation.y = Math.atan2(w.x - p.x, w.y - p.y) * (g.atHome ? 1 : 0);
      pm.cane.visible = old && !sit;
      const wave = g.waving(p); pm.arm.visible = wave; if (wave) pm.arm.rotation.z = -0.5 + Math.sin(t * 6 + i) * 0.35;
    });

    // deer
    const d = g.deer;
    this.deer.group.visible = d.alive;
    if (d.alive) {
      const a = g.age(d), sc = Math.min(1, 0.55 + a * 0.09);
      const bob = Math.sin(t * 1.3) * 0.02;
      this.deer.group.position.set(d.x, bob, d.y); this.deer.group.scale.setScalar(sc);
      const face = Math.atan2(w.x - d.x, w.y - d.y); let dy = face - this.deer.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.deer.group.rotation.y += dy * Math.min(1, dt * 3);
      const an = Math.max(0, Math.min(1, (a - 2) / 6)); this.deer.antlers.visible = an > 0; this.deer.antlers.scale.setScalar(0.4 + an * 0.9);
      this.deer.coat.color.set(a > 11 ? 0x6a706d : 0x3a3f3c);
    }
    this.antlersLeft.visible = !!d.grave;
    if (d.grave) this.antlersLeft.position.set(d.grave.x, 0.12, d.grave.y);

    this.gifts.forEach((o, i) => { o.visible = i < g.gifts; });
    this.giftLight.intensity = g.gifts > 0 ? 3 * dim : 0;
    const green = Math.min(1, g.litYears / 14);
    this.grass.forEach(gr => { const s = Math.max(0, Math.min(1, (green - gr.k * 0.8) * 4)); gr.o.visible = s > 0.02; gr.o.scale.setScalar(0.25 + s * 0.55); });
    (this.path.material as THREE.MeshBasicMaterial).opacity = Math.min(0.3, g.trips * 0.06);

    // hints: a pulsing ring where something can be done
    const rs = 1 + 0.25 * Math.sin(t * 3);
    this.ringCable.visible = !pw && !g.sleep; this.ringCable.scale.setScalar(rs * (g.nearCable ? 1.3 : 0.8));
    this.ringShelter.visible = g.nearShelter && g.moved && !g.sleep; this.ringShelter.scale.setScalar(rs * 1.6);

    // motes drift towards the cliff, speeding up; ash comes from there
    if (pw && Math.random() < dt * 9) this.emit(PLACE.lamp.x + 0.6, 3.5, PLACE.lamp.y);
    if (g.windowLit && Math.random() < dt * 6) this.emit(PLACE.house.x - 1.9 + (Math.random() - 0.5), 2.9, PLACE.house.y + PLACE.house.d / 2 + 0.1);
    if (!g.sleep && Math.random() < dt * 3) this.emit(w.x, 0.95, w.y);
    if (g.gifts > 0 && Math.random() < dt * 2) this.emit(this.gifts[0].position.x, 0.4, this.gifts[0].position.z);
    for (let i = 0; i < N_MOTES; i++) {
      if (this.moteLife[i] > 9) { this.motePos[i * 3 + 1] = -999; continue; }
      this.moteLife[i] += dt; this.moteVel[i * 3] += 0.9 * dt;
      this.motePos[i * 3] += this.moteVel[i * 3] * dt; this.motePos[i * 3 + 1] += this.moteVel[i * 3 + 1] * dt * (1 + Math.sin(this.moteLife[i] * 3 + i) * 0.5); this.motePos[i * 3 + 2] += this.moteVel[i * 3 + 2] * dt - 0.25 * dt;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < N_ASH; i++) {
      let x = this.ashPos[i * 3] - (1.2 + (i % 5) * 0.3) * dt, y = this.ashPos[i * 3 + 1] - (0.5 + (i % 3) * 0.2) * dt;
      if (y < 0) y += 16; if (x < -40) x += 80;
      this.ashPos[i * 3] = x; this.ashPos[i * 3 + 1] = y;
    }
    this.ash.position.set(this.camTarget.x, 0, this.camTarget.z);
    this.ash.geometry.attributes.position.needsUpdate = true;

    // camera: follows Wolt, but at the homestead it always settles on the same frame
    const want = g.atHome ? v3(PLACE.frame) : new THREE.Vector3(w.x + Math.sin(w.yaw) * 2.5, 0, w.y * 0.6 - 2);
    this.camTarget.lerp(want, 1 - Math.pow(0.03, dt));
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_DIR, CAM_DIST);
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  }
}
