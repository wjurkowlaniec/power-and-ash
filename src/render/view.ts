import * as THREE from 'three';
import { PAL } from './palette';
import { mat, mesh, obstacleMesh, yachtModel, stationModel, woltModel, rnd, YachtModel, StationModel, WoltModel } from './models';
import { Game, CABLE_WARN } from '../sim/game';
import { Obstacle } from '../sim/world';
import { V2 } from '../sim/vec';

const GROUND_Y = 0;
const CABLE_Y = 0.06;
const CAM_OFFSET = new THREE.Vector3(0, 40, 44);

/** Everything 3D. Reads the Game state every frame; never changes it. */
export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  private viewSize = 11;
  private sun: THREE.DirectionalLight;
  private yacht: YachtModel;
  private station: StationModel;
  private wolt: WoltModel;

  private cableMeshes = new Map<object, { mesh: THREE.Mesh; key: string }>();
  private ring: THREE.Mesh;
  private portRing: THREE.Mesh;
  private cursor: THREE.LineSegments;
  private pulses: THREE.InstancedMesh;
  private dust: THREE.Points;
  private camTarget = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private walkPhase = 0;
  private overlay = false;
  private zoom = 1;
  private obstacleMeshes = new Map<Obstacle, THREE.Object3D>();
  private departStart: THREE.Vector3 | null = null;

  constructor(private game: Game, container: HTMLElement) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    this.renderer = r;

    const s = this.scene;
    s.background = new THREE.Color(PAL.sky);
    s.fog = new THREE.Fog(PAL.fog, 46, 92);
    s.add(new THREE.HemisphereLight(0xe6e2d8, 0x5f5a52, 1.25));
    const sun = new THREE.DirectionalLight(0xf3ecdf, 1.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
    sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
    s.add(sun); s.add(sun.target); this.sun = sun;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    this.buildGround();
    this.buildGrid();

    const lv = game.level;
    for (const o of game.world.obstacles) if (o.kind !== 'yacht' && o.kind !== 'station') {
      const m = obstacleMesh(o); s.add(m); this.obstacleMeshes.set(o, m);
    }
    const yp = lv.ports.find(p => p.id === 'yacht')!, sp = lv.ports.find(p => p.id === 'station')!;
    this.yacht = yachtModel(lv.yacht, new THREE.Vector3(yp.pos.x - (lv.yacht.x + lv.yacht.w / 2), yp.height, yp.pos.y - (lv.yacht.y + lv.yacht.h / 2)));
    s.add(this.yacht.group);
    this.station = stationModel(lv.station, new THREE.Vector3(sp.pos.x - (lv.station.x + lv.station.w / 2), sp.height, sp.pos.y - (lv.station.y + lv.station.h / 2)));
    s.add(this.station.group);
    this.wolt = woltModel(); s.add(this.wolt.group);

    const ringMat = new THREE.MeshBasicMaterial({ color: PAL.warn, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; s.add(this.ring);
    this.portRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 32), new THREE.MeshBasicMaterial({ color: PAL.ok, side: THREE.DoubleSide, transparent: true, opacity: 0.9, fog: false }));
    this.portRing.rotation.x = -Math.PI / 2; this.portRing.position.y = 0.05; s.add(this.portRing);

    const cg = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)); cg.rotateX(-Math.PI / 2);
    this.cursor = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false }));
    this.cursor.position.y = 0.03; s.add(this.cursor);

    this.pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.flow, fog: false }), 64);
    this.pulses.count = 0; s.add(this.pulses);

    this.dust = this.buildDust(); s.add(this.dust);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private buildGround(): THREE.Mesh {
    const { width: W, height: H } = this.game.level;
    const g = new THREE.PlaneGeometry(W + 140, H + 140, 120, 100); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const colors: number[] = [];
    const c1 = new THREE.Color(PAL.ground), c2 = new THREE.Color(PAL.groundDark), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + W / 2, z = p.getZ(i) + H / 2;
      const out = Math.max(0, -x, x - W, -z, z - H);
      const dune = Math.sin(x * 0.11 + z * 0.04) * 1.1 + Math.sin(x * 0.03 - z * 0.07) * 1.8 + Math.sin(z * 0.17) * 0.3;
      // a flat trail leading west from the yacht, so it can leave the map
      const ys = this.game.level.yacht;
      const trail = x < ys.x + ys.w ? 1 - THREE.MathUtils.smoothstep(Math.abs(z - (ys.y + ys.h / 2)), ys.h / 2 + 1, ys.h / 2 + 5) : 0;
      const k = THREE.MathUtils.smoothstep(out, 0, 6) * (1 - trail);
      p.setX(i, x); p.setZ(i, z);
      p.setY(i, GROUND_Y - 0.01 + k * (1.2 + dune + out * 0.18));
      const ripple = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 1.5) * Math.sin(z * 0.23 + x * 0.05);
      tmp.copy(c1).lerp(c2, 0.25 * ripple + k * 0.25);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const ground = mesh(g, m, 0, 0, 0, false);
    this.scene.add(ground);
    return ground;
  }

  private buildGrid() {
    const { width: W, height: H } = this.game.level;
    const pts: number[] = [];
    for (let x = 0; x <= W; x++) pts.push(x, 0.015, 0, x, 0.015, H);
    for (let z = 0; z <= H; z++) pts.push(0, 0.015, z, W, 0.015, z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x7d796f, transparent: true, opacity: 0.16 }));
    this.scene.add(grid);
  }

  private buildDust(): THREE.Points {
    const n = 900, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (rnd() - 0.5) * 60; arr[i * 3 + 1] = rnd() * 8; arr[i * 3 + 2] = (rnd() - 0.5) * 50; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8e3d8, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.viewSize = Math.max(9, Math.min(13, 11 * (900 / Math.max(h, 500)) ** 0.2));
    const a = w / h;
    // keep the 20 m reach ring on screen on narrow phones
    const vs = (a < 1 ? this.viewSize / a * 0.95 : this.viewSize) * this.zoom;
    Object.assign(this.camera, { left: -vs * a, right: vs * a, top: vs, bottom: -vs });
    this.camera.updateProjectionMatrix();
  }

  setOverlay(on: boolean) { this.overlay = on; }

  /** Multiply the visible area (wheel / + -). 0.45 = close-up, 2.2 = wide. */
  zoomBy(f: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.45, 2.2);
    this.resize();
  }

  /** Cursor ray onto the ground plane, in sim coordinates. */
  pick(ndcX: number, ndcY: number): V2 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const t = -this.raycaster.ray.origin.y / this.raycaster.ray.direction.y;
    if (!isFinite(t) || t < 0) return null;
    const p = this.raycaster.ray.at(t, new THREE.Vector3());
    return { x: p.x, y: p.z };
  }

  /** Screen position (px) of a world point, for HUD tips. */
  project(p: V2, y = 0): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, y, p.y).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  frame(dt: number, aim: V2 | null) {
    const g = this.game;
    const t = g.time;

    // removed scrap piles
    for (const o of g.removed) { const m = this.obstacleMeshes.get(o); if (m) { this.scene.remove(m); this.obstacleMeshes.delete(o); } }
    g.removed.length = 0;
    // shake the pile being salvaged
    for (const [o, m] of this.obstacleMeshes) {
      if (!o.loot) continue;
      const shaking = g.salvage?.target === o;
      m.position.x = o.x + o.w / 2 + (shaking ? Math.sin(t * 60) * 0.04 : 0);
      m.position.y = shaking ? Math.abs(Math.sin(t * 37)) * 0.03 : 0;
    }

    // yacht leaving
    const y = this.yacht;
    if (!this.departStart) this.departStart = y.group.position.clone();
    const dx = g.phase === 'play' ? 0 : -0.5 * 1.3 * g.departT * g.departT;
    y.group.position.x = this.departStart.x + dx;
    for (const wh of y.wheels) wh.rotation.y = dx / 0.85;
    this.wolt.group.visible = g.phase === 'play';

    // camera follows Wolt softly (the yacht when leaving)
    const want = g.phase === 'play' ? new THREE.Vector3(g.pos.x, 0, g.pos.y) : new THREE.Vector3(y.group.position.x + 4, 0, y.group.position.z);
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 4));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.sun.position.copy(this.camTarget).add(new THREE.Vector3(-22, 40, 14));
    this.sun.target.position.copy(this.camTarget);

    // Wolt
    const w = this.wolt;
    w.group.position.set(g.pos.x, 0, g.pos.y);
    const targetRot = Math.PI / 2 - g.facing;
    let dr = targetRot - w.group.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    w.group.rotation.y += dr * Math.min(1, dt * 12);
    if (g.moving) this.walkPhase += dt * 11;
    const bob = g.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
    w.group.position.y = bob;
    w.legs[0].position.y = 0.21 + (g.moving ? Math.max(0, Math.sin(this.walkPhase)) * 0.08 : 0);
    w.legs[1].position.y = 0.21 + (g.moving ? Math.max(0, -Math.sin(this.walkPhase)) * 0.08 : 0);
    w.reel.rotation.z += g.moving && g.held ? dt * 8 : 0;

    // wind: sail, turbines
    const wind = g.wind;
    const str = wind.strength;
    this.yacht.sail.update(dt, t, wind.dir - this.yacht.group.rotation.y, str);
    for (const [i, r] of this.yacht.turbines.entries()) r.rotation.z += dt * (0.3 + str * 0.45 + i * 0.2);

    // yacht battery, port, fabricator
    const pct = g.batteryPct();
    const charging = g.yachtCharging();
    (y.battery.material as THREE.MeshStandardMaterial).emissiveIntensity = pct * 1.1 + (charging ? 0.25 + Math.sin(t * 5) * 0.25 : 0);
    (y.port.material as THREE.MeshStandardMaterial).emissive.set(g.batteryFull() ? PAL.ok : charging ? PAL.flow : PAL.warn);
    (y.fabLight.material as THREE.MeshStandardMaterial).emissiveIntensity = g.craftT > 0 ? 1.5 + Math.sin(t * 20) : 0.3;

    // station: the old solar station is alive, relay green, lamps on
    const boot = 1;
    const st = this.station;
    const col = new THREE.Color(PAL.off).lerp(new THREE.Color(PAL.ok), boot);
    const relayMat = st.relay.material as THREE.MeshStandardMaterial;
    relayMat.emissive.copy(col);
    relayMat.emissiveIntensity = 2.2 + Math.sin(t * 1.5) * 0.3;
    st.relayLight.color.copy(col);
    st.relayLight.intensity = 2 + boot * 3;
    st.lamps.forEach((l, i) => {
      const on = THREE.MathUtils.clamp(boot * 3 - i, 0, 1);
      const flicker = on > 0 && on < 1 ? (Math.sin(t * 40 + i) > 0 ? 1 : 0.3) : 1;
      (l.bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = on * 3 * flicker;
      l.light.intensity = on * 7 * flicker;
    });
    st.windows.forEach(wm => ((wm.material as THREE.MeshStandardMaterial).emissiveIntensity = boot * 1.6));
    (st.port.material as THREE.MeshStandardMaterial).emissive.set(g.portBusy('station') ? PAL.ok : PAL.warn);

    this.updateCables(t);
    this.updateRings(t);

    // cursor tile
    if (aim) {
      this.cursor.visible = true;
      this.cursor.position.set(Math.floor(aim.x) + 0.5, 0.03, Math.floor(aim.y) + 0.5);
    } else this.cursor.visible = false;

    // drifting ash
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) {
      const sp = (0.3 + str * 0.25) * (0.8 + (i % 7) * 0.06);
      let x = dp.getX(i) + Math.cos(wind.dir) * sp * dt, y = dp.getY(i) - dt * 0.12, z = dp.getZ(i) + Math.sin(wind.dir) * sp * dt + Math.sin(t + i) * dt * 0.1;
      if (x > 30) x -= 60; if (x < -30) x += 60; if (z > 25) z -= 50; if (z < -25) z += 50; if (y < 0) y += 8;
      dp.setXYZ(i, x, y, z);
    }
    dp.needsUpdate = true;
    this.dust.position.set(this.camTarget.x, 0, this.camTarget.z);

    this.renderer.render(this.scene, this.camera);
  }

  private cablePath(c: { cable: { points(): V2[] }; from: string; to: string | null }, held: boolean): THREE.Vector3[] {
    const g = this.game;
    const pts = c.cable.points();
    const from = g.ports.find(p => p.id === c.from)!;
    const out: THREE.Vector3[] = [];
    const ground = (p: V2) => new THREE.Vector3(p.x, CABLE_Y, p.y);
    out.push(new THREE.Vector3(pts[0].x, from.height, pts[0].y));
    // drop from the socket to the ground over ~0.5 m
    const second = pts[1];
    const dir = new THREE.Vector3(second.x - pts[0].x, 0, second.y - pts[0].y);
    const dl = dir.length();
    if (dl > 0.6) out.push(ground({ x: pts[0].x + dir.x / dl * 0.5, y: pts[0].y + dir.z / dl * 0.5 }));
    for (let i = 1; i < pts.length - 1; i++) out.push(ground(pts[i]));
    const end = pts[pts.length - 1];
    if (held) {
      const prev = pts[pts.length - 2];
      const d = new THREE.Vector3(end.x - prev.x, 0, end.y - prev.y); const l = d.length();
      if (l > 0.7) out.push(ground({ x: end.x - d.x / l * 0.45, y: end.y - d.z / l * 0.45 }));
      out.push(new THREE.Vector3(end.x, 0.62, end.y));
    } else {
      const to = g.ports.find(p => p.id === c.to)!;
      const prev = pts[pts.length - 2];
      const d = new THREE.Vector3(end.x - prev.x, 0, end.y - prev.y); const l = d.length();
      if (l > 0.6) out.push(ground({ x: end.x - d.x / l * 0.5, y: end.y - d.z / l * 0.5 }));
      out.push(new THREE.Vector3(end.x, to.height, end.y));
    }
    return out;
  }

  private updateCables(t: number) {
    const g = this.game;
    const all = [...g.cables, ...(g.held ? [g.held] : [])];
    const alive = new Set<object>(all);
    for (const [k, v] of this.cableMeshes) if (!alive.has(k)) { this.scene.remove(v.mesh); v.mesh.geometry.dispose(); this.cableMeshes.delete(k); }

    let pulseN = 0;
    const m4 = new THREE.Matrix4();
    for (const c of all) {
      const held = c === g.held;
      const path = this.cablePath(c, held);
      const key = path.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join('|');
      let e = this.cableMeshes.get(c);
      if (!e || e.key !== key) {
        const cp = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < path.length; i++) cp.add(new THREE.LineCurve3(path[i - 1], path[i]));
        const segs = Math.max(8, Math.round(cp.getLength() * 3));
        const geo = new THREE.TubeGeometry(cp, segs, 0.045, 6, false);
        if (!e) {
          const m = mesh(geo, new THREE.MeshStandardMaterial({ color: PAL.copper, roughness: 0.45, metalness: 0.6 }), 0, 0, 0, true);
          this.scene.add(m);
          e = { mesh: m, key };
          this.cableMeshes.set(c, e);
        } else { e.mesh.geometry.dispose(); e.mesh.geometry = geo; e.key = key; }
      }
      const m = e.mesh.material as THREE.MeshStandardMaterial;
      if (held) {
        const l = c.cable.length();
        const st = g.cableState();
        if (st === 'limit') { m.emissive.set(PAL.limit); m.emissiveIntensity = 0.7 + Math.sin(t * 12) * 0.3; }
        else if (l >= CABLE_WARN) { m.emissive.set(PAL.warn); m.emissiveIntensity = 0.6; }
        else { m.emissive.set(0x000000); m.emissiveIntensity = 0; }
      } else {
        const powered = g.yachtCharging();
        m.emissive.set(this.overlay ? PAL.flow : 0x000000);
        m.emissiveIntensity = this.overlay ? 0.8 : 0;
        if (powered) {
          // energy pulses travelling from the yacht to the station
          const cp = new THREE.CurvePath<THREE.Vector3>();
          for (let i = 1; i < path.length; i++) cp.add(new THREE.LineCurve3(path[i - 1], path[i]));
          const L = cp.getLength();
          const n = Math.min(40, Math.floor(L / 1.2));
          for (let i = 0; i < n && pulseN < 64; i++) {
            const u0 = ((i / n) + t * 0.12) % 1;
            const u = c.from === 'station' ? u0 : 1 - u0; // energy flows from the station
            const p = cp.getPointAt(u);
            m4.makeTranslation(p.x, p.y + 0.04, p.z);
            this.pulses.setMatrixAt(pulseN++, m4);
          }
        }
      }
    }
    this.pulses.count = pulseN;
    this.pulses.instanceMatrix.needsUpdate = true;
  }

  private updateRings(t: number) {
    const g = this.game;
    if (!g.held) { this.ring.visible = false; this.portRing.visible = false; return; }
    const c = g.held.cable;
    const r = Math.max(0.1, g.segmentMax() - c.baseLength());
    this.ring.visible = true;
    this.ring.scale.setScalar(r);
    this.ring.position.set(c.last.x, 0.04, c.last.y);
    const st = g.cableState();
    (this.ring.material as THREE.MeshBasicMaterial).color.set(st === 'limit' ? PAL.limit : PAL.warn);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = st === 'held' ? 0.35 : 0.7;

    // highlight a free target port that the cable can reach
    this.portRing.visible = false;
    for (const p of g.ports) {
      if (p.id === g.held.from || g.portBusy(p.id)) continue;
      const need = c.baseLength() + Math.hypot(p.pos.x - c.last.x, p.pos.y - c.last.y);
      const reach = need <= g.segmentMax();
      this.portRing.visible = true;
      this.portRing.position.set(p.pos.x, 0.05, p.pos.y);
      this.portRing.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
      (this.portRing.material as THREE.MeshBasicMaterial).color.set(reach ? PAL.ok : PAL.limit);
    }
  }
}

export { mat };
