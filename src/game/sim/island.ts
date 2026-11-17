import { V2, dist, len } from '../../sim/vec';
import { World, Obstacle } from '../../sim/world';
import { Load, LOADS, towDrive, TOW_RANGE } from '../../sim/tow';
import { drive, settle } from '../../sim/drive';
import { bodyOk, guardTurn } from '../../sim/footprint';
import { tr, num } from '../../i18n';
import { ITEMS, ItemId, Bag, RECIPES, Recipe, RecipeId, Inventory, BENCH_SPEED, HAND_COST, bagText } from './craft';

/**
 * Level "Wyspa" (docs/POZIOM-WYSPA.md): a test of how comfortable and fun crafting is.
 * Pure logic, no Three.js. Wolt lands on a rocky island in the Glass Lagoon on reserve.
 * Power opens the door, behind the door is a workbench, the bench makes parts for more
 * power, and more power opens the data in the mission terminal.
 *
 * - Three panels to bring back (cable, pane from a wreck, connector), a splitter on the
 *   post that gathers them, a fuse in the regulator: 450 W in full sun.
 * - The bunker: a feed cable to its lock, a hinge pin and oil for the torn hinge.
 * - Inside: the workbench (twice as fast, from the grid, the only place for big things),
 *   a cradle, and the terminal that wants 900 W for 90 s.
 * - Two ways to 900 W: new panels on the free stands, or an energy storage from four
 *   accumulators that covers the cloud shade.
 * - The ending is in docs/SPOILER-WYSPA.md.
 *
 * Recipes are not given: Q-1 learns them from what Wolt scans or takes apart (the decision
 * of 2026-11-09 stays the starting point). Two ways to make things are tested side by side
 * (`mode`): (a) repair in place, holding E makes the part and fits it; (b) the C panel.
 *
 * 1 tile = 1 m, y grows towards the camera (south).
 */
export const IS_W = 44;
export const IS_H = 34;
export const PLAYER_R = 0.32;
export const USE_RANGE = 1.5;
export const SPEED = 2.6;
export const RUN_MULT = 1.6;
export const MOVE_COST = 0.04;      // % per metre
export const TOW_COST = 0.05;       // extra % per metre with the sled
export const RECHARGE = 0.15;       // %/s Q-1 recovers at rest
export const PORT_CHARGE = 1.2;     // %/s from the regulator port (own cable)
export const CRADLE_CHARGE = 1.8;   // %/s in the bunker cradle
export const START_BATTERY = 22;   // tight, but enough to bring the first panel back (browser playtest 2026-11-17)
export const SLOTS = 6;
export const SLED_CAP = 4;          // big things on the sled (four accumulators make a storage)
export const NEAR_SLED = 4;         // m: the sled counts as "here" for a bench or an install
export const LEARN_TIME = 6;        // s Q-1 needs for one observation
export const FIT_TIME = 1.5;        // s to fit a ready part
export const PANEL_W = 150;         // W of one clean panel in full sun
export const SHADE_SUN = 0.25;      // share of the sun left under a cloud
export const LOCK_W = 50;
export const BENCH_W = 200;
export const CRADLE_W = 150;
export const PORT_W = 120;
export const TERMINAL_W = 900;
export const DOWNLOAD_TIME = 90;    // s at full power
export const STORE_CAP = 400;       // Wh of game time in the energy storage
export const STORE_W = 600;         // W it can give or take
export const STORE_START = 0.5;     // old accumulators still hold half
export const GAME_TIME = 40;        // game seconds per real second for the storage
export const OVERLOAD_AT = 0.7;     // the ending (docs/SPOILER-WYSPA.md)
export const BRIDGE_COST = 1.2;     // %/s while Wolt is the fuse
export const LIGHT_ANSWER = 14;     // s after the lighthouse before the answer
export const END_AT = 26;           // s after the lighthouse before the level ends
export const BOG_DEPTH = 2.5;
export const BOG_BACK = 0.45;
export const JUNCTION_CABLE = 3;    // m from the splitter post to the regulator
export const FEED_CABLE = 6;        // m from the regulator to the bunker lock
export type CraftMode = 'ab' | 'a' | 'b';

/** Island outline: an ellipse; outside it the wheel sinks into glass gravel. */
const CX = 22, CY = 17, RX = 23, RY = 17.5;
export const bogDepth = (p: V2): number => Math.max(0, (Math.hypot((p.x - CX) / RX, (p.y - CY) / RY) - 1) * Math.min(RX, RY));

export const BUNKER = { x: 12, y: 19, w: 12, h: 8, door: 17 };
export const DOOR_W = 3;            // m: wide enough for the sled to follow through
export const PAD_X = [14, 16, 18, 23, 25, 27];
export const P = {
  start: { x: 22, y: 30.5 },
  sled: { x: 25, y: 29 },
  reg: { x: 20, y: 13.8 },
  port: { x: 21.6, y: 13.8 },
  junction: { x: 20.5, y: 9.4 },
  crateA: { x: 5.4, y: 15.6 },
  noteA: { x: 3.6, y: 15.6 },
  door: { x: 18.5, y: 18.2 },
  bench: { x: 14, y: 22.6 },
  terminal: { x: 22, y: 21.7 },
  cradle: { x: 16.2, y: 24.8 },
  storeSlot: { x: 18.8, y: 24.8 },
  stationBatt: { x: 21.8, y: 24.4 },
  lighthouse: { x: 36, y: 5 },
  dome: { x: 60, y: -14 },           // the dome of the greenhouse, far out on the glass
};

/** Things to take apart: what they are, how long, what they give. */
export interface Heap { id: string; name: string; at: V2; time: number; loot: Bag; learns?: RecipeId[]; done: boolean; obstacle: Obstacle }
const heap = (id: string, name: string, x: number, y: number, w: number, h: number, time: number, loot: Bag, learns?: RecipeId[], kind: Obstacle['kind'] = 'scrap'): Heap =>
  ({ id, name, at: { x: x + w / 2, y: y + h + 0.5 }, time, loot, learns, done: false, obstacle: { kind, x, y, w, h } });

function heaps(): Heap[] {
  return [
    heap('wreck1', tr('wrak panelu', 'panel wreck'), 5, 4, 2, 1, 3, { cell: 2, pane: 1, iron: 2 }, ['frame', 'panel']),
    heap('wreck2', tr('wrak panelu', 'panel wreck'), 8, 7, 2, 1, 3, { cell: 2, pane: 1, iron: 2 }, ['frame', 'panel']),
    heap('wreck3', tr('wrak panelu pod latarnią', 'panel wreck under the lighthouse'), 32, 7, 2, 1, 3, { cell: 2, pane: 2, iron: 1 }, ['frame', 'panel']),
    heap('lamp', tr('stara latarenka', 'old lamp post'), 2, 9, 1, 1, 3, { copper: 2, glass: 1, iron: 1 }, ['splitter'], 'pylon'),
    heap('barrel', tr('beczka z olejem', 'barrel of oil'), 5, 10, 1, 1, 2, { oil: 2, iron: 1 }, undefined, 'barrel'),
    heap('k1', tr('kupka złomu', 'scrap heap'), 9, 2, 1, 1, 2.5, { copper: 2, plastic: 2 }),
    heap('k2', tr('kupka złomu', 'scrap heap'), 3, 6, 1, 1, 2.5, { copper: 2, plastic: 2, iron: 1 }),
    heap('k3', tr('kupka złomu', 'scrap heap'), 10, 12, 1, 1, 2.5, { copper: 2, plastic: 2 }),
    heap('k4', tr('kupka złomu', 'scrap heap'), 29, 2, 1, 1, 2.5, { copper: 2, plastic: 1, iron: 1 }),
    heap('k5', tr('kupka złomu', 'scrap heap'), 36, 10, 1, 1, 2.5, { copper: 2, plastic: 2, iron: 1 }),
    heap('crateB', tr('przewrócony kontener', 'overturned container'), 31, 12, 4, 2, 4, { battery: 2, iron: 2 }, undefined, 'container'),
    heap('boat', tr('wrak łodzi', 'boat wreck'), 30, 28, 3, 1, 4, { battery: 2, copper: 2, plastic: 2, glass: 1 }, undefined, 'crate'),
  ];
}

export interface Pad { i: number; x: number; at: V2; /** a panel stands here */ panel: boolean; /** what is wrong with it */ fault: 'pane' | 'connector' | null; linked: boolean }

function pads(): Pad[] {
  // panel 1 only has a torn cable (it is simply not linked), 2 a cracked pane, 3 a burnt connector
  const faults: Pad['fault'][] = [null, 'pane', 'connector'];
  return PAD_X.map((x, i) => ({ i, x, at: { x, y: 6.8 }, panel: i < 3, fault: i < 3 ? faults[i] : null, linked: false }));
}

function obstacles(hs: Heap[]): Obstacle[] {
  const o: Obstacle[] = [];
  const add = (kind: Obstacle['kind'], x: number, y: number, w: number, h: number) => o.push({ kind, x, y, w, h });
  const b = BUNKER;
  add('container', b.x, b.y, b.door - b.x, 1);
  add('container', b.door + DOOR_W, b.y, b.x + b.w - b.door - DOOR_W, 1);
  add('crate', b.door, b.y, DOOR_W, 1);            // the bunker door (removed when it opens)
  add('container', b.x, b.y + b.h - 1, b.w, 1);
  add('container', b.x, b.y + 1, 1, b.h - 2);
  add('container', b.x + b.w - 1, b.y + 1, 1, b.h - 2);
  add('crate', 13, 21, 2, 1);                       // workbench
  add('crate', 21, 20, 2, 1);                       // terminal
  add('crate', 21, 25, 2, 1);                       // the station's dead accumulators
  add('crate', 19, 12, 2, 1);                       // regulator cabinet
  for (const x of PAD_X) add('station', x - 1, 5, 2, 1); // panel stands
  add('container', 3, 13, 4, 2);                    // container A
  add('rock', 35, 3, 2, 2);                         // the lighthouse rock
  add('rock', 7, 25, 2, 2);
  add('rock', 38, 18, 2, 1);
  add('rock', 4, 20, 1, 1);
  for (const h of hs) o.push(h.obstacle);
  return o;
}

/** Open on every side: the glass gravel round the island stops Wolt, not a wall. */
class OpenWorld extends World {
  isBlocked(i: number, j: number): boolean {
    if (i < 0 || j < 0 || i >= this.width || j >= this.height) return false;
    return super.isBlocked(i, j);
  }
}

/** Cloud shadows: soft discs drifting east over the island, wrapping round. */
export const CLOUDS = [
  { y: 6, r: 7, speed: 1.4, phase: 0 },
  { y: 14, r: 9, speed: 1.1, phase: 47 },
  { y: 3, r: 6, speed: 1.7, phase: 80 },
  { y: 24, r: 8, speed: 1.2, phase: 25 },
];
export const CLOUD_SPAN = 110;
export function cloudX(c: typeof CLOUDS[number], t: number): number {
  return -30 + (((c.phase + c.speed * t) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN;
}
/** 0 in full sun, 1 under the middle of a cloud. */
export function shadeAt(p: V2, t: number): number {
  let s = 0;
  for (const c of CLOUDS) {
    const d = Math.hypot(p.x - cloudX(c, t), p.y - c.y);
    const k = Math.max(0, Math.min(1, (c.r - d) / 2.5));
    s = Math.max(s, k * k * (3 - 2 * k));
  }
  return s;
}

export interface IsHint { key: string; text: string; at: V2; ok: boolean; progress?: number; need?: string }
export type IsEvent = 'step' | 'bog' | 'deny' | 'scan' | 'learn' | 'take' | 'craft' | 'fit' | 'hook' | 'unhook' | 'link' | 'power' | 'door' | 'dock' | 'plug' | 'download' | 'blow' | 'bridge' | 'lighthouse' | 'answer' | 'drop' | 'full' | 'note' | 'panel';

/** One line of the grid for the HUD, W. */
export interface GridLine { label: string; w: number; state: 'on' | 'wait' | 'off' }

/** What the level writes down for the test (docs/POZIOM-WYSPA.md, "Co mierzymy"). */
export interface TestLog {
  stages: Record<string, number>;
  inPlace: number;
  menuCrafts: number;
  menuOpens: number;
  overflow: number;
  sledHooks: number;
  denies: number;
}

interface Thing { id: string; at: V2; r?: number }

type Work = { id: string; t: number; need: number };

export class Island {
  readonly heaps = heaps();
  readonly pads = pads();
  readonly world: World = new OpenWorld(IS_W, IS_H, obstacles(this.heaps));
  readonly inv = new Inventory(SLOTS);
  pos: V2 = { ...P.start };
  facing = -Math.PI / 2;
  speed = 0;
  moving = false;
  strain = false;
  bog = 0;
  t = 0;
  battery = START_BATTERY;
  charging = false;
  sled: Load = { id: 'sled', kind: 'bricks', pos: { ...P.sled }, angle: 0.4 };
  towing = false;
  towTaut = false;
  /** Big things on the sled. */
  cargo: ItemId[] = [];
  /** Things on the ground: what did not fit, or was put down. */
  piles: { id: number; item: ItemId; n: number; at: V2 }[] = [];
  private pileId = 0;
  known = new Set<RecipeId>(['cable']);
  /** Observations waiting for Q-1, the first one is being worked on. */
  learning: { recipe: RecipeId; what: string; t: number }[] = [];
  scanned = new Set<string>();
  crateOpen = false;
  junction = false;
  regOk = false;
  fed = false;
  doorOpen = 0;
  storage = false;
  soc = STORE_START;
  docked = false;
  plugged = false;
  downloading = false;
  progress = 0;
  overloaded = false;
  bridged = false;
  lighthouseT = -1;
  answered = false;
  done = false;
  /** Grid this frame. */
  supply = 0;
  demand = 0;
  terminalOn = false;
  benchOn = false;
  storeFlow = 0;
  work: Work | null = null;
  /** A recipe started from the C panel. */
  crafting: { recipe: RecipeId; t: number } | null = null;
  reading: string | null = null;
  message: { text: string; t: number } | null = null;
  events: IsEvent[] = [];
  log: TestLog = { stages: {}, inPlace: 0, menuCrafts: 0, menuOpens: 0, overflow: 0, sledHooks: 0, denies: 0 };
  private stepAcc = 0;
  private bogAcc = 0;
  private idle = 0;
  private denyT = 0;

  constructor(readonly mode: CraftMode = 'ab') {}

  // ---------- helpers

  private say(text: string) { this.message = { text, t: this.t }; }
  private deny(text: string) {
    if (this.denyT > 0) return;
    this.denyT = 1; this.events.push('deny'); this.log.denies++; this.say(text);
  }
  private stage(id: string) { if (!(id in this.log.stages)) this.log.stages[id] = Math.round(this.t); }
  closeNote() { this.reading = null; }
  private read(id: string) { this.reading = id; this.events.push('note'); }

  sledNear(p: V2 = this.pos): boolean { return this.towing || dist(this.sled.pos, p) < NEAR_SLED; }
  /** How many of an item Wolt can use here: his slots, plus the sled when it is close. */
  have(id: ItemId, at: V2 = this.pos): number {
    return ITEMS[id].big ? (this.sledNear(at) ? this.cargo.filter(c => c === id).length : 0) : this.inv.count(id);
  }
  private takeItem(id: ItemId, n: number) {
    if (!ITEMS[id].big) { this.inv.take(id, n); return; }
    for (let k = 0; k < n; k++) { const i = this.cargo.indexOf(id); if (i >= 0) this.cargo.splice(i, 1); }
  }
  /** Into the slots or onto the sled; what does not fit lands on the ground next to Wolt. */
  give(id: ItemId, n: number, at: V2 = this.pos) {
    if (ITEMS[id].big) {
      for (let k = 0; k < n; k++) {
        if (this.sledNear(at) && this.cargo.length < SLED_CAP) this.cargo.push(id);
        else this.drop(id, 1, at);
      }
      return;
    }
    const left = this.inv.add(id, n);
    if (left > 0) { this.drop(id, left, at); this.log.overflow++; this.events.push('full'); }
  }
  private drop(id: ItemId, n: number, at: V2) {
    const a = this.piles.length * 0.9;
    this.piles.push({ id: ++this.pileId, item: id, n, at: { x: at.x + Math.cos(a) * 0.8, y: at.y + Math.sin(a) * 0.8 } });
  }

  /**
   * What fitting a set of parts takes when Wolt also makes the missing small ones by hand
   * (repair in place). In mode 'b' nothing is made here: parts must be ready.
   */
  plan(need: Bag, at: V2 = this.pos): { ok: boolean; crafts: { r: Recipe; n: number }[]; missing: Bag; unknown: RecipeId[]; time: number } {
    const crafts: { r: Recipe; n: number }[] = [], missing: Bag = {}, unknown: RecipeId[] = [], mats: Bag = {};
    let time = 0;
    const add = (b: Bag, id: ItemId, n: number) => { b[id] = (b[id] ?? 0) + n; };
    for (const [id, n] of Object.entries(need) as [ItemId, number][]) {
      const short = n - this.have(id, at);
      if (short <= 0) continue;
      const r = (Object.values(RECIPES) as Recipe[]).find(x => x.out?.id === id && !x.bench);
      if (!r || this.mode === 'b') { add(missing, id, short); continue; }
      if (!this.known.has(r.id)) { unknown.push(r.id); add(missing, id, short); continue; }
      const k = Math.ceil(short / r.out!.n);
      crafts.push({ r, n: k }); time += r.time * k;
      for (const [m, q] of Object.entries(r.need) as [ItemId, number][]) add(mats, m, q * k);
    }
    for (const [m, q] of Object.entries(mats) as [ItemId, number][]) {
      // a material that is also asked for directly must cover both
      const also = need[m] && !crafts.some(c => c.r.out!.id === m) ? need[m]! : 0;
      const lack = q + also - this.have(m, at);
      if (lack > 0) add(missing, m, lack);
    }
    return { ok: Object.keys(missing).length === 0, crafts, missing, unknown, time };
  }

  /** Use up what a plan needs: the missing parts are made and fitted at once, leftovers go to the slots. */
  private spend(need: Bag) {
    const p = this.plan(need);
    for (const c of p.crafts) {
      for (const [m, q] of Object.entries(c.r.need) as [ItemId, number][]) this.takeItem(m, q * c.n);
      this.log.inPlace += c.n;
      this.battery = Math.max(0, this.battery - c.r.time * c.n * HAND_COST);
    }
    for (const [id, n] of Object.entries(need) as [ItemId, number][]) {
      const got = Math.min(n, this.have(id));
      this.takeItem(id, got);
      const made = p.crafts.find(c => c.r.out!.id === id);
      const extra = made ? made.r.out!.n * made.n - (n - got) : 0;
      if (extra > 0) this.give(id, extra);
    }
  }

  private observe(recipe: RecipeId, what: string) {
    if (this.known.has(recipe) || this.learning.some(l => l.recipe === recipe)) return;
    this.learning.push({ recipe, what, t: 0 });
    this.events.push('scan');
  }

  // ---------- power

  sun(p: V2): number { return 1 - (1 - SHADE_SUN) * shadeAt(p, this.t); }
  private flowing(): boolean { return this.regOk || this.bridged; }

  /** The grid: panels through the splitter and the regulator, the storage as a buffer. */
  private solve(dt: number) {
    let supply = 0;
    if (this.flowing() && this.junction) for (const p of this.pads) if (p.panel && !p.fault && p.linked) supply += PANEL_W * this.sun(p.at);
    this.supply = supply;
    const base = (this.fed && this.doorOpen < 1 ? LOCK_W : 0) + (this.crafting && RECIPES[this.crafting.recipe].bench ? BENCH_W : 0)
      + (this.docked && this.battery < 100 ? CRADLE_W : 0) + (this.plugged && this.battery < 100 ? PORT_W : 0);
    const canStore = this.storage && this.soc > 0.001 ? STORE_W : 0;
    this.terminalOn = this.downloading && this.flowing() && supply + canStore >= base + TERMINAL_W;
    this.demand = base + (this.terminalOn ? TERMINAL_W : 0);
    let net = supply - this.demand;
    this.storeFlow = 0;
    if (this.storage) {
      const w = net > 0 ? Math.min(net, STORE_W) * (this.soc < 1 ? 1 : 0) : -Math.min(-net, STORE_W, this.soc > 0 ? STORE_W : 0);
      this.soc = Math.max(0, Math.min(1, this.soc + w * GAME_TIME * dt / 3600 / STORE_CAP));
      this.storeFlow = w;
      net -= w;
    }
    // what the grid cannot carry stops: the bench and the chargers first
    this.benchOn = !!this.crafting && RECIPES[this.crafting.recipe].bench && net >= -1;
    if (supply >= 450) this.stage('450W');
    if (this.terminalOn) {
      this.progress = Math.min(1, this.progress + dt / DOWNLOAD_TIME);
      if (!this.overloaded && this.progress >= OVERLOAD_AT) {
        this.overloaded = true; this.regOk = false; this.stage('blow');
        this.events.push('blow');
        this.say(tr('Huk w szafie regulatora. Bezpiecznik nie wytrzymał. Wszystko gaśnie, pobieranie stoi.', 'A bang in the regulator cabinet. The fuse gave out. Everything goes dark, the download stops.'));
      }
      if (this.progress >= 1 && this.lighthouseT < 0) {
        this.lighthouseT = 0; this.downloading = false; this.stage('done');
        if (this.bridged) { this.bridged = false; this.regOk = false; }
        this.events.push('lighthouse');
        this.say(tr('Dane pobrane. Terminal oddaje sterowanie: na skale coś się budzi.', 'Data downloaded. The terminal hands over control: something wakes on the rock.'));
      }
    }
  }

  /** Grid lines for the HUD. */
  grid(): { sources: GridLine[]; loads: GridLine[] } | null {
    if (!this.regOk && !this.junction && !this.pads.some(p => p.linked) && !this.overloaded) return null;
    const sources: GridLine[] = this.pads.filter(p => p.panel).map(p => ({
      label: tr(`panel ${p.i + 1}`, `panel ${p.i + 1}`) + (p.fault ? tr(' (uszkodzony)', ' (broken)') : !p.linked ? tr(' (niepodłączony)', ' (not connected)') : this.sun(p.at) < 0.6 ? tr(' (cień)', ' (shade)') : ''),
      w: p.linked && !p.fault && this.flowing() && this.junction ? Math.round(PANEL_W * this.sun(p.at)) : 0,
      state: p.linked && !p.fault ? (this.flowing() ? 'on' : 'wait') : 'off',
    }));
    if (this.storage) sources.push({ label: tr(`magazyn ${Math.round(this.soc * 100)}%`, `storage ${Math.round(this.soc * 100)}%`) + (this.storeFlow > 1 ? tr(' (ładuje się)', ' (charging)') : ''), w: Math.round(-this.storeFlow), state: 'on' });
    const loads: GridLine[] = [];
    if (this.fed && this.doorOpen < 1) loads.push({ label: tr('zamek bunkra', 'bunker lock'), w: -LOCK_W, state: this.flowing() ? 'on' : 'off' });
    if (this.doorOpen >= 1) loads.push({ label: tr('stół warsztatowy', 'workbench'), w: this.benchOn ? -BENCH_W : 0, state: this.benchOn ? 'on' : 'wait' });
    if (this.docked || this.plugged) loads.push({ label: tr('ładowanie Wolta', 'charging Wolt'), w: -(this.docked ? CRADLE_W : PORT_W), state: 'on' });
    if (this.scanned.has('terminal')) loads.push({ label: tr('terminal (pobieranie)', 'terminal (download)'), w: this.terminalOn ? -TERMINAL_W : 0, state: this.terminalOn ? 'on' : this.downloading ? 'wait' : 'off' });
    return { sources, loads };
  }

  /** What the terminal shows: watts it has and wants. */
  terminalNeed(): { have: number; want: number } {
    // with the regulator down nothing reaches the terminal, the storage included
    if (!this.flowing()) return { have: 0, want: TERMINAL_W };
    const store = this.storage && this.soc > 0.001 ? STORE_W : 0;
    return { have: Math.round(this.supply + store - (this.demand - (this.terminalOn ? TERMINAL_W : 0))), want: TERMINAL_W };
  }

  // ---------- things to use

  private things(): Thing[] {
    const t: Thing[] = [];
    if (this.lighthouseT >= 0) return t;
    t.push({ id: 'reg', at: P.reg }, { id: 'port', at: P.port }, { id: 'noteA', at: P.noteA });
    if (!this.crateOpen) t.push({ id: 'crateA', at: P.crateA });
    if (!this.junction) t.push({ id: 'junction', at: P.junction });
    for (const p of this.pads) if (p.fault || !p.linked || !p.panel) t.push({ id: 'pad' + p.i, at: p.at });
    for (const h of this.heaps) if (!h.done) t.push({ id: 'heap:' + h.id, at: h.at });
    for (const pl of this.piles) t.push({ id: 'pile:' + pl.id, at: pl.at });
    if (this.doorOpen < 1) t.push({ id: 'door', at: P.door });
    else {
      t.push({ id: 'bench', at: P.bench }, { id: 'terminal', at: P.terminal }, { id: 'cradle', at: P.cradle });
      if (!this.storage) t.push({ id: 'stationBatt', at: P.stationBatt }, { id: 'storeSlot', at: P.storeSlot });
    }
    return t;
  }

  private at(id: string): V2 | null {
    if (id === 'sled') return this.sled.pos;
    return this.things().find(x => x.id === id)?.at ?? null;
  }

  usables(): { id: string; at: V2 }[] { return [...this.things(), { id: 'sled', at: this.sled.pos }].map(x => ({ id: x.id, at: x.at })); }
  current(): string | null { return this.nearest(); }

  nearest(): string | null {
    if (this.lighthouseT >= 0 || this.bridged) return this.bridged ? 'reg' : null;
    let best: string | null = null, bd = USE_RANGE;
    for (const th of this.things()) {
      const d = dist(th.at, this.pos);
      if (d < bd) { bd = d; best = th.id; }
    }
    // the sled answers when nothing else does (E hooks or unhooks it)
    const sr = LOADS.bricks.radius + TOW_RANGE + 0.4;
    if (!best && (this.towing || dist(this.sled.pos, this.pos) < sr)) best = 'sled';
    return best;
  }

  // ---------- what E would do, as text (the hint) and as action

  hint(): IsHint | null {
    if (this.reading || this.done) return null;
    const n = this.nearest();
    if (!n) return null;
    const at = this.at(n) ?? this.pos;
    const prog = this.work && this.work.id === n ? this.work.t / this.work.need : undefined;
    const fix = (what: string, need: Bag, extra = ''): IsHint => {
      const p = this.plan(need);
      if (p.ok) return { key: 'E', text: (p.crafts.length ? tr('przytrzymaj: zrób i zamontuj ', 'hold: make and fit ') : tr('przytrzymaj: zamontuj ', 'hold: fit ')) + what + extra, at, ok: true, progress: prog, need: bagText(need) };
      const miss = bagText(p.missing);
      // Q-1 is still working the recipe out: say so, instead of "does not know"
      if (p.unknown.length && p.unknown.every(r => this.learning.some(l => l.recipe === r))) return { key: '…', text: what + tr(': Q-1 jeszcze liczy przepis (', ': Q-1 is still working out the recipe (') + p.unknown.map(r => RECIPES[r].name).join(', ') + ')', at, ok: false, need: bagText(need) };
      const why = p.unknown.length ? tr(' · Q-1 nie zna przepisu: ', ' · Q-1 does not know how to make: ') + p.unknown.map(r => RECIPES[r].name).join(', ') : this.mode === 'b' && p.crafts.length === 0 && Object.keys(p.missing).some(id => (Object.values(RECIPES) as Recipe[]).some(r => r.out?.id === id && !r.bench)) ? tr(' · zrób w panelu C', ' · make it in the C panel') : '';
      return { key: 'E', text: what + tr(': brakuje ', ': missing ') + miss + why, at, ok: false, need: bagText(need) };
    };
    if (n.startsWith('heap:')) {
      const h = this.heaps.find(x => 'heap:' + x.id === n)!;
      return { key: 'E', text: tr('przytrzymaj: rozbierz ', 'hold: take apart ') + h.name + ' → ' + bagText(h.loot), at, ok: true, progress: prog };
    }
    if (n.startsWith('pile:')) {
      const pl = this.piles.find(x => 'pile:' + x.id === n)!;
      const big = ITEMS[pl.item].big;
      return { key: 'E', text: tr('podnieś ', 'pick up ') + `${pl.n}${ITEMS[pl.item].unit ?? ''} ${ITEMS[pl.item].name}` + (big && !this.sledNear() ? tr(' (za ciężkie: przyciągnij sanki)', ' (too heavy: bring the sled)') : ''), at, ok: !big || this.sledNear() };
    }
    if (n.startsWith('pad')) {
      const p = this.pads[+n.slice(3)];
      if (!p.panel) return this.have('panel') ? { key: 'E', text: tr('przytrzymaj: postaw panel na stelażu', 'hold: set the panel on the stand'), at, ok: true, progress: prog } : { key: 'E', text: tr('pusty stelaż: potrzebny panel (stół w bunkrze)', 'empty stand: needs a panel (bench in the bunker)'), at, ok: false };
      if (p.fault === 'pane') return fix(tr('szybę', 'the pane'), { pane: 1 }, tr(' (pęknięta)', ' (cracked)'));
      if (p.fault === 'connector') return this.known.has('connector') || this.scanned.has(n) ? fix(tr('złącze', 'the connector'), { connector: 1 }, tr(' (spalone)', ' (burnt)')) : { key: 'E', text: tr('panel: spalone złącze · zeskanuj', 'panel: burnt connector · scan'), at, ok: true };
      const m = this.linkLen(p);
      if (!this.junction) return { key: 'E', text: tr('panel sprawny, ale nie ma go do czego podłączyć (słupek rozgałęźnika jest pusty)', 'the panel works, but there is nothing to plug it into (the splitter post is empty)'), at, ok: false };
      return fix(tr(`kabel do rozgałęźnika (${m} m)`, `cable to the splitter (${m} m)`), { cable: m });
    }
    switch (n) {
      case 'sled': return { key: 'E', text: this.towing ? tr('odczep sanki', 'unhitch the sled') : tr(`doczep sanki (${this.cargo.length}/${SLED_CAP})`, `hitch the sled (${this.cargo.length}/${SLED_CAP})`), at, ok: true };
      case 'noteA': return { key: 'E', text: tr('kartka na kontenerze', 'note on the container'), at, ok: true };
      case 'crateA': return { key: 'E', text: tr('skrzynia serwisowa: otwórz', 'service crate: open'), at, ok: true };
      case 'junction': return this.known.has('splitter') || this.have('splitter') ? fix(tr('rozgałęźnik na słupku', 'the splitter on the post'), { splitter: 1, cable: JUNCTION_CABLE }) : { key: 'E', text: tr('pusty słupek z czterema przewodami: tu coś było', 'an empty post with four leads: something sat here'), at, ok: false };
      case 'reg':
        if (this.bridged) return { key: 'Q', text: tr('Wolt jest bezpiecznikiem · Q odpina', 'Wolt is the fuse · Q lets go'), at, ok: true };
        if (this.regOk) return { key: '·', text: tr('regulator działa', 'the regulator works'), at, ok: true };
        if (!this.known.has('fuse') && !this.scanned.has('reg')) return { key: 'E', text: tr('szafa regulatora: zeskanuj', 'regulator cabinet: scan'), at, ok: true };
        if (this.overloaded) {
          const p = this.plan({ fuse: 1 });
          return p.ok ? fix(tr('nowy bezpiecznik', 'a new fuse'), { fuse: 1 }) : { key: 'E', text: tr('przytrzymaj: wepnij ramię zamiast bezpiecznika', 'hold: plug the arm in where the fuse was'), at, ok: true, progress: prog };
        }
        return fix(tr('bezpiecznik', 'the fuse'), { fuse: 1 }, tr(' (spalony)', ' (burnt)'));
      case 'port': return !this.flowing() || this.supply < 1 ? { key: 'E', text: tr('port szafy: bez prądu', 'cabinet port: no power'), at, ok: false } : { key: 'E', text: this.plugged ? tr('odepnij własny kabel', 'unplug your own cable') : tr('wepnij własny kabel: ładowanie', 'plug in your own cable: charging'), at, ok: true };
      case 'door':
        if (!this.fed) return fix(tr(`kabel zasilania zamka (${FEED_CABLE} m)`, `lock feed cable (${FEED_CABLE} m)`), { cable: FEED_CABLE });
        if (!this.scanned.has('door')) return { key: 'E', text: tr('drzwi bunkra: zeskanuj', 'bunker door: scan'), at, ok: true };
        if (!this.flowing() || this.supply < LOCK_W) return { key: 'E', text: tr('zamek bez prądu (potrzeba 50 W)', 'the lock has no power (needs 50 W)'), at, ok: false };
        return fix(tr('sworzeń i olej w zawiasie', 'pin and oil in the hinge'), { pin: 1, oil: 1 });
      case 'bench': return { key: 'C', text: this.flowing() && this.supply > 0 ? tr('stół warsztatowy: panel C', 'workbench: C panel') : tr('stół bez prądu', 'the bench has no power'), at, ok: this.flowing() };
      case 'cradle': return { key: 'E', text: this.docked ? tr('zjedź z kołyski', 'roll off the cradle') : tr('kołyska: ładowanie z sieci', 'cradle: charge from the grid'), at, ok: this.flowing() };
      case 'stationBatt': return { key: 'E', text: this.known.has('storage') ? tr('martwe akumulatory stacji (zeskanowane)', "the station's dead accumulators (scanned)") : tr('martwe akumulatory stacji: zeskanuj', "the station's dead accumulators: scan"), at, ok: true };
      case 'storeSlot': return { key: 'C', text: tr('miejsce na magazyn energii (zbuduj przy stole)', 'room for an energy storage (build it at the bench)'), at, ok: false };
      case 'terminal': {
        if (!this.scanned.has('terminal')) return { key: 'E', text: tr('terminal misji: obudź', 'mission terminal: wake'), at, ok: true };
        const nd = this.terminalNeed();
        if (this.downloading) return { key: '·', text: tr(`pobieranie ${Math.floor(this.progress * 100)}% · ${nd.have} / ${nd.want} W`, `downloading ${Math.floor(this.progress * 100)}% · ${nd.have} / ${nd.want} W`), at, ok: this.terminalOn };
        return { key: 'E', text: tr(`pobierz dane · ${Math.max(0, nd.have)} / ${nd.want} W`, `download the data · ${Math.max(0, nd.have)} / ${nd.want} W`), at, ok: nd.have >= nd.want };
      }
    }
    return null;
  }

  /** How long a hold-E action at `id` takes right now, or 0 for a press. */
  private holdTime(id: string): number {
    if (id.startsWith('heap:')) return this.heaps.find(x => 'heap:' + x.id === id)!.time;
    const timed = (need: Bag) => { const p = this.plan(need); return p.ok ? FIT_TIME + p.time : 0; };
    if (id.startsWith('pad')) {
      const p = this.pads[+id.slice(3)];
      if (!p.panel) return this.have('panel') ? 2 : 0;
      if (p.fault === 'pane') return timed({ pane: 1 });
      if (p.fault === 'connector') return this.known.has('connector') ? timed({ connector: 1 }) : 0;
      return this.junction ? timed({ cable: this.linkLen(p) }) : 0;
    }
    switch (id) {
      case 'junction': return this.known.has('splitter') || this.have('splitter') ? timed({ splitter: 1, cable: JUNCTION_CABLE }) : 0;
      case 'reg':
        if (this.bridged || this.regOk || (!this.known.has('fuse') && !this.scanned.has('reg'))) return 0;
        if (this.overloaded && !this.plan({ fuse: 1 }).ok) return 1.2;
        return timed({ fuse: 1 });
      case 'door':
        if (!this.fed) return timed({ cable: FEED_CABLE });
        if (!this.scanned.has('door') || !this.flowing() || this.supply < LOCK_W) return 0;
        return timed({ pin: 1, oil: 1 }) + 1.5;
    }
    return 0;
  }

  linkLen(p: Pad): number { return Math.ceil(dist(p.at, P.junction)); }

  // ---------- update

  update(dt: number, inp: { move: V2; run: boolean; use: boolean; usePressed: boolean; drop?: boolean; stopIn?: number }) {
    this.t += dt;
    if (this.message && this.t - this.message.t > 6) this.message = null;
    this.denyT = Math.max(0, this.denyT - dt);
    if (this.doorOpen > 0 && this.doorOpen < 1) {
      this.doorOpen = Math.min(1, this.doorOpen + dt / 1.4);
      if (this.doorOpen >= 1) {
        const d = this.world.obstacles.find(o => o.kind === 'crate' && o.x === BUNKER.door && o.y === BUNKER.y);
        if (d) this.world.remove(d);
      }
    }
    this.learn(dt);
    this.solve(dt);
    if (this.lighthouseT >= 0) {
      this.lighthouseT += dt; this.moving = false; this.speed = 0;
      if (!this.answered && this.lighthouseT > LIGHT_ANSWER) { this.answered = true; this.events.push('answer'); this.say(tr('Daleko na tafli, w kopule, coś odmrugało światłem. Trzy krótkie, przerwa, trzy krótkie.', 'Far out on the glass, in the dome, something blinked back. Three short, a pause, three short.')); }
      if (this.lighthouseT > END_AT) this.done = true;
      return;
    }
    if (this.reading) { this.moving = false; this.speed = 0; return; }
    if (inp.drop) {
      if (this.bridged) { this.bridged = false; this.events.push('unhook'); this.say(tr('Ramię wyszło z gniazda. Obwód jest otwarty.', 'The arm is out of the socket. The circuit is open.')); }
      else if (this.towing) { this.towing = false; this.towTaut = false; this.events.push('unhook'); }
    }
    if (this.bridged) {
      // Wolt is the fuse: the last part of the download goes through him (docs/SPOILER-WYSPA.md)
      // it only costs him while the power actually flows through (a cloud pauses both)
      if (this.terminalOn) this.battery = Math.max(0, this.battery - BRIDGE_COST * dt);
      this.moving = false; this.speed = 0;
    } else {
      const want = len(inp.move) > 0.01;
      if (want && (this.docked || this.plugged)) { this.docked = false; this.plugged = false; this.events.push('drop'); }
      if (want) this.crafting = null;
      this.move(dt, inp);
    }
    this.use(dt, inp);
    this.craftStep(dt);
    // Q-1 recovers at rest, faster on the port or the cradle while the grid gives power
    this.idle = this.moving || this.work ? 0 : this.idle + dt;
    const fed = this.flowing() && this.supply > 0;
    const rate = this.docked && fed ? CRADLE_CHARGE : this.plugged && fed ? PORT_CHARGE : this.idle > 1 && !this.bridged ? RECHARGE : 0;
    this.charging = rate > 0 && this.battery < 100;
    if (this.charging) this.battery = Math.min(100, this.battery + rate * dt);
  }

  private learn(dt: number) {
    const l = this.learning[0];
    if (!l) return;
    l.t += dt;
    if (l.t < LEARN_TIME) return;
    this.learning.shift();
    this.known.add(l.recipe);
    this.events.push('learn');
    this.say(tr(`Q-1 rozumie: ${l.what}. Nowy przepis: ${RECIPES[l.recipe].name} (${bagText(RECIPES[l.recipe].need)}).`, `Q-1 understands: ${l.what}. New recipe: ${RECIPES[l.recipe].name} (${bagText(RECIPES[l.recipe].need)}).`));
  }

  private move(dt: number, inp: { move: V2; run: boolean; stopIn?: number }) {
    const want = len(inp.move) > 0.01 && !this.work;
    let sp = SPEED * (inp.run ? RUN_MULT : 1);
    if (this.towing) sp *= 1 - LOADS.bricks.drag * (0.5 + this.cargo.length * 0.12);
    if (this.battery < 5) sp *= this.battery <= 0 ? 0.35 : 0.5;
    const f0 = this.facing;
    let step = drive(this, dt, want ? inp.move : { x: 0, y: 0 }, sp, undefined, inp.stopIn);
    const sledOk = (c: V2) => this.towing || dist(c, this.sled.pos) >= PLAYER_R + LOADS.bricks.radius;
    const g = guardTurn(this.world, this.pos, f0, this.facing, PLAYER_R, sledOk);
    if (g.facing !== this.facing) { this.facing = g.facing; step = { x: Math.cos(this.facing) * this.speed * dt, y: Math.sin(this.facing) * this.speed * dt }; }
    if (g.pos !== this.pos) this.pos = g.pos;
    const intended = len(step);
    this.strain = false;
    const deep = bogDepth(this.pos);
    this.bog = Math.min(1, deep / BOG_DEPTH);
    let grip = 1;
    if (deep > 0 && intended > 1e-6) {
      const out = bogDepth({ x: this.pos.x + step.x, y: this.pos.y + step.y }) > deep;
      grip = out ? 1 - this.bog : Math.max(BOG_BACK, 1 - this.bog);
      step = { x: step.x * grip, y: step.y * grip };
      if (out && grip < 0.5) this.deny(tr('Koło ślizga się na szklanym żwirze i buksuje. Dalej jest tylko tafla.', 'The wheel slips on the glass gravel and spins. Beyond is only the glass sheet.'));
      this.bogAcc += intended * (1 - grip);
      this.battery = Math.max(0, this.battery - intended * (1 - grip) * MOVE_COST);
      if (this.bogAcc > 0.5) { this.bogAcc = 0; this.events.push('bog'); }
    }
    if (intended < 1e-6) { this.moving = false; if (!want) this.towTaut = false; return; }
    const before = { ...this.pos };
    const free = (c: V2) => bodyOk(this.world, this.pos, this.facing, c, this.facing, PLAYER_R) && sledOk(c);
    let cand = { ...this.pos };
    for (const s of [{ x: step.x, y: 0 }, { x: 0, y: step.y }]) {
      const c = { x: cand.x + s.x, y: cand.y + s.y };
      if (free(c)) cand = c;
    }
    if (this.towing) {
      const r = towDrive(this.world, this.sled, this.pos, cand, this.facing, free);
      this.sled.pos = r.step.pos; this.sled.angle = r.step.angle; this.towTaut = r.step.taut;
      if (r.step.blocked && dist(r.pos, before) < intended * 0.35) this.deny(tr('Sanki o coś zaczepiły. Objedź przeszkodę albo odczep je (Q).', 'The sled snagged on something. Drive around it or unhitch it (Q).'));
      cand = r.pos;
    }
    this.pos = cand;
    const d = dist(before, this.pos);
    settle(this, grip > 1e-3 ? d / grip : intended, dt);
    this.moving = d > 1e-5;
    this.strain = want && (d < intended * 0.35 || grip < 0.75);
    this.battery = Math.max(0, this.battery - d * (MOVE_COST + (this.towing ? TOW_COST : 0)));
    this.stepAcc += d;
    if (this.stepAcc > 0.8) { this.stepAcc = 0; this.events.push('step'); }
  }

  private use(dt: number, inp: { use: boolean; usePressed: boolean }) {
    const n = this.nearest();
    if (!n || !inp.use || (this.work && this.work.id !== n)) this.work = null;
    if (!n) return;
    const hold = this.holdTime(n);
    if (hold > 0) {
      if (!inp.use) return;
      if (!this.work) this.work = { id: n, t: 0, need: hold };
      this.work.t += dt;
      if (Math.floor(this.work.t / 0.4) !== Math.floor((this.work.t - dt) / 0.4)) this.events.push('craft');
      if (this.work.t >= this.work.need) { this.work = null; this.finish(n); }
      return;
    }
    if (inp.usePressed) this.press(n);
  }

  /** A hold-E action completed. */
  private finish(id: string) {
    if (id.startsWith('heap:')) {
      const h = this.heaps.find(x => 'heap:' + x.id === id)!;
      h.done = true; this.world.remove(h.obstacle);
      for (const [it, q] of Object.entries(h.loot) as [ItemId, number][]) this.give(it, q, h.at);
      for (const r of h.learns ?? []) this.observe(r, h.name);
      this.battery = Math.max(0, this.battery - 1);
      this.events.push('take');
      if (h.loot.battery && !this.sledNear(h.at)) this.say(tr('Akumulatory są za ciężkie dla ramienia: leżą na ziemi. Przyciągnij sanki.', 'The accumulators are too heavy for the arm: they lie on the ground. Bring the sled.'));
      return;
    }
    if (id.startsWith('pad')) {
      const p = this.pads[+id.slice(3)];
      if (!p.panel) { this.takeItem('panel', 1); p.panel = true; this.events.push('fit'); this.say(tr('Panel stoi na stelażu. Teraz kabel do rozgałęźnika.', 'The panel is on its stand. Now a cable to the splitter.')); return; }
      if (p.fault === 'pane') { this.spend({ pane: 1 }); p.fault = null; this.events.push('fit'); return; }
      if (p.fault === 'connector') { this.spend({ connector: 1 }); p.fault = null; this.events.push('fit'); return; }
      this.spend({ cable: this.linkLen(p) }); p.linked = true; this.events.push('link');
      if (this.regOk) this.events.push('power');
      return;
    }
    switch (id) {
      case 'junction':
        this.spend({ splitter: 1, cable: JUNCTION_CABLE }); this.junction = true; this.events.push('fit');
        this.say(tr('Rozgałęźnik siedzi na słupku i jest połączony z szafą. Ma sześć gniazd na panele.', 'The splitter sits on the post, wired to the cabinet. It has six sockets for panels.'));
        break;
      case 'reg':
        if (this.overloaded && !this.plan({ fuse: 1 }).ok) {
          this.bridged = true; this.events.push('bridge'); this.stage('bridge');
          this.say(tr('Ramię Wolta zamyka obwód. Prąd płynie przez niego: każda rzecz, którą zasilasz z siebie, to twoje życie.', "Wolt's arm closes the circuit. The power flows through him: everything you power from yourself is your life."));
          break;
        }
        this.spend({ fuse: 1 }); this.regOk = true; this.events.push('fit', 'power');
        if (this.overloaded) this.stage('fuse2');
        this.say(this.junction ? tr('Nowy bezpiecznik. Szafa mruczy.', 'A new fuse. The cabinet hums.') : tr('Nowy bezpiecznik w regulatorze. Panele trzeba jeszcze zebrać w jedną linię.', 'A new fuse in the regulator. The panels still have to be gathered into one line.'));
        break;
      case 'door':
        if (!this.fed) { this.spend({ cable: FEED_CABLE }); this.fed = true; this.events.push('link'); this.say(tr('Kabel od szafy do zamka bunkra.', 'A cable from the cabinet to the bunker lock.')); break; }
        this.spend({ pin: 1, oil: 1 }); this.doorOpen = 0.001; this.stage('door'); this.events.push('door');
        this.say(tr('Zamek puszcza, nowy sworzeń trzyma, zawias skrzypi na oleju. Drzwi bunkra się otwierają.', 'The lock gives, the new pin holds, the hinge creaks on the oil. The bunker door opens.'));
        break;
    }
  }

  /** A press of E (no holding). */
  private press(id: string) {
    if (id.startsWith('pile:')) {
      const i = this.piles.findIndex(x => 'pile:' + x.id === id), pl = this.piles[i];
      if (ITEMS[pl.item].big) {
        if (!this.sledNear() || this.cargo.length >= SLED_CAP) { this.deny(this.sledNear() ? tr('Sanki są pełne.', 'The sled is full.') : tr('Za ciężkie dla ramienia. Przyciągnij sanki.', 'Too heavy for the arm. Bring the sled.')); return; }
        this.cargo.push(pl.item); pl.n--;
      } else {
        const left = this.inv.add(pl.item, pl.n);
        if (left === pl.n) { this.deny(tr('Wszystkie miejsca są pełne.', 'All slots are full.')); return; }
        pl.n = left;
      }
      if (pl.n <= 0) this.piles.splice(i, 1);
      this.events.push('take');
      return;
    }
    if (id.startsWith('pad')) {
      const p = this.pads[+id.slice(3)];
      if (p.fault === 'connector' && !this.scanned.has(id)) { this.scanned.add(id); this.observe('connector', tr('złącze panelu', 'the panel connector')); this.say(tr('Złącze panelu jest spalone. Q-1 przygląda się, jak było zrobione.', 'The panel connector is burnt. Q-1 studies how it was made.')); return; }
      const h = this.hint(); if (h && !h.ok) this.deny(h.text);
      return;
    }
    switch (id) {
      case 'sled':
        this.towing = !this.towing;
        if (this.towing) this.log.sledHooks++;
        this.events.push(this.towing ? 'hook' : 'unhook');
        return;
      case 'noteA': this.read('kartkaWyspa'); return;
      case 'crateA':
        this.crateOpen = true; this.events.push('take');
        this.give('cable', 10, P.crateA); this.give('copper', 2, P.crateA); this.give('plastic', 1, P.crateA);
        this.say(tr('W skrzyni: 10 m kabla, trochę miedzi i plastiku.', 'In the crate: 10 m of cable, some copper and plastic.'));
        return;
      case 'reg':
        if (!this.scanned.has('reg') && !this.regOk) { this.scanned.add('reg'); this.observe('fuse', tr('bezpiecznik regulatora', 'the regulator fuse')); this.say(tr('W regulatorze spalił się bezpiecznik. Q-1 bierze go pod lupę.', 'The regulator fuse has burnt out. Q-1 takes a close look.')); return; }
        { const h = this.hint(); if (h && !h.ok) this.deny(h.text); }
        return;
      case 'junction': { const h = this.hint(); if (h && !h.ok) this.deny(h.text); return; }
      case 'port':
        if (!this.flowing() || this.supply < 1) { this.deny(tr('Port szafy jest martwy.', 'The cabinet port is dead.')); return; }
        this.plugged = !this.plugged; this.events.push(this.plugged ? 'plug' : 'drop');
        return;
      case 'door':
        if (this.fed && !this.scanned.has('door')) { this.scanned.add('door'); this.observe('pin', tr('zawias drzwi', 'the door hinge')); this.read('kartkaZawias'); return; }
        { const h = this.hint(); if (h && !h.ok) this.deny(h.text); }
        return;
      case 'cradle':
        if (!this.flowing() || this.supply < 1) { this.deny(tr('Kołyska nie ma prądu.', 'The cradle has no power.')); return; }
        this.docked = !this.docked; this.events.push(this.docked ? 'dock' : 'drop');
        return;
      case 'stationBatt':
        this.scanned.add('stationBatt'); this.observe('storage', tr('akumulatory stacji', "the station's accumulators"));
        this.say(tr('Martwe akumulatory stacji. Q-1 liczy, jak zbudować z czterech takich magazyn.', "The station's dead accumulators. Q-1 works out how four of these make a storage."));
        return;
      case 'storeSlot': this.deny(tr('Magazyn buduje się przy stole (panel C), z czterema akumulatorami na sankach.', 'The storage is built at the bench (C panel), with four accumulators on the sled.')); return;
      case 'bench': this.events.push('panel'); return;
      case 'terminal':
        if (!this.scanned.has('terminal')) { this.scanned.add('terminal'); this.stage('terminal'); this.say(tr(`Ekran budzi się i od razu gaśnie. Do pobrania danych terminal chce ${TERMINAL_W} W przez ${DOWNLOAD_TIME} s.`, `The screen wakes and dies at once. To download the data the terminal wants ${TERMINAL_W} W for ${DOWNLOAD_TIME} s.`)); this.events.push('download'); return; }
        if (!this.downloading) {
          const nd = this.terminalNeed();
          if (nd.have < nd.want) { this.deny(tr(`Za mało prądu: ${Math.max(0, nd.have)} / ${nd.want} W. Więcej paneli albo magazyn energii.`, `Not enough power: ${Math.max(0, nd.have)} / ${nd.want} W. More panels or an energy storage.`)); return; }
          this.downloading = true; this.stage('download'); this.events.push('download');
          this.say(tr('Pobieranie ruszyło. Gdy zabraknie prądu, stanie, ale się nie cofnie.', 'The download is running. If the power runs short it stops, but it does not go back.'));
        }
        return;
    }
  }

  // ---------- the C panel

  /** Why a recipe cannot be made here and now, or null when it can. */
  whyNot(id: RecipeId): string | null {
    const r = RECIPES[id];
    if (this.mode === 'a') return tr('w tym teście panel C jest wyłączony', 'the C panel is off in this test');
    if (!this.known.has(id)) return tr('Q-1 nie zna przepisu', 'Q-1 does not know it');
    if (r.bench) {
      if (this.doorOpen < 1 || dist(this.pos, P.bench) > 2.4) return tr('tylko przy stole w bunkrze', 'only at the bench in the bunker');
      if (!this.flowing() || this.supply < BENCH_W * 0.5) return tr('stół nie ma prądu', 'the bench has no power');
    }
    for (const [m, q] of Object.entries(r.need) as [ItemId, number][]) if (this.have(m) < q) return tr('brakuje: ', 'missing: ') + `${q - this.have(m)}${ITEMS[m].unit ?? ''} ${ITEMS[m].name}` + (ITEMS[m].big ? tr(' (na sankach przy stole)', ' (on the sled by the bench)') : '');
    if (r.out && ITEMS[r.out.id].big && this.cargo.length >= SLED_CAP && this.sledNear()) return tr('sanki są pełne', 'the sled is full');
    if (id === 'storage' && this.storage) return tr('magazyn już stoi', 'the storage is already built');
    return null;
  }

  craft(id: RecipeId): boolean {
    const why = this.whyNot(id);
    if (why) { this.deny(why); return false; }
    this.crafting = { recipe: id, t: 0 };
    return true;
  }

  private craftStep(dt: number) {
    const c = this.crafting;
    if (!c) return;
    const r = RECIPES[c.recipe];
    if (r.bench ? !this.benchOn : false) return; // the bench waits for power
    c.t += dt * (r.bench ? BENCH_SPEED : 1);
    if (!r.bench) this.battery = Math.max(0, this.battery - HAND_COST * dt);
    if (Math.floor(c.t / 0.4) !== Math.floor((c.t - dt) / 0.4)) this.events.push('craft');
    if (c.t < r.time) return;
    this.crafting = null;
    // things may have moved while it worked (the sled pulled away): then nothing is used up
    if ((Object.entries(r.need) as [ItemId, number][]).some(([m, q]) => this.have(m) < q)) { this.deny(tr('Czegoś zabrakło w trakcie. Nic nie zużyto.', 'Something went missing while it worked. Nothing was used.')); return; }
    for (const [m, q] of Object.entries(r.need) as [ItemId, number][]) this.takeItem(m, q);
    this.log.menuCrafts++;
    if (c.recipe === 'storage') { this.storage = true; this.stage('storage'); this.events.push('fit'); this.say(tr('Magazyn energii stoi pod ścianą i łapie nadwyżkę z paneli.', 'The energy storage stands by the wall and soaks up the spare power.')); return; }
    this.give(r.out!.id, r.out!.n, P.bench);
    this.events.push('fit');
  }

  /** Recipes for the C panel, known first. */
  recipes(): { r: Recipe; known: boolean; why: string | null }[] {
    return (Object.values(RECIPES) as Recipe[]).map(r => ({ r, known: this.known.has(r.id), why: this.whyNot(r.id) }));
  }

  // ---------- goal line

  goal(): string {
    if (this.lighthouseT >= 0) return tr('Latarnia świeci nad szklaną taflą.', 'The lighthouse shines over the glass.');
    if (this.bridged) return tr(`Wolt trzyma obwód. Pobieranie ${Math.floor(this.progress * 100)}%.`, `Wolt holds the circuit. Download ${Math.floor(this.progress * 100)}%.`);
    if (this.overloaded && !this.regOk) return tr('Bezpiecznik strzelił. Nowy bezpiecznik albo coś, co go zastąpi.', 'The fuse blew. A new fuse, or something to stand in for it.');
    if (this.downloading) return tr(`Pobieranie danych: ${Math.floor(this.progress * 100)}%${this.terminalOn ? '' : tr(' · czeka na prąd', ' · waiting for power')}.`, `Downloading: ${Math.floor(this.progress * 100)}%${this.terminalOn ? '' : ' · waiting for power'}.`);
    if (this.scanned.has('terminal')) return tr(`Terminal chce ${TERMINAL_W} W. Teraz: ${Math.max(0, this.terminalNeed().have)} W. Więcej paneli na stelażach albo magazyn energii.`, `The terminal wants ${TERMINAL_W} W. Now: ${Math.max(0, this.terminalNeed().have)} W. More panels on the stands, or an energy storage.`);
    if (this.doorOpen >= 1) return tr('Bunkier stoi otworem: stół, kołyska i terminal misji.', 'The bunker is open: a bench, a cradle and the mission terminal.');
    if (this.fed) return tr('Zamek bunkra ma kabel. Drzwi trzyma jeszcze zawias.', 'The bunker lock has a cable. The hinge still holds the door.');
    const working = this.pads.filter(p => p.panel && !p.fault && p.linked).length;
    if (this.regOk && this.junction && working > 0) return tr(`Panele dają prąd (${Math.round(this.supply)} W). Zamek bunkra potrzebuje kabla od szafy.`, `The panels give power (${Math.round(this.supply)} W). The bunker lock needs a cable from the cabinet.`);
    if (this.pads.some(p => p.linked) || this.junction) return tr('Panele, rozgałęźnik i bezpiecznik w szafie: wszystko musi być na jednej linii.', 'Panels, splitter and the fuse in the cabinet: it all has to be on one line.');
    return tr('Stacja na wyspie jest martwa. Panele są uszkodzone i niepodłączone.', 'The island station is dead. The panels are broken and not connected.');
  }

  /** The learning bar for the HUD. */
  thinking(): { what: string; p: number; queue: number } | null {
    const l = this.learning[0];
    return l ? { what: l.what, p: l.t / LEARN_TIME, queue: this.learning.length - 1 } : null;
  }
}

/** For the HUD: Polish numbers. */
export const watts = (w: number) => `${num(Math.round(w), 0)} W`;
