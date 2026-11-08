import { V2, add, scale, sub, norm, dist, len } from './vec';
import { World, Obstacle, Material } from './world';
import { Cable } from './cable';
import { LevelDef, PortDef, StationPoint } from './level';
import { PowerNode, solveNetworks, NetworkState } from './power';
import { Wind } from './wind';
import { findPath } from './path';
import { Load, LOADS, towStep, hitchOf, TOW_RANGE } from './tow';

export const CABLE_MAX = 20;      // m per segment
export const CABLE_WARN = 18;     // m, orange + slowdown
export const REEL_CAPACITY = 60;  // m the reel can hold
export const PLAYER_RADIUS = 0.3;
export const INTERACT_RANGE = 1.6;
export const SALVAGE_RANGE = 1.3; // m from Wolt to the pile's edge
export const WALK_SPEED = 3.2;    // m/s
export const RUN_MULT = 1.7;
export const TENSION_SLOW = 0.7;
export const REEL_HOLD = 0.5;     // s to hold Q
export const SALVAGE_TIME = 1.4;  // s per scrap pile
export const CRAFT_TIME = 1.2;    // s per 5 m of cable
export const CABLE_RECIPE = { copper: 1, plastic: 1 } as const;
export const CABLE_PER_CRAFT = 5; // m
/** Game time runs faster while charging: Wh gained per W of surplus per real second. */
export const CHARGE_SPEED = 0.135;
export const DEPART_TIME = 6;     // s of the leaving animation
export const BARREL_SALVAGE_TIME = 2.0;

// Wolt's own battery (the small quantum cell in his chest), in Wh
export const WOLT_BATTERY = 100;
export const WOLT_START = 25;
/** Drain in Wh/s. */
export const DRAIN = { base: 0.03, walk: 0.3, run: 1.0, salvage: 1.5, light: 0.2 } as const;
/** Standing still the cell slowly recovers; by a live port it charges fast. */
export const REST_CHARGE = 0.8;
export const PORT_CHARGE = 4;
export const REST_DELAY = 1.0;    // s of standing before the trickle starts
export const PORT_CHARGE_RANGE = 2.2;
export const EMPTY_SPEED = 0.4;   // speed multiplier on an empty battery
export const LOW_ENERGY = 15;
/** Free loads Wolt bumps into (towed ones follow on the rope instead). */
const LOAD_BUMP = 0.9;

export interface Input {
  move: V2;          // desired direction in world space, length ≤ 1
  run: boolean;
  interact: boolean; // E pressed this frame
  use: boolean;      // E or LMB held (salvage)
  reel: boolean;     // Q held
  aim: V2 | null;    // cursor on the ground
}

export const idle = (): Input => ({ move: { x: 0, y: 0 }, run: false, interact: false, use: false, reel: false, aim: null });

export interface PlacedCable { cable: Cable; from: string; to: string | null }
export interface Hint { text: string; key: string; at: V2; height: number; ok: boolean }
export type CableState = 'none' | 'held' | 'tense' | 'limit';
export type GameEvent = 'hook' | 'unhook' | 'grab' | 'plug' | 'unplug' | 'reel' | 'deny' | 'salvage' | 'craft' | 'charged' | 'depart' | 'win' | 'light';
export type Phase = 'play' | 'departing' | 'done';

/** Something the player can point at with the mouse. */
export type Target =
  | { kind: 'ground'; at: V2 }
  | { kind: 'scrap'; o: Obstacle }
  | { kind: 'port'; id: string }
  | { kind: 'point'; id: StationPoint['id'] }
  | { kind: 'load'; id: string }
  | { kind: 'self' };
export type ActionId = 'tow' | 'untow' | 'walk' | 'salvage' | 'grab' | 'plug' | 'unplug' | 'reel' | 'craft' | 'craftAll' | 'depart' | 'light';
export interface Action { id: ActionId; label: string; ok: boolean; why?: string }
interface Order { target: Target; action: ActionId; path: V2[]; last: V2 | null; stuck: number; working: boolean }

/** One line of Wolt's energy balance: who takes or gives how much right now (Wh/s). */
export interface Flow { label: string; rate: number }

export interface Objective { text: string; done: boolean; active: boolean }

export class Game {
  readonly world: World;
  readonly ports: PortDef[];
  readonly points: StationPoint[];
  pos: V2;
  facing = 0;          // radians, 0 = +x
  moving = false;
  held: PlacedCable | null = null;
  cables: PlacedCable[] = [];
  reelOwned: number;   // metres of cable Wolt owns (crafted)
  inv: Record<Material, number> = { iron: 0, copper: 0, plastic: 0, glass: 0 };
  reelHold = 0;
  salvage: { target: Obstacle; t: number } | null = null;
  craftT = 0;          // > 0 while the fabricator works
  battery = 0;         // Wh in the yacht
  phase: Phase = 'play';
  departT = 0;
  time = 0;
  toasts: { text: string; t: number }[] = [];
  /** One-shot events for sound/FX; the consumer clears it. */
  events: GameEvent[] = [];
  /** Obstacles removed this frame (for the renderer). */
  removed: Obstacle[] = [];
  networks = new Map<string, NetworkState>();
  readonly nodes: PowerNode[];
  readonly wind = new Wind(7);
  energy = WOLT_START;
  /** Current net energy flow in Wh/s (negative = draining), for the HUD. */
  energyRate = 0;
  energySource: 'rest' | 'port' | null = null;
  /** The current energy balance line by line (consumers negative, sources positive). */
  flows: Flow[] = [];
  light = true;
  stillT = 0;
  order: Order | null = null;
  craftQueue = 0;
  /** Loose things on the ground Wolt can tow (a tyre, a sled of bricks). */
  loads: Load[];
  /** The load on Wolt's hitch, if any. */
  tow: Load | null = null;
  towTaut = false;
  /** Wolt drives but stays put: the cable is at its limit or the towed load snagged. */
  strain = false;
  private snagWarned = false;
  private lowWarned = false;

  constructor(readonly level: LevelDef) {
    this.world = new World(level.width, level.height, level.obstacles);
    this.ports = level.ports;
    this.points = level.points;
    this.pos = { ...level.playerStart };
    this.reelOwned = level.startReel;
    this.loads = (level.loads ?? []).map((l, i) => ({ id: `${l.kind}-${i}`, kind: l.kind, pos: { ...l.pos }, angle: l.angle ?? 0 }));
    this.nodes = [
      { id: 'station', produce: level.stationOutput, demand: 0 },
      { id: 'yacht', produce: 0, demand: 0 },
    ];
    this.solve();
    this.toast('Bateria Wolta: 25%. Postój ładuje powoli, bieg i rozbieranie zużywają więcej.');
  }

  // ---------- queries
  energyPct(): number { return this.energy / WOLT_BATTERY; }
  empty(): boolean { return this.energy <= 0.01; }
  salvageTime(o: Obstacle): number { return o.kind === 'barrel' ? BARREL_SALVAGE_TIME : SALVAGE_TIME; }
  /** A port that gives power right now (Wolt can top up next to it). */
  portLive(id: string): boolean {
    if (id === 'station') return true;
    return this.battery > this.level.yachtBattery * 0.05 || this.yachtCharging();
  }
  reelUsed(): number { return this.cables.reduce((s, c) => s + c.cable.length(), 0); }
  reelLeft(): number { return this.reelOwned - this.reelUsed() - (this.held ? this.held.cable.length() : 0); }
  segmentMax(): number { return Math.min(CABLE_MAX, this.reelOwned - this.reelUsed()); }
  heldLength(): number { return this.held ? this.held.cable.length() : 0; }
  batteryFull(): boolean { return this.battery >= this.level.yachtBattery - 1e-6; }
  batteryPct(): number { return this.battery / this.level.yachtBattery; }
  yachtCharging(): boolean { return (this.networks.get('yacht')?.nodes.length ?? 0) > 1 && !this.batteryFull(); }
  canCraft(): boolean {
    return this.inv.copper >= CABLE_RECIPE.copper && this.inv.plastic >= CABLE_RECIPE.plastic
      && this.reelOwned + CABLE_PER_CRAFT <= REEL_CAPACITY;
  }
  scrapLeft(): Obstacle[] { return this.world.obstacles.filter(o => o.loot); }

  cableState(): CableState {
    if (!this.held) return 'none';
    const l = this.heldLength();
    if (l >= this.segmentMax() - 0.05) return 'limit';
    if (l >= CABLE_WARN) return 'tense';
    return 'held';
  }

  portBusy(id: string): PlacedCable | undefined {
    return this.cables.find(c => c.from === id || c.to === id) ?? (this.held?.from === id ? this.held : undefined);
  }

  nearestPort(): PortDef | null {
    let best: PortDef | null = null, bd = INTERACT_RANGE;
    for (const p of this.ports) { const d = dist(p.pos, this.pos); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  nearestPoint(): StationPoint | null {
    let best: StationPoint | null = null, bd = INTERACT_RANGE;
    for (const p of this.points) { const d = dist(p.pos, this.pos); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  nearestLoad(): Load | null {
    let best: Load | null = null, bd = TOW_RANGE;
    for (const l of this.loads) { if (l === this.tow) continue; const d = dist(l.pos, this.pos) - LOADS[l.kind].radius; if (d < bd) { bd = d; best = l; } }
    return best;
  }

  nearestScrap(aim: V2 | null = null): Obstacle | null {
    let best: Obstacle | null = null, bd = SALVAGE_RANGE + PLAYER_RADIUS;
    for (const o of this.scrapLeft()) {
      let d = World.distToRect(this.pos, o);
      if (aim && World.distToRect(aim, o) < 0.3) d -= 0.5; // prefer the pile under the cursor
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  objectives(): Objective[] {
    const need = 20;
    const haveCable = this.reelOwned >= need;
    const connected = (this.networks.get('yacht')?.nodes.length ?? 0) > 1;
    const charged = this.batteryFull();
    const c = this.inv.copper + this.reelOwned / CABLE_PER_CRAFT, p = this.inv.plastic + this.reelOwned / CABLE_PER_CRAFT;
    const gathered = c >= 4 && p >= 4;
    const list: Objective[] = [
      { text: `Rozbierz złom: miedź ${Math.min(4, c)}/4, plastik ${Math.min(4, p)}/4`, done: gathered || haveCable, active: false },
      { text: `Wytwórz kabel w fabrykatorze: ${this.reelOwned}/${need} m`, done: haveCable, active: false },
      { text: 'Połącz port Stacji 2 z portem żaglowozu', done: connected || charged, active: false },
      { text: `Naładuj żaglowóz: ${Math.floor(this.batteryPct() * 100)}%`, done: charged, active: false },
      { text: 'Odjedź: E przy sterze', done: this.phase !== 'play', active: false },
    ];
    const first = list.findIndex(o => !o.done);
    if (first >= 0) list[first].active = true;
    return list;
  }

  hint(): Hint | null {
    if (this.phase !== 'play') return null;
    const pt = this.nearestPoint();
    if (pt && !this.held) {
      if (pt.id === 'fabricator') {
        if (this.craftT > 0) return { key: '…', text: 'fabrykator pracuje', at: pt.pos, height: 2.4, ok: true };
        if (this.reelOwned + CABLE_PER_CRAFT > REEL_CAPACITY) return { key: 'E', text: 'nawijak pełny', at: pt.pos, height: 2.4, ok: false };
        return this.canCraft()
          ? { key: 'E', text: `wytwórz kabel 5 m (1 miedź + 1 plastik)`, at: pt.pos, height: 2.4, ok: true }
          : { key: 'E', text: `kabel 5 m: potrzeba 1 miedzi i 1 plastiku`, at: pt.pos, height: 2.4, ok: false };
      }
      if (pt.id === 'helm') return this.batteryFull()
        ? { key: 'E', text: 'odjazd', at: pt.pos, height: 2.2, ok: true }
        : { key: 'E', text: `bateria ${Math.floor(this.batteryPct() * 100)}%, za mało na odjazd`, at: pt.pos, height: 2.2, ok: false };
    }
    const p = this.nearestPort();
    if (p) {
      const busy = this.portBusy(p.id);
      if (!this.held) {
        if (!busy) return this.segmentMax() < 1
          ? { key: 'E', text: 'brak kabla na nawijaku', at: p.pos, height: p.height, ok: false }
          : { key: 'E', text: `weź kabel (${this.segmentMax().toFixed(0)} m)`, at: p.pos, height: p.height, ok: true };
        if (busy.to === p.id) return { key: 'E', text: 'wypnij kabel', at: p.pos, height: p.height, ok: true };
        return { key: 'Q', text: 'przytrzymaj, by zwinąć kabel', at: p.pos, height: p.height, ok: true };
      }
      if (this.held.from === p.id) return { key: 'Q', text: 'przytrzymaj, by zwinąć kabel', at: p.pos, height: p.height, ok: true };
      if (busy) return { key: 'E', text: 'port zajęty', at: p.pos, height: p.height, ok: false };
      const need = this.held.cable.baseLength() + dist(this.held.cable.last, p.pos);
      if (need > this.segmentMax() + 0.01) return { key: 'E', text: `za krótki kabel (${need.toFixed(1)} m)`, at: p.pos, height: p.height, ok: false };
      return { key: 'E', text: `wepnij w ${p.name}`, at: p.pos, height: p.height, ok: true };
    }
    const s = this.nearestScrap();
    if (s && !this.held) {
      const at = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      if (this.empty()) return { key: 'E', text: 'za mało energii, by rozbierać', at, height: 0.8, ok: false };
      const what = s.kind === 'barrel' ? 'beczkę' : 'złom';
      return { key: 'E', text: this.salvage ? 'rozbieranie…' : `przytrzymaj, by rozebrać ${what}`, at, height: 0.8, ok: true };
    }
    const l = this.nearestLoad();
    if (l && !this.tow) return { key: 'E', text: `doczep ${LOADS[l.kind].name}`, at: l.pos, height: 0.7, ok: true };
    if (this.tow && !this.moving) return { key: 'E', text: `odczep ${LOADS[this.tow.kind].name}`, at: this.tow.pos, height: 0.7, ok: true };
    return null;
  }

  toast(text: string) { this.toasts.push({ text, t: this.time }); }

  // ---------- mouse targets and actions
  /** What lies under a ground point, by proximity (the view refines this with a raycast). */
  targetAt(p: V2): Target {
    if (dist(p, this.pos) < 0.55) return { kind: 'self' };
    for (const port of this.ports) if (dist(port.pos, p) < 0.8) return { kind: 'port', id: port.id };
    for (const pt of this.points) if (dist(pt.pos, p) < 0.9) return { kind: 'point', id: pt.id };
    for (const o of this.scrapLeft()) if (World.distToRect(p, o) < 0.25) return { kind: 'scrap', o };
    for (const l of this.loads) if (dist(l.pos, p) < LOADS[l.kind].radius + 0.1) return { kind: 'load', id: l.id };
    return { kind: 'ground', at: p };
  }

  /** Actions offered for a target, the default first. */
  actionsFor(t: Target): Action[] {
    switch (t.kind) {
      case 'ground': return [{ id: 'walk', label: 'Idź tutaj', ok: true }];
      case 'self': {
        const list: Action[] = [{ id: 'light', label: this.light ? 'Wyłącz światło' : 'Włącz światło', ok: true }];
        if (this.tow) list.push({ id: 'untow', label: `Odczep ${LOADS[this.tow.kind].name}`, ok: true });
        return list;
      }
      case 'load': {
        const l = this.loads.find(x => x.id === t.id)!;
        if (l === this.tow) return [{ id: 'untow', label: `Odczep ${LOADS[l.kind].name}`, ok: true }];
        return [{ id: 'tow', label: `Doczep ${LOADS[l.kind].name}`, ok: !this.tow, why: this.tow ? 'hak jest zajęty' : undefined }];
      }
      case 'scrap': {
        if (!this.world.obstacles.includes(t.o)) return [];
        const what = t.o.kind === 'barrel' ? 'beczkę' : 'złom';
        return [{ id: 'salvage', label: `Rozbierz ${what}`, ok: !this.held && !this.empty(), why: this.held ? 'najpierw odłóż kabel' : this.empty() ? 'za mało energii' : undefined }];
      }
      case 'point': {
        if (t.id === 'helm') return [{ id: 'depart', label: 'Odjedź', ok: this.batteryFull(), why: this.batteryFull() ? undefined : `bateria ${Math.floor(this.batteryPct() * 100)}%` }];
        const room = Math.floor((REEL_CAPACITY - this.reelOwned) / CABLE_PER_CRAFT);
        const mats = Math.min(Math.floor(this.inv.copper / CABLE_RECIPE.copper), Math.floor(this.inv.plastic / CABLE_RECIPE.plastic));
        const n = Math.min(room, mats);
        const why = room < 1 ? 'nawijak pełny' : mats < 1 ? 'potrzeba 1 miedzi i 1 plastiku' : undefined;
        const list: Action[] = [{ id: 'craft', label: 'Wytwórz 5 m kabla', ok: n >= 1 && !this.held, why: this.held ? 'odłóż kabel' : why }];
        if (n >= 2) list.push({ id: 'craftAll', label: `Wytwórz ${n * CABLE_PER_CRAFT} m kabla (wszystko)`, ok: !this.held });
        return list;
      }
      case 'port': {
        const busy = this.portBusy(t.id);
        if (!this.held) {
          if (!busy) return [{ id: 'grab', label: 'Weź kabel', ok: this.segmentMax() >= 1, why: this.segmentMax() >= 1 ? undefined : 'brak kabla na nawijaku' }];
          const list: Action[] = [];
          if (busy.to === t.id) list.push({ id: 'unplug', label: 'Wypnij kabel', ok: true });
          list.push({ id: 'reel', label: 'Zwiń kabel na nawijak', ok: true });
          return list;
        }
        if (this.held.from === t.id) return [{ id: 'reel', label: 'Zwiń kabel na nawijak', ok: true }];
        if (busy) return [{ id: 'plug', label: 'Wepnij kabel', ok: false, why: 'port zajęty' }];
        return [{ id: 'plug', label: 'Wepnij kabel', ok: true }];
      }
    }
  }

  /** Walk to the target (if needed) and do the action there. */
  command(t: Target, action: ActionId) {
    if (this.phase !== 'play') return;
    if (t.kind === 'self') { this.doAction(t, action); this.order = null; return; }
    const goal = this.goalOf(t);
    const path = findPath(this.world, this.pos, goal, PLAYER_RADIUS) ?? [goal];
    this.order = { target: t, action, path, last: null, stuck: 0, working: false };
  }

  cancelOrder() { this.order = null; }

  private goalOf(t: Target): V2 {
    switch (t.kind) {
      case 'ground': return t.at;
      case 'scrap': return { x: t.o.x + t.o.w / 2, y: t.o.y + t.o.h / 2 };
      case 'port': return this.ports.find(p => p.id === t.id)!.pos;
      case 'point': return this.points.find(p => p.id === t.id)!.pos;
      case 'load': return this.loads.find(l => l.id === t.id)!.pos;
      case 'self': return this.pos;
    }
  }

  /** Distance still to go before the action can happen (≤ 0 = there). */
  private remaining(t: Target): number {
    switch (t.kind) {
      case 'ground': return dist(this.pos, t.at) - 0.15;
      case 'scrap': return World.distToRect(this.pos, t.o) - SALVAGE_RANGE;
      case 'port': case 'point': return dist(this.pos, this.goalOf(t)) - (INTERACT_RANGE - 0.3);
      case 'load': { const l = this.loads.find(x => x.id === t.id)!; return l === this.tow ? 0 : dist(this.pos, l.pos) - LOADS[l.kind].radius - (TOW_RANGE - 0.3); }
      case 'self': return 0;
    }
  }

  private followOrder(dt: number, inp: Input): V2 | null {
    const o = this.order!;
    if (o.target.kind === 'scrap' && !this.world.obstacles.includes(o.target.o)) { this.order = null; return null; }
    const rem = this.remaining(o.target);
    if (rem <= 0) {
      if (o.action === 'walk') { this.order = null; return null; }
      if (o.action === 'salvage' && o.target.kind === 'scrap') {
        o.working = true;
        const c = this.goalOf(o.target);
        this.facing = Math.atan2(c.y - this.pos.y, c.x - this.pos.x);
        return null;
      }
      this.order = null;
      this.doAction(o.target, o.action);
      return null;
    }
    // stuck = barely moved for a while (a wall, or the cable at its limit)
    if (o.last && dist(o.last, this.pos) < WALK_SPEED * EMPTY_SPEED * TENSION_SLOW * dt * 0.3) o.stuck += dt; else o.stuck = 0;
    o.last = { ...this.pos };
    if (o.stuck > 1.2) {
      this.order = null;
      this.toast(this.held && this.cableState() === 'limit' ? 'Kabel nie sięga dalej.' : 'Wolt nie znajduje drogi.');
      this.events.push('deny');
      return null;
    }
    while (o.path.length > 1 && dist(this.pos, o.path[0]) < 0.3) o.path.shift();
    const wp = o.path[0] ?? this.goalOf(o.target);
    const d = sub(wp, this.pos);
    const l = len(d);
    if (l < 1e-3) return null;
    void inp;
    return scale(d, 1 / l);
  }

  private doAction(t: Target, a: ActionId) {
    if (this.phase !== 'play') return;
    const act = this.actionsFor(t).find(x => x.id === a);
    if (act && !act.ok) { if (act.why) this.toast(cap(act.why) + '.'); this.events.push('deny'); return; }
    switch (a) {
      case 'light': this.toggleLight(); return;
      case 'tow': if (t.kind === 'load') this.hook(this.loads.find(l => l.id === t.id)!); return;
      case 'untow': this.unhook(); return;
      case 'craft': this.craft(1); return;
      case 'craftAll': this.craft(99); return;
      case 'depart': this.depart(); return;
      case 'grab': case 'unplug': case 'plug': if (t.kind === 'port') this.portAction(this.ports.find(p => p.id === t.id)!); return;
      case 'reel': if (t.kind === 'port') { const c = this.held ?? this.cables.find(c => c.from === t.id || c.to === t.id); if (c) this.reelIn(c); } return;
      default: return;
    }
  }

  private hook(l: Load) {
    if (this.tow) { this.events.push('deny'); return; }
    this.tow = l;
    this.towTaut = false;
    this.snagWarned = false;
    this.toast(`Doczepiono ${LOADS[l.kind].name}. Ciągnie się za Woltem i spowalnia go.`);
    this.events.push('hook');
  }

  private unhook() {
    if (!this.tow) return;
    this.toast(`Odczepiono ${LOADS[this.tow.kind].name}.`);
    this.tow = null;
    this.towTaut = false;
    this.events.push('unhook');
  }

  toggleLight() {
    if (!this.light && this.empty()) { this.toast('Za mało energii na światło.'); this.events.push('deny'); return; }
    this.light = !this.light;
    this.events.push('light');
  }

  // ---------- simulation
  update(dt: number, inp: Input) {
    this.time += dt;
    this.wind.update(dt);
    if (this.phase === 'play') {
      let move = inp.move;
      if (len(move) > 0.01) this.order = null; // keys override the mouse
      else if (this.order) move = this.followOrder(dt, inp) ?? { x: 0, y: 0 };
      this.movePlayer(dt, { ...inp, move });
      // a monocycle faces only where it rolls; standing still, the view swivels the capsule to the cursor
      if (inp.interact) this.interact();
      this.updateSalvage(dt, inp);
      this.updateCraft(dt);
      this.updateReel(dt, inp.reel);
      this.updateEnergy(dt, inp);
    } else {
      this.moving = false;
      this.departT += dt;
      if (this.phase === 'departing' && this.departT >= DEPART_TIME) { this.phase = 'done'; this.events.push('win'); }
    }
    this.solve();
    this.updateCharge(dt);
    this.toasts = this.toasts.filter(t => this.time - t.t < 4);
  }

  private running = false;

  private movePlayer(dt: number, inp: Input) {
    const m = len(inp.move);
    this.moving = m > 0.01;
    this.strain = false;
    this.running = this.moving && inp.run && !this.empty();
    if (!this.moving) { this.stepTow(this.pos, false); return; }
    const dir = m > 1 ? scale(inp.move, 1 / m) : inp.move;
    this.facing = Math.atan2(dir.y, dir.x);
    let speed = WALK_SPEED * (this.running ? RUN_MULT : 1);
    if (this.empty()) speed *= EMPTY_SPEED;
    if (this.held && this.heldLength() >= CABLE_WARN) speed *= TENSION_SLOW;
    if (this.tow) speed *= 1 - LOADS[this.tow.kind].drag;
    const step = scale(dir, speed * dt);

    // collide per axis so Wolt slides along walls
    let cand = { ...this.pos };
    const tx = { x: cand.x + step.x, y: cand.y };
    if (!this.bumps(tx)) cand = tx;
    const ty = { x: cand.x, y: cand.y + step.y };
    if (!this.bumps(ty)) cand = ty;

    if (this.held) cand = this.constrainByCable(cand);
    if (this.tow && !this.stepTow(cand, true)) cand = this.pos;
    this.moving = dist(cand, this.pos) > 1e-5;
    this.strain = !this.moving;
    this.pos = cand;
  }

  /** Walls, rocks, and loads that are not on the hitch. */
  private bumps(p: V2): boolean {
    if (this.world.circleBlocked(p, PLAYER_RADIUS)) return true;
    for (const l of this.loads) {
      if (l === this.tow) continue;
      const r = LOADS[l.kind].radius * LOAD_BUMP + PLAYER_RADIUS;
      if (dist(p, l.pos) < r && dist(p, l.pos) < dist(this.pos, l.pos)) return true;
    }
    return false;
  }

  /** Drag the towed load after the hitch at `at`. False if it snagged and holds Wolt back. */
  private stepTow(at: V2, driving: boolean): boolean {
    const l = this.tow;
    if (!l) return true;
    const s = towStep(this.world, l, hitchOf(at, this.facing));
    if (s.blocked && driving) {
      this.towTaut = true;
      if (!this.snagWarned) { this.snagWarned = true; this.toast(`${cap(LOADS[l.kind].name)} zaczepiła się o przeszkodę. Objedź ją albo odczep (E).`); this.events.push('deny'); }
      return false;
    }
    l.pos = s.pos; l.angle = s.angle;
    this.towTaut = s.taut;
    if (!s.blocked) this.snagWarned = false;
    return true;
  }

  private updateEnergy(dt: number, inp: Input) {
    const busy = this.moving || !!this.salvage || this.craftT > 0;
    this.stillT = busy ? 0 : this.stillT + dt;
    const f: Flow[] = [{ label: 'czuwanie (układy)', rate: -DRAIN.base }];
    if (this.moving) f.push({ label: this.running ? 'bieg' : 'jazda', rate: this.running ? -DRAIN.run : -DRAIN.walk });
    if (this.salvage) f.push({ label: 'rozbieranie', rate: -DRAIN.salvage });
    if (this.tow && this.moving) f.push({ label: `ciągnie ${LOADS[this.tow.kind].name}`, rate: -LOADS[this.tow.kind].drain });
    if (this.light) f.push({ label: 'światło', rate: -DRAIN.light });
    this.energySource = null;
    if (this.stillT >= REST_DELAY) {
      const live = this.ports.find(p => this.portLive(p.id) && dist(p.pos, this.pos) < PORT_CHARGE_RANGE);
      this.energySource = live ? 'port' : 'rest';
      f.push(live ? { label: `ładowanie: ${live.name}`, rate: PORT_CHARGE } : { label: 'postój (Q-1 się odnawia)', rate: REST_CHARGE });
    }
    void inp;
    const rate = f.reduce((a, x) => a + x.rate, 0);
    this.flows = f;
    this.energyRate = rate;
    this.energy = Math.max(0, Math.min(WOLT_BATTERY, this.energy + rate * dt));
    if (this.empty() && this.light) { this.light = false; this.toast('Bateria Wolta pusta: światło zgasło. Postój albo port Stacji 2 go naładują.'); this.events.push('deny'); }
    if (this.energy < LOW_ENERGY && !this.lowWarned && rate < 0) { this.lowWarned = true; this.toast('Bateria Wolta słabnie. Stań na chwilę albo podejdź do portu Stacji 2.'); }
    if (this.energy > LOW_ENERGY + 10) this.lowWarned = false;
  }

  /** Keep the held cable within its limit: slide along the reach circle, never past it. */
  private constrainByCable(cand: V2): V2 {
    const h = this.held!;
    const max = this.segmentMax();
    const t = h.cable.clone();
    t.moveEnd(this.world, cand);
    if (t.length() <= max) { h.cable = t; return cand; }

    const r = max - t.baseLength();
    if (r > 0.05) {
      const slid = add(t.last, scale(norm(sub(cand, t.last)), r - 1e-3));
      if (!this.world.circleBlocked(slid, PLAYER_RADIUS)) {
        const t2 = h.cable.clone();
        t2.moveEnd(this.world, slid);
        if (t2.length() <= max + 1e-3) { h.cable = t2; return slid; }
      }
    }
    return this.pos;
  }

  /** E key: the obvious thing for whatever Wolt stands next to. */
  private interact() {
    const pt = this.nearestPoint();
    if (pt && !this.held) {
      if (pt.id === 'fabricator') { if (this.craftT <= 0) this.craft(1); return; }
      this.depart();
      return;
    }
    const p = this.nearestPort();
    if (p) { this.portAction(p); return; }
    const l = this.nearestLoad();
    if (l && !this.tow) { this.hook(l); return; }
    if (this.tow && !(this.nearestScrap() && !this.held)) this.unhook();
  }

  private craft(n: number) {
    if (this.craftT > 0) { this.craftQueue = Math.max(this.craftQueue, n - 1); return; }
    if (!this.canCraft()) { this.events.push('deny'); this.toast(this.reelOwned + CABLE_PER_CRAFT > REEL_CAPACITY ? 'Nawijak jest pełny.' : 'Brakuje materiałów: 1 miedź + 1 plastik na 5 m kabla.'); return; }
    this.inv.copper -= CABLE_RECIPE.copper; this.inv.plastic -= CABLE_RECIPE.plastic;
    this.craftT = CRAFT_TIME;
    this.craftQueue = n - 1;
  }

  private depart() {
    if (!this.batteryFull()) { this.events.push('deny'); this.toast('Bateria żaglowozu jest za słaba na odjazd.'); return; }
    const attached = this.cables.filter(c => c.from === 'yacht' || c.to === 'yacht');
    if (attached.length) {
      this.cables = this.cables.filter(c => !attached.includes(c));
      this.toast('Kabel wyskoczył z portu żaglowozu.');
    }
    this.order = null;
    this.phase = 'departing';
    this.departT = 0;
    this.events.push('depart');
  }

  private portAction(p: PortDef) {
    const busy = this.portBusy(p.id);
    if (!this.held) {
      if (!busy) {
        if (this.segmentMax() < 1) { this.toast('Nawijak jest pusty. Wytwórz kabel w fabrykatorze.'); this.events.push('deny'); return; }
        const c = new Cable(p.pos, p.pos);
        c.moveEnd(this.world, this.pos);
        this.held = { cable: c, from: p.id, to: null };
        this.events.push('grab');
      } else if (busy.to === p.id) {
        busy.to = null;
        this.cables = this.cables.filter(c => c !== busy);
        busy.cable.moveEnd(this.world, this.pos);
        this.held = busy;
        this.toast('Wypięto kabel.');
        this.events.push('unplug');
      }
      return;
    }
    if (this.held.from === p.id) return;
    if (busy) { this.events.push('deny'); return; }
    const c = this.held.cable.clone();
    c.moveEnd(this.world, p.pos);
    if (c.length() > this.segmentMax() + 0.01) { this.toast('Za krótki kabel. Spróbuj krótszej trasy.'); this.events.push('deny'); return; }
    this.held.cable = c;
    this.held.to = p.id;
    this.cables.push(this.held);
    this.held = null;
    this.toast(`Wpięto w ${p.name}.`);
    this.events.push('plug');
  }

  private updateSalvage(dt: number, inp: Input) {
    let target: Obstacle | null = null;
    const o = this.order;
    if (o && o.working && o.action === 'salvage' && o.target.kind === 'scrap') target = o.target.o;
    else if (inp.use && !this.held && !(this.nearestPort() || this.nearestPoint())) target = this.nearestScrap(inp.aim);
    if (target && this.empty()) {
      if (this.salvage || o?.working) { this.toast('Za mało energii, by rozbierać. Postój chwilę.'); this.events.push('deny'); }
      if (o?.working) this.order = null;
      target = null;
    }
    if (!target) { this.salvage = null; return; }
    if (!this.salvage || this.salvage.target !== target) this.salvage = { target, t: 0 };
    this.salvage.t += dt;
    if (this.salvage.t >= this.salvageTime(target)) {
      const loot = target.loot!;
      const got: string[] = [];
      const names: Record<Material, string> = { iron: 'żelazo', copper: 'miedź', plastic: 'plastik', glass: 'szkło' };
      for (const [k, n] of Object.entries(loot) as [Material, number][]) { this.inv[k] += n; got.push(`+${n} ${names[k]}`); }
      this.world.remove(target);
      this.removed.push(target);
      this.salvage = null;
      if (o?.working) this.order = null;
      this.toast(`Rozebrano ${target.kind === 'barrel' ? 'beczkę' : 'złom'}: ${got.join(', ')}`);
      this.events.push('salvage');
    }
  }

  private updateCraft(dt: number) {
    if (this.craftT <= 0) return;
    this.craftT -= dt;
    if (this.craftT <= 0) {
      this.craftT = 0;
      this.reelOwned += CABLE_PER_CRAFT;
      this.toast(`Fabrykator: +5 m kabla (na nawijaku ${this.reelOwned} m).`);
      this.events.push('craft');
      if (this.craftQueue > 0 && this.canCraft()) this.craft(this.craftQueue);
      else this.craftQueue = 0;
    }
  }

  private updateReel(dt: number, q: boolean) {
    if (!q) { this.reelHold = 0; return; }
    const p = this.nearestPort();
    const target = this.held ?? (p ? this.cables.find(c => c.from === p.id || c.to === p.id) : undefined);
    if (!target) { this.reelHold = 0; return; }
    this.reelHold += dt;
    if (this.reelHold >= REEL_HOLD) { this.reelHold = 0; this.reelIn(target); }
  }

  private reelIn(target: PlacedCable) {
    if (target === this.held) this.held = null;
    this.cables = this.cables.filter(c => c !== target);
    this.toast(`Zwinięto ${target.cable.length().toFixed(1)} m kabla na nawijak.`);
    this.events.push('reel');
  }

  private updateCharge(dt: number) {
    const yacht = this.nodes.find(n => n.id === 'yacht')!;
    const full = this.batteryFull();
    yacht.demand = full ? 0 : this.level.stationOutput;
    const net = this.networks.get('yacht')!;
    if (net.nodes.length > 1 && !full) {
      const surplus = net.production; // the battery takes everything the station gives
      this.battery = Math.min(this.level.yachtBattery, this.battery + surplus * CHARGE_SPEED * dt);
      if (this.batteryFull()) { this.toast('Bateria żaglowozu naładowana. Wracaj do steru.'); this.events.push('charged'); }
    }
  }

  private solve() {
    const edges = this.cables.filter(c => c.to).map(c => {
      const a = this.ports.find(p => p.id === c.from)!.node;
      const b = this.ports.find(p => p.id === c.to)!.node;
      return [a, b] as [string, string];
    });
    this.networks = solveNetworks(this.nodes, edges);
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
