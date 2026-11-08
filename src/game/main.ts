import './game.css';
import { Fx } from './fx';
import { GameSound } from './audio/sound';
import { Ctx, Scene } from './scene';
import { Darkness } from './scenes/darkness';
import { Todo } from './scenes/todo';
import { HallScene } from './scenes/hall';
import { StationScene } from './scenes/station';
import { loadModels, Models } from '../render/assets';
import { tr, lang, langSwitch } from '../i18n';

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
wakeText.innerHTML = tr('najlepiej w słuchawkach<br><b>kliknij</b>', 'best with headphones<br><b>click</b>');

const input = { keys: new Set<string>(), pressed: new Set<string>(), mouse: null as { x: number; y: number } | null };
addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  input.keys.add(e.code); input.pressed.add(e.code);
  if (e.code === 'KeyM') ctx.sound.toggleMute();
});
addEventListener('keyup', e => input.keys.delete(e.code));
addEventListener('blur', () => input.keys.clear());
addEventListener('pointermove', e => { input.mouse = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }; });

const ctx: Ctx = { fx: new Fx(document.body), sound: new GameSound(), models, app: $('app'), hud: $('hud'), input };

const scenes: Record<string, () => Scene> = {
  darkness: () => new Darkness(),
  hall: () => new HallScene(),
  station: () => new StationScene(),
  crane: () => new Todo('crane', tr('Scena 2 · Suwnica w maszynowni', 'Scene 2 · Gantry crane in the machine room')),
};
// ?scene=hall jumps straight to a scene (testing)
const startId = new URLSearchParams(location.search).get('scene') ?? 'darkness';
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

wake.addEventListener('click', () => {
  if (wake.classList.contains('loading')) return;
  wake.remove();
  ctx.sound.start();
  go(startId);
}, { once: false });

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (scene) {
    scene.update(dt, ctx);
    if (scene.next && !leaving) leaving = { to: scene.next, t: 0 };
    if (leaving) {
      leaving.t += dt;
      ctx.fx.black = Math.max(ctx.fx.black, Math.min(1, leaving.t / FADE_OUT));
      if (leaving.t >= FADE_OUT) { const to = leaving.to; leaving = null; go(to); }
    }
  }
  input.pressed.clear();
  ctx.sound.update(dt);
  ctx.fx.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
