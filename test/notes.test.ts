import { describe, it, expect, beforeEach } from 'vitest';
import { journal, decoded, NOTES, LEVELS, isReadable } from '../src/game/notes';

describe('notes: unreadable at first, decoded as the corpus grows', () => {
  beforeEach(() => journal.reset());

  it('nothing is readable before anything is collected', () => {
    const t = decoded('Nowe łożysko i smar są w magazynie, druga półka.', 'tech');
    expect(t).not.toContain('łożysko');
    expect(t.split(' ').length).toBe(9); // word shapes survive
  });

  it('the hall notes open numbers and warnings, not the text', () => {
    journal.add('protokol');
    const up = journal.add('raport4411');
    expect(up).toBe(LEVELS[0].name);
    const t = decoded(NOTES.raport4411.body, 'tech', 1e12);
    expect(t).toContain('NIE ODŁĄCZAĆ');
    expect(t).toContain('03:12');
    expect(t).not.toContain('ogniwo');
    expect(isReadable(NOTES.raport4411)).toBe(false);
  });

  it('the station notes and books decode technical and plain print; handwriting stays', () => {
    for (const id of ['protokol', 'raport4411', 'kartkaTechnika', 'mapaSieci', 'notatkaKierowniczki', 'podrecznik', 'slownik']) journal.add(id);
    expect(isReadable(NOTES.raport4411)).toBe(true);
    expect(isReadable(NOTES.notatkaKierowniczki)).toBe(true);
    expect(isReadable(NOTES.kartkaTechnika)).toBe(false);
    expect(decoded(NOTES.raport4411.body, 'tech', 1e12)).toContain('ogniwo');
  });

  it('pictures need no decoding', () => {
    expect(decoded('Mapa doliny', 'image')).toBe('Mapa doliny');
  });
});
