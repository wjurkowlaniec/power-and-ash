import { V2 } from '../../sim/vec';
import { buildObstacles, Obstacle, surfaceAt, slopeAt, heightAt, START } from './terrain';
import { WindField, WindSample } from './windField';
import { YachtState, newYacht, yachtStep, startSwap, YachtInput, StepEvents, World } from './landYacht';
import { COURSES, Course, Run, newRun, runStep } from './courses';

/**
 * The land yacht driving demo as a whole: the map, the wind over it, the yacht, an optional
 * course against the clock and a few numbers worth beating. Pure logic; the view and the
 * HUD only read it.
 */
export interface Stats { top: number; dist: number; flying: number; longestFly: number; capsizes: number }

export interface Events extends StepEvents { gate: number; finished: number | null; record: boolean }

export class SailGame {
  readonly obstacles: Obstacle[] = buildObstacles();
  readonly world: World = { surfaceAt, slopeAt, obstacles: this.obstacles };
  readonly wind: WindField;
  yacht: YachtState;
  /** The wind right at the yacht (this frame). */
  here: WindSample;
  run: Run | null = null;
  best: Record<string, number> = {};
  stats: Stats = { top: 0, dist: 0, flying: 0, longestFly: 0, capsizes: 0 };
  time = 0;
  private fly = 0;

  constructor(seed = 7) {
    this.yacht = newYacht(START.x, START.y, 1.25); // a broad reach towards the salt pan
    this.wind = new WindField(this.obstacles, seed, START);
    this.here = this.wind.at(START.x, START.y);
  }

  heightAt(x: number, y: number) { return heightAt(x, y); }

  /** Pick a course (or none) and put the yacht at its start, stopped. */
  setCourse(c: Course | null) {
    this.run = c ? newRun(c) : null;
    if (c) {
      const gear = this.yacht.gear;
      this.yacht = newYacht(c.start.x, c.start.y, c.heading, gear);
    }
  }

  /** Next course in the list (after the last: free sailing). */
  cycleCourse() {
    const i = this.run ? COURSES.indexOf(this.run.course) : -1;
    this.setCourse(i + 1 < COURSES.length ? COURSES[i + 1] : null);
  }

  restart() { if (this.run) this.setCourse(this.run.course); }

  swap() { return startSwap(this.yacht); }
  toggleAuto() { this.yacht.auto = !this.yacht.auto; }

  update(dt: number, input: YachtInput): Events {
    this.time += dt;
    const y = this.yacht;
    const from: V2 = { x: y.x, y: y.y };
    this.wind.update(dt, from);
    this.here = this.wind.at(y.x, y.y);
    const ev = yachtStep(y, dt, this.here, input, this.world);
    const out: Events = { ...ev, gate: -1, finished: null, record: false };

    this.stats.top = Math.max(this.stats.top, y.speed);
    this.stats.dist += Math.hypot(y.x - from.x, y.y - from.y);
    if (ev.capsized) this.stats.capsizes++;
    if (Math.abs(y.heel) > 0.02 && y.capsized <= 0) {
      this.fly += dt; this.stats.flying += dt;
      this.stats.longestFly = Math.max(this.stats.longestFly, this.fly);
    } else this.fly = 0;

    if (this.run) {
      out.gate = runStep(this.run, dt, from, y);
      if (this.run.done && out.gate === this.run.course.gates.length - 1) {
        const t = this.run.time ?? 0;
        out.finished = t;
        const id = this.run.course.id;
        if (!(id in this.best) || t < this.best[id]) { this.best[id] = t; out.record = true; }
      }
    }
    return out;
  }

  /** Seconds lying on the side add to the clock by themselves; this is the current flight. */
  get flyingNow() { return this.fly; }
}
