import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { Cable } from '../src/sim/cable';
import { V2, lerp } from '../src/sim/vec';

const walk = (c: Cable, w: World, pts: V2[], step = 0.05) => {
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const n = Math.ceil(d / step);
    for (let k = 1; k <= n; k++) c.moveEnd(w, lerp(pts[i - 1], pts[i], k / n));
  }
};

describe('cable wrapping', () => {
  // single 2×2 block at (5,5)-(7,7)
  const w = new World(20, 20, [{ kind: 'rock', x: 5, y: 5, w: 2, h: 2 }]);

  it('bends around a corner and the length follows the bend', () => {
    const c = new Cable({ x: 2, y: 6 }, { x: 2, y: 6 });
    walk(c, w, [{ x: 2, y: 6 }, { x: 2, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 6 }]);
    expect(c.anchors.length).toBeGreaterThan(1);
    for (let i = 1; i < c.points().length; i++)
      expect(w.segmentBlocked(c.points()[i - 1], c.points()[i])).toBe(false);
    expect(c.length()).toBeGreaterThan(8.0);
  });

  it('unwraps when walking back the same way', () => {
    const c = new Cable({ x: 2, y: 6 }, { x: 2, y: 6 });
    const path = [{ x: 2, y: 6 }, { x: 2, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 6 }];
    walk(c, w, path);
    walk(c, w, [...path].reverse());
    expect(c.anchors.length).toBe(1);
  });

  it('never cuts through the block while circling it', () => {
    const c = new Cable({ x: 2, y: 6 }, { x: 2, y: 6 });
    const ring = [{ x: 2, y: 6 }, { x: 2, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 10 }, { x: 2, y: 10 }, { x: 2, y: 7 }];
    for (let i = 1; i < ring.length; i++) {
      walk(c, w, [ring[i - 1], ring[i]]);
      const pts = c.points();
      for (let k = 1; k < pts.length; k++) expect(w.segmentBlocked(pts[k - 1], pts[k])).toBe(false);
    }
    expect(c.anchors.length).toBeGreaterThanOrEqual(5);
  });
});

