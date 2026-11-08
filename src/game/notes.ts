/**
 * Notes found in the world (in the spirit of Control): short documents, logs and
 * personal scraps. Each tells a bit of the story, and many carry a practical hint
 * about how to do something. Read notes go to Wolt's Archive (J). See docs/SWIAT.md, "Notatki i archiwum".
 */
/**
 * Script a document is written in. Q-1 cannot read human writing at first: every note is
 * collected as unreadable signs and decodes as the corpus grows (docs/SWIAT.md).
 * 'image' is something Wolt sees (a map, a drawing): always understood.
 * 'machine' is a machine log: always readable.
 */
export type Script = 'tech' | 'print' | 'hand' | 'image' | 'machine';

export interface Note {
  id: string;
  /** Wolt's own label for the thing (always readable, used in the Archive list). */
  label: string;
  /** The document's own heading (decodes with the body). */
  title: string;
  kind: 'raport z testu' | 'notatka służbowa' | 'instrukcja' | 'prywatny zapisek' | 'mapa' | 'książka';
  script: Script;
  body: string;
  /** Characters this adds to the corpus (defaults to the body's length; books add a lot). */
  corpus?: number;
  /** Inline SVG drawing on the sheet: early hints are pictures, readable before the text. */
  sketch?: string;
}

const INK = 'stroke="#2c2f31" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const RED = 'stroke="#8a2a1e" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';

export const NOTES: Record<string, Note> = {
  protokol: {
    id: 'protokol', label: 'Instrukcja przy komorze', script: 'tech', kind: 'instrukcja', sketch: `<svg viewBox="0 0 300 120"><rect x="110" y="20" width="90" height="80" rx="6" ${INK}/><circle cx="155" cy="60" r="16" ${INK}/><path d="M110 70 L80 70 L60 40" ${INK}/><path d="M62 42 L20 -4" ${RED} stroke-dasharray="6 4"/><path d="M40 30 L52 60 M44 54 L52 60 L58 51" ${RED}/><text x="8" y="112" font-size="11" fill="#2c2f31">⊣ ↓</text></svg>`, title: 'Protokół serwisowy · komora testowa K-2',
    body: `W razie zaniku zasilania komora pozostaje zamknięta (blokada bezpieczeństwa).

Otwarcie ręczne: dźwignia awaryjna na lewym boku komory. Mechanizm stawia duży opór. Użyć przedłużki (np. rury), założyć na dźwignię i przytrzymać aż do zwolnienia zatrzasku.

Ogniwa nie wyjmować bez nadzoru technika. Nie odłączać od toru pomiarowego w trakcie testu.

— podpis nieczytelny`,
  },
  raport4411: {
    id: 'raport4411', label: 'Wydruk przy stanowisku', script: 'tech', kind: 'raport z testu', sketch: `<svg viewBox="0 0 300 80"><path d="M10 70 H290 M10 70 V8" ${INK}/><path d="M10 60 C60 58 90 56 120 52 S180 30 200 26 S260 14 290 10" ${RED}/><path d="M10 40 H290" stroke="#2c2f31" stroke-width="1" stroke-dasharray="3 4"/></svg>`, title: 'Program Zorza · raport z testu 4411',
    body: `Prototyp Q-1, stanowisko polowe Olszanka.

Od 03:12 ogniwo oddaje więcej energii, niż przyjęło w cyklu ładowania. Nadwyżka 0,4%. Powtórzone trzykrotnie. ████████ nie potwierdza błędu pomiaru.

Zalecenie: NIE ODŁĄCZAĆ OD AUTOMATU SERWISOWEGO. Ogniwo stabilizuje się wyłącznie pod obciążeniem.`,
  },
  kartkaTechnika: {
    id: 'kartkaTechnika', label: 'Kartka na drzwiach warsztatu', script: 'hand', kind: 'instrukcja', sketch: `<svg viewBox="0 0 300 130"><rect x="40" y="14" width="60" height="96" ${INK}/><rect x="14" y="56" width="12" height="16" ${INK}/><path d="M38 64 L30 64 M34 59 L29 64 L34 69" ${RED}/><path d="M14 74 C10 90 30 96 40 92" ${INK} stroke-dasharray="3 3"/><path d="M170 22 H290 M170 52 H290 M170 82 H290 M170 112 H290 M172 22 V118 M288 22 V118" ${INK}/><circle cx="215" cy="72" r="9" ${INK}/><circle cx="215" cy="72" r="3" ${INK}/><rect x="240" y="66" width="12" height="14" ${INK}/><path d="M215 60 L215 40 L198 36" ${RED}/><text x="262" y="74" font-size="16" fill="#8a2a1e">2</text></svg>`, title: 'Kartka na drzwiach warsztatu',
    body: `Zamek padł znowu. Jak nie ma prądu, wepnij się w port po lewej, wystarczy chwila.

I NIE ZOSTAWIAJ TURBINY Z TYM ŁOŻYSKIEM. Nowe łożysko i smar są w magazynie, druga półka. Łożysko waży swoje, do masztu weź starą oponę i ciągnij jak sanki.

— T.`,
  },
  notatkaKierowniczki: {
    id: 'notatkaKierowniczki', label: 'Pismo z szuflady w dyżurce', script: 'print', kind: 'notatka służbowa', title: 'Notatka służbowa · przeniesienie Q-1',
    body: `Do: dyrekcja Programu Zorza
Od: kierowniczka stacji Olszanka
Temat: przeniesienie Q-1 do laboratorium

Odmawiam. Q-1 jest stabilne tylko u nas, z naszym automatem. Jeśli ktoś chce budować Q-2 na danych z czterech miesięcy, niech podpisze to sam.`,
  },
  mapaSieci: {
    id: 'mapaSieci', label: 'Mapa na ścianie dyżurki', script: 'image', kind: 'mapa', title: 'Mapa na ścianie dyżurki',
    body: `Mapa doliny i gór. Markerem zakreślono siedem punktów i połączono je linią: Sieć Siedmiu Stacji. Olszanka jest pierwsza od zachodu.

Jeden punkt w górach, z dala od linii, ktoś przekreślił kilka razy, aż przebił papier.`,
  },
  podrecznik: {
    id: 'podrecznik', label: 'Gruba książka z dyżurki', script: 'print', kind: 'książka', corpus: 2600,
    title: 'Podręcznik elektromontera sieci rozdzielczych',
    body: `Rozdział 4. Łączenie źródeł o różnej mocy.

Zanim połączysz dwa źródła, sprawdź napięcie na obu końcach. Źródło słabsze nie pociągnie odbiornika, który wymaga więcej, niż samo daje: fabrykator na 600 W nie ruszy z ogniwa dającego 200 W.

Kabel prowadź najkrótszą drogą i nie zostawiaj go napiętego na krawędziach.`,
  },
  slownik: {
    id: 'slownik', label: 'Słownik z półki w dyżurce', script: 'print', kind: 'książka', corpus: 2000,
    title: 'Mały słownik techniczny',
    body: `ŁOŻYSKO · element podpierający wał i zmniejszający tarcie. Zatarte łożysko blokuje wirnik.

PRZYŁĄCZE · gniazdo, którym budynek przyjmuje prąd z zewnątrz.

ROZDZIELNIA · stacja, która dzieli i kieruje prąd do odbiorców.`,
  },
};

const KEY = 'pip.notes';
let read: string[] = [];
try { read = JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { read = []; }

/** Decoding levels: each opens a script. Thresholds are characters of collected text. */
export const LEVELS = [
  { at: 450, name: 'liczby, jednostki i znaki ostrzegawcze' },
  { at: 1400, name: 'druk techniczny' },
  { at: 3500, name: 'zwykły druk' },
  { at: 7000, name: 'pismo odręczne' },
];
const SCRIPT_LEVEL: Record<Script, number> = { image: 0, machine: 0, tech: 2, print: 3, hand: 4 };

export const corpusOf = (ids: string[]) => ids.reduce((a, id) => a + (NOTES[id] ? NOTES[id].corpus ?? NOTES[id].body.length + NOTES[id].title.length : 0), 0);
export const levelOf = (corpus: number) => LEVELS.filter(l => corpus >= l.at).length;

/** When each level opened (performance.now ms), for the word-by-word reveal. */
const opened: number[] = [];

export const journal = {
  list(): Note[] { return read.map(id => NOTES[id]).filter(Boolean); },
  has(id: string): boolean { return read.includes(id); },
  corpus(): number { return corpusOf(read); },
  level(): number { return levelOf(this.corpus()); },
  /** Adds a note; returns the name of a newly decoded script, if this pushed past a threshold. */
  add(id: string): string | null {
    if (read.includes(id)) return null;
    const before = this.level();
    read.push(id);
    try { localStorage.setItem(KEY, JSON.stringify(read)); } catch { /* private mode */ }
    const after = this.level();
    if (after <= before) return null;
    for (let l = before + 1; l <= after; l++) opened[l] = performance.now();
    return LEVELS[after - 1].name;
  },
  /** For tests and a fresh start. */
  reset(ids: string[] = []) { read = [...ids]; opened.length = 0; },
};

// ---------- what the reader sees

const GLYPHS = '⌇⍀⏃⏁⎍⟟⊑⋔⌰⍜⍾⏚⎐⟒⋏⌿⏂⍙⊬⋉⍦⌖⎅⟊⋌⌬⍡⏆';
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const glyphFor = (ch: string, k: number) => GLYPHS[(ch.toLowerCase().charCodeAt(0) * 7 + k) % GLYPHS.length];

/** One word as the battery sees it at this decoding level. */
function word(w: string, readable: boolean, level: number, salt: number): string {
  if (readable) return w;
  const letters = w.replace(/[^\p{L}]/gu, '');
  // level 1: numbers, units and warnings (capitalised words) come through
  if (level >= 1 && letters.length >= 2 && letters === letters.toUpperCase()) return w;
  if (level >= 1 && /^[\d,.%°/:-]+[A-Za-z%]{0,2}$/.test(w)) return w;
  return [...w].map((c, i) => /\p{L}/u.test(c) || (/\d/.test(c) && level < 1) ? glyphFor(c, salt + i) : c).join('');
}

/** A text as the battery reads it now; words of a freshly decoded script flip in one by one. */
export function decoded(text: string, script: Script, now = performance.now()): string {
  const need = SCRIPT_LEVEL[script];
  const level = journal.level();
  if (need === 0) return text;
  const since = level >= need && opened[need] !== undefined ? (now - opened[need]) / 4000 : level >= need ? 99 : -1;
  let i = 0;
  return text.replace(/\S+/g, w => {
    const k = i++;
    return word(w, since >= 0 && hash(k) < since, level, k * 3);
  });
}

export function isReadable(n: Note): boolean { return journal.level() >= SCRIPT_LEVEL[n.script]; }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The note card's inner HTML. */
export function noteHtml(n: Note): string {
  const body = decoded(n.body, n.script).split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const sk = n.sketch ? `<div class="sketch">${n.sketch}</div>` : '';
  const state = isReadable(n) ? '' : `<div class="small undecoded">pismo nieodczytane · zbierz więcej tekstu (${Math.round(journal.corpus() / 100) / 10} tys. znaków w korpusie)</div>`;
  return `<div class="lbl">${n.label}</div><h2>${esc(decoded(n.title, n.script))}</h2>${sk}<div class="body ${n.script}">${body}</div>${state}<div class="small">E · odłóż &nbsp; J · archiwum</div>`;
}

/** The Archive: Wolt's labels, plus how far decoding has got. */
export function journalHtml(): string {
  const lv = journal.level(), next = LEVELS[lv];
  const prog = next ? `<div class="bar"><i style="width:${Math.min(100, journal.corpus() / next.at * 100)}%"></i></div><div class="small">następne: ${next.name}</div>` : '';
  return `<div class="lbl">archiwum</div><h2>Zapisy w pamięci Wolta</h2>` +
    journal.list().map((n, i) => `<p><b>${i + 1}</b> &nbsp;${n.label}${isReadable(n) ? '' : ' <span class="undecoded">· nieczytelne</span>'}</p>`).join('') +
    `<div class="small">odczytane: ${lv ? LEVELS.slice(0, lv).map(l => l.name).join(', ') : 'nic'}</div>${prog}<div class="small">cyfra · czytaj &nbsp; J · zamknij</div>`;
}
