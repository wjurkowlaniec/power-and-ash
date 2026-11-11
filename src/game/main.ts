import './game.css';
import { Fx } from './fx';
import { GameSound } from './audio/sound';
import { Ctx, Input, Scene } from './scene';
import { Darkness } from './scenes/darkness';
import { Todo } from './scenes/todo';
import { HallScene } from './scenes/hall';
import { StationScene } from './scenes/station';
import { loadModels, Models } from '../render/assets';
import { tr, lang, langSwitch } from '../i18n';
import { menuHtml, onMenu } from './menu';

/**
 * The game: the story from docs/POCZATEK.md, scene by scene. The tech demo (level
 * "Rozruch") lives in demo/ and shares src/sim, src/render and src/audio with it.
 */
const $ = (id: string) => document.getElementById(id)!;
const wake = $('wake'), wakeText = $('wakeText');
if (lang === 'en') { document.title = 'Ash and Power'; $('skip').textContent = 'hold space to skip'; }
// PL / EN switch on the click-to-start screen (switching reloads the page)
const sw = langSwitch(); sw.classList.add('wake-lang'); wake.appendChild(sw);

let models: Models = new Map();
try {
  models = await loadModels((d, t) => { wakeText.textContent = `${d} / ${t}`; });
} catch (e) {
  console.warn('models failed, using simple shapes', e);
}
wake.classList.remove('loading');
// ?scene=hall jumps straight to a scene (testing links): one click starts it.
// Without it the start screen is the main menu: new game, a scene, or a tech demo.
const jump = new URLSearchParams(location.search).get('scene');
if (jump) wakeText.innerHTML = tr('najlepiej w słuchawkach<br><b>kliknij</b>', 'best with headphones<br><b>click</b>');
else {
  wakeText.remove();
  wake.classList.add('main-menu');
  const m = document.createElement('div');
  m.innerHTML = menuHtml(false);
  wake.appendChild(m);
  onMenu(m, p => { if ('scene' in p) start(p.scene); });
}

const input: Input = { keys: new Set<string>(), pressed: new Set<string>(), mouse: null, click: null, lmb: false, cursor: null };
addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  input.keys.add(e.code); input.pressed.add(e.code);
  if (e.code === 'KeyM') ctx.sound.toggleMute();
});
addEventListener('keyup', e => input.keys.delete(e.code));
addEventListener('blur', () => { input.keys.clear(); input.lmb = false; });
addEventListener('pointermove', e => {
  input.mouse = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 };
  input.cursor = { x: e.clientX, y: e.clientY };
});
// point-and-click: only clicks on the 3D view (HUD panels, notes and menus keep theirs)
addEventListener('pointerdown', e => {
  if (e.button !== 0 || (e.target as HTMLElement).tagName !== 'CANVAS' || wake.isConnected || !pause.hidden) return;
  input.click = { x: e.clientX, y: e.clientY }; input.cursor = { ...input.click }; input.lmb = true;
});
addEventListener('pointerup', e => { if (e.button === 0) input.lmb = false; });

const ctx: Ctx = { fx: new Fx(document.body), sound: new GameSound(), models, app: $('app'), hud: $('hud'), input };

const scenes: Record<string, () => Scene> = {
  darkness: () => new Darkness(),
  hall: () => new HallScene(),
  station: () => new StationScene(),
  odjazd: () => new Todo('odjazd', tr('Scena 4 · Odjazd: droga do podstacji R-2', 'Scene 4 · Departure: the road to substation R-2')),
};
let scene: Scene | null = null;
/** Leaving a scene: it keeps running under a short fade to black, so cuts never jump. */
let leaving: { to: string; t: number } | null = null;
const FADE_OUT = 0.8;

function go(id: string) {
  scene?.exit?.(ctx);
  scene = (scenes[id] ?? scenes.darkness)();
  scene.enter(ctx);
  $('skip').hidden = scene.id !== 'darkness';
}

function start(id: string) {
  wake.remove();
  ctx.sound.start();
  go(id);
}
wake.addEventListener('click', () => {
  if (wake.classList.contains('loading') || !jump) return;
  start(jump);
});

/** Pause menu on Esc (unless a note or the archive is open: Esc closes those first). */
const pause = document.createElement('div');
pause.id = 'pause'; pause.hidden = true;
document.body.appendChild(pause);
onMenu(pause, p => {
  setPaused(false);
  if ('scene' in p) { leaving = null; go(p.scene); }
  else if (p.act === 'restart' && scene) { leaving = null; go(scene.id); }
});
function setPaused(on: boolean) {
  pause.hidden = !on;
  if (on) {
    pause.innerHTML = menuHtml(true, scene?.id);
    pause.querySelector<HTMLElement>('button')?.focus();
  }
  input.keys.clear(); input.lmb = false;
}
addEventListener('keydown', e => {
  if (e.code !== 'Escape' || e.repeat || !scene || wake.isConnected) return;
  if (!pause.hidden) { setPaused(false); return; }
  if (scene.modal?.() || leaving) return;
  setPaused(true);
});

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (scene && pause.hidden) {
    scene.update(dt, ctx);
    if (scene.next && !leaving) leaving = { to: scene.next, t: 0 };
    if (leaving) {
      leaving.t += dt;
      ctx.fx.black = Math.max(ctx.fx.black, Math.min(1, leaving.t / FADE_OUT));
      if (leaving.t >= FADE_OUT) { const to = leaving.to; leaving = null; go(to); }
    }
  }
  input.pressed.clear(); input.click = null;
  ctx.sound.update(dt);
  ctx.fx.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
