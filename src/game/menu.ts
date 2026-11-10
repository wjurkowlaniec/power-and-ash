import { tr, lang } from '../i18n';

/**
 * Main menu (on the start screen) and the pause menu (Esc in a scene): start the game,
 * jump to a scene, or open one of the tech demos. Scene ids are the same as ?scene=.
 */
export interface MenuItem { id: string; title: string; sub: string }

export const CHAPTERS: MenuItem[] = [
  { id: 'darkness', title: tr('Nowa gra', 'New game'), sub: tr('od przebudzenia w ciemności', 'from waking up in the dark') },
  { id: 'hall', title: tr('Scena 1 · Hala pomiarowa', 'Scene 1 · Measurement hall'), sub: tr('Wolt na kablu diagnostycznym, bateria Q-1', 'Wolt on the diagnostic cable, the Q-1 battery') },
  { id: 'station', title: tr('Scena 2 · Martwa stacja', 'Scene 2 · Dead station'), sub: tr('warsztat, łożysko na oponie, turbina, kabel', 'workshop, bearing on the tyre, turbine, cable') },
];

const q = lang === 'en' ? '?lang=en' : '';
export const DEMOS: { href: string; title: string; sub: string }[] = [
  { href: `./demo/${q}`, title: tr('Tech demo · Rozruch', 'Tech demo · Start-up'), sub: tr('kable, złom, fabrykator, Żaglowóz', 'cables, scrap, fabricator, the land yacht') },
  { href: `./demo-craft/${q}`, title: tr('Tech demo · Warsztat', 'Tech demo · Workshop'), sub: tr('wytwarzanie, wózek, sieć, 12 etapów', 'crafting, cart, grid, 12 stages') },
  { href: `./demo-sail/${q}`, title: tr('Tech demo · Żegluga', 'Tech demo · Sailing'), sub: tr('jazda Żaglowozem, szkwały, trasy na czas', 'land yacht sailing, gusts, timed courses') },
];

const item = (attr: string, title: string, sub: string) =>
  `<${attr}><span class="mt">${title}</span><span class="ms">${sub}</span></${attr.split(' ')[0]}>`;

/** The menu's HTML. `paused` adds "back to the game" and "restart this scene". */
export function menuHtml(paused: boolean, current?: string): string {
  const top = paused
    ? item('button type="button" data-act="resume" class="mi"', tr('Wróć do gry', 'Back to the game'), 'Esc')
      + item('button type="button" data-act="restart" class="mi"', tr('Zacznij scenę od nowa', 'Restart this scene'), '')
    : '';
  const ch = CHAPTERS.map(c => item(`button type="button" data-scene="${c.id}" class="mi${c.id === current ? ' cur' : ''}"`, c.title, c.sub)).join('');
  const de = DEMOS.map(d => item(`a href="${d.href}" class="mi"`, d.title, d.sub)).join('');
  return `<div class="menu">
    <h1>${tr('Popiół i Prąd', 'Ash and Power')}</h1>
    ${top}
    <p class="lbl">${paused ? tr('Sceny', 'Scenes') : tr('Gra', 'Game')}</p>${ch}
    <p class="lbl">${tr('Tech demo (poligon mechanik)', 'Tech demos (mechanics sandbox)')}</p>${de}
    <p class="hint">${paused ? tr('<b>M</b> dźwięk · <b>Esc</b> zamknij', '<b>M</b> sound · <b>Esc</b> close') : tr('najlepiej w słuchawkach', 'best with headphones')}</p>
  </div>`;
}

export type MenuPick = { scene: string } | { act: 'resume' | 'restart' };

/** Wire clicks on a menu element; links to the demos just navigate. */
export function onMenu(root: HTMLElement, pick: (p: MenuPick) => void) {
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.scene) pick({ scene: b.dataset.scene });
    else if (b.dataset.act === 'resume' || b.dataset.act === 'restart') pick({ act: b.dataset.act });
  });
}
