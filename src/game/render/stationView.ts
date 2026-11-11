import * as THREE from 'three';
import { cableTube } from './cableTube';
import { mat, mesh, box } from '../../render/models';
import { Models } from '../../render/assets';
import { PAL } from '../../render/palette';
import { woltMonoModel, WoltMono, WoltAnimator, ArmPose } from '../../render/wolt';
import { loadModel, LoadModel, animateDragged, ropeGeometry } from '../../render/loads';
import { GroundFx, SURFACES, Surface, pxPerMetre } from '../../render/groundFx';
import { LOADS, ROPE } from '../../sim/tow';
import { V2 } from '../../sim/vec';
import { Station, ST_W, ST_H, ROOMS, P, CABLE_MAX } from '../sim/station';
import { Post } from './post';
import { Hole, glow, groundY } from './station/kit';
import { Atmosphere, WIND, beyond } from './station/atmosphere';
import { Building } from './station/building';
import { Interiors } from './station/interiors';
import { Yard, inPuddle } from './station/yard';
import { buildBackdrop } from './station/backdrop';
import { mergeStatic, swayTime } from './station/batch';
import { Transformer, ModuleLoad, Plotter, cableDrum, workshopDoor, moduleModel } from './station/machines';

const CAM_OFFSET = new THREE.Vector3(0, 17, 16);
const VIEW = 7.5;         // m, half the height of the view
const HOLE_R = 2.7;       // m, radius of the see-through hole around Wolt
const Q_GREEN = 0x5fe39a;
const OPENING_ZOOM = 0.22; // the scene opens a little wider and settles on Wolt
const LEAVE_ZOOM = 0.3;    // the last shot pulls back as he rolls out of the gate
const BOG_SINK = 0.14;     // m the wheel digs in at the deepest point of the loose ash
const CAM_EDGE = 6;        // m from the map's side edges where the camera stops following
const ss = THREE.MathUtils.smoothstep;

/**
 * Scene 2 in 3D: Stacja Pomiarowa „Olszanka” in pale overcast light, ash on the ground,
 * mist over the valley, spruce woods melting into the fog. Reads Station every frame and
 * changes nothing in it. The set is built by the modules in ./station (building, interiors,
 * yard, machines, backdrop, atmosphere); this class owns the renderer, the camera, Wolt,
 * the tyre and the cables.
 */
export class StationView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  readonly post: Post;
  private wolt: WoltMono;
  private anim: WoltAnimator;
  private tyre: LoadModel;
  private moduleOnTyre: THREE.Object3D;
  private building: Building;
  private interiors: Interiors;
  private yard: Yard;
  private trafo: Transformer;
  private load: ModuleLoad;
  private plotter: Plotter;
  private air = new Atmosphere();
  private door: THREE.Group;
  private drum: THREE.Group;
  private portLamp!: THREE.MeshStandardMaterial;
  private socketLamp!: THREE.MeshStandardMaterial;
  private teaser!: THREE.PointLight;
  private teaserGlow!: THREE.Sprite;
  private rope: THREE.Mesh | null = null;
  private ownCable: THREE.Mesh | null = null;
  private cableMesh: THREE.Mesh | null = null;
  private cableKey = '';
  private camTarget = new THREE.Vector3();
  private zoom = 1;
  private sink = 0;
  private prevPos: THREE.Vector3 | null = null;
  private prevYaw = 0; private spd = 0; private acc = 0; private yawRate = 0;
  private gesture: { pose: ArmPose; t: number } | null = null;
  private prevTowing = false;
  private ground: GroundFx;
  /** Shared by the building's materials: fragments in front of Wolt inside this circle are dropped. */
  private hole: Hole = { uHole: { value: new THREE.Vector2() }, uHoleR: { value: 0 }, uHoleZ: { value: 1 } };
  private holeOpen = 0;

  constructor(private st: Station, container: HTMLElement, models: Models) {
    const r = new THREE.WebGLRenderer({ antialias: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.post = new Post(r);
    this.post.uniforms.uGrey.value = 0;
    this.post.uniforms.uSat.value = 0.6;
    this.post.uniforms.uVignette.value = 0.5;
    this.post.uniforms.uLift.value = 0.045;

    const s = this.scene;
    s.background = new THREE.Color(PAL.sky);
    // the far (north) side of the view sinks into the haze a little more than the near one
    s.fog = new THREE.Fog(PAL.fog, 25, 58);
    s.add(new THREE.HemisphereLight(0xe6e2d8, 0x625d55, 1.25));
    // a low, pale sun behind the overcast in the south-west: long soft shadows across the yard
    const sun = new THREE.DirectionalLight(0xf2ead8, 1.35);
    sun.position.set(ST_W / 2 - 26, 22, ST_H / 2 + 9); sun.target.position.set(ST_W / 2, 0, ST_H / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 30, bottom: -30, near: 1, far: 100 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    s.add(sun); s.add(sun.target);
    // sky light from the open valley side, so the front of the station is not a black wall
    const fill = new THREE.DirectionalLight(0xdfe3e6, 0.55);
    fill.position.set(ST_W / 2 + 6, 9, ST_H / 2 + 24); fill.target.position.set(ST_W / 2, 0, ST_H / 2);
    s.add(fill); s.add(fill.target);

    this.buildGround();
    this.building = new Building(s, st, models, this.hole);
    this.interiors = new Interiors(s, st, models);
    this.yard = new Yard(s, st, models);
    buildBackdrop(s, models);
    this.door = workshopDoor(s);
    this.drum = cableDrum(s);
    this.trafo = new Transformer(s, st);
    this.load = new ModuleLoad(s, st);
    this.plotter = new Plotter(s, st);
    this.buildPorts();
    s.add(this.air.group);

    // everything built so far stands still: bake it into a few big meshes
    mergeStatic(s);

    this.tyre = loadModel('tyre'); s.add(this.tyre.group);
    this.moduleOnTyre = moduleModel(); this.moduleOnTyre.position.y = 0.22;
    this.tyre.body.add(this.moduleOnTyre);

    this.wolt = woltMonoModel();
    const cm = (this.wolt.cell.material as THREE.MeshStandardMaterial).clone();
    cm.emissive.setHex(Q_GREEN); cm.color.setHex(0x0c140f); this.wolt.cell.material = cm;
    this.anim = new WoltAnimator(this.wolt);
    s.add(this.wolt.group);

    // ash in the yard, dusty concrete under the roof and on the apron, puddles that wet the wheel
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    const yard: Surface = { ...SURFACES.ash, y: -0.01 }, slab: Surface = { ...SURFACES.dustyConcrete, y: 0.03 }, water: Surface = { ...SURFACES.water, y: 0.012 };
    this.ground = new GroundFx((x, z) => x >= x0 - 0.5 && x <= x1 + 0.4 && z >= 3 && z <= 14.68 ? slab : inPuddle(x, z) ? water : yard);
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

  /** Screen px → ground point (the floor plane), for mouse clicks. */
  pick(x: number, y: number): V2 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const d = ray.ray.direction.y;
    if (Math.abs(d) < 1e-6) return null;
    const p = ray.ray.at(-ray.ray.origin.y / d, new THREE.Vector3());
    return { x: p.x, y: p.z };
  }

  // ---------- building

  private buildGround() {
    const g = new THREE.PlaneGeometry(ST_W + 80, ST_H + 70, 150, 120); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols: number[] = [];
    const c1 = new THREE.Color(PAL.ground), c2 = new THREE.Color(PAL.groundDark), grass = new THREE.Color(0x8d8f7c), haze = new THREE.Color(PAL.fog), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + ST_W / 2, z = p.getZ(i) + ST_H / 2;
      p.setX(i, x); p.setZ(i, z);
      // low hills round the station, the valley falling away to the south towards the reservoir
      p.setY(i, groundY(x, z) - 0.01);
      const out = beyond(x, z);
      // ash lies in long drifts across the wind
      const ripple = 0.5 + 0.5 * Math.sin((x * WIND.z - z * WIND.x) * 0.55 + Math.sin(x * 0.21 + z * 0.13) * 2.2) * Math.sin(z * 0.27 + x * 0.11);
      // dry grass shows through the ash away from the buildings
      const g2 = ss(z, 15, 27) * 0.35 + ss(out, 0, 8) * 0.3;
      tmp.copy(c1).lerp(c2, 0.28 * ripple).lerp(grass, g2 * (0.5 + 0.5 * ripple)).lerp(haze, ss(out, 5, 20) * 0.75);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    this.scene.add(mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, 0, 0, false));
    // the concrete floor slab inside the building
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    this.scene.add(mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 10), mat(0x8a877f, { r: 0.95 }), (x0 + x1) / 2, 0.0, 8, false));
  }

  /** Ports, status lamps and the note on the facade; the glow behind the machine room window. */
  private buildPorts() {
    const s = this.scene;
    // the lock port on the left of the workshop door, with its dead lamp
    s.add(Building.plate(P.port.x, 0.9));
    const port = Building.statusLamp(P.port.x, 1.05); this.portLamp = port.m; s.add(port.o);
    // the machine room inlet on its yard wall
    s.add(Building.plate(P.socket.x, 0.9, 0.36, 0.46));
    s.add(box(0.2, 0.2, 0.05, mat(0x55595c, { r: 0.5, m: 0.6 }), P.socket.x, 0.86, 13.1));
    const socket = Building.statusLamp(P.socket.x, 1.07); this.socketLamp = socket.m; s.add(socket.o);
    // the technician's note, pinned by the door
    const paper = new THREE.MeshStandardMaterial({ color: 0xe0dccf, roughness: 0.9, emissive: 0xe0dccf, emissiveIntensity: 0.08 });
    const note = mesh(new THREE.PlaneGeometry(0.3, 0.4), paper, P.doorNote.x, 1.3, 13.04, false); note.rotation.z = -0.05; s.add(note);
    // the machine room teaser: something glows green behind the fallen cabinet
    this.teaser = new THREE.PointLight(Q_GREEN, 2, 6, 1.5); this.teaser.position.set(33.5, 1.2, 7); s.add(this.teaser);
    this.teaserGlow = glow(Q_GREEN, 3.2); this.teaserGlow.position.set(33, 1.2, 12.2); s.add(this.teaserGlow);
  }

  /** Cable from the drum: lies on the ground between bends, rises to Wolt's hand or to the inlet. */
  private updateCable() {
    const st = this.st;
    if (!st.cable) return;
    const pts = st.cable.points();
    let endY = 0.04;
    if (st.cableHeld) {
      const ex = this.wolt.cableExit.getWorldPosition(new THREE.Vector3());
      pts[pts.length - 1] = { x: ex.x, y: ex.z }; endY = ex.y;
    } else if (st.machinePowered) { pts[pts.length - 1] = { x: P.socket.x, y: 13.1 }; endY = 0.86; }
    const key = pts.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(';') + endY.toFixed(2);
    if (key !== this.cableKey) {
      this.cableKey = key;
      const v: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i++) {
        const y = i === 0 ? 0.42 : i === pts.length - 1 ? endY : 0.04;
        v.push(new THREE.Vector3(pts[i].x, y, pts[i].y));
        if (i < pts.length - 1) {
          const a = pts[i], b = pts[i + 1];
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.12, 0.03, a.y + (b.y - a.y) * 0.12));
          v.push(new THREE.Vector3(a.x + (b.x - a.x) * 0.88, 0.03, a.y + (b.y - a.y) * 0.88));
        }
      }
      const geo = cableTube(v, 0.035);
      if (!this.cableMesh) {
        this.cableMesh = mesh(geo, new THREE.MeshStandardMaterial({ color: 0x161818, roughness: 0.7, emissive: PAL.flow, emissiveIntensity: 0 }), 0, 0, 0, true);
        this.scene.add(this.cableMesh);
      } else { this.cableMesh.geometry.dispose(); this.cableMesh.geometry = geo; }
    }
    const m = this.cableMesh!.material as THREE.MeshStandardMaterial;
    const strain = Math.max(0, (st.cableLength() - (CABLE_MAX - 3)) / 3);
    m.emissive.setHex(st.machinePowered ? PAL.flow : PAL.warn);
    m.emissiveIntensity = st.machinePowered ? 0.5 + Math.sin(st.t * 6) * 0.15 : st.cableHeld ? strain * 0.8 : 0;
  }

  // ---------- per frame

  /** Round see-through hole in walls and roof around Wolt while he is inside the building. */
  private updateHole(dt: number) {
    const st = this.st;
    const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
    const inside = st.pos.x > x0 - 0.3 && st.pos.x < x1 + 0.3 && st.pos.y > 2.7 && st.pos.y < 13.4;
    this.holeOpen += ((inside ? 1 : 0) - this.holeOpen) * Math.min(1, dt * 6);
    const v = new THREE.Vector3(st.pos.x, 0.7, st.pos.y).project(this.camera);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const ppm = size.y / (this.camera.top - this.camera.bottom);
    this.hole.uHole.value.set((v.x + 1) / 2 * size.x, (v.y + 1) / 2 * size.y);
    this.hole.uHoleZ.value = (v.z + 1) / 2 - 0.002;
    this.hole.uHoleR.value = this.holeOpen < 0.02 ? 0 : HOLE_R * ppm * this.holeOpen;
  }

  frame(dt: number) {
    const st = this.st, w = this.wolt, t = st.t;

    this.door.position.x = 12 + ss(st.doorOpen, 0, 1) * 1.9;
    this.portLamp.emissive.setHex(st.doorOpen > 0 ? PAL.ok : PAL.off);
    this.portLamp.emissiveIntensity = st.plugged > 0 ? 2 : st.doorOpen > 0 ? 0.8 : 0.15 + (Math.sin(t * 3) > 0.9 ? 0.4 : 0);
    this.teaser.intensity = 1.6 + Math.sin(t * 1.3) * 0.8;
    this.teaserGlow.material.opacity = 0.1 + Math.sin(t * 1.3) * 0.05;

    // Wolt: the sim turns him at a wheel's pace, so the body follows it exactly
    // in the loose ash off the firm ground the wheel digs itself in
    this.sink += (st.bog * BOG_SINK - this.sink) * Math.min(1, dt * 5);
    w.group.position.set(st.pos.x, -this.sink, st.pos.y);
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
    if (st.plugged > 0) this.gesture = { pose: 'reach', t: 0.2 };
    this.prevTowing = st.towing;
    if (this.gesture && (this.gesture.t -= dt) <= 0) this.gesture = null;
    const arm: ArmPose = st.repair > 0 ? 'work' : st.reading || this.load.busy ? 'reach' : this.gesture?.pose ?? 'rest';
    let tension = 0, pullFrom: THREE.Vector3 | null = null;
    if (st.towing && st.towTaut && this.spd > 0.1) {
      tension = LOADS.tyre.drag * (st.moduleOnTyre ? 3 : 1.6);
      pullFrom = new THREE.Vector3(st.tyre.pos.x - st.pos.x, 0, st.tyre.pos.y - st.pos.y).normalize();
    }
    const cableTo = st.plugged > 0 ? new THREE.Vector3(P.port.x, 0, 13.1) : null;
    this.anim.update({
      dt, time: t, speed: this.spd, yawRate: this.yawRate, accel: this.acc,
      strain: st.strain, cableTo, tension, pullFrom, reelSpin: st.plugged > 0 ? 6 : 0, arm,
      energy: st.battery / 100, lamp: 0.6,
      lookAt: (() => { const h = st.hint(); return h ? new THREE.Vector3(h.at.x, 0, h.at.y) : null; })(),
    });
    (w.cell.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.15;

    this.ground.wheel({ x: p.x, z: p.z, yaw: yw, speed: this.spd, accel: this.acc, yawRate: this.yawRate, slip: this.anim.slip }, dt);

    // the tyre and its rope
    this.tyre.group.position.set(st.tyre.pos.x, 0, st.tyre.pos.y);
    let tr = (Math.PI / 2 - st.tyre.angle) - this.tyre.group.rotation.y; tr = Math.atan2(Math.sin(tr), Math.cos(tr));
    this.tyre.group.rotation.y += tr * Math.min(1, dt * 5);
    const dragged = st.towing && st.towTaut && this.spd > 0.15;
    animateDragged(this.tyre, st.tyre, dragged, t, dt);
    this.ground.drag(st.tyre, { x: st.tyre.pos.x, z: st.tyre.pos.y, yaw: this.tyre.group.rotation.y, width: LOADS.tyre.radius * 1.85, dragging: this.tyre.drag > 0.4, speed: this.spd }, dt);
    if (this.rope) { this.scene.remove(this.rope); this.rope.geometry.dispose(); this.rope = null; }
    if (st.towing) {
      this.tyre.group.updateMatrixWorld(true);
      const a = w.hitch.getWorldPosition(new THREE.Vector3());
      const b = this.tyre.eye.getWorldPosition(new THREE.Vector3());
      this.rope = mesh(ropeGeometry(a, b, ROPE), mat(0x6b6355, { r: 0.9 }), 0, 0, 0, true);
      this.scene.add(this.rope);
    }
    this.ground.setWind(WIND.x * 0.3, WIND.z * 0.3);
    this.ground.setScale(pxPerMetre(this.renderer, this.camera));
    this.ground.update(dt);
    // Wolt's own short cable into the port while it feeds the lock
    if (this.ownCable) { this.scene.remove(this.ownCable); this.ownCable.geometry.dispose(); this.ownCable = null; }
    if (st.plugged > 0) {
      const a = w.cableExit.getWorldPosition(new THREE.Vector3()), b = new THREE.Vector3(P.port.x, 0.9, 13.1);
      const mid = a.clone().lerp(b, 0.5); mid.y = 0.1;
      this.ownCable = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.02, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: PAL.flow, emissiveIntensity: 0.6 }), 0, 0, 0, false);
      this.scene.add(this.ownCable);
    }

    // the module: on the shelf, in the arm's care, on the tyre, in the cabinet
    const tyreAt = new THREE.Vector3(st.tyre.pos.x, 0.24, st.tyre.pos.y);
    this.load.update(dt, tyreAt);
    this.trafo.update(dt, t, tyreAt);
    this.moduleOnTyre.visible = st.moduleOnTyre && this.load.landed && !this.trafo.carrying;
    this.plotter.update(dt, t);
    this.building.update(dt, t);
    this.interiors.update(t);
    this.yard.update(dt, t);
    swayTime.value = t;

    // the cable and the machine room waking up
    this.updateCable();
    this.drum.rotation.x = st.cable ? -st.cableLength() * 1.8 : 0;
    this.socketLamp.emissive.setHex(st.machinePowered ? PAL.ok : PAL.off);
    this.socketLamp.emissiveIntensity = st.machinePowered ? 2 : 0.15 + (st.turbine && Math.sin(t * 3) > 0.9 ? 0.5 : 0);

    // camera follows Wolt, kept a little inside the map; wider at the opening and for the last shot
    const leave = ss(st.leaving, 0, 4.5);
    const zoom = 1 + OPENING_ZOOM * Math.exp(-t / 2.2) + LEAVE_ZOOM * leave;
    if (Math.abs(zoom - this.zoom) > 1e-4) { this.zoom = zoom; this.frustum(); }
    const want = new THREE.Vector3(THREE.MathUtils.clamp(st.pos.x, CAM_EDGE, ST_W - CAM_EDGE), 0, THREE.MathUtils.clamp(st.pos.y, 7, ST_H - 5 + leave * 3));
    if (this.camTarget.lengthSq() === 0) this.camTarget.copy(want);
    this.camTarget.lerp(want, 1 - Math.exp(-dt * 2.5));
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
    this.air.update(dt, t, this.camTarget);
    this.updateHole(dt);
    this.post.render(this.scene, this.camera);
  }
}
