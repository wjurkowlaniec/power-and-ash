/**
 * Two languages, Polish and English, for the game and the tech demo.
 *
 * Every player-facing string is written in place as `tr('polski', 'English')`, so the
 * Polish original and its translation stay side by side in the code. The language is
 * chosen once when the page loads: `?lang=en|pl`, then the saved choice, then the
 * browser language (Polish browsers get Polish, the rest English). Switching saves the
 * choice and reloads the page, so strings built at module load are always right.
 * Outside a browser (the tests) it is always Polish.
 */
export type Lang = 'pl' | 'en';

const KEY = 'pip.lang';
const isLang = (s: unknown): s is Lang => s === 'pl' || s === 'en';

function detect(): Lang {
  if (typeof document === 'undefined') return 'pl';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) { localStorage.setItem(KEY, q); return q; }
  } catch { /* no storage */ }
  try {
    const s = localStorage.getItem(KEY);
    if (isLang(s)) return s;
  } catch { /* no storage */ }
  return /^pl\b/i.test(navigator.language ?? '') ? 'pl' : 'en';
}

export const lang: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** The string for the current language. */
export const tr = (pl: string, en: string): string => (lang === 'en' ? en : pl);

/** Polish decimal comma, English decimal point. */
export const num = (n: number, digits = 1): string => {
  const s = n.toFixed(digits);
  return lang === 'pl' ? s.replace('.', ',') : s;
};

export function setLang(l: Lang) {
  if (l === lang) return;
  try { localStorage.setItem(KEY, l); } catch { /* no storage */ }
  const u = new URL(location.href);
  u.searchParams.set('lang', l); // works even without storage
  location.href = u.toString();
}

/** A small "PL · EN" switch. Clicks on it do not reach whatever is behind it. */
export function langSwitch(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'lang-switch';
  el.innerHTML = (['pl', 'en'] as Lang[]).map(l =>
    `<button type="button" data-l="${l}" class="${l === lang ? 'on' : ''}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`).join('<span>·</span>');
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest('button');
    if (b && isLang(b.dataset.l)) setLang(b.dataset.l);
  });
  return el;
}

/** CSS for the switch, shared by both pages. */
export const LANG_CSS = `
.lang-switch { display: inline-flex; align-items: center; gap: 4px; font: 11px var(--mono, ui-monospace, monospace); letter-spacing: .15em; pointer-events: auto; }
.lang-switch span { opacity: .35; }
.lang-switch button { font: inherit; letter-spacing: inherit; background: none; border: 0; padding: 4px 6px; color: inherit; opacity: .45; cursor: pointer; }
.lang-switch button.on { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
.lang-switch button:hover { opacity: .9; }
`;
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = LANG_CSS;
  document.head.appendChild(s);
}
