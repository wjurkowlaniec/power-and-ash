import * as THREE from 'three';
import { PAL } from '../../render/palette';
import { mat, mesh } from '../../render/models';
import { MAP, heightAt } from '../../sail/sim/terrain';
import { RIG } from '../../sail/render/yachtRig';
import { SailView } from '../../sail/render/sailView';
import { CLOUDS } from '../sim/clouds';
import { SunGame, SUN } from '../sim/sunGame';

/**
 * What "Słońce" adds on top of the "Żegluga" view: the cloud shadows sliding over the
 * ground, the light dimming on the yacht under a cloud, solar panels and the load on the
 * yacht, and the A and B markers. Reads SunGame, never changes it.
 */
const MAX_PUFFS = 96;

export class SunView {
  private puffs = Array.from({ length: MAX_PUFFS }, () => new THREE.Vector4(0, 0, 1, 0));
  private uni = { uPuffs: { value: this.puffs }, uTime: { value: 0 } };
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private sunBase = 1.5; private hemiBase = 1.3;
  private lightVis = 1;
  private load = new THREE.Group();
  private loadLamp: THREE.Mesh;
  private panels: THREE.Mesh[] = [];
  private markA: Marker; private markB: Marker;
  private crateA: THREE.Group; private crateB: THREE.Group;
  private arrow: THREE.Mesh;

  constructor(private g: SunGame, base: SailView) {
    const s = base.scene;
    s.traverse(o => {
      if (o instanceof THREE.DirectionalLight && !this.sun) { this.sun = o; this.sunBase = o.intensity; }
      if (o instanceof THREE.HemisphereLight && !this.hemi) { this.hemi = o; this.hemiBase = o.intensity; }
    });
    s.add(this.shadowLayer());

    // panels and the load ride in the yacht's body (under its heel and pitch)
    const root = base.yachtRoot;
    const body = (root.children[0]?.children[0]?.children[0] as THREE.Group | undefined) ?? root;
    const cell = mat(0x1d2a33, { r: 0.25, m: 0.5 });
    const frame = mat(0x6a6e70, { r: 0.5, m: 0.6 });
    for (const sx of [-1, 1]) {
      const arm = mesh(new THREE.BoxGeometry(0.42, 0.03, 0.04), frame, sx * 0.72, RIG.rim + 0.12, -0.35);
      body.add(arm);
      const p = new THREE.Group();
      p.position.set(sx * 1.02, RIG.rim + 0.2, -0.35);
      p.rotation.z = sx * 0.2;
      p.add(mesh(new THREE.BoxGeometry(0.66, 0.035, 0.92), frame));
      const c = mesh(new THREE.BoxGeometry(0.6, 0.012, 0.86), cell, 0, 0.022, 0);
      p.add(c); this.panels.push(c);
      // the cell grid
      for (let k = -1; k <= 1; k++) p.add(mesh(new THREE.BoxGeometry(0.6, 0.014, 0.008), frame, 0, 0.024, k * 0.215));
      p.add(mesh(new THREE.BoxGeometry(0.008, 0.014, 0.86), frame, 0, 0.024, 0));
      body.add(p);
    }
    const { group, lamp } = incubator();
    this.load = group; this.loadLamp = lamp;
    this.load.position.set(0, RIG.deck, 0.08);
    body.add(this.load);

    this.markA = marker(PAL.warn); this.markB = marker(PAL.ok);
    s.add(this.markA.group, this.markB.group);
    this.crateA = incubator().group; this.crateB = incubator().group;
    s.add(this.crateA, this.crateB);

    const sh = new THREE.Shape(); sh.moveTo(0, 0.9); sh.lineTo(0.55, -0.3); sh.lineTo(0, 0); sh.lineTo(-0.55, -0.3); sh.closePath();
    const ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2); ag.rotateY(Math.PI);
    this.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
    this.arrow.renderOrder = 3;
    s.add(this.arrow);
  }

  /** A sheet that hugs the ground and darkens where the clouds' shadows are. */
  private shadowLayer(): THREE.Mesh {
    const M = 160, S = MAP.size + M * 2, seg = 240;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2);
    geo.translate(MAP.size / 2, 0, MAP.size / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)) + 0.05);
    const m = new THREE.ShaderMaterial({
      uniforms: this.uni,
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: `varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        varying vec2 vW;
        uniform vec4 uPuffs[${MAX_PUFFS}]; uniform float uTime;
        float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
        void main() {
          float d = 0.0;
          for (int i = 0; i < ${MAX_PUFFS}; i++) { vec4 k = uPuffs[i]; vec2 q = vW - k.xy; d += k.w * exp(-dot(q, q) / (k.z * k.z)); }
          // the same soft edge as the game logic, frayed a little so it reads as a cloud, not a disc
          float fray = (vn(vW * 0.09 + uTime * 0.02) - 0.5) * 0.12;
          float s = smoothstep(${CLOUDS.edge0.toFixed(2)}, ${CLOUDS.edge1.toFixed(2)}, d + fray);
          gl_FragColor = vec4(0.13, 0.15, 0.18, s * 0.46);
        }`,
    });
    const layer = new THREE.Mesh(geo, m);
    layer.renderOrder = 1;
    layer.frustumCulled = false;
    return layer;
  }

  update(dt: number, t: number) {
    const g = this.g, y = g.yacht, d = g.delivery;
    // the puffs nearest the yacht go to the shader
    const near: { x: number; y: number; r: number; d: number }[] = [];
    for (const p of g.clouds.puffs(y.x, y.y)) near.push({ ...p, d: Math.hypot(p.x - y.x, p.y - y.y) - p.r * 3 });
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < MAX_PUFFS; i++) {
      const p = near[i];
      if (p) this.puffs[i].set(p.x, p.y, p.r, 1); else this.puffs[i].set(0, 0, 1, 0);
    }
    this.uni.uTime.value = t;

    // the sun on the yacht dims under a cloud (soft, like a real cloud edge passing)
    this.lightVis += (g.light - this.lightVis) * Math.min(1, dt * 3);
    if (this.sun) this.sun.intensity = this.sunBase * (0.55 + 0.45 * this.lightVis);
    if (this.hemi) this.hemi.intensity = this.hemiBase * (0.8 + 0.2 * this.lightVis);
    for (const p of this.panels) (p.material as THREE.MeshStandardMaterial).emissive?.setRGB(0.05 * this.lightVis, 0.08 * this.lightVis, 0.11 * this.lightVis);

    // the load: on board while carried, waiting at A before, standing at B after
    const carried = d.phase === 'carrying' || d.phase === 'unloading';
    this.load.visible = carried;
    const a = d.mission.a, b = d.mission.b;
    this.crateA.visible = d.phase === 'toPickup' || d.phase === 'loading';
    this.crateA.position.set(a.x + 2.5, heightAt(a.x + 2.5, a.y), a.y);
    this.crateB.visible = d.phase === 'done';
    this.crateB.position.set(b.x + 2.5, heightAt(b.x + 2.5, b.y), b.y);
    const lampM = this.loadLamp.material as THREE.MeshStandardMaterial;
    const frac = d.buffer / SUN.buffer;
    const c = g.light >= SUN.need ? PAL.ok : frac > 0.3 ? PAL.warn : PAL.limit;
    lampM.color.setHex(c); lampM.emissive.setHex(c);
    lampM.emissiveIntensity = g.light >= SUN.need ? 1.2 : frac > 0.3 ? 0.9 : 0.4 + 0.8 * (Math.sin(t * 10) > 0 ? 1 : 0);

    // A and B
    const toA = d.phase === 'toPickup' || d.phase === 'loading';
    this.markA.update(a, toA ? 1 : 0.25, d.phase === 'loading' ? d.handling / SUN.handle : 0, t);
    this.markB.update(b, d.phase === 'carrying' || d.phase === 'unloading' ? 1 : d.phase === 'done' ? 0.5 : 0.25, d.phase === 'unloading' ? d.handling / SUN.handle : 0, t);

    // the arrow to the target rides just ahead of the yacht
    const tg = g.target;
    const ang = Math.atan2(tg.y - y.y, tg.x - y.x), dist = Math.hypot(tg.x - y.x, tg.y - y.y);
    this.arrow.visible = dist > 14 && d.phase !== 'done' && d.phase !== 'failed';
    this.arrow.position.set(y.x + Math.cos(ang) * 4.2, heightAt(y.x, y.y) + 0.3, y.y + Math.sin(ang) * 4.2);
    this.arrow.rotation.y = Math.PI / 2 - ang;
    const am = this.arrow.material as THREE.MeshBasicMaterial;
    am.color.setHex(toA ? PAL.warn : PAL.ok);
    am.opacity = 0.45 + 0.3 * Math.sin(t * 4);
  }
}

/** The load: an insulated box with a glass top and a status lamp. ~0.4 m. */
function incubator(): { group: THREE.Group; lamp: THREE.Mesh } {
  const g = new THREE.Group();
  const shell = mat(0xb9b4a8, { r: 0.8 });
  const dark = mat(0x2b2d2f, { r: 0.7, m: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.36, 0.26, 0.3), shell, 0, 0.13, 0));
  g.add(mesh(new THREE.BoxGeometry(0.38, 0.03, 0.32), dark, 0, 0.015, 0));
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc7b0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55, emissive: 0x2f5a3c, emissiveIntensity: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.24), glass, 0, 0.285, 0));
  for (const x of [-0.19, 0.19]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), dark, x, 0.2, 0));
  const lamp = mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: PAL.ok, emissive: PAL.ok, emissiveIntensity: 1 }), 0.13, 0.3, 0.12);
  g.add(lamp);
  return { group: g, lamp };
}

interface Marker { group: THREE.Group; update(p: { x: number; y: number }, on: number, progress: number, t: number): void }

/** A ring on the ground with a faint fill and a progress arc (loading / unloading). */
function marker(color: number): Marker {
  const g = new THREE.Group();
  const ringM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(SUN.zone - 0.35, SUN.zone, 64).rotateX(-Math.PI / 2), ringM);
  ring.renderOrder = 2; g.add(ring);
  // a faint disc inside the ring, so the spot reads even under a cloud
  const fillM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false, fog: false });
  const fill = new THREE.Mesh(new THREE.CircleGeometry(SUN.zone - 0.35, 64).rotateX(-Math.PI / 2), fillM);
  fill.renderOrder = 2; g.add(fill);
  const arcM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  let arc: THREE.Mesh | null = null, arcK = -1;
  return {
    group: g,
    update(p, on, progress, t) {
      g.position.set(p.x, heightAt(p.x, p.y) + 0.08, p.y);
      ringM.opacity = 0.2 + 0.45 * on * (0.75 + 0.25 * Math.sin(t * 3));
      fillM.opacity = 0.03 + 0.1 * on;
      const k = Math.round(progress * 40);
      if (k !== arcK) {
        if (arc) { g.remove(arc); arc.geometry.dispose(); arc = null; }
        if (k > 0) { arc = new THREE.Mesh(new THREE.RingGeometry(SUN.zone - 1.3, SUN.zone - 0.6, 48, 1, 0, (k / 40) * Math.PI * 2).rotateX(-Math.PI / 2), arcM); arc.renderOrder = 2; g.add(arc); }
        arcK = k;
      }
    },
  };
}
