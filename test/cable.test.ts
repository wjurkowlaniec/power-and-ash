import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { Cable } from '../src/sim/cable';
import { Game, CABLE_MAX } from '../src/sim/game';
import { mvpLevel } from '../src/sim/level';
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

describe('MVP level', () => {
  const run = (g: Game, to: V2, maxT = 30) => {
    for (let t = 0; t < maxT; t += 1 / 60) {
      const d = { x: to.x - g.pos.x, y: to.y - g.pos.y };
      const l = Math.hypot(d.x, d.y);
      if (l < 0.1) return true;
      g.update(1 / 60, { move: { x: d.x / l, y: d.y / l }, run: false, interact: false, reel: false, aim: null });
    }
    return false;
  };
  const press = (g: Game) => g.update(1 / 60, { move: { x: 0, y: 0 }, run: false, interact: true, reel: false, aim: null });

  it('connects the yacht to the station around the north end of the wall', () => {
    const g = new Game(mvpLevel());
    press(g);
    expect(g.held).not.toBeNull();
    run(g, { x: 19, y: 20 }); run(g, { x: 23.5, y: 20.3 }); run(g, { x: 26.6, y: 20.3 }); run(g, { x: 33.2, y: 23.5 });
    expect(g.heldLength()).toBeLessThanOrEqual(CABLE_MAX);
    press(g);
    expect(g.cables.length).toBe(1);
    expect(g.stationPowered()).toBe(true);
    for (let i = 0; i < 60 * 7; i++) g.update(1 / 60, { move: { x: 0, y: 0 }, run: false, interact: false, reel: false, aim: null });
    expect(g.stationOnline()).toBe(true);
  });

  it('the south route is too long: Wolt is held back', () => {
    const g = new Game(mvpLevel());
    press(g);
    run(g, { x: 19, y: 31.6 }, 10); run(g, { x: 26.6, y: 31.6 }, 10); run(g, { x: 33.2, y: 23.5 }, 10);
    expect(g.heldLength()).toBeLessThanOrEqual(CABLE_MAX + 1e-3);
    expect(Math.hypot(g.pos.x - 33.2, g.pos.y - 23.5)).toBeGreaterThan(1.6);
  });
});
