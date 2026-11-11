import * as THREE from 'three';

/**
 * Ropes and wires of the land yacht's rigging. A rope is a thin tube through a fixed number
 * of points; the points move every frame (the sheet runs out, a slack line sags and swings),
 * so the tube is rebuilt on the CPU: a handful of ropes with a few dozen vertices each.
 */

let ropeTex: THREE.CanvasTexture | null = null;
/** Laid rope: three strands twisting along the line. */
function ropeTexture(): THREE.CanvasTexture {
  if (ropeTex) return ropeTex;
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d')!;
  const img = g.createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = 0.5 + 0.5 * Math.sin(((x + y) / 16) * Math.PI * 2);
    const v = 150 + 90 * k;
    const i = (y * 16 + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ropeTex = new THREE.CanvasTexture(c);
  ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
  ropeTex.colorSpace = THREE.SRGBColorSpace;
  return ropeTex;
}

export const ROPE = {
  /** Hemp: the sheet, the halyard, the ballast line. */
  hemp: () => new THREE.MeshStandardMaterial({ color: 0xb9ad92, roughness: 1, map: ropeTexture() }),
  /** Thin pale cord cut from the balloon's lines: lacing and lashings. */
  cord: () => new THREE.MeshStandardMaterial({ color: 0xcdc6b6, roughness: 1, map: ropeTexture() }),
  /** Steel wire: shrouds and the forestay. */
  wire: () => new THREE.MeshStandardMaterial({ color: 0x3c4043, roughness: 0.5, metalness: 0.7 }),
};

const UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);

export class Rope {
  readonly mesh: THREE.Mesh;
  /** The points the tube runs through; fill them and call `flush`, or use `span` / `path`. */
  readonly pts: THREE.Vector3[];
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private t = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3();

  constructor(readonly n: number, readonly r: number, m: THREE.Material, private sides = 5, private ref: THREE.Vector3 | null = null) {
    this.pts = Array.from({ length: n }, () => new THREE.Vector3());
    const vc = n * (sides + 1);
    this.pos = new Float32Array(vc * 3); this.nor = new Float32Array(vc * 3); this.uv = new Float32Array(vc * 2);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
      const p = i * (sides + 1) + k, q = p + sides + 1;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  /** A line from a to b that hangs `sag` metres in the middle and is pushed `sway` sideways there; never below `floor`. */
  span(a: THREE.Vector3, b: THREE.Vector3, sag = 0, sway?: THREE.Vector3, floor = -Infinity): this {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), k = 4 * t * (1 - t);
      const p = this.pts[i].lerpVectors(a, b, t);
      p.y -= sag * k;
      if (sway) p.addScaledVector(sway, k);
      if (p.y < floor) p.y = floor;
    }
    return this.flush();
  }

  /** Straight runs through the given corners (as many as the rope has points). */
  path(corners: THREE.Vector3[]): this {
    for (let i = 0; i < this.n; i++) this.pts[i].copy(corners[Math.min(i, corners.length - 1)]);
    return this.flush();
  }

  /** A helix of `turns` round the axis from a to b (lacing, a lashing, turns on a drum). */
  helix(a: THREE.Vector3, b: THREE.Vector3, radius: number, turns: number): this {
    const axis = this.t.subVectors(b, a).normalize().clone();
    const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > 0.9 ? X : UP).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    this.ref = axis;
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1), ang = t * turns * Math.PI * 2;
      this.pts[i].lerpVectors(a, b, t).addScaledVector(u, Math.cos(ang) * radius).addScaledVector(v, Math.sin(ang) * radius);
    }
    return this.flush();
  }

  /** Rebuild the tube around `pts`. */
  flush(): this {
    const { n, sides, pts, pos, nor, uv, t, a, b, r } = this;
    const ref = this.ref ?? (Math.abs(t.subVectors(pts[n - 1], pts[0]).normalize().y) > 0.92 ? X : UP);
    let len = 0;
    for (let i = 0; i < n; i++) {
      t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
      if (t.lengthSq() < 1e-10) t.copy(UP);
      t.normalize();
      a.crossVectors(t, ref);
      if (a.lengthSq() < 1e-6) a.crossVectors(t, ref === X ? UP : X);
      a.normalize(); b.crossVectors(t, a);
      if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
      for (let k = 0; k <= sides; k++) {
        const ang = (k / sides) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const nx = a.x * c + b.x * s, ny = a.y * c + b.y * s, nz = a.z * c + b.z * s;
        const o = (i * (sides + 1) + k) * 3;
        pos[o] = pts[i].x + nx * r; pos[o + 1] = pts[i].y + ny * r; pos[o + 2] = pts[i].z + nz * r;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
        const q = (i * (sides + 1) + k) * 2;
        uv[q] = k / sides; uv[q + 1] = len / (r * 9);
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    return this;
  }
}

/** Sag (m, in the middle) of a line of chord `chord` that is `slack` metres longer than that. */
export const sagOf = (slack: number, chord: number) => Math.sqrt(Math.max(0, slack) * chord * 0.375);
