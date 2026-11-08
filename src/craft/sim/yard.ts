import { V2 } from '../../sim/vec';
import { ObstacleKind } from '../../sim/world';
import { BuildKind, ScrapKind } from '../data';

/**
 * The yard of the crafting demo: a ruined workshop in the ash with a workbench, an old
 * wind turbine, a broken service cart and a lot of junk. 1 tile = 1 m, x east, y south.
 */
export const YARD = { width: 46, height: 34 };

export const START: V2 = { x: 19.5, y: 14.5 };
export const CART_AT: V2 = { x: 14.5, y: 15 };

/** Fixed buildings: the workbench (under the garage roof) and the old turbine. */
export const FIXED: { kind: BuildKind; x: number; y: number }[] = [
  { kind: 'bench', x: 18, y: 11 },
  { kind: 'oldturbine', x: 28, y: 8 },
];

export const SCRAP_AT: { kind: ScrapKind; x: number; y: number; rot?: number }[] = [
  { kind: 'pile', x: 11, y: 10 }, { kind: 'pile', x: 13, y: 7 }, { kind: 'pile', x: 24, y: 15 }, { kind: 'pile', x: 9, y: 17 },
  { kind: 'pile', x: 25, y: 5 }, { kind: 'pile', x: 16, y: 19 }, { kind: 'pile', x: 21, y: 18 }, { kind: 'pile', x: 6, y: 13 },
  { kind: 'crate', x: 8, y: 11 }, { kind: 'crate', x: 31, y: 14 }, { kind: 'crate', x: 23, y: 9 },
  { kind: 'bearingbox', x: 12, y: 22 }, { kind: 'bearingbox', x: 33, y: 21 },
  { kind: 'barrel', x: 33, y: 10 }, { kind: 'barrel', x: 34, y: 11 }, { kind: 'barrel', x: 6, y: 8 }, { kind: 'barrel', x: 27, y: 18 },
  { kind: 'dumpster', x: 24, y: 21 },
  { kind: 'car', x: 37, y: 16, rot: 0.15 }, { kind: 'car', x: 41, y: 23, rot: -0.3 }, { kind: 'car', x: 31, y: 26, rot: 1.4 },
  { kind: 'solarwreck', x: 8, y: 3 }, { kind: 'solarwreck', x: 12, y: 2 }, { kind: 'solarwreck', x: 3, y: 22 },
  { kind: 'streetlight', x: 18, y: 25 }, { kind: 'streetlight', x: 36, y: 29 },
  { kind: 'server', x: 38, y: 6 }, { kind: 'server', x: 40, y: 7 },
  { kind: 'radiobox', x: 42, y: 12 },
  { kind: 'buried', x: 7, y: 27 },
];

/** Plain blocks: rocks, dead trees, the garage, the water tower. */
export const BLOCKS: { kind: ObstacleKind; x: number; y: number; w: number; h: number; model?: string }[] = [
  { kind: 'container', x: 17, y: 6, w: 6, h: 4, model: 'garage' },
  { kind: 'container', x: 31, y: 1, w: 3, h: 3, model: 'watertower' },
  { kind: 'rock', x: 2, y: 15, w: 2, h: 2 }, { kind: 'rock', x: 15, y: 28, w: 2, h: 1 }, { kind: 'rock', x: 26, y: 30, w: 3, h: 2 },
  { kind: 'rock', x: 43, y: 3, w: 2, h: 2 }, { kind: 'rock', x: 44, y: 28, w: 1, h: 2 }, { kind: 'rock', x: 20, y: 29, w: 1, h: 1 },
  { kind: 'rock', x: 29, y: 22, w: 1, h: 1 }, { kind: 'rock', x: 4, y: 30, w: 2, h: 2 },
  { kind: 'tree', x: 3, y: 4, w: 1, h: 1 }, { kind: 'tree', x: 41, y: 2, w: 1, h: 1 },
  { kind: 'tree', x: 1, y: 9, w: 1, h: 1 }, { kind: 'tree', x: 44, y: 18, w: 1, h: 1 },
  { kind: 'crate', x: 16, y: 10, w: 1, h: 1, model: 'shelf' }, { kind: 'crate', x: 23, y: 10, w: 1, h: 1, model: 'cabinet' },
];
