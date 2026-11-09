import { V2, dist, len } from '../../sim/vec';
import { World, Obstacle } from '../../sim/world';
import { Cable } from '../../sim/cable';
import { drive, settle, turnTowards } from '../../sim/drive';
import { bodyOk, guardTurn } from '../../sim/footprint';
import { tr } from '../../i18n';

/**
 * Scene 1. Hala pomiarowa (docs/POCZATEK.md), pure logic. The player is the Q-1
 * battery, locked in the test chamber. Through a diagnostic cable it drives the only
 * machine on the test bench: an empty one-wheeled service body standing in a dead
 * cradle on 4% of its own reserve. The cable wraps around obstacles and limits how
 * far the body can roll from the chamber. A pulsing light leads to the test chamber with the Q-1
 * battery. The chamber's emergency lever is too stiff for him: pry it with the pipe
 * lying by the wall. Take the battery, put it in the chest socket: colour, sound and
 * smooth movement come back. Then push the heavy door open and leave.
 *
 * 1 tile = 1 m. y grows towards the camera (south).
 */
export const HALL_W = 16;
export const HALL_H = 11;
export const PLAYER_R = 0.3;
export const USE_RANGE = 1.5;

export const RESERVE_START = 4;     // % at wake-up
export const RESERVE_MIN = 0.6;     // % floor: he never dies here, just crawls
export const RESERVE_PER_M = 0.075; // % per metre walked
export const RESERVE_STRAIN = 0.12; // % for trying the lever bare-handed
export const SPEED_RESERVE = 1.6;  // m/s
export const SPEED_POWERED = 2.6;   // m/s
export const RUN_MULT = 1.6;
export const PRY_TIME = 1.6;        // s holding E with the pipe
export const INSERT_TIME = 3.6;     // s of taking the battery and putting it in
export const WAKE_TIME = 3.0;       // s of standing up from the cradle
export const BATTERY_CHARGE = 58;   // % in the Q-1 when found
export const BATTERY_POWER = 200;   // W it can give at once
export const TETHER_MAX = 9;        // m of diagnostic cable from the chamber
export const TETHER_WARN = 7.5;     // m: the cable starts to pull

/** m Wolt rolls towards the chamber to take the battery. */
export const INSERT_APPROACH = 0.3;
/** On 4% reserve the body is sluggish: slow to start, slow to turn. */
const RESERVE_DRIVE = { accel: 3.5, brake: 8, turn: 4.5 };

export type HallPoint = 'pipe' | 'lever' | 'battery' | 'door' | 'note';
export type HallEvent = 'stand' | 'step' | 'strain' | 'pickup' | 'pry' | 'open' | 'take' | 'insert' | 'log' | 'door' | 'exit' | 'deny' | 'note';

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
  /** Where the diagnostic cable leaves the chamber base (south-west corner). */
  tether: { x: 8.85, y: 6.15 },
  /** Notes lying around: a clipboard by the cradle, the test 4411 printout by the test stand. */
  notes: [{ id: 'protokol', x: 4.4, y: 3.7 }, { id: 'raport4411', x: 13.2, y: 2.5 }],
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
  /** Diagnostic cable chamber → body; null once the battery is in the body. */
  tether: Cable | null = new Cable(layout.tether, layout.start);
  pos: V2 = { ...layout.start };
  facing = Math.PI; // looking west at first, lying in the cradle
  /** Forward speed along `facing`, m/s. */
  speed = 0;
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
  /** Tried the lever bare-handed: the pipe starts to glint. */
  leverTried = false;
  /** Note being read (the game waits), or null. */
  reading: string | null = null;
  notesRead = new Set<string>();

  topSpeed(): number {
    // reserve mode is slow but steady: the falling percentage is the pressure, not a crawl
    return this.powered ? SPEED_POWERED : SPEED_RESERVE;
  }

  /** 0..1 how "reserve mode" the view should look (grain, grey, stutter). */
  reserveLook(): number { return this.powered ? Math.max(0, 1 - this.poweredT / 4) : 1; }

  /** Id of the note `nearest()` returned. */
  noteAt: string | null = null;

  nearest(): HallPoint | null {
    const L = layout;
    const cands: [HallPoint, V2, boolean][] = [
      ['pipe', this.pipeDown ?? L.pipe, !!this.pipeDown],
      ['lever', L.lever, !this.leverDown],
      ['battery', L.batteryUse, this.chamberOpen >= 1 && !this.powered && this.insertT === 0],
      ['door', L.door, this.doorOpen < 1],
    ];
    // a note wins when you stand right on it
    for (const n of L.notes) if (dist(n, this.pos) < 0.9) { this.noteAt = n.id; return 'note'; }
    let best: HallPoint | null = null, bd = USE_RANGE;
    for (const [id, p, on] of cands) {
      if (!on) continue;
      const d = dist(p, this.pos);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  hint(): HallHint | null {
    if (!this.awake || this.insertT > 0 || this.exited || this.reading) return null;
    const n = this.nearest();
    const L = layout;
    switch (n) {
      case 'pipe': return { key: 'E', text: tr('podnieś rurę (do podważenia dźwigni)', 'pick up the pipe (to lever the handle)'), at: this.pipeDown!, ok: true };
      case 'lever':
        return this.hasPipe
          ? { key: 'E', text: tr('przytrzymaj: podważ dźwignię rurą', 'hold: lever the handle with the pipe'), at: L.lever, ok: true, progress: this.pry / PRY_TIME }
          : { key: 'E', text: tr('dźwignia awaryjna', 'emergency lever'), at: L.lever, ok: true };
      case 'battery': return { key: 'E', text: tr('weź baterię i wepnij w kasetę ramy', 'take the battery and slot it into the frame'), at: L.battery, ok: true };
      case 'note': {
        const n = L.notes.find(q => q.id === this.noteAt)!;
        return { key: 'E', text: this.notesRead.has(n.id) ? tr('zeskanowana kartka (jeszcze raz)', 'scanned sheet (again)') : tr('kartka: zeskanuj', 'sheet: scan'), at: n, ok: true };
      }
      case 'door': return this.powered
        ? { key: 'E', text: tr('pchnij drzwi', 'push the door'), at: L.door, ok: true }
        : { key: 'E', text: tr('ciężkie drzwi', 'heavy door'), at: L.door, ok: true };
    }
    return null;
  }

  closeNote() { this.reading = null; }

  private say(text: string) { this.message = { text, t: this.t }; }

  update(dt: number, inp: HallInput) {
    this.t += dt;
    if (this.powered) this.poweredT += dt;
    if (this.message && this.t - this.message.t > 5) this.message = null;
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
      this.insertT += dt;
      // face the chamber and roll up to its open front while the rig presents the cell
      const B = layout.battery, U = layout.batteryUse;
      const at = { x: U.x, y: U.y - INSERT_APPROACH };
      const k = this.insertT / INSERT_TIME;
      const target = k < 0.55 ? Math.atan2(B.y - this.pos.y, B.x - this.pos.x) : this.facing;
      const f0 = this.facing;
      const left = turnTowards(this, target, dt);
      this.facing = guardTurn(this.world, this.pos, f0, this.facing, PLAYER_R).facing;
      // roll straight along the heading (no steering on the last few centimetres)
      const fwd = k < 0.55 && Math.abs(left) < 0.4 ? (at.x - this.pos.x) * Math.cos(this.facing) + (at.y - this.pos.y) * Math.sin(this.facing) : 0;
      const want = Math.max(-0.7, Math.min(0.7, fwd * 3));
      this.speed += Math.max(-4 * dt, Math.min(4 * dt, want - this.speed));
      const before = { ...this.pos };
      const c = { x: this.pos.x + Math.cos(this.facing) * this.speed * dt, y: this.pos.y + Math.sin(this.facing) * this.speed * dt };
      if (bodyOk(this.world, this.pos, this.facing, c, this.facing, PLAYER_R)) this.pos = c; else this.speed = 0;
      this.moving = dist(before, this.pos) > 1e-5;
      if (this.moving) this.tether?.moveEnd(this.world, this.pos);
      if (this.insertT >= INSERT_TIME) {
        this.insertT = 0; this.powered = true; this.tether = null; this.events.push('insert');
      }
      return;
    }
    if (this.powered && !this.logShown && this.poweredT > 3) { this.logShown = true; this.events.push('log'); }

    if (this.reading) { this.moving = false; this.speed = 0; return; }
    this.move(dt, inp);
    this.use(dt, inp);

    // walking out through the open door
    if (this.doorOpen >= 1 && this.pos.x > HALL_W - 0.7 && !this.exited) { this.exited = true; this.events.push('exit'); }
  }

  private move(dt: number, inp: HallInput) {
    const want = len(inp.move) > 0.01 && this.pry === 0;
    let sp = this.topSpeed() * (this.powered && inp.run ? RUN_MULT : 1);
    // the cable pulls back near its end
    if (this.tether && this.tetherLength() > TETHER_WARN) sp *= 0.6;
    // reserve mode: the body surges and sags as the weak current comes and goes
    if (!this.powered) sp *= 0.82 + 0.18 * Math.sin(this.t * 2.3) * Math.sin(this.t * 0.9 + 1);
    const f0 = this.facing;
    let step = drive(this, dt, want ? inp.move : { x: 0, y: 0 }, sp, this.powered ? undefined : RESERVE_DRIVE);
    const before = { ...this.pos };
    // the nose and the reel must not swing into a wall (src/sim/footprint.ts)
    const g = guardTurn(this.world, this.pos, f0, this.facing, PLAYER_R, c => this.inside(c) && this.tetherOk(c));
    if (g.facing !== this.facing) { this.facing = g.facing; step = { x: Math.cos(this.facing) * this.speed * dt, y: Math.sin(this.facing) * this.speed * dt }; }
    this.pos = g.pos;
    const free = (c: V2) => bodyOk(this.world, this.pos, this.facing, c, this.facing, PLAYER_R) && this.inside(c) && this.tetherOk(c);
    const tx = { x: this.pos.x + step.x, y: this.pos.y };
    if (free(tx)) this.pos = tx;
    const ty = { x: this.pos.x, y: this.pos.y + step.y };
    if (free(ty)) this.pos = ty;
    const d = dist(before, this.pos);
    settle(this, d, dt);
    this.moving = d > 1e-5;
    if (!this.moving) return;
    this.tether?.moveEnd(this.world, this.pos);
    if (this.tether && this.tetherLength() > TETHER_MAX - 0.15 && this.t - (this.message?.t ?? -99) > 6)
      this.say(tr('Kabel diagnostyczny nie puści dalej. Ciało jest na smyczy komory.', "The diagnostic cable won't let go. The body is on the chamber's leash."));
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

  tetherLength(): number { return this.tether ? this.tether.length() : 0; }

  /** Would moving the body to p keep the diagnostic cable within reach? */
  private tetherOk(p: V2): boolean {
    if (!this.tether) return true;
    const c = this.tether.clone();
    c.moveEnd(this.world, p);
    const l = c.length();
    return l <= TETHER_MAX || l < this.tether.length();
  }

  private drain(pct: number) { this.reserve = Math.max(RESERVE_MIN, this.reserve - pct); }

  private use(dt: number, inp: HallInput) {
    const n = this.nearest();
    if (n !== 'lever' || !this.hasPipe || !inp.use) this.pry = Math.max(0, this.pry - dt * 2);
    if (!n) return;
    switch (n) {
      case 'pipe':
        if (inp.usePressed) { this.hasPipe = true; this.pipeDown = null; this.events.push('pickup'); this.say(tr('Rura. Może podważy dźwignię komory.', 'A pipe. It might lever the chamber handle.')); }
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
          this.say(tr('Dźwignia ani drgnie. Za mało siły, potrzeba czegoś do podważenia.', "The lever won't budge. Not enough strength, something to pry with is needed."));
          this.leverTried = true;
        }
        break;
      case 'note':
        if (inp.usePressed) { this.reading = this.noteAt; this.notesRead.add(this.noteAt!); this.events.push('note'); }
        break;
      case 'battery':
        if (inp.usePressed) { this.insertT = 0.001; this.events.push('take'); }
        break;
      case 'door':
        if (!inp.usePressed) break;
        if (this.powered) { if (this.doorOpen === 0) { this.doorOpen = 0.001; this.events.push('door'); } }
        else if (this.denyT === 0) {
          this.denyT = 1.2; this.drain(RESERVE_STRAIN); this.events.push('strain');
          this.say(tr('Drzwi ledwo drgnęły. Za mało siły.', 'The door barely moved. Not enough strength.'));
        }
        break;
    }
  }
}
