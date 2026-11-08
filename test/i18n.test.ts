import { describe, it, expect } from 'vitest';
import { tr, lang, num } from '../src/i18n';
import { NOTES } from '../src/game/notes';

describe('i18n', () => {
  it('is Polish outside a browser', () => {
    expect(lang).toBe('pl');
    expect(tr('tak', 'yes')).toBe('tak');
    expect(num(2.5)).toBe('2,5');
  });
  it('keeps the corpus of every note set, so decoding is the same in both languages', () => {
    for (const n of Object.values(NOTES)) expect(n.corpus).toBeGreaterThan(0);
  });
});
