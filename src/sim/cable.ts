import { V2, sub, cross, dot, dist, inTriangle, lineSegmentHit, lerp } from './vec';
import { World } from './world';

/** A bend point. `sign` is the sweep direction that created it (+1/-1); 0 for the fixed start. */
export interface Anchor { p: V2; sign: number }

/**
 * A cable behaving like taut string in 2D: it bends around obstacle corners as the
 * free end moves, and straightens again when the end swings back. Length is measured
 * along the bends, not in a straight line.
 */
export class Cable {
  anchors: Anchor[];
  end: V2;

  constructor(start: V2, end: V2 = start) {
    this.anchors = [{ p: { ...start }, sign: 0 }];
    this.end = { ...end };
  }

  clone(): Cable {
    const c = new Cable(this.anchors[0].p, this.end);
    c.anchors = this.anchors.map(a => ({ p: { ...a.p }, sign: a.sign }));
    return c;
  }

  get last(): V2 { return this.anchors[this.anchors.length - 1].p; }

  /** Length from the start up to the last bend. */
  baseLength(): number {
    let l = 0;
    for (let i = 1; i < this.anchors.length; i++) l += dist(this.anchors[i - 1].p, this.anchors[i].p);
    return l;
  }

  length(): number { return this.baseLength() + dist(this.last, this.end); }

  points(): V2[] { return [...this.anchors.map(a => a.p), this.end]; }

  /** Move the free end to `to`, adding and removing bends. */
  moveEnd(world: World, to: V2): void {
    let p0 = this.end;
    const p1 = to;

    // 1. unwrap: the end swung back past the line of the last bend
    while (this.anchors.length >= 2) {
      const C = this.anchors[this.anchors.length - 1];
      const B = this.anchors[this.anchors.length - 2].p;
      if (cross(sub(C.p, B), sub(p1, C.p)) * C.sign < 0) {
        this.anchors.pop();
        p0 = C.p; // sweep continues from the released corner
      } else break;
    }

    // 2. wrap: any corner swept over by the segment last→end becomes a bend
    let A = this.last;
    for (let guard = 0; guard < 16; guard++) {
      const s = Math.sign(cross(sub(p0, A), sub(p1, A)));
      if (s === 0) break;
      const d0 = sub(p0, A);
      let best: V2 | null = null, bestAng = Infinity, bestD = Infinity;
      const minX = Math.min(A.x, p0.x, p1.x), maxX = Math.max(A.x, p0.x, p1.x);
      const minY = Math.min(A.y, p0.y, p1.y), maxY = Math.max(A.y, p0.y, p1.y);
      for (const c of world.corners) {
        if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
        if (!inTriangle(c, A, p0, p1)) continue;
        const dc = sub(c, A);
        const dA = dist(c, A);
        if (dA < 1e-4) continue;
        const ang = Math.abs(Math.atan2(cross(d0, dc), dot(d0, dc)));
        if (ang < bestAng - 1e-7 || (Math.abs(ang - bestAng) <= 1e-7 && dA < bestD)) {
          best = c; bestAng = ang; bestD = dA;
        }
      }
      if (!best) break;
      this.anchors.push({ p: { ...best }, sign: s });
      // remaining sweep: from where the ray A→best crosses p0→p1, around the new bend
      const u = lineSegmentHit(best, sub(best, A), p0, sub(p1, p0));
      if (u === null) break;
      p0 = lerp(p0, p1, u);
      A = best;
    }
    this.end = { ...p1 };
  }
}
