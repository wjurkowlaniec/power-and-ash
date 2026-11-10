import { V2, lineSegmentHit } from '../../sim/vec';
import { tr } from '../../i18n';

/**
 * Courses: a row of gates (two flag poles each) to sail through in order, against the
 * clock. The first gate starts the clock, the last stops it. Each course is laid so that
 * it needs every point of sail and asks for one skill in particular.
 * The wind blows from the west-north-west (towards the east-south-east).
 */
export interface Course {
  id: string;
  name: string;
  hint: string;
  /** Where the yacht waits before the start, and its heading. */
  start: V2; heading: number;
  gates: V2[];
  /** Gate width between the poles, m. */
  width: number;
  /** Suggested gear. */
  gear: 'wheels' | 'runners';
}

export const COURSES: Course[] = [
  {
    id: 'lake', name: tr('Pętla po solnisku', 'Salt pan loop'),
    hint: tr('Gładko i szybko, ale ślisko: w zakrętach zjeżdża bokiem. Pod wiatr halsuj.', 'Smooth and fast but slippery: it slides in the turns. Tack upwind.'),
    start: { x: 75, y: 262 }, heading: 0.4, width: 16, gear: 'wheels',
    gates: [{ x: 98, y: 270 }, { x: 196, y: 300 }, { x: 150, y: 358 }, { x: 70, y: 345 }, { x: 52, y: 300 }, { x: 98, y: 270 }],
  },
  {
    id: 'village', name: tr('Przez wieś', 'Through the village'),
    hint: tr('Z wiatrem drogą do wsi, potem slalom w cieniu domów, gdzie wiatr siada i szarpie.', 'Downwind along the road, then a slalom in the lee of the houses, where the wind drops and gusts.'),
    start: { x: 40, y: 220 }, heading: -0.12, width: 14, gear: 'wheels',
    gates: [{ x: 62, y: 226 }, { x: 160, y: 203 }, { x: 240, y: 168 }, { x: 263, y: 152 }, { x: 304, y: 137 }, { x: 352, y: 150 }, { x: 300, y: 196 }, { x: 205, y: 222 }, { x: 120, y: 240 }],
  },
  {
    id: 'dunes', name: tr('Wydmy', 'The dunes'),
    hint: tr('Sypki popiół: koła grzęzną, płozy suną. Pod górę traci się prędkość, z góry łatwo o wywrotkę.', 'Loose ash: wheels sink, runners glide. Uphill you lose speed, downhill it is easy to tip over.'),
    start: { x: 228, y: 238 }, heading: 0.5, width: 16, gear: 'runners',
    gates: [{ x: 248, y: 252 }, { x: 330, y: 262 }, { x: 375, y: 320 }, { x: 330, y: 372 }, { x: 262, y: 340 }, { x: 300, y: 300 }, { x: 248, y: 252 }],
  },
  {
    id: 'forest', name: tr('Martwy las', 'The dead wood'),
    hint: tr('Między pniami wiatr rwie się i skręca. Czytaj szkwały na popiele.', 'Between the trunks the wind breaks up and shifts. Read the gusts on the ash.'),
    start: { x: 120, y: 120 }, heading: -0.6, width: 13, gear: 'wheels',
    gates: [{ x: 138, y: 104 }, { x: 165, y: 52 }, { x: 222, y: 58 }, { x: 236, y: 108 }, { x: 196, y: 128 }, { x: 160, y: 86 }, { x: 138, y: 104 }],
  },
];

/** The two poles of gate i: across the line of the course through it. */
export function gatePoles(c: Course, i: number): [V2, V2] {
  const g = c.gates[i];
  const prev = c.gates[i - 1] ?? c.start, next = c.gates[i + 1] ?? (c.gates[i - 1] ? { x: 2 * g.x - c.gates[i - 1].x, y: 2 * g.y - c.gates[i - 1].y } : g);
  let dx = next.x - prev.x, dy = next.y - prev.y;
  // a closed loop: the finish gate is the start gate, keep its first orientation
  if (i === c.gates.length - 1 && c.gates[0].x === g.x && c.gates[0].y === g.y) { dx = c.gates[1].x - c.start.x; dy = c.gates[1].y - c.start.y; }
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * c.width / 2, ny = dx / L * c.width / 2;
  return [{ x: g.x - nx, y: g.y - ny }, { x: g.x + nx, y: g.y + ny }];
}

export interface Run {
  course: Course;
  /** The next gate to pass. */
  next: number;
  /** s since the start gate, or null before it. */
  time: number | null;
  /** Split times at each gate. */
  splits: number[];
  done: boolean;
}

export const newRun = (course: Course): Run => ({ course, next: 0, time: null, splits: [], done: false });

/** Advance the clock and check the move from a to b against the next gate. Returns the gate passed, or -1. */
export function runStep(r: Run, dt: number, a: V2, b: V2): number {
  if (r.done) return -1;
  if (r.time !== null) r.time += dt;
  const [p, q] = gatePoles(r.course, r.next);
  const u = lineSegmentHit(a, { x: b.x - a.x, y: b.y - a.y }, p, { x: q.x - p.x, y: q.y - p.y });
  if (u === null) return -1;
  // lineSegmentHit treats a→b as an infinite line: check that the crossing is within this move
  const t = segParam(a, b, p, q);
  if (t < 0 || t > 1) return -1;
  const passed = r.next;
  if (passed === 0) r.time = 0;
  r.splits.push(r.time ?? 0);
  r.next++;
  if (r.next >= r.course.gates.length) r.done = true;
  return passed;
}

function segParam(a: V2, b: V2, p: V2, q: V2): number {
  const rx = b.x - a.x, ry = b.y - a.y, sx = q.x - p.x, sy = q.y - p.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return -1;
  return ((p.x - a.x) * sy - (p.y - a.y) * sx) / den;
}
