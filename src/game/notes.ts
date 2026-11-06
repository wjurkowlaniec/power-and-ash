/**
 * Notes found in the world (in the spirit of Control): short documents, logs and
 * personal scraps. Each tells a bit of the story, and many carry a practical hint
 * about how to do something. Read notes go to Wolt's Archive (J). See docs/SWIAT.md, "Notatki i archiwum".
 */
export interface Note { id: string; title: string; kind: 'raport z testu' | 'notatka służbowa' | 'instrukcja' | 'prywatny zapisek'; body: string }

export const NOTES: Record<string, Note> = {
  protokol: {
    id: 'protokol', kind: 'instrukcja', title: 'Protokół serwisowy · komora testowa K-2',
    body: `W razie zaniku zasilania komora pozostaje zamknięta (blokada bezpieczeństwa).

Otwarcie ręczne: dźwignia awaryjna na lewym boku komory. Mechanizm stawia duży opór. Użyć przedłużki (np. rury), założyć na dźwignię i przytrzymać aż do zwolnienia zatrzasku.

Ogniwa nie wyjmować bez nadzoru technika. Nie odłączać od toru pomiarowego w trakcie testu.

— podpis nieczytelny`,
  },
  raport4411: {
    id: 'raport4411', kind: 'raport z testu', title: 'Program Zorza · raport z testu 4411',
    body: `Prototyp Q-1, stanowisko polowe Olszanka.

Od 03:12 ogniwo oddaje więcej energii, niż przyjęło w cyklu ładowania. Nadwyżka 0,4%. Powtórzone trzykrotnie. ████████ nie potwierdza błędu pomiaru.

Zalecenie: NIE ODŁĄCZAĆ OD AUTOMATU SERWISOWEGO. Ogniwo stabilizuje się wyłącznie pod obciążeniem.`,
  },
};

const KEY = 'pip.notes';
let read: string[] = [];
try { read = JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { read = []; }

export const journal = {
  list(): Note[] { return read.map(id => NOTES[id]).filter(Boolean); },
  has(id: string): boolean { return read.includes(id); },
  add(id: string) {
    if (read.includes(id)) return;
    read.push(id);
    try { localStorage.setItem(KEY, JSON.stringify(read)); } catch { /* private mode */ }
  },
};
