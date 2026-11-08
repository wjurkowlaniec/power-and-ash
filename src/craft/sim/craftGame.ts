import { V2, add, sub, scale, len, norm, dist } from '../../sim/vec';
import { World, Obstacle } from '../../sim/world';
import { Cable } from '../../sim/cable';
import { solveNetworks, NetworkState } from '../../sim/power';
import { findPath } from '../../sim/path';
import { drive, settle, turnTowards } from '../../sim/drive';
import { Wind } from '../../sim/wind';
import { Load, towDrive, TOW_RANGE } from '../../sim/tow';
import { tr, num } from '../../i18n';
import {
  ITEMS, ItemId, Recipe, TECHS, TechId, OBS, ObsId, SCRAP, ScrapKind, BUILD, BuildKind, BuildingId, ModuleId, POWER, Bag, CONTACTS,
} from '../data';
import { Inventory, Pool, Stack } from './inventory';
import { YARD, START, CART_AT, FIXED, SCRAP_AT, BLOCKS } from './yard';

// ---------------------------------------------------------------- tuning

export const WOLT_SLOTS = 6;
export const CART_SLOTS = 12;
export const CART_REACH = 3.2;      // m: the cart's slots are usable this close (or hitched)
export const BATTERY = 100;         // Wh, Wolt
export const MODULE_SLOTS = 2;      // at the start; technologies add more
export const RADIUS = 0.3;
export const WALK = 3.2;            // m/s
export const RUN = 1.7;
export const REACH = 1.4;           // m to a thing's edge to use it
export const BUILD_RANGE = 7;       // m from Wolt to where he puts something down
export const CABLE_SEGMENT = 30;    // m at most per cable run
export const DAY_LENGTH = 360;      // s for a whole day and night
export const DRAIN = { base: 0.03, walk: 0.25, run: 0.8, salvage: 1.2, cutter: 2.5, craft: 0.6, light: 0.2, compute: 1.5 } as const;
export const REST_CHARGE = 0.6;     // Wh/s standing still (Q-1 recovers)
export const CRADLE_CHARGE = 5;     // Wh/s on a powered charging cradle
export const COMPUTE_MIN = 0.5;     // Wolt computes only above this battery fraction
export const RECYCLE_TIME = 5;      // s per mixed scrap

// ---------------------------------------------------------------- state types

export interface Scrap { id: string; kind: ScrapKind; o: Obstacle; rounds: number; rot: number }

export interface Building {
  id: string;
  kind: BuildKind;
  x: number; y: number; w: number; h: number;
  o: Obstacle;
  /** Where cables plug in (just outside the footprint, south side). */
  port: V2;
  on: boolean;
  /** Wh stored (battery store). */
  stored: number;
  /** Repaired (the old turbine starts broken). */
  ok: boolean;
  /** Recycler: mixed scrap waiting, progress on the current piece. */
  hopper: number;
  work: number;
  /** Power right now, + produces / − uses (W). */
  watts: number;
}

export interface Link { id: string; a: string; b: string; cable: Cable; metres: number }
export interface Held { from: string; cable: Cable }
export interface Drop { id: string; pos: V2; items: Stack[] }
export interface Cart extends Load { repaired: boolean; inv: Inventory }

export type Target =
  | { kind: 'ground'; at: V2 }
  | { kind: 'scrap'; s: Scrap }
  | { kind: 'build'; b: Building }
  | { kind: 'cart' }
  | { kind: 'drop'; d: Drop }
  | { kind: 'self' };

export type ActionId = 'walk' | 'salvage' | 'grab' | 'plug' | 'unplug' | 'cancelCable' | 'toggle' | 'pickup' | 'repair' | 'hitch' | 'unhitch'
  | 'bench' | 'feed' | 'dock' | 'listen' | 'take' | 'light';
export interface Action { id: ActionId; label: string; ok: boolean; why?: string }
export interface Flow { label: string; rate: number }
export interface Toast { text: string; t: number }
export type GameEvent = 'salvage' | 'craft' | 'deny' | 'grab' | 'plug' | 'unplug' | 'build' | 'research' | 'hook' | 'unhook' | 'light' | 'charged' | 'radio' | 'module' | 'reel';

export interface NetInfo extends NetworkState {
  id: number;
  stored: number;
  capacity: number;
  /** 0..1 how much of the demand is met (batteries included). */
  supply: number;
}

let uid = 0;
const nid = (p: string) => `${p}${++uid}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ceil = Math.ceil;

/**
 * The crafting tech demo: Wolt in a ruined yard with a tiny inventory, a cart, a
 * workbench, scrap to take apart, a technology tree that Q-1 computes on spare power,
 * machines and cables that make a grid, modules for Wolt's own body and a radio mast.
 * Pure logic, no rendering; the 3D view and the HUD only read it.
 */
export class CraftGame {
  readonly world: World;
  readonly wind = new Wind(19, { dir: Math.PI * 0.9, speed: 6 });
  time = 0;
  /** 0..1 over a day; 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  day = 0.3;
  timeScale = 1;
  /** Free crafting and building, for trying things out. */
  sandbox = false;

  pos: V2 = { ...START };
  facing = -Math.PI / 2;
  speed = 0;
  energy = 70;
  light = false;
  moving = false;
  strain = false;
  private stillT = 0;
  private stopIn = Infinity;
  flows: Flow[] = [];
  energyRate = 0;

  readonly inv = new Inventory(WOLT_SLOTS);
  readonly cart: Cart = { id: 'cart', kind: 'cart', pos: { ...CART_AT }, angle: 0.4, repaired: false, inv: new Inventory(CART_SLOTS, true) };
  hitched = false;
  private towTaut = false;

  scrap: Scrap[] = [];
  buildings: Building[] = [];
  links: Link[] = [];
  held: Held | null = null;
  drops: Drop[] = [];
  networks: NetInfo[] = [];
  private netOf = new Map<string, NetInfo>();

  techs = new Set<TechId>(['hand']);
  research: TechId | null = null;
  progress: Partial<Record<TechId, number>> = {};
  obs = new Set<ObsId>();
  modules: ModuleId[] = [];
  computeRate = 0;

  craftJob: { r: Recipe; t: number; total: number; left: number } | null = null;
  salvage: { s: Scrap; t: number } | null = null;
  order: { target: Target; action: ActionId; path: V2[]; working: boolean; stuck: number; last: V2 | null } | null = null;
  /** Something picked to put down (an item id of a building in the pool). */
  placing: BuildingId | null = null;

  radio = { listening: false, t: 0, heard: 0 };
  docked = false;
  stage = 0;
  stats = { salvaged: 0, crafted: 0, built: 0 };

  toasts: Toast[] = [];
  events: GameEvent[] = [];
  /** Things the view should drop from the scene. */
  removed: Obstacle[] = [];

  constructor() {
    uid = 0;
    const obstacles: Obstacle[] = [];
    for (const b of BLOCKS) obstacles.push({ kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h, name: b.model });
    this.world = new World(YARD.width, YARD.height, obstacles);
    for (const s of SCRAP_AT) this.addScrap(s.kind, s.x, s.y, s.rot ?? 0);
    for (const f of FIXED) {
      const b = this.addBuilding(f.kind, f.x, f.y);
      if (f.kind === 'oldturbine') b.ok = false;
    }
  }

  // ---------------------------------------------------------------- setup helpers

  addScrap(kind: ScrapKind, x: number, y: number, rot = 0): Scrap {
    const d = SCRAP[kind];
    const turned = Math.abs(Math.sin(rot)) > 0.7;
    const w = turned ? d.h : d.w, h = turned ? d.w : d.h;
    const o: Obstacle = { kind: kind === 'barrel' ? 'barrel' : 'scrap', x, y, w, h, loot: {}, name: d.name, desc: d.desc };
    const s: Scrap = { id: nid('s'), kind, o, rounds: d.rounds, rot };
    // hidden things do not block: Wolt rolls over a buried cable
    if (!d.hidden) this.world.add(o);
    this.scrap.push(s);
    return s;
  }

  addBuilding(kind: BuildKind, x: number, y: number): Building {
    const d = BUILD[kind];
    const o: Obstacle = { kind: 'container', x, y, w: d.w, h: d.h, name: kind };
    // the splitter is small enough to roll around; it does not block the grid
    if (kind !== 'splitter') this.world.add(o);
    const port = kind === 'splitter' ? { x: x + 0.5, y: y + 0.5 } : { x: x + d.w / 2, y: y + d.h + 0.35 };
    const b: Building = { id: nid(kind), kind, x, y, w: d.w, h: d.h, o, port, on: true, stored: 0, ok: true, hopper: 0, work: 0, watts: 0 };
    this.buildings.push(b);
    return b;
  }

  /** Wolt plus the cart when it is hitched or close. */
  pool(): Pool { return new Pool(this.cartNear() ? [this.inv, this.cart.inv] : [this.inv]); }
  cartNear(): boolean { return this.cart.repaired && (this.hitched || dist(this.cart.pos, this.pos) < CART_REACH); }
  have(id: ItemId) { return this.pool().count(id); }
  hasTool(id: ItemId) { return this.sandbox || this.have(id) > 0; }

  /** Give items: into Wolt / the cart, the rest drops at Wolt's feet in a bundle. */
  give(id: ItemId, n: number): number {
    const p = this.cart.repaired && (this.hitched || dist(this.cart.pos, this.pos) < CART_REACH) ? this.pool() : new Pool([this.inv]);
    const left = p.give(id, n);
    if (left > 0) this.dropAt(this.pos, id, left);
    return left;
  }

  dropAt(at: V2, id: ItemId, n: number) {
    let d = this.drops.find(x => dist(x.pos, at) < 1.2);
    if (!d) { d = { id: nid('d'), pos: { x: at.x + 0.6, y: at.y + 0.5 }, items: [] }; this.drops.push(d); }
    const s = d.items.find(x => x.id === id);
    if (s) s.n += n; else d.items.push({ id, n });
  }

  moduleSlots(): number {
    let n = MODULE_SLOTS;
    for (const t of this.techs) n += TECHS[t].slots ?? 0;
    return n;
  }
  hasModule(m: ModuleId) { return this.modules.includes(m); }
  battery(): number { return BATTERY + (this.hasModule('m_cells') ? 100 : 0); }
  energyPct() { return this.energy / this.battery(); }
  empty() { return this.energy <= 0.05; }

  toast(text: string) { this.toasts.push({ text, t: this.time }); if (this.toasts.length > 6) this.toasts.shift(); }
  deny(text: string) { this.toast(text); this.events.push('deny'); }

  // ---------------------------------------------------------------- day and sun

  /** 0..1 sunlight. */
  sun(): number { return Math.max(0, Math.sin((this.day - 0.25) * Math.PI * 2)); }
  isNight(): boolean { return this.sun() < 0.08; }
  clock(): string {
    const m = Math.floor(this.day * 24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- crafting

  recipeKnown(r: Recipe) { return this.sandbox || !r.tech || this.techs.has(r.tech); }
  nearBench(): boolean {
    const b = this.buildings.find(x => x.kind === 'bench');
    return !!b && World.distToRect(this.pos, b.o) < REACH + 0.6;
  }
  benchPowered(): boolean {
    const b = this.buildings.find(x => x.kind === 'bench');
    return !!b && (this.netOf.get(b.id)?.supply ?? 0) > 0.99;
  }

  /** Why a recipe cannot be made now, or null. */
  whyNot(r: Recipe, times = 1): string | null {
    if (!this.recipeKnown(r)) return tr(`wymaga technologii: ${TECHS[r.tech!].name}`, `needs the technology: ${TECHS[r.tech!].name}`);
    if (r.where === 'bench' && !this.nearBench()) return tr('tylko przy stole warsztatowym', 'only at the workbench');
    if (r.tool && !this.hasTool(r.tool)) return tr(`potrzebne narzędzie: ${ITEMS[r.tool].name}`, `needs a tool: ${ITEMS[r.tool].name}`);
    if (!this.sandbox && !this.pool().has(r.in, times)) return tr('brakuje materiałów', 'missing materials');
    if (ITEMS[r.out].big && !this.cart.repaired) return tr('za duże dla Wolta: potrzebny wózek', 'too big for Wolt: needs the cart');
    if (this.craftJob) return tr('Wolt już coś robi', 'Wolt is busy making something');
    return null;
  }

  craft(r: Recipe, times = 1): boolean {
    const why = this.whyNot(r);
    if (why) { this.deny(cap(why) + '.'); return false; }
    if (!this.sandbox) this.pool().take(r.in);
    const speed = r.where === 'bench' && this.benchPowered() ? 2 : 1;
    const total = r.time / speed;
    this.craftJob = { r, t: 0, total, left: times - 1 };
    return true;
  }

  cancelCraft() {
    if (!this.craftJob) return;
    if (!this.sandbox) for (const [id, n] of Object.entries(this.craftJob.r.in) as [ItemId, number][]) this.give(id, n);
    this.craftJob = null;
  }

  private updateCraft(dt: number) {
    const j = this.craftJob;
    if (!j) return;
    if (j.r.where === 'bench' && !this.nearBench()) return; // paused while away
    if (this.empty() && !this.benchPowered()) return;
    j.t += dt;
    if (j.t < j.total) return;
    this.give(j.r.out, j.r.n);
    this.stats.crafted++;
    this.toast(tr(`Gotowe: ${ITEMS[j.r.out].name}${j.r.n > 1 ? ` ×${j.r.n}` : ''}.`, `Done: ${ITEMS[j.r.out].name}${j.r.n > 1 ? ` ×${j.r.n}` : ''}.`));
    this.events.push('craft');
    this.craftJob = null;
    if (j.left > 0 && !this.whyNot(j.r)) this.craft(j.r, j.left);
  }

  // ---------------------------------------------------------------- research

  techState(t: TechId): 'done' | 'active' | 'ready' | 'locked' {
    if (this.techs.has(t)) return 'done';
    if (this.research === t) return 'active';
    const d = TECHS[t];
    return d.needs.every(n => this.techs.has(n)) && d.obs.every(o => this.obs.has(o)) ? 'ready' : 'locked';
  }

  startResearch(t: TechId) {
    const st = this.techState(t);
    if (st === 'done' || st === 'active') return;
    if (st === 'locked' && !this.sandbox) {
      const d = TECHS[t];
      const miss = [...d.needs.filter(n => !this.techs.has(n)).map(n => TECHS[n].name), ...d.obs.filter(o => !this.obs.has(o)).map(o => OBS[o])];
      this.deny(tr(`Jeszcze nie: brakuje ${miss.join(', ')}.`, `Not yet: missing ${miss.join(', ')}.`));
      return;
    }
    this.research = t;
    this.toast(tr(`Q-1 liczy: ${TECHS[t].name}. Liczy tylko przy baterii powyżej ${COMPUTE_MIN * 100}%.`, `Q-1 is computing: ${TECHS[t].name}. It computes only with the battery above ${COMPUTE_MIN * 100}%.`));
  }

  completeTech(t: TechId) {
    if (this.techs.has(t)) return;
    this.techs.add(t);
    if (this.research === t) this.research = null;
    this.events.push('research');
  }

  private updateResearch(dt: number) {
    this.computeRate = 0;
    const t = this.research;
    if (!t) return;
    // Q-1 computes on spare power only: Wolt's battery above half (or the sandbox)
    if (!this.sandbox && this.energyPct() < COMPUTE_MIN) return;
    const rate = DRAIN.compute * (this.hasModule('m_ai') ? 2 : 1) * (this.sandbox ? 10 : 1);
    this.computeRate = rate;
    this.progress[t] = (this.progress[t] ?? 0) + rate * dt;
    if (this.progress[t]! >= TECHS[t].cost) {
      this.completeTech(t);
      this.toast(tr(`Q-1 skończył liczyć: ${TECHS[t].name}. Nowe przepisy w wytwarzaniu.`, `Q-1 finished computing: ${TECHS[t].name}. New recipes in crafting.`));
    }
  }

  // ---------------------------------------------------------------- Wolt's modules

  install(m: ModuleId) {
    if (this.modules.includes(m)) return;
    if (this.modules.length >= this.moduleSlots()) { this.deny(tr('Brak wolnych gniazd modułów.', 'No free module slots.')); return; }
    if (!this.sandbox && this.have(m) < 1) { this.deny(tr('Najpierw wytwórz ten moduł.', 'Make this module first.')); return; }
    if (!this.sandbox) this.pool().take({ [m]: 1 });
    this.modules.push(m);
    this.events.push('module');
    this.toast(tr(`Zamontowano: ${ITEMS[m].name}.`, `Fitted: ${ITEMS[m].name}.`));
    if (m === 'm_ai') {
      const hidden = this.scrap.filter(s => SCRAP[s.kind].hidden);
      if (hidden.length) this.toast(tr('Q-1 czuje słaby prąd w ziemi na południowym zachodzie.', 'Q-1 senses a faint current in the ground to the south-west.'));
    }
  }

  uninstall(m: ModuleId) {
    const i = this.modules.indexOf(m);
    if (i < 0) return;
    this.modules.splice(i, 1);
    if (m === 'm_cells') this.energy = Math.min(this.energy, this.battery());
    if (!this.sandbox) this.give(m, 1);
    this.events.push('module');
  }

  // ---------------------------------------------------------------- placing buildings

  /** Can `kind` go with its corner at (x, y)? */
  canPlace(kind: BuildingId, x: number, y: number): string | null {
    const d = BUILD[kind];
    if (x < 1 || y < 1 || x + d.w > YARD.width - 1 || y + d.h > YARD.height - 1) return tr('poza placem', 'outside the yard');
    for (let j = y; j < y + d.h; j++) for (let i = x; i < x + d.w; i++) if (this.world.isBlocked(i, j)) return tr('zajęte miejsce', 'the spot is taken');
    for (const b of this.buildings) if (b.kind === 'splitter' && b.x >= x && b.x < x + d.w && b.y >= y && b.y < y + d.h) return tr('zajęte miejsce', 'the spot is taken');
    const c = { x: x + d.w / 2, y: y + d.h / 2 };
    const r = Math.max(d.w, d.h) / 2;
    if (dist(c, this.pos) < r + RADIUS + 0.1 && kind !== 'splitter') return tr('Wolt stoi na drodze', 'Wolt is in the way');
    if (dist(c, this.cart.pos) < r + 0.7) return tr('wózek stoi na drodze', 'the cart is in the way');
    if (dist(c, this.pos) > BUILD_RANGE) return tr('za daleko od Wolta', 'too far from Wolt');
    if (!this.sandbox && this.have(kind) < 1) return tr('nie masz tego', 'you do not have one');
    return null;
  }

  place(kind: BuildingId, x: number, y: number): Building | null {
    const why = this.canPlace(kind, x, y);
    if (why) { this.deny(cap(why) + '.'); return null; }
    if (!this.sandbox) this.pool().take({ [kind]: 1 });
    const b = this.addBuilding(kind, x, y);
    if (kind === 'battery') b.stored = 0;
    this.stats.built++;
    this.events.push('build');
    this.toast(tr(`Postawiono: ${BUILD[kind].name}.`, `Built: ${BUILD[kind].name}.`));
    if (!this.sandbox && this.have(kind) < 1) this.placing = null;
    return b;
  }

  /** Take a building back down: cables come back as metres, the thing as an item. */
  pickup(b: Building) {
    if (b.kind === 'bench' || b.kind === 'oldturbine') return;
    for (const l of this.links.filter(l => l.a === b.id || l.b === b.id)) this.removeLink(l);
    if (this.held?.from === b.id) this.held = null;
    if (b.kind !== 'splitter') this.world.remove(b.o);
    this.removed.push(b.o);
    this.buildings = this.buildings.filter(x => x !== b);
    if (!this.sandbox) this.give(b.kind as ItemId, 1);
    this.toast(tr(`Rozebrano: ${BUILD[b.kind].name}. Wraca do ekwipunku.`, `Taken down: ${BUILD[b.kind].name}. Back in the inventory.`));
    this.events.push('unplug');
  }

  // ---------------------------------------------------------------- cables

  sockets(b: Building) { return this.links.filter(l => l.a === b.id || l.b === b.id).length + (this.held?.from === b.id ? 1 : 0); }
  freeSocket(b: Building) { return this.sockets(b) < BUILD[b.kind].sockets; }

  /** Metres of cable the held run may use. */
  cableMax(): number { return Math.min(CABLE_SEGMENT, this.sandbox ? CABLE_SEGMENT : this.have('cable')); }
  heldLength(): number { return this.held ? this.held.cable.length() : 0; }

  grab(b: Building) {
    if (this.held) return;
    if (!this.freeSocket(b)) { this.deny(tr('Wszystkie gniazda zajęte.', 'All sockets are taken.')); return; }
    if (this.cableMax() < 1) { this.deny(tr('Nie masz kabla. Wytwórz go z miedzi i plastiku (C).', 'You have no cable. Make some from copper and plastic (C).')); return; }
    const c = new Cable(b.port, b.port);
    c.moveEnd(this.world, this.pos);
    this.held = { from: b.id, cable: c };
    this.events.push('grab');
  }

  plug(b: Building) {
    const h = this.held;
    if (!h || h.from === b.id) return;
    if (!this.freeSocket(b)) { this.deny(tr('Wszystkie gniazda zajęte.', 'All sockets are taken.')); return; }
    if (this.links.some(l => (l.a === h.from && l.b === b.id) || (l.b === h.from && l.a === b.id))) { this.deny(tr('Te dwie rzeczy już są połączone.', 'These two are already connected.')); return; }
    const c = h.cable.clone();
    c.moveEnd(this.world, b.port);
    const m = ceil(c.length());
    if (m > this.cableMax()) { this.deny(tr(`Za mało kabla: trzeba ${m} m.`, `Not enough cable: ${m} m needed.`)); return; }
    if (!this.sandbox) this.pool().take({ cable: m });
    this.links.push({ id: nid('l'), a: h.from, b: b.id, cable: c, metres: m });
    this.held = null;
    this.events.push('plug');
    this.toast(tr(`Połączono kablem ${m} m: ${this.nameOf(h.from)} ↔ ${BUILD[b.kind].name}.`, `Connected with ${m} m of cable: ${this.nameOf(h.from)} ↔ ${BUILD[b.kind].name}.`));
  }

  removeLink(l: Link) {
    this.links = this.links.filter(x => x !== l);
    if (!this.sandbox) this.give('cable', l.metres);
  }

  unplugAll(b: Building) {
    const ls = this.links.filter(l => l.a === b.id || l.b === b.id);
    for (const l of ls) this.removeLink(l);
    if (ls.length) { this.events.push('reel'); this.toast(tr(`Zwinięto ${ls.reduce((s, l) => s + l.metres, 0)} m kabla.`, `Reeled in ${ls.reduce((s, l) => s + l.metres, 0)} m of cable.`)); }
  }

  nameOf(id: string) { const b = this.buildings.find(x => x.id === id); return b ? BUILD[b.kind].name : '?'; }

  private constrainByCable(cand: V2): V2 {
    const h = this.held!;
    const max = this.cableMax();
    const t = h.cable.clone();
    t.moveEnd(this.world, cand);
    if (t.length() <= max) { h.cable = t; return cand; }
    const r = max - t.baseLength();
    if (r > 0.05) {
      const slid = add(t.last, scale(norm(sub(cand, t.last)), r - 1e-3));
      if (!this.world.circleBlocked(slid, RADIUS)) {
        const t2 = h.cable.clone();
        t2.moveEnd(this.world, slid);
        if (t2.length() <= max + 1e-3) { h.cable = t2; return slid; }
      }
    }
    return this.pos;
  }

  // ---------------------------------------------------------------- the cart

  repairCart() {
    if (this.cart.repaired) return;
    const need: Bag = { bearings: 2, iron: 2 };
    if (!this.sandbox && !new Pool([this.inv]).has(need)) { this.deny(tr('Do naprawy wózka: 2 łożyska i 2 żelaza.', 'To fix the cart: 2 bearings and 2 iron.')); return; }
    if (!this.sandbox) new Pool([this.inv]).take(need);
    this.cart.repaired = true;
    this.events.push('craft');
    this.toast(tr('Wózek naprawiony: +12 miejsc. Doczep go (E), żeby jeździł z Woltem.', 'Cart fixed: +12 slots. Hitch it (E) so it goes with Wolt.'));
  }

  hitch() {
    if (!this.cart.repaired) { this.deny(tr('Wózek ma zatarte koła. Napraw go.', 'The cart\'s wheels are seized. Fix it.')); return; }
    this.hitched = true; this.events.push('hook');
    this.toast(tr('Wózek doczepiony: jego miejsca są pod ręką.', 'Cart hitched: its slots are at hand.'));
  }
  unhitch() { this.hitched = false; this.events.push('unhook'); }

  // ---------------------------------------------------------------- targets and actions

  targetAt(p: V2): Target {
    for (const b of this.buildings) if (p.x >= b.x - 0.1 && p.x <= b.x + b.w + 0.1 && p.y >= b.y - 0.1 && p.y <= b.y + b.h + 0.1) return { kind: 'build', b };
    for (const s of this.scrap) if (this.visible(s) && p.x >= s.o.x && p.x <= s.o.x + s.o.w && p.y >= s.o.y && p.y <= s.o.y + s.o.h) return { kind: 'scrap', s };
    if (dist(p, this.cart.pos) < 0.9) return { kind: 'cart' };
    for (const d of this.drops) if (dist(p, d.pos) < 0.6) return { kind: 'drop', d };
    if (dist(p, this.pos) < 0.5) return { kind: 'self' };
    return { kind: 'ground', at: p };
  }

  visible(s: Scrap) { return !SCRAP[s.kind].hidden || this.hasModule('m_ai') || this.sandbox; }

  salvageTime(s: Scrap): number {
    const d = SCRAP[s.kind];
    return d.time * (this.hasModule('m_arm') ? 0.6 : 1);
  }

  actionsFor(t: Target): Action[] {
    const A = (id: ActionId, label: string, why: string | null = null): Action => ({ id, label, ok: !why, why: why ?? undefined });
    switch (t.kind) {
      case 'ground': return [A('walk', tr('Jedź tutaj', 'Drive here'))];
      case 'self': return [A('light', this.light ? tr('Zgaś światło', 'Light off') : tr('Zapal światło', 'Light on'))];
      case 'drop': return [A('take', tr('Zabierz', 'Pick up'))];
      case 'scrap': {
        const d = SCRAP[t.s.kind];
        const why = d.tool && !this.hasTool(d.tool) ? tr(`potrzebne: ${ITEMS[d.tool].name}`, `needs: ${ITEMS[d.tool].name}`) : this.held ? tr('ramię trzyma kabel', 'the arm holds a cable') : null;
        return [A('salvage', tr('Rozbierz', 'Salvage'), why)];
      }
      case 'cart': {
        if (!this.cart.repaired) return [A('repair', tr('Napraw wózek (2 łożyska, 2 żelaza)', 'Fix the cart (2 bearings, 2 iron)'), this.sandbox || new Pool([this.inv]).has({ bearings: 2, iron: 2 }) ? null : tr('brakuje części', 'missing parts'))];
        return [this.hitched ? A('unhitch', tr('Odczep wózek', 'Unhitch the cart')) : A('hitch', tr('Doczep wózek', 'Hitch the cart'))];
      }
      case 'build': {
        const b = t.b, d = BUILD[b.kind];
        const list: Action[] = [];
        if (this.held) {
          if (this.held.from === b.id) list.push(A('cancelCable', tr('Zwiń trzymany kabel', 'Reel in the held cable')));
          else list.push(A('plug', tr('Wepnij kabel', 'Plug the cable in'), this.freeSocket(b) ? null : tr('gniazda zajęte', 'sockets taken')));
        } else if (b.ok) list.push(A('grab', tr(`Weź kabel z gniazda (${this.sockets(b)}/${d.sockets})`, `Take a cable from a socket (${this.sockets(b)}/${d.sockets})`), this.freeSocket(b) ? (this.cableMax() < 1 ? tr('brak kabla', 'no cable') : null) : tr('gniazda zajęte', 'sockets taken')));
        if (b.kind === 'bench') list.unshift(A('bench', tr('Stół warsztatowy: wytwarzanie', 'Workbench: crafting')));
        if (b.kind === 'oldturbine' && !b.ok) list.unshift(A('repair', tr('Napraw turbinę (silnik, 2 łożyska)', 'Fix the turbine (motor, 2 bearings)'), this.sandbox || this.pool().has({ motor: 1, bearings: 2 }) ? null : tr('brakuje części', 'missing parts')));
        if (b.kind === 'recycler') list.unshift(A('feed', tr(`Wsyp złom mieszany (${this.have('scrapmix')})`, `Load mixed scrap (${this.have('scrapmix')})`), this.have('scrapmix') > 0 ? null : tr('brak złomu mieszanego', 'no mixed scrap')));
        if (b.kind === 'charger') list.unshift(A('dock', tr('Wjedź do kołyski', 'Roll onto the cradle')));
        if (b.kind === 'mast') list.unshift(A('listen', this.radio.listening ? tr('Przerwij nasłuch', 'Stop listening') : tr('Nasłuchuj', 'Listen'), this.hasModule('m_radio') ? null : tr('wymaga modułu radiowego', 'needs the radio module')));
        if (d.switchable && b.ok) list.push(A('toggle', b.on ? tr('Wyłącz', 'Switch off') : tr('Włącz', 'Switch on')));
        if (this.links.some(l => l.a === b.id || l.b === b.id)) list.push(A('unplug', tr('Odłącz i zwiń kable', 'Unplug and reel in cables')));
        if (b.kind !== 'bench' && b.kind !== 'oldturbine') list.push(A('pickup', tr('Rozbierz i zabierz', 'Take it down')));
        return list;
      }
    }
  }

  command(t: Target, a: ActionId) {
    if (a === 'light') { this.toggleLight(); return; }
    // remote control: switch machines without driving there
    if (a === 'toggle' && t.kind === 'build' && this.canRemote(t.b)) { this.doAction(t, a); return; }
    const goal = this.goalOf(t);
    const path = findPath(this.world, this.pos, goal, RADIUS) ?? [goal];
    this.order = { target: t, action: a, path, working: false, stuck: 0, last: null };
  }

  /** With the remote module, any machine on a grid Wolt is near (or the whole yard) is in reach. */
  canRemote(b: Building) { return this.hasModule('m_remote') && (this.netOf.get(b.id)?.nodes.length ?? 0) > 1; }

  private goalOf(t: Target): V2 {
    switch (t.kind) {
      case 'ground': return t.at;
      case 'scrap': return { x: t.s.o.x + t.s.o.w / 2, y: t.s.o.y + t.s.o.h / 2 };
      case 'build': return t.b.kind === 'charger' ? { x: t.b.x + 1, y: t.b.y + 1 } : t.b.port;
      case 'cart': return this.cart.pos;
      case 'drop': return t.d.pos;
      case 'self': return this.pos;
    }
  }

  private remaining(t: Target, a: ActionId): number {
    switch (t.kind) {
      case 'ground': return dist(this.pos, t.at) - 0.15;
      case 'scrap': return World.distToRect(this.pos, t.s.o) - REACH;
      case 'build':
        if (a === 'dock') return dist(this.pos, this.goalOf(t)) - 0.3;
        if (a === 'plug' || a === 'grab') return dist(this.pos, t.b.port) - REACH;
        return World.distToRect(this.pos, t.b.o) - REACH;
      case 'cart': return this.hitched ? 0 : dist(this.pos, this.cart.pos) - 0.7 - TOW_RANGE + 0.3;
      case 'drop': return dist(this.pos, t.d.pos) - 1;
      case 'self': return 0;
    }
  }

  private followOrder(dt: number): V2 | null {
    const o = this.order!;
    if (o.target.kind === 'scrap' && !this.scrap.includes(o.target.s)) { this.order = null; return null; }
    if (o.target.kind === 'build' && !this.buildings.includes(o.target.b)) { this.order = null; return null; }
    const rem = this.remaining(o.target, o.action);
    if (rem <= 0) {
      if (o.action === 'walk') { this.order = null; return null; }
      if (o.action === 'salvage') {
        o.working = true;
        const c = this.goalOf(o.target);
        if (this.speed < 0.3) turnTowards(this, Math.atan2(c.y - this.pos.y, c.x - this.pos.x), dt);
        return null;
      }
      this.order = null;
      this.doAction(o.target, o.action);
      return null;
    }
    if (o.last && dist(o.last, this.pos) < WALK * 0.2 * dt) o.stuck += dt; else o.stuck = 0;
    o.last = { ...this.pos };
    if (o.stuck > 1.2) {
      this.order = null;
      this.deny(this.held ? tr('Kabel nie sięga dalej.', "The cable won't reach any further.") : tr('Wolt nie znajduje drogi.', "Wolt can't find a way."));
      return null;
    }
    while (o.path.length > 1 && dist(this.pos, o.path[0]) < 0.3) o.path.shift();
    const wp = o.path[0] ?? this.goalOf(o.target);
    if (o.path.length <= 1) this.stopIn = Math.max(0, rem);
    const d = sub(wp, this.pos);
    const l = len(d);
    return l < 1e-3 ? null : scale(d, 1 / l);
  }

  doAction(t: Target, a: ActionId) {
    const act = this.actionsFor(t).find(x => x.id === a);
    if (act && !act.ok) { this.deny(cap(act.why ?? '') + '.'); return; }
    switch (a) {
      case 'light': this.toggleLight(); return;
      case 'take': if (t.kind === 'drop') this.takeDrop(t.d); return;
      case 'repair':
        if (t.kind === 'cart') this.repairCart();
        else if (t.kind === 'build') this.repairTurbine(t.b);
        return;
      case 'hitch': this.hitch(); return;
      case 'unhitch': this.unhitch(); return;
      default: break;
    }
    if (t.kind !== 'build') return;
    const b = t.b;
    switch (a) {
      case 'grab': this.grab(b); return;
      case 'plug': this.plug(b); return;
      case 'cancelCable': this.held = null; this.events.push('reel'); return;
      case 'unplug': this.unplugAll(b); return;
      case 'toggle': b.on = !b.on; this.events.push('light'); if (b.kind === 'mast' && !b.on) this.radio.listening = false; return;
      case 'pickup': this.pickup(b); return;
      case 'feed': {
        const n = this.have('scrapmix');
        this.pool().take({ scrapmix: n });
        b.hopper += n;
        this.toast(tr(`Wsypano ${n} złomu mieszanego.`, `Loaded ${n} mixed scrap.`));
        return;
      }
      case 'dock': this.docked = true; return;
      case 'listen':
        this.radio.listening = !this.radio.listening;
        if (this.radio.listening) this.toast(tr('Nasłuch: Q-1 przeszukuje pasma. Maszt musi mieć prąd.', 'Listening: Q-1 sweeps the bands. The mast needs power.'));
        return;
      default: return;
    }
  }

  repairTurbine(b: Building) {
    if (b.ok) return;
    if (!this.sandbox && !this.pool().has({ motor: 1, bearings: 2 })) { this.deny(tr('Do turbiny: silnik i 2 łożyska.', 'For the turbine: a motor and 2 bearings.')); return; }
    if (!this.sandbox) this.pool().take({ motor: 1, bearings: 2 });
    b.ok = true;
    this.events.push('craft');
    this.toast(tr('Stara turbina się kręci. Podłącz ją kablem do stołu warsztatowego.', 'The old turbine turns. Connect it to the workbench with a cable.'));
  }

  takeDrop(d: Drop) {
    const keep: Stack[] = [];
    const p = this.pool();
    for (const s of d.items) { const left = p.give(s.id, s.n); if (left) keep.push({ id: s.id, n: left }); }
    d.items = keep;
    if (!keep.length) this.drops = this.drops.filter(x => x !== d);
    else this.deny(tr('Nie wszystko się zmieściło.', 'Not everything fitted.'));
  }

  /** Drop a slot's contents on the ground next to Wolt. */
  dropSlot(inv: Inventory, i: number) {
    const s = inv.slots[i];
    if (!s) return;
    inv.slots[i] = null;
    this.dropAt(inv === this.cart.inv ? this.cart.pos : this.pos, s.id, s.n);
  }

  /** Move a slot between Wolt and the cart. */
  moveSlot(from: Inventory, i: number) {
    const s = from.slots[i];
    if (!s || !this.cartNear()) return;
    const to = from === this.inv ? this.cart.inv : this.inv;
    const left = to.add(s.id, s.n);
    if (left === s.n) { this.deny(tr('Tam się nie zmieści.', 'It won\'t fit there.')); return; }
    if (left) s.n = left; else from.slots[i] = null;
  }

  toggleLight() {
    if (!this.light && this.empty()) { this.deny(tr('Za mało energii na światło.', 'Not enough energy for the light.')); return; }
    this.light = !this.light;
    this.events.push('light');
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number, move: V2, run: boolean, use: boolean) {
    const sdt = dt * this.timeScale;
    this.time += dt;
    this.day = (this.day + sdt / DAY_LENGTH) % 1;
    this.wind.update(dt);
    this.stopIn = Infinity;
    let m = move;
    if (len(m) > 0.01) { this.order = null; this.docked = false; }
    else if (this.order) m = this.followOrder(dt) ?? { x: 0, y: 0 };
    this.drive(dt, m, run);
    if (this.docked && !this.onCradle()) this.docked = false;
    this.updateSalvage(dt, use);
    this.updateCraft(sdt);
    this.solve();
    this.updateMachines(sdt);
    this.updateEnergy(dt);
    this.updateResearch(sdt);
    this.updateRadio(sdt);
    this.toasts = this.toasts.filter(t => this.time - t.t < 5);
  }

  private running = false;

  private drive(dt: number, move: V2, run: boolean) {
    const want = len(move) > 0.01;
    this.strain = false;
    this.running = want && run && !this.empty();
    let max = WALK * (this.running ? RUN : 1);
    if (this.empty()) max *= 0.4;
    if (this.hitched) max *= 0.85;
    const step = drive(this, dt, want ? move : { x: 0, y: 0 }, max, undefined, this.stopIn);
    const intended = len(step);
    if (intended < 1e-6) { this.moving = false; return; }
    let cand = { ...this.pos };
    const tx = { x: cand.x + step.x, y: cand.y };
    if (!this.bumps(tx)) cand = tx;
    const ty = { x: cand.x, y: cand.y + step.y };
    if (!this.bumps(ty)) cand = ty;
    if (this.held) cand = this.constrainByCable(cand);
    if (this.hitched) {
      const r = towDrive(this.world, this.cart, this.pos, cand, this.facing, p => !this.bumps(p));
      this.cart.pos = r.step.pos; this.cart.angle = r.step.angle; this.towTaut = r.step.taut;
      cand = r.pos;
    }
    const moved = dist(cand, this.pos);
    settle(this, moved, dt);
    this.moving = moved > 1e-5;
    this.strain = want && moved < intended * 0.35;
    this.pos = cand;
  }

  get cartTaut() { return this.towTaut; }

  private bumps(p: V2): boolean {
    if (this.world.circleBlocked(p, RADIUS)) return true;
    if (!this.hitched) {
      const r = 0.7 + RADIUS;
      if (dist(p, this.cart.pos) < r && dist(p, this.cart.pos) < dist(this.pos, this.cart.pos)) return true;
    }
    return false;
  }

  private updateSalvage(dt: number, use: boolean) {
    let s: Scrap | null = null;
    const o = this.order;
    if (o && o.working && o.action === 'salvage' && o.target.kind === 'scrap') s = o.target.s;
    else if (use && !this.held) s = this.nearestScrap();
    if (s) {
      const d = SCRAP[s.kind];
      if (d.tool && !this.hasTool(d.tool)) { this.deny(tr(`Do tego potrzebne: ${ITEMS[d.tool].name}.`, `This needs: ${ITEMS[d.tool].name}.`)); s = null; if (o?.working) this.order = null; }
      else if (this.empty()) { this.deny(tr('Za mało energii, by rozbierać. Postój chwilę.', 'Not enough energy to salvage. Stand still for a while.')); s = null; if (o?.working) this.order = null; }
    }
    if (!s) { this.salvage = null; return; }
    if (!this.salvage || this.salvage.s !== s) this.salvage = { s, t: 0 };
    this.salvage.t += dt;
    if (this.salvage.t < this.salvageTime(s)) return;
    // one round done
    const d = SCRAP[s.kind];
    const got: string[] = [];
    for (const [id, n] of Object.entries(d.loot) as [ItemId, number][]) { this.give(id, n); got.push(`+${n} ${ITEMS[id].name}`); }
    const learnt = d.obs.filter(x => !this.obs.has(x));
    for (const x of learnt) this.obs.add(x);
    s.rounds--;
    this.salvage = null;
    this.stats.salvaged++;
    this.events.push('salvage');
    this.toast(tr(`${cap(d.name)}: ${got.join(', ')}`, `${cap(d.name)}: ${got.join(', ')}`));
    if (learnt.length) this.toast(tr(`Q-1 zapamiętał: ${learnt.map(x => OBS[x]).join('; ')}.`, `Q-1 learnt: ${learnt.map(x => OBS[x]).join('; ')}.`));
    if (s.rounds <= 0) {
      if (!d.hidden) this.world.remove(s.o);
      this.removed.push(s.o);
      this.scrap = this.scrap.filter(x => x !== s);
      if (o?.working) this.order = null;
    }
  }

  nearestScrap(): Scrap | null {
    let best: Scrap | null = null, bd = REACH + 0.2;
    for (const s of this.scrap) { if (!this.visible(s)) continue; const d = World.distToRect(this.pos, s.o); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  onCradle(): boolean {
    return this.buildings.some(b => b.kind === 'charger' && dist(this.pos, { x: b.x + 1, y: b.y + 1 }) < 0.8);
  }

  // ---------------------------------------------------------------- power grid

  private solve() {
    const nodes = this.buildings.map(b => ({ id: b.id, produce: 0, demand: 0 }));
    const edges = this.links.map(l => [l.a, l.b] as [string, string]);
    const sun = this.sun(), wind = Math.min(1, this.wind.strength / 10);
    for (const b of this.buildings) {
      let w = 0;
      if (b.ok && b.on) switch (b.kind) {
        case 'oldturbine': w = POWER.oldTurbine * wind; break;
        case 'solar': w = POWER.solarPeak * sun; break;
        case 'wind': w = POWER.windPeak * wind; break;
        case 'lamp': w = this.isNight() || this.sun() < 0.25 ? -POWER.lamp : 0; break;
        case 'bench': w = this.craftJob && this.craftJob.r.where === 'bench' && this.nearBench() ? -POWER.benchWork : -POWER.benchIdle; break;
        case 'charger': w = this.docked && this.energy < this.battery() - 0.1 ? -POWER.charger : 0; break;
        case 'recycler': w = b.hopper > 0 ? -POWER.recycler : 0; break;
        case 'mast': w = -POWER.mast; break;
        default: break;
      }
      b.watts = w;
      const n = nodes.find(x => x.id === b.id)!;
      if (w > 0) n.produce = w; else n.demand = -w;
    }
    const nets = solveNetworks(nodes, edges);
    const seen = new Map<NetworkState, NetInfo>();
    this.networks = []; this.netOf.clear();
    let k = 0;
    for (const b of this.buildings) {
      const st = nets.get(b.id)!;
      // a lone building is not a grid, unless it makes and uses its own power
      let info = seen.get(st);
      if (!info) {
        const members = this.buildings.filter(x => st.nodes.includes(x.id));
        const stores = members.filter(x => BUILD[x.kind].store);
        info = { ...st, id: ++k, stored: stores.reduce((s, x) => s + x.stored, 0), capacity: stores.reduce((s, x) => s + (x.on ? BUILD[x.kind].store! : 0), 0), supply: 0 };
        info.supply = st.demand <= 0 ? 1 : Math.min(1, (st.production + (info.stored > 1 ? Infinity : 0)) / st.demand);
        seen.set(st, info);
        if (st.nodes.length > 1 || st.production > 0) this.networks.push(info);
      }
      this.netOf.set(b.id, info);
    }
  }

  /** The grid a building is on (with its balance), if any. */
  net(b: Building): NetInfo | undefined { return this.netOf.get(b.id); }
  powered(b: Building): boolean { const n = this.netOf.get(b.id); return !!n && n.supply > 0.99 && b.on && b.ok; }

  private recycled = 0;

  private updateMachines(dt: number) {
    // batteries take the surplus and cover the deficit, shared evenly
    for (const n of this.networks) {
      const stores = this.buildings.filter(b => n.nodes.includes(b.id) && BUILD[b.kind].store && b.on);
      if (!stores.length) continue;
      const wh = n.balance * dt / 3600;
      for (const s of stores) s.stored = Math.max(0, Math.min(BUILD[s.kind].store!, s.stored + wh / stores.length));
    }
    for (const b of this.buildings) {
      if (b.kind === 'recycler' && b.hopper > 0 && this.powered(b)) {
        b.work += dt;
        if (b.work >= RECYCLE_TIME) {
          b.work = 0; b.hopper--;
          // what a piece of mixed scrap breaks into, in turn
          const outs: ItemId[] = ['iron', 'copper', 'plastic', 'iron', 'glass', 'copper', 'electronics', 'iron'];
          const id = outs[this.recycled++ % outs.length];
          this.dropAt({ x: b.x + 1, y: b.y + b.h + 0.3 }, id, 1);
        }
      }
    }
  }

  // ---------------------------------------------------------------- Wolt's battery

  private updateEnergy(dt: number) {
    const busy = this.moving || !!this.salvage || !!this.craftJob;
    this.stillT = busy ? 0 : this.stillT + dt;
    const f: Flow[] = [{ label: tr('czuwanie (układy)', 'standby (systems)'), rate: -DRAIN.base }];
    if (this.moving) f.push({ label: this.running ? tr('bieg', 'running') : tr('jazda', 'driving'), rate: this.running ? -DRAIN.run : -DRAIN.walk });
    if (this.moving && this.hitched) f.push({ label: tr('ciągnie wózek', 'towing the cart'), rate: -0.2 });
    if (this.salvage) {
      const cutter = SCRAP[this.salvage.s.kind].tool === 'cutter';
      f.push({ label: cutter ? tr('przecinarka', 'cutter') : tr('rozbieranie', 'salvaging'), rate: -(cutter ? DRAIN.cutter : DRAIN.salvage) });
    }
    if (this.craftJob && !(this.craftJob.r.where === 'bench' && this.benchPowered())) f.push({ label: tr('wytwarzanie (ramię)', 'crafting (arm)'), rate: -DRAIN.craft });
    if (this.light) f.push({ label: this.hasModule('m_lamp') ? tr('reflektor', 'floodlight') : tr('światło', 'light'), rate: -DRAIN.light * (this.hasModule('m_lamp') ? 1.5 : 1) });
    if (this.computeRate > 0) f.push({ label: tr('obliczenia Q-1', 'Q-1 computing'), rate: -this.computeRate / (this.sandbox ? 10 : 1) });
    if (this.docked) {
      const cr = this.buildings.find(b => b.kind === 'charger' && dist(this.pos, { x: b.x + 1, y: b.y + 1 }) < 0.8);
      if (cr && this.powered(cr)) f.push({ label: tr('kołyska ładująca', 'charging cradle'), rate: CRADLE_CHARGE });
    } else if (this.stillT > 1) f.push({ label: tr('postój (Q-1 się odnawia)', 'resting (Q-1 recovers)'), rate: REST_CHARGE });
    const rate = f.reduce((s, x) => s + x.rate, 0);
    this.flows = f; this.energyRate = rate;
    const before = this.energy;
    this.energy = Math.max(0, Math.min(this.battery(), this.energy + rate * dt));
    if (this.docked && before < this.battery() - 0.1 && this.energy >= this.battery() - 0.1) { this.events.push('charged'); this.toast(tr('Wolt naładowany do pełna.', 'Wolt is fully charged.')); }
    if (this.empty() && this.light) { this.light = false; this.deny(tr('Bateria pusta: światło zgasło.', 'Battery empty: the light went out.')); }
  }

  // ---------------------------------------------------------------- radio

  mastUp(): Building | undefined { return this.buildings.find(b => b.kind === 'mast' && this.powered(b)); }

  private updateRadio(dt: number) {
    if (!this.radio.listening) return;
    if (!this.hasModule('m_radio') || !this.mastUp()) return;
    if (this.radio.heard >= CONTACTS.length) { this.radio.listening = false; return; }
    this.radio.t += dt;
    if (this.radio.t >= 20) {
      this.radio.t = 0;
      const c = CONTACTS[this.radio.heard++];
      this.events.push('radio');
      this.toast(tr(`Radio: ${c.name}.`, `Radio: ${c.name}.`));
    }
  }

  // ---------------------------------------------------------------- readouts

  /** Short state line for a building, for the mouse-over card. */
  status(b: Building): string {
    if (!b.ok) return tr('zepsuta', 'broken');
    if (!b.on) return tr('wyłączona', 'off');
    const n = this.netOf.get(b.id);
    const w = b.watts;
    if (w > 0) return tr(`daje ${Math.round(w)} W`, `gives ${Math.round(w)} W`);
    if (w < 0) return this.powered(b) ? tr(`pobiera ${Math.round(-w)} W`, `draws ${Math.round(-w)} W`) : tr(`brak prądu (potrzeba ${Math.round(-w)} W)`, `no power (needs ${Math.round(-w)} W)`);
    if (BUILD[b.kind].store) return tr(`${Math.round(b.stored)} / ${BUILD[b.kind].store} Wh`, `${Math.round(b.stored)} / ${BUILD[b.kind].store} Wh`);
    return n && n.nodes.length > 1 ? tr('w sieci', 'on the grid') : tr('niepodłączona', 'not connected');
  }

  fmtW(w: number) { return `${w >= 0 ? '+' : '−'}${num(Math.abs(w), 0)} W`; }
}
