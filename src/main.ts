import './style.css';
import { Game, CABLE_WARN, REEL_HOLD, CRAFT_TIME, WOLT_BATTERY, LOW_ENERGY, Target, Action } from './sim/game';
import { level1 } from './sim/level';
import { View } from './render/view';
import { Sound } from './audio/ambient';
import { dist } from './sim/vec';
import { loadModels, Models } from './render/assets';
import { tr, lang, langSwitch } from './i18n';
import { localizeDemoPage } from './demoText';

localizeDemoPage();

const goBtn = document.getElementById('go') as HTMLButtonElement;
goBtn.disabled = true;
goBtn.textContent = tr('Ładowanie modeli…', 'Loading models…');
let models: Models = new Map();
try {
  models = await loadModels((d, t) => { goBtn.textContent = tr(`Ładowanie modeli… ${d}/${t}`, `Loading models… ${d}/${t}`); });
} catch (e) {
  console.warn('models failed, using simple shapes', e);
}
goBtn.disabled = false;
goBtn.textContent = tr('Zacznij (z dźwiękiem)', 'Start (with sound)');
let game = new Game(level1());
let view = new View(game, document.getElementById('app')!, models);
const sound = new Sound();
// handy for debugging in the console
(window as unknown as { game: Game }).game = game;
(window as unknown as { view: View }).view = view;

// ---------- input
const keys = new Set<string>();
let interact = false;
let overlay = false;
let mouse: { x: number; y: number } | null = null;
let lmb = false;
let dragging = false;
let dragT = 0;
const ndc = (e: { clientX: number; clientY: number }) => ({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 });
const onCanvas = (e: Event) => (e.target as HTMLElement).tagName === 'CANVAS';

// ---------- mouse: click/hold the ground to walk, click a thing to use it, right click = all actions
const ctx = () => $('ctx');
function closeMenu() { ctx().hidden = true; }
function openMenu(x: number, y: number, t: Target, acts: Action[]) {
  const m = ctx();
  m.innerHTML = `<div class="h">${targetName(t).toUpperCase()}</div>` + acts.map((a, i) =>
    `<button type="button" data-i="${i}" ${a.ok ? '' : 'disabled'}><span>${a.label}</span>${a.ok ? '' : `<small>${a.why ?? ''}</small>`}</button>`).join('');
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - 220) + 'px';
  m.style.top = Math.min(y, innerHeight - 40 - acts.length * 32) + 'px';
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    const a = acts[Number(b.dataset.i)];
    if (a.ok) game.command(t, a.id);
    closeMenu();
  }));
  (m.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
function targetName(t: Target): string {
  switch (t.kind) {
    case 'ground': return tr('teren', 'ground');
    case 'self': return 'Wolt';
    case 'scrap': return t.o.kind === 'barrel' ? tr('beczka', 'barrel') : tr('złom', 'scrap');
    case 'port': return game.ports.find(p => p.id === t.id)!.name;
    case 'point': return game.points.find(p => p.id === t.id)!.name;
    case 'load': return game.loads.find(l => l.id === t.id)!.kind === 'tyre' ? tr('opona', 'tyre') : tr('sanki z cegłami', 'brick sled');
  }
}
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', e => {
  if (!running || !onCanvas(e)) return;
  closeMenu();
  const t = view.pickTarget(ndc(e).x, ndc(e).y);
  if (!t) return;
  const acts = game.actionsFor(t);
  if (e.button === 0) {
    lmb = true;
    if (t.kind === 'ground') { game.command(t, 'walk'); dragging = true; dragT = 0; return; }
    if (acts.length > 1) openMenu(e.clientX, e.clientY, t, acts);
    else if (acts.length === 1) game.command(t, acts[0].id);
  } else if (e.button === 2 && t.kind !== 'ground' && acts.length) openMenu(e.clientX, e.clientY, t, acts);
});
addEventListener('pointerup', e => { if (e.button === 0) { lmb = false; dragging = false; } });
addEventListener('wheel', e => { view.zoomBy(Math.exp(e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') { overlay = true; e.preventDefault(); }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interact = true;
  if (e.code === 'KeyM') sound.toggleMute();
  if (e.code === 'KeyL' && running) game.toggleLight();
  if (e.code === 'Escape') closeMenu();
  if (e.code === 'KeyH') { const h = $('help'); h.hidden = !h.hidden; }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') view.zoomBy(1 / 1.2);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') view.zoomBy(1.2);
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'AltLeft' || e.code === 'AltRight') overlay = false;
});
addEventListener('blur', () => { keys.clear(); overlay = false; lmb = false; dragging = false; });
let mouseScreen: { x: number; y: number } | null = null;
addEventListener('pointermove', e => { mouse = ndc(e); mouseScreen = { x: e.clientX, y: e.clientY }; });

const $ = (id: string) => document.getElementById(id)!;
const startEl = $('start');
startEl.querySelector('.card')!.appendChild(langSwitch());
$('end').querySelector('.card')!.appendChild(langSwitch());
let running = false;
$('go').addEventListener('click', () => { startEl.hidden = true; running = true; sound.start(); });
$('again').addEventListener('click', () => {
  // rebuild the level from scratch
  const app = $('app'); app.innerHTML = '';
  game = new Game(level1());
  view = new View(game, app, models);
  (window as unknown as { game: Game }).game = game;
  (window as unknown as { view: View }).view = view;
  $('end').hidden = true; running = true; lastToastCount = -1;
});

// ---------- HUD
const hotbar = $('hotbar');
hotbar.innerHTML = (lang === 'en' ? ['gripper', 'salvage', 'cable', 'stake', 'lamp', 'extender'] : ['chwytak', 'rozbier.', 'kabel', 'kołek', 'lampa', 'extender'])
  .map((s, i) => `<span class="slot ${i === 2 ? 'on' : 'off'}" id="slot${i}">${i + 1} ${s}</span>`).join('');
let lastToastCount = 0;

let hoverKey = '';
function hud() {
  // Wolt's battery
  const ep = game.energyPct();
  const en = $('en');
  en.style.width = ep * 100 + '%';
  en.className = game.energy < LOW_ENERGY ? 'low' : '';
  $('enNum').textContent = `${Math.round(game.energy)}/${WOLT_BATTERY} Wh`;
  const r = game.energyRate;
  const why = game.energySource === 'port' ? tr('ładowanie z portu', 'charging from the port') : game.energySource === 'rest' ? tr('postój, ładuje się', 'resting, recharging') : game.salvage ? tr('rozbieranie', 'salvaging') : game.moving ? (keys.has('ShiftLeft') || keys.has('ShiftRight') ? tr('bieg', 'running') : tr('marsz', 'walking')) : tr('czuwanie', 'idle');
  $('enRate').innerHTML = `<span class="${r >= 0 ? 'okc' : r < -0.9 ? 'tense' : ''}">${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)} Wh/s</span> · ${why}<br>${tr('światło', 'light')}: ${game.light ? tr('wł.', 'on') : tr('wył.', 'off')} <span class="dim">(L)</span>`;
  $('slot4').className = 'slot ' + (game.light ? 'on' : 'off');

  // what's under the cursor
  const hv = $('hover');
  const ht = running && mouse && ctx().hidden ? view.pickTarget(mouse.x, mouse.y) : null;
  if (ht && ht.kind !== 'ground' && mouseScreen) {
    const acts = game.actionsFor(ht);
    const key = targetName(ht) + acts.map(a => a.label + a.ok).join();
    if (key !== hoverKey) {
      hoverKey = key;
      hv.innerHTML = acts.length
        ? `<span class="k">${tr('LPM', 'LMB')}</span>${acts[0].label}${acts[0].ok ? '' : ` <span class="limit">(${acts[0].why ?? tr('niedostępne', 'unavailable')})</span>`}${acts.length > 1 ? ` · <span class="k">${tr('PPM', 'RMB')}</span>${tr('więcej', 'more')}` : ''}`
        : targetName(ht);
    }
    hv.hidden = false;
    hv.style.left = mouseScreen.x + 'px'; hv.style.top = mouseScreen.y + 'px';
    document.body.style.cursor = 'pointer';
  } else { hv.hidden = true; hoverKey = ''; document.body.style.cursor = ''; }

  $('clock').innerHTML = `<span>13:40</span><span class="dim">${tr('wiatr', 'wind')} ${game.wind.arrow()} ${game.wind.strength.toFixed(0)} m/s${game.wind.gust > 0.4 ? tr(' · podmuch', ' · gust') : ''}</span>`;
  const st = game.cableState();
  const l = game.heldLength();
  const max = game.segmentMax();
  const cls = st === 'limit' ? 'limit' : st === 'tense' ? 'tense' : '';
  const reelPct = game.reelHold / REEL_HOLD;
  $('cablePanel').innerHTML = game.held
    ? `<div class="row"><span>${tr('KABEL · odcinek', 'CABLE · segment')}</span><b class="${cls}">${l.toFixed(1)} / ${max.toFixed(0)} m</b></div>
       <div class="meter"><i style="width:${Math.min(100, l / max * 100)}%;background:${st === 'none' || st === 'held' ? '' : st === 'tense' ? 'var(--warn)' : 'var(--limit)'}"></i><b style="left:${CABLE_WARN / max * 100}%"></b></div>
       <div class="dim">${st === 'limit' ? tr('kabel napięty do końca, wróć albo obejdź inaczej', 'cable fully taut, go back or take another way round') : st === 'tense' ? tr('kabel się napina, Wolt zwalnia', 'the cable is getting taut, Wolt slows down') : `${tr('zapas na nawijaku', 'left on the reel')}: ${game.reelLeft().toFixed(0)} m`}</div>
       ${reelPct > 0 ? `<div class="meter"><i style="width:${reelPct * 100}%"></i></div>` : ''}`
    : `<div class="row"><span>${tr('KABEL', 'CABLE')}</span><span class="dim">${tr('zwinięty', 'reeled in')}</span></div>
       <div class="dim">${tr('zapas na nawijaku', 'left on the reel')}: ${game.reelLeft().toFixed(0)} m</div>
       ${reelPct > 0 ? `<div class="meter"><i style="width:${reelPct * 100}%"></i></div>` : ''}`;

  const net = game.networks.get('yacht')!;
  const connected = net.nodes.length > 1;
  const np = $('netPanel');
  np.hidden = !(connected || overlay || game.battery > 0);
  if (!np.hidden) {
    np.innerHTML = `<div class="lbl">${tr('ŻAGLOWÓZ', 'LAND YACHT')}</div>
      <div class="row"><span>${tr('bateria', 'battery')}</span><b class="${game.batteryFull() ? 'okc' : ''}">${(game.battery / 1000).toFixed(2)} / ${(game.level.yachtBattery / 1000).toFixed(1)} kWh</b></div>
      <div class="meter"><i style="width:${game.batteryPct() * 100}%;background:#6fc4e6"></i></div>
      <div class="row"><span>${tr('zasilanie', 'power')}</span><b class="${connected ? 'okc' : 'dim'}">${connected ? `${tr('Stacja 2', 'Station 2')}, ${net.production} W` : tr('brak', 'none')}</b></div>`;
  }

  $('goals').innerHTML = `<div class="t">${game.level.name.toUpperCase()}</div>` +
    game.objectives().map(o => `<div class="obj ${o.done ? 'done' : o.active ? 'active' : ''}">${o.text}</div>`).join('');
  const inv = game.inv;
  $('inv').innerHTML = `<span>${tr('miedź', 'copper')} <b>${inv.copper}</b></span><span>${tr('plastik', 'plastic')} <b>${inv.plastic}</b></span><span>${tr('żelazo', 'iron')} <b>${inv.iron}</b></span><span>${tr('szkło', 'glass')} <b>${inv.glass}</b></span><span>${tr('kabel', 'cable')} <b>${game.reelOwned} m</b></span>`;

  const h = game.hint();
  const tip = $('tip');
  if (h && running) {
    const s = view.project(h.at, h.height + 0.6);
    tip.hidden = false;
    tip.className = 'tip' + (h.ok ? '' : ' bad');
    tip.style.left = s.x + 'px'; tip.style.top = s.y + 'px';
    const prog = game.salvage ? game.salvage.t / game.salvageTime(game.salvage.target) : game.craftT > 0 ? 1 - game.craftT / CRAFT_TIME : 0;
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
  const total = game.level.obstacles.filter(o => o.loot).length;
  $('endStats').textContent = tr(
    `Czas: ${m}:${String(sec).padStart(2, '0')}. Rozebrany złom: ${total - game.scrapLeft().length} z ${total}. Kabel: ${game.reelOwned} m. Żaglowóz z pełną baterią jedzie dalej przez popiół.`,
    `Time: ${m}:${String(sec).padStart(2, '0')}. Scrap salvaged: ${total - game.scrapLeft().length} of ${total}. Cable: ${game.reelOwned} m. The land yacht rolls on through the ash on a full battery.`);
  $('end').hidden = false;
}

// ---------- loop
let last = performance.now();
let stepT = 0;
let prevFacing = 0;
let lastLen = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const aim = mouse ? view.pick(mouse.x, mouse.y) : null;
  if (running) {
    const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    // holding the button on the ground: Wolt follows the cursor
    if (dragging && lmb && mouse) {
      dragT -= dt;
      const at = view.pick(mouse.x, mouse.y);
      if (at && dragT <= 0) { game.command({ kind: 'ground', at }, 'walk'); dragT = 0.15; }
    }
    const prev = { ...game.pos };
    game.update(dt, { move: { x: mx, y: my }, run, interact, use: keys.has('KeyE'), reel: keys.has('KeyQ'), aim: aim && dist(aim, game.pos) < 12 ? aim : null });
    interact = false;

    // sound hooks
    const moved = dist(prev, game.pos) > 1e-4;
    // the wheel squeaks about once per half turn (≈1 m), not like a clock; more on sharp turns
    const rolled = dist(prev, game.pos);
    let turn = game.facing - prevFacing; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); prevFacing = game.facing;
    const load = game.tow ? 0.6 : game.cableState() === 'limit' ? 1 : game.cableState() === 'tense' ? 0.4 : 0;
    if (moved) {
      stepT -= rolled + Math.abs(turn) * 0.6;
      if (stepT <= 0) { if (Math.random() < 0.75) sound.squeak(run, load); stepT = 0.8 + Math.random() * 0.6; }
    } else if (game.strain && Math.random() < dt * 3) sound.squeak(false, 1); // spinning in place

    const l = game.heldLength();
    if (game.held && Math.floor(l * 2) !== Math.floor(lastLen * 2)) sound.cableTick();
    lastLen = l;
    if (game.salvage && Math.random() < dt * 9) sound.scrape();
    if (game.tow && moved && game.towTaut && Math.random() < dt * 4) sound.scrape(); // the load scrapes over the ash
    if (game.craftT > 0 && Math.random() < dt * 14) sound.craftTick();
    for (const e of game.events) {
      sound.play(e === 'hook' ? 'plug' : e === 'unhook' ? 'unplug' : e);
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
