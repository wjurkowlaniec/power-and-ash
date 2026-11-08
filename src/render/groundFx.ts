import * as THREE from 'three';

/**
 * What the ground does under Wolt: tracks and kicked-up dust. Shared engine file (the tech
 * demo and the game scenes both use it).
 *
 * - The wheel leaves a narrow ribbed line; a dragged tyre a wide smear with streaks along
 *   its rim. Both are continuous ribbons, not stamped rectangles, and fade with time.
 * - What the marks look like depends on the surface under them (deep in ash, faint on
 *   dusty concrete, wet and dark for a few metres after a puddle).
 * - The wheel throws ash back when it spins on the spot, when he pulls away hard and
 *   when he pivots; a dragged load pushes a little in front of it.
 */
export interface Surface {
  /** 0..1 how deep the marks are. */
  marks: number;
  /** Colour of a fresh mark. */
  color: number;
  /** 0..1 how much dust comes up. */
  dust: number;
  dustColor: number;
  /** s a mark lasts before it has faded out. */
  life: number;
  /** Height of the surface (marks sit just above it). */
  y?: number;
  /** A puddle: wets the wheel for the next few metres. */
  wet?: boolean;
}

export const SURFACES = {
  ash: { marks: 0.55, color: 0x4b4740, dust: 1, dustColor: 0xdcd7cc, life: 120 },
  dustyConcrete: { marks: 0.2, color: 0x2a2928, dust: 0.3, dustColor: 0xa9a59d, life: 70 },
  concrete: { marks: 0.1, color: 0x353432, dust: 0.12, dustColor: 0x8f8c86, life: 40 },
  water: { marks: 0, color: 0x101112, dust: 0, dustColor: 0x8f8c86, life: 1, wet: true },
} satisfies Record<string, Surface>;

export type SurfaceAt = (x: number, z: number) => Surface;

// ---------- textures (drawn once)

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.Texture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Wheel: ribbed tread across a narrow band with soft edges. u across, v along. */
function treadTex() {
  return canvasTex(32, 64, c => {
    for (let y = 0; y < 64; y++) {
      const rib = (y % 16) < 9 ? 1 : 0.55;
      for (let x = 0; x < 32; x++) {
        const e = Math.min(x, 31 - x) / 6; // soft edges
        const a = Math.min(1, e) * rib * (0.85 + Math.random() * 0.15);
        c.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        c.fillRect(x, y, 1, 1);
      }
    }
  });
}

/** Dragged tyre: a smeared band, darker streaks where the rim touches, noisy edges. */
function dragTex() {
  const streaks: [number, number, number][] = [];
  for (let i = 0; i < 14; i++) streaks.push([Math.random(), 0.5 + Math.random() * 1.5, 0.3 + Math.random() * 0.6]);
  return canvasTex(64, 64, c => {
    for (let x = 0; x < 64; x++) {
      const u = x / 63;
      // the rim drags on both sides more than in the middle
      const rim = Math.exp(-((u - 0.18) ** 2) / 0.006) + Math.exp(-((u - 0.82) ** 2) / 0.006);
      let a = 0.22 + rim * 0.55;
      for (const [p, w, s] of streaks) a += s * 0.35 * Math.exp(-(((u - p) * 64) ** 2) / (w * w));
      a *= Math.min(1, Math.min(u, 1 - u) * 9);
      for (let y = 0; y < 64; y++) {
        const n = 0.8 + Math.random() * 0.2 + Math.sin(y * 0.4 + x) * 0.05;
        c.fillStyle = `rgba(255,255,255,${Math.min(1, a * n).toFixed(3)})`;
        c.fillRect(x, y, 1, 1);
      }
    }
  });
}

/** A soft round blot (wheel dug in on the spot). */
function blotTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// ---------- ribbon of marks

class Ribbon {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array; private col: Float32Array; private uv: Float32Array;
  private birth: Float32Array; private life: Float32Array; private alpha: Float32Array;
  private rgb: Float32Array;
  private head = 0; private used = 0;
  /** m drawn since the pen went down (strokes fade in instead of starting with a hard edge). */
  private run = 0;
  /** Segments of the current stroke, newest last (to taper its end when the pen lifts). */
  private stroke: number[] = [];
  private last: { x: number; z: number; lx: number; lz: number; rx: number; rz: number; v: number; a: number; c: THREE.Color } | null = null;
  private tmp = new THREE.Color();

  constructor(private n: number, map: THREE.Texture, private tile: number, private y: number) {
    this.pos = new Float32Array(n * 12); this.col = new Float32Array(n * 16); this.uv = new Float32Array(n * 8);
    this.birth = new Float32Array(n); this.life = new Float32Array(n).fill(1); this.alpha = new Float32Array(n);
    this.rgb = new Float32Array(n * 3);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) { const b = i * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const m = new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Lift the pen: the next point starts a new line. */
  cut() {
    // taper the end of the line over its last few segments
    const k = [0.15, 0.4, 0.65, 0.85];
    for (let j = 0; j < k.length && j < this.stroke.length; j++) this.alpha[this.stroke[this.stroke.length - 1 - j]] *= k[j];
    this.last = null; this.run = 0; this.stroke = [];
  }

  /** Extend the line to (x, z), heading `dirX, dirZ` (unit), `w` wide, strength `a` 0..1. */
  add(x: number, z: number, y: number, dirX: number, dirZ: number, w: number, a: number, color: number, life: number, time: number) {
    const nx = -dirZ * w / 2, nz = dirX * w / 2;
    const c = this.tmp.setHex(color).clone();
    const cur = { x, z, lx: x + nx, lz: z + nz, rx: x - nx, rz: z - nz, v: 0, a, c };
    const L = this.last;
    if (!L) { this.last = cur; return; }
    const step = Math.hypot(x - L.x, z - L.z);
    cur.v = L.v + step / this.tile;
    this.run += step;
    const i = this.head;
    this.stroke.push(i); if (this.stroke.length > 8) this.stroke.shift();
    a *= Math.min(1, 0.15 + this.run / 0.6);
    const P = this.pos, yy = (y ?? 0) + this.y;
    P.set([L.lx, yy, L.lz, L.rx, yy, L.rz, cur.lx, yy, cur.lz, cur.rx, yy, cur.rz], i * 12);
    this.uv.set([0, L.v, 1, L.v, 0, cur.v, 1, cur.v], i * 8);
    this.birth[i] = time; this.life[i] = life; this.alpha[i] = a;
    this.rgb.set([c.r, c.g, c.b], i * 3);
    this.head = (i + 1) % this.n; this.used = Math.min(this.n, this.used + 1);
    this.last = cur;
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.used * 6);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Where the pen last was, or null. */
  lastPoint() { return this.last; }

  update(time: number) {
    const C = this.col;
    for (let i = 0; i < this.used; i++) {
      const age = time - this.birth[i], life = this.life[i];
      // fresh marks show at once; old ones fill in with ash and fade
      const f = Math.max(0, 1 - age / life);
      const a = this.alpha[i] * f * f * (3 - 2 * f);
      const r = this.rgb[i * 3], g = this.rgb[i * 3 + 1], b = this.rgb[i * 3 + 2];
      for (let k = 0; k < 4; k++) C.set([r, g, b, a], i * 16 + k * 4);
    }
    (this.mesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------- dust

const DUST_VS = /* glsl */`
attribute float alpha; attribute float size; attribute vec3 tint;
uniform float uScale;
varying float vA; varying vec3 vC;
void main() {
  vA = alpha; vC = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, size * uScale);
}`;
const DUST_FS = /* glsl */`
varying float vA; varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = vA * (1.0 - smoothstep(0.1, 1.0, d));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC, a);
}`;

class Dust {
  readonly points: THREE.Points;
  private p: Float32Array; private v: Float32Array; private a: Float32Array; private s: Float32Array; private c: Float32Array;
  private age: Float32Array; private life: Float32Array; private a0: Float32Array; private s0: Float32Array;
  private next = 0;
  readonly mat: THREE.ShaderMaterial;
  private tmp = new THREE.Color();

  constructor(private n: number) {
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.a = new Float32Array(n); this.s = new Float32Array(n);
    this.c = new Float32Array(n * 3); this.age = new Float32Array(n); this.life = new Float32Array(n); this.a0 = new Float32Array(n); this.s0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: { uScale: { value: 40 } }, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** One grain of dust: from (x, y, z), velocity (vx, vy, vz), `size` m across. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, alpha: number, life: number, color: number) {
    const i = this.next; this.next = (i + 1) % this.n;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.age[i] = 0; this.life[i] = life; this.a0[i] = alpha; this.s0[i] = size;
    this.tmp.setHex(color); this.c.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
  }

  update(dt: number, wind: { x: number; z: number }) {
    const drag = Math.exp(-dt * 2.2);
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) { this.a[i] = 0; continue; }
      this.age[i] += dt;
      const k = i * 3;
      // light ash: falls slowly, slowed by the air, carried a little by the wind
      this.v[k] = this.v[k] * drag + wind.x * dt * 0.8;
      this.v[k + 1] = this.v[k + 1] * drag - 1.6 * dt;
      this.v[k + 2] = this.v[k + 2] * drag + wind.z * dt * 0.8;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.p[k + 1] < 0.02) { this.p[k + 1] = 0.02; this.v[k + 1] = 0; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; }
      const t = this.age[i] / this.life[i];
      this.a[i] = this.a0[i] * Math.min(1, t * 12) * (1 - t) * (1 - t);
      this.s[i] = this.s0[i] * (1 + t * 2.2); // a puff spreads as it thins
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.tint as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------- the whole thing

/** What GroundFx needs from Wolt each frame. */
export interface WheelFrame {
  /** Contact point under the wheel (world x/z). */
  x: number; z: number;
  /** Rolling heading (Three's yaw, rotation.y). */
  yaw: number;
  /** Signed forward speed, m/s. */
  speed: number;
  /** Forward acceleration, m/s². */
  accel: number;
  /** Turning rate, rad/s. */
  yawRate: number;
  /** 0..1 how hard the wheel spins without getting anywhere. */
  slip: number;
}

export interface DragFrame {
  x: number; z: number;
  /** Load heading (Three's yaw); the rope pulls towards local +z. */
  yaw: number;
  /** m across. */
  width: number;
  /** Is it really being dragged right now (rope taut, moving)? */
  dragging: boolean;
  speed: number;
}

export class GroundFx {
  readonly group = new THREE.Group();
  private wheelMarks: Ribbon;
  private dragMarks = new Map<object, Ribbon>();
  private dragTexture: THREE.Texture;
  private dust = new Dust(480);
  private blots: { m: THREE.Mesh; t: number; life: number; a: number }[] = [];
  private blotTexture = blotTex();
  private blotN = 0;
  private wet = 0;          // 0..1 how wet the wheel is
  private lastWheel: { x: number; z: number } | null = null;
  private emitAcc = 0;
  private time = 0;
  private wind = { x: 0, z: 0 };

  constructor(private surfaceAt: SurfaceAt) {
    this.wheelMarks = new Ribbon(1400, treadTex(), 0.32, 0.014);
    this.dragTexture = dragTex();
    this.group.add(this.wheelMarks.mesh, this.dust.points);
  }

  setWind(x: number, z: number) { this.wind.x = x; this.wind.z = z; }

  /** Pixels per metre on screen (orthographic camera), for the dust size. */
  setScale(pxPerM: number) { this.dust.mat.uniforms.uScale.value = pxPerM; }

  wheel(f: WheelFrame, dt: number) {
    const s = this.surfaceAt(f.x, f.z);
    const y = s.y ?? 0;
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw); // forward in world x/z
    if (s.wet) this.wet = 1;

    // marks: a point every few cm of travel; a jump (teleport) lifts the pen
    const L = this.lastWheel;
    const moved = L ? Math.hypot(f.x - L.x, f.z - L.z) : 0;
    if (!L || moved > 1.5) { this.wheelMarks.cut(); this.lastWheel = { x: f.x, z: f.z }; }
    else if (moved > 0.05) {
      this.wet = Math.max(0, this.wet - moved / 5);
      const depth = Math.max(s.marks, this.wet * 0.55);
      if (depth > 0.01) {
        const color = this.wet > s.marks ? 0x0e0f0f : s.color;
        const dx = (f.x - L.x) / moved, dz = (f.z - L.z) / moved;
        this.wheelMarks.add(f.x, f.z, y, dx, dz, 0.085, Math.min(1, depth * (0.75 + Math.min(1, Math.abs(f.speed) / 3) * 0.25)), color, s.life * (this.wet > s.marks ? 0.5 : 1), this.time);
      } else this.wheelMarks.cut();
      this.lastWheel = { x: f.x, z: f.z };
    }

    // dust from the wheel
    const d = s.dust * (1 - this.wet);
    if (d <= 0.01) return;
    let rate = 0;
    rate += f.slip * 70;                                            // spinning on the spot
    rate += Math.max(0, Math.abs(f.accel) - 2.5) * 5 * (f.accel > 0 ? 1 : 0.6); // pulling away / braking hard
    rate += Math.abs(f.yawRate) > 2 && Math.abs(f.speed) < 0.6 ? 10 : 0;          // pivoting on the spot
    rate += Math.max(0, Math.abs(f.speed) - 2.6) * 6;               // running
    this.emitAcc += rate * d * dt;
    while (this.emitAcc >= 1) {
      this.emitAcc -= 1;
      const back = f.speed >= -0.1 ? -1 : 1;
      const spin = f.slip > 0.3;
      // a spinning wheel throws ash back and up; otherwise it puffs low around the tyre
      const sp = spin ? 1.8 + Math.random() * 2.4 : 0.3 + Math.random() * 0.6;
      const up = spin ? 0.9 + Math.random() * 1.6 : 0.15 + Math.random() * 0.4;
      const side = (Math.random() - 0.5) * (spin ? 1.4 : 1.0);
      const vx = fx * back * sp + fz * side, vz = fz * back * sp - fx * side;
      this.dust.emit(f.x + fx * back * 0.12, y + 0.04, f.z + fz * back * 0.12, vx, up, vz,
        spin ? 0.1 + Math.random() * 0.1 : 0.08 + Math.random() * 0.07, (spin ? 0.75 : 0.4) * (0.6 + Math.random() * 0.4), 0.7 + Math.random() * 0.9, s.dustColor);
    }
    // dug in: a dark blot grows under the spinning wheel
    if (f.slip > 0.3 && s.marks > 0.05) this.dig(f.x - fx * 0.22, f.z - fz * 0.22, y, f.yaw, f.slip * s.marks, s.color, s.life, dt);
  }

  /** A load dragged on a rope (the tyre, the sled). Each load keeps its own line. */
  drag(key: object, f: DragFrame, dt: number) {
    let r = this.dragMarks.get(key);
    if (!r) { r = new Ribbon(700, this.dragTexture, 0.8, 0.011); this.dragMarks.set(key, r); this.group.add(r.mesh); }
    const s = this.surfaceAt(f.x, f.z);
    if (!f.dragging || s.marks < 0.01) { r.cut(); return; }
    const L = r.lastPoint();
    const moved = L ? Math.hypot(f.x - L.x, f.z - L.z) : 0;
    if (!L) { r.add(f.x, f.z, s.y ?? 0, Math.sin(f.yaw), Math.cos(f.yaw), f.width, 0, s.color, s.life, this.time); return; }
    if (moved > 1.5) { r.cut(); return; }
    if (moved > 0.08) {
      const dx = (f.x - L.x) / moved, dz = (f.z - L.z) / moved;
      r.add(f.x, f.z, s.y ?? 0, dx, dz, f.width, Math.min(1, s.marks * 1.1), s.color, s.life, this.time);
    }
    // ash piles up and spills at the front of the load
    const d = s.dust;
    if (d < 0.01 || f.speed < 0.2) return;
    if (Math.random() < dt * 14 * d * Math.min(1, f.speed)) {
      const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), side = (Math.random() < 0.5 ? -1 : 1) * f.width * 0.45;
      this.dust.emit(f.x + fx * f.width * 0.4 + fz * side, (s.y ?? 0) + 0.05, f.z + fz * f.width * 0.4 - fx * side,
        fz * side * 0.8 + fx * 0.3, 0.2 + Math.random() * 0.3, -fx * side * 0.8 + fz * 0.3, 0.08 + Math.random() * 0.06, 0.3, 0.8 + Math.random() * 0.6, s.dustColor);
    }
  }

  private dig(x: number, z: number, y: number, yaw: number, a: number, color: number, life: number, dt: number) {
    const cur = this.blotN > 0 ? this.blots[(this.blotN - 1) % this.blots.length] : null;
    if (cur && Math.hypot(cur.m.position.x - x, cur.m.position.z - z) < 0.12) {
      cur.a = Math.min(0.7, cur.a + a * dt * 0.9);
      cur.m.scale.set(Math.min(0.32, cur.m.scale.x + dt * 0.08), 1, Math.min(0.7, cur.m.scale.z + dt * 0.25));
      cur.t = this.time;
      return;
    }
    if (this.blots.length < 24) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.blotTexture, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.renderOrder = 1; this.group.add(m);
      this.blots.push({ m, t: 0, life: 1, a: 0 });
    }
    const b = this.blots[this.blotN++ % this.blots.length];
    (b.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    b.m.position.set(x, y + 0.016, z); b.m.rotation.y = yaw; b.m.scale.set(0.16, 1, 0.3);
    b.t = this.time; b.life = life; b.a = a * 0.1;
  }

  update(dt: number) {
    this.time += dt;
    this.wheelMarks.update(this.time);
    for (const r of this.dragMarks.values()) r.update(this.time);
    for (const b of this.blots) {
      const f = Math.max(0, 1 - (this.time - b.t) / b.life);
      (b.m.material as THREE.MeshBasicMaterial).opacity = b.a * f;
    }
    this.dust.update(dt, this.wind);
  }
}

/** Screen pixels per world metre for an orthographic camera drawn by `r`. */
export function pxPerMetre(r: THREE.WebGLRenderer, cam: THREE.OrthographicCamera): number {
  const h = r.getDrawingBufferSize(new THREE.Vector2()).y;
  return h * cam.zoom / Math.max(1e-6, cam.top - cam.bottom);
}
