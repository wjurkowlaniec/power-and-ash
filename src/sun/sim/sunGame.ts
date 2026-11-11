import { SailGame, Events } from '../../sail/sim/sailGame';
import { YachtInput, newYacht } from '../../sail/sim/landYacht';
import { CloudField, CLOUDS } from './clouds';
import { Mission, MISSIONS } from './missions';

/**
 * Tech demo "Słońce": the land yacht from "Żegluga" with solar panels, carrying a load that
 * must stay lit. Clouds drift over the map; in their shadow the load runs off a small buffer
 * (about 20 s in full shade) and dies when it is empty. Pure logic, the view only reads it.
 */
export const SUN = {
  /** Seconds of full shade the buffer lasts. */
  buffer: 20,
  /** Light the load needs (1 = full sun); below it the buffer drains, above it it refills. */
  need: 0.55,
  /** Seconds of buffer won back per second in full sun. */
  refill: 2.2,
  /** Battery (0..1) per second the panels give Wolt in full sun once the load is full. */
  trickle: 0.012,
  /** Radius of A and B, m; slower than this counts as stopped; seconds to load and unload. */
  zone: 9, still: 1.6, handle: 1.5,
} as const;

export type Phase = 'toPickup' | 'loading' | 'carrying' | 'unloading' | 'done' | 'failed';

export interface SunEvents extends Events {
  loaded: boolean; delivered: number | null; lost: boolean; record: boolean;
  /** The load just went into shade (true) or came back into the sun (false); null = no change. */
  shade: boolean | null;
}

export interface Delivery {
  mission: Mission;
  phase: Phase;
  /** Seconds of buffer left. */
  buffer: number;
  /** Seconds stopped in A or B (loading / unloading progress). */
  handling: number;
  /** Time since loading, and of that in the shade. */
  time: number; shadeTime: number;
}

/** How the buffer changes at a given light, in s per s (+ refill, − drain). Full shade drains exactly 1. */
export function bufferRate(light: number): number {
  const { need, refill } = SUN;
  if (light >= need) return refill * (light - need) / (1 - need);
  return -(need - light) / (need - CLOUDS.lightMin);
}

export class SunGame extends SailGame {
  clouds: CloudField;
  delivery: Delivery;
  /** Light on the panels now, 1 full sun. */
  light = 1;
  bestSun: Record<string, number> = {};
  private wasShade = false;

  constructor(mission: Mission = MISSIONS[0]) {
    super();
    this.clouds = new CloudField(mission.cover, mission.seed);
    this.delivery = this.fresh(mission);
    this.place(mission);
  }

  private fresh(m: Mission): Delivery { return { mission: m, phase: 'toPickup', buffer: SUN.buffer, handling: 0, time: 0, shadeTime: 0 }; }

  private place(m: Mission) {
    this.yacht = newYacht(m.start.x, m.start.y, m.heading, this.yacht?.gear ?? m.gear);
    this.here = this.wind.at(m.start.x, m.start.y);
  }

  /** Start a mission from the beginning (new sky for a new mission, the same sky for a retry). */
  setMission(m: Mission) {
    if (m !== this.delivery.mission) this.clouds = new CloudField(m.cover, m.seed);
    this.delivery = this.fresh(m);
    this.place(m);
  }

  restartMission() { this.setMission(this.delivery.mission); }

  cycleMission() {
    const i = MISSIONS.indexOf(this.delivery.mission);
    this.setMission(MISSIONS[(i + 1) % MISSIONS.length]);
  }

  /** Where to go next. */
  get target() { const d = this.delivery; return d.phase === 'toPickup' || d.phase === 'loading' ? d.mission.a : d.mission.b; }

  update(dt: number, input: YachtInput): SunEvents {
    const ev = super.update(dt, input);
    const out: SunEvents = { ...ev, loaded: false, delivered: null, lost: false, record: false, shade: null };
    const m = this.delivery.mission, d = this.delivery, y = this.yacht;
    // the sky drifts with the base wind, slower than the air near the ground
    this.clouds.update(dt, this.wind.dir, this.wind.speed * m.cloudK);
    this.light = this.clouds.lightAt(y.x, y.y);
    const inShade = this.light < SUN.need;
    if (d.phase === 'carrying' || d.phase === 'unloading') {
      // the "into the shade / back in the sun" events have a little hysteresis so a ragged edge does not chatter
      const now = this.wasShade ? this.light < SUN.need + 0.06 : inShade;
      if (now !== this.wasShade) out.shade = now;
      this.wasShade = now;
    } else this.wasShade = false;

    const stopped = y.speed < SUN.still && y.capsized <= 0;
    const at = (p: { x: number; y: number }) => Math.hypot(y.x - p.x, y.y - p.y) < SUN.zone;

    if (d.phase === 'carrying' || d.phase === 'unloading') {
      d.time += dt;
      if (inShade) d.shadeTime += dt;
      d.buffer = Math.min(SUN.buffer, d.buffer + bufferRate(this.light) * dt);
      if (d.buffer <= 0) { d.buffer = 0; d.phase = 'failed'; out.lost = true; return out; }
    }
    // spare sun goes into Wolt's battery once the load (if any) is full
    if (d.phase !== 'carrying' && d.phase !== 'unloading' || d.buffer >= SUN.buffer) {
      if (this.light > SUN.need) y.energy = Math.min(1, y.energy + SUN.trickle * (this.light - SUN.need) / (1 - SUN.need) * dt);
    }

    switch (d.phase) {
      case 'toPickup': case 'loading':
        if (at(m.a) && stopped) {
          d.phase = 'loading'; d.handling += dt;
          if (d.handling >= SUN.handle) { d.phase = 'carrying'; d.handling = 0; d.buffer = SUN.buffer; out.loaded = true; }
        } else { d.phase = 'toPickup'; d.handling = 0; }
        break;
      case 'carrying': case 'unloading':
        if (at(m.b) && stopped) {
          d.phase = 'unloading'; d.handling += dt;
          if (d.handling >= SUN.handle) {
            d.phase = 'done'; d.handling = 0; out.delivered = d.time;
            const best = this.bestSun[m.id];
            if (best === undefined || d.time < best) { this.bestSun[m.id] = d.time; out.record = true; }
          }
        } else { d.phase = 'carrying'; d.handling = 0; }
        break;
    }
    return out;
  }
}
