/**
 * Tech demo "Powroty" (Wojtek, 2026-11-11): one homestead over the years, told without words.
 * Wolt can splice the cable at the last pole, sleep for years at the wintering shelter and
 * come back to see what changed. Pure logic, no Three.js; x/y are metres on the ground plane
 * (y maps to Three's z, so smaller y is further from the camera).
 */
export interface P2 { x: number; y: number }

export const PLACE = {
  shelter: { x: 8, y: -1 },
  slab: { x: 3.2, y: -3.5 },
  poles: [{ x: 27, y: -4 }, { x: 42, y: -4 }, { x: 57, y: -4 }, { x: 72, y: -4 }] as P2[],
  cableEnd: { x: 74.5, y: -1.5 },
  lamp: { x: 84, y: -2 },
  bench: { x: 86.6, y: -3.2 },
  house: { x: 92.5, y: -7, w: 7, d: 5 },
  door: { x: 94.4, y: -4.3 },
  /** Where the camera settles whenever Wolt is at the homestead: always the same frame. */
  frame: { x: 85.5, y: -2.5 },
  deerHome: { x: 44, y: 5 },
  cliffX: 112,
  /** Far windows on the hills: other homesteads Wolt cannot reach here. They go dark on their own. */
  far: [{ x: 30, y: -46, end: 9 }, { x: 64, y: -54, end: 19 }, { x: 99, y: -44, end: 33 }],
};
export const TUNE = {
  speed: 5.2, cableLife: 9, sleepTick: 0.55, maxSleep: 40,
  memoryFix: 0.45, memoryVisit: 0.2, memoryDecay: 0.02,
  leaveAfterDark: 10, deerLife: 15, bodyChangeYear: 14,
};

export interface Person { born: number; span: number; x: number; y: number }
export interface Deer { born: number; alive: boolean; x: number; y: number; trust: number; grave: P2 | null }
export interface Input { mx: number; my: number; act: boolean }
export type Ev = 'fix' | 'sleep' | 'year' | 'wake';

const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SLOTS: P2[] = [{ x: 90.5, y: -3.4 }, { x: 92.6, y: -3 }, { x: 89, y: -2.8 }, { x: 95.8, y: -3.2 }];

export class Returns {
  time = 0;
  year = 0;
  wolt = { x: 12, y: 1.5, yaw: Math.PI / 2, speed: 0 };
  /** The cable carries power through this year (inclusive); -1 = broken from the start. */
  okUntil = -1;
  everFixed = false;
  litYears = 0;
  darkYears = 0;
  /** 0..1, how well the homestead remembers Wolt. */
  memory = 0;
  memoryYears = 0;
  /** 0 none, 1 a child's drawing, 2 a sign, 3 a pictogram. */
  symbol = 0;
  people: Person[] = [{ born: -34, span: 60, ...SLOTS[0] }, { born: -6, span: 66, ...SLOTS[1] }];
  left = 0;
  lastBirth = -6;
  deer: Deer = { born: -1, alive: true, ...PLACE.deerHome, trust: 0, grave: null };
  gifts = 0;
  trips = 0;
  visited = false;
  moved = false;
  /** While asleep: years slept so far and time since the last tick. */
  sleep: { n: number; t: number } | null = null;
  fixFlash = 0;
  private lastSide = 0;
  private actWas = false;

  get powered() { return this.okUntil >= this.year; }
  get windowLit() { return this.powered && this.people.length > 0; }
  /** 0 fresh splice .. 1 rusted through. */
  get rust() { return this.powered ? clamp((this.year - (this.okUntil - TUNE.cableLife)) / TUNE.cableLife, 0, 1) : 1; }
  get atHome() { return dist(this.wolt, PLACE.frame) < 14 && this.wolt.x < 104; }
  get nearShelter() { return dist(this.wolt, PLACE.shelter) < 3.6; }
  get nearCable() { return dist(this.wolt, PLACE.cableEnd) < 3; }
  get newBody() { return this.year >= TUNE.bodyChangeYear; }
  age(p: { born: number }) { return this.year - p.born; }
  farLit(i: number) { return this.year < PLACE.far[i].end; }

  /** One year of the world going on without Wolt. */
  stepYear() {
    this.year++;
    const pw = this.powered;
    if (pw) { this.litYears++; this.darkYears = Math.max(0, this.darkYears - 1); } else this.darkYears++;
    this.memory = Math.max(0, this.memory - TUNE.memoryDecay);
    if (this.memory > 0.3 && this.people.length) this.memoryYears++;
    if (this.everFixed && this.symbol < 1) this.symbol = 1;
    if (this.memoryYears >= 10) this.symbol = Math.max(this.symbol, 2);
    if (this.memoryYears >= 22) this.symbol = 3;
    // light lengthens lives, long darkness shortens them
    this.people = this.people.filter(p => this.age(p) <= p.span + Math.min(12, this.litYears * 0.6) - this.darkYears * 0.8);
    if (this.darkYears >= TUNE.leaveAfterDark) {
      const i = this.people.findIndex(p => this.age(p) >= 16 && this.age(p) <= 50);
      if (i >= 0) { this.people.splice(i, 1); this.left++; }
    }
    if (pw && this.people.length < 4 && this.year - this.lastBirth >= 5 && this.people.some(p => this.age(p) >= 20 && this.age(p) <= 40)) {
      this.people.push({ born: this.year, span: 58 + (this.year * 37) % 10, ...PLACE.door });
      this.lastBirth = this.year;
    }
    const d = this.deer;
    if (d.alive && this.age(d) >= TUNE.deerLife) { d.alive = false; d.grave = { x: d.x, y: d.y }; }
  }

  update(dt: number, inp: Input): Ev[] {
    const ev: Ev[] = [];
    this.time += dt;
    const edge = inp.act && !this.actWas;
    this.actWas = inp.act;
    this.fixFlash = Math.max(0, this.fixFlash - dt);
    if (this.sleep) {
      const s = this.sleep; s.t += dt;
      if ((inp.act || s.n < 1) && s.n < TUNE.maxSleep && s.t > TUNE.sleepTick) { s.t = 0; s.n++; this.stepYear(); ev.push('year'); }
      else if (!inp.act && s.n >= 1 && s.t > 0.7) {
        // the longer the sleep, the fewer things are left at the door
        this.gifts = this.people.length && this.memory > 0.1 ? clamp(3 - Math.floor(s.n / 5), 0, 3) : 0;
        this.visited = false; this.sleep = null; ev.push('wake');
      }
      return ev;
    }
    const w = this.wolt;
    const len = Math.hypot(inp.mx, inp.my);
    const target = len > 0.01 ? TUNE.speed : 0;
    w.speed += (target - w.speed) * Math.min(1, dt * 6);
    if (len > 0.01) {
      this.moved = true;
      const want = Math.atan2(inp.mx, inp.my); // yaw 0 faces +y (towards the camera)
      let dy = want - w.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      w.yaw += dy * Math.min(1, dt * 9);
    }
    w.x = clamp(w.x + Math.sin(w.yaw) * w.speed * dt, 1, PLACE.cliffX - 1.2);
    w.y = clamp(w.y + Math.cos(w.yaw) * w.speed * dt, -9, 9);
    this.pushOut(PLACE.house.x, PLACE.house.y, PLACE.house.w / 2 + 0.6, PLACE.house.d / 2 + 0.6);
    this.pushOut(PLACE.shelter.x, PLACE.shelter.y - 3.5, 3.4, 3.2);
    const side = w.x > 80 ? 1 : w.x < 14 ? -1 : 0;
    if (side && side !== this.lastSide) { if (this.lastSide) this.trips++; this.lastSide = side; }

    if (edge) {
      if (this.nearCable && !this.powered) {
        this.okUntil = this.year + TUNE.cableLife; this.everFixed = true; this.fixFlash = 1.2;
        if (this.people.length) this.memory = Math.min(1, this.memory + TUNE.memoryFix);
        ev.push('fix');
      } else if (this.nearShelter) { this.sleep = { n: 0, t: 0 }; this.gifts = 0; ev.push('sleep'); }
    }
    if (this.atHome && !this.visited && this.people.length) {
      this.visited = true;
      if (this.powered && this.everFixed) this.memory = Math.min(1, this.memory + TUNE.memoryVisit);
    }
    this.movePeople(dt);
    this.moveDeer(dt, len > 0.01);
    return ev;
  }

  /** Is this person hiding in the doorway right now? */
  hiding(p: Person) { return this.atHome && this.memory < 0.15 && dist(p, PLACE.door) < 0.6; }
  sitting(p: Person) { return this.age(p) > 58 && dist(p, PLACE.bench) < 0.4; }
  waving(p: Person) { return this.atHome && this.memory > 0.5 && !this.sitting(p); }

  private movePeople(dt: number) {
    const w = this.wolt, home = this.atHome;
    this.people.forEach((p, i) => {
      const a = this.age(p);
      let t: P2 = SLOTS[i % SLOTS.length];
      if (a > 58) t = PLACE.bench;
      else if (home && this.memory < 0.15) t = PLACE.door;             // strangers: back to the doorway
      else if (home && this.memory > 0.5) {
        if (a < 16) {                                                  // children run up to him
          const dx = w.x - PLACE.frame.x, dy = w.y - PLACE.frame.y, l = Math.hypot(dx, dy) || 1, k = Math.max(0, l - 1.6) / l;
          t = { x: PLACE.frame.x + dx * k, y: PLACE.frame.y + dy * k };
        } else t = { x: SLOTS[i % SLOTS.length].x, y: -1.6 };          // adults step out to meet him
      }
      const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy);
      if (l > 0.05) { const v = Math.min(l, (a < 16 ? 3.2 : a > 58 ? 0.8 : 1.6) * dt); p.x += dx / l * v; p.y += dy / l * v; }
    });
  }

  private moveDeer(dt: number, moving: boolean) {
    const d = this.deer, w = this.wolt;
    if (!d.alive) return;
    const dx = w.x - d.x, dy = w.y - d.y, l = Math.hypot(dx, dy) || 1;
    if (l < 9 && !moving) d.trust = Math.min(1, d.trust + dt * 0.2);   // stand still nearby and it gets used to you
    const old = this.age(d) > 11 ? 0.55 : 1;
    if (d.trust < 1) { if (l < 6.5) { d.x -= dx / l * 5 * old * dt; d.y -= dy / l * 5 * old * dt; } }
    else if (l > 3 && l < 22) { d.x += dx / l * 4 * old * dt; d.y += dy / l * 4 * old * dt; }
    d.x = clamp(d.x, 16, 68); d.y = clamp(d.y, -1, 8.5);
  }

  private pushOut(cx: number, cy: number, hw: number, hd: number) {
    const w = this.wolt, dx = w.x - cx, dy = w.y - cy;
    if (Math.abs(dx) >= hw || Math.abs(dy) >= hd) return;
    if (hw - Math.abs(dx) < hd - Math.abs(dy)) w.x = cx + Math.sign(dx || 1) * hw; else w.y = cy + Math.sign(dy || 1) * hd;
  }
}
