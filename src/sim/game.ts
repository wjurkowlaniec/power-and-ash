import { V2, add, scale, sub, norm, dist, len } from './vec';
import { World, Obstacle, Material } from './world';
import { Cable } from './cable';
import { LevelDef, PortDef, StationPoint } from './level';
import { PowerNode, solveNetworks, NetworkState } from './power';
import { Wind } from './wind';

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
export type GameEvent = 'grab' | 'plug' | 'unplug' | 'reel' | 'deny' | 'salvage' | 'craft' | 'charged' | 'depart' | 'win';
export type Phase = 'play' | 'departing' | 'done';

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

  constructor(readonly level: LevelDef) {
    this.world = new World(level.width, level.height, level.obstacles);
    this.ports = level.ports;
    this.points = level.points;
    this.pos = { ...level.playerStart };
    this.reelOwned = level.startReel;
    this.nodes = [
      { id: 'station', produce: level.stationOutput, demand: 0 },
      { id: 'yacht', produce: 0, demand: 0 },
    ];
    this.solve();
  }

  // ---------- queries
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
      return { key: 'E', text: this.salvage ? 'rozbieranie…' : 'przytrzymaj, by rozebrać złom', at, height: 0.8, ok: true };
    }
    return null;
  }

  toast(text: string) { this.toasts.push({ text, t: this.time }); }

  // ---------- simulation
  update(dt: number, inp: Input) {
    this.time += dt;
    this.wind.update(dt);
    if (this.phase === 'play') {
      if (inp.aim) {
        const d = sub(inp.aim, this.pos);
        if (len(d) > 0.05) this.facing = Math.atan2(d.y, d.x);
      }
      this.movePlayer(dt, inp);
      if (inp.interact) this.interact();
      this.updateSalvage(dt, inp);
      this.updateCraft(dt);
      this.updateReel(dt, inp.reel);
    } else {
      this.moving = false;
      this.departT += dt;
      if (this.phase === 'departing' && this.departT >= DEPART_TIME) { this.phase = 'done'; this.events.push('win'); }
    }
    this.solve();
    this.updateCharge(dt);
    this.toasts = this.toasts.filter(t => this.time - t.t < 4);
  }

  private movePlayer(dt: number, inp: Input) {
    const m = len(inp.move);
    this.moving = m > 0.01;
    if (!this.moving) return;
    const dir = m > 1 ? scale(inp.move, 1 / m) : inp.move;
    if (!inp.aim) this.facing = Math.atan2(dir.y, dir.x);
    let speed = WALK_SPEED * (inp.run ? RUN_MULT : 1);
    if (this.held && this.heldLength() >= CABLE_WARN) speed *= TENSION_SLOW;
    const step = scale(dir, speed * dt);

    // collide per axis so Wolt slides along walls
    let cand = { ...this.pos };
    const tx = { x: cand.x + step.x, y: cand.y };
    if (!this.world.circleBlocked(tx, PLAYER_RADIUS)) cand = tx;
    const ty = { x: cand.x, y: cand.y + step.y };
    if (!this.world.circleBlocked(ty, PLAYER_RADIUS)) cand = ty;

    if (this.held) cand = this.constrainByCable(cand);
    this.pos = cand;
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

  private interact() {
    const pt = this.nearestPoint();
    if (pt && !this.held) {
      if (pt.id === 'fabricator') {
        if (this.craftT > 0) return;
        if (!this.canCraft()) { this.events.push('deny'); this.toast(this.reelOwned + CABLE_PER_CRAFT > REEL_CAPACITY ? 'Nawijak jest pełny.' : 'Brakuje materiałów: 1 miedź + 1 plastik na 5 m kabla.'); return; }
        this.inv.copper -= CABLE_RECIPE.copper; this.inv.plastic -= CABLE_RECIPE.plastic;
        this.craftT = CRAFT_TIME;
        return;
      }
      if (pt.id === 'helm') {
        if (!this.batteryFull()) { this.events.push('deny'); this.toast('Bateria żaglowozu jest za słaba na odjazd.'); return; }
        const attached = this.cables.filter(c => c.from === 'yacht' || c.to === 'yacht');
        if (attached.length) {
          this.cables = this.cables.filter(c => !attached.includes(c));
          this.toast('Kabel wyskoczył z portu żaglowozu.');
        }
        this.phase = 'departing';
        this.departT = 0;
        this.events.push('depart');
        return;
      }
    }
    const p = this.nearestPort();
    if (!p) return;
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
    const near = this.nearestPort() || this.nearestPoint();
    const target = !this.held && inp.use && !near ? this.nearestScrap(inp.aim) : null;
    if (!target) { this.salvage = null; return; }
    if (!this.salvage || this.salvage.target !== target) this.salvage = { target, t: 0 };
    this.salvage.t += dt;
    if (this.salvage.t >= SALVAGE_TIME) {
      const loot = target.loot!;
      const got: string[] = [];
      const names: Record<Material, string> = { iron: 'żelazo', copper: 'miedź', plastic: 'plastik', glass: 'szkło' };
      for (const [k, n] of Object.entries(loot) as [Material, number][]) { this.inv[k] += n; got.push(`+${n} ${names[k]}`); }
      this.world.remove(target);
      this.removed.push(target);
      this.salvage = null;
      this.toast(`Rozebrano złom: ${got.join(', ')}`);
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
    }
  }

  private updateReel(dt: number, q: boolean) {
    if (!q) { this.reelHold = 0; return; }
    const p = this.nearestPort();
    const target = this.held ?? (p ? this.cables.find(c => c.from === p.id || c.to === p.id) : undefined);
    if (!target) { this.reelHold = 0; return; }
    this.reelHold += dt;
    if (this.reelHold >= REEL_HOLD) {
      this.reelHold = 0;
      if (target === this.held) this.held = null;
      this.cables = this.cables.filter(c => c !== target);
      this.toast(`Zwinięto ${target.cable.length().toFixed(1)} m kabla na nawijak.`);
      this.events.push('reel');
    }
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
