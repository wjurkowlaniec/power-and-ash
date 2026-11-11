import * as THREE from 'three';
import { ST_W, ST_H } from '../../sim/station';

const FLAT_PAST = 3.2;   // m of level ground beyond the west, east and north edges (BOG_DEPTH and a bit)

/** Small shared pieces for the station's view: textures, glows, the see-through hole, terrain height. */

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let disc: THREE.Texture | null = null;
/** A soft round blob, white in the middle, clear at the rim. */
export function softDisc(): THREE.Texture {
  return disc ??= canvasTex(128, 128, c => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
}

/** The halo of a lamp in misty air. `opacity` is driven per frame by whoever owns the lamp. */
export function glow(color: number, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size);
  return s;
}

/** Uniforms of the round see-through hole around Wolt (screen space). */
export interface Hole { uHole: { value: THREE.Vector2 }; uHoleR: { value: number }; uHoleZ: { value: number } }

/**
 * Makes a material drop its fragments in front of Wolt inside a soft, dithered circle, so
 * walls and the roof open around him. Works on top of whatever the material already patches.
 */
export function holeify<T extends THREE.Material>(m: T, hole: Hole): T {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, hole);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec2 uHole; uniform float uHoleR; uniform float uHoleZ;
void main() {
  if (uHoleR > 0.0 && gl_FragCoord.z < uHoleZ) {
    float hd = distance(gl_FragCoord.xy, uHole);
    float n = fract(sin(dot(floor(gl_FragCoord.xy / 2.0), vec2(12.9898, 78.233))) * 43758.5453);
    if (hd < uHoleR * mix(0.82, 1.0, n)) discard;
  }`);
  };
  m.customProgramCacheKey = () => prevKey.call(m) + 'hole';
  return m;
}

/** The same for a stock model: its materials are shared between copies, so they are wrapped once per source. */
const holed = new WeakMap<THREE.Material, THREE.Material>();
export function holeifyObject(o: THREE.Object3D, hole: Hole): THREE.Object3D {
  const wrap = (src: THREE.Material) => {
    if (!holed.has(src)) {
      const c = src.clone();
      // clone() drops the shader patch of the source (the ash fade): carry it over, then add the hole
      c.onBeforeCompile = src.onBeforeCompile; c.customProgramCacheKey = src.customProgramCacheKey;
      holed.set(src, holeify(c, hole));
    }
    return holed.get(src)!;
  };
  o.traverse(c => {
    const me = c as THREE.Mesh;
    if (!me.isMesh) return;
    me.material = Array.isArray(me.material) ? me.material.map(wrap) : wrap(me.material);
  });
  return o;
}

/** Deterministic random numbers for dressing the set (the same station every time). */
export function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Height of the ground: flat inside the map, hills around it, the valley falling away to the south. */
export function groundY(x: number, z: number): number {
  // flat a little past the open sides too: Wolt can roll out there until the loose ash stops him
  const out = Math.max(0, -x - FLAT_PAST, x - ST_W - FLAT_PAST, -z - FLAT_PAST, z - ST_H);
  if (out === 0) return 0;
  const hill = Math.sin(x * 0.09 + z * 0.05) * 0.9 + Math.sin(x * 0.04 - z * 0.08) * 1.4;
  const k = THREE.MathUtils.smoothstep(out, 0, 8);
  return k * (z > ST_H ? -0.3 - out * 0.08 : 0.8 + hill + out * 0.12);
}

/**
 * A soft-edged strip on the ground along a polyline (a trodden path, a road): opaque-ish in
 * the middle, fading out at both edges, following the terrain.
 */
export function groundRibbon(pts: [number, number][], width: number, color: number, alpha: number, lift = 0.015): THREE.Mesh {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color(color);
  // resample so the strip follows the hills
  const fine: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8));
    for (let k = 0; k < n; k++) fine.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  fine.push(pts[pts.length - 1]);
  for (let i = 0; i < fine.length; i++) {
    const a = fine[Math.max(0, i - 1)], b = fine[Math.min(fine.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    // the width wanders a little, and both ends fade out
    const w = width * (0.85 + 0.25 * Math.sin(i * 0.9) * Math.sin(i * 0.37 + 1));
    const end = Math.min(1, i / 3, (fine.length - 1 - i) / 3);
    for (const [s, a2] of [[-1, 0], [-0.45, 1], [0.45, 1], [1, 0]] as const) {
      const x = fine[i][0] + nx * s * w / 2, z = fine[i][1] + nz * s * w / 2;
      pos.push(x, groundY(x, z) + lift, z);
      col.push(c.r, c.g, c.b, a2 * alpha * end);
    }
    if (i < fine.length - 1) for (let k = 0; k < 3; k++) {
      const p = i * 4 + k;
      idx.push(p, p + 1, p + 4, p + 1, p + 5, p + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  return m;
}
