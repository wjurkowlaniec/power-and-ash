import * as THREE from 'three';
import { tr } from '../i18n';
import { PAL } from '../render/palette';
import { Models } from '../render/assets';
import { mat, yachtModel, stationModel } from '../render/models';
import { woltMonoModel, WoltAnimator, ArmPose } from '../render/wolt';
import { loadModel, animateDragged } from '../render/loads';
import { LoadKind, LOADS } from '../sim/tow';
import { YachtView } from '../sail/render/yachtRig';
import { newYacht, YACHT, Gear } from '../sail/sim/landYacht';
import { mastRig, runnerRig, iceYachtWreck, fallenBalloon } from '../craft/render/yachtModels';
import { buildingModel, itemModel, moduleModel, moduleOnWolt, scrapModel } from '../craft/render/craftModels';
import { ITEMS, BUILD, SCRAP, ItemId, ModuleId, BuildKind, ScrapKind } from '../craft/data';
import { Station, REPAIR_TIME } from '../game/sim/station';
import { Transformer, Plotter, cableDrum, workshopDoor, moduleModel as trafoModule } from '../game/render/station/machines';
import { windSock, anemometer, cupSpeed } from '../game/render/station/life';
import { Params, ParamValue } from './state';

/**
 * Everything the viewer can show. Each entry builds a fresh copy of a model from the same
 * code the game and the demos use (nothing is re-modelled here) and, where the model moves,
 * drives its animation from a few parameters instead of from the simulation.
 */

export type Param =
  | { key: string; label: string; kind: 'range'; min: number; max: number; step: number; value: number; unit?: string }
  | { key: string; label: string; kind: 'select'; options: [string, string][]; value: string; apply?: (v: string, p: Params) => void }
  | { key: string; label: string; kind: 'check'; value: boolean }
  | { key: string; label: string; kind: 'button'; run: (p: Params) => void };

export interface Exhibit {
  object: THREE.Object3D;
  params?: Param[];
  /** dt and t are scene time (paused: dt = 0). The params object may be written to (buttons, docking). */
  update?(dt: number, t: number, p: Params): void;
  /** Animation clips baked into a GLB (played by the viewer's mixer). */
  clips?: THREE.AnimationClip[];
}

export interface Ctx {
  /** Shared Quaternius/KayKit set plus the workshop set, faded as in the demos. */
  models: Models;
  /** Scene 2's own set, faded as in the game. */
  station: Models;
}

export interface Entry {
  id: string;
  group: string;
  name: string;
  /** Where it comes from in the code (shown in the info box). */
  src: string;
  /** Has its own animation driven by parameters. */
  animated?: boolean;
  build(ctx: Ctx): Exhibit | Promise<Exhibit>;
}

const deg = (d: ParamValue) => (Number(d) * Math.PI) / 180;
const n = (v: ParamValue) => Number(v);
const range = (key: string, label: string, min: number, max: number, step: number, value: number, unit?: string): Param =>
  ({ key, label, kind: 'range', min, max, step, value, unit });
const check = (key: string, label: string, value = false): Param => ({ key, label, kind: 'check', value });

export const GROUPS: Record<string, string> = {
  wolt: tr('Wolt', 'Wolt'),
  yacht: tr('Żaglowóz', 'Land yacht'),
  loads: tr('Ładunki do holowania', 'Tow loads'),
  station: tr('Scena 2: Martwa stacja', 'Scene 2: Dead station'),
  demo: tr('Tech demo „Rozruch”', 'Tech demo “Jump Start”'),
  build: tr('Warsztat: budynki', 'Workshop: buildings'),
  item: tr('Warsztat: przedmioty', 'Workshop: items'),
  module: tr('Warsztat: moduły Wolta', 'Workshop: Wolt modules'),
  scrap: tr('Warsztat: złom', 'Workshop: scrap'),
};

// ---------------------------------------------------------------- Wolt

const ARM: [ArmPose, string][] = [
  ['rest', tr('złożone', 'folded')], ['work', tr('praca (rozbiórka)', 'work (salvage)')], ['reach', tr('sięga do gniazda', 'reach (socket)')],
  ['back', tr('do haka z tyłu', 'back (hitch)')], ['stow', tr('chowa do środka', 'stow')],
];
const MODULES = (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'module') as ModuleId[];

/** Named combinations of the parameters, for a quick look at each kind of motion. */
const WOLT_PRESETS: Record<string, Params> = {
  rest: { speed: 0, turn: 0, strain: false, arm: 'rest', reel: 0, cable: false, tension: 0, energy: 1, lamp: 1, look: false },
  drive: { speed: 3, turn: 0, strain: false, arm: 'rest', reel: 0, cable: false, tension: 0, energy: 1, lamp: 1, look: false },
  turn: { speed: 3, turn: 1.2, strain: false, arm: 'rest', reel: 0, cable: false, tension: 0, energy: 1, lamp: 1, look: false },
  cable: { speed: 1.5, turn: 0, strain: false, arm: 'rest', reel: 4, cable: true, cableDir: 20, tension: 0.4, energy: 1, lamp: 1, look: false },
  strain: { speed: 2, turn: 0, strain: true, arm: 'rest', reel: 0, cable: true, cableDir: 0, tension: 1, energy: 0.8, lamp: 1, look: false },
  salvage: { speed: 0, turn: 0, strain: false, arm: 'work', reel: 0, cable: false, tension: 0, energy: 1, lamp: 1, look: false },
  plug: { speed: 0, turn: 0, strain: false, arm: 'reach', reel: -3, cable: true, cableDir: 0, tension: 0.1, energy: 1, lamp: 1, look: false },
  look: { speed: 0, turn: 0, strain: false, arm: 'rest', reel: 0, cable: false, tension: 0, energy: 1, lamp: 1, look: true, lookDir: 50 },
  low: { speed: 0.6, turn: 0, strain: false, arm: 'rest', reel: 0, cable: false, tension: 0, energy: 0.06, lamp: 1, look: false },
};

function woltExhibit(): Exhibit {
  const m = woltMonoModel();
  const anim = new WoltAnimator(m);
  const root = new THREE.Group(); root.add(m.group);
  // the held cable: a straight copper line to a peg 3 m away
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xb07a50 }));
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(PAL.copper));
  root.add(line, peg);
  const parts = new Map<ModuleId, THREE.Object3D>();
  const to = new THREE.Vector3(), from = new THREE.Vector3(), exit = new THREE.Vector3(), look = new THREE.Vector3();
  let v = 0;
  return {
    object: root,
    params: [
      {
        key: 'preset', label: tr('Ruch', 'Motion'), kind: 'select', value: 'rest',
        options: [['rest', tr('spoczynek', 'idle')], ['drive', tr('jazda', 'driving')], ['turn', tr('zakręt', 'turning')], ['cable', tr('rozwija kabel', 'paying out cable')],
          ['strain', tr('buksuje na kablu', 'wheel spin, held by cable')], ['salvage', tr('rozbiórka ramieniem', 'salvaging')], ['plug', tr('wkłada wtyk', 'plugging in')],
          ['look', tr('rozgląda się', 'looking around')], ['low', tr('prawie rozładowany', 'almost flat')]],
        apply: (k, p) => Object.assign(p, WOLT_PRESETS[k]),
      },
      range('speed', tr('Prędkość', 'Speed'), -2, 6, 0.1, 0, 'm/s'),
      range('turn', tr('Skręt', 'Turn rate'), -1.5, 1.5, 0.05, 0, 'rad/s'),
      check('strain', tr('Buksuje (coś go trzyma)', 'Wheel spin (held back)')),
      { key: 'arm', label: tr('Ramię', 'Arm'), kind: 'select', value: 'rest', options: ARM },
      range('reel', tr('Bęben kabla (+ rozwija)', 'Reel (+ pays out)'), -12, 12, 0.5, 0, 'rad/s'),
      check('cable', tr('Trzyma kabel', 'Holds a cable')),
      range('cableDir', tr('Kabel idzie w stronę', 'Cable direction'), -180, 180, 5, 0, '°'),
      range('tension', tr('Naciąg kabla', 'Cable tension'), 0, 1, 0.05, 0),
      check('look', tr('Patrzy w bok (na postoju)', 'Looks aside (standing)')),
      range('lookDir', tr('Kierunek spojrzenia', 'Look direction'), -90, 90, 5, 40, '°'),
      range('energy', tr('Bateria Q-1', 'Q-1 charge'), 0, 1, 0.01, 1),
      range('lamp', tr('Lampa', 'Lamp'), 0, 1, 0.05, 1),
      ...MODULES.map(id => check('mod_' + id, tr('Moduł: ', 'Module: ') + ITEMS[id].name)),
      { key: 'kick', label: tr('Szturchnij', 'Jolt'), kind: 'button', run: () => anim.kick(2.2, 1.4) },
    ],
    update(dt, t, p) {
      // the speed eases to the slider at a believable acceleration, so the lean shows
      const dv = THREE.MathUtils.clamp(n(p.speed) - v, -3 * dt, 3 * dt);
      const accel = dt > 0 ? dv / dt : 0;
      v += dv;
      m.group.rotation.y += n(p.turn) * dt;
      const yaw = m.group.rotation.y;
      // the peg sits 3 m away; 0° = straight behind him
      const a = yaw + Math.PI + deg(p.cableDir);
      const cable = !!p.cable;
      to.set(Math.sin(a) * 3, 0.15, Math.cos(a) * 3);
      peg.position.copy(to); peg.visible = line.visible = cable;
      from.set(to.x, 0, to.z).normalize();
      const la = yaw + deg(p.lookDir);
      look.set(Math.sin(la) * 3, 0, Math.cos(la) * 3);
      anim.update({
        dt, time: t, speed: v, yawRate: n(p.turn), accel, strain: !!p.strain,
        cableTo: cable ? to : null, tension: cable ? n(p.tension) : 0, pullFrom: cable ? from : null,
        reelSpin: n(p.reel), arm: p.arm as ArmPose, energy: n(p.energy), lamp: n(p.lamp), lookAt: p.look ? look : null,
      });
      if (cable) {
        m.cableExit.getWorldPosition(exit);
        root.worldToLocal(exit);
        line.geometry.setFromPoints([exit, to]);
      }
      for (const id of MODULES) {
        const want = !!p['mod_' + id], part = parts.get(id);
        if (want && !part) { const q = moduleOnWolt(id); m.body.add(q); parts.set(id, q); }
        if (!want && part) { m.body.remove(part); parts.delete(id); }
      }
    },
  };
}

// ---------------------------------------------------------------- the land yacht

function yachtExhibit(models: Models): Exhibit {
  const view = new YachtView(models);
  const y = newYacht(0, 0, Math.PI / 2); // heading +z
  return {
    object: view.root,
    params: [
      range('wind', tr('Wiatr pozorny', 'Apparent wind'), 0, 14, 0.5, 7, 'm/s'),
      range('windFrom', tr('Wiatr wieje z (+ lewa burta)', 'Wind from (+ port)'), -180, 180, 5, 70, '°'),
      range('sheet', tr('Szot (wychylenie bomu)', 'Sheet (boom out)'), 0, 1.3, 0.02, 0.6, 'rad'),
      check('autoHeel', tr('Przechył od wiatru', 'Heel from the wind'), true),
      range('heel', tr('Przechył ręcznie', 'Heel by hand'), -30, 30, 1, 0, '°'),
      range('speed', tr('Prędkość (koła)', 'Speed (wheels)'), -2, 10, 0.1, 0, 'm/s'),
      range('steer', tr('Skręt przedniego koła', 'Bow wheel steer'), -30, 30, 1, 0, '°'),
      range('ballast', tr('Balast na szynie', 'Ballast on its rail'), -1, 1, 0.05, 0),
      range('energy', tr('Bateria', 'Battery'), 0, 1, 0.01, 1),
      { key: 'gear', label: tr('Podwozie', 'Gear'), kind: 'select', value: 'wheels', options: [['wheels', tr('koła', 'wheels')], ['runners', tr('płozy', 'runners')]] },
      range('dock', tr('Dokowanie Wolta', 'Wolt docking'), 0, 1, 0.01, 1),
      { key: 'doDock', label: tr('Wolt: odczep / zadokuj', 'Wolt: undock / dock'), kind: 'button', run: () => { if (y.swap === 0) y.docking = y.docking ? -y.docking : y.dock >= 1 ? -1 : 1; } },
      { key: 'doSwap', label: tr('Zmień koła ↔ płozy', 'Swap wheels ↔ runners'), kind: 'button', run: () => { if (y.dock >= 1 && y.swap === 0) y.swap = YACHT.swapTime; } },
    ],
    update(dt, t, p) {
      // docking and the gear swap play out over time; otherwise the sliders rule
      if (y.docking) {
        y.dock = THREE.MathUtils.clamp(y.dock + y.docking * dt / YACHT.dockTime, 0, 1);
        if (y.dock <= 0 || y.dock >= 1) y.docking = 0;
        p.dock = y.dock;
      } else y.dock = n(p.dock);
      if (y.swap > 0) {
        y.swap -= dt;
        if (y.swap <= 0) { y.swap = 0; y.gear = y.gear === 'wheels' ? 'runners' : 'wheels'; p.gear = y.gear; }
      } else y.gear = p.gear as Gear;
      // the wind: +windFrom comes over the port (left) side; the boom then goes out to starboard
      const from = deg(p.windFrom);
      const side = from >= 0 ? 1 : -1;
      y.app = n(p.wind);
      y.appDir = y.heading - from + Math.PI;
      y.beta = Math.abs(from);
      y.side = side;
      y.cn = y.app > 0.3 ? 1 : 0;
      y.drive = y.app * 0.25;
      y.sheet = n(p.sheet);
      const heel = p.autoHeel ? side * Math.min(0.42, (y.app / 14) ** 2 * 0.35) : deg(p.heel);
      y.heel = heel;
      y.tip = heel / 0.35;
      y.u = n(p.speed); y.speed = Math.abs(y.u);
      y.steer = deg(p.steer);
      y.ballast = n(p.ballast);
      y.energy = n(p.energy);
      view.update(dt, t, y, () => 0);
    },
  };
}

function demoYachtExhibit(): Exhibit {
  const ym = yachtModel({ x: -6, y: -3, w: 12, h: 6 }, new THREE.Vector3(6.2, 1.6, 0));
  return {
    object: ym.group,
    params: [
      range('wind', tr('Wiatr', 'Wind'), 0, 14, 0.5, 6, 'm/s'),
      range('windDir', tr('Kierunek wiatru', 'Wind direction'), -180, 180, 5, 60, '°'),
      range('charge', tr('Naładowanie baterii', 'Battery charge'), 0, 1, 0.01, 0.4),
      check('fab', tr('Fabrykator pracuje', 'Fabricator working')),
      range('roll', tr('Toczenie kół', 'Wheel roll'), -3, 3, 0.1, 0, 'rad/s'),
    ],
    update(dt, t, p) {
      const str = n(p.wind);
      ym.sail.update(dt, t, deg(p.windDir), str);
      ym.turbines.forEach((r, i) => { r.rotation.z += dt * (0.3 + str * 0.45 + i * 0.2); });
      (ym.battery.material as THREE.MeshStandardMaterial).emissiveIntensity = n(p.charge) * 1.1;
      (ym.fabLight.material as THREE.MeshStandardMaterial).emissiveIntensity = p.fab ? 1.5 + Math.sin(t * 20) : 0.3;
      for (const w of ym.wheels) w.rotation.y += n(p.roll) * dt;
    },
  };
}

function demoStationExhibit(): Exhibit {
  const st = stationModel({ x: -3.5, y: -3.5, w: 7, h: 7 }, new THREE.Vector3(3.7, 0.7, 0));
  const col = new THREE.Color();
  return {
    object: st.group,
    params: [range('boot', tr('Rozruch (0 martwa, 1 działa)', 'Boot (0 dead, 1 alive)'), 0, 1, 0.01, 0)],
    update(_dt, t, p) {
      const boot = n(p.boot);
      col.setHex(PAL.off).lerp(new THREE.Color(PAL.ok), boot);
      const relay = st.relay.material as THREE.MeshStandardMaterial;
      relay.emissive.copy(col); relay.emissiveIntensity = 2.2 + Math.sin(t * 1.5) * 0.3;
      st.relayLight.color.copy(col); st.relayLight.intensity = 2 + boot * 3;
      st.lamps.forEach((l, i) => {
        const on = boot > 0.3 + i * 0.15 ? 1 : 0;
        (l.bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = on * 2;
        l.light.intensity = on * 6;
      });
      st.windows.forEach(w => ((w.material as THREE.MeshStandardMaterial).emissiveIntensity = boot * 1.6));
    },
  };
}

// ---------------------------------------------------------------- loads

function loadExhibit(kind: LoadKind): Exhibit {
  const m = loadModel(kind);
  const l = { id: kind, kind, pos: { x: 0, y: 0 }, angle: 0 };
  return {
    object: m.group,
    params: [check('drag', tr('Ciągnięty', 'Being dragged'))],
    update(dt, t, p) { animateDragged(m, l, !!p.drag, t, dt); },
  };
}

// ---------------------------------------------------------------- Scene 2

/**
 * The Scene 2 machines build themselves straight into a scene at their places in the yard.
 * They get a scene of their own here, shifted so the machine stands at the origin.
 */
function inYard(x: number, z: number): THREE.Scene {
  const s = new THREE.Scene();
  s.position.set(-x, 0, -z);
  return s;
}
const holder = (s: THREE.Scene) => { const g = new THREE.Group(); g.add(s); return g; };

function transformerExhibit(): Exhibit {
  const st = new Station();
  const s = inYard(20.5, 21.5);
  const trafo = new Transformer(s, st);
  const tyreAt = new THREE.Vector3(20.5 + 0.9, 0.3, 21.5 + 1.6);
  // the tyre the new module rides in on (in the game Wolt has dragged it here)
  const tyre = loadModel('tyre');
  tyre.group.position.set(tyreAt.x, 0, tyreAt.z); s.add(tyre.group);
  let swapping = false;
  return {
    object: holder(s),
    params: [
      range('repair', tr('Wymiana modułu (postęp)', 'Module swap (progress)'), 0, REPAIR_TIME, 0.05, 0, 's'),
      check('turbine', tr('Turbina naprawiona', 'Turbine repaired')),
      { key: 'play', label: tr('Odtwórz wymianę', 'Play the swap'), kind: 'button', run: p => { p.turbine = false; p.repair = 0; swapping = true; } },
    ],
    update(dt, t, p) {
      if (swapping) {
        p.repair = Math.min(REPAIR_TIME, n(p.repair) + dt);
        if (n(p.repair) >= REPAIR_TIME) { swapping = false; p.turbine = true; }
      }
      st.repair = n(p.repair); st.turbine = !!p.turbine;
      trafo.update(dt, t, tyreAt);
    },
  };
}

function plotterExhibit(): Exhibit {
  const st = new Station();
  const s = inYard(17.5, 10.5);
  const pl = new Plotter(s, st);
  return {
    object: holder(s),
    params: [
      check('power', tr('Maszynownia ma prąd', 'Machine room powered')),
      check('plotted', tr('Drukuje mapę do R-2', 'Prints the map to R-2')),
      { key: 'reset', label: tr('Od nowa', 'Reset'), kind: 'button', run: () => { Object.assign(pl, { k: 0 }); } },
    ],
    update(dt, t, p) {
      st.machinePowered = !!p.power;
      st.poweredT = st.machinePowered ? st.poweredT + dt : 0;
      st.plotted = !!p.plotted;
      pl.update(dt, t);
    },
  };
}

function doorExhibit(): Exhibit {
  const s = inYard(13, 12.5);
  const door = workshopDoor(s);
  return {
    object: holder(s),
    params: [range('open', tr('Otwarcie', 'Open'), 0, 1, 0.01, 0)],
    update(_dt, _t, p) { door.position.x = 12 + THREE.MathUtils.smoothstep(n(p.open), 0, 1) * 1.9; },
  };
}

function drumExhibit(): Exhibit {
  const s = inYard(23.6, 20.4);
  const reel = cableDrum(s);
  return {
    object: holder(s),
    params: [range('spin', tr('Obroty bębna', 'Drum spin'), -6, 6, 0.1, 0, 'rad/s')],
    update(dt, _t, p) { reel.rotation.x += n(p.spin) * dt; },
  };
}

function sockExhibit(): Exhibit {
  const sock = windSock();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), mat(0x55595c, { r: 0.5, m: 0.5 })).translateY(0.8));
  sock.group.position.y = 1.55; g.add(sock.group);
  return { object: g, update(_dt, t) { sock.update(t); } };
}

function cupsExhibit(): Exhibit {
  const cups = anemometer(mat(0x55595c, { r: 0.5, m: 0.5 }), mat(0x2a2c2e));
  const g = new THREE.Group(); cups.position.y = 0.2; g.add(cups);
  return {
    object: g,
    params: [check('stormy', tr('Silniejszy wiatr', 'Stronger wind'))],
    update(dt, t, p) { cups.rotation.y += cupSpeed(t) * (p.stormy ? 2.5 : 1) * dt; },
  };
}

// ---------------------------------------------------------------- workshop

function buildingExhibit(kind: BuildKind, models: Models): Exhibit {
  const b = buildingModel(kind, models);
  const params: Param[] = [check('on', tr('Zasilony / włączony', 'Powered / on'), true)];
  if (b.fan) params.push(range('wind', tr('Wiatr', 'Wind'), 0, 12, 0.5, 5, 'm/s'));
  if (b.drill) params.push(check('hopper', tr('Ma wsad', 'Has scrap in')));
  if (b.dish) params.push(check('listen', tr('Nasłuchuje', 'Listening')));
  return {
    object: b.group,
    params,
    update(dt, t, p) {
      const on = !!p.on;
      // the same rules as the workshop view: rotors turn with the wind, the drill bobs while fed
      if (b.fan) b.fan.rotation.z = kind === 'oldturbine' && !on ? 0.6 : b.fan.rotation.z + (on ? dt * (0.4 + n(p.wind) * 0.5) : 0);
      if (b.drill) b.drill.position.y = 1 + (on && p.hopper ? Math.sin(t * 6) * 0.15 : 0);
      if (b.dish && on && p.listen) b.dish.rotation.y = Math.sin(t * 0.3) * 1.2;
      for (const g of b.glow) (g.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1.5 : 0.15;
      if (b.light) b.light.intensity = on ? 3 : 0;
    },
  };
}

function scrapExhibit(kind: ScrapKind, models: Models): Exhibit {
  const d = SCRAP[kind];
  const root = new THREE.Group();
  let seed = -1;
  return {
    object: root,
    params: [range('seed', tr('Wariant (ziarno)', 'Variant (seed)'), 1, 20, 1, 1)],
    update(_dt, _t, p) {
      if (n(p.seed) === seed) return;
      seed = n(p.seed);
      root.clear();
      root.add(scrapModel(kind, d.w, d.h, models, seed));
    },
  };
}

// ---------------------------------------------------------------- the list

const still = (o: THREE.Object3D): Exhibit => ({ object: o });

export function proceduralEntries(): Entry[] {
  const e: Entry[] = [
    { id: 'wolt', group: 'wolt', name: tr('Wolt (monocykl, etap „Rdzeń”) z animatorem', 'Wolt (monocycle, “Core” stage) with its animator'), src: 'src/render/wolt.ts: woltMonoModel, WoltAnimator', animated: true, build: () => woltExhibit() },
    { id: 'yacht', group: 'yacht', name: tr('Żaglowóz (demo „Żegluga”, Wolt jako przednie koło)', 'Land yacht (“Sailing” demo, Wolt as the bow wheel)'), src: 'src/sail/render/yachtRig.ts: YachtView', animated: true, build: c => yachtExhibit(c.models) },
    { id: 'yacht-mast', group: 'yacht', name: tr('Maszt z proporczykiem', 'Mast with pennant'), src: 'src/craft/render/yachtModels.ts: mastRig', build: () => still(mastRig(4.4).group) },
    { id: 'yacht-runners', group: 'yacht', name: tr('Płozy (przód)', 'Runners (front)'), src: 'src/craft/render/yachtModels.ts: runnerRig', build: () => still(runnerRig(true).group) },
    { id: 'yacht-wreck', group: 'yacht', name: tr('Wrak bojerka', 'Ice yacht wreck'), src: 'src/craft/render/yachtModels.ts: iceYachtWreck', build: () => still(iceYachtWreck(3, 2)) },
    { id: 'yacht-balloon', group: 'yacht', name: tr('Balon meteo (spadnięty)', 'Fallen weather balloon'), src: 'src/craft/render/yachtModels.ts: fallenBalloon', build: () => still(fallenBalloon(2, 2, 3)) },
    { id: 'demo-yacht', group: 'demo', name: tr('Żaglowóz z „Rozruchu”', 'Land yacht from “Jump Start”'), src: 'src/render/models.ts: yachtModel', animated: true, build: () => demoYachtExhibit() },
    { id: 'demo-station', group: 'demo', name: tr('Stacja 2 z „Rozruchu”', 'Station 2 from “Jump Start”'), src: 'src/render/models.ts: stationModel', animated: true, build: () => demoStationExhibit() },
    { id: 'st-trafo', group: 'station', name: tr('Szafa transformatora (wymiana modułu)', 'Transformer cabinet (module swap)'), src: 'src/game/render/station/machines.ts: Transformer', animated: true, build: () => transformerExhibit() },
    { id: 'st-plotter', group: 'station', name: tr('Ploter w dyżurce', 'Duty room plotter'), src: 'src/game/render/station/machines.ts: Plotter', animated: true, build: () => plotterExhibit() },
    { id: 'st-door', group: 'station', name: tr('Drzwi warsztatu', 'Workshop door'), src: 'src/game/render/station/machines.ts: workshopDoor', animated: true, build: () => doorExhibit() },
    { id: 'st-drum', group: 'station', name: tr('Bęben kabla przy maszcie', 'Cable drum at the mast'), src: 'src/game/render/station/machines.ts: cableDrum', animated: true, build: () => drumExhibit() },
    { id: 'st-module', group: 'station', name: tr('Moduł transformatora', 'Transformer module'), src: 'src/game/render/station/machines.ts: moduleModel', build: () => still(trafoModule()) },
    { id: 'st-module-burnt', group: 'station', name: tr('Moduł transformatora (spalony)', 'Transformer module (burnt)'), src: 'src/game/render/station/machines.ts: moduleModel(true)', build: () => still(trafoModule(true)) },
    { id: 'st-sock', group: 'station', name: tr('Rękaw wiatrowy', 'Wind sock'), src: 'src/game/render/station/life.ts: windSock', animated: true, build: () => sockExhibit() },
    { id: 'st-cups', group: 'station', name: tr('Anemometr', 'Anemometer'), src: 'src/game/render/station/life.ts: anemometer', animated: true, build: () => cupsExhibit() },
  ];
  for (const k of Object.keys(LOADS) as LoadKind[])
    e.push({ id: 'load-' + k, group: 'loads', name: LOADS[k].name, src: `src/render/loads.ts: loadModel('${k}')`, animated: true, build: () => loadExhibit(k) });
  for (const k of Object.keys(BUILD) as BuildKind[])
    e.push({ id: 'build-' + k, group: 'build', name: BUILD[k].name, src: `src/craft/render/craftModels.ts: buildingModel('${k}')`, animated: true, build: c => buildingExhibit(k, c.models) });
  for (const id of Object.keys(ITEMS) as ItemId[])
    e.push({ id: 'item-' + id, group: 'item', name: ITEMS[id].name, src: `src/craft/render/craftModels.ts: itemModel('${id}')`, build: c => still(itemModel(id, c.models)) });
  for (const id of MODULES)
    e.push({ id: 'module-' + id, group: 'module', name: ITEMS[id].name, src: `src/craft/render/craftModels.ts: moduleModel('${id}')`, build: () => still(moduleModel(id)) });
  for (const k of Object.keys(SCRAP) as ScrapKind[])
    e.push({ id: 'scrap-' + k, group: 'scrap', name: SCRAP[k].name, src: `src/craft/render/craftModels.ts: scrapModel('${k}')`, build: c => scrapExhibit(k, c.models) });
  return e;
}
