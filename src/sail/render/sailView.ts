import * as THREE from 'three';
import { PAL } from '../../render/palette';
import { mat, mesh } from '../../render/models';
import { Models, fit } from '../../render/assets';
import { GroundFx, Surface, SURFACES as FX, pxPerMetre } from '../../render/groundFx';
import { rod } from '../../craft/render/yachtModels';
import { SailGame } from '../sim/sailGame';
import { MAP, SURFACES, SurfaceId, surfaceAt, surfaceFields, heightAt, LAKE, Obstacle } from '../sim/terrain';
import { WIND, cellEnvelope } from '../sim/windField';
import { gatePoles, Course } from '../sim/courses';
import { YachtView } from './yachtRig';

/**
 * The land yacht demo in 3D. Reads SailGame every frame; never changes it.
 *
 * What makes the wind readable:
 * - the ash darkens and ripples where a gust runs over it ("cat's paws", moving downwind),
 *   and lies smooth and pale in a lull or in the lee of a house;
 * - streaks of blown dust follow the wind at their own spot, so they slow and swirl
 *   behind buildings;
 * - the gate flags and the pennant on the mast stream with the local wind.
 */
const CAM_DIR = new THREE.Vector3(0, 40, 44).normalize();
const CAM_DIST = 90;
const TEX = 1024;
const MAX_CELLS = 32;
const SHADOW_N = 128;

/** Marks and dust per surface for GroundFx. */
const MARKS: Record<SurfaceId, Surface> = {
  ash: { ...FX.ash },
  loose: { marks: 0.8, color: 0x57524a, dust: 1.2, dustColor: 0xe2ddd2, life: 160 },
  lake: { marks: 0.28, color: 0x9d988e, dust: 0.35, dustColor: 0xe8e5de, life: 220 },
  road: { ...FX.concrete },
  gravel: { marks: 0.3, color: 0x5d5952, dust: 0.4, dustColor: 0xb2ada4, life: 80 },
  mud: { marks: 0.95, color: 0x2c2823, dust: 0, dustColor: 0x6b6358, life: 200 },
};

export class SailView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private sun: THREE.DirectionalLight;
  private zoom = 1;
  private viewSize = 16;
  private camTarget = new THREE.Vector3();
  private camLead = new THREE.Vector3();
  private shake = 0;
  private uniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2(1, 0) },
    uWindSpeed: { value: 7 },
    uCells: { value: Array.from({ length: MAX_CELLS }, () => new THREE.Vector4(0, 0, 1, 0)) },
    uShadow: { value: null as THREE.DataTexture | null },
    uMapSize: { value: MAP.size },
  };
  private shadowTex: THREE.DataTexture;
  private shadowDir = 99;
  private yacht: YachtView;
  private fxL: GroundFx; private fxR: GroundFx; private fxF: GroundFx;
  private streaks: THREE.LineSegments;
  private streakP: Float32Array; private streakAge: Float32Array;
  private windGrid = { x0: 0, y0: 0, step: 4, n: 26, vx: new Float32Array(26 * 26), vy: new Float32Array(26 * 26), t: 99 };
  private gates: { group: THREE.Group; flags: THREE.Mesh[]; line: THREE.Mesh; poles: THREE.Vector3[] }[] = [];
  private gateCourse: Course | null = null;
  private arrow: THREE.Mesh;
  private flagBase: Float32Array | null = null;

  constructor(private g: SailGame, container: HTMLElement, private models: Models) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(r.domElement);
    this.renderer = r;
    const s = this.scene;
    s.background = new THREE.Color(PAL.sky);
    s.fog = new THREE.Fog(PAL.fog, CAM_DIST + 5, CAM_DIST + 95);
    s.add(new THREE.HemisphereLight(0xe6e2d8, 0x5f5a52, 1.3));
    const sun = new THREE.DirectionalLight(0xf3ecdf, 1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
    sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
    s.add(sun); s.add(sun.target); this.sun = sun;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);

    this.shadowTex = new THREE.DataTexture(new Uint8Array(SHADOW_N * SHADOW_N * 4), SHADOW_N, SHADOW_N, THREE.RGBAFormat);
    this.shadowTex.magFilter = THREE.LinearFilter; this.shadowTex.minFilter = THREE.LinearFilter;
    this.uniforms.uShadow.value = this.shadowTex;

    this.buildGround();
    for (const o of g.obstacles) this.addObstacle(o);
    this.buildPowerLines();
    this.buildDecor();

    this.yacht = new YachtView(models);
    s.add(this.yacht.root);
    const surf = (x: number, z: number) => ({ ...MARKS[surfaceAt(x, z)], y: heightAt(x, z) + 0.02 });
    this.fxL = new GroundFx(surf); this.fxR = new GroundFx(surf); this.fxF = new GroundFx(surf);
    for (const f of [this.fxL, this.fxR, this.fxF]) s.add(f.group);

    // blown dust: short streaks that ride the local wind
    const N = 700;
    this.streakP = new Float32Array(N * 6); this.streakAge = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.streakP, 3));
    const col = new Float32Array(N * 6); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.streaks = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false }));
    this.streaks.frustumCulled = false;
    s.add(this.streaks);
    for (let i = 0; i < N; i++) this.streakAge[i] = -Math.random() * 3;

    // the arrow to the next gate
    const sh = new THREE.Shape(); sh.moveTo(0, 0.9); sh.lineTo(0.55, -0.3); sh.lineTo(0, 0); sh.lineTo(-0.55, -0.3); sh.closePath();
    const ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2); ag.rotateY(Math.PI); // tip to +z
    this.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
    this.arrow.renderOrder = 3;
    s.add(this.arrow);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- the ground

  /**
   * The surfaces as signed fields (road, mud, loose ash, gravel; the lake is an ellipse in the
   * shader) baked once into a texture. The shader turns them into colour with edges that stay
   * crisp at any zoom, and draws the detail itself: cracks in the asphalt, the salt crust,
   * ripples in the dunes, grains of gravel.
   */
  private bakeFields(): THREE.DataTexture {
    const d = new Uint8Array(TEX * TEX * 4);
    const k = MAP.size / TEX;
    const enc = (v: number, range: number) => Math.max(0, Math.min(255, Math.round((v / range + 0.5) * 255)));
    for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
      const f = surfaceFields((i + 0.5) * k, (j + 0.5) * k);
      const o = (j * TEX + i) * 4;
      d[o] = enc(f.road, 12.75); d[o + 1] = enc(f.mud, 12.75); d[o + 2] = enc(f.loose, 2); d[o + 3] = enc(f.gravel, 25.5);
    }
    const t = new THREE.DataTexture(d, TEX, TEX, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  private buildGround() {
    const M = 160, S = MAP.size + M * 2, seg = 330;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2);
    geo.translate(MAP.size / 2, 0, MAP.size / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, heightAt(x, z));
      uv.setXY(i, x / MAP.size, z / MAP.size);
    }
    geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const C = (id: SurfaceId) => new THREE.Color(SURFACES[id].color);
    const gu = {
      uFields: { value: this.bakeFields() },
      uLake: { value: new THREE.Vector4(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry) },
      uAsh: { value: C('ash') }, uLoose: { value: C('loose') }, uGravel: { value: C('gravel') },
      uMud: { value: C('mud') }, uSalt: { value: C('lake') }, uRoad: { value: C('road') },
    };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.uniforms, gu);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos;
          uniform float uTime; uniform vec2 uWind; uniform float uWindSpeed; uniform float uMapSize;
          uniform vec4 uCells[${MAX_CELLS}]; uniform sampler2D uShadow;
          uniform sampler2D uFields; uniform vec4 uLake;
          uniform vec3 uAsh, uLoose, uGravel, uMud, uSalt, uRoad;
          float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
          // edges anti-aliased by the field's own gradient (crisp up close, smooth far away)
          float edge(float f, float soft) { float e = max(fwidth(f), 1e-4) * 0.75 + soft; return smoothstep(-e, e, f); }
          // salt crust: 1 on the cracks between plates (cell edges of a jittered grid)
          float crust(vec2 p) {
            vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              float d = length(g + vec2(h21(i + g), h21(i + g + 17.3)) - f);
              if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
            }
            return 1.0 - smoothstep(0.0, 0.07, d2 - d1);
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec2 wp = vWPos.xz;
            vec4 F = texture2D(uFields, clamp(wp / uMapSize, 0.0, 1.0));
            float road = (F.r - 0.5) * 12.75, mud = (F.g - 0.5) * 12.75, loose = (F.b - 0.5) * 2.0, grav = (F.a - 0.5) * 25.5;
            vec2 lq = (wp - uLake.xy) / uLake.zw;
            float lake = 0.97 - length(lq);
            float big = vn(wp * 0.08);
            vec3 col = uAsh * (0.93 + 0.1 * big + 0.04 * vn(wp * 0.5));
            col = mix(col, uLoose * (0.95 + 0.06 * sin(wp.x * 2.1 + wp.y * 0.9 + big * 4.0)), edge(loose, 0.02)); // wind ripples
            col = mix(col, uGravel * (0.78 + 0.4 * h21(floor(wp * 7.0))), edge(grav, 0.5));
            col = mix(col, uMud * (0.82 + 0.22 * vn(wp * 0.6)), edge(mud, 0.3));
            col = mix(col, uSalt * (1.03 - 0.13 * crust(wp * 0.55 + vec2(vn(wp * 0.2), vn(wp * 0.2 + 3.0)) * 0.6) - 0.05 * crust(wp * 1.9)) * (0.93 + 0.07 * clamp(lake * 8.0, 0.0, 1.0)), edge(lake, 0.003));
            vec3 rc = uRoad * (0.9 + 0.12 * clamp(road / 1.2, 0.0, 1.0)) * (1.0 - 0.12 * smoothstep(0.78, 0.86, vn(wp * 1.7)));
            rc = mix(rc, rc * 1.45, smoothstep(3.35, 3.5, road) * step(0.45, vn(wp * 0.12))); // what is left of the middle line
            col = mix(col, rc, edge(road, 0.04));
            diffuseColor.rgb *= col;
            // fine grain so the ash never looks flat up close
            diffuseColor.rgb *= 0.93 + 0.08 * vn(wp * 3.1) + 0.04 * vn(wp * 13.0);
            vec2 wd = uWind, wn = vec2(-wd.y, wd.x);
            float a = dot(wp, wd), c = dot(wp, wn);
            float g = 0.0;
            for (int i = 0; i < ${MAX_CELLS}; i++) { vec4 k = uCells[i]; vec2 d = wp - k.xy; g += k.w * exp(-dot(d, d) / (k.z * k.z)); }
            float sh = texture2D(uShadow, clamp(wp / uMapSize, 0.0, 1.0)).r;
            float gust = max(g, 0.0) * (1.0 - sh);
            // cat's paws: short dark ripples running downwind with the air
            float rip = vn(vec2(a * 0.8 - uTime * uWindSpeed * 0.8, c * 2.2)) * vn(vec2(a * 0.22 - uTime * uWindSpeed * 0.3, c * 0.3));
            diffuseColor.rgb *= 1.0 - gust * (0.1 + 0.42 * rip);
            // lulls and the lee of things: smooth and a touch paler
            float calm = clamp(max(-g, 0.0) * 1.2 + sh, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.07 + 0.015, calm * 0.65);
            // everywhere: faint blown-dust streaks
            float st = vn(vec2(a * 0.3 - uTime * uWindSpeed * 1.1, c * 2.6));
            diffuseColor.rgb += smoothstep(0.72, 0.97, st) * 0.025 * (1.0 - sh) * (uWindSpeed / 7.0) * (1.0 + gust);
          }`);
    };
    const ground = new THREE.Mesh(geo, m);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Re-bake the obstacles' wind shadow into a texture (when the wind has turned enough). */
  private bakeShadow() {
    const w = this.g.wind;
    if (Math.abs(w.dir - this.shadowDir) < 0.03) return;
    this.shadowDir = w.dir;
    const ux = Math.cos(w.dir), uy = Math.sin(w.dir);
    const data = this.shadowTex.image.data as Uint8Array;
    const k = MAP.size / SHADOW_N;
    for (let j = 0; j < SHADOW_N; j++) for (let i = 0; i < SHADOW_N; i++) {
      const b = w.shadowAt((i + 0.5) * k, (j + 0.5) * k, ux, uy).block;
      const o = (j * SHADOW_N + i) * 4;
      data[o] = Math.round(b * 255); data[o + 3] = 255;
    }
    this.shadowTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- things on the map

  private addObstacle(o: Obstacle) {
    const md = this.models;
    let m: THREE.Object3D;
    const r = (n: number) => { const s = Math.sin(o.x * 12.9898 + o.y * 78.233 + n) * 43758.5453; return s - Math.floor(s); };
    switch (o.kind) {
      case 'building': {
        const names = ['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2'];
        const rot = Math.floor(r(1) * 4) * Math.PI / 2;
        m = fit(md, names[o.model % 3], o.hw! * 2, o.hh! * 2, o.height, rot);
        if (!md.has(names[o.model % 3])) m = mesh(new THREE.BoxGeometry(o.hw! * 2, o.height, o.hh! * 2), mat(PAL.silhouette2), 0, o.height / 2, 0);
        break;
      }
      case 'tree': m = fit(md, `DeadTree_${1 + (o.model % 5)}`, 4.5, 4.5, o.height, o.rot); break;
      case 'rock': m = fit(md, `Rock_Medium_${1 + (o.model % 3)}`, o.r * 2.2, o.r * 2.2, o.height * 1.2, o.rot); break;
      case 'pylon': m = pylon(o.height); m.rotation.y = -o.rot; break;
      case 'wall': m = brokenWall(o.hw! * 2, o.height); break;
    }
    m.position.set(o.x, heightAt(o.x, o.y) - 0.05, o.y);
    m.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(m);
  }

  /** Sagging cables from pylon to pylon along the road. */
  private buildPowerLines() {
    const pyl = this.g.obstacles.filter(o => o.kind === 'pylon');
    const m = mat(0x26282a, { r: 0.6, m: 0.5 });
    for (let i = 1; i < pyl.length; i++) {
      const a = pyl[i - 1], b = pyl[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 70) continue;
      for (const off of [-1.3, 1.3]) {
        const pa = new THREE.Vector3(a.x + Math.sin(a.rot) * off, heightAt(a.x, a.y) + a.height - 0.9, a.y - Math.cos(a.rot) * off);
        const pb = new THREE.Vector3(b.x + Math.sin(b.rot) * off, heightAt(b.x, b.y) + b.height - 0.9, b.y - Math.cos(b.rot) * off);
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 16; k++) { const t = k / 16; const p = pa.clone().lerp(pb, t); p.y -= Math.sin(t * Math.PI) * 2.2; pts.push(p); }
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 4), m);
        tube.castShadow = true;
        this.scene.add(tube);
      }
    }
  }

  /** Grass, pebbles and bushes, more where the ground is firm, none on the road or the salt. */
  private buildDecor() {
    const md = this.models;
    const kinds = ['Grass_Wispy_Short', 'Grass_Wispy_Tall', 'Pebble_Round_2', 'Pebble_Square_3', 'Pebble_Round_4', 'Bush_Common'];
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const proto = new Map<string, THREE.Object3D>();
    for (const k of kinds) if (md.has(k)) proto.set(k, fit(md, k, 1, 1));
    if (!proto.size) return;
    for (let i = 0; i < 520; i++) {
      const x = rnd() * MAP.size, y = rnd() * MAP.size;
      const s = surfaceAt(x, y);
      if (s === 'road' || s === 'lake' || s === 'mud') continue;
      const k = kinds[Math.floor(rnd() * kinds.length)];
      const p = proto.get(k); if (!p) continue;
      const o = p.clone();
      const sc = k.startsWith('Bush') ? 1.2 + rnd() : k.startsWith('Grass') ? 0.8 + rnd() * 0.8 : 0.3 + rnd() * 0.5;
      o.scale.setScalar(sc);
      o.rotation.y = rnd() * 6.28;
      o.position.set(x, heightAt(x, y) - 0.02, y);
      o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = !k.startsWith('Pebble'); c.receiveShadow = true; } });
      this.scene.add(o);
    }
  }

  /** Gate poles with flags for the current course (rebuilt when the course changes). */
  private syncGates() {
    const run = this.g.run;
    const c = run?.course ?? null;
    if (c === this.gateCourse) return;
    this.gateCourse = c;
    for (const gt of this.gates) this.scene.remove(gt.group);
    this.gates = [];
    if (!c) return;
    const poleM = mat(0x2a2c2e, { r: 0.6, m: 0.4 }), bandM = mat(PAL.warn, { r: 0.7, e: PAL.warn, ei: 0.25 });
    c.gates.forEach((_, i) => {
      // a closed loop's finish is its start gate: build it once
      if (i === c.gates.length - 1 && c.gates[0].x === c.gates[i].x && c.gates[0].y === c.gates[i].y) { this.gates.push(this.gates[0]); return; }
      const group = new THREE.Group();
      const [a, b] = gatePoles(c, i);
      const poles: THREE.Vector3[] = [];
      const flags: THREE.Mesh[] = [];
      for (const p of [a, b]) {
        const base = new THREE.Vector3(p.x, heightAt(p.x, p.y), p.y);
        const top = base.clone(); top.y += 4.2;
        group.add(rod(base, top, 0.07, poleM, 8));
        for (const yb of [1.2, 2.2]) { const band = rod(base.clone().setY(base.y + yb), base.clone().setY(base.y + yb + 0.35), 0.075, bandM, 8); group.add(band); }
        const fg = new THREE.PlaneGeometry(1.4, 0.7, 10, 3); fg.translate(0.7, 0, 0);
        const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: PAL.warn, roughness: 0.9, side: THREE.DoubleSide, emissive: PAL.warn, emissiveIntensity: 0.15 }));
        flag.position.copy(top).setY(top.y - 0.4);
        flag.castShadow = true;
        group.add(flag); flags.push(flag);
        poles.push(base);
      }
      // a line on the ground between the poles
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const lg = new THREE.PlaneGeometry(len, 0.35); lg.rotateX(-Math.PI / 2);
      const line = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.5, depthWrite: false }));
      line.position.set((a.x + b.x) / 2, Math.max(heightAt(a.x, a.y), heightAt(b.x, b.y), heightAt((a.x + b.x) / 2, (a.y + b.y) / 2)) + 0.05, (a.y + b.y) / 2);
      line.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
      line.renderOrder = 2;
      group.add(line);
      this.scene.add(group);
      this.gates.push({ group, flags, line, poles });
    });
  }

  // ---------------------------------------------------------------- camera

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    const a = w / h;
    const vs = (a < 1 ? this.viewSize / a * 0.9 : this.viewSize) * this.zoom;
    Object.assign(this.camera, { left: -vs * a, right: vs * a, top: vs, bottom: -vs });
    this.camera.updateProjectionMatrix();
  }

  zoomBy(f: number) { this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.22, 2.2); this.resize(); }

  /** A jolt for the camera (a bump, a wheel slamming down). */
  kick(a: number) { this.shake = Math.max(this.shake, Math.min(1, a)); }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    const g = this.g, y = g.yacht;
    this.bakeShadow();
    this.syncGates();

    // wind uniforms for the ground
    const w = g.wind;
    this.uniforms.uTime.value = t;
    this.uniforms.uWind.value.set(Math.cos(w.dir), Math.sin(w.dir));
    this.uniforms.uWindSpeed.value = w.speed;
    const cells = this.uniforms.uCells.value;
    for (let i = 0; i < MAX_CELLS; i++) {
      const c = w.cells[i];
      if (c) cells[i].set(c.x, c.y, c.r, Math.max(-0.6, c.amp) * cellEnvelope(c));
      else cells[i].set(0, 0, 1, 0);
    }

    // the yacht and its tracks
    const ground = (x: number, z: number) => heightAt(x, z);
    this.yacht.update(dt, t, y, ground);
    this.tracks(dt);

    this.updateStreaks(dt);
    this.updateGates(t);

    // camera: leads the yacht, pulls out with speed, shakes on a bump
    const want = 11 + Math.min(y.speed, 22) * 0.5;
    this.viewSize += (want - this.viewSize) * Math.min(1, dt * 0.8);
    this.resize();
    const lead = new THREE.Vector3(y.vx, 0, y.vy).multiplyScalar(0.9);
    lead.clampLength(0, 16);
    this.camLead.lerp(lead, Math.min(1, dt * 1.5));
    const target = new THREE.Vector3(y.x, heightAt(y.x, y.y), y.y).add(this.camLead);
    this.camTarget.lerp(target, Math.min(1, dt * 5));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.5;
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_DIR, CAM_DIST);
    this.camera.position.x += (Math.random() - 0.5) * sh; this.camera.position.y += (Math.random() - 0.5) * sh;
    this.camera.lookAt(this.camTarget);
    this.sun.position.copy(this.camTarget).add(new THREE.Vector3(-30, 60, -18));
    this.sun.target.position.copy(this.camTarget);

    // the arrow to the next gate rides just ahead of the yacht
    const run = g.run;
    if (run && !run.done) {
      const gt = run.course.gates[run.next];
      const ang = Math.atan2(gt.y - y.y, gt.x - y.x);
      const d = Math.hypot(gt.x - y.x, gt.y - y.y);
      const r = 4.2;
      this.arrow.visible = d > 12;
      this.arrow.position.set(y.x + Math.cos(ang) * r, heightAt(y.x, y.y) + 0.3, y.y + Math.sin(ang) * r);
      this.arrow.rotation.y = Math.PI / 2 - ang;
      (this.arrow.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * Math.sin(t * 4);
    } else this.arrow.visible = false;

    this.renderer.render(this.scene, this.camera);
  }

  private tracks(dt: number) {
    const y = this.g.yacht;
    const yaw = Math.PI / 2 - y.heading;
    const fx = Math.cos(y.heading), fy = Math.sin(y.heading), px = -fy, py = fx;
    const half = this.yacht.trackHalf, back = -0.5;
    const lifted = Math.abs(y.heel) > 0.02 || y.capsized > 0;
    const slip = y.sliding ? 0.6 : 0;
    const f = { yaw, speed: y.u, accel: 0, yawRate: y.yawRate, slip };
    const at = (s: number) => ({ x: y.x + px * half * s + fx * back, z: y.y + py * half * s + fy * back });
    // the windward wheel is in the air when she flies
    if (!(lifted && y.heel < 0)) this.fxR.wheel({ ...at(1), ...f }, dt); else this.fxR.wheel({ x: 1e6, z: 1e6, ...f }, dt);
    if (!(lifted && y.heel > 0)) this.fxL.wheel({ ...at(-1), ...f }, dt); else this.fxL.wheel({ x: 1e6, z: 1e6, ...f }, dt);
    this.fxF.wheel({ x: y.x + fx * 1.7, z: y.y + fy * 1.7, ...f, slip: 0 }, dt);
    const wd = this.g.here;
    const ppm = pxPerMetre(this.renderer, this.camera);
    for (const fx2 of [this.fxL, this.fxR, this.fxF]) {
      fx2.setWind(Math.cos(wd.dir) * wd.speed * 0.4, Math.sin(wd.dir) * wd.speed * 0.4);
      fx2.setScale(ppm);
      fx2.update(dt);
    }
  }

  /** Blown dust: streaks that move with the wind at their own spot (sampled on a coarse grid). */
  private updateStreaks(dt: number) {
    const G = this.windGrid, w = this.g.wind;
    G.t += dt;
    const cx = this.camTarget.x, cz = this.camTarget.z;
    const span = G.step * (G.n - 1);
    if (G.t > 0.25) {
      G.t = 0;
      G.x0 = cx - span / 2; G.y0 = cz - span / 2;
      for (let j = 0; j < G.n; j++) for (let i = 0; i < G.n; i++) {
        const s = w.at(G.x0 + i * G.step, G.y0 + j * G.step);
        G.vx[j * G.n + i] = Math.cos(s.dir) * s.speed; G.vy[j * G.n + i] = Math.sin(s.dir) * s.speed;
      }
    }
    const P = this.streakP, A = this.streakAge;
    const col = (this.streaks.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    const N = A.length;
    const base = new THREE.Color(0xeeeae2), sky = new THREE.Color(PAL.ground);
    for (let i = 0; i < N; i++) {
      const o = i * 6;
      A[i] += dt;
      let x = P[o], z = P[o + 2];
      const out = x < G.x0 || x > G.x0 + span || z < G.y0 || z > G.y0 + span;
      if (A[i] > 2.8 || out || A[i] < 0 && A[i] + dt >= 0) {
        // respawn somewhere in view, a bit upwind
        x = cx + (Math.random() - 0.5) * span * 0.95; z = cz + (Math.random() - 0.5) * span * 0.95;
        A[i] = Math.random() * 0.3;
      }
      if (A[i] < 0) { P[o + 1] = -100; P[o + 4] = -100; continue; }
      // bilinear wind from the grid
      const gx = Math.max(0, Math.min(G.n - 1.001, (x - G.x0) / G.step)), gz = Math.max(0, Math.min(G.n - 1.001, (z - G.y0) / G.step));
      const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
      const k = iz * G.n + ix;
      const vx = (G.vx[k] * (1 - fx) + G.vx[k + 1] * fx) * (1 - fz) + (G.vx[k + G.n] * (1 - fx) + G.vx[k + G.n + 1] * fx) * fz;
      const vz = (G.vy[k] * (1 - fx) + G.vy[k + 1] * fx) * (1 - fz) + (G.vy[k + G.n] * (1 - fx) + G.vy[k + G.n + 1] * fx) * fz;
      const sp = Math.hypot(vx, vz);
      const wob = Math.sin(A[i] * 5 + i) * 0.5;
      x += (vx * 1.1 + wob) * dt; z += (vz * 1.1 - wob) * dt;
      const h = heightAt(x, z) + 0.15 + (i % 7) * 0.12;
      const L = 0.05 + sp * 0.045;
      P[o] = x; P[o + 1] = h; P[o + 2] = z;
      P[o + 3] = x - (vx / (sp || 1)) * L; P[o + 4] = h; P[o + 5] = z - (vz / (sp || 1)) * L;
      // only moving air carries dust: in a lull or a lee the streaks fade out
      const life = Math.min(1, A[i] * 3, (2.8 - A[i]) * 2);
      const a = life * Math.max(0, Math.min(1, (sp - WIND.base * 0.7) / (WIND.base * 0.9)));
      const c = sky.clone().lerp(base, a);
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; col[o + 3] = sky.r; col[o + 4] = sky.g; col[o + 5] = sky.b;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.streaks.geometry.attributes.color.needsUpdate = true;
  }

  /** Flags stream with the local wind; the next gate glows. */
  private updateGates(t: number) {
    const run = this.g.run;
    if (!run) return;
    const seen = new Set<object>();
    this.gates.forEach((gt, i) => {
      if (seen.has(gt)) return;
      seen.add(gt);
      const isNext = i === run.next || (run.next === this.gates.length - 1 && gt === this.gates[run.next]);
      const passed = i < run.next && !isNext;
      (gt.line.material as THREE.MeshBasicMaterial).opacity = isNext ? 0.55 + 0.3 * Math.sin(t * 5) : passed ? 0.08 : 0.25;
      gt.flags.forEach((f, k) => {
        const p = gt.poles[k];
        const s = this.g.wind.at(p.x, p.z);
        f.rotation.y = -s.dir;
        const m = f.material as THREE.MeshStandardMaterial;
        m.color.setHex(passed ? 0x6d6a64 : PAL.warn); m.emissiveIntensity = isNext ? 0.5 : 0.1;
        // a travelling ripple along the flag, harder in a gust, limp in a lee
        const pos = f.geometry.attributes.position as THREE.BufferAttribute;
        if (!this.flagBase || this.flagBase.length !== pos.array.length) this.flagBase = Float32Array.from(pos.array);
        const fb = this.flagBase;
        const st = Math.min(1, s.speed / 8);
        for (let v = 0; v < pos.count; v++) {
          const x = fb[v * 3], yy = fb[v * 3 + 1];
          const u = x / 1.4;
          pos.setXYZ(v, x * (0.35 + 0.65 * st), yy - (1 - st) * u * 0.55, Math.sin(u * 6 - t * (4 + s.speed)) * 0.12 * u * (0.3 + st));
        }
        pos.needsUpdate = true;
      });
    });
  }
}

/** A lattice pylon: four tapering legs, cross bracing, a crossarm with insulators. */
function pylon(h: number): THREE.Group {
  const g = new THREE.Group();
  const m = mat(PAL.silhouette, { r: 0.6, m: 0.5 });
  const b0 = 1.3, b1 = 0.35;
  const leg = (sx: number, sz: number, y: number) => { const t = y / h; const b = b0 + (b1 - b0) * t; return new THREE.Vector3(sx * b, y, sz * b); };
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) g.add(rod(leg(sx, sz, 0), leg(sx, sz, h), 0.06, m, 5));
  for (let y = 0, k = 0; y < h - 1; y += 1.6, k++) {
    const y2 = Math.min(h, y + 1.6);
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      g.add(rod(leg(ax, az, y2), leg(bx, bz, y2), 0.03, m, 4));
      g.add(rod(leg(ax, az, k % 2 ? y : y2), leg(bx, bz, k % 2 ? y2 : y), 0.022, m, 4));
    }
  }
  // crossarm across the line (local z) with hanging insulators
  const top = h - 0.9;
  g.add(rod(new THREE.Vector3(0, top, -1.7), new THREE.Vector3(0, top, 1.7), 0.06, m, 5));
  for (const z of [-1.3, 1.3]) {
    g.add(rod(new THREE.Vector3(0, top, z), new THREE.Vector3(0, top - 0.5, z), 0.05, mat(0x6d6f6c, { r: 0.4 }), 6));
    g.add(rod(new THREE.Vector3(0, top, z), new THREE.Vector3(0, h - 0.1, 0), 0.025, m, 4));
  }
  return g;
}

/** A broken concrete wall: uneven slabs with gaps, rebar sticking out. */
function brokenWall(len: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const m = mat(0x7d7a73, { r: 0.95 }), dark = mat(0x3b3734, { r: 0.6, m: 0.5 });
  const n = Math.round(len / 1.5);
  for (let i = 0; i < n; i++) {
    if (i === 3 || i === 7) continue; // collapsed
    const hh = h * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.7)));
    const s = mesh(new THREE.BoxGeometry(1.45, hh, 0.3), m, -len / 2 + (i + 0.5) * (len / n), hh / 2, 0);
    s.rotation.z = Math.sin(i * 1.3) * 0.03;
    g.add(s);
    if (i % 2) g.add(rod(new THREE.Vector3(-len / 2 + (i + 0.3) * (len / n), hh, 0), new THREE.Vector3(-len / 2 + (i + 0.4) * (len / n), hh + 0.5, 0.1), 0.015, dark, 4));
  }
  // rubble at the gaps
  for (const i of [3, 7]) for (let k = 0; k < 4; k++) {
    const r = mesh(new THREE.DodecahedronGeometry(0.25 + 0.1 * k), m, -len / 2 + (i + 0.5) * (len / n) + (k - 1.5) * 0.35, 0.15, (k % 2 - 0.5) * 0.4);
    g.add(r);
  }
  return g;
}
