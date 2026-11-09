import { Cable } from '../../sim/cable';
import { V2, dist, len, sub } from '../../sim/vec';
import { World, Obstacle } from '../../sim/world';
import { Load, LOADS, towDrive, TOW_RANGE } from '../../sim/tow';
import { drive, settle } from '../../sim/drive';
import { bodyOk, guardTurn } from '../../sim/footprint';
import { tr, num } from '../../i18n';

/**
 * Scene 2. Martwa stacja (docs/POCZATEK.md), part one, pure logic. Wolt leaves the hall
 * into the yard of Stacja Pomiarowa „Olszanka”. Everything is dead.
 *
 * 1. The workshop door has an electric lock. The technician's note on it says: plug into
 *    the port on the left. Wolt's own 3 m cable opens it, and his battery pays for it.
 * 2. The fabricator in the workshop wants more power than Wolt can give (200 W).
 * 3. The same note: the turbine bearing, grease in the storage room, second shelf. The
 *    bearing is too heavy to carry: put it on the old tyre and drag it to the mast.
 * 4. With bearing and grease at the mast: climb and swap the bearing. The turbine turns.
 * The duty room has the manager's memo in a drawer and a map on the wall.
 *
 * 1 tile = 1 m, y grows towards the camera (south).
 */
export const ST_W = 40;
export const ST_H = 28;
export const PLAYER_R = 0.32;
export const USE_RANGE = 1.5;
export const SPEED = 2.6;      // m/s
export const RUN_MULT = 1.6;
export const OWN_CABLE = 3;    // m of Wolt's own cable
export const DOOR_COST = 6;    // % of the battery to open the lock
export const MOVE_COST = 0.04; // % per metre
export const TOW_COST = 0.06;  // extra % per metre with a load
export const REPAIR_TIME = 3.5;  // s holding E at the mast
export const FAB_POWER = 600;    // W the fabricator needs
export const WOLT_POWER = 200;   // W Wolt can give
export const CABLE_MAX = 18;     // m of cable on the drum at the mast foot
export const CABLE_WARN = 15.5;
export const POWERED_HOLD = 6;   // s of the machine room waking before the scene moves on
export const RECHARGE = 0.15;    // %/s Q-1 recovers while resting
export const TURBINE_POWER = 1200; // W the repaired turbine gives in this wind
export const MACHINE_POWER = 250;  // W the machine room draws once it wakes (control, lights, pumps)

/** One line of a power balance. Wolt's in %/s of Q-1, the station's in W. */
export interface Flow { label: string; rate: number; state?: 'off' | 'wait' | 'on' }

export type Item = 'grease' | 'bearing';

/** Rooms: walls one tile thick with door gaps. */
interface Room { id: string; name: string; x: number; y: number; w: number; h: number; doors: { x: number; w: number }[] }

export const ROOMS: Room[] = [
  { id: 'hall', name: 'hala pomiarowa', x: 1, y: 3, w: 7, h: 10, doors: [{ x: 5, w: 2 }] },
  { id: 'workshop', name: 'warsztat', x: 8, y: 3, w: 8, h: 10, doors: [{ x: 11, w: 2 }] },
  { id: 'duty', name: 'dyżurka', x: 16, y: 3, w: 6, h: 10, doors: [{ x: 18, w: 2 }] },
  { id: 'storage', name: 'magazyn', x: 22, y: 3, w: 8, h: 10, doors: [{ x: 25, w: 2 }] },
  { id: 'machine', name: 'maszynownia', x: 30, y: 3, w: 7, h: 10, doors: [{ x: 32, w: 2 }] },
];

export const P = {
  start: { x: 6, y: 14.2 },
  workshopDoor: { x: 12, y: 12.5 },
  port: { x: 10.2, y: 13.6 },          // port on the left of the workshop door, outside
  doorNote: { x: 13.4, y: 13.6 },      // the technician's note, pinned next to the door
  fabricator: { x: 11, y: 6 },
  drawer: { x: 20, y: 5.2 },
  wallMap: { x: 17.6, y: 6.5 },
  books: { x: 20.3, y: 9.5 },          // a shelf of books in the duty room: lots of text for the corpus
  shelf: { x: 26, y: 5.2 },            // second shelf: grease and the bearing
  machineDoor: { x: 33, y: 12.5 },     // blocked by a fallen cabinet (next part)
  mast: { x: 22, y: 21 },
  mastUse: { x: 22, y: 22.6 },
  tyre: { x: 14.5, y: 19.5 },
  junction: { x: 23.5, y: 22.5 },      // cable drum at the mast foot (after the turbine turns)
  socket: { x: 35.4, y: 13.6 },        // the machine room's outside power inlet
  shed: { x: 31, y: 18, w: 6, h: 6 },
};

function walls(): Obstacle[] {
  const o: Obstacle[] = [];
  const add = (x: number, y: number, w: number, h: number) => o.push({ kind: 'container', x, y, w, h });
  // one long north wall and the south wall with door gaps; partition walls between rooms
  const x0 = ROOMS[0].x, x1 = ROOMS[ROOMS.length - 1].x + ROOMS[ROOMS.length - 1].w;
  add(x0, 3, x1 - x0, 1);
  for (const r of ROOMS) {
    let x = r.x;
    for (const d of r.doors) { if (d.x > x) add(x, r.y + r.h - 1, d.x - x, 1); x = d.x + d.w; }
    if (r.x + r.w > x) add(x, r.y + r.h - 1, r.x + r.w - x, 1);
    add(r.x, 4, 1, r.h - 2);
  }
  add(x1 - 1, 4, 1, 8);
  return o;
}

export function stationObstacles(): Obstacle[] {
  const o = walls();
  const add = (kind: Obstacle['kind'], x: number, y: number, w: number, h: number) => o.push({ kind, x, y, w, h });
  // the hall door is shut behind us (the hall is done)
  add('container', 5, 12, 2, 1);
  // workshop: locked door, fabricator, workbench
  add('crate', 11, 12, 2, 1);           // id 'workshopDoor' (removed when opened)
  add('crate', 10, 4, 2, 2);            // fabricator
  add('crate', 13, 4, 2, 1);            // workbench
  // duty room: desk with the drawer
  add('crate', 19, 4, 2, 1);
  add('crate', 21, 8, 1, 3);            // bookshelf
  // storage: shelves along the north wall, crates
  add('crate', 23, 4, 6, 1);
  add('crate', 23, 9, 2, 2);
  // machine room door blocked by a fallen cabinet
  add('crate', 32, 12, 2, 1);
  // yard: mast, weather balloon launcher, shed, scrap, fence
  add('pylon', 21, 20, 2, 2);
  add('crate', 17, 24, 2, 2);           // balloon launcher
  add('station', P.shed.x, P.shed.y, P.shed.w, P.shed.h);
  add('rock', 8, 22, 2, 2);
  add('rock', 27, 25, 2, 1);
  add('scrap', 12, 16, 2, 1);
  add('scrap', 26, 16, 1, 2);
  add('barrel', 8, 15, 1, 1);
  add('tree', 3, 20, 1, 1);
  add('tree', 38, 15, 1, 1);
  add('tree', 2, 26, 1, 1);
  return o;
}

export interface StHint { key: string; text: string; at: V2; ok: boolean; progress?: number }
export type StEvent = 'grab' | 'drop' | 'connect' | 'step' | 'plug' | 'door' | 'deny' | 'pickup' | 'hook' | 'unhook' | 'load' | 'repair' | 'turbine' | 'note' | 'tow';

type Target = 'books' | 'junction' | 'cableEnd' | 'socket' | 'port' | 'door' | 'doorNote' | 'fabricator' | 'drawer' | 'wallMap' | 'shelf' | 'tyre' | 'mast' | 'machineDoor';

export class Station {
  readonly world = new World(ST_W, ST_H, stationObstacles());
  pos: V2 = { ...P.start };
  facing = 0;
  /** Forward speed along `facing`, m/s. */
  speed = 0;
  moving = false;
  /** Driving but held back (a snagged tyre): the wheel spins. */
  strain = false;
  t = 0;
  battery: number;
  doorOpen = 0;       // 0..1
  plugged = 0;        // s left of the "plugged into the port" moment
  items = new Set<Item>();
  shelfTaken = false;   // the bearing left the shelf
  bearingOnTyre = false;
  tyre: Load = { id: 'tyre', kind: 'tyre', pos: { ...P.tyre }, angle: 0.3 };
  towing = false;
  towTaut = false;
  repair = 0;
  turbine = false;
  /** Cable from the mast drum to the machine room inlet. */
  cable: Cable | null = null;
  cableHeld = false;
  machinePowered = false;
  poweredT = 0;
  turbineT = 0;
  reading: string | null = null;
  notesRead = new Set<string>();
  mapSeen = false;
  done = false;
  message: { text: string; t: number } | null = null;
  events: StEvent[] = [];
  private stepAcc = 0;
  private idle = 0;
  /** True while Q-1 recovers at rest (for the HUD). */
  charging = false;
  /** Smoothed drain of Q-1 by cause, %/s (for the HUD balance). */
  private drive = 0;
  private towDrain = 0;
  private denyT = 0;
  private lastStep = 0;

  constructor(battery = 58) { this.battery = battery; }

  private say(text: string) { this.message = { text, t: this.t }; }
  closeNote() { this.reading = null; }

  private point(t: Target): V2 {
    if (t === 'cableEnd') return this.cable ? this.cable.end : P.junction;
    return t === 'tyre' ? this.tyre.pos : t === 'door' ? P.workshopDoor : t === 'mast' ? P.mastUse : (P as unknown as Record<string, V2>)[t];
  }

  nearest(): Target | null {
    const on: Target[] = ['port', 'doorNote', 'drawer', 'wallMap', 'books', 'machineDoor', 'mast'];
    if (this.doorOpen >= 1) on.push('fabricator'); else on.push('door');
    if (!this.shelfTaken) on.push('shelf');
    if (!this.turbine) on.push('tyre');
    if (this.turbine && !this.cable) on.push('junction');
    if (this.cable && !this.cableHeld && !this.machinePowered) on.push('cableEnd');
    if (!this.machinePowered) on.push('socket');
    let best: Target | null = null, bd = USE_RANGE;
    for (const id of on) {
      const p = this.point(id);
      const r = id === 'tyre' ? LOADS.tyre.radius + TOW_RANGE - USE_RANGE + 0.6 : 0;
      if (id === 'tyre' && this.towing) continue; // handled below
      const d = dist(p, this.pos) - r;
      if (d < bd) { bd = d; best = id; }
    }
    // a hooked tyre is always right behind: E unhooks it when nothing else is in reach
    if (!best && this.towing) best = 'tyre';
    return best;
  }

  /** Q-1 balance line by line (%/s): what drains Wolt right now and what refills him. */
  flows(): Flow[] {
    const f: Flow[] = [];
    if (this.drive > 0.002) f.push({ label: tr('jazda', 'driving'), rate: -this.drive });
    if (this.towDrain > 0.002) f.push({ label: this.bearingOnTyre ? tr('ciągnie oponę z łożyskiem', 'towing the tyre with the bearing') : tr('ciągnie oponę', 'towing the tyre'), rate: -this.towDrain });
    if (this.repair > 0) f.push({ label: tr('praca przy maszcie', 'work at the mast'), rate: 0 });
    if (this.charging) f.push({ label: tr('postój (Q-1 się odnawia)', 'resting (Q-1 recovers)'), rate: RECHARGE });
    if (!f.length) f.push({ label: this.battery >= 100 ? tr('pełna', 'full') : tr('czeka na postój', 'waits for a rest'), rate: 0 });
    return f;
  }

  /** The station's own grid in W: sources and consumers, once Wolt has seen the fabricator. */
  grid(): { sources: Flow[]; loads: Flow[]; balance: number } | null {
    if (this.doorOpen < 1) return null;
    const sources: Flow[] = [
      { label: tr('turbina na maszcie', 'turbine on the mast'), rate: this.turbine && this.machinePowered ? TURBINE_POWER : 0, state: this.turbine ? (this.machinePowered ? 'on' : 'wait') : 'off' },
      { label: tr(`Wolt (Q-1, maks. ${WOLT_POWER} W)`, `Wolt (Q-1, max ${WOLT_POWER} W)`), rate: 0, state: 'off' },
    ];
    const loads: Flow[] = [
      { label: tr('maszynownia', 'machine room'), rate: this.machinePowered ? -MACHINE_POWER : 0, state: this.machinePowered ? 'on' : 'off' },
      { label: tr('fabrykator', 'fabricator'), rate: 0, state: this.machinePowered ? 'wait' : 'off' },
    ];
    const balance = [...sources, ...loads].reduce((a, x) => a + x.rate, 0);
    return { sources, loads, balance };
  }

  hint(): StHint | null {
    if (this.reading || this.done) return null;
    const n = this.nearest();
    if (!n) return null;
    const at = this.point(n);
    switch (n) {
      case 'junction': return { key: 'E', text: tr(`bęben kabla pod masztem (${CABLE_MAX} m): weź koniec`, `cable drum under the mast (${CABLE_MAX} m): take the end`), at, ok: true };
      case 'cableEnd': return { key: 'E', text: tr('podnieś koniec kabla', 'pick up the cable end'), at, ok: true };
      case 'socket': return this.cableHeld
        ? { key: 'E', text: tr('wepnij kabel z turbiny w przyłącze', 'plug the turbine cable into the inlet'), at, ok: true }
        : { key: 'E', text: tr('przyłącze maszynowni: bez zasilania', 'machine room inlet: no power'), at, ok: false };
      case 'port': return this.doorOpen > 0
        ? { key: 'E', text: tr('port zamka (drzwi otwarte)', 'lock port (door open)'), at, ok: false }
        : { key: 'E', text: tr(`wepnij własny kabel (${OWN_CABLE} m) i zasil zamek`, `plug in your own cable (${OWN_CABLE} m) and power the lock`), at, ok: true };
      case 'door': return { key: 'E', text: tr('drzwi warsztatu: zamek elektryczny bez prądu', 'workshop door: electric lock, no power'), at, ok: false };
      case 'doorNote': return { key: 'E', text: this.notesRead.has('kartkaTechnika') ? tr('kartka technika (jeszcze raz)', "technician's note (again)") : tr('kartka na drzwiach', 'note on the door'), at, ok: true };
      case 'fabricator': return { key: 'E', text: tr('fabrykator', 'fabricator'), at, ok: true };
      case 'drawer': return { key: 'E', text: this.notesRead.has('notatkaKierowniczki') ? tr('szuflada (jeszcze raz)', 'drawer (again)') : tr('otwórz szufladę', 'open the drawer'), at, ok: true };
      case 'wallMap': return { key: 'E', text: tr('mapa na ścianie', 'map on the wall'), at, ok: true };
      case 'books': return { key: 'E', text: this.notesRead.has('slownik') ? tr('książki (zeskanowane)', 'books (scanned)') : this.notesRead.has('podrecznik') ? tr('zeskanuj drugą książkę', 'scan the second book') : tr('półka z książkami: zeskanuj', 'bookshelf: scan'), at, ok: true };
      case 'shelf': return { key: 'E', text: this.items.has('grease') ? (this.towing ? tr('połóż łożysko na oponie', 'put the bearing on the tyre') : tr('łożysko: za ciężkie, by nieść', 'bearing: too heavy to carry')) : tr('druga półka: smar i łożysko', 'second shelf: grease and bearing'), at, ok: true };
      case 'tyre': return this.towing
        ? { key: 'E', text: tr('odczep oponę', 'unhitch the tyre'), at, ok: true }
        : { key: 'E', text: this.bearingOnTyre ? tr('doczep oponę z łożyskiem', 'hitch the tyre with the bearing') : tr('doczep oponę (jak sanki)', 'hitch the tyre (like a sled)'), at, ok: true };
      case 'machineDoor': return { key: 'E', text: tr('przejście zablokowane przewróconą szafą', 'doorway blocked by a fallen cabinet'), at, ok: false };
      case 'mast': {
        if (this.turbine) return { key: '·', text: tr('turbina się kręci', 'the turbine is turning'), at, ok: true };
        const bearingHere = this.bearingOnTyre && dist(this.tyre.pos, P.mastUse) < 3.2;
        if (!bearingHere || !this.items.has('grease')) {
          const miss = [!this.bearingOnTyre ? tr('nowe łożysko', 'a new bearing') : !bearingHere ? tr('łożysko bliżej masztu', 'the bearing closer to the mast') : '', !this.items.has('grease') ? tr('smar', 'grease') : ''].filter(Boolean).join(tr(' i ', ' and '));
          return { key: 'E', text: tr(`łożysko turbiny zatarte · potrzeba: ${miss}`, `turbine bearing seized · needs: ${miss}`), at, ok: false };
        }
        return { key: 'E', text: tr('przytrzymaj: wejdź po drabince i wymień łożysko', 'hold: climb the ladder and replace the bearing'), at, ok: true, progress: this.repair / REPAIR_TIME };
      }
    }
  }

  /** What Wolt can see from the door note onwards (objectives come from notes, not a list). */
  update(dt: number, inp: { move: V2; run: boolean; use: boolean; usePressed: boolean; drop?: boolean }) {
    this.t += dt;
    if (this.message && this.t - this.message.t > 5) this.message = null;
    this.denyT = Math.max(0, this.denyT - dt);
    this.plugged = Math.max(0, this.plugged - dt);
    if (this.doorOpen > 0 && this.doorOpen < 1) {
      this.doorOpen = Math.min(1, this.doorOpen + dt / 1.2);
      if (this.doorOpen >= 1) {
        const d = this.world.obstacles.find(o => o.x === 11 && o.y === 12 && o.kind === 'crate');
        if (d) this.world.remove(d);
      }
    }
    if (this.turbine) this.turbineT += dt;
    if (this.machinePowered) this.poweredT += dt;
    if (this.reading) { this.moving = false; this.speed = 0; return; }
    if (inp.drop && this.towing) { this.towing = false; this.towTaut = false; this.events.push('unhook'); }
    else if (inp.drop && this.cableHeld) { this.cableHeld = false; this.events.push('drop'); }
    this.move(dt, inp);
    this.use(dt, inp);
    // Q-1 slowly recovers while the body rests (nothing drawn from it)
    this.idle = this.moving || this.repair > 0 ? 0 : this.idle + dt;
    this.charging = this.idle > 1 && this.battery < 100;
    if (this.charging) this.battery = Math.min(100, this.battery + RECHARGE * dt);
    // what this frame cost, smoothed so the HUD numbers do not flicker
    const k = Math.min(1, dt * 4), d = dt > 0 ? this.lastStep / dt : 0;
    this.drive += (d * MOVE_COST - this.drive) * k;
    this.towDrain += ((this.towing ? d * TOW_COST : 0) - this.towDrain) * k;
    this.lastStep = 0;
    if (this.machinePowered && this.poweredT > POWERED_HOLD && !this.done) this.done = true;
  }

  private move(dt: number, inp: { move: V2; run: boolean }) {
    const want = len(inp.move) > 0.01 && this.repair === 0;
    let sp = SPEED * (inp.run ? RUN_MULT : 1);
    if (this.cableHeld && this.cableLength() > CABLE_WARN) sp *= 0.6;
    if (this.towing) sp *= 1 - LOADS.tyre.drag * (this.bearingOnTyre ? 2.2 : 1);
    if (this.battery < 5) sp *= 0.5;
    const f0 = this.facing;
    let step = drive(this, dt, want ? inp.move : { x: 0, y: 0 }, sp);
    const tyreOk = (c: V2) => this.towing || dist(c, this.tyre.pos) >= PLAYER_R + LOADS.tyre.radius;
    // the nose and the reel must not swing into a wall (src/sim/footprint.ts)
    const g = guardTurn(this.world, this.pos, f0, this.facing, PLAYER_R, c => tyreOk(c) && (!this.cableHeld || this.cableOk(c)));
    if (g.facing !== this.facing) { this.facing = g.facing; step = { x: Math.cos(this.facing) * this.speed * dt, y: Math.sin(this.facing) * this.speed * dt }; }
    if (g.pos !== this.pos) { this.pos = g.pos; if (this.cableHeld) this.cable!.moveEnd(this.world, this.pos); }
    const intended = len(step);
    this.strain = false;
    if (intended < 1e-6) { this.moving = false; if (!want) this.towTaut = false; return; }
    const before = { ...this.pos };
    const free = (c: V2) => bodyOk(this.world, this.pos, this.facing, c, this.facing, PLAYER_R) && tyreOk(c);
    let cand = { ...this.pos };
    for (const s of [{ x: step.x, y: 0 }, { x: 0, y: step.y }]) {
      const c = { x: cand.x + s.x, y: cand.y + s.y };
      if (!free(c)) continue;
      if (this.cableHeld && !this.cableOk(c)) {
        if (this.denyT === 0) { this.denyT = 3; this.say(tr(`Kabel się skończył (${CABLE_MAX} m). Poprowadź go krótszą drogą.`, `Out of cable (${CABLE_MAX} m). Take a shorter route.`)); }
        continue;
      }
      cand = c;
    }
    if (this.towing) {
      const r = towDrive(this.world, this.tyre, this.pos, cand, this.facing, free);
      this.tyre.pos = r.step.pos; this.tyre.angle = r.step.angle; this.towTaut = r.step.taut;
      if (r.step.blocked && dist(r.pos, before) < intended * 0.35 && this.denyT === 0) { this.denyT = 2; this.say(tr('Opona o coś zaczepiła. Objedź przeszkodę albo odczep oponę (Q).', 'The tyre snagged on something. Drive around it or unhitch it (Q).')); }
      cand = r.pos;
    }
    this.pos = cand;
    if (this.cableHeld) this.cable!.moveEnd(this.world, this.pos);
    const d = dist(before, this.pos);
    settle(this, d, dt);
    this.moving = d > 1e-5;
    this.strain = want && d < intended * 0.35;
    this.lastStep = d;
    this.battery = Math.max(0, this.battery - d * (MOVE_COST + (this.towing ? TOW_COST : 0)));
    this.stepAcc += d;
    if (this.stepAcc > 0.8) { this.stepAcc = 0; this.events.push(this.towing && this.towTaut ? 'tow' : 'step'); }
  }

  private use(dt: number, inp: { use: boolean; usePressed: boolean }) {
    const n = this.nearest();
    if (n !== 'mast' || !inp.use) this.repair = Math.max(0, this.repair - dt * 2);
    if (!n) return;
    const pressed = inp.usePressed;
    switch (n) {
      case 'junction':
        if (!pressed) break;
        this.cable = new Cable({ ...P.junction }, { ...this.pos });
        this.cableHeld = true; this.events.push('grab');
        this.say(tr(`Koniec kabla w chwytaku. ${CABLE_MAX} m na bębnie. Przyłącze maszynowni jest na jej ścianie od podwórza.`, `Cable end in the gripper. ${CABLE_MAX} m on the drum. The machine room inlet is on its yard-side wall.`));
        break;
      case 'cableEnd':
        if (!pressed || !this.cable) break;
        this.cableHeld = true; this.cable.moveEnd(this.world, this.pos); this.events.push('grab');
        break;
      case 'socket':
        if (!pressed) break;
        if (!this.cableHeld) {
          if (this.denyT === 0) { this.denyT = 1; this.events.push('deny'); this.say(this.turbine ? tr('Przyłącze jest martwe. Kabel z turbiny trzeba tu przyciągnąć.', 'The inlet is dead. The turbine cable has to be brought here.') : tr('Przyłącze maszynowni. Nic tu nie płynie.', 'Machine room inlet. Nothing flows here.')); }
          break;
        }
        this.cable!.moveEnd(this.world, P.socket);
        this.cableHeld = false; this.machinePowered = true; this.poweredT = 0;
        this.events.push('connect');
        this.say(tr('Prąd z turbiny płynie do maszynowni. Za ścianą coś budzi się z brzęczeniem.', 'Power from the turbine flows into the machine room. Behind the wall something wakes up with a hum.'));
        break;
      case 'port':
        if (!pressed || this.doorOpen > 0) break;
        this.battery = Math.max(0, this.battery - DOOR_COST);
        this.plugged = 1.6; this.doorOpen = 0.001;
        this.events.push('plug', 'door');
        this.say(tr(`Zamek puścił. Kosztowało to ${DOOR_COST}% baterii: wszystko, co zasilasz z siebie, to twoje życie.`, `The lock gave way. It cost ${DOOR_COST}% of the battery: everything you power from yourself is your life.`));
        break;
      case 'door':
        if (pressed && this.denyT === 0) { this.denyT = 1; this.events.push('deny'); this.say(tr('Zamknięte. Zamek elektryczny nie ma prądu.', 'Locked. The electric lock has no power.')); }
        break;
      case 'doorNote':
        if (pressed) this.read('kartkaTechnika');
        break;
      case 'drawer':
        if (pressed) this.read('notatkaKierowniczki');
        break;
      case 'books':
        if (pressed) this.read(this.notesRead.has('podrecznik') ? 'slownik' : 'podrecznik');
        break;
      case 'wallMap':
        if (pressed) { this.mapSeen = true; this.read('mapaSieci'); }
        break;
      case 'fabricator':
        if (pressed && this.denyT === 0) {
          this.denyT = 1; this.events.push('deny');
          this.say(tr(`Fabrykator potrzebuje ok. ${FAB_POWER} W. Wolt da najwyżej ${WOLT_POWER} W. Trzeba uruchomić turbinę.`, `The fabricator needs about ${FAB_POWER} W. Wolt can give at most ${WOLT_POWER} W. The turbine has to be started.`));
        }
        break;
      case 'shelf':
        if (!pressed) break;
        if (!this.items.has('grease')) { this.items.add('grease'); this.events.push('pickup'); }
        if (this.towing && dist(this.tyre.pos, this.pos) < 3) {
          this.shelfTaken = true; this.bearingOnTyre = true; this.events.push('load');
          this.say(tr('Smar w chwytaku, łożysko na oponie.', 'Grease in the gripper, bearing on the tyre.'));
        } else this.say(tr('Smar wzięty. Łożysko jest za ciężkie, żeby je nieść. Przyciągnij tu oponę i połóż je na niej.', 'Grease taken. The bearing is too heavy to carry. Drag the tyre here and put it on that.'));
        break;
      case 'tyre':
        if (!pressed) break;
        this.towing = !this.towing;
        this.events.push(this.towing ? 'hook' : 'unhook');
        break;
      case 'machineDoor':
        if (pressed && this.denyT === 0) { this.denyT = 1; this.events.push('deny'); this.say(tr('Szafa leży w przejściu. Ciało tego nie podniesie.', "The cabinet lies across the doorway. This body can't lift it.")); }
        break;
      case 'mast': {
        if (this.turbine) break;
        const bearingHere = this.bearingOnTyre && dist(this.tyre.pos, P.mastUse) < 3.2;
        if (!bearingHere || !this.items.has('grease')) {
          if (pressed && this.denyT === 0) {
            this.denyT = 1; this.events.push('deny');
            this.say(!this.items.has('grease') && !this.bearingOnTyre ? tr('Łożysko się zatarło. Potrzeba nowego łożyska i smaru.', 'The bearing has seized. A new bearing and grease are needed.') : !this.bearingOnTyre ? tr('Brakuje łożyska.', 'The bearing is missing.') : !this.items.has('grease') ? tr('Brakuje smaru.', 'The grease is missing.') : tr('Przyciągnij łożysko bliżej masztu.', 'Drag the bearing closer to the mast.'));
          }
          break;
        }
        if (inp.use) {
          this.repair += dt;
          if (Math.random() < dt * 3) this.events.push('repair');
          if (this.repair >= REPAIR_TIME) {
            this.repair = 0; this.turbine = true; this.items.delete('grease'); this.bearingOnTyre = false;
            this.battery = Math.max(0, this.battery - 3);
            this.events.push('turbine');
            this.say(tr('Turbina rusza. Pod masztem jest bęben z kablem do maszynowni.', 'The turbine starts. Under the mast there is a drum of cable for the machine room.'));
          }
        }
        break;
      }
    }
  }

  /** One quiet line about what Wolt is after right now (from what he has seen so far). */
  goal(): string {
    if (this.machinePowered) return tr('Maszynownia ma prąd.', 'The machine room has power.');
    if (this.cableHeld) return tr(`Doprowadź kabel do przyłącza na ścianie maszynowni (${num(this.cableLength())} / ${CABLE_MAX} m).`, `Bring the cable to the inlet on the machine room wall (${num(this.cableLength())} / ${CABLE_MAX} m).`);
    if (this.cable) return tr('Kabel leży na ziemi. Podnieś koniec i doprowadź go do maszynowni.', 'The cable lies on the ground. Pick up the end and bring it to the machine room.');
    if (this.turbine) return tr('Turbina się kręci. Pod masztem jest bęben z kablem: prąd trzeba doprowadzić do maszynowni.', 'The turbine is turning. Under the mast there is a cable drum: the power has to reach the machine room.');
    if (this.doorOpen === 0) return tr('Drzwi warsztatu mają zamek elektryczny. Po lewej jest port.', 'The workshop door has an electric lock. There is a port on the left.');
    if (!this.bearingOnTyre && !this.items.has('grease')) return tr('Turbina na maszcie stoi: zatarte łożysko. Nowe łożysko i smar są w magazynie, na drugiej półce.', 'The turbine on the mast is stuck: a seized bearing. A new bearing and grease are in the storeroom, on the second shelf.');
    if (!this.bearingOnTyre) return this.towing ? tr('Zaciągnij oponę pod półkę w magazynie i połóż na niej łożysko.', 'Drag the tyre to the shelf in the storeroom and put the bearing on it.') : tr('Łożysko jest za ciężkie. Stara opona na podwórzu posłuży jak sanki.', 'The bearing is too heavy. The old tyre in the yard will do as a sled.');
    if (!this.items.has('grease')) return tr('Brakuje jeszcze smaru z drugiej półki.', 'Still missing the grease from the second shelf.');
    return tr('Zaciągnij łożysko pod maszt i wymień je (przytrzymaj E).', 'Drag the bearing to the mast and replace it (hold E).');
  }

  cableLength(): number { return this.cable ? this.cable.length() : 0; }
  private cableOk(p: V2): boolean {
    const c = this.cable!.clone();
    c.moveEnd(this.world, p);
    const l = c.length();
    return l <= CABLE_MAX || l < this.cable!.length();
  }

  private read(id: string) { this.reading = id; this.notesRead.add(id); this.events.push('note'); }

  /** True while the tyre is close enough behind to drag (for HUD). */
  tyreDist(): number { return dist(this.tyre.pos, this.pos); }
  shelfDir(): V2 { return sub(P.shelf, this.pos); }
}
