import { describe, it, expect } from 'vitest';
import { keysFor } from '../src/touch';

describe('touch controls', () => {
  const steer = { kind: 'h' as const, codes: ['KeyA', 'KeyD'] as [string, string], labels: ['◀', '▶'] as [string, string] };
  const sheet = { kind: 'v' as const, codes: ['KeyW', 'KeyS'] as [string, string], labels: ['in', 'out'] as [string, string] };
  it('a rocker holds the end the finger is on, nothing in the middle', () => {
    expect(keysFor(steer, -0.8, 0)).toEqual(['KeyA']);
    expect(keysFor(steer, 0.5, 0.9)).toEqual(['KeyD']);
    expect(keysFor(steer, 0.05, 0)).toEqual([]);
    expect(keysFor(sheet, 0, -0.7)).toEqual(['KeyW']);
    expect(keysFor(sheet, 0, 0.7)).toEqual(['KeyS']);
  });
  it('the stick sends WASD in 8 directions with a dead zone', () => {
    const st = { kind: 'stick' as const };
    expect(keysFor(st, 0.1, 0.1)).toEqual([]);
    expect(keysFor(st, 1, 0)).toEqual(['KeyD']);
    expect(keysFor(st, 0, -1)).toEqual(['KeyW']);
    expect(keysFor(st, -0.7, 0.7).sort()).toEqual(['KeyA', 'KeyS']);
  });
});
