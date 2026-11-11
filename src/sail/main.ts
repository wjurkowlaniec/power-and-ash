import '../style.css';
import './sail.css';
import { tr, num, langSwitch } from '../i18n';
import { loadModels, Models } from '../render/assets';
import { Sound } from '../audio/ambient';
import { loadCraftModels } from '../craft/render/craftModels';
import { SailGame } from './sim/sailGame';
import { SURFACES } from './sim/terrain';
import { COURSES, EXAM } from './sim/courses';
import { Training, LESSONS } from './sim/training';
import { SailView } from './render/sailView';
import { CART_MODELS } from './render/yachtRig';
import { RollSound } from './rollSound';
import { Intro } from './intro';

/**
 * Tech demo "Żegluga": sailing the land yacht across the ash country. Core gameplay
 * prototype: feel the wind, read the gusts on the ground, use the shelter of the houses,
 * swap wheels for runners for the dunes, beat your times on the courses.
 */
const $ = (id: string) => document.getElementById(id)!;
const n1 = (v: number, d = 1) => num(v, d);
const deg = (a: number) => Math.round(a * 180 / Math.PI);

$('startSub').textContent = tr('Tech demo · Żegluga Żaglowozem', 'Tech demo · Land yacht sailing');
$('startText').innerHTML = tr(
  `<p>Wolt wczepiony w dziób Żaglowozu jest jego przednim kołem: skręca, a gdy wiatr siądzie, pcha silnikiem z baterii. Przed nim popielna kraina: stara szosa, solnisko, wydmy, wieś w ruinie i martwy las. Wiatr nie jest wszędzie taki sam. Szkwały widać na popiele jako ciemne, biegnące zmarszczki, za domami wiatr siada i szarpie.</p>
   <p>Trymuj szot do kąta wiatru, łap szkwały, uważaj, żeby nie położyć się na bok. Na sypkim popiele koła grzęzną, płozy suną. Pływaj swobodnie albo jedź trasy na czas.</p>
   <p class="keys"><span class="k">A/D</span>ster <span class="k">W/S</span>szot <span class="k">F</span>Q-1 trymuje <span class="k">Shift</span>balast <span class="k">E</span>silnik <span class="k">Spacja</span>hamulec <span class="k">R</span>koła/płozy <span class="k">C</span>trasa</p>`,
  `<p>Wolt, docked in the bow of the land yacht, is its front wheel: he steers, and when the wind dies he pushes with his motor off the battery. The ash country ahead: an old road, a salt pan, dunes, a ruined village and a dead wood. The wind is not the same everywhere. Gusts show on the ash as dark running ripples; behind the houses the wind drops and tugs.</p>
   <p>Trim the sheet to the wind, catch the gusts, try not to tip over. On loose ash the wheels sink and the runners glide. Sail freely or race the courses.</p>
   <p class="keys"><span class="k">A/D</span>steer <span class="k">W/S</span>sheet <span class="k">F</span>Q-1 trims <span class="k">Shift</span>ballast <span class="k">E</span>motor <span class="k">Space</span>brake <span class="k">R</span>wheels/runners <span class="k">C</span>course</p>`);
$('startSmall').textContent = tr('prototyp · fizyka i wiatr w czystym TS, render Three.js · modele CC0: Kay Lousberg, Quaternius', 'prototype · physics and wind in plain TS, Three.js rendering · CC0 models: Kay Lousberg, Quaternius');
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

const game = new SailGame();
try {
  const saved = JSON.parse(localStorage.getItem('sail-best') ?? '{}');
  if (saved && typeof saved === 'object') game.best = saved;
} catch { /* no storage */ }
const view = new SailView(game, $('app'), models);
const sound = new Sound();
const roll = new RollSound();
goBtn.disabled = false;
goBtn.textContent = tr('Wypłyń (z dźwiękiem)', 'Set sail (with sound)');

let running = false;
const intro = new Intro();
let training: Training | null = null;
const licence = () => { try { return localStorage.getItem('sail-licence') === '1'; } catch { return false; } };
let first = true;
const sail = () => {
  running = true; keys.clear();
  // the first time, Wolt has to learn it: Q-1 runs the lessons in his head (skippable)
  const q = new URLSearchParams(location.search);
  if (first && (q.has('train') || (!licence() && !q.has('go') && !q.has('course')))) startTraining(q.get('train') === 'exam' ? LESSONS.length : 0);
  first = false;
};
function startTraining(at = 0) {
  training = new Training(game);
  if (at) training.go(at);
  document.body.classList.add('sim');
  courseKey = ''; lessonKey = '';
  toast(tr('Symulator Q-1: nauka żeglugi', 'Q-1 simulator: learning to sail'));
}
function endTraining() {
  training = null;
  game.wind.strength = WINDS[windLevel].k;
  document.body.classList.remove('sim');
  $('lesson').hidden = true; courseKey = ''; lessonKey = '';
}
goBtn.addEventListener('click', () => {
  sound.start(); roll.start(); $('start').remove();
  if (new URLSearchParams(location.search).has('go')) sail();
  else { game.arrive(); intro.show(sail); } // the first thing you see: Wolt rides in and locks on
});

// ---------------------------------------------------------------- input
const keys = new Set<string>();
addEventListener('keydown', e => {
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  if (!running) return;
  switch (e.code) {
    case 'KeyI': running = false; intro.show(sail); break;
    case 'KeyF': game.toggleAuto(); toast(game.yacht.auto ? tr('Q-1 trymuje szot', 'Q-1 trims the sheet') : tr('Szot ręcznie', 'Sheet by hand')); break;
    case 'KeyR': if (game.swap()) toast(game.yacht.gear === 'wheels' ? tr('Wolt zakłada płozy…', 'Wolt fits the runners…') : tr('Wolt zakłada koła…', 'Wolt fits the wheels…')); else toast(tr('Najpierw stań (Spacja)', 'Stop first (Space)')); break;
    case 'KeyG': if (game.dock()) toast(game.yacht.docking > 0 ? tr('Wolt wczepia się w dziób…', 'Wolt docks into the bow…') : tr('Wolt odczepia się…', 'Wolt lets go…')); else toast(tr('Najpierw stań (Spacja)', 'Stop first (Space)')); break;
    case 'KeyC': if (training) break; game.cycleCourse(); courseKey = ''; announceCourse(); break;
    case 'KeyN': if (training && !training.passed && !training.exam) { training.go(training.index + 1); lessonKey = ''; } break;
    case 'Escape': if (training) { endTraining(); game.setCourse(null); toast(tr('Symulator wyłączony. Wrócisz do niego z panelu trasy.', 'Simulator off. You can return to it from the course panel.')); } break;
    case 'KeyT': case 'Backspace': if (training && !training.exam) { training.go(training.index); lessonKey = ''; } else if (game.run) { game.restart(); toast(tr('Od nowa', 'Restart')); } break;
    case 'KeyV': windLevel = (windLevel + 1) % WINDS.length; game.wind.strength = WINDS[windLevel].k; toast(WINDS[windLevel].name); break;
    case 'KeyH': helpOn = !helpOn; $('help').hidden = !helpOn; break;
    case 'KeyM': sound.toggleMute(); roll.toggleMute(); break;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', e => view.zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1), { passive: true });

const WINDS = [
  { k: 0.7, name: tr('Wiatr: słaby', 'Wind: light') },
  { k: 1, name: tr('Wiatr: zwykły', 'Wind: normal') },
  { k: 1.35, name: tr('Wiatr: mocny', 'Wind: strong') },
];
let windLevel = 1;
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

function announceCourse() {
  const r = game.run;
  toast(r ? `${r.course.name}: ${r.course.hint}` : tr('Swobodna żegluga', 'Free sailing'));
  if (r && r.course.gear !== game.yacht.gear) toast(r.course.gear === 'runners' ? tr('Tu lepsze płozy (R)', 'Runners work better here (R)') : tr('Tu lepsze koła (R)', 'Wheels work better here (R)'));
}

$('help').innerHTML = tr(
  '<b>I</b> intro · <b>A/D</b> ster · <b>W/S</b> wybierz/luzuj szot · <b>F</b> Q-1 trymuje · <b>Shift</b> balast na nawietrzną · <b>E</b> silnik Wolta (<b>Q</b> wstecz) · <b>Spacja</b> hamulec (ładuje baterię) · <b>R</b> koła↔płozy · <b>G</b> odczep/wczep Wolta · <b>C</b> trasa · <b>N</b> pomiń lekcję · <b>Esc</b> wyjdź z symulatora · <b>T</b> od nowa · <b>V</b> siła wiatru · <b>kółko</b> zoom (z bliska widać olinowanie) · <b>H</b> ukryj',
  '<b>I</b> intro · <b>A/D</b> steer · <b>W/S</b> haul in/ease the sheet · <b>F</b> Q-1 trims · <b>Shift</b> ballast to windward · <b>E</b> Wolt’s motor (<b>Q</b> reverse) · <b>Space</b> brake (charges the battery) · <b>R</b> wheels↔runners · <b>G</b> undock/dock Wolt · <b>C</b> course · <b>N</b> skip a lesson · <b>Esc</b> leave the simulator · <b>T</b> restart · <b>V</b> wind strength · <b>wheel</b> zoom (up close you see the rigging) · <b>H</b> hide');

// the lesson panel
let lessonKey = '';
function lessonPanel() {
  const t = training;
  if (!t) return;
  const key = JSON.stringify([t.index, Math.round(t.progress * 50), t.passed, t.exam ? Math.ceil(t.left) : 0, t.tries]);
  if (key === lessonKey) return;
  lessonKey = key;
  const el = $('lesson');
  el.hidden = false;
  const head = `<div class="lbl">${tr('SYMULATOR Q-1 · NAUKA ŻEGLUGI', 'Q-1 SIMULATOR · LEARNING TO SAIL')} · ${Math.min(t.count, t.index + 1)}/${t.count}</div>`;
  const bar = `<div class="bar ${t.progress >= 1 ? 'done' : ''}"><i style="width:${(t.progress * 100).toFixed(0)}%"></i></div>`;
  if (t.passed) {
    el.innerHTML = `${head}<h3>${tr('Zdane. Wolt umie żeglować.', 'Passed. Wolt can sail.')}</h3>
      <p>${tr('Symulacja się kończy, popiół jest prawdziwy. Od teraz płyniesz, dokąd chcesz, a trasy na czas czekają w panelu.', 'The simulation ends; the ash is real. From now on you sail where you like, and the timed courses wait in the panel.')}</p>${bar}
      <div class="nav"><span></span><button class="btn on" data-a="end">${tr('Wypłyń naprawdę', 'Sail for real')}</button></div>`;
  } else if (t.exam) {
    const started = game.run?.time !== null && game.run?.time !== undefined;
    el.innerHTML = `${head}<h3>${EXAM.name}</h3><p>${EXAM.hint}</p>
      <div class="row"><span class="clock ${t.left < 20 ? 'limit' : ''}">${fmt(Math.max(0, t.left))}</span><span class="dim">${started ? tr('zostało', 'left') : tr('zegar ruszy na pierwszej bramce', 'the clock starts at the first gate')} · ${tr('podejście', 'attempt')} ${t.tries}</span></div>${bar}
      <div class="nav"><span class="dim">${tr('T od nowa', 'T restart')}</span><button class="btn" data-a="end">${tr('wyjdź (Esc)', 'leave (Esc)')}</button></div>`;
  } else {
    const l = t.lesson!;
    el.innerHTML = `${head}<h3>${l.title}${t.progress >= 1 ? ' ✓' : ''}</h3><p>${l.text}</p>${bar}
      <div class="nav"><span class="dim">${tr('T od nowa', 'T restart')}</span><span><button class="btn" data-a="skip">${tr('pomiń lekcję (N)', 'skip the lesson (N)')}</button> <button class="btn" data-a="end">${tr('wyjdź (Esc)', 'leave (Esc)')}</button></span></div>`;
  }
}
$('lesson').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !training) return;
  if (b.dataset.a === 'skip') { training.go(training.index + 1); lessonKey = ''; }
  else { const passed = training.passed; endTraining(); if (!passed) game.setCourse(null); }
  (b as HTMLButtonElement).blur();
});
$('lesson').addEventListener('pointerdown', e => e.stopPropagation());

// the course picker
let courseKey = '';
function coursePanel() {
  const r = game.run;
  const key = JSON.stringify([r?.course.id, r?.next, r ? Math.floor((r.time ?? -1) * 10) : 0, r?.done, game.best]);
  if (key === courseKey) return;
  courseKey = key;
  const btns = [`<button class="btn ${!r ? 'on' : ''}" data-c="">${tr('swobodnie', 'free')}</button>`]
    .concat(COURSES.map(c => `<button class="btn ${r?.course === c ? 'on' : ''}" data-c="${c.id}">${c.name}</button>`))
    .concat(`<button class="btn ${training ? 'on' : ''}" data-c="train">${tr('szkolenie', 'lessons')}</button>`).join('');
  let body = '';
  if (r) {
    const n = r.course.gates.length;
    const best = game.best[r.course.id];
    const t = r.time;
    body = `<div class="row big"><span>${t === null ? tr('do startu', 'to the start') : fmt(t)}</span><span class="dim">${r.done ? tr('meta', 'finish') : `${tr('bramka', 'gate')} ${Math.min(n, r.next + 1)}/${n}`}</span></div>
      <div class="row dim"><span>${tr('rekord', 'best')}</span><span>${best !== undefined ? fmt(best) : '—'}</span></div>${r.course.limit ? `<div class="row dim"><span>${tr('limit', 'limit')}</span><span>${fmt(r.course.limit)}</span></div>` : ''}
      <p class="dim">${r.course.hint}</p>`;
  } else body = `<p class="dim">${tr('Płyń, gdzie chcesz. Trasy na czas: wybierz wyżej albo C.', 'Sail anywhere. For a timed course pick one above or press C.')}</p>`;
  $('course').innerHTML = `<div class="lbl">${tr('TRASA', 'COURSE')}</div><div class="nav">${btns}</div>${body}`;
}
$('course').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  if (b.dataset.c === 'train') { if (training) endTraining(); startTraining(); (b as HTMLButtonElement).blur(); return; }
  if (training) endTraining();
  const c = COURSES.find(x => x.id === b.dataset.c) ?? null;
  game.setCourse(c); courseKey = ''; announceCourse();
  (b as HTMLButtonElement).blur();
});
$('course').addEventListener('pointerdown', e => e.stopPropagation());

// speed, wind and trim
let hudKey = '';
function hud() {
  const y = game.yacht, w = game.here;
  const key = JSON.stringify([Math.round(y.speed * 10), Math.round(y.app), Math.round(w.speed * 2), deg(y.heading), deg(y.boom), deg(y.best), deg(y.appDir), deg(game.wind.dir), y.auto, y.gear, Math.round(y.tip * 20), y.surface, Math.round(w.shadow * 5), Math.round(w.gust * 5), y.capsized > 0, Math.ceil(y.swap), y.sliding, y.dock < 1, y.docking, Math.round(y.energy * 100), Math.round(y.thrust * 4), y.regen, Math.round(y.ballast * 4)]);
  if (key === hudKey) return;
  hudKey = key;
  // the compass: north up like the map; the hull points along the heading
  const R = 52, C = 60;
  const P = (a: number, r: number) => `${(C + Math.cos(a) * r).toFixed(1)},${(C + Math.sin(a) * r).toFixed(1)}`;
  const arrow = (to: number, color: string, wd: number) => `<line x1="${P(to + Math.PI, R - 4).replace(',', '" y1="')}" x2="${P(to, R - 14).replace(',', '" y2="')}" stroke="${color}" stroke-width="${wd}"/><polygon points="${P(to, R - 6)} ${P(to + 0.18, R - 17)} ${P(to - 0.18, R - 17)}" fill="${color}"/>`;
  const from = game.wind.dir + Math.PI, nogo = 0.75;
  const h = y.heading;
  const hull = [P(h, 26), `${(C + Math.cos(h + 2.75) * 19).toFixed(1)},${(C + Math.sin(h + 2.75) * 19).toFixed(1)}`, `${(C + Math.cos(h - 2.75) * 19).toFixed(1)},${(C + Math.sin(h - 2.75) * 19).toFixed(1)}`].join(' ');
  const mx = C + Math.cos(h) * 8, my = C + Math.sin(h) * 8;
  const boomEnd = (b: number) => { const a = h + Math.PI - y.side * b; return `${(mx + Math.cos(a) * 28).toFixed(1)}" y2="${(my + Math.sin(a) * 28).toFixed(1)}`; };
  const svg = `<svg viewBox="0 0 120 120" width="120" height="120">
    <circle cx="${C}" cy="${C}" r="${R}" fill="#0000" stroke="#ffffff22"/>
    <text x="${C}" y="10" fill="#ffffff55" font-size="8" text-anchor="middle">N</text>
    <path d="M${C},${C} L${P(from - nogo, R)} A${R},${R} 0 0 1 ${P(from + nogo, R)} Z" fill="#e0705a22"/>
    ${arrow(game.wind.dir, '#ffffff55', 1.5)}${arrow(y.appDir, '#bfe6ef', 2)}
    <polygon points="${hull}" fill="#c9c3b6" opacity=".85"/>
    <line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${boomEnd(y.best)}" stroke="#7fd99a" stroke-width="2" stroke-dasharray="3 3"/>
    <line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${boomEnd(y.boom)}" stroke="#e8a64e" stroke-width="3"/>
    <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3" fill="#1e2022" stroke="#e8a64e"/>
  </svg>`;
  const trim = y.capsized > 0 ? `<span class="limit">${tr('wywrotka! Wolt stawia go na koła…', 'capsized! Wolt is righting it…')}</span>`
    : y.dock < 1 ? `<span class="tense">${y.docking > 0 ? tr('Wolt wczepia się…', 'Wolt is docking…') : y.docking < 0 ? tr('Wolt odczepia się…', 'Wolt is letting go…') : tr('Wolt odczepiony: G wczepia', 'Wolt is clear: G docks')}</span>`
      : y.swap > 0 ? `<span class="tense">${y.gear === 'wheels' ? tr('zakładanie płóz…', 'fitting the runners…') : tr('zakładanie kół…', 'fitting the wheels…')} ${Math.ceil(y.swap)} s</span>`
      : Math.abs(y.tip) > 1 || Math.abs(y.heel) > 0.02 ? `<span class="limit">${tr('unosi się! luzuj (S), odpadnij (A/D), balast (Shift)', 'lifting! ease (S), bear away (A/D), ballast (Shift)')}</span>`
        : y.betaTrue < nogo ? `<span class="limit">${tr('martwy kąt: wiatr w dziób, odpadnij', 'in irons: wind dead ahead, bear away')}</span>`
          : y.auto ? `<span class="okc">${tr('Q-1 trymuje szot', 'Q-1 trims the sheet')}</span>`
            : y.cn < 0.25 ? `<span class="tense">${tr('żagiel łopocze: wybierz (W)', 'the sail is flapping: haul in (W)')}</span>`
              : y.sheet < y.best - 0.15 ? `<span class="tense">${tr('za ciasno: ciągnie w bok, poluzuj (S)', 'too tight: pulls sideways, ease (S)')}</span>`
                : y.sheet > y.best + 0.15 ? `<span class="tense">${tr('za luźno: wybierz (W)', 'too loose: haul in (W)')}</span>`
                  : `<span class="okc">${tr('żagiel pracuje', 'the sail is drawing')}</span>`;
  const tipPct = Math.min(1.2, Math.abs(y.tip)) / 1.2 * 100;
  const tipCls = Math.abs(y.tip) > 1 ? 'bad' : Math.abs(y.tip) > 0.8 ? 'hot' : '';
  const motorNote = y.thrust ? `<span class="okc">${y.thrust > 0 ? tr('silnik pcha', 'motor pushing') : tr('wstecz', 'reverse')}</span> · `
    : y.regen ? `<span class="okc">${tr('odzysk', 'charging')}</span> · ` : '';
  const here = w.shadow > 0.35 ? tr('cień wiatrowy', 'wind shadow') : w.gust > 0.25 ? tr('szkwał', 'gust') : w.gust < -0.2 ? tr('flauta', 'lull') : '';
  $('speed').innerHTML = `<div class="spd"><b>${Math.round(y.speed * 3.6)}</b><span>km/h</span></div>
    <div class="row dim"><span>${n1(y.speed)} m/s</span><span>${y.sliding ? `<span class="tense">${tr('poślizg', 'sliding')}</span>` : ''}</span></div>
    <div class="row"><span class="dim">${tr('podłoże', 'ground')}</span><span>${SURFACES[y.surface].name}</span></div>
    <div class="row"><span class="dim">${tr('podwozie', 'gear')}</span><span>${y.gear === 'wheels' ? tr('koła', 'wheels') : tr('płozy', 'runners')}</span></div>
    <div class="lbl tipl"><span>${tr('PRZECHYŁ', 'HEEL')}</span><span>${Math.abs(deg(y.heel))}°</span></div>
    <div class="tipm ${tipCls}"><i style="width:${tipPct.toFixed(0)}%"></i><b></b></div>
    <div class="lbl tipl"><span>${tr('BALAST', 'BALLAST')}</span><span>${Math.abs(y.ballast) < 0.05 ? tr('środek', 'middle') : (y.ballast * y.side > 0 ? tr('zawietrzna!', 'leeward!') : tr('nawietrzna', 'windward'))}</span></div>
    <div class="balm ${y.ballast * y.side > 0.05 ? 'bad' : ''}"><i style="left:${(50 + y.ballast * 44).toFixed(0)}%"></i></div>
    <div class="lbl tipl"><span>${tr('BATERIA', 'BATTERY')}</span><span>${motorNote}${Math.round(y.energy * 100)}%</span></div>
    <div class="tipm enm ${y.energy < 0.15 ? 'bad' : ''}"><i style="width:${(y.energy * 100).toFixed(0)}%"></i></div>`;
  $('wind').innerHTML = `<div class="cmp">${svg}<div class="rd">
      <div class="row"><span class="dim">${tr('wiatr tu', 'wind here')}</span><b>${n1(w.speed)} m/s</b></div>
      <div class="row"><span class="dim">${tr('pozorny', 'apparent')}</span><b>${n1(y.app)} m/s</b></div>
      <div class="row"><span class="dim">${tr('kąt do wiatru', 'off the wind')}</span><b>${deg(y.betaTrue)}°</b></div>
      <div class="row"><span class="dim">${tr('bom / najlepiej', 'boom / best')}</span><b>${deg(y.boom)}° / ${deg(y.best)}°</b></div>
      <div class="here">${here}</div>
    </div></div>
    <div class="trim">${trim}</div>
    <div class="dim legend"><i style="background:#bfe6ef"></i>${tr('pozorny', 'apparent')} <i style="background:#ffffff77"></i>${tr('rzeczywisty', 'true')} <i style="background:#e8a64e"></i>${tr('bom', 'boom')} <i style="background:#7fd99a"></i>${tr('najlepszy', 'best')}</div>`;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let t = 0;
let creak = 0;
let motorWas = false;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) {
    t += dt;
    const inp = input();
    const ev = game.update(dt, inp);
    if (ev.capsized) { toast(tr('Wywrotka!', 'Capsized!'), 'bad'); view.kick(1); sound.play('deny'); sound.scrape(); }
    if (ev.bumped > 2) { view.kick(ev.bumped / 8); sound.scrape(); }
    if (ev.landed > 0.4) { view.kick(ev.landed / 2); sound.squeak(true, 1); }
    if (ev.docked > 0) { toast(tr('Wolt wczepiony: jest przednim kołem', 'Wolt locked in: he is the front wheel'), 'good'); sound.play('plug'); view.kick(0.25); }
    if (ev.docked < 0) { toast(tr('Wolt odczepiony. Żaglowóz stoi na podpórkach (G wczepia)', 'Wolt is clear. The yacht stands on its props (G docks)')); sound.play('light'); }
    if (ev.swapped) { toast(game.yacht.gear === 'runners' ? tr('Płozy założone', 'Runners on') : tr('Koła założone', 'Wheels on')); sound.play('craft'); }
    if (ev.gate >= 0) {
      if (ev.gate === 0) { toast(tr('Start!', 'Go!')); sound.play('plug'); }
      else if (ev.finished === null) sound.play('light');
    }
    if (ev.finished !== null) {
      const lim = game.run?.course.limit;
      toast(`${tr('Meta', 'Finish')}: ${fmt(ev.finished)}${ev.record ? ' · ' + tr('rekord!', 'new best!') : ''}${lim ? ' · ' + (ev.finished <= lim ? tr('w limicie', 'inside the limit') : tr('po czasie', 'over the limit')) : ''}`, ev.record ? 'good' : '');
      sound.play(ev.record ? 'win' : 'charged');
      try { localStorage.setItem('sail-best', JSON.stringify(game.best)); } catch { /* no storage */ }
    }
    // the wind roars with the apparent wind; the frame groans near the tipping point
    const y = game.yacht;
    sound.update(dt, { humNear: Math.abs(y.thrust), wind: Math.min(1.4, y.app / 13), tension: Math.max(0, Math.min(1, (Math.abs(y.tip) - 0.7) * 3)) });
    roll.update(dt, y.speed, y.surface, y.capsized <= 0, y.capsized > 0 || y.swap > 0 ? 0 : Math.max(0, 1 - y.cn / 0.4), y.app);
    creak -= dt;
    if (creak < 0 && Math.abs(y.tip) > 0.75 && y.speed > 3) { sound.squeak(false, Math.abs(y.tip)); creak = 0.6 + Math.random(); }
    // the motor asked for and nothing happens: say why, once per press
    if (inp.motor && !motorWas) {
      if (y.gear === 'runners') toast(tr('Na płozach koło Wolta stoi w płozie: silnik nie pcha', "On runners Wolt's wheel sits in a runner: the motor cannot push"));
      else if (y.energy <= 0) toast(tr('Bateria pusta: hamuj z górki albo łap wiatr', 'Battery empty: brake downhill or find the wind'), 'bad');
    }
    motorWas = !!inp.motor;
    if (training) {
      const te = training.step(dt, inp, ev);
      if (te === 'next') { sound.play('light'); toast(`${tr('Lekcja', 'Lesson')} ${training.index + 1}: ${training.lesson!.title}`); }
      else if (te === 'exam') { sound.play('plug'); toast(tr('Egzamin: z A do B pod wiatr, na czas', 'The exam: from A to B upwind, against the clock'), 'good'); courseKey = ''; }
      else if (te === 'failed') { sound.play('deny'); toast(tr('Po czasie. Jeszcze raz od startu.', 'Out of time. Again from the start.'), 'bad'); courseKey = ''; }
      else if (te === 'passed') { sound.play('win'); toast(tr('Egzamin zdany: żegluga lądowa opanowana', 'Exam passed: land sailing learned'), 'good'); try { localStorage.setItem('sail-licence', '1'); } catch { /* no storage */ } }
      lessonPanel();
    }
    hud(); coursePanel();
  }
  view.update(dt, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?course=<id> starts on a course, ?go skips the start card (links and screenshots)
const q = new URLSearchParams(location.search);
const qc = COURSES.find(c => c.id === q.get('course'));
if (qc) game.setCourse(qc);
if (q.has('go') || q.has('intro')) goBtn.click();
if (q.has('debug')) Object.assign(window, { sail: game, view });
