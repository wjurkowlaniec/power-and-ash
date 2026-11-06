import './style.css';
import { Game, CABLE_WARN, REEL_HOLD, SALVAGE_TIME, CRAFT_TIME } from './sim/game';
import { level1 } from './sim/level';
import { View } from './render/view';
import { Sound } from './audio/ambient';
import { dist } from './sim/vec';

let game = new Game(level1());
let view = new View(game, document.getElementById('app')!);
const sound = new Sound();
// handy for debugging in the console
(window as unknown as { game: Game }).game = game;

// ---------- input
const keys = new Set<string>();
let interact = false;
let overlay = false;
let mouse: { x: number; y: number } | null = null;
let lmb = false;
addEventListener('pointerdown', e => { if (e.button === 0 && running) lmb = true; });
addEventListener('pointerup', e => { if (e.button === 0) lmb = false; });
addEventListener('wheel', e => { view.zoomBy(Math.exp(e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') { overlay = true; e.preventDefault(); }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interact = true;
  if (e.code === 'KeyM') sound.toggleMute();
  if (e.code === 'KeyH') { const h = $('help'); h.hidden = !h.hidden; }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') view.zoomBy(1 / 1.2);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') view.zoomBy(1.2);
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'AltLeft' || e.code === 'AltRight') overlay = false;
});
addEventListener('blur', () => { keys.clear(); overlay = false; lmb = false; });
addEventListener('pointermove', e => { mouse = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }; });

const $ = (id: string) => document.getElementById(id)!;
const startEl = $('start');
let running = false;
$('go').addEventListener('click', () => { startEl.hidden = true; running = true; sound.start(); });
$('again').addEventListener('click', () => {
  // rebuild the level from scratch
  const app = $('app'); app.innerHTML = '';
  game = new Game(level1());
  view = new View(game, app);
  (window as unknown as { game: Game }).game = game;
  $('end').hidden = true; running = true; lastToastCount = -1;
});

// ---------- HUD
const hotbar = $('hotbar');
hotbar.innerHTML = ['chwytak', 'rozbier.', 'kabel', 'kołek', 'lampa', 'extender']
  .map((s, i) => `<span class="slot ${i === 2 ? 'on' : 'off'}">${i + 1} ${s}</span>`).join('');
let lastToastCount = 0;

function hud() {
  $('clock').innerHTML = `<span>13:40</span><span class="dim">wiatr ${game.wind.arrow()} ${game.wind.strength.toFixed(0)} m/s${game.wind.gust > 0.4 ? ' · podmuch' : ''}</span>`;
  const st = game.cableState();
  const l = game.heldLength();
  const max = game.segmentMax();
  const cls = st === 'limit' ? 'limit' : st === 'tense' ? 'tense' : '';
  const reelPct = game.reelHold / REEL_HOLD;
  $('cablePanel').innerHTML = game.held
    ? `<div class="row"><span>KABEL · odcinek</span><b class="${cls}">${l.toFixed(1)} / ${max.toFixed(0)} m</b></div>
       <div class="meter"><i style="width:${Math.min(100, l / max * 100)}%;background:${st === 'none' || st === 'held' ? '' : st === 'tense' ? 'var(--warn)' : 'var(--limit)'}"></i><b style="left:${CABLE_WARN / max * 100}%"></b></div>
       <div class="dim">${st === 'limit' ? 'kabel napięty do końca, wróć albo obejdź inaczej' : st === 'tense' ? 'kabel się napina, Wolt zwalnia' : `zapas na nawijaku: ${game.reelLeft().toFixed(0)} m`}</div>
       ${reelPct > 0 ? `<div class="meter"><i style="width:${reelPct * 100}%"></i></div>` : ''}`
    : `<div class="row"><span>KABEL</span><span class="dim">zwinięty</span></div>
       <div class="dim">zapas na nawijaku: ${game.reelLeft().toFixed(0)} m</div>
       ${reelPct > 0 ? `<div class="meter"><i style="width:${reelPct * 100}%"></i></div>` : ''}`;

  const net = game.networks.get('yacht')!;
  const connected = net.nodes.length > 1;
  const np = $('netPanel');
  np.hidden = !(connected || overlay || game.battery > 0);
  if (!np.hidden) {
    np.innerHTML = `<div class="lbl">ŻAGLOWÓZ</div>
      <div class="row"><span>bateria</span><b class="${game.batteryFull() ? 'okc' : ''}">${(game.battery / 1000).toFixed(2)} / ${(game.level.yachtBattery / 1000).toFixed(1)} kWh</b></div>
      <div class="meter"><i style="width:${game.batteryPct() * 100}%;background:#6fc4e6"></i></div>
      <div class="row"><span>zasilanie</span><b class="${connected ? 'okc' : 'dim'}">${connected ? `Stacja 2, ${net.production} W` : 'brak'}</b></div>`;
  }

  $('goals').innerHTML = `<div class="t">${game.level.name.toUpperCase()}</div>` +
    game.objectives().map(o => `<div class="obj ${o.done ? 'done' : o.active ? 'active' : ''}">${o.text}</div>`).join('');
  const inv = game.inv;
  $('inv').innerHTML = `<span>miedź <b>${inv.copper}</b></span><span>plastik <b>${inv.plastic}</b></span><span>żelazo <b>${inv.iron}</b></span><span>szkło <b>${inv.glass}</b></span><span>kabel <b>${game.reelOwned} m</b></span>`;

  const h = game.hint();
  const tip = $('tip');
  if (h && running) {
    const s = view.project(h.at, h.height + 0.6);
    tip.hidden = false;
    tip.className = 'tip' + (h.ok ? '' : ' bad');
    tip.style.left = s.x + 'px'; tip.style.top = s.y + 'px';
    const prog = game.salvage ? game.salvage.t / SALVAGE_TIME : game.craftT > 0 ? 1 - game.craftT / CRAFT_TIME : 0;
    tip.innerHTML = `<span class="k">${h.key}</span>${h.text}` + (prog > 0 ? `<div class="prog"><i style="width:${prog * 100}%"></i></div>` : '');
  } else tip.hidden = true;

  if (game.toasts.length !== lastToastCount) {
    lastToastCount = game.toasts.length;
    $('toasts').innerHTML = game.toasts.map(t => `<div class="toast">${t.text}</div>`).join('');
  }
}

function showEnd() {
  running = false;
  const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
  $('endStats').textContent = `Czas: ${m}:${String(sec).padStart(2, '0')}. Rozebrany złom: ${7 - game.scrapLeft().length} z 7. Kabel: ${game.reelOwned} m. Żaglowóz z pełną baterią jedzie dalej przez popiół.`;
  $('end').hidden = false;
}

// ---------- loop
let last = performance.now();
let stepT = 0;
let lastLen = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const aim = mouse ? view.pick(mouse.x, mouse.y) : null;
  if (running) {
    const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const prev = { ...game.pos };
    game.update(dt, { move: { x: mx, y: my }, run, interact, use: keys.has('KeyE') || lmb, reel: keys.has('KeyQ'), aim: aim && dist(aim, game.pos) < 12 ? aim : null });
    interact = false;

    // sound hooks
    const moved = dist(prev, game.pos) > 1e-4;
    if (moved) { stepT -= dt; if (stepT <= 0) { sound.step(run); stepT = run ? 0.22 : 0.32; } } else stepT = 0;
    const l = game.heldLength();
    if (game.held && Math.floor(l * 2) !== Math.floor(lastLen * 2)) sound.cableTick();
    lastLen = l;
    if (game.salvage && Math.random() < dt * 9) sound.scrape();
    if (game.craftT > 0 && Math.random() < dt * 14) sound.craftTick();
    for (const e of game.events) {
      sound.play(e);
      if (e === 'win') showEnd();
    }
    game.events.length = 0;
    const st = game.cableState();
    const stPos = game.ports.find(p => p.id === 'station')!.pos;
    sound.update(dt, {
      humNear: Math.max(0.05, 1 - dist(game.pos, stPos) / 14),
      wind: game.wind.strength / 12,
      tension: st === 'limit' && moved === false && (mx || my) ? 1 : st === 'tense' ? 0.25 : 0,
    });
  }
  view.setOverlay(overlay);
  view.frame(dt, running ? aim : null);
  hud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
