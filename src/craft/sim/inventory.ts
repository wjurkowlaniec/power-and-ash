import { ITEMS, ItemId, Bag } from '../data';

/** One slot: an item and how many. */
export interface Stack { id: ItemId; n: number }

/**
 * A fixed number of slots, each holding up to the item's stack size. Wolt himself has a
 * handful; the cart adds a dozen and is the only place big things (panels, machines) fit.
 */
export class Inventory {
  slots: (Stack | null)[];

  constructor(size: number, readonly bigOk = false) {
    this.slots = Array.from({ length: size }, () => null);
  }

  get size() { return this.slots.length; }

  /** Grow or shrink (dropping what does not fit is the caller's job: see `resize`). */
  resize(size: number): Stack[] {
    const lost: Stack[] = [];
    while (this.slots.length > size) { const s = this.slots.pop(); if (s) lost.push(s); }
    while (this.slots.length < size) this.slots.push(null);
    return lost;
  }

  count(id: ItemId): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  }

  accepts(id: ItemId): boolean { return this.bigOk || !ITEMS[id].big; }

  /** How many of `id` would still fit. */
  room(id: ItemId): number {
    if (!this.accepts(id)) return 0;
    const st = ITEMS[id].stack;
    let r = 0;
    for (const s of this.slots) r += !s ? st : s.id === id ? st - s.n : 0;
    return r;
  }

  /** Put in up to n; returns how many did not fit. Tops up existing stacks first. */
  add(id: ItemId, n: number): number {
    if (!this.accepts(id) || n <= 0) return n;
    const st = ITEMS[id].stack;
    for (const s of this.slots) {
      if (n <= 0) break;
      if (s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      if (this.slots[i]) continue;
      const k = Math.min(n, st);
      this.slots[i] = { id, n: k }; n -= k;
    }
    return n;
  }

  /** Take out up to n; returns how many were taken. Empties the smallest stacks first. */
  remove(id: ItemId, n: number): number {
    let taken = 0;
    const order = this.slots.map((s, i) => [s, i] as const).filter(([s]) => s && s.id === id).sort((a, b) => a[0]!.n - b[0]!.n);
    for (const [s, i] of order) {
      if (taken >= n) break;
      const k = Math.min(n - taken, s!.n);
      s!.n -= k; taken += k;
      if (s!.n === 0) this.slots[i] = null;
    }
    return taken;
  }

  used(): number { return this.slots.filter(Boolean).length; }

  /** Everything inside as a bag. */
  bag(): Bag {
    const b: Bag = {};
    for (const s of this.slots) if (s) b[s.id] = (b[s.id] ?? 0) + s.n;
    return b;
  }

  clear() { this.slots.fill(null); }
}

/** Several inventories seen as one (Wolt + the cart when it is near). */
export class Pool {
  constructor(readonly parts: Inventory[]) {}

  count(id: ItemId) { return this.parts.reduce((s, p) => s + p.count(id), 0); }

  has(bag: Bag, times = 1): boolean {
    return (Object.entries(bag) as [ItemId, number][]).every(([id, n]) => this.count(id) >= n * times);
  }

  /** Take a bag out (only call after `has`). Takes from the last part first (the cart), so Wolt keeps his hands full of what is handy. */
  take(bag: Bag) {
    for (const [id, n] of Object.entries(bag) as [ItemId, number][]) {
      let left = n;
      for (const p of [...this.parts].reverse()) { if (left <= 0) break; left -= p.remove(id, left); }
    }
  }

  /** Put in, small things to Wolt first, big things to whoever takes them. Returns what did not fit. */
  give(id: ItemId, n: number): number {
    for (const p of this.parts) { if (n <= 0) break; n = p.add(id, n); }
    return n;
  }

  room(id: ItemId) { return this.parts.reduce((s, p) => s + p.room(id), 0); }
}
