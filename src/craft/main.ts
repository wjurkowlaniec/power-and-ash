import '../style.css';
import './craft.css';
import { tr, num, langSwitch } from '../i18n';
import { loadModels, Models } from '../render/assets';
import { Sound } from '../audio/ambient';
import { dist } from '../sim/vec';
import { Target, Action, BATTERY, COMPUTE_MIN, CART_REACH, AUTO_TRIM } from './sim/craftGame';
import { SAIL } from './sim/sailing';
import { Inventory } from './sim/inventory';
import { STAGES, yardAtStage, stageDone } from './sim/stages';
import { ITEMS, ItemId, RECIPES, Recipe, TECHS, TechId, OBS, ObsId, SCRAP, BUILD, BuildingId, ModuleId, CONTACTS, POWER } from './data';
import { CraftView } from './render/craftView';
import { loadCraftModels } from './render/craftModels';
import { renderIcons } from './render/icons';
import { mountTouch, showTouch } from '../touch';

/**
 * The crafting tech demo ("Warsztat"): input, the HUD panels and the loop.
 * Logic lives in sim/, 3D in render/. Open with ?stage=N to jump to a stage.
 */
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

$('startSub').textContent = tr('Tech demo · Warsztat: wytwarzanie i rozwój', 'Tech demo · Workshop: crafting and progress');
$('startText').innerHTML = tr(
  `<p>Wolt w zrujnowanym warsztacie. Ekwipunek jest malutki (6 miejsc), dopóki nie naprawisz wózka. Rozbieraj złom, rób narzędzia, kable, rozgałęźniki, maszyny i panel słoneczny. Q-1 uczy się z tego, co rozbierasz, i liczy nowe technologie na nadwyżce prądu. Ulepszaj samego Wolta modułami, aż postawisz maszt i złapiesz sygnał. Na końcu zbuduj z wózka Żaglowóz i wyjedź na wietrze w popielną równinę.</p>
   <p>Etapy po lewej przeprowadzają przez wszystko po kolei. Każdy można też otworzyć od razu.</p>
   <p class="keys"><b>LPM</b> jedź / użyj &nbsp; <b>PPM</b> menu &nbsp; <b>WASD</b> ruch &nbsp; <b>E</b> rozbieraj &nbsp; <b>C</b> wytwarzanie &nbsp; <b>T</b> technologie &nbsp; <b>U</b> Wolt &nbsp; <b>N</b> sieć &nbsp; <b>R</b> radio &nbsp; <b>I</b> wózek</p>`,
  `<p>Wolt in a ruined workshop. The inventory is tiny (6 slots) until you fix the cart. Take scrap apart, make tools, cables, splitters, machines and a solar panel. Q-1 learns from what you salvage and computes new technologies on surplus power. Upgrade Wolt himself with modules, until you raise a mast and catch a signal. Last, turn the cart into a land yacht and sail out onto the ash plain.</p>
   <p>The stages on the left walk through everything in order. Any of them can also be opened directly.</p>
   <p class="keys"><b>LMB</b> drive / use &nbsp; <b>RMB</b> menu &nbsp; <b>WASD</b> move &nbsp; <b>E</b> salvage &nbsp; <b>C</b> crafting &nbsp; <b>T</b> technologies &nbsp; <b>U</b> Wolt &nbsp; <b>N</b> grid &nbsp; <b>R</b> radio &nbsp; <b>I</b> cart</p>`);
$('startSmall').textContent = tr('prototyp · logika w czystym TS, render Three.js · modele CC0: Kay Lousberg, Quaternius', 'prototype · logic in plain TS, Three.js rendering · CC0 models: Kay Lousberg, Quaternius');
$('help').innerHTML = tr('<b>LPM</b> jedź / użyj · <b>PPM</b> menu · <b>WASD</b> · <b>E</b> rozbieraj · <b>C T U N R</b> panele · <b>L</b> światło · <b>Alt</b> prąd · <b>Esc</b> anuluj · <b>H</b> pomoc<br>Żaglowóz: <b>A/D</b> ster · <b>W/S</b> szot · <b>Spacja</b> hamulec · <b>F</b> Q-1 trymuje · <b>E</b> zejdź',
  '<b>LMB</b> drive / use · <b>RMB</b> menu · <b>WASD</b> · <b>E</b> salvage · <b>C T U N R</b> panels · <b>L</b> light · <b>Alt</b> power · <b>Esc</b> cancel · <b>H</b> help<br>Land yacht: <b>A/D</b> steer · <b>W/S</b> sheet · <b>Space</b> brake · <b>F</b> Q-1 trims · <b>E</b> step off');
$('start').querySelector('.card')!.appendChild(langSwitch());

const goBtn = $('go') as HTMLButtonElement;
goBtn.disabled = true;
goBtn.textContent = tr('Ładowanie modeli…', 'Loading models…');
let models: Models = new Map();
try {
  models = await loadModels((d, t) => { goBtn.textContent = tr(`Ładowanie modeli… ${d}/${t}`, `Loading models… ${d}/${t}`); });
  await loadCraftModels(models, (d, t) => { goBtn.textContent = tr(`Ładowanie warsztatu… ${d}/${t}`, `Loading the workshop… ${d}/${t}`); });
} catch (e) { console.warn('models failed', e); }
const ICON = renderIcons(models);
goBtn.disabled = false;
goBtn.textContent = tr('Zacznij (z dźwiękiem)', 'Start (with sound)');

const q = new URLSearchParams(location.search);
let game = yardAtStage(Math.max(0, Math.min(STAGES.length - 1, Number(q.get('stage') ?? 0) || 0)));
let view = new CraftView(game, $('app'), models);
view.setIcons(ICON);
const sound = new Sound();
const expose = () => Object.assign(window as unknown as Record<string, unknown>, { game, view });
expose();

function openStage(i: number) {
  i = Math.max(0, Math.min(STAGES.length - 1, i));
  const app = $('app'); app.innerHTML = '';
  const ts = game.timeScale;
  game = yardAtStage(i);
  game.timeScale = ts;
  view = new CraftView(game, app, models);
  view.setIcons(ICON);
  expose();
  stageHtml = ''; sideKey = ''; dockKey = '';
  const u = new URL(location.href); u.searchParams.set('stage', String(i)); history.replaceState(null, '', u);
}

// ---------------------------------------------------------------- input
const keys = new Set<string>();
let mouse: { x: number; y: number } | null = null;
let mouseScreen: { x: number; y: number } | null = null;
let lmb = false, dragging = false, dragT = 0;
let running = false;
type Tab = 'craft' | 'tech' | 'wolt' | 'grid' | 'radio' | 'cart';
let tab: Tab | null = null;
const ndc = (e: { clientX: number; clientY: number }) => ({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 });
const onCanvas = (e: Event) => (e.target as HTMLElement).tagName === 'CANVAS';

function targetName(t: Target): string {
  switch (t.kind) {
    case 'ground': return tr('teren', 'ground');
    case 'self': return 'Wolt';
    case 'scrap': return SCRAP[t.s.kind].name;
    case 'build': return BUILD[t.b.kind].name;
    case 'cart': return game.cart.rig.mast && game.cart.rig.sail ? tr('Żaglowóz', 'land yacht') : tr('wózek serwisowy', 'service cart');
    case 'drop': return tr('pakunek', 'bundle');
  }
}

function closeMenu() { $('ctx').hidden = true; }
function openMenu(x: number, y: number, title: string, acts: { label: string; ok: boolean; why?: string; run: () => void }[]) {
  const m = $('ctx');
  m.innerHTML = `<div class="h">${esc(title.toUpperCase())}</div>` + acts.map((a, i) =>
    `<button type="button" data-i="${i}" ${a.ok ? '' : 'disabled'}><span>${a.label}</span>${a.ok ? '' : `<small>${a.why ?? ''}</small>`}</button>`).join('');
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - 240) + 'px';
  m.style.top = Math.min(y, innerHeight - 40 - acts.length * 32) + 'px';
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    const a = acts[Number((b as HTMLElement).dataset.i)];
    if (a.ok) a.run();
    closeMenu();
  }));
}
const asMenu = (t: Target, acts: Action[]) => acts.map(a => ({ label: a.label, ok: a.ok, why: a.why, run: () => command(t, a.id) }));
function command(t: Target, a: Action['id']) {
  if (a === 'bench') { tab = 'craft'; sideKey = ''; }
  game.command(t, a);
}

addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', e => {
  if (!running) return;
  if (!onCanvas(e)) return;
  closeMenu();
  const at = view.pick(ndc(e).x, ndc(e).y);
  if (game.placing) {
    if (e.button === 2) { game.placing = null; return; }
    if (at) { const c = view.ghostCorner(at); game.place(game.placing, c.x, c.y); }
    return;
  }
  const t = view.pickTarget(ndc(e).x, ndc(e).y);
  if (!t) return;
  const acts = game.actionsFor(t);
  if (e.button === 0) {
    lmb = true;
    if (t.kind === 'ground') { game.command(t, 'walk'); dragging = true; dragT = 0; return; }
    const first = acts.find(a => a.ok) ?? acts[0];
    if (first) command(t, first.id);
  } else if (e.button === 2 && t.kind !== 'ground' && acts.length) openMenu(e.clientX, e.clientY, targetName(t), asMenu(t, acts));
});
addEventListener('pointerup', e => { if (e.button === 0) { lmb = false; dragging = false; } });
addEventListener('pointermove', e => { mouse = ndc(e); mouseScreen = { x: e.clientX, y: e.clientY }; });
addEventListener('wheel', e => { if (!onCanvas(e)) return; view.zoomBy(Math.exp(e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });
const toggleTab = (t: Tab) => { tab = tab === t ? null : t; sideKey = ''; };
addEventListener('keydown', e => {
  if ((e.target as HTMLElement).tagName === 'SELECT') return;
  if (e.code === 'AltLeft' || e.code === 'AltRight') { view.overlay = true; e.preventDefault(); }
  if (e.code === 'Space' && running) e.preventDefault(); // the yacht's brake, not a page scroll
  if (e.repeat) return;
  keys.add(e.code);
  if (!running) return;
  switch (e.code) {
    case 'KeyC': toggleTab('craft'); break;
    case 'KeyT': toggleTab('tech'); break;
    case 'KeyU': toggleTab('wolt'); break;
    case 'KeyN': toggleTab('grid'); break;
    case 'KeyR': toggleTab('radio'); break;
    case 'KeyI': toggleTab('cart'); break;
    case 'KeyL': game.toggleLight(); break;
    case 'KeyF': if (game.aboard) game.toggleTrim(); break;
    case 'KeyM': sound.toggleMute(); break;
    case 'KeyH': { const h = $('help'); h.hidden = !h.hidden; break; }
    case 'Escape': if (game.placing) game.placing = null; else if (game.held) { game.held = null; } else if (!$('ctx').hidden) closeMenu(); else tab = null; sideKey = ''; break;
    case 'Equal': case 'NumpadAdd': view.zoomBy(1 / 1.2); break;
    case 'Minus': case 'NumpadSubtract': view.zoomBy(1.2); break;
    case 'KeyE': {
      // E on a cart, a building, a bundle: the first thing it offers (salvage is held E)
      const t = nearTarget();
      if (t) { const a = game.actionsFor(t).find(x => x.ok && x.id !== 'pickup' && x.id !== 'unplug'); if (a) command(t, a.id); }
      break;
    }
  }
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'AltLeft' || e.code === 'AltRight') view.overlay = false; });
addEventListener('blur', () => { keys.clear(); view.overlay = false; lmb = false; dragging = false; });

/** The thing E acts on: the cart, a drop or a building within reach (not scrap: that is held E). */
function nearTarget(): Target | null {
  if (dist(game.cart.pos, game.pos) < 1.9) return { kind: 'cart' };
  for (const d of game.drops) if (dist(d.pos, game.pos) < 1.3) return { kind: 'drop', d };
  let best: Target | null = null, bd = 1.6;
  for (const b of game.buildings) { const d = dist(b.port, game.pos); if (d < bd) { bd = d; best = { kind: 'build', b }; } }
  return best;
}

const startEl = $('start');
// touch: a thumb stick for WASD plus the action keys (tap the ground still walks there)
const pad = mountTouch({
  left: { kind: 'stick' },
  buttons: [
    { label: tr('użyj (E)', 'use (E)'), code: 'KeyE', hold: true },
    { label: tr('biegnij', 'run'), code: 'ShiftLeft', hold: true },
    { label: tr('hamulec', 'brake'), code: 'Space', hold: true },
    { label: 'Q-1', code: 'KeyF' },
    { label: tr('światło', 'light'), code: 'KeyL' },
    { label: 'zoom +', code: 'Equal' },
    { label: 'zoom −', code: 'Minus' },
  ],
});
showTouch(pad, false);
$('go').addEventListener('click', () => { startEl.hidden = true; running = true; sound.start(); showTouch(pad, true); });

// ---------------------------------------------------------------- HUD helpers
const n1 = (x: number, d = 1) => num(x, d);
const icon = (id: ItemId, cls = '') => `<img class="${cls}" src="${ICON[id] ?? ''}" alt="">`;
const bagHtml = (bag: Partial<Record<ItemId, number>>, times = 1) => (Object.entries(bag) as [ItemId, number][]).map(([id, n]) => {
  const have = game.have(id), need = n * times;
  return `<span class="${game.sandbox || have >= need ? 'ok' : 'miss'}">${need} ${ITEMS[id].name}${game.sandbox ? '' : ` (${have})`}</span>`;
}).join(' · ');
function clockS(s: number) { return s < 90 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`; }

// ---------------------------------------------------------------- vitals and clock
function vitals() {
  const g = game;
  const cap = g.battery();
  const fmt = (x: number) => (x >= 0 ? '+' : '−') + n1(Math.abs(x), 2);
  const r = g.energyRate;
  $('vitals').innerHTML = `<div class="row lbl"><span>${tr('WOLT · BATERIA', 'WOLT · BATTERY')}</span><span>${Math.round(g.energy)}/${cap} Wh</span></div>
    <div class="bar"><i id="en" class="${g.energy < 15 ? 'low' : ''}" style="width:${g.energyPct() * 100}%"></i></div>
    <div class="flows">${g.flows.map(f => `<div class="row"><span>${f.label}</span><b class="${f.rate > 0 ? 'okc' : ''}">${fmt(f.rate)}</b></div>`).join('')}
    <div class="row sum"><span>${tr('bilans', 'balance')}</span><b class="${r >= 0 ? 'okc' : ''}">${fmt(r)} Wh/s</b></div></div>
    ${g.research ? `<div class="flows"><div class="row"><span>Q-1: ${TECHS[g.research].name}</span><b>${Math.floor((g.progress[g.research] ?? 0) / TECHS[g.research].cost * 100)}%</b></div>
      <div class="meter"><i style="width:${(g.progress[g.research] ?? 0) / TECHS[g.research].cost * 100}%;background:#bfe6ef"></i></div>
      ${g.computeRate > 0 ? '' : `<div class="dim">${tr(`czeka na baterię > ${COMPUTE_MIN * 100}%`, `waits for battery > ${COMPUTE_MIN * 100}%`)}</div>`}</div>` : ''}`;
  const sun = g.sun();
  $('clock').innerHTML = `<span>${g.clock()} ${g.isNight() ? tr('noc', 'night') : sun < 0.3 ? tr('zmierzch', 'dusk') : tr('dzień', 'day')}</span>
    <span class="dim">${tr('słońce', 'sun')} ${Math.round(sun * 100)}% · ${tr('wiatr', 'wind')} ${g.wind.arrow()} ${g.wind.strength.toFixed(0)} m/s</span>`;
}

// ---------------------------------------------------------------- stages panel
let stageHtml = '';
let stageMin = false;
function stagesPanel() {
  const g = game, i = g.stage, st = STAGES[i];
  const done = stageDone(g, i);
  const html = `<div class="t"><span>${tr('ETAPY', 'STAGES')} ${i + 1}/${STAGES.length}</span><button class="btn" data-a="min">${stageMin ? '+' : '–'}</button></div>
    <h2>${st.name}</h2><p>${st.intro}</p>
    ${st.goals.map(x => { const d = x.done(g); return `<div class="obj ${d ? 'done' : 'active'}">${x.text}</div>`; }).join('')}
    <div class="nav"><button class="btn" data-a="prev" ${i === 0 ? 'disabled' : ''}>‹ ${tr('poprzedni', 'previous')}</button>
      <button class="btn ${done ? 'go' : ''}" data-a="next" ${i >= STAGES.length - 1 ? 'disabled' : ''}>${done ? tr('dalej', 'next') : tr('pomiń', 'skip')} ›</button>
      <button class="btn" data-a="redo">${tr('od nowa', 'restart')}</button></div>
    <div class="nav nav2"><select data-a="pick">${STAGES.map((s, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      <button class="btn ${g.timeScale > 1 ? 'on' : ''}" data-a="fast" title="${tr('doba szybciej', 'faster day')}">${tr('czas', 'time')} ×${g.timeScale}</button>
      <button class="btn ${g.sandbox ? 'on' : ''}" data-a="sand">${tr('za darmo', 'free')}</button></div>`;
  if (html === stageHtml) return;
  stageHtml = html;
  const el = $('stages');
  el.className = 'panel stages' + (stageMin ? ' min' : '');
  el.innerHTML = html;
}
$('stages').addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (!a) return;
  switch (a.dataset.a) {
    case 'min': stageMin = !stageMin; break;
    case 'prev': openStage(game.stage - 1); break;
    case 'next': openStage(game.stage + 1); break;
    case 'redo': openStage(game.stage); break;
    case 'fast': game.timeScale = game.timeScale === 1 ? 4 : game.timeScale === 4 ? 16 : 1; break;
    case 'sand': game.sandbox = !game.sandbox; break;
  }
  stageHtml = '';
});
$('stages').addEventListener('change', e => { const s = e.target as HTMLSelectElement; if (s.dataset.a === 'pick') openStage(Number(s.value)); });

// ---------------------------------------------------------------- inventory dock
let dockKey = '';
let selSlot: { inv: 'w' | 'c'; i: number } | null = null;
function slotHtml(inv: Inventory, which: 'w' | 'c') {
  return inv.slots.map((s, i) => s
    ? `<div class="sl ${ITEMS[s.id].big ? 'big' : ''} ${selSlot && selSlot.inv === which && selSlot.i === i ? 'sel' : ''}" data-inv="${which}" data-i="${i}" title="${esc(ITEMS[s.id].name)}">${icon(s.id)}<b>${s.n}${s.id === 'cable' ? 'm' : ''}</b></div>`
    : `<div class="sl empty"></div>`).join('');
}
function dock() {
  const g = game;
  const near = g.cartNear();
  const key = JSON.stringify([g.inv.slots, g.cart.inv.slots, g.cart.repaired, near, g.modules, g.moduleSlots(), selSlot]);
  if (key === dockKey) return;
  dockKey = key;
  const mods = Array.from({ length: g.moduleSlots() }, (_, i) => g.modules[i]);
  $('dock').innerHTML = `<div class="grp"><div class="lbl"><span>${tr('WOLT', 'WOLT')} ${g.inv.used()}/${g.inv.size}</span></div><div class="slots wolt">${slotHtml(g.inv, 'w')}</div></div>
    <div class="grp"><div class="lbl"><span>${tr('MODUŁY', 'MODULES')}</span><span>U</span></div><div class="slots">${mods.map(m => m ? `<div class="sl mod" data-mod="${m}" title="${esc(ITEMS[m].name)}">${icon(m)}</div>` : `<div class="sl mod empty"></div>`).join('')}</div></div>
    ${g.cart.repaired ? `<div class="grp"><div class="lbl"><span>${tr('WÓZEK', 'CART')} ${g.cart.inv.used()}/${g.cart.inv.size}</span><span class="dim">${near ? (g.hitched ? tr('doczepiony', 'hitched') : tr('obok', 'nearby')) : tr(`za daleko (> ${CART_REACH} m)`, `too far (> ${CART_REACH} m)`)}</span></div><div class="slots cart ${near ? '' : 'off'}">${slotHtml(g.cart.inv, 'c')}</div></div>`
    : `<div class="grp"><div class="lbl"><span>${tr('WÓZEK', 'CART')}</span></div><div class="dim" style="max-width:180px;font-size:11px">${tr('zepsuty: 2 łożyska + 2 żelaza, potem +12 miejsc', 'broken: 2 bearings + 2 iron, then +12 slots')}</div></div>`}`;
}
$('dock').addEventListener('pointerdown', e => {
  const el = (e.target as HTMLElement).closest('.sl') as HTMLElement | null;
  if (!el) return;
  e.stopPropagation();
  if (el.dataset.mod) {
    const m = el.dataset.mod as ModuleId;
    openMenu(e.clientX, e.clientY - 80, ITEMS[m].name, [{ label: tr('Zdemontuj', 'Remove'), ok: true, run: () => game.uninstall(m) }]);
    return;
  }
  if (!el.dataset.inv) return;
  const inv = el.dataset.inv === 'w' ? game.inv : game.cart.inv;
  const i = Number(el.dataset.i);
  const s = inv.slots[i];
  if (!s) return;
  selSlot = { inv: el.dataset.inv as 'w' | 'c', i };
  const d = ITEMS[s.id];
  const acts: { label: string; ok: boolean; why?: string; run: () => void }[] = [];
  if (d.kind === 'building') acts.push({ label: tr('Postaw (LPM na placu, PPM anuluj)', 'Place (LMB on the yard, RMB cancels)'), ok: true, run: () => { game.placing = s.id as BuildingId; } });
  if (d.kind === 'module') acts.push({ label: tr('Zamontuj w Wolcie', 'Fit into Wolt'), ok: game.modules.length < game.moduleSlots(), why: tr('brak gniazd', 'no slots'), run: () => game.install(s.id as ModuleId) });
  if (game.cartNear()) acts.push({ label: inv === game.inv ? tr('Przełóż na wózek', 'Move to the cart') : tr('Przełóż do Wolta', 'Move to Wolt'), ok: inv === game.inv || !d.big, why: tr('za duże dla Wolta', 'too big for Wolt'), run: () => game.moveSlot(inv, i) });
  acts.push({ label: tr('Wyrzuć na ziemię', 'Drop on the ground'), ok: true, run: () => game.dropSlot(inv, i) });
  openMenu(e.clientX, e.clientY - 40 - acts.length * 32, `${d.name} ×${s.n}`, acts);
});

// ---------------------------------------------------------------- side panels
let sideKey = '';
let techSel: TechId | null = null;
const TABS: [Tab, string, string][] = [
  ['craft', 'C', tr('Wytwarzanie', 'Crafting')], ['tech', 'T', tr('Technologie', 'Technology')], ['wolt', 'U', 'Wolt'],
  ['grid', 'N', tr('Sieć', 'Grid')], ['radio', 'R', 'Radio'],
];
function tabs() {
  const html = TABS.map(([id, k, name]) => `<button class="btn ${tab === id ? 'on' : ''}" data-tab="${id}">${k} · ${name}</button>`).join('');
  if ($('tabs').innerHTML !== html) $('tabs').innerHTML = html;
}
$('tabs').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null; if (b) toggleTab(b.dataset.tab as Tab); });

function craftPanel(): string {
  const g = game;
  const j = g.craftJob;
  const where = g.nearBench() ? (g.benchPowered() ? tr('przy stole, z prądem: 2× szybciej, bez baterii Wolta', 'at the bench, powered: 2× faster, spares Wolt\'s battery') : tr('przy stole, bez prądu', 'at the bench, unpowered')) : tr('w terenie: tylko ręczne przepisy', 'in the field: hand recipes only');
  let h = `<h3>${tr('Wytwarzanie', 'Crafting')}</h3><div class="dim" style="font-size:11px">${where}</div>`;
  if (j) h += `<div class="job"><div class="row"><span>${icon(j.r.out, '')} ${ITEMS[j.r.out].name}${j.left ? ` (+${j.left})` : ''}</span><button class="btn" data-x="cancel">${tr('anuluj', 'cancel')}</button></div><div class="meter"><i style="width:${j.t / j.total * 100}%"></i></div></div>`;
  const groups: [string, (r: Recipe) => boolean][] = [
    [tr('Części i kabel', 'Parts and cable'), r => ITEMS[r.out].kind === 'part' && r.tech !== 'sailing'],
    [tr('Żaglowóz (montuje się na wózku)', 'Land yacht (fitted onto the cart)'), r => r.tech === 'sailing'],
    [tr('Narzędzia', 'Tools'), r => ITEMS[r.out].kind === 'tool'],
    [tr('Budowle i maszyny', 'Buildings and machines'), r => ITEMS[r.out].kind === 'building'],
    [tr('Moduły Wolta', 'Wolt\'s modules'), r => ITEMS[r.out].kind === 'module'],
  ];
  for (const [name, f] of groups) {
    h += `<div class="sec">${name}</div>`;
    for (const r of RECIPES.filter(f)) {
      const known = g.recipeKnown(r);
      const why = g.whyNot(r);
      const k = RECIPES.indexOf(r);
      h += `<div class="rec ${known ? '' : 'locked'}">${icon(r.out)}<div><div class="nm">${ITEMS[r.out].name}${r.n > 1 ? ` ×${r.n}` : ''} ${ITEMS[r.out].big ? '<span class="tense">XL</span>' : ''}</div>
        <div class="in">${known ? bagHtml(r.in) : tr(`technologia: ${TECHS[r.tech!].name}`, `technology: ${TECHS[r.tech!].name}`)}</div>
        <div class="in">${r.where === 'bench' ? tr('stół', 'bench') : tr('ręcznie', 'by hand')} · ${n1(r.time, 0)} s${r.tool ? ` · ${ITEMS[r.tool].name}` : ''}</div>
        ${why && known ? `<div class="why">${why}</div>` : ''}</div>
        <div class="acts">${known ? `<button class="btn ${why ? '' : 'go'}" data-r="${k}" ${why ? 'disabled' : ''}>${tr('zrób', 'make')}</button>${r.out === 'cable' || ITEMS[r.out].kind === 'part' ? `<button class="btn" data-r5="${k}" ${g.whyNot(r, 5) ? 'disabled' : ''}>×5</button>` : ''}` : ''}</div></div>`;
    }
  }
  return h;
}

function techPanel(): string {
  const g = game;
  const W = 128, H = 66;
  const ids = Object.keys(TECHS) as TechId[];
  const cols = Math.max(...ids.map(t => TECHS[t].col)) + 1, rows = Math.max(...ids.map(t => TECHS[t].row)) + 1;
  const lines = ids.flatMap(t => TECHS[t].needs.map(n => {
    const a = TECHS[n], b = TECHS[t];
    return `<path d="M${a.col * W + 118} ${a.row * H + 22} C ${a.col * W + 124} ${a.row * H + 22}, ${b.col * W - 6} ${b.row * H + 22}, ${b.col * W} ${b.row * H + 22}" stroke="${g.techs.has(n) ? '#7fd99a88' : '#ffffff33'}" fill="none"/>`;
  })).join('');
  const nodes = ids.map(t => {
    const d = TECHS[t], st = g.techState(t);
    const p = (g.progress[t] ?? 0) / Math.max(1, d.cost);
    return `<div class="tnode ${st}" data-t="${t}" style="left:${d.col * W}px;top:${d.row * H}px"><div class="n">${d.name}</div>
      <div class="dim">${st === 'done' ? tr('znane', 'known') : st === 'active' ? `${Math.floor(p * 100)}%` : `${d.cost} Wh`}</div>
      ${st === 'active' || (p > 0 && st !== 'done') ? `<div class="meter"><i style="width:${p * 100}%"></i></div>` : ''}</div>`;
  }).join('');
  const sel = techSel ?? g.research ?? null;
  let desc = '';
  if (sel) {
    const d = TECHS[sel], st = g.techState(sel);
    const recs = RECIPES.filter(r => r.tech === sel).map(r => ITEMS[r.out].name);
    desc = `<div class="tdesc"><b>${d.name}</b>: ${d.desc}
      ${d.needs.length ? `<br>${tr('wymaga', 'needs')}: ${d.needs.map(n => `<span class="${g.techs.has(n) ? 'okc' : 'limit'}">${TECHS[n].name}</span>`).join(', ')}` : ''}
      ${d.obs.length ? `<br>${tr('obserwacje', 'observations')}: ${d.obs.map(o => `<span class="${g.obs.has(o) ? 'okc' : 'limit'}">${OBS[o]}</span>`).join(', ')}` : ''}
      ${recs.length ? `<br>${tr('odblokowuje', 'unlocks')}: ${recs.join(', ')}` : ''}${d.slots ? `<br>+${d.slots} ${tr('gniazdo modułu', 'module slot')}` : ''}
      <br>${tr('koszt obliczeń', 'compute cost')}: ${d.cost} Wh ${st === 'ready' ? `<button class="btn go" data-go="${sel}">${tr('licz', 'compute')}</button>` : st === 'active' ? `<span class="okc">${tr('w toku', 'running')}</span>` : ''}</div>`;
  }
  const obsList = (Object.keys(OBS) as ObsId[]).map(o => `<div class="${g.obs.has(o) ? '' : 'no'}">${g.obs.has(o) ? '✓' : '○'} ${OBS[o]}</div>`).join('');
  return `<h3>${tr('Technologie · obliczenia Q-1', 'Technology · Q-1 computing')}</h3>
    <div class="dim" style="font-size:11px;line-height:1.5">${tr(`Q-1 uczy się z tego, co Wolt rozbiera (obserwacje), a liczy na nadwyżce: tylko gdy bateria ma ponad ${COMPUTE_MIN * 100}%. Kliknij gotową technologię, żeby zaczął.`, `Q-1 learns from what Wolt takes apart (observations) and computes on surplus: only while the battery is above ${COMPUTE_MIN * 100}%. Click a ready technology to start.`)}</div>
    <div style="overflow-x:auto;margin-top:8px"><div class="tree" style="width:${cols * W}px;height:${rows * H}px"><svg width="${cols * W}" height="${rows * H}">${lines}</svg>${nodes}</div></div>
    ${desc}<div class="sec">${tr('Obserwacje', 'Observations')}</div><div class="obsl">${obsList}</div>`;
}

function woltPanel(): string {
  const g = game;
  const mods = (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'module') as ModuleId[];
  return `<h3>${tr('Wolt · ciało i moduły', 'Wolt · body and modules')}</h3>
    <div class="row"><span>${tr('bateria', 'battery')}</span><b>${g.battery()} Wh${g.battery() > BATTERY ? ` (+${g.battery() - BATTERY})` : ''}</b></div>
    <div class="row"><span>${tr('ekwipunek', 'inventory')}</span><b>${g.inv.size} ${tr('miejsc', 'slots')}${g.cart.repaired ? ` + ${tr('wózek', 'cart')} ${g.cart.inv.size}` : ''}</b></div>
    <div class="row"><span>${tr('gniazda modułów', 'module slots')}</span><b>${g.modules.length}/${g.moduleSlots()}</b></div>
    <div class="row"><span>${tr('rozbiórka', 'salvage')}</span><b>${g.hasModule('m_arm') ? tr('wzmocnione ramię (−40% czasu)', 'heavy arm (−40% time)') : tr('ramię serwisowe', 'service arm')}</b></div>
    <div class="row"><span>${tr('obliczenia Q-1', 'Q-1 computing')}</span><b>${g.hasModule('m_ai') ? '2×' : '1×'}</b></div>
    <div class="sec">${tr('Moduły', 'Modules')}</div>
    <div class="mods">${mods.map(m => {
      const on = g.modules.includes(m), have = g.have(m) > 0;
      const r = RECIPES.find(x => x.out === m)!;
      return `<div class="modc ${on ? 'on' : ''}">${icon(m)}<b>${ITEMS[m].name.replace(/^moduł: |^module: /, '')}</b><span class="dim">${ITEMS[m].desc}</span>
        ${on ? `<button class="btn" data-un="${m}">${tr('zdemontuj', 'remove')}</button>` : have || g.sandbox ? `<button class="btn go" data-in="${m}">${tr('zamontuj', 'fit')}</button>` : `<span class="dim">${g.recipeKnown(r) ? tr('wytwórz przy stole (C)', 'make at the bench (C)') : tr(`technologia: ${TECHS[r.tech!].name}`, `technology: ${TECHS[r.tech!].name}`)}</span>`}</div>`;
    }).join('')}</div>`;
}

function gridPanel(): string {
  const g = game;
  const nets = g.networks.filter(n => n.nodes.length > 1 || n.production > 0);
  const remote = g.hasModule('m_remote');
  let h = `<h3>${tr('Sieć · bilans prądu', 'Grid · power balance')}</h3>
    <div class="dim" style="font-size:11px;line-height:1.5">${remote ? tr('Zdalne sterowanie: przełączaj maszyny stąd.', 'Remote control: switch machines from here.') : tr('Przełączać można przy maszynie. Moduł zdalnego sterowania pozwala stąd.', 'Switch machines next to them. The remote control module lets you do it from here.')}</div>`;
  if (!nets.length) h += `<div class="dim" style="margin-top:8px">${tr('Nic nie jest jeszcze połączone. Weź kabel z gniazda maszyny (LPM na niej) i wepnij w drugą.', 'Nothing is connected yet. Take a cable from a machine\'s socket (LMB on it) and plug it into another.')}</div>`;
  for (const n of nets) {
    const members = g.buildings.filter(b => n.nodes.includes(b.id));
    h += `<div class="net"><div class="row"><span>${tr('sieć', 'grid')} ${n.id}</span><b class="${n.supply > 0.99 ? 'okc' : 'limit'}">${n.supply > 0.99 ? tr('zasilona', 'powered') : tr('za mało prądu', 'not enough power')}</b></div>
      <div class="row"><span>${tr('produkcja', 'production')}</span><b class="okc">+${Math.round(n.production)} W</b></div>
      <div class="row"><span>${tr('pobór', 'demand')}</span><b>−${Math.round(n.demand)} W</b></div>
      <div class="row sum"><span>${tr('bilans', 'balance')}</span><b class="${n.balance >= 0 ? 'okc' : 'limit'}">${g.fmtW(n.balance)}</b></div>
      ${n.capacity ? `<div class="row"><span>${tr('magazyn', 'storage')}</span><b>${Math.round(n.stored)} / ${n.capacity} Wh</b></div><div class="meter"><i style="width:${n.stored / n.capacity * 100}%;background:#6fc4e6"></i></div>` : ''}
      ${members.map(b => `<div class="mach"><span>${BUILD[b.kind].name}</span><span class="dim">${g.status(b)}</span>${BUILD[b.kind].switchable && b.ok ? `<button class="btn ${b.on ? 'on' : ''}" data-sw="${b.id}" ${g.canRemote(b) ? '' : 'disabled'}>${b.on ? tr('wł.', 'on') : tr('wył.', 'off')}</button>` : ''}</div>`).join('')}</div>`;
  }
  h += `<div class="sec">${tr('Moc maszyn', 'Machine power')}</div><div class="dim" style="font-size:11px;line-height:1.6">${tr('panel', 'panel')} ≤${POWER.solarPeak} W · ${tr('turbina', 'turbine')} ≤${POWER.windPeak} W · ${tr('stara turbina', 'old turbine')} ≤${POWER.oldTurbine} W<br>${tr('latarnia', 'lamp')} ${POWER.lamp} W · ${tr('stół', 'bench')} ${POWER.benchIdle}/${POWER.benchWork} W · ${tr('kołyska', 'cradle')} ${POWER.charger} W · ${tr('przetwórnia', 'recycler')} ${POWER.recycler} W · ${tr('maszt', 'mast')} ${POWER.mast} W</div>`;
  return h;
}

function radioPanel(): string {
  const g = game;
  const mast = g.buildings.find(b => b.kind === 'mast');
  const state = !g.hasModule('m_radio') ? tr('Wolt nie ma modułu radiowego.', 'Wolt has no radio module.')
    : !mast ? tr('Bez masztu radio Wolta słyszy tylko szum. Postaw maszt antenowy.', 'Without a mast Wolt\'s radio hears only static. Raise a radio mast.')
      : !g.powered(mast) ? tr('Maszt stoi, ale nie ma prądu (200 W).', 'The mast stands but has no power (200 W).')
        : g.radio.listening ? tr(`Nasłuch… następny sygnał za ${clockS(20 - g.radio.t)}`, `Listening… next signal in ${clockS(20 - g.radio.t)}`) : tr('Maszt gotowy. Kliknij go i wybierz Nasłuchuj.', 'The mast is ready. Click it and choose Listen.');
  return `<h3>${tr('Radio · nasłuch', 'Radio · listening')}</h3><div class="radio"><div class="dim" style="font-size:11px">${state}</div>
    ${CONTACTS.slice(0, g.radio.heard).map(c => `<div class="c"><b>${c.name}</b><br>${c.text}</div>`).join('') || `<div class="dim" style="margin-top:8px">${tr('Nic jeszcze nie złapano.', 'Nothing caught yet.')}</div>`}
    ${mast && g.hasModule('m_radio') && g.powered(mast) && g.radio.heard < CONTACTS.length ? `<button class="btn ${g.radio.listening ? 'on' : 'go'}" data-listen="1">${g.radio.listening ? tr('przerwij', 'stop') : tr('nasłuchuj', 'listen')}</button>` : ''}</div>`;
}

function cartPanel(): string {
  const g = game;
  return `<h3>${tr('Wózek serwisowy', 'Service cart')}</h3><div class="dim" style="font-size:11px;line-height:1.5">${g.cart.repaired
    ? tr(`12 miejsc, w tym na rzeczy duże (XL): panele, maszyny, maszt. Działa, gdy jest doczepiony albo bliżej niż ${CART_REACH} m. Kliknij przedmiot w doku, żeby przełożyć.`, `12 slots, including big (XL) things: panels, machines, the mast. Works when hitched or closer than ${CART_REACH} m. Click an item in the dock to move it.`)
    : tr('Zatarte koła. Naprawa: 2 łożyska + 2 żelaza (w ekwipunku Wolta). Łożyska są w skrzynce z częściami.', 'Seized wheels. Fix: 2 bearings + 2 iron (in Wolt\'s inventory). Bearings are in the parts box.')}</div>`;
}

function side() {
  const el = $('side');
  if (!tab) { el.hidden = true; return; }
  el.hidden = false;
  const g = game;
  const key = tab + JSON.stringify([g.inv.slots, g.cart.inv.slots, [...g.techs], g.research, Math.floor((g.research ? g.progress[g.research] ?? 0 : 0)), g.craftJob ? Math.floor(g.craftJob.t * 10) : -1, g.modules, [...g.obs], g.nearBench(), g.benchPowered(), techSel, g.sandbox,
    tab === 'grid' ? g.networks.map(n => [n.nodes.length, Math.round(n.balance), Math.round(n.stored), g.buildings.map(b => b.on)]) : 0, tab === 'radio' ? [g.radio, g.mastUp()?.id] : 0, g.hitched, g.cart.repaired]);
  if (key === sideKey) return;
  sideKey = key;
  el.className = 'panel side' + (tab === 'tech' ? ' wide' : '');
  el.innerHTML = tab === 'craft' ? craftPanel() : tab === 'tech' ? techPanel() : tab === 'wolt' ? woltPanel() : tab === 'grid' ? gridPanel() : tab === 'radio' ? radioPanel() : cartPanel();
}
$('side').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const b = t.closest('[data-r],[data-r5],[data-x],[data-t],[data-go],[data-in],[data-un],[data-sw],[data-listen]') as HTMLElement | null;
  if (!b) return;
  const d = b.dataset;
  if (d.r) game.craft(RECIPES[Number(d.r)]);
  else if (d.r5) game.craft(RECIPES[Number(d.r5)], 5);
  else if (d.x === 'cancel') game.cancelCraft();
  else if (d.go) game.startResearch(d.go as TechId);
  else if (d.t) { techSel = d.t as TechId; if (game.techState(techSel) === 'ready' && !game.research) game.startResearch(techSel); }
  else if (d.in) game.install(d.in as ModuleId);
  else if (d.un) game.uninstall(d.un as ModuleId);
  else if (d.sw) { const bl = game.buildings.find(x => x.id === d.sw); if (bl) game.doAction({ kind: 'build', b: bl }, 'toggle'); }
  else if (d.listen) { const m = game.buildings.find(x => x.kind === 'mast'); if (m) game.doAction({ kind: 'build', b: m }, 'listen'); }
  sideKey = '';
});
for (const id of ['side', 'tabs', 'dock', 'stages', 'ctx']) $(id).addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- hover card
let hoverKey = '';
function infoCard(t: Target): string {
  const g = game;
  switch (t.kind) {
    case 'scrap': {
      const d = SCRAP[t.s.kind];
      return `<div class="h">${d.name.toUpperCase()}</div><div class="dim">${d.desc}</div>
        <div class="sub">${tr('daje', 'gives')}${d.rounds > 1 ? tr(` (×${t.s.rounds} rundy)`, ` (×${t.s.rounds} rounds)`) : ''}</div>
        <div>${(Object.entries(d.loot) as [ItemId, number][]).map(([id, n]) => `<b class="okc">+${n}</b> ${ITEMS[id].name}`).join(', ')}</div>
        ${d.obs.length ? `<div class="sub">${tr('Q-1 nauczy się', 'Q-1 will learn')}</div><div>${d.obs.map(o => `${g.obs.has(o) ? '✓' : '+'} ${OBS[o]}`).join('<br>')}</div>` : ''}
        <div class="row cost"><span>${n1(g.salvageTime(t.s), 1)} s</span><span>${d.tool ? `${ITEMS[d.tool].name}${g.hasTool(d.tool) ? '' : ` <span class="limit">${tr('(brak)', '(missing)')}</span>`}` : tr('gołe ramię', 'bare arm')}</span></div>`;
    }
    case 'build': {
      const b = t.b, d = BUILD[b.kind];
      const n = g.net(b);
      return `<div class="h">${d.name.toUpperCase()}</div><div class="dim">${b.kind === 'bench' ? tr('wytwarzanie przepisów stołowych; z prądem 2× szybciej', 'bench recipes; 2× faster with power') : b.kind === 'oldturbine' ? tr('stara turbina warsztatu; spalony silnik', 'the workshop\'s old turbine; burnt-out motor') : ITEMS[b.kind as ItemId].desc}</div>
        <div class="row"><span>${tr('stan', 'state')}</span><b>${g.status(b)}</b></div>
        <div class="row"><span>${tr('gniazda', 'sockets')}</span><b>${g.sockets(b)}/${d.sockets}</b></div>
        ${n && n.nodes.length > 1 ? `<div class="row"><span>${tr('sieć', 'grid')} ${n.id}</span><b class="${n.balance >= 0 ? 'okc' : 'limit'}">${g.fmtW(n.balance)}</b></div>` : ''}
        ${b.kind === 'recycler' ? `<div class="row"><span>${tr('w zasypie', 'in the hopper')}</span><b>${b.hopper}</b></div>` : ''}`;
    }
    case 'cart': {
      const r = g.cart.rig, mk = (b: boolean) => b ? '<span class="okc">✓</span>' : '○';
      const yacht = r.mast && r.sail;
      return `<div class="h">${yacht ? tr('ŻAGLOWÓZ', 'LAND YACHT') : tr('WÓZEK SERWISOWY', 'SERVICE CART')}</div><div class="dim">${g.cart.repaired ? tr(`+12 miejsc, także na duże rzeczy. ${g.cart.inv.used()}/12 zajęte.`, `+12 slots, big things too. ${g.cart.inv.used()}/12 used.`) : tr('zatarte koła: 2 łożyska + 2 żelaza', 'seized wheels: 2 bearings + 2 iron')}</div>
        ${g.cart.repaired && (g.techs.has('sailing') || r.mast || r.runners) ? `<div class="sub">${tr('Żaglowóz', 'Land yacht')}</div><div>${mk(r.mast)} ${tr('maszt z bomem', 'mast and boom')} · ${mk(r.sail)} ${tr('żagiel', 'sail')} · ${mk(r.runners)} ${tr('płozy', 'runners')}</div>
        ${r.sail ? `<div class="row"><span>${tr('przetarcie żagla', 'sail wear')}</span><b class="${g.yacht.wear > 0.5 ? 'limit' : ''}">${Math.round(g.yacht.wear * 100)}%</b></div>` : ''}` : ''}`;
    }
    case 'drop': return `<div class="h">${tr('PAKUNEK', 'BUNDLE')}</div><div class="dim">${t.d.items.map(s => `${s.n} ${ITEMS[s.id].name}`).join(', ')}</div>`;
    case 'self': return `<div class="h">WOLT</div><div class="dim">${Math.round(g.energy)}/${g.battery()} Wh</div>`;
    default: return '';
  }
}

function hoverCard(ht: Target | null) {
  const hv = $('hover');
  if (ht && ht.kind !== 'ground' && mouseScreen && $('ctx').hidden && !game.placing) {
    const acts = game.actionsFor(ht);
    const key = JSON.stringify([targetName(ht), acts, ht.kind === 'build' ? [game.status(ht.b), game.sockets(ht.b), ht.b.hopper] : ht.kind === 'scrap' ? [ht.s.id, ht.s.rounds, [...game.obs]] : 0, game.inv.slots]);
    if (key !== hoverKey) {
      hoverKey = key;
      const first = acts.find(a => a.ok) ?? acts[0];
      hv.innerHTML = infoCard(ht) + (first ? `<div class="act"><span class="k">${tr('LPM', 'LMB')}</span>${first.label}${first.ok ? '' : ` <span class="limit">(${first.why})</span>`}${acts.length > 1 ? ` · <span class="k">${tr('PPM', 'RMB')}</span>${tr('więcej', 'more')}` : ''}</div>` : '');
    }
    hv.hidden = false;
    const w = hv.offsetWidth + 20, hh = hv.offsetHeight + 14;
    hv.style.left = (mouseScreen.x + w > innerWidth - 8 ? mouseScreen.x - w - 12 : mouseScreen.x) + 'px';
    hv.style.top = (mouseScreen.y + hh > innerHeight - 8 ? mouseScreen.y - hh - 6 : mouseScreen.y) + 'px';
    document.body.style.cursor = 'pointer';
  } else { hv.hidden = true; hoverKey = ''; document.body.style.cursor = game.placing ? 'crosshair' : ''; }
}

// ---------------------------------------------------------------- tip over Wolt (progress) and toasts
let toastN = -1;
function tipAndToasts() {
  const g = game;
  const tip = $('tip');
  let text = '', prog = -1;
  if (g.salvage) { text = SCRAP[g.salvage.s.kind].name; prog = g.salvage.t / g.salvageTime(g.salvage.s); }
  else if (g.craftJob && (g.craftJob.r.where === 'hand' || g.nearBench())) { text = ITEMS[g.craftJob.r.out].name; prog = g.craftJob.t / g.craftJob.total; }
  else if (g.placing) { const p = mouse ? view.pick(mouse.x, mouse.y) : null; const c = p ? view.ghostCorner(p) : null; const why = c ? g.canPlace(g.placing, c.x, c.y) : null; text = `${BUILD[g.placing].name}: ${why ?? tr('LPM postaw · PPM anuluj', 'LMB place · RMB cancel')}`; }
  else if (g.held) text = tr(`kabel ${n1(g.heldLength())} / ${g.cableMax()} m · LPM na maszynie: wepnij · Esc: zwiń`, `cable ${n1(g.heldLength())} / ${g.cableMax()} m · LMB a machine: plug in · Esc: reel in`);
  if (text && running) {
    const s = view.project(g.pos, 1.8);
    tip.hidden = false;
    tip.style.left = s.x + 'px'; tip.style.top = s.y + 'px';
    tip.innerHTML = text + (prog >= 0 ? `<div class="prog"><i style="width:${Math.min(100, prog * 100)}%"></i></div>` : '');
  } else tip.hidden = true;
  const sig = g.toasts.map(x => x.t).join();
  if (sig !== String(toastN)) {
    toastN = sig as unknown as number;
    $('toasts').innerHTML = g.toasts.map(x => `<div class="toast">${x.text}</div>`).join('');
  }
}

// ---------------------------------------------------------------- the land yacht: a compass and the trim, while aboard
const sailEl = document.createElement('div');
sailEl.className = 'panel sailp'; sailEl.hidden = true;
$('hud').appendChild(sailEl);
let sailKey = '';
function sailPanel() {
  const g = game;
  if (!g.aboard || !running) { sailEl.hidden = true; sailKey = ''; return; }
  sailEl.hidden = false;
  const y = g.yacht, deg = (a: number) => Math.round(a * 180 / Math.PI);
  const key = JSON.stringify([n1(y.v), Math.round(y.app), deg(y.betaTrue), deg(y.boom), deg(y.best), deg(y.sheet), y.side, Math.round(y.fill * 20), y.auto, Math.round(y.wear * 100), Math.floor(g.sailed.dist), deg(g.wind.dir - y.heading)]);
  if (key === sailKey) return;
  sailKey = key;
  // the compass: the bow points up, starboard is to the right
  const R = 52, C = 60;
  const at = (rel: number, r: number) => `${(C + Math.sin(rel) * r).toFixed(1)},${(C - Math.cos(rel) * r).toFixed(1)}`;
  const windTo = g.wind.dir - y.heading, from = windTo + Math.PI;
  const appTo = Math.atan2(Math.sin(g.wind.dir) * g.wind.strength - Math.sin(y.heading) * y.v, Math.cos(g.wind.dir) * g.wind.strength - Math.cos(y.heading) * y.v) - y.heading;
  const nogo = SAIL.stall * 2.1;
  const arrow = (rel: number, color: string, w: number) => `<line x1="${at(rel + Math.PI, R - 4).split(',')[0]}" y1="${at(rel + Math.PI, R - 4).split(',')[1]}" x2="${at(rel, R - 14).split(',')[0]}" y2="${at(rel, R - 14).split(',')[1]}" stroke="${color}" stroke-width="${w}"/>
    <polygon points="${at(rel, R - 6)} ${at(rel + 0.18, R - 17)} ${at(rel - 0.18, R - 17)}" fill="${color}"/>`;
  const mast = { x: C, y: C - 8 };
  const boomEnd = (b: number, side: number) => { const rel = Math.PI - side * b; return `${(mast.x + Math.sin(rel) * 30).toFixed(1)},${(mast.y - Math.cos(rel) * 30).toFixed(1)}`; };
  const svg = `<svg viewBox="0 0 120 120" width="120" height="120">
    <circle cx="${C}" cy="${C}" r="${R}" fill="#0000" stroke="#ffffff22"/>
    <path d="M${C},${C} L${at(from - nogo, R)} A${R},${R} 0 0 1 ${at(from + nogo, R)} Z" fill="#e0705a22"/>
    ${arrow(windTo, '#ffffff55', 1.5)}${arrow(appTo, '#bfe6ef', 2)}
    <path d="M${C},${C - 26} L${C + 9},${C + 18} L${C - 9},${C + 18} Z" fill="#c9c3b6" opacity=".85"/>
    <line x1="${mast.x}" y1="${mast.y}" x2="${boomEnd(y.best, y.side).split(',')[0]}" y2="${boomEnd(y.best, y.side).split(',')[1]}" stroke="#7fd99a" stroke-width="2" stroke-dasharray="3 3"/>
    <line x1="${mast.x}" y1="${mast.y}" x2="${boomEnd(y.boom, y.side).split(',')[0]}" y2="${boomEnd(y.boom, y.side).split(',')[1]}" stroke="#e8a64e" stroke-width="3"/>
    <circle cx="${mast.x}" cy="${mast.y}" r="3" fill="#1e2022" stroke="#e8a64e"/>
  </svg>`;
  const trim = y.betaTrue < nogo ? `<span class="limit">${tr('martwy kąt: wiatr prosto w dziób, skręć (A/D)', 'in irons: the wind is dead ahead, bear away (A/D)')}</span>`
    : y.auto ? `<span class="okc">${tr(`Q-1 trymuje szot (${n1(AUTO_TRIM, 1)} Wh/s)`, `Q-1 trims the sheet (${n1(AUTO_TRIM, 1)} Wh/s)`)}</span>`
      : y.fill < 0.2 ? `<span class="tense">${tr('żagiel łopocze: wybierz szot (W)', 'the sail is flapping: haul in (W)')}</span>`
        : y.sheet < y.best - 0.15 ? `<span class="tense">${tr('za ciasno: ciągnie w bok, poluzuj (S)', 'too tight: it only pulls sideways, ease out (S)')}</span>`
          : y.sheet > y.best + 0.15 ? `<span class="tense">${tr('za luźno: wybierz szot (W)', 'too loose: haul in (W)')}</span>`
            : `<span class="okc">${tr('żagiel pracuje', 'the sail is drawing')}</span>`;
  sailEl.innerHTML = `<div class="lbl"><span>${tr('ŻAGLOWÓZ', 'LAND YACHT')}</span><span>${n1(y.v)} m/s</span></div>
    <div class="cmp">${svg}<div class="rd">
      <div class="row"><span>${tr('wiatr', 'wind')}</span><b>${n1(g.wind.strength, 0)} m/s</b></div>
      <div class="row"><span>${tr('pozorny', 'apparent')}</span><b>${n1(y.app, 0)} m/s</b></div>
      <div class="row"><span>${tr('kąt do wiatru', 'off the wind')}</span><b>${deg(y.betaTrue)}°</b></div>
      <div class="row"><span>${tr('bom / najlepiej', 'boom / best')}</span><b>${deg(y.boom)}° / ${deg(y.best)}°</b></div>
      <div class="row"><span>${tr('ciąg żagla', 'sail pull')}</span><b>${Math.round(y.drive * 100)}%</b></div>
      <div class="row"><span>${tr('przetarcie', 'wear')}</span><b class="${y.wear > 0.5 ? 'limit' : ''}">${Math.round(y.wear * 100)}%</b></div>
      <div class="row"><span>${tr('przejechane', 'sailed')}</span><b>${Math.floor(g.sailed.dist)} m</b></div>
    </div></div>
    <div class="trim">${trim}</div>
    <div class="dim keys">${tr('<b>A/D</b> ster · <b>LPM</b> kurs · <b>W/S</b> szot · <b>Spacja</b> hamulec · <b>F</b> Q-1 trymuje · <b>E</b> zejdź', '<b>A/D</b> steer · <b>LMB</b> course · <b>W/S</b> sheet · <b>Space</b> brake · <b>F</b> Q-1 trims · <b>E</b> step off')}</div>
    <div class="dim legend"><i style="background:#bfe6ef"></i>${tr('wiatr pozorny', 'apparent wind')} <i style="background:#ffffff55"></i>${tr('rzeczywisty', 'true')} <i style="background:#e8a64e"></i>${tr('bom', 'boom')} <i style="background:#7fd99a"></i>${tr('najlepszy', 'best')}</div>`;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let stepT = 0;
let wasDone = false;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const aim = mouse ? view.pick(mouse.x, mouse.y) : null;
  let hover: Target | null = null;
  if (running) {
    const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    if (dragging && lmb && mouse && !game.placing) {
      dragT -= dt;
      if (aim && dragT <= 0) { game.command({ kind: 'ground', at: aim }, 'walk'); dragT = 0.15; }
    }
    const prev = { ...game.pos };
    game.update(dt, { x: mx, y: my }, keys.has('ShiftLeft') || keys.has('ShiftRight'), keys.has('KeyE'), keys.has('Space'));
    const rolled = dist(prev, game.pos);
    if (rolled > 1e-4) { stepT -= rolled; if (stepT <= 0) { if (Math.random() < 0.7) sound.squeak(false, game.hitched ? 0.5 : 0); stepT = 0.9 + Math.random() * 0.6; } }
    if (game.salvage && Math.random() < dt * 9) sound.scrape();
    if (game.craftJob && Math.random() < dt * 12) sound.craftTick();
    for (const e of game.events) {
      switch (e) {
        case 'build': case 'module': sound.play('plug'); break;
        case 'research': case 'radio': sound.online(); break;
        case 'hook': case 'board': sound.play('plug'); break;
        case 'bump': sound.play('salvage'); break;
        case 'unhook': sound.play('unplug'); break;
        default: sound.play(e);
      }
    }
    game.events.length = 0;
    const near = game.buildings.filter(b => game.powered(b)).reduce((m, b) => Math.max(m, 1 - dist(b.port, game.pos) / 10), 0);
    // under sail the wind in the rigging is the apparent wind
    sound.update(dt, { humNear: Math.max(0.03, near), wind: (game.aboard ? game.yacht.app : game.wind.strength) / 12, tension: 0 });
    hover = mouse && $('ctx').hidden ? view.pickTarget(mouse.x, mouse.y) : null;
    const done = stageDone(game, game.stage);
    if (done && !wasDone && game.stage < STAGES.length - 1) game.toast(tr('Etap zaliczony. „Dalej” po lewej otwiera następny.', 'Stage complete. "Next" on the left opens the following one.'));
    wasDone = done;
  }
  view.frame(dt, running ? aim : null, hover);
  vitals();
  stagesPanel();
  dock();
  tabs();
  side();
  hoverCard(running ? hover : null);
  tipAndToasts();
  sailPanel();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
