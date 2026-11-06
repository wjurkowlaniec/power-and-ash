import { V2, dist, len, scale } from '../../sim/vec';
import { World, Obstacle } from '../../sim/world';

/**
 * Scene 1. Hala pomiarowa (docs/POCZATEK.md), pure logic. Wolt wakes up in a dead
 * service cradle on 4% reserve. A pulsing light leads to the test chamber with the Q-1
 * battery. The chamber's emergency lever is too stiff for him: pry it with the pipe
 * lying by the wall. Take the battery, put it in the chest socket: colour, sound and
 * smooth movement come back. Then push the heavy door open and leave.
 *
 * 1 tile = 1 m. y grows towards the camera (south).
 */
export const HALL_W = 16;
export const HALL_H = 11;
export const PLAYER_R = 0.3;
export const USE_RANGE = 1.25;

export const RESERVE_START = 4;     // % at wake-up
export const RESERVE_MIN = 0.6;     // % floor: he never dies here, just crawls
export const RESERVE_PER_M = 0.075; // % per metre walked
export const RESERVE_STRAIN = 0.12; // % for trying the lever bare-handed
export const SPEED_RESERVE = 1.25;  // m/s
export const SPEED_POWERED = 2.6;   // m/s
export const RUN_MULT = 1.6;
export const PRY_TIME = 1.6;        // s holding E with the pipe
export const INSERT_TIME = 2.6;     // s of taking the battery and putting it in
export const WAKE_TIME = 2.2;       // s of standing up from the cradle
export const BATTERY_CHARGE = 58;   // % in the Q-1 when found
export const BATTERY_POWER = 200;   // W it can give at once

export type HallPoint = 'pipe' | 'lever' | 'battery' | 'door';
export type HallEvent = 'stand' | 'step' | 'strain' | 'pickup' | 'pry' | 'open' | 'take' | 'insert' | 'log' | 'door' | 'exit' | 'deny';

export interface HallInput { move: V2; run: boolean; use: boolean; usePressed: boolean }
export interface HallHint { key: string; text: string; at: V2; ok: boolean; progress?: number }

export const layout = {
  cradle: { x: 1, y: 4, w: 2, h: 3 },
  chamber: { x: 9, y: 3, w: 3, h: 3 },
  desk: { x: 12.5, y: 1, w: 2.5, h: 1 },
  start: { x: 3.55, y: 5.5 },
  pipe: { x: 4.6, y: 9.7 },
  lever: { x: 8.55, y: 5.0 },
  batteryUse: { x: 10.5, y: 6.75 },
  battery: { x: 10.5, y: 4.5 },
  door: { x: 15.35, y: 5.5 },
  puddle: { x: 7, y: 8.2 },
  window: { x: 5, w: 4 },
};

export function hallObstacles(): Obstacle[] {
  const L = layout;
  const ob = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'crate', x, y, w, h });
  return [
    ob(L.cradle.x, L.cradle.y, L.cradle.w, L.cradle.h),
    ob(L.chamber.x, L.chamber.y, L.chamber.w, L.chamber.h),
    ob(12, 1, 3, 1),        // desk with the test stand screen (rounded to tiles)
    ob(0, 0, 4, 1),         // shelves along the north wall
    ob(6, 0, 2, 1),
    ob(14, 8, 2, 3),        // crates in the south-east corner
    ob(0, 9, 2, 2),         // barrels
    ob(15, 0, 1, 5),        // east wall north of the door
    ob(15, 5, 1, 2),        // the heavy door (removed once pushed open)
    ob(15, 7, 1, 1),        // east wall south of the door (crates fill below)
  ];
}

export class Hall {
  readonly world = new World(HALL_W, HALL_H, hallObstacles());
  pos: V2 = { ...layout.start };
  facing = Math.PI; // looking west at first, lying in the cradle
  moving = false;
  t = 0;
  /** 0..1 standing up from the cradle; 1 = up. */
  wake = 0;
  awake = false;
  reserve = RESERVE_START;
  walked = 0;
  hasPipe = false;
  pipeDown: V2 | null = { ...layout.pipe };
  pry = 0;          // seconds of prying
  leverDown = false;
  chamberOpen = 0;  // 0..1 the glass sliding up
  insertT = 0;      // > 0 while taking the battery
  powered = false;  // the battery is in
  poweredT = 0;     // s since powered
  battery = BATTERY_CHARGE;
  logShown = false;
  doorOpen = 0;     // 0..1
  exited = false;
  events: HallEvent[] = [];
  private stepAcc = 0;
  private denyT = 0;
  message: { text: string; t: number } | null = null;

  speed(): number {
    if (this.powered) return SPEED_POWERED;
    // weaker as the reserve runs out
    const k = Math.max(0.35, Math.min(1, (this.reserve - RESERVE_MIN) / (RESERVE_START - RESERVE_MIN) + 0.35));
    return SPEED_RESERVE * k;
  }

  /** 0..1 how "reserve mode" the view should look (grain, grey, stutter). */
  reserveLook(): number { return this.powered ? Math.max(0, 1 - this.poweredT / 4) : 1; }

  nearest(): HallPoint | null {
    const L = layout;
    const cands: [HallPoint, V2, boolean][] = [
      ['pipe', this.pipeDown ?? L.pipe, !!this.pipeDown],
      ['lever', L.lever, !this.leverDown],
      ['battery', L.batteryUse, this.chamberOpen >= 1 && !this.powered && this.insertT === 0],
      ['door', L.door, this.doorOpen < 1],
    ];
    let best: HallPoint | null = null, bd = USE_RANGE;
    for (const [id, p, on] of cands) {
      if (!on) continue;
      const d = dist(p, this.pos);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  hint(): HallHint | null {
    if (!this.awake || this.insertT > 0 || this.exited) return null;
    const n = this.nearest();
    const L = layout;
    switch (n) {
      case 'pipe': return { key: 'E', text: 'podnieś rurę', at: this.pipeDown!, ok: true };
      case 'lever':
        return this.hasPipe
          ? { key: 'E', text: 'przytrzymaj: podważ dźwignię rurą', at: L.lever, ok: true, progress: this.pry / PRY_TIME }
          : { key: 'E', text: 'dźwignia awaryjna', at: L.lever, ok: true };
      case 'battery': return { key: 'E', text: 'weź baterię', at: L.battery, ok: true };
      case 'door': return this.powered
        ? { key: 'E', text: 'pchnij drzwi', at: L.door, ok: true }
        : { key: 'E', text: 'ciężkie drzwi', at: L.door, ok: true };
    }
    return null;
  }

  private say(text: string) { this.message = { text, t: this.t }; }

  update(dt: number, inp: HallInput) {
    this.t += dt;
    if (this.powered) this.poweredT += dt;
    if (this.message && this.t - this.message.t > 3.2) this.message = null;
    this.denyT = Math.max(0, this.denyT - dt);

    // standing up: the first input wakes him
    if (!this.awake) {
      if (this.wake === 0 && (len(inp.move) > 0.1 || inp.usePressed)) { this.wake = 0.001; this.events.push('stand'); }
      if (this.wake > 0) this.wake = Math.min(1, this.wake + dt / WAKE_TIME);
      if (this.wake >= 1) this.awake = true;
      return;
    }

    if (this.chamberOpen > 0 && this.chamberOpen < 1) {
      this.chamberOpen = Math.min(1, this.chamberOpen + dt / 2.5);
    }
    if (this.doorOpen > 0 && this.doorOpen < 1) {
      this.doorOpen = Math.min(1, this.doorOpen + dt / 1.6);
      if (this.doorOpen >= 1) this.world.remove(this.world.obstacles.find(o => o.x === 15 && o.y === 5 && o.h === 2)!);
    }

    if (this.insertT > 0) {
      this.moving = false;
      this.insertT += dt;
      this.facing = Math.atan2(layout.battery.y - this.pos.y, layout.battery.x - this.pos.x);
      if (this.insertT >= INSERT_TIME) {
        this.insertT = 0; this.powered = true; this.events.push('insert');
      }
      return;
    }
    if (this.powered && !this.logShown && this.poweredT > 3) { this.logShown = true; this.events.push('log'); }

    this.move(dt, inp);
    this.use(dt, inp);

    // walking out through the open door
    if (this.doorOpen >= 1 && this.pos.x > HALL_W - 0.7 && !this.exited) { this.exited = true; this.events.push('exit'); }
  }

  private move(dt: number, inp: HallInput) {
    const m = len(inp.move);
    this.moving = m > 0.01 && this.pry === 0;
    if (!this.moving) return;
    const dir = m > 1 ? scale(inp.move, 1 / m) : inp.move;
    this.facing = Math.atan2(dir.y, dir.x);
    let sp = this.speed() * (this.powered && inp.run ? RUN_MULT : 1);
    // reserve mode: motion comes in weak jerks
    if (!this.powered) sp *= 0.45 + 0.55 * Math.abs(Math.sin(this.t * 5.5));
    const step = scale(dir, sp * dt);
    const before = { ...this.pos };
    const tx = { x: this.pos.x + step.x, y: this.pos.y };
    if (!this.world.circleBlocked(tx, PLAYER_R) && this.inside(tx)) this.pos = tx;
    const ty = { x: this.pos.x, y: this.pos.y + step.y };
    if (!this.world.circleBlocked(ty, PLAYER_R) && this.inside(ty)) this.pos = ty;
    const d = dist(before, this.pos);
    this.walked += d;
    if (!this.powered) this.drain(d * RESERVE_PER_M);
    this.stepAcc += d;
    if (this.stepAcc > (this.powered ? 0.75 : 0.5)) { this.stepAcc = 0; this.events.push('step'); }
  }

  /** The world's edge is blocked except through the open door (east wall). */
  private inside(p: V2): boolean {
    if (p.x > HALL_W - PLAYER_R && this.doorOpen >= 1 && p.y > 4.6 && p.y < 6.4) return true;
    return p.x >= PLAYER_R && p.y >= PLAYER_R && p.x <= HALL_W - PLAYER_R && p.y <= HALL_H - PLAYER_R;
  }

  private drain(pct: number) { this.reserve = Math.max(RESERVE_MIN, this.reserve - pct); }

  private use(dt: number, inp: HallInput) {
    const n = this.nearest();
    if (n !== 'lever' || !this.hasPipe || !inp.use) this.pry = Math.max(0, this.pry - dt * 2);
    if (!n) return;
    switch (n) {
      case 'pipe':
        if (inp.usePressed) { this.hasPipe = true; this.pipeDown = null; this.events.push('pickup'); }
        break;
      case 'lever':
        if (this.hasPipe) {
          if (inp.use) {
            this.pry += dt;
            if (Math.random() < dt * 3) this.events.push('strain');
            if (this.pry >= PRY_TIME) {
              this.leverDown = true; this.pry = 0; this.hasPipe = false; this.chamberOpen = 0.001;
              this.events.push('pry', 'open');
            }
          }
        } else if (inp.usePressed && this.denyT === 0) {
          this.denyT = 1.2;
          this.drain(RESERVE_STRAIN);
          this.events.push('strain');
          this.say('Dźwignia ani drgnie. Za mało siły.');
        }
        break;
      case 'battery':
        if (inp.usePressed) { this.insertT = 0.001; this.events.push('take'); }
        break;
      case 'door':
        if (!inp.usePressed) break;
        if (this.powered) { if (this.doorOpen === 0) { this.doorOpen = 0.001; this.events.push('door'); } }
        else if (this.denyT === 0) {
          this.denyT = 1.2; this.drain(RESERVE_STRAIN); this.events.push('strain');
          this.say('Drzwi ledwo drgnęły. Za mało siły.');
        }
        break;
    }
  }
}
