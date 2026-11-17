import { describe, it, expect } from 'vitest';
import { Island, P, PAD_X, SLED_CAP, OVERLOAD_AT, TERMINAL_W, PANEL_W, STORE_W, bogDepth, BOG_DEPTH, START_BATTERY, THIN_W, THICK_W, TRAFO_MULT, lineRating } from '../src/game/sim/island';
import { RECIPES, ItemId, Inventory } from '../src/game/sim/craft';
import { findPath } from '../src/sim/path';
import { V2, sub, len, dist } from '../src/sim/vec';

const DT = 1 / 30;
const inp = (o: Partial<{ move: V2; run: boolean; use: boolean; usePressed: boolean; drop: boolean }> = {}) =>
  ({ move: { x: 0, y: 0 }, run: false, use: false, usePressed: false, ...o });

/** Drive along an A* path like a player would (the sled follows if hooked). */
function goTo(s: Island, to: V2, maxT = 150): boolean {
  const path = findPath(s.world, s.pos, to, 0.34) ?? [to];
  let i = 0;
  for (let t = 0; t < maxT; t += DT) {
    while (i < path.length && len(sub(path[i], s.pos)) < 0.2) i++;
    // a load in tow may hold Wolt a hand's width short of the last point: close enough
    if (i >= path.length || dist(to, s.pos) < 0.3) return true;
    const d = sub(path[i], s.pos);
    s.update(DT, inp({ move: { x: d.x / len(d), y: d.y / len(d) }, run: true }));
    if (s.reading) s.closeNote();
  }
  return false;
}
const idle = (s: Island, sec: number) => { for (let t = 0; t < sec; t += DT) { s.update(DT, inp()); if (s.reading) s.closeNote(); } };
const press = (s: Island) => { s.update(DT, inp({ use: true, usePressed: true })); s.update(DT, inp()); if (s.reading) s.closeNote(); };
const hold = (s: Island, sec: number) => { for (let t = 0; t < sec; t += DT) s.update(DT, inp({ use: true })); s.update(DT, inp()); };

/** Walk to a thing and check it is the one E would use. */
function at(s: Island, id: string, p: V2) {
  expect(goTo(s, p), `reach ${id}`).toBe(true);
  expect(s.nearest()).toBe(id);
}
/** Next to the sled (it is solid), then E hooks it. */
function hookSled(s: Island, from?: V2) {
  const d = from ?? sub(s.pos, s.sled.pos), l = len(d) || 1;
  at(s, 'sled', { x: s.sled.pos.x + d.x / l * 1.15, y: s.sled.pos.y + d.y / l * 1.15 });
  press(s);
  expect(s.towing).toBe(true);
}
const heapAt = (s: Island, id: string) => s.heaps.find(h => h.id === id)!.at;
const padAt = (i: number) => ({ x: PAD_X[i], y: 6.8 });
/** Wait (resting) until a condition holds, e.g. the sun on the panels. */
function until(s: Island, cond: () => boolean, maxT = 120): boolean {
  for (let t = 0; t < maxT; t += DT) { if (cond()) return true; s.update(DT, inp()); if (s.reading) s.closeNote(); }
  return cond();
}
function take(s: Island, id: string) { at(s, 'heap:' + id, heapAt(s, id)); hold(s, 5); expect(s.heaps.find(h => h.id === id)!.done).toBe(true); }

/** The opening every route shares: three panels, splitter, fuse, the bunker open. */
function opening(s: Island) {
  at(s, 'crateA', P.crateA); press(s);
  expect(s.inv.count('cable')).toBe(10);
  at(s, 'reg', P.reg); press(s);                      // scan: the fuse
  take(s, 'lamp');                                    // the splitter
  idle(s, 13);
  expect(s.known.has('fuse') && s.known.has('splitter')).toBe(true);
  at(s, 'reg', P.reg); hold(s, 5);
  expect(s.regOk).toBe(true);
  take(s, 'k2');
  at(s, 'junction', P.junction); hold(s, 6);
  expect(s.junction).toBe(true);
  at(s, 'pad0', padAt(0)); hold(s, 4);
  expect(s.pads[0].linked).toBe(true);
  take(s, 'wreck2');
  take(s, 'k1'); take(s, 'k3');
  at(s, 'pad1', padAt(1)); hold(s, 3);                // the pane
  expect(s.pads[1].fault).toBe(null);
  hold(s, 8);                                         // its cable (made in place)
  expect(s.pads[1].linked).toBe(true);
  at(s, 'pad2', padAt(2)); press(s);                  // scan the connector
  idle(s, 7);
  expect(s.known.has('connector')).toBe(true);
  hold(s, 6); hold(s, 6);                             // connector, then cable
  expect(s.pads[2].fault).toBe(null);
  expect(s.pads[2].linked).toBe(true);
  expect(until(s, () => s.supply > 400)).toBe(true);
  // charge from the cabinet port before the long work
  at(s, 'port', P.port); press(s);
  expect(s.plugged).toBe(true);
  expect(until(s, () => s.battery > 90, 200)).toBe(true);
  // the bunker: feed cable, scan the hinge, pin and oil
  take(s, 'barrel');
  at(s, 'door', P.door); hold(s, 6);
  expect(s.fed).toBe(true);
  press(s); idle(s, 7);
  expect(s.known.has('pin')).toBe(true);
  expect(until(s, () => s.supply >= 50)).toBe(true);
  at(s, 'door', P.door); hold(s, 8);
  idle(s, 2);
  expect(s.doorOpen).toBe(1);
  at(s, 'terminal', P.terminal); press(s);
  expect(s.scanned.has('terminal')).toBe(true);
}

describe('Level "Wyspa": crafting test', () => {
  it('starts on reserve on the jetty, inside the island', () => {
    const s = new Island();
    expect(s.battery).toBe(START_BATTERY);
    expect(bogDepth(s.pos)).toBe(0);
    for (const p of [P.reg, P.junction, P.door, P.crateA, P.lighthouse, ...PAD_X.map((_, i) => padAt(i))]) expect(bogDepth(p)).toBe(0);
    for (const h of s.heaps) expect(bogDepth(h.at), h.id).toBe(0);
  });

  it('every thing is reachable by A*', () => {
    const s = new Island();
    const pts = [P.reg, P.port, P.junction, P.door, P.crateA, P.noteA, P.sled, ...PAD_X.map((_, i) => padAt(i)), ...s.heaps.map(h => h.at)];
    for (const p of pts) expect(findPath(s.world, P.start, p, 0.34), JSON.stringify(p)).not.toBeNull();
  });

  it('there is enough of everything for the all-panels route (no storage)', () => {
    const s = new Island();
    const loot: Partial<Record<ItemId, number>> = { cable: 10, copper: 2, plastic: 1 };
    for (const h of s.heaps) for (const [k, n] of Object.entries(h.loot)) loot[k as ItemId] = (loot[k as ItemId] ?? 0) + n!;
    // cable in metres: splitter link, feed, every panel to the splitter
    const metres = 3 + 6 + PAD_X.reduce((a, _, i) => a + s.linkLen(s.pads[i]), 0);
    const cableCrafts = Math.ceil((metres - 10) / 5);
    const need = {
      copper: 1 + 2 + 4 + cableCrafts,     // fuse, splitter, 4 connectors, cable
      plastic: 1 + 4 + cableCrafts,
      iron: 1 + 1 + 9,                     // splitter, pin, 3 frames
      glass: 1, oil: 1, cell: 6, pane: 1 + 3,
    };
    for (const [k, n] of Object.entries(need)) expect(loot[k as ItemId] ?? 0, k).toBeGreaterThanOrEqual(n);
  });

  it('storage route: three panels, the storage from four accumulators, download, overload, Wolt as the bridge, lighthouse', () => {
    const s = new Island();
    opening(s);
    at(s, 'stationBatt', P.stationBatt); press(s);
    // the sled: two accumulators in the container, two in the boat wreck
    hookSled(s);
    take(s, 'crateB');
    take(s, 'boat');
    expect(s.cargo.filter(c => c === 'battery').length).toBe(4);
    expect(SLED_CAP).toBeGreaterThanOrEqual(4);
    // through the middle of the doorway, so the sled follows straight in
    for (const p of [{ x: 18.5, y: 16.5 }, { x: 18.5, y: 21 }, { x: 15.5, y: 23.2 }]) expect(goTo(s, p)).toBe(true);
    expect(s.known.has('storage')).toBe(true);
    s.update(DT, inp({ drop: true }));                // unhitch the sled by the bench
    expect(s.towing).toBe(false);
    // hand-made cable first if short, then the storage at the bench
    if (s.inv.count('cable') < 5) { expect(s.craft('cable')).toBe(true); idle(s, 4); }
    expect(until(s, () => s.whyNot('storage') === null, 60), String(s.whyNot('storage'))).toBe(true);
    expect(s.craft('storage')).toBe(true);
    expect(until(s, () => s.storage, 60)).toBe(true);
    expect(s.log.menuCrafts).toBeGreaterThan(0);
    expect(s.log.inPlace).toBeGreaterThan(0);
    // 450 W of panels + 600 W from the storage reach the terminal's 900 W
    expect(until(s, () => s.terminalNeed().have >= TERMINAL_W && s.soc > 0.6, 120)).toBe(true);
    at(s, 'terminal', P.terminal); press(s);
    expect(s.downloading).toBe(true);
    // it only goes forward, and at 70% the fuse blows
    let last = 0;
    expect(until(s, () => { expect(s.progress).toBeGreaterThanOrEqual(last); last = s.progress; return s.overloaded; }, 600)).toBe(true);
    expect(s.regOk).toBe(false);
    const p0 = s.progress;
    idle(s, 5);
    expect(s.progress).toBe(p0);
    // no copper or glass left for a fuse? then the arm stands in for it
    s.inv.take('glass', 99);
    at(s, 'reg', P.reg); hold(s, 2);
    expect(s.bridged).toBe(true);
    expect(until(s, () => s.lighthouseT >= 0, 400)).toBe(true);
    expect(s.progress).toBe(1);
    expect(until(s, () => s.done, 60)).toBe(true);
    expect(s.answered).toBe(true);
    expect(s.log.stages.download).toBeGreaterThan(0);
  });

  it('the bridge finishes the download even on an empty battery', () => {
    const s = new Island();
    Object.assign(s, { regOk: false, junction: true, fed: true, doorOpen: 1, overloaded: true, downloading: true, progress: OVERLOAD_AT, bridged: true, battery: 1, storage: true, soc: 1 });
    s.lines.trunk.thick = true; s.lines.feed.trafo = true;
    s.pads.forEach(p => { p.panel = true; p.fault = null; p.linked = true; });
    expect(until(s, () => s.lighthouseT >= 0, 300)).toBe(true);
    expect(s.battery).toBe(0);
  });

  it('a new fuse is the other way out of the overload', () => {
    const s = new Island();
    Object.assign(s, { regOk: false, junction: true, overloaded: true, downloading: true, progress: OVERLOAD_AT });
    s.known.add('fuse');
    s.pads.forEach(p => { p.panel = true; p.fault = null; p.linked = true; });
    s.inv.add('copper', 1); s.inv.add('glass', 1);
    at(s, 'reg', P.reg); hold(s, 6);
    expect(s.regOk).toBe(true);
    expect(s.bridged).toBe(false);
    expect(s.log.stages.fuse2).toBeDefined();
  });

  it('six panels in full sun give 900 W without a storage', () => {
    const s = new Island();
    Object.assign(s, { regOk: true, junction: true, fed: true, doorOpen: 1, t: 0 });
    s.lines.trunk.thick = true; s.lines.feed.trafo = true;   // 900 W does not fit a thin line
    s.pads.forEach(p => { p.panel = true; p.fault = null; p.linked = true; });
    // find a moment with no cloud over the panels
    expect(until(s, () => s.pads.every(p => s.sun(p.at) > 0.999), 200)).toBe(true);
    expect(s.supply).toBeCloseTo(PANEL_W * 6, 0);
    expect(s.terminalNeed().have).toBeGreaterThanOrEqual(TERMINAL_W);
  });

  it('a new panel is made at the bench, rides on the sled and stands on an empty stand', () => {
    const s = new Island();
    Object.assign(s, { regOk: true, junction: true, fed: true, doorOpen: 1 });
    s.world.remove(s.world.obstacles.find(o => o.kind === 'crate' && o.x === 17 && o.y === 19)!);
    s.pads.forEach((p, i) => { if (i < 3) { p.fault = null; p.linked = true; } });
    for (const r of ['frame', 'panel', 'connector'] as const) s.known.add(r);
    s.inv.add('iron', 3); s.inv.add('cell', 2); s.inv.add('pane', 1); s.inv.add('connector', 1); s.inv.add('cable', 10);
    s.sled.pos = { x: 17.6, y: 22.4 };
    expect(goTo(s, { x: 14.5, y: 23.4 })).toBe(true);
    expect(until(s, () => s.whyNot('frame') === null, 60), String(s.whyNot('frame'))).toBe(true);
    s.craft('frame'); expect(until(s, () => !s.crafting, 30)).toBe(true);
    expect(s.cargo).toContain('frame');
    expect(until(s, () => s.whyNot('panel') === null, 60)).toBe(true);
    s.craft('panel'); expect(until(s, () => !s.crafting, 30)).toBe(true);
    expect(s.cargo).toEqual(['panel']);
    hookSled(s);
    at(s, 'pad3', padAt(3)); hold(s, 3);
    expect(s.pads[3].panel).toBe(true);
    hold(s, 5);
    expect(s.pads[3].linked).toBe(true);
  });

  it('a full inventory drops the rest on the ground, and it can be picked up later', () => {
    const s = new Island();
    const inv = s.inv as Inventory;
    for (const id of ['copper', 'plastic', 'iron', 'glass', 'oil', 'pin'] as ItemId[]) inv.add(id, 1);
    take(s, 'wreck2');
    expect(s.piles.length).toBeGreaterThan(0);
    expect(s.log.overflow).toBeGreaterThan(0);
    inv.take('pin', 1); inv.take('oil', 1); inv.take('glass', 1);
    const pl = s.piles[0];
    at(s, 'pile:' + pl.id, pl.at); press(s);
    expect(s.piles.find(x => x.id === pl.id)).toBeUndefined();
  });

  it('mode b: repair in place only fits ready parts; mode a: the C panel is off', () => {
    const b = new Island('b');
    b.known.add('fuse'); b.inv.add('copper', 1); b.inv.add('glass', 1);
    expect(b.plan({ fuse: 1 }).ok).toBe(false);
    expect(b.whyNot('fuse')).toBe(null);
    const a = new Island('a');
    a.known.add('fuse'); a.inv.add('copper', 1); a.inv.add('glass', 1);
    expect(a.plan({ fuse: 1 }).ok).toBe(true);
    expect(a.whyNot('fuse')).not.toBe(null);
  });

  it('recipes are learnt, not given: only the cable is known at the start', () => {
    const s = new Island();
    expect([...s.known]).toEqual(['cable']);
    for (const r of Object.values(RECIPES)) for (const id of Object.keys(r.need)) expect(id).toBeTruthy();
  });

  it('the glass gravel round the island: the wheel slips, but the way back always works', () => {
    const s = new Island();
    s.pos = { x: 22, y: 33.5 };
    for (let t = 0; t < 6; t += DT) s.update(DT, inp({ move: { x: 0, y: 1 } }));
    expect(bogDepth(s.pos)).toBeLessThan(BOG_DEPTH + 0.5);
    const deep = bogDepth(s.pos);
    for (let t = 0; t < 8; t += DT) s.update(DT, inp({ move: { x: 0, y: -1 } }));
    expect(bogDepth(s.pos)).toBeLessThan(deep);
    expect(dist(s.pos, P.start)).toBeLessThan(6);
  });

  it('the storage gives up to its power and is charged by spare sun', () => {
    const s = new Island();
    Object.assign(s, { regOk: true, junction: true, fed: true, doorOpen: 1, storage: true, soc: 0.2 });
    s.pads.forEach((p, i) => { if (i < 3) { p.fault = null; p.linked = true; } });
    idle(s, 20);
    expect(s.soc).toBeGreaterThan(0.2);
    expect(STORE_W).toBe(600);
  });

  it('cable classes: a thin line heats, sparks and trips its breaker; E at the cabinet resets it', () => {
    const s = new Island();
    Object.assign(s, { regOk: true, junction: true, t: 0 });
    s.pads.forEach(p => { p.panel = true; p.fault = null; p.linked = true; });
    expect(lineRating(s.lines.trunk)).toBe(THIN_W);
    expect(until(s, () => s.lines.trunk.flow > THIN_W * 1.2, 200)).toBe(true);
    // it warns before it trips: heat climbs for several seconds
    expect(until(s, () => s.lines.trunk.heat > 0.4, 30)).toBe(true);
    expect(s.lines.trunk.tripped).toBe(false);
    expect(until(s, () => s.lines.trunk.tripped, 30)).toBe(true);
    expect(s.pops.some(p => p.kind === 'spark')).toBe(true);
    idle(s, 0.1);
    expect(s.supply).toBe(0);
    // switched back on it starts warm, so it trips again soon with the same load
    at(s, 'reg', P.reg); press(s);
    expect(s.lines.trunk.tripped).toBe(false);
    expect(s.lines.trunk.heat).toBeGreaterThan(0.3);
  });

  it('heavy cable on the trunk and the transformer on the feed carry 900 W', () => {
    const s = new Island();
    Object.assign(s, { regOk: true, junction: true, fed: true, doorOpen: 1, t: 0 });
    s.world.remove(s.world.obstacles.find(o => o.kind === 'crate' && o.x === 17 && o.y === 19)!);
    s.pads.forEach(p => { p.panel = true; p.fault = null; p.linked = true; });
    // where they come from: the boat wreck and the overturned container
    expect(s.heaps.find(h => h.id === 'boat')!.loot.cableThick).toBeGreaterThanOrEqual(3);
    expect(s.heaps.find(h => h.id === 'crateB')!.loot.trafo).toBe(1);
    s.inv.add('cableThick', 5); s.inv.add('trafo', 1);
    at(s, 'trunk', P.junction); hold(s, 3);
    expect(s.lines.trunk.thick).toBe(true);
    expect(s.inv.count('cableThick')).toBe(2);
    at(s, 'reg', P.reg); hold(s, 4);
    expect(s.lines.feed.trafo).toBe(true);
    expect(lineRating(s.lines.feed)).toBe(THIN_W * TRAFO_MULT);
    expect(lineRating(s.lines.trunk)).toBe(THICK_W);
    expect(until(s, () => s.pads.every(p => s.sun(p.at) > 0.999), 200)).toBe(true);
    s.downloading = true;
    idle(s, 20);
    expect(s.lines.trunk.tripped || s.lines.feed.tripped).toBe(false);
    expect(s.lines.trunk.heat).toBe(0);
  });

  it('every bit of loot and every fitted part leaves a pop for the view', () => {
    const s = new Island();
    take(s, 'k2');
    expect(s.pops.filter(p => p.kind === 'take' && p.text).length).toBeGreaterThanOrEqual(3);
    expect(s.pops.some(p => p.kind === 'tick')).toBe(true);
  });
});
