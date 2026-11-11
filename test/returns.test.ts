import { describe, it, expect } from 'vitest';
import { Returns, PLACE, TUNE, Input } from '../src/returns/sim/returns';

const idle: Input = { mx: 0, my: 0, act: false };
function put(g: Returns, p: { x: number; y: number }) { g.wolt.x = p.x; g.wolt.y = p.y; }
function press(g: Returns) { g.update(1 / 30, { ...idle, act: true }); g.update(1 / 30, idle); }
function fix(g: Returns) { put(g, PLACE.cableEnd); press(g); }
function sleep(g: Returns, years: number) {
  put(g, PLACE.shelter);
  g.update(1 / 30, { ...idle, act: true });
  while (g.sleep && g.sleep.n < years) g.update(1 / 30, { ...idle, act: true });
  while (g.sleep) g.update(1 / 30, idle);
}

describe('Powroty', () => {
  it('starts dark; splicing the cable lights the window', () => {
    const g = new Returns();
    expect(g.windowLit).toBe(false);
    fix(g);
    expect(g.powered).toBe(true);
    expect(g.windowLit).toBe(true);
    expect(g.memory).toBeGreaterThan(0.4);
  });

  it('the cable rusts through unless Wolt comes back', () => {
    const g = new Returns();
    fix(g);
    for (let i = 0; i < TUNE.cableLife; i++) g.stepYear();
    expect(g.powered).toBe(true);
    expect(g.rust).toBe(1);
    g.stepYear();
    expect(g.powered).toBe(false);
  });

  it('holding the button sleeps longer, one year per tick', () => {
    const g = new Returns();
    sleep(g, 1);
    expect(g.year).toBe(1);
    sleep(g, 7);
    expect(g.year).toBe(8);
    expect(g.sleep).toBeNull();
  });

  it('a long sleep leaves fewer gifts at the door', () => {
    const a = new Returns(); fix(a); sleep(a, 2);
    const b = new Returns(); fix(b); sleep(b, 12);
    expect(a.gifts).toBe(3);
    expect(b.gifts).toBeLessThan(a.gifts);
    const c = new Returns(); sleep(c, 2);
    expect(c.gifts).toBe(0); // never helped: nobody leaves anything
  });

  it('strangers hide; a helped homestead draws his sign, and it simplifies over generations', () => {
    const g = new Returns();
    put(g, PLACE.frame);
    for (let i = 0; i < 200; i++) g.update(1 / 30, idle);
    expect(g.people.every(p => g.hiding(p))).toBe(true);
    fix(g); g.stepYear();
    expect(g.symbol).toBe(1);
    for (let y = 0; y < 30; y++) { g.stepYear(); if (!g.powered) fix(g); g.visited = false; put(g, PLACE.frame); g.update(1 / 30, idle); }
    expect(g.symbol).toBe(3);
    expect(g.people.length).toBeGreaterThan(0);
  });

  it('a homestead left in the dark empties out', () => {
    const g = new Returns();
    for (let i = 0; i < 45; i++) g.stepYear();
    expect(g.people.length).toBe(0);
    expect(g.windowLit).toBe(false);
  });

  it('far windows go dark one by one and the deer does not live forever', () => {
    const g = new Returns();
    expect([0, 1, 2].map(i => g.farLit(i))).toEqual([true, true, true]);
    for (let i = 0; i < 20; i++) g.stepYear();
    expect([0, 1, 2].map(i => g.farLit(i))).toEqual([false, false, true]);
    expect(g.deer.alive).toBe(false);
    expect(g.deer.grave).not.toBeNull();
  });

  it('the deer keeps away until Wolt stands still near it, then follows', () => {
    const g = new Returns();
    put(g, { x: g.deer.x - 7.5, y: g.deer.y });
    for (let i = 0; i < 30 * 8; i++) g.update(1 / 30, idle);
    expect(g.deer.trust).toBe(1);
    put(g, { x: g.deer.x + 12, y: g.deer.y });
    const before = g.deer.x;
    for (let i = 0; i < 60; i++) g.update(1 / 30, idle);
    expect(g.deer.x).toBeGreaterThan(before);
  });
});
