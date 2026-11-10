import { V2 } from '../../sim/vec';
import { tr } from '../../i18n';
import { COURSES } from './courses';

/**
 * The land yacht demo's map: 400 × 400 m of ash country, 1 unit = 1 m, x east, y south.
 * Pure functions of position (height, surface) plus a fixed list of obstacles, all
 * deterministic, so the simulation, the tests and the 3D view agree.
 *
 * What is where (and why it is there for sailing):
 * - an old asphalt road across the map: wheels fly, runners scrape;
 * - a dry salt lake in the south-west: smooth and fast, but slippery, you slide sideways;
 * - dunes of loose ash in the south-east: wheels sink, runners glide, slopes up and down;
 * - a dry stream bed of mud from the north into the lake: sticky and heavy;
 * - a ruined village on the road with gravel round it: buildings throw wind shadows;
 * - a dead forest in the north: gusty, broken wind between the trunks;
 * - hills and packed ash everywhere else.
 */
export const MAP = { size: 400 };

export type SurfaceId = 'road' | 'ash' | 'loose' | 'lake' | 'gravel' | 'mud';

export interface SurfaceDef {
  name: string;
  /** Rolling resistance as a share of weight (deceleration = crr · g), on wheels and on runners. */
  crr: { wheels: number; runners: number };
  /** Side grip (friction coefficient) before the yacht slides sideways. */
  grip: { wheels: number; runners: number };
  color: number;
}

export const SURFACES: Record<SurfaceId, SurfaceDef> = {
  road: { name: tr('asfalt', 'asphalt'), crr: { wheels: 0.015, runners: 0.1 }, grip: { wheels: 0.9, runners: 0.35 }, color: 0x75726c },
  ash: { name: tr('ubity popiół', 'packed ash'), crr: { wheels: 0.05, runners: 0.035 }, grip: { wheels: 0.6, runners: 0.7 }, color: 0xa9a59c },
  loose: { name: tr('sypki popiół', 'loose ash'), crr: { wheels: 0.12, runners: 0.05 }, grip: { wheels: 0.45, runners: 0.6 }, color: 0xc2bdb2 },
  lake: { name: tr('solnisko', 'salt pan'), crr: { wheels: 0.012, runners: 0.012 }, grip: { wheels: 0.5, runners: 0.42 }, color: 0xcfcbc1 },
  gravel: { name: tr('żwir', 'gravel'), crr: { wheels: 0.06, runners: 0.14 }, grip: { wheels: 0.55, runners: 0.45 }, color: 0x8c8780 },
  mud: { name: tr('błoto', 'mud'), crr: { wheels: 0.2, runners: 0.16 }, grip: { wheels: 0.35, runners: 0.4 }, color: 0x5d564d },
};

// ---------------------------------------------------------------- features

export const ROAD: V2[] = [{ x: -10, y: 236 }, { x: 60, y: 226 }, { x: 125, y: 214 }, { x: 200, y: 190 }, { x: 262, y: 156 }, { x: 300, y: 132 }, { x: 345, y: 118 }, { x: 410, y: 112 }];
export const STREAM: V2[] = [{ x: 205, y: -10 }, { x: 196, y: 40 }, { x: 186, y: 95 }, { x: 172, y: 150 }, { x: 160, y: 205 }, { x: 148, y: 262 }];
export const LAKE = { x: 125, y: 315, rx: 88, ry: 55 };
export const VILLAGE = { x: 285, y: 140, r: 42 };
export const FOREST = { x: 188, y: 82, r: 46 };
export const DUNES = { x: 315, y: 300, r: 110 };
export const START: V2 = { x: 70, y: 196 };

const HILLS = [
  { x: 80, y: 85, h: 7, r: 55 },
  { x: 225, y: 255, h: 3.5, r: 40 },
  { x: 360, y: 40, h: 6, r: 50 },
  { x: 30, y: 330, h: 4, r: 40 },
];

/** Distance from p to a polyline. */
export function distToLine(p: V2, line: V2[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return best;
}

// a small deterministic value noise for patches and ripples
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const lakeR = (x: number, y: number) => Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry);
/** 0..1 how deep into the dune field. */
export const duneWeight = (x: number, y: number) => 1 - smooth(DUNES.r * 0.55, DUNES.r, Math.hypot(x - DUNES.x, y - DUNES.y));

/** Ground height in metres. */
export function heightAt(x: number, y: number): number {
  let h = 0;
  for (const k of HILLS) h += k.h * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (k.r * k.r));
  // long gentle swells everywhere
  h += 0.8 * Math.sin(x * 0.021 + 1.3) * Math.sin(y * 0.017 + 0.4) + 0.5 * (noise(x * 0.03, y * 0.03) - 0.5);
  // dunes: long ridges across the wind, crests every ~28 m
  const dw = duneWeight(x, y);
  if (dw > 0) {
    const ridge = Math.sin(x * 0.19 + y * 0.09 + Math.sin(y * 0.05) * 1.6);
    h += dw * (2.2 * Math.pow(0.5 + 0.5 * ridge, 1.6) + 0.8 * noise(x * 0.06, y * 0.06));
  }
  // the lake sits in a shallow pan with a soft rim
  const lr = lakeR(x, y);
  h = h * smooth(0.85, 1.25, lr) - 0.6 * (1 - smooth(0.9, 1.1, lr));
  // the stream bed is cut a little into the ground
  const sd = distToLine({ x, y }, STREAM);
  h -= 0.5 * (1 - smooth(2, 6, sd));
  // past the edge of the map the ground rises into high dunes (a soft wall)
  const out = Math.max(0, 8 - x, x - (MAP.size - 8), 8 - y, y - (MAP.size - 8));
  h += out * out * 0.12;
  return h;
}

/** Slope (dh/dx, dh/dy). */
export function slopeAt(x: number, y: number): V2 {
  const e = 0.5;
  return { x: (heightAt(x + e, y) - heightAt(x - e, y)) / (2 * e), y: (heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e) };
}

/**
 * Signed fields behind the surfaces (> 0 inside): smooth, so the view can bake them into a
 * texture and draw crisp edges at any zoom, and the physics reads exactly the same edges.
 * road and mud in metres from the edge, gravel in metres, loose and lake unitless.
 */
export function surfaceFields(x: number, y: number) {
  const p = { x, y };
  return {
    road: Math.min(3.6 - distToLine(p, ROAD), (noise(x * 0.4, y * 0.4) - 0.08) * 8), // a few holes in the old asphalt
    lake: 0.97 - lakeR(x, y),
    mud: 3.2 - distToLine(p, STREAM),
    gravel: VILLAGE.r + 6 * (noise(x * 0.08, y * 0.08) - 0.5) - Math.hypot(x - VILLAGE.x, y - VILLAGE.y),
    // the dune field, and drifts of loose ash elsewhere
    loose: Math.max(duneWeight(x, y) - 0.35 - 0.2 * noise(x * 0.05, y * 0.05), noise(x * 0.025 + 7, y * 0.025 + 3) - 0.72),
  };
}

export function surfaceAt(x: number, y: number): SurfaceId {
  const f = surfaceFields(x, y);
  if (f.road > 0) return 'road';
  if (f.lake > 0) return 'lake';
  if (f.mud > 0) return 'mud';
  if (f.gravel > 0) return 'gravel';
  if (f.loose > 0) return 'loose';
  return 'ash';
}

// ---------------------------------------------------------------- obstacles

export type ObstacleKind = 'building' | 'tree' | 'rock' | 'pylon' | 'wall';

export interface Obstacle {
  kind: ObstacleKind;
  x: number; y: number;
  /** Circle radius (trees, rocks, pylons) or half sizes of an axis-aligned box (buildings, walls). */
  r: number;
  hw?: number; hh?: number;
  /** m, for the wind shadow. */
  height: number;
  /** 0 solid … 1 lets the wind through (a lattice pylon, a bare tree). */
  porous: number;
  rot: number;
  model: number;
}

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** Is p clear of the road, the lake, the start and the other obstacles (for placing things)? */
function freeSpot(p: V2, list: Obstacle[], r: number, avoidRoad = 6): boolean {
  if (distToLine(p, ROAD) < avoidRoad || lakeR(p.x, p.y) < 1.05 || distToLine(p, STREAM) < 4) return false;
  if (Math.hypot(p.x - START.x, p.y - START.y) < 25) return false;
  // course starts and gates stay open
  for (const c of COURSES) for (const q of [c.start, ...c.gates]) if (Math.hypot(p.x - q.x, p.y - q.y) < c.width / 2 + 3 + r) return false;
  if (p.x < 12 || p.y < 12 || p.x > MAP.size - 12 || p.y > MAP.size - 12) return false;
  return list.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.r + r + 3);
}

export function buildObstacles(): Obstacle[] {
  const r = rng(4242);
  const list: Obstacle[] = [];
  // the village: houses along both sides of the road, a few further back
  const houses: [number, number, number, number, number][] = [
    [258, 140, 6, 4.5, 6], [276, 128, 5, 4, 7], [292, 118, 7, 5, 8], [250, 172, 5, 4, 5], [272, 160, 6, 5, 7],
    [298, 150, 5, 4, 6], [316, 136, 6, 4.5, 9], [312, 160, 4.5, 4, 5], [236, 156, 4, 3.5, 4.5], [288, 176, 6, 4, 6],
  ];
  for (const [x, y, hw, hh, h] of houses) list.push({ kind: 'building', x, y, r: Math.hypot(hw, hh), hw, hh, height: h, porous: 0, rot: 0, model: Math.floor(r() * 3) });
  // a broken wall by the road out of the village
  list.push({ kind: 'wall', x: 330, y: 140, r: 9, hw: 9, hh: 0.4, height: 2.2, porous: 0.1, rot: 0, model: 0 });
  // the dead forest
  for (let k = 0, tries = 0; k < 75 && tries < 2000; tries++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * FOREST.r;
    const p = { x: FOREST.x + Math.cos(a) * d, y: FOREST.y + Math.sin(a) * d };
    if (!freeSpot(p, list, 0.6, 5)) continue;
    list.push({ kind: 'tree', x: p.x, y: p.y, r: 0.6, height: 6 + r() * 4, porous: 0.55, rot: r() * 6.28, model: Math.floor(r() * 5) });
    k++;
  }
  // lone trees and rocks across the plain
  for (let k = 0, tries = 0; k < 70 && tries < 3000; tries++) {
    const p = { x: 15 + r() * (MAP.size - 30), y: 15 + r() * (MAP.size - 30) };
    const rock = r() < 0.6;
    const rad = rock ? 1 + r() * 1.6 : 0.6;
    if (!freeSpot(p, list, rad)) continue;
    list.push(rock
      ? { kind: 'rock', x: p.x, y: p.y, r: rad, height: rad * 1.1, porous: 0, rot: r() * 6.28, model: Math.floor(r() * 3) }
      : { kind: 'tree', x: p.x, y: p.y, r: 0.6, height: 5 + r() * 4, porous: 0.55, rot: r() * 6.28, model: Math.floor(r() * 5) });
    k++;
  }
  // a power line along the road, pylons every 45 m on the north side
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1], b = ROAD[i];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = (a.y - b.y) / L, ny = (b.x - a.x) / L; // left of the road's direction
    for (let s = 20; s < L; s += 45) {
      const p = { x: a.x + (b.x - a.x) * s / L - nx * 11, y: a.y + (b.y - a.y) * s / L - ny * 11 };
      if (p.x < 10 || p.x > MAP.size - 10 || Math.hypot(p.x - START.x, p.y - START.y) < 40 || list.some(o => Math.hypot(o.x - p.x, o.y - p.y) < o.r + 4)) continue;
      list.push({ kind: 'pylon', x: p.x, y: p.y, r: 1.2, height: 11, porous: 0.85, rot: Math.atan2(b.y - a.y, b.x - a.x), model: 0 });
    }
  }
  return list;
}

/** Does a circle of radius rad at p hit the obstacle? Returns the push-out normal and depth. */
export function hitObstacle(p: V2, rad: number, o: Obstacle): { nx: number; ny: number; depth: number } | null {
  if (o.hw !== undefined && o.hh !== undefined) {
    const cx = Math.max(o.x - o.hw, Math.min(p.x, o.x + o.hw)), cy = Math.max(o.y - o.hh, Math.min(p.y, o.y + o.hh));
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d >= rad) return null;
    if (d < 1e-6) return { nx: 0, ny: p.y < o.y ? -1 : 1, depth: rad };
    return { nx: dx / d, ny: dy / d, depth: rad - d };
  }
  const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
  if (d >= rad + o.r) return null;
  return { nx: d > 1e-6 ? dx / d : 1, ny: d > 1e-6 ? dy / d : 0, depth: rad + o.r - d };
}
