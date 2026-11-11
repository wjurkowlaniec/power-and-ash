import '../style.css';
import './returns.css';
import { tr, langSwitch } from '../i18n';
import { loadModels, Models } from '../render/assets';
import { Returns } from './sim/returns';
import { ReturnsView } from './render/returnsView';

/**
 * Tech demo "Powroty" (Wojtek, 2026-11-11): the coherent world shown with pictures instead of
 * described mechanics. One homestead over the years; the player works out what things mean.
 */
const $ = (id: string) => document.getElementById(id)!;

$('startSub').textContent = tr('Tech demo · Powroty', 'Tech demo · Returns');
$('startText').innerHTML = tr(
  `<p>Jedna osada przez lata. W świecie nie ma napisów: co coś znaczy, trzeba zobaczyć samemu.</p>
   <p>Jedź, zrób coś, zaśnij, wróć i patrz, co się zmieniło.</p>
   <p class="keys"><span class="k">WASD</span>jazda <span class="k">E</span>działaj <span class="k">E przytrzymaj</span>śpij dłużej <span class="k">M</span>dźwięk</p>`,
  `<p>One homestead over the years. There is no writing in the world: what a thing means is for you to see.</p>
   <p>Drive, do something, sleep, come back and look at what changed.</p>
   <p class="keys"><span class="k">WASD</span>drive <span class="k">E</span>act <span class="k">hold E</span>sleep longer <span class="k">M</span>sound</p>`);
$('startSmall').textContent = tr('prototyp · logika w czystym TS, render Three.js · modele CC0: Kay Lousberg, Quaternius', 'prototype · logic in plain TS, Three.js rendering · CC0 models: Kay Lousberg, Quaternius');
$('start').querySelector('.card')!.appendChild(langSwitch());

const goBtn = $('go') as HTMLButtonElement;
goBtn.disabled = true;
goBtn.textContent = tr('Ładowanie modeli…', 'Loading models…');
let models: Models;
try { models = await loadModels((d, t) => { goBtn.textContent = tr(`Ładowanie modeli… ${d}/${t}`, `Loading models… ${d}/${t}`); }); } catch { models = new Map(); }

const game = new Returns();
const view = new ReturnsView(game, $('app'), models);
goBtn.disabled = false;
goBtn.textContent = tr('Obudź się (z dźwiękiem)', 'Wake up (with sound)');

// ---------------------------------------------------------------- sound: one tone per living light
class Chord {
  private ctx: AudioContext | null = null; private master!: GainNode; private gains: GainNode[] = [];
  muted = false;
  start() {
    if (this.ctx) return;
    try {
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain(); this.master.gain.value = 0.07; this.master.connect(ctx.destination);
      for (const f of [55, 220, 277.2, 329.6, 415.3]) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0;
        o.connect(g); g.connect(this.master); o.start(); this.gains.push(g);
      }
    } catch { this.ctx = null; }
  }
  /** on[0] is the drone; the rest are the homestead and the three far windows. */
  set(on: boolean[]) { this.gains.forEach((g, i) => { g.gain.value += ((on[i] ? (i ? 0.3 : 0.5) : 0) - g.gain.value) * 0.02; }); }
  blip(f: number, d: number) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master); o.start(); o.stop(t + d);
  }
  toggle() { this.muted = !this.muted; if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.07; }
}
const chord = new Chord();

let running = false;
goBtn.addEventListener('click', () => { chord.start(); $('start').remove(); running = true; keys.clear(); });

// ---------------------------------------------------------------- input
const keys = new Set<string>();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyM' && !e.repeat) chord.toggle();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
for (const [id, code] of [['pu', 'KeyW'], ['pd', 'KeyS'], ['pl', 'KeyA'], ['pr', 'KeyD'], ['pa', 'KeyE']] as const) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(code); });
  for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(n, () => keys.delete(code));
}
const down = (...c: string[]) => c.some(k => keys.has(k));

// ---------------------------------------------------------------- sleep: darkness and a scratch for every year
const night = $('night') as HTMLCanvasElement, nc = night.getContext('2d')!;
let fade = 0;
function drawNight(n: number) {
  const w = night.width = innerWidth, h = night.height = innerHeight;
  nc.fillStyle = '#0c0f10'; nc.fillRect(0, 0, w, h);
  nc.strokeStyle = 'rgba(206,212,202,.85)'; nc.lineWidth = 3; nc.lineCap = 'round';
  const per = 10, sp = 20, x0 = w / 2 - Math.min(n, per) * sp / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i % per) * sp, cy = h / 2 - 30 + Math.floor(i / per) * 52;
    nc.beginPath();
    if (i % 5 === 4) { nc.moveTo(cx - sp * 4 - 8, cy + 30); nc.lineTo(cx - 6, cy + 4); } else { nc.moveTo(cx, cy); nc.lineTo(cx + 1, cy + 34); }
    nc.stroke();
  }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running) {
    const mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
    const my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
    // the screen goes dark first, then the years start to pass
    const asleep = !!game.sleep;
    fade += ((asleep ? 1 : 0) - fade) * Math.min(1, dt * (asleep ? 5 : 1.6));
    const evs = asleep && fade < 0.9 ? [] : game.update(dt, { mx, my, act: down('KeyE', 'Space') });
    for (const e of evs) {
      if (e === 'fix') { chord.blip(520, 0.4); chord.blip(780, 0.7); }
      else if (e === 'year') chord.blip(900, 0.05);
    }
    if (fade > 0.01) drawNight(game.sleep?.n ?? 0);
    night.style.opacity = String(Math.min(1, fade * 1.1));
    chord.set([true, game.windowLit, game.farLit(0), game.farLit(1), game.farLit(2)]);
  }
  view.update(running ? dt : 0);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// for automated screenshots and tuning
Object.assign(window, { __returns: game, __view: view });
