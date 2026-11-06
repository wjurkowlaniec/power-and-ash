/** 2D vector on the ground plane. `y` maps to world Z in the renderer. */
export interface V2 { x: number; y: number }

export const v = (x: number, y: number): V2 => ({ x, y });
export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: V2, s: number): V2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: V2, b: V2) => a.x * b.x + a.y * b.y;
export const cross = (a: V2, b: V2) => a.x * b.y - a.y * b.x;
export const len = (a: V2) => Math.hypot(a.x, a.y);
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: V2): V2 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
export const lerp = (a: V2, b: V2, t: number): V2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Strictly inside triangle (a, b, c), any winding. */
export function inTriangle(p: V2, a: V2, b: V2, c: V2, eps = 1e-9): boolean {
  const d1 = cross(sub(b, a), sub(p, a));
  const d2 = cross(sub(c, b), sub(p, b));
  const d3 = cross(sub(a, c), sub(p, c));
  const neg = d1 < -eps || d2 < -eps || d3 < -eps;
  const pos = d1 > eps || d2 > eps || d3 > eps;
  return !(neg && pos) && Math.abs(d1) > eps && Math.abs(d2) > eps && Math.abs(d3) > eps;
}

/** Intersection of line (p, p+r) with segment (q, q+s); returns u on segment or null. */
export function lineSegmentHit(p: V2, r: V2, q: V2, s: V2): number | null {
  const rxs = cross(r, s);
  if (Math.abs(rxs) < 1e-12) return null;
  const u = cross(sub(q, p), r) / rxs;
  const t = cross(sub(q, p), s) / rxs;
  if (t < 0 || u < 0 || u > 1) return null;
  return u;
}
