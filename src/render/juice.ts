import * as THREE from 'three';

/**
 * "Juice" for small actions (decision 2026-11-17, docs/INSPIRACJE.md): a puff, a few sparks,
 * a short flash of light and a little bump of the thing that was touched, so taking scrap
 * apart, plugging a cable in or fitting a part feels physical. Shared by the game and the
 * demos; it only draws, it never changes the simulation.
 *
 * Particles live in one fixed pool of points (additive, so they fade by darkening), flashes
 * in a small pool of point lights, bumps as a decaying scale wobble on any Object3D.
 */
const POOL = 320;
const LIGHTS = 3;

export interface BurstOpts {
  color: number;
  n: number;
  /** m/s at launch, spread around it. */
  speed?: number;
  /** s a particle lives. */
  life?: number;
  /** m/s² pulling down (sparks fall, dust hangs). */
  gravity?: number;
  /** How much it rises at first (0 = sideways spray, 1 = straight up). */
  up?: number;
}

export class Juice {
  readonly points: THREE.Points;
  private pos = new Float32Array(POOL * 3);
  private col = new Float32Array(POOL * 3);
  private vel = new Float32Array(POOL * 3);
  private life = new Float32Array(POOL);
  private max = new Float32Array(POOL);
  private grav = new Float32Array(POOL);
  private base = new Float32Array(POOL * 3);
  private next = 0;
  private lights: { l: THREE.PointLight; t: number; d: number; i: number }[] = [];
  private bumps = new Map<THREE.Object3D, { s: THREE.Vector3; t: number; a: number }>();

  constructor(private scene: THREE.Scene, pointSize = 4) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size: pointSize, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    for (let i = 0; i < LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 4, 2);
      l.visible = false;
      scene.add(l);
      this.lights.push({ l, t: 0, d: 1, i: 0 });
    }
  }

  /** A spray of particles from a point. */
  burst(at: THREE.Vector3, o: BurstOpts) {
    const c = new THREE.Color(o.color), sp = o.speed ?? 2, up = o.up ?? 0.5;
    for (let k = 0; k < o.n; k++) {
      const i = this.next; this.next = (this.next + 1) % POOL;
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
      const h = Math.sqrt(1 - up * up);
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(a) * v * h, v * (up + Math.random() * 0.4), Math.sin(a) * v * h], i * 3);
      const j = 0.8 + Math.random() * 0.4;
      this.base.set([c.r * j, c.g * j, c.b * j], i * 3);
      this.max[i] = this.life[i] = (o.life ?? 0.6) * (0.6 + Math.random() * 0.8);
      this.grav[i] = o.gravity ?? 9;
    }
  }

  /** A short flash of light that falls off fast. */
  flash(at: THREE.Vector3, color: number, intensity = 6, dur = 0.25, range = 4) {
    const f = this.lights.reduce((a, b) => (b.t <= 0 || b.t < a.t ? b : a));
    f.l.position.copy(at); f.l.color.setHex(color); f.l.distance = range;
    f.t = f.d = dur; f.i = intensity; f.l.visible = true;
  }

  /** A quick springy bump of an object's scale (it settles back by itself). */
  bump(o: THREE.Object3D, amount = 0.12) {
    const b = this.bumps.get(o);
    if (b) { b.t = 0; b.a = Math.max(b.a, amount); return; }
    this.bumps.set(o, { s: o.scale.clone(), t: 0, a: amount });
  }

  update(dt: number) {
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      // a little air drag, and nothing goes through the ground
      for (let d = 0; d < 3; d++) { this.vel[k + d] *= 1 - dt * 1.5; this.pos[k + d] += this.vel[k + d] * dt; }
      if (this.pos[k + 1] < 0.02) { this.pos[k + 1] = 0.02; this.vel[k + 1] *= -0.3; }
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    for (const f of this.lights) {
      if (f.t <= 0) continue;
      f.t -= dt;
      const k = Math.max(0, f.t / f.d);
      f.l.intensity = f.i * k * k;
      if (f.t <= 0) f.l.visible = false;
    }
    for (const [o, b] of this.bumps) {
      b.t += dt;
      const w = b.a * Math.exp(-b.t * 9) * Math.cos(b.t * 34);
      o.scale.set(b.s.x * (1 + w), b.s.y * (1 - w * 0.6), b.s.z * (1 + w));
      if (b.t > 0.6) { o.scale.copy(b.s); this.bumps.delete(o); }
    }
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose();
    for (const f of this.lights) this.scene.remove(f.l);
    for (const [o, b] of this.bumps) o.scale.copy(b.s);
    this.bumps.clear();
  }
}
