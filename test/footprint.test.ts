import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { endsDepth, bodyFree, guardTurn, NOSE, TAIL } from '../src/sim/footprint';
import { Hall, HallInput, layout } from '../src/game/sim/hall';
import { Station } from '../src/game/sim/station';

const R = 0.3;
// a 10 × 10 room with one wall block at x 5..6 (full height)
const room = () => new World(10, 10, [{ kind: 'container', x: 5, y: 0, w: 1, h: 10 }]);

describe('Wolt footprint (no clipping into walls)', () => {
  it('the nose counts: a wheel that fits can still have its nose in the wall', () => {
    const w = room();
    const p = { x: 5 - R - 0.01, y: 5 };
    expect(w.circleBlocked(p, R)).toBe(false);
    expect(endsDepth(w, p, 0)).toBeGreaterThan(0);        // facing the wall
    expect(bodyFree(w, p, Math.PI / 2, R)).toBe(true);   // parallel to it
  });

  it('turning towards a wall rolls the wheel back instead of pushing the nose in', () => {
    const w = room();
    const p = { x: 5 - R - 0.01, y: 5 };
    const g = guardTurn(w, p, Math.PI / 2, 0, R);
    expect(bodyFree(w, g.pos, g.facing, R)).toBe(true);
    expect(g.pos.x).toBeLessThan(p.x);
  });

  it('a pivot fits in a corridor one metre wide', () => {
    expect(Math.max(NOSE.at + NOSE.r, -TAIL.at + TAIL.r)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  const drive = (sim: { update(dt: number, i: never): void }, dir: { x: number; y: number }, s: number, extra: object) => {
    for (let t = 0; t < s; t += 1 / 30) sim.update(1 / 30, { move: dir, run: false, use: false, usePressed: false, drop: false, ...extra } as never);
  };

  it('hall: driving into the test chamber glass never puts the body inside it', () => {
    const h = new Hall();
    h.awake = true;
    h.pos = { x: 8.3, y: 4.5 };
    const C = layout.chamber;
    for (const dir of [{ x: 1, y: 0 }, { x: 1, y: 0.3 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: -0.5 }]) {
      drive(h, dir, 1.2, {} as Partial<HallInput>);
      expect(bodyFree(h.world, h.pos, h.facing, R), `dir ${dir.x},${dir.y} at ${h.pos.x},${h.pos.y}`).toBe(true);
      expect(h.pos.x).toBeLessThan(C.x);
    }
  });

  it('station: running along and into walls keeps the body out of them', () => {
    const st = new Station(60);
    st.pos = { x: 6, y: 14.2 };
    for (const dir of [{ x: 0, y: -1 }, { x: 1, y: -0.2 }, { x: -1, y: 0 }, { x: 0.7, y: -0.7 }, { x: 0, y: 1 }]) {
      drive(st, dir, 1.5, {});
      expect(bodyFree(st.world, st.pos, st.facing, 0.32), `dir ${dir.x},${dir.y}`).toBe(true);
    }
  });
});
