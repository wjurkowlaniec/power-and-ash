import './style.css';
import { Game, CABLE_WARN, REEL_HOLD, BOOT_TIME } from './sim/game';
import { mvpLevel } from './sim/level';
import { View } from './render/view';
import { Sound } from './audio/ambient';
import { dist } from './sim/vec';

const game = new Game(mvpLevel());
const view = new View(game, document.getElementById('app')!);
const sound = new Sound();
// handy for debugging in the console
(window as unknown as { game: Game }).game = game;

// ---------- input
const keys = new Set<string>();
let interact = false;
let overlay = false;
let mouse: { x: number; y: number } | null = null;
addEventListener('keydown', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') { overlay = true; e.preventDefault(); }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interact = true;
  if (e.code === 'KeyM') sound.toggleMute();
  if (e.code === 'KeyH') { const h = $('help'); h.hidden = !h.hidden; }
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'AltLeft' || e.code === 'AltRight') overlay = false;
});
addEventListener('blur', () => { keys.clear(); overlay = false; });
addEventListener('pointermove', e => { mouse = { x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }; });

const $ = (id: string) => document.getElementById(id)!;
const startEl = $('start');
let running = false;
$('go').addEventListener('click', () => { startEl.hidden = true; running = true; sound.start(); });

// ---------- HUD
const hotbar = $('hotbar');
hotbar.innerHTML = ['chwytak', 'rozbier.', 'kabel', 'kołek', 'lampa', 'extender']
  .map((s, i) => `<span class="slot ${i === 2 ? 'on' : 'off'}">${i + 1} ${s}</span>`).join('');
let lastToastCount = 0;

function hud() {
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

  const net = game.networks.get('station')!;
  const connected = net.nodes.length > 1;
  const np = $('netPanel');
  np.hidden = !(connected || overlay);
  if (!np.hidden) {
    const n = connected ? net : game.networks.get('yacht')!;
    np.innerHTML = `<div class="lbl">SIEĆ: ${connected ? 'Żaglowóz + Stacja 2' : 'Żaglowóz'}</div>
      <div class="row"><span>produkcja</span><b>${n.production} W</b></div>
      <div class="row"><span>pobór</span><b>${n.demand} W</b></div>
      <div class="row"><span>bilans</span><b class="${n.balance >= 0 ? 'okc' : 'limit'}">${n.balance >= 0 ? '+' : ''}${n.balance} W</b></div>
      ${connected ? `<div class="${game.stationOnline() ? 'okc' : 'tense'}">przekaźnik ${game.stationOnline() ? '400 / 400 W ✓' : `rozruch ${Math.round(game.stationBoot / BOOT_TIME * 100)}%`}</div>` : '<div class="dim">Stacja 2: brak zasilania</div>'}`;
  }

  const goal = $('goal');
  const done = game.stationOnline();
  goal.className = 'goal' + (done ? ' done' : '');
  goal.textContent = done ? 'Stacja 2 zasilona ✓' : game.stationPowered() ? 'Przekaźnik się uruchamia…' : 'Cel: doprowadź prąd z żaglowozu do Stacji 2';

  const h = game.hint();
  const tip = $('tip');
  if (h && running) {
    const port = game.ports.find(p => p.pos === h.at)!;
    const s = view.project(h.at, port.height + 0.6);
    tip.hidden = false;
    tip.className = 'tip' + (h.ok ? '' : ' bad');
    tip.style.left = s.x + 'px'; tip.style.top = s.y + 'px';
    tip.innerHTML = `<span class="k">${h.key}</span>${h.text}`;
  } else tip.hidden = true;

  if (game.toasts.length !== lastToastCount) {
    lastToastCount = game.toasts.length;
    $('toasts').innerHTML = game.toasts.map(t => `<div class="toast">${t.text}</div>`).join('');
  }
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
    game.update(dt, { move: { x: mx, y: my }, run, interact, reel: keys.has('KeyQ'), aim: aim && dist(aim, game.pos) < 12 ? aim : null });
    interact = false;

    // sound hooks
    const moved = dist(prev, game.pos) > 1e-4;
    if (moved) { stepT -= dt; if (stepT <= 0) { sound.step(run); stepT = run ? 0.22 : 0.32; } } else stepT = 0;
    const l = game.heldLength();
    if (game.held && Math.floor(l * 2) !== Math.floor(lastLen * 2)) sound.cableTick();
    lastLen = l;
    for (const e of game.events) sound[e]();
    game.events.length = 0;
    const st = game.cableState();
    const stPos = game.ports.find(p => p.id === 'station')!.pos;
    sound.update(dt, {
      humNear: game.stationOnline() ? Math.max(0.15, 1 - dist(game.pos, stPos) / 18) : 0,
      tension: st === 'limit' && moved === false && (mx || my) ? 1 : st === 'tense' ? 0.25 : 0,
    });
  }
  view.setOverlay(overlay);
  view.frame(dt, running ? aim : null);
  hud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
