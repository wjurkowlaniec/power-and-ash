import '../style.css';
import '../sail/sail.css';
import './sun.css';
import { tr, num, langSwitch } from '../i18n';
import { loadModels, Models } from '../render/assets';
import { Sound } from '../audio/ambient';
import { loadCraftModels } from '../craft/render/craftModels';
import { SURFACES } from '../sail/sim/terrain';
import { SailView } from '../sail/render/sailView';
import { CART_MODELS } from '../sail/render/yachtRig';
import { RollSound } from '../sail/rollSound';
import { SunGame, SUN, bufferRate } from './sim/sunGame';
import { MISSIONS } from './sim/missions';
import { SunView } from './render/sunView';

/**
 * Tech demo "Słońce" (Wojtek, 2026-11-11): the land yacht carries a load that lives off its
 * solar panels. Cloud shadows drift over the ground; in the shade the load runs on a buffer
 * of about 20 s. Keep to the bright patches and find a way from A to B.
 */
const $ = (id: string) => document.getElementById(id)!;

$('startSub').textContent = tr('Tech demo · Przewóz w słońcu', 'Tech demo · Delivery in the sun');
$('startText').innerHTML = tr(
  `<p>Żaglowóz dostał panele słoneczne. Trzeba nim przewieźć ładunek, który żyje tylko w świetle: inkubator z sadzonkami, chłodziarkę z próbkami, szklaną hodowlę. Po niebie płyną chmury, a ich cienie suną po popiele z wiatrem.</p>
   <p>W cieniu ładunek ciągnie z bufora, który starcza na <b>około 20 s</b>. W słońcu bufor szybko się odnawia, a nadmiar idzie do baterii Wolta. Trzymaj się jasnych plam, czytaj cienie na mapce i szukaj drogi. Zatrzymaj się w A, żeby załadować, i w B, żeby oddać.</p>
   <p class="keys"><span class="k">A/D</span>ster <span class="k">W/S</span>szot <span class="k">F</span>Q-1 trymuje <span class="k">Shift</span>balast <span class="k">E</span>silnik <span class="k">Spacja</span>hamulec <span class="k">R</span>koła/płozy <span class="k">C</span>misja</p>`,
  `<p>The land yacht now has solar panels. It has to carry a load that lives only in the light: an incubator of seedlings, a cooler of samples, a glass culture. Clouds drift across the sky and their shadows slide over the ash with the wind.</p>
   <p>In the shade the load draws on a buffer that lasts <b>about 20 s</b>. In the sun the buffer refills fast and the surplus goes into Wolt’s battery. Keep to the bright patches, read the shadows on the minimap and find a way. Stop in A to load and in B to hand it over.</p>
   <p class="keys"><span class="k">A/D</span>steer <span class="k">W/S</span>sheet <span class="k">F</span>Q-1 trims <span class="k">Shift</span>ballast <span class="k">E</span>motor <span class="k">Space</span>brake <span class="k">R</span>wheels/runners <span class="k">C</span>mission</p>`);
$('startSmall').textContent = tr('prototyp · chmury, światło i fizyka w czystym TS, render Three.js · modele CC0: Kay Lousberg, Quaternius', 'prototype · clouds, light and physics in plain TS, Three.js rendering · CC0 models: Kay Lousberg, Quaternius');
$('start').querySelector('.card')!.appendChild(langSwitch());

const goBtn = $('go') as HTMLButtonElement;
goBtn.disabled = true;
goBtn.textContent = tr('Ładowanie modeli…', 'Loading models…');
let models: Models;
try {
  models = await loadModels((d, t) => { goBtn.textContent = tr(`Ładowanie modeli… ${d}/${t}`, `Loading models… ${d}/${t}`); });
  await loadCraftModels(models, undefined, CART_MODELS);
} catch { models = new Map(); }
goBtn.textContent = tr('Rysowanie terenu…', 'Drawing the land…');
await new Promise(r => setTimeout(r, 30));

const q = new URLSearchParams(location.search);
const game = new SunGame(MISSIONS.find(m => m.id === q.get('mission')) ?? MISSIONS[0]);
try {
  const saved = JSON.parse(localStorage.getItem('sun-best') ?? '{}');
  if (saved && typeof saved === 'object') game.bestSun = saved;
} catch { /* no storage */ }
const view = new SailView(game, $('app'), models);
const sunView = new SunView(game, view);
const sound = new Sound();
const roll = new RollSound();
goBtn.disabled = false;
goBtn.textContent = tr('Wypłyń (z dźwiękiem)', 'Set sail (with sound)');

let running = false;
goBtn.addEventListener('click', () => {
  sound.start(); roll.start(); $('start').remove();
  running = true; keys.clear();
  announce();
});

// ---------------------------------------------------------------- input
const keys = new Set<string>();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.repeat || !running) return;
  switch (e.code) {
    case 'KeyF': game.toggleAuto(); toast(game.yacht.auto ? tr('Q-1 trymuje szot', 'Q-1 trims the sheet') : tr('Szot ręcznie', 'Sheet by hand')); break;
    case 'KeyR': if (game.swap()) toast(game.yacht.gear === 'wheels' ? tr('Wolt zakłada płozy…', 'Wolt fits the runners…') : tr('Wolt zakłada koła…', 'Wolt fits the wheels…')); else toast(tr('Najpierw stań (Spacja)', 'Stop first (Space)')); break;
    case 'KeyC': game.cycleMission(); missionKey = ''; announce(); break;
    case 'KeyT': case 'Backspace': game.restartMission(); missionKey = ''; toast(tr('Od nowa', 'Restart')); break;
    case 'KeyH': helpOn = !helpOn; $('help').hidden = !helpOn; break;
    case 'KeyM': sound.toggleMute(); roll.toggleMute(); break;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', e => view.zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1), { passive: true });
let helpOn = true;

function input() {
  const k = (c: string) => keys.has(c);
  return {
    steer: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
    sheet: (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0),
    brake: k('Space'),
    hike: k('ShiftLeft') || k('ShiftRight'),
    motor: (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0),
  };
}

// ---------------------------------------------------------------- HUD
function toast(text: string, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
const fmt = (t: number) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };

function announce() {
  const m = game.delivery.mission;
  toast(`${m.name}: ${tr('odbierz', 'pick up')} ${m.cargo} ${tr('w punkcie A', 'at A')}`);
}

$('help').innerHTML = tr(
  '<b>A/D</b> ster · <b>W/S</b> szot · <b>F</b> Q-1 trymuje · <b>Shift</b> balast · <b>E</b> silnik Wolta (<b>Q</b> wstecz) · <b>Spacja</b> hamulec · <b>R</b> koła↔płozy · <b>C</b> następna misja · <b>T</b> od nowa · <b>kółko</b> zoom (oddal, żeby widzieć więcej cieni) · <b>H</b> ukryj',
  '<b>A/D</b> steer · <b>W/S</b> sheet · <b>F</b> Q-1 trims · <b>Shift</b> ballast · <b>E</b> Wolt’s motor (<b>Q</b> reverse) · <b>Space</b> brake · <b>R</b> wheels↔runners · <b>C</b> next mission · <b>T</b> restart · <b>wheel</b> zoom (pull out to see more shadows) · <b>H</b> hide');

// mission picker (bottom left)
let missionKey = '';
function missionPanel() {
  const d = game.delivery, m = d.mission;
  const key = JSON.stringify([m.id, d.phase, Math.floor(d.time), game.bestSun]);
  if (key === missionKey) return;
  missionKey = key;
  const btns = MISSIONS.map(x => `<button class="btn ${x === m ? 'on' : ''}" data-m="${x.id}">${x.name}</button>`).join('');
  const best = game.bestSun[m.id];
  $('mission').innerHTML = `<div class="lbl">${tr('MISJA', 'MISSION')}</div><div class="nav">${btns}</div>
    <div class="row big"><span>${d.phase === 'toPickup' || d.phase === 'loading' ? tr('do A', 'to A') : fmt(d.time)}</span><span class="dim">${tr('ładunek', 'load')}: ${m.cargo}</span></div>
    <div class="row dim"><span>${tr('rekord', 'best')}</span><span>${best !== undefined ? fmt(best) : '—'}</span></div>
    <p class="dim">${m.hint}</p>`;
}
$('mission').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  const m = MISSIONS.find(x => x.id === b.dataset.m);
  if (m) { game.setMission(m); missionKey = ''; announce(); }
  (b as HTMLButtonElement).blur();
});
$('mission').addEventListener('pointerdown', e => e.stopPropagation());

// speed and Wolt's battery (top left)
let speedKey = '';
function speedPanel() {
  const y = game.yacht;
  const key = JSON.stringify([Math.round(y.speed * 3.6), y.surface, y.gear, Math.round(y.energy * 100), y.capsized > 0, Math.round(y.tip * 10), y.thrust]);
  if (key === speedKey) return;
  speedKey = key;
  const tipPct = Math.min(1.2, Math.abs(y.tip)) / 1.2 * 100;
  $('speed').innerHTML = `<div class="spd"><b>${Math.round(y.speed * 3.6)}</b><span>km/h</span></div>
    <div class="row"><span class="dim">${tr('podłoże', 'ground')}</span><span>${SURFACES[y.surface].name}</span></div>
    <div class="row"><span class="dim">${tr('podwozie', 'gear')}</span><span>${y.gear === 'wheels' ? tr('koła', 'wheels') : tr('płozy', 'runners')}</span></div>
    <div class="lbl tipl"><span>${tr('PRZECHYŁ', 'HEEL')}</span><span>${y.capsized > 0 ? tr('wywrotka', 'capsized') : ''}</span></div>
    <div class="tipm ${Math.abs(y.tip) > 1 ? 'bad' : Math.abs(y.tip) > 0.8 ? 'hot' : ''}"><i style="width:${tipPct.toFixed(0)}%"></i><b></b></div>
    <div class="lbl tipl"><span>${tr('BATERIA WOLTA', 'WOLT’S BATTERY')}</span><span>${y.thrust ? tr('silnik', 'motor') + ' · ' : ''}${Math.round(y.energy * 100)}%</span></div>
    <div class="tipm enm ${y.energy < 0.15 ? 'bad' : ''}"><i style="width:${(y.energy * 100).toFixed(0)}%"></i></div>`;
}

// the load, the light and the shadow map (top right)
const mapC = document.createElement('canvas');
mapC.width = mapC.height = 216;
const mctx = mapC.getContext('2d')!;
const MAP_R = 130, MAP_N = 54;
let mapT = 99;
// the shade is sampled coarsely into a tiny image and scaled up smooth
const shadeC = document.createElement('canvas');
shadeC.width = shadeC.height = MAP_N;
const sctx = shadeC.getContext('2d')!;
const shadeImg = sctx.createImageData(MAP_N, MAP_N);
function drawMap(dt: number) {
  const y = game.yacht, W = mapC.width, k = W / (2 * MAP_R);
  mapT += dt;
  if (mapT > 0.2) {
    mapT = 0;
    for (let j = 0; j < MAP_N; j++) for (let i = 0; i < MAP_N; i++) {
      const x = y.x + ((i + 0.5) / MAP_N * 2 - 1) * MAP_R, z = y.y + ((j + 0.5) / MAP_N * 2 - 1) * MAP_R;
      const o = (j * MAP_N + i) * 4, sh = game.clouds.shadeAt(x, z);
      shadeImg.data[o] = 38; shadeImg.data[o + 1] = 46; shadeImg.data[o + 2] = 56; shadeImg.data[o + 3] = Math.round(sh * 0.85 * 255);
    }
    sctx.putImageData(shadeImg, 0, 0);
  }
  mctx.fillStyle = '#d9d0b4'; mctx.fillRect(0, 0, W, W);
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(shadeC, 0, 0, W, W);
  // the map's edge
  mctx.strokeStyle = '#00000055'; mctx.lineWidth = 1;
  mctx.strokeRect(W / 2 + (0 - y.x) * k, W / 2 + (0 - y.y) * k, 400 * k, 400 * k);
  const d = game.delivery;
  const dot = (p: { x: number; y: number }, col: string, label: string, on: boolean) => {
    let px = W / 2 + (p.x - y.x) * k, py = W / 2 + (p.y - y.y) * k;
    const out = px < 6 || py < 6 || px > W - 6 || py > W - 6;
    px = Math.max(6, Math.min(W - 6, px)); py = Math.max(6, Math.min(W - 6, py));
    mctx.globalAlpha = on ? 1 : 0.4;
    mctx.fillStyle = col; mctx.beginPath(); mctx.arc(px, py, out ? 4 : SUN.zone * k + 1, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#1b1a17'; mctx.font = '500 10px IBM Plex Mono, monospace'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.fillText(label, px, py + 0.5);
    mctx.globalAlpha = 1;
  };
  const toA = d.phase === 'toPickup' || d.phase === 'loading';
  dot(d.mission.a, '#f08c35', 'A', toA);
  dot(d.mission.b, '#7fd99a', 'B', !toA);
  // the yacht and the wind
  mctx.save(); mctx.translate(W / 2, W / 2); mctx.rotate(y.heading);
  mctx.fillStyle = '#1b1a17'; mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, 4); mctx.lineTo(-5, -4); mctx.closePath(); mctx.fill();
  mctx.restore();
  mctx.save(); mctx.translate(18, 18); mctx.rotate(game.wind.dir);
  mctx.strokeStyle = '#1b1a1799'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.moveTo(-9, 0); mctx.lineTo(9, 0); mctx.moveTo(9, 0); mctx.lineTo(4, -4); mctx.moveTo(9, 0); mctx.lineTo(4, 4); mctx.stroke();
  mctx.restore();
}

let loadKey = '';
function loadPanel() {
  const d = game.delivery, L = game.light;
  const carried = d.phase === 'carrying' || d.phase === 'unloading';
  const key = JSON.stringify([d.phase, Math.round(d.buffer * 10), Math.round(L * 20), Math.round(d.handling * 10)]);
  if (key !== loadKey) {
    loadKey = key;
    const frac = d.buffer / SUN.buffer;
    const rate = bufferRate(L);
    const state = d.phase === 'toPickup' ? tr('jedź do A i stań w kręgu', 'sail to A and stop in the ring')
      : d.phase === 'loading' ? tr('załadunek…', 'loading…')
        : d.phase === 'unloading' ? tr('rozładunek…', 'unloading…')
          : d.phase === 'done' ? `<span class="okc">${tr('dowiezione! C: następna misja', 'delivered! C: next mission')}</span>`
            : d.phase === 'failed' ? `<span class="limit">${d.mission.lost} ${tr('T: od nowa', 'T: try again')}</span>`
              : L >= SUN.need ? `<span class="okc">${tr('w słońcu: bufor się ładuje', 'in the sun: the buffer refills')}</span>`
                : `<span class="${frac < 0.3 ? 'limit' : 'tense'}">${tr('w cieniu! szukaj światła', 'in the shade! find the light')}</span>`;
    const lbl = carried ? tr('BUFOR ŁADUNKU', 'LOAD BUFFER') : tr('ŁADUNEK', 'LOAD');
    const val = carried ? `${num(d.buffer, 1)} s` : d.phase === 'done' ? '✓' : d.phase === 'failed' ? '✕' : '—';
    $('load').innerHTML = `<div class="lbl row"><span>${lbl}</span><span>${carried ? (rate >= 0 ? '+' : '') + num(rate, 1) + ' s/s' : ''}</span></div>
      <div class="big">${val}</div>
      <div class="bufm ${!carried ? '' : frac < 0.3 ? 'bad' : L < SUN.need ? 'hot' : ''}"><i style="width:${((carried ? frac : d.phase === 'failed' ? 0 : 1) * 100).toFixed(0)}%"></i></div>
      <div class="state">${state}</div>
      <div class="lbl row"><span>${tr('SŁOŃCE NA PANELACH', 'SUN ON THE PANELS')}</span><span>${Math.round(L * 100)}%</span></div>
      <div class="lightm"><i style="width:${(L * 100).toFixed(0)}%"></i><b style="left:${SUN.need * 100}%"></b></div>
      <div class="lbl">${tr('CIENIE CHMUR WOKÓŁ', 'CLOUD SHADOWS AROUND')}</div>`;
    $('load').appendChild(mapC);
  }
  ($('shadeVeil') as HTMLElement).style.opacity = String(Math.max(0, Math.min(1, (SUN.need - L) / (SUN.need - 0.12))) * 0.9);
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let t = 0, beep = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) {
    t += dt;
    const ev = game.update(dt, input());
    if (ev.capsized) { toast(tr('Wywrotka!', 'Capsized!'), 'bad'); view.kick(1); sound.play('deny'); sound.scrape(); }
    if (ev.bumped > 2) { view.kick(ev.bumped / 8); sound.scrape(); }
    if (ev.landed > 0.4) { view.kick(ev.landed / 2); sound.squeak(true, 1); }
    if (ev.swapped) { toast(game.yacht.gear === 'runners' ? tr('Płozy założone', 'Runners on') : tr('Koła założone', 'Wheels on')); sound.play('craft'); }
    if (ev.loaded) { toast(tr('Załadowane. Teraz do B, w słońcu!', 'Loaded. Now to B, in the sun!'), 'good'); sound.play('plug'); }
    if (ev.shade === true) { toast(tr('Cień! ładunek ciągnie z bufora', 'Shade! the load is on its buffer')); sound.play('unplug'); }
    if (ev.shade === false) sound.play('light');
    if (ev.lost) { toast(game.delivery.mission.lost, 'bad'); sound.play('deny'); }
    if (ev.delivered !== null) {
      toast(`${tr('Dowiezione', 'Delivered')}: ${fmt(ev.delivered)}${ev.record ? ' · ' + tr('rekord!', 'new best!') : ''}`, 'good');
      sound.play(ev.record ? 'win' : 'charged');
      try { localStorage.setItem('sun-best', JSON.stringify(game.bestSun)); } catch { /* no storage */ }
    }
    // a soft tick when the buffer is running low
    const d = game.delivery;
    beep -= dt;
    if (d.phase === 'carrying' && game.light < SUN.need && d.buffer < 6 && beep < 0) { sound.play('light'); beep = d.buffer < 3 ? 0.5 : 1; }
    const y = game.yacht;
    sound.update(dt, { humNear: Math.abs(y.thrust), wind: Math.min(1.4, y.app / 13), tension: Math.max(0, Math.min(1, (Math.abs(y.tip) - 0.7) * 3)) });
    roll.update(dt, y.speed, y.surface, y.capsized <= 0, y.capsized > 0 || y.swap > 0 ? 0 : Math.max(0, 1 - y.cn / 0.4), y.app);
    speedPanel(); loadPanel(); missionPanel(); drawMap(dt);
  }
  sunView.update(dt, t);
  view.update(dt, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?mission=<id> picks the mission, ?go skips the start card (links and screenshots)
if (q.has('go')) goBtn.click();
if (q.has('debug')) Object.assign(window, { sun: game, view });
