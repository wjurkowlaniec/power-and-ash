import { tr } from '../../i18n';
import { SailGame, Events } from './sailGame';
import { YachtInput, newYacht } from './landYacht';
import { EXAM } from './courses';
import { START, MAP } from './terrain';

/**
 * Sailing lessons: the first time Wolt learns a skill, Q-1 runs it for him as a simulation
 * "in his head": short lessons, each with one thing to do, and an exam at the end that needs
 * all of them together (Wojtek 2026-11-11). Here: land sailing. The lessons run on the same
 * map and physics as free sailing; the exam is the course from A to B dead upwind, against
 * the clock. Pure logic; the page only shows the panel and the simulator look.
 */
export interface Lesson {
  id: string;
  title: string;
  /** What to do, with the keys. */
  text: string;
  /** Put the yacht (and the wind) where the lesson starts. */
  setup(g: SailGame, st: LessonState): void;
  /** Progress 0..1 after this step; 1 = done. */
  step(g: SailGame, st: LessonState, dt: number, input: YachtInput, ev: Events): number;
}

/** Scratch numbers of the lesson in progress. */
export type LessonState = Record<string, number>;

/** Stand the yacht at the lessons' field, `deg` off where the wind comes from (+ = wind on the left). */
function place(g: SailGame, deg: number, auto = true) {
  const y = g.yacht;
  const far = Math.min(y.x, y.y, MAP.size - y.x, MAP.size - y.y) < 60 || Math.hypot(y.x - START.x, y.y - START.y) > 150;
  const heading = g.wind.dir + Math.PI + deg * Math.PI / 180;
  const keep = { gear: y.gear, energy: Math.max(0.5, y.energy), dock: y.dock, docking: y.docking };
  g.setCourse(null);
  g.yacht = newYacht(far ? START.x : y.x, far ? START.y : y.y, heading, keep.gear);
  Object.assign(g.yacht, { energy: keep.energy, auto, dock: keep.dock, docking: keep.docking });
  g.wind.strength = 1;
}

const hold = (st: LessonState, ok: boolean, dt: number, secs: number) => {
  st.t = ok ? (st.t ?? 0) + dt : Math.max(0, (st.t ?? 0) - dt * 0.5);
  return Math.min(1, st.t / secs);
};

export const LESSONS: Lesson[] = [
  {
    id: 'reach', title: tr('Półwiatr', 'Beam reach'),
    text: tr('Wiatr z boku to najszybszy kurs. Q-1 trymuje szot za ciebie: sam tylko steruj (A/D) i utrzymaj ponad 25 km/h z wiatrem z boku przez 5 s. Gdy stoisz, pomóż silnikiem (E).',
      'Wind on the beam is the fastest course. Q-1 trims the sheet for you: just steer (A/D) and hold over 25 km/h with the wind on the beam for 5 s. From a standstill, help with the motor (E).'),
    setup: g => place(g, 90),
    step: (g, st, dt) => hold(st, g.yacht.speed > 7 && g.yacht.betaTrue > 1.1 && g.yacht.betaTrue < 2.1, dt, 5),
  },
  {
    id: 'trim', title: tr('Szot', 'The sheet'),
    text: tr('Teraz szot jest twój. Za luźno: żagiel łopocze i nie ciągnie. Za ciasno: pcha w bok zamiast do przodu. Wybieraj (W) i luzuj (S), aż pomarańczowy bom na kompasie pokryje zielony, i utrzymaj to 5 s w ruchu.',
      'Now the sheet is yours. Too loose: the sail flaps and does not pull. Too tight: it pushes sideways instead of forward. Haul in (W) and ease (S) until the orange boom on the compass covers the green one, and hold it for 5 s on the move.'),
    setup: g => { place(g, 90, false); g.yacht.sheet = 1.3; },
    step: (g, st, dt) => { const y = g.yacht; return hold(st, !y.auto && Math.abs(y.sheet - y.best) < 0.12 && y.cn > 0.9 && y.speed > 4, dt, 5); },
  },
  {
    id: 'close', title: tr('Ostro do wiatru', 'Close-hauled'),
    text: tr('Prosto pod wiatr się nie da: w czerwonym klinie na kompasie żagiel nie pracuje. Da się za to jechać skosem. Ostrz powoli (ster w stronę wiatru), aż kąt do wiatru spadnie poniżej 55°, i nie zgub prędkości przez 5 s.',
      'You cannot sail straight into the wind: inside the red wedge on the compass the sail does nothing. But you can sail at a slant. Head up slowly (steer towards the wind) until the angle off the wind drops below 55°, and keep your speed for 5 s.'),
    setup: g => place(g, 75),
    step: (g, st, dt) => hold(st, g.yacht.betaTrue < 0.96 && g.yacht.speed > 4, dt, 5),
  },
  {
    id: 'tack', title: tr('Zwrot przez sztag', 'Tacking'),
    text: tr('Żeby dojechać pod wiatr, jedzie się zygzakiem. Zwrot: z rozpędu skręć dziobem przez wiatr na drugi hals, żagiel sam przejdzie na drugą stronę. Nie zatrzymaj się w martwym kącie. Zrób dwa zwroty i rozpędź się po drugim.',
      'To get upwind you zigzag. A tack: with speed on, turn the bow through the wind onto the other tack; the sail crosses by itself. Do not stall in irons. Make two tacks and get going again after the second.'),
    setup: g => place(g, 55),
    step: (g, st) => {
      const y = g.yacht;
      // the bow went through the wind: the wind changed sides while it was ahead of the beam
      if (st.side && y.side !== st.side && y.betaTrue < 1.2 && y.capsized <= 0) st.n = (st.n ?? 0) + 1;
      st.side = y.side;
      const n = Math.min(2, st.n ?? 0);
      return (n + (n >= 2 && y.speed > 3.5 && y.betaTrue > 0.7 ? 1 : 0)) / 3;
    },
  },
  {
    id: 'ballast', title: tr('Balast w szkwale', 'Ballast in a gust'),
    text: tr('Wieje mocniej. Gdy pasek przechyłu rośnie, przeciągnij balast na nawietrzną (Shift) i jedź na krawędzi: przechył ponad 70% z balastem na nawietrznej przez 4 s, bez wywrotki. Po zwrocie puść i wciśnij Shift jeszcze raz.',
      'It blows harder. When the heel bar grows, haul the ballast to windward (Shift) and ride the edge: heel over 70% with the ballast to windward for 4 s, without going over. After a tack let go and press Shift again.'),
    setup: g => { place(g, 80); g.wind.strength = 1.35; },
    step: (g, st, dt, _i, ev) => {
      const y = g.yacht;
      if (ev.capsized) st.t = 0;
      return hold(st, Math.abs(y.tip) > 0.7 && y.ballast * y.side < -0.8 && y.capsized <= 0, dt, 4);
    },
  },
  {
    id: 'motor', title: tr('Hamulec i silnik', 'Brake and motor'),
    text: tr('Wolt jest przednim kołem. Zahamuj do zera (Spacja): hamowanie ładuje baterię. Potem rusz jego silnikiem (E) i rozpędź się do 10 km/h. Silnik zjada baterię, więc to pomoc na flautę, nie napęd.',
      'Wolt is the front wheel. Brake to a stop (Space): braking charges the battery. Then set off on his motor (E) and reach 10 km/h. The motor drains the battery: a help in a lull, not a drive.'),
    setup: g => { place(g, 90); g.yacht.vx = Math.cos(g.yacht.heading) * 6; g.yacht.vy = Math.sin(g.yacht.heading) * 6; },
    step: (g, st, _dt, input) => {
      const y = g.yacht;
      if (y.speed < 0.3 && input.brake) st.stopped = 1;
      if (st.stopped && y.thrust > 0) st.pushed = Math.max(st.pushed ?? 0, Math.min(1, y.u / 2.8));
      return (st.stopped ?? 0) * 0.5 + (st.pushed ?? 0) * 0.5;
    },
  },
];

export type TrainingEvent = 'none' | 'next' | 'exam' | 'passed' | 'failed';

export class Training {
  /** Index into LESSONS; LESSONS.length = the exam. */
  index = 0;
  progress = 0;
  passed = false;
  /** Exam attempts so far. */
  tries = 0;
  private st: LessonState = {};
  /** s the finished lesson's tick stays up before the next begins. */
  private pause = 0;

  constructor(private g: SailGame) { LESSONS[0].setup(g, this.st); }

  get count() { return LESSONS.length + 1; }
  get exam() { return this.index >= LESSONS.length; }
  get lesson(): Lesson | null { return LESSONS[this.index] ?? null; }
  /** s left on the exam clock (the whole limit before the first gate). */
  get left() { return (EXAM.limit ?? 0) - (this.g.run?.time ?? 0); }

  /** Jump to a lesson (or past the last: the exam). */
  go(i: number) {
    this.index = Math.max(0, Math.min(LESSONS.length, i));
    this.st = {}; this.progress = 0; this.pause = 0;
    if (this.exam) this.startExam(); else LESSONS[this.index].setup(this.g, this.st);
  }

  private startExam() {
    this.tries++;
    this.g.wind.strength = 1;
    this.g.setCourse(EXAM);
  }

  /** After the game's own update for this frame. */
  step(dt: number, input: YachtInput, ev: Events): TrainingEvent {
    if (this.passed) return 'none';
    if (this.exam) {
      if (ev.finished !== null) {
        if (ev.finished <= (EXAM.limit ?? Infinity)) { this.passed = true; this.progress = 1; return 'passed'; }
        this.startExam(); return 'failed';
      }
      const t = this.g.run?.time ?? 0;
      this.progress = this.g.run ? this.g.run.next / EXAM.gates.length : 0;
      if (t > (EXAM.limit ?? Infinity)) { this.startExam(); return 'failed'; }
      return 'none';
    }
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause > 0) return 'none';
      this.go(this.index + 1);
      return this.exam ? 'exam' : 'next';
    }
    this.progress = LESSONS[this.index].step(this.g, this.st, dt, input, ev);
    if (this.progress >= 1) { this.progress = 1; this.pause = 1.6; }
    return 'none';
  }
}
