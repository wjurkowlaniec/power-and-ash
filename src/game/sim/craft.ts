import { tr } from '../../i18n';

/**
 * Crafting kernel of the game (level "Wyspa", docs/POZIOM-WYSPA.md): items, recipes and
 * Wolt's small inventory. Pure logic. Kept apart from the crafting demo (src/craft) on
 * purpose: the demo is the sandbox of every system, this is only what the level tests.
 *
 * Big things (an accumulator, a panel frame, a whole panel) never fit the inventory:
 * they ride on the sled behind Wolt.
 */
export type ItemId =
  | 'copper' | 'plastic' | 'iron' | 'glass' | 'oil'
  | 'cell' | 'pane' | 'cable' | 'cableThick' | 'trafo' | 'connector' | 'fuse' | 'splitter' | 'pin'
  | 'battery' | 'frame' | 'panel';

export interface ItemSpec { name: string; stack: number; big?: boolean; unit?: string }

export const ITEMS: Record<ItemId, ItemSpec> = {
  copper: { name: tr('miedź', 'copper'), stack: 10 },
  plastic: { name: tr('plastik', 'plastic'), stack: 10 },
  iron: { name: tr('żelazo', 'iron'), stack: 10 },
  glass: { name: tr('szkło', 'glass'), stack: 10 },
  oil: { name: tr('olej', 'oil'), stack: 5 },
  cell: { name: tr('ogniwo PV', 'PV cell'), stack: 6 },
  pane: { name: tr('szyba panelu', 'panel pane'), stack: 2 },
  cable: { name: tr('kabel', 'cable'), stack: 40, unit: 'm' },
  // the heavy line cable: only found for now; making it comes later in the game (decision 2026-11-17)
  cableThick: { name: tr('gruby kabel', 'heavy cable'), stack: 20, unit: 'm' },
  trafo: { name: tr('transformator', 'transformer'), stack: 1 },
  connector: { name: tr('złącze panelu', 'panel connector'), stack: 5 },
  fuse: { name: tr('bezpiecznik', 'fuse'), stack: 5 },
  splitter: { name: tr('rozgałęźnik', 'splitter'), stack: 2 },
  pin: { name: tr('sworzeń', 'hinge pin'), stack: 5 },
  battery: { name: tr('akumulator', 'accumulator'), stack: 1, big: true },
  frame: { name: tr('rama panelu', 'panel frame'), stack: 1, big: true },
  panel: { name: tr('panel słoneczny', 'solar panel'), stack: 1, big: true },
};

export type Bag = Partial<Record<ItemId, number>>;

export type RecipeId = 'cable' | 'connector' | 'fuse' | 'splitter' | 'pin' | 'frame' | 'panel' | 'storage';

export interface Recipe {
  id: RecipeId;
  name: string;
  /** What comes out (the storage is built in place, so it has no item). */
  out: { id: ItemId; n: number } | null;
  need: Bag;
  /** Only at the workbench in the bunker (and then from the grid, not from Wolt). */
  bench: boolean;
  /** s of work by hand; the bench is BENCH_SPEED times faster. */
  time: number;
}

export const BENCH_SPEED = 2;
export const HAND_COST = 0.35; // % of Q-1 per second of work by hand

export const RECIPES: Record<RecipeId, Recipe> = {
  cable: { id: 'cable', name: tr('kabel 5 m', 'cable 5 m'), out: { id: 'cable', n: 5 }, need: { copper: 1, plastic: 1 }, bench: false, time: 2.5 },
  connector: { id: 'connector', name: tr('złącze panelu', 'panel connector'), out: { id: 'connector', n: 1 }, need: { copper: 1, plastic: 1 }, bench: false, time: 2.5 },
  fuse: { id: 'fuse', name: tr('bezpiecznik', 'fuse'), out: { id: 'fuse', n: 1 }, need: { copper: 1, glass: 1 }, bench: false, time: 2.5 },
  splitter: { id: 'splitter', name: tr('rozgałęźnik', 'splitter'), out: { id: 'splitter', n: 1 }, need: { copper: 2, plastic: 1, iron: 1 }, bench: false, time: 3.5 },
  pin: { id: 'pin', name: tr('sworzeń', 'hinge pin'), out: { id: 'pin', n: 1 }, need: { iron: 1 }, bench: false, time: 2 },
  frame: { id: 'frame', name: tr('rama panelu', 'panel frame'), out: { id: 'frame', n: 1 }, need: { iron: 3 }, bench: true, time: 4 },
  panel: { id: 'panel', name: tr('panel słoneczny', 'solar panel'), out: { id: 'panel', n: 1 }, need: { frame: 1, cell: 2, pane: 1, connector: 1 }, bench: true, time: 6 },
  storage: { id: 'storage', name: tr('magazyn energii', 'energy storage'), out: null, need: { battery: 4, iron: 2, cable: 5 }, bench: true, time: 8 },
};

/** A handful of slots on Wolt, each holding up to the item's stack. Big items are refused. */
export class Inventory {
  slots: ({ id: ItemId; n: number } | null)[];
  constructor(size: number) { this.slots = Array.from({ length: size }, () => null); }

  count(id: ItemId): number { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0); }

  room(id: ItemId): number {
    if (ITEMS[id].big) return 0;
    const st = ITEMS[id].stack;
    return this.slots.reduce((a, s) => a + (!s ? st : s.id === id ? st - s.n : 0), 0);
  }

  /** Put in up to n; returns how many did not fit. */
  add(id: ItemId, n: number): number {
    if (ITEMS[id].big) return n;
    const st = ITEMS[id].stack;
    for (const s of this.slots) if (n > 0 && s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; }
    for (let i = 0; i < this.slots.length && n > 0; i++) if (!this.slots[i]) { const k = Math.min(n, st); this.slots[i] = { id, n: k }; n -= k; }
    return n;
  }

  /** Take up to n; returns how many were taken. */
  take(id: ItemId, n: number): number {
    let got = 0;
    for (let i = this.slots.length - 1; i >= 0 && got < n; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n - got, s.n);
      s.n -= k; got += k;
      if (s.n === 0) this.slots[i] = null;
    }
    return got;
  }

  used(): number { return this.slots.filter(Boolean).length; }
}

/** "2 miedź + 1 plastik" for a bag. */
export function bagText(b: Bag): string {
  return (Object.entries(b) as [ItemId, number][]).map(([id, n]) => `${n}${ITEMS[id].unit ?? ''} ${ITEMS[id].name}`).join(' + ');
}
