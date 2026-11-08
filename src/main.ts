import './style.css';
import { Game, CABLE_WARN, REEL_HOLD, CRAFT_TIME, WOLT_BATTERY, LOW_ENERGY, Target, Action, DRAIN, CABLE_RECIPE, CABLE_PER_CRAFT, CHARGE_SPEED, PORT_CHARGE } from './sim/game';
import { LOADS } from './sim/tow';
import type { Material } from './sim/world';
import { level1 } from './sim/level';
import { View } from './render/view';
import { Sound } from './audio/ambient';
import { dist } from './sim/vec';
import { loadModels, Models } from './render/assets';

const goBtn = document.getElementById('go') as HTMLButtonElement;
goBtn.disabled = true;
goBtn.textContent = 'Ładowanie modeli…';
let models: Models = new Map();
try {
  models = await loadModels((d, t) => { goBtn.textContent = `Ładowanie modeli… ${d}/${t}`; });
} catch (e) {
  console.warn('models failed, using simple shapes', e);
}
goBtn.disabled = false;
goBtn.textContent = 'Zacznij (z dźwiękiem)';
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
    case 'ground': return 'teren';
    case 'self': return 'Wolt';
    case 'scrap': return t.o.kind === 'barrel' ? 'beczka' : 'złom';
    case 'port': return game.ports.find(p => p.id === t.id)!.name;
    case 'point': return game.points.find(p => p.id === t.id)!.name;
    case 'load': return game.loads.find(l => l.id === t.id)!.kind === 'tyre' ? 'opona' : 'sanki z cegłami';
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
hotbar.innerHTML = ['chwytak', 'rozbier.', 'kabel', 'kołek', 'lampa', 'extender']
  .map((s, i) => `<span class="slot ${i === 2 ? 'on' : 'off'}" id="slot${i}">${i + 1} ${s}</span>`).join('');
let lastToastCount = 0;

const MAT: Record<Material, string> = { iron: 'żelazo', copper: 'miedź', plastic: 'plastik', glass: 'szkło' };
const MAT_USE: Record<Material, string> = {
  copper: 'na kabel (fabrykator)', plastic: 'na izolację kabla (fabrykator)',
  iron: 'na kołki i naprawy (później)', glass: 'na lampy (później)',
};
function clock(s: number): string {
  if (s < 60) return `${Math.max(1, Math.round(s))} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const n2 = (x: number, d = 1) => x.toFixed(d).replace('.', ',');
/** The mouse-over card: what the thing is and what Wolt gets out of it. */
function infoCard(t: Target): string {
  switch (t.kind) {
    case 'scrap': {
      const o = t.o;
      const time = game.salvageTime(o);
      const loot = Object.entries(o.loot ?? {}) as [Material, number][];
      return `<div class="h">${(o.name ?? targetName(t)).toUpperCase()}</div>` +
        (o.desc ? `<div class="dim">${o.desc}</div>` : '') +
        `<div class="sub">po rozebraniu</div>` +
        loot.map(([k, n]) => `<div class="row"><span><b class="okc">+${n}</b> ${MAT[k]}</span><span class="dim">${MAT_USE[k]}</span></div>`).join('') +
        `<div class="row cost"><span>czas ${n2(time)} s</span><span>bateria Wolta −${n2(time * DRAIN.salvage)} Wh</span></div>`;
    }
    case 'port': {
      const p = game.ports.find(x => x.id === t.id)!;
      const plugged = game.cables.some(c => c.from === p.id || c.to === p.id);
      const live = game.portLive(p.id);
      const what = p.id === 'station'
        ? `stare panele słoneczne, dają ${game.level.stationOutput} W`
        : game.batteryFull() ? 'bateria żaglowozu pełna' : `wejście baterii żaglowozu, przyjmie do ${game.level.stationOutput} W`;
      return `<div class="h">${p.name.toUpperCase()}</div><div class="dim">${what}</div>` +
        `<div class="row"><span>kabel</span><b class="${plugged ? 'okc' : 'dim'}">${plugged ? 'wpięty' : 'brak'}</b></div>` +
        (live ? `<div class="row"><span>Wolt na postoju obok</span><b class="okc">+${n2(PORT_CHARGE, 1)} Wh/s</b></div>` : '');
    }
    case 'load': {
      const l = game.loads.find(x => x.id === t.id)!;
      const sp = LOADS[l.kind];
      return `<div class="h">${targetName(t).toUpperCase()}</div><div class="dim">ładunek do ciągnięcia na haku</div>` +
        `<div class="row"><span>spowalnia</span><b>${Math.round(sp.drag * 100)}%</b></div>` +
        `<div class="row cost"><span>w ruchu</span><span>bateria Wolta −${n2(sp.drain, 2)} Wh/s</span></div>`;
    }
    case 'point': {
      if (t.id === 'fabricator') {
        const can = Math.min(Math.floor(game.inv.copper / CABLE_RECIPE.copper), Math.floor(game.inv.plastic / CABLE_RECIPE.plastic));
        return `<div class="h">FABRYKATOR</div><div class="dim">${CABLE_RECIPE.copper} miedź + ${CABLE_RECIPE.plastic} plastik → ${CABLE_PER_CRAFT} m kabla, ${n2(CRAFT_TIME)} s</div>` +
          `<div class="row"><span>z zapasu wyjdzie</span><b class="${can ? 'okc' : 'dim'}">${can * CABLE_PER_CRAFT} m</b></div>`;
      }
      return `<div class="h">STER</div><div class="dim">${game.batteryFull() ? 'bateria pełna, można ruszać' : 'odjazd dopiero z pełną baterią'}</div>`;
    }
    case 'self': return `<div class="h">WOLT</div><div class="dim">bateria ${Math.round(game.energy)}/${WOLT_BATTERY} Wh, bilans ${game.energyRate >= 0 ? '+' : '−'}${n2(Math.abs(game.energyRate), 2)} Wh/s</div>`;
    default: return '';
  }
}

let hoverKey = '';
function hud() {
  // Wolt's battery
  const ep = game.energyPct();
  const en = $('en');
  en.style.width = ep * 100 + '%';
  en.className = game.energy < LOW_ENERGY ? 'low' : '';
  $('enNum').textContent = `${Math.round(game.energy)}/${WOLT_BATTERY} Wh`;
  const r = game.energyRate;
  const fmt = (x: number, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d).replace('.', ',');
  const eta = r > 0.01 ? (WOLT_BATTERY - game.energy) / r : r < -0.01 ? game.energy / -r : Infinity;
  const etaTxt = !isFinite(eta) ? '' : r > 0 ? (game.energy >= WOLT_BATTERY - 0.1 ? 'pełna' : `pełna za ${clock(eta)}`) : `pusta za ${clock(eta)}`;
  $('enRate').innerHTML = `<div class="flows">` +
    game.flows.map(f => `<div class="row"><span>${f.label}</span><b class="${f.rate > 0 ? 'okc' : ''}">${fmt(f.rate)}</b></div>`).join('') +
    `<div class="row sum"><span>bilans</span><b class="${r >= 0 ? 'okc' : r < -0.9 ? 'tense' : ''}">${fmt(r)} Wh/s</b></div>` +
    `<div class="row"><span class="dim">${etaTxt}</span><span class="dim">${game.light ? '' : 'światło wył. '}(L)</span></div></div>`;
  $('slot4').className = 'slot ' + (game.light ? 'on' : 'off');

  // what's under the cursor
  const hv = $('hover');
  const ht = running && mouse && ctx().hidden ? view.pickTarget(mouse.x, mouse.y) : null;
  if (ht && ht.kind !== 'ground' && mouseScreen) {
    const acts = game.actionsFor(ht);
    const key = targetName(ht) + acts.map(a => a.label + a.ok).join() + (ht.kind === 'scrap' ? ht.o.x + ',' + ht.o.y : '') + (ht.kind === 'self' ? Math.round(game.energy * 4) + n2(game.energyRate, 2) : '') + game.cables.length + ':' + game.inv.copper + ':' + game.inv.plastic + game.batteryFull();
    if (key !== hoverKey) {
      hoverKey = key;
      const act = acts.length
        ? `<div class="act"><span class="k">LPM</span>${acts[0].label}${acts[0].ok ? '' : ` <span class="limit">(${acts[0].why ?? 'niedostępne'})</span>`}${acts.length > 1 ? ` · <span class="k">PPM</span>więcej` : ''}</div>`
        : '';
      hv.innerHTML = infoCard(ht) + act;
    }
    hv.hidden = false;
    // keep the card on screen: flip to the other side of the cursor near the edges
    const w = hv.offsetWidth + 20, hh = hv.offsetHeight + 14;
    hv.style.left = (mouseScreen.x + w > innerWidth - 8 ? mouseScreen.x - w - 12 : mouseScreen.x) + 'px';
    hv.style.top = (mouseScreen.y + hh > innerHeight - 8 ? mouseScreen.y - hh - 6 : mouseScreen.y) + 'px';
    document.body.style.cursor = 'pointer';
  } else { hv.hidden = true; hoverKey = ''; document.body.style.cursor = ''; }

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
    const out = game.level.stationOutput;
    const charging = connected && !game.batteryFull();
    const take = charging ? out : 0;
    const left = (game.level.yachtBattery - game.battery) / (out * CHARGE_SPEED);
    np.innerHTML = `<div class="lbl">ŻAGLOWÓZ · SIEĆ</div>
      <div class="row"><span>bateria</span><b class="${game.batteryFull() ? 'okc' : ''}">${(game.battery / 1000).toFixed(2)} / ${(game.level.yachtBattery / 1000).toFixed(1)} kWh</b></div>
      <div class="meter"><i style="width:${game.batteryPct() * 100}%;background:#6fc4e6"></i></div>
      <div class="sub">źródła</div>
      <div class="row"><span>panele Stacji 2</span><b class="${connected ? 'okc' : 'dim'}">${connected ? `+${out} W` : `${out} W, bez kabla`}</b></div>
      <div class="sub">odbiorniki</div>
      <div class="row"><span>ładowanie baterii</span><b>${charging ? `−${take} W` : game.batteryFull() ? 'pełna' : '0 W'}</b></div>
      <div class="row"><span>napęd, ster</span><b class="dim">wył.</b></div>
      <div class="row sum"><span>bilans</span><b class="${connected ? 'okc' : 'dim'}">${connected ? `${out - take >= 0 ? '+' : '−'}${Math.abs(out - take)} W` : 'brak zasilania'}</b></div>
      ${charging ? `<div class="dim">pełna za ok. ${clock(left)}</div>` : !connected ? `<div class="dim">połącz port Stacji 2 z portem żaglowozu</div>` : ''}`;
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
  $('endStats').textContent = `Czas: ${m}:${String(sec).padStart(2, '0')}. Rozebrany złom: ${total - game.scrapLeft().length} z ${total}. Kabel: ${game.reelOwned} m. Żaglowóz z pełną baterią jedzie dalej przez popiół.`;
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
