import { describe, it, expect } from 'vitest';
import { parseHash, formatHash, matches, frameDistance, Clock } from '../src/viewer/state';

describe('viewer link state', () => {
  it('parses the model and typed parameters', () => {
    expect(parseHash('#wolt&speed=2.5&arm=work&strain=true')).toEqual({ id: 'wolt', params: { speed: 2.5, arm: 'work', strain: true } });
    expect(parseHash('')).toEqual({ id: null, params: {} });
    expect(parseHash('#glb%3Akaykit%2FBarrel_A')).toEqual({ id: 'glb:kaykit/Barrel_A', params: {} });
  });

  it('writes only changed parameters and round-trips', () => {
    const h = formatHash('wolt', { speed: 2, arm: 'rest', strain: true }, { speed: 0, arm: 'rest', strain: false });
    expect(h).toBe('#wolt&speed=2&strain=true');
    expect(parseHash(h)).toEqual({ id: 'wolt', params: { speed: 2, strain: true } });
  });
});

describe('viewer search', () => {
  it('ignores case and Polish diacritics, needs every word', () => {
    expect(matches('zaglowoz', 'Żaglowóz (Żegluga)')).toBe(true);
    expect(matches('wolt ramie', 'Wolt', 'ramię, koło')).toBe(true);
    expect(matches('wolt beczka', 'Wolt')).toBe(false);
    expect(matches('  ', 'cokolwiek')).toBe(true);
  });
});

describe('viewer framing and clock', () => {
  it('moves the camera further for bigger models and narrower views', () => {
    const d1 = frameDistance(1, 40, 1.5), d2 = frameDistance(2, 40, 1.5);
    expect(d2).toBeCloseTo(d1 * 2, 5);
    expect(frameDistance(1, 40, 0.5)).toBeGreaterThan(d1);
  });

  it('pauses, scales and steps', () => {
    const c = new Clock();
    expect(c.advance(0.016)).toBeCloseTo(0.016);
    c.speed = 0.5; expect(c.advance(0.02)).toBeCloseTo(0.01);
    c.playing = false; expect(c.advance(0.02)).toBe(0);
    c.step(); expect(c.advance(0.02)).toBeCloseTo(1 / 30);
    c.playing = true; c.speed = 1; expect(c.advance(5)).toBeCloseTo(0.1); // capped
  });
});
