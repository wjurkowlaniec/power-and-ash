import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WIND } from './atmosphere';

/**
 * The station is dressed from thousands of small meshes (boxes, stock models, trees). Left
 * alone that is thousands of draw calls, twice with shadows. Once the set is built, everything
 * that never moves is baked into world space and merged per material, so the whole set draws
 * in a few dozen calls.
 *
 * - `userData.live = true` on an object keeps it and everything under it out (doors, rotors,
 *   Wolt, anything a view animates or shows and hides).
 * - `userData.sway = true` marks plants: they are merged too, into meshes whose material bends
 *   them with the gusts in the vertex shader (see `swayTime`).
 */
export const swayTime = { value: 0 };

const ATTRS = ['position', 'normal', 'uv'] as const;

/** A plain float copy of an attribute (stock models come quantised to integers). */
function floats(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined, n: number, size: number): THREE.Float32BufferAttribute {
  const out = new Float32Array(n * size);
  if (a) for (let i = 0; i < n; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size === 3) out[i * size + 2] = a.getZ(i); }
  return new THREE.Float32BufferAttribute(out, size);
}

function baked(m: THREE.Mesh): THREE.BufferGeometry {
  const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
  const n = src.attributes.position.count, g = new THREE.BufferGeometry();
  for (const k of ATTRS) g.setAttribute(k, floats(src.attributes[k] as THREE.BufferAttribute | undefined, n, k === 'uv' ? 2 : 3));
  if (!src.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(m.matrixWorld);
  if (m.matrixWorld.determinant() < 0) {
    // a mirrored copy: turn its triangles round so they still face out
    for (const k of ATTRS) {
      const a = g.attributes[k] as THREE.BufferAttribute, s = a.itemSize, arr = a.array as Float32Array;
      for (let i = 0; i < n; i += 3) for (let j = 0; j < s; j++) { const t = arr[(i + 1) * s + j]; arr[(i + 1) * s + j] = arr[(i + 2) * s + j]; arr[(i + 2) * s + j] = t; }
    }
  }
  return g;
}

/** The same material, bending with the wind: higher off the ground leans further. */
function swaying(src: THREE.Material): THREE.Material {
  const m = src.clone(), prev = src.onBeforeCompile, key = src.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uSwayT = swayTime;
    sh.uniforms.uSwayW = { value: new THREE.Vector2(WIND.x, WIND.z) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayT; uniform vec2 uSwayW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = max(transformed.y, 0.0);
          float ph = transformed.x * 0.35 + transformed.z * 0.2;
          // a slow wave of wind crossing the yard, and each blade's own quick shiver on top
          float gust = 0.55 + 0.45 * sin(uSwayT * 0.7 - ph);
          float lean = 0.1 + 0.2 * gust + sin(uSwayT * 3.1 + ph * 7.0) * 0.05 * gust;
          transformed.xz += uSwayW * lean * h * h * 1.8;
        }`);
  };
  m.customProgramCacheKey = () => key.call(src) + 'sway';
  return m;
}

export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; sway: boolean; geos: THREE.BufferGeometry[] }>();
  const gone: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D, sway: boolean) => {
    if (o.userData.live || !o.visible) return;
    sway ||= !!o.userData.sway;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material)) {
      const mt = m.material as THREE.MeshStandardMaterial;
      if (!mt.transparent && !mt.vertexColors && mt.side === THREE.FrontSide) {
        const key = `${mt.uuid}|${m.castShadow}|${m.receiveShadow}|${sway}`;
        if (!groups.has(key)) groups.set(key, { mat: mt, cast: m.castShadow, recv: m.receiveShadow, sway, geos: [] });
        groups.get(key)!.geos.push(baked(m));
        gone.push(m);
      }
    }
    for (const c of o.children) walk(c, sway);
  };
  walk(root, false);
  for (const m of gone) m.removeFromParent();
  for (const g of groups.values()) {
    const geo = mergeGeometries(g.geos, false);
    for (const x of g.geos) x.dispose();
    const mesh = new THREE.Mesh(geo, g.sway ? swaying(g.mat) : g.mat);
    mesh.castShadow = g.cast; mesh.receiveShadow = g.recv;
    root.add(mesh);
  }
}
