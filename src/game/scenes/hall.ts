import { Ctx, Scene } from '../scene';
import { Hall, BATTERY_POWER } from '../sim/hall';
import { HallView } from '../render/hallView';
import { NOTES, journal, noteHtml, journalHtml } from '../notes';
import { story } from '../state';

const LOG = '…TEST 4411…\n…STABILNY…\nNIE ODŁĄCZAĆ OD…';

/**
 * Scene 1. Hala pomiarowa: glue between the Hall logic, its 3D view, sound and HUD.
 * The HUD stays almost empty in reserve mode (just the flickering percentage); the
 * full panel (energy, temperature, humidity) appears with the battery.
 */
export class HallScene implements Scene {
  readonly id = 'hall';
  next: string | null = null;
  private hall = new Hall();
  private view!: HallView;
  private el!: HTMLDivElement;
  private pulse = 0;
  private nextPulse = 0.5;
  private logT = -1;
  private fadeIn = 1;
  private justOpened = false;
  private journalOpen = false;

  enter(c: Ctx) {
    this.view = new HallView(this.hall, c.app, c.models);
    (window as unknown as { hall: Hall }).hall = this.hall;
    c.sound.onDrip = () => this.view.ripple();
    c.fx.black = 1; c.fx.grain = 0.6; c.fx.lines = 0.6; c.fx.dot = { a: 0, r: 0 };
    c.sound.muffle = 1; c.sound.wind = 0.6;
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <div class="reserve" id="hReserve"></div>
      <div class="vitals" id="hVitals" hidden></div>
      <div class="htip" id="hTip" hidden></div>
      <div class="hmsg" id="hMsg" hidden></div>
      <div class="note" id="hNote" hidden></div>
      <div class="hkeys" id="hKeys"><b>WASD</b> ruch · <b>E</b> użyj · <b>J</b> archiwum</div>`;
    c.hud.appendChild(this.el);
  }

  exit(c: Ctx) {
    c.sound.onDrip = null;
    this.view.dispose();
    this.el.remove();
    c.fx.lines = 0;
  }

  update(dt: number, c: Ctx) {
    const h = this.hall, k = c.input.keys, pr = c.input.pressed;
    // reading a note: E, Esc or Space puts it down; J opens the journal
    if (h.reading && ['KeyE', 'Escape', 'Space'].some(x => pr.has(x)) && !this.justOpened) { h.closeNote(); pr.delete('KeyE'); }
    this.justOpened = false;
    if (pr.has('KeyJ')) {
      if (this.journalOpen || h.reading) { this.journalOpen = false; h.closeNote(); }
      else if (journal.list().length) this.journalOpen = true;
    }
    if (this.journalOpen) {
      if (pr.has('Escape')) this.journalOpen = false;
      const list = journal.list();
      for (let i = 0; i < Math.min(9, list.length); i++) if (pr.has('Digit' + (i + 1))) { this.journalOpen = false; h.reading = list[i].id; }
    }
    const mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    h.update(dt, {
      move: { x: mx, y: my }, run: k.has('ShiftLeft') || k.has('ShiftRight'),
      use: k.has('KeyE'), usePressed: c.input.pressed.has('KeyE'),
    });

    // heartbeat: slow and heavy on reserve, calmer and quieter with the battery in
    this.nextPulse -= dt;
    if (this.nextPulse <= 0) {
      c.sound.pulse(h.powered ? 0.35 : 0.8);
      this.pulse = 1;
      this.nextPulse = h.powered ? 2.6 : 1.7;
    }
    this.pulse = Math.max(0, this.pulse - dt * 1.5);

    for (const e of h.events) this.onEvent(e, c);
    h.events.length = 0;

    // the picture comes in from black (we arrive from the static of Scene 0)
    this.fadeIn = Math.max(0, this.fadeIn - dt / 2.5);
    const look = h.reserveLook();
    c.fx.black = this.fadeIn;
    c.fx.grain = 0.15 + look * 0.45;
    c.fx.lines = look * 0.55;
    c.sound.muffle = look;
    c.sound.wind = 0.6 + (h.doorOpen * 0.6);

    if (this.logT >= 0) {
      this.logT += dt;
      const on = this.logT < 0.25 ? (Math.random() < 0.5 ? 1 : 0.2) : this.logT < 2.4 ? 0.85 + Math.random() * 0.15 : this.logT < 2.7 ? Math.random() * 0.6 : 0;
      this.view.setScreen(on, LOG);
      if (this.logT > 2.8) this.logT = -1;
    }
    this.view.frame(dt, this.pulse);
    this.hud();
  }

  private onEvent(e: string, c: Ctx) {
    const s = c.sound;
    switch (e) {
      case 'stand': s.servo(1, 0.8); s.staticBurst(0.25, 0.05); break;
      case 'step': s.wheelCreak(this.hall.powered ? 0.5 : 1); if (!this.hall.powered && Math.random() < 0.3) s.servo(0.5, 0.9 + Math.random() * 0.2); break;
      case 'strain': s.servo(1.2, 0.6); break;
      case 'pickup': s.clank(1.6, 0.06); break;
      case 'pry': s.clank(0.8, 0.16); break;
      case 'open': s.creak(1); break;
      case 'take': s.servo(0.8, 1.1); break;
      case 'insert': s.clank(2.2, 0.05); s.swell(); c.fx.static = 0.8; break;
      case 'log': this.logT = 0; s.blip(0.8); setTimeout(() => s.blip(0.6), 180); break;
      case 'door': s.creak(1); s.clank(0.6, 0.12); break;
      case 'exit': story.battery = this.hall.battery; this.next = 'station'; break;
      case 'note': { const up = journal.add(this.hall.reading!); this.justOpened = true; s.blip(1.3); if (up) { this.hall.message = { text: `Korpus urósł. Odkodowano: ${up}. Stare zapisy w archiwum nabierają treści.`, t: this.hall.t }; setTimeout(() => s.swell(), 400); } break; }
    }
  }

  private hud() {
    const h = this.hall, $ = (id: string) => document.getElementById(id)!;
    const res = $('hReserve');
    res.hidden = h.powered || !h.awake && h.wake === 0 && h.t < 1;
    res.textContent = `REZERWA ${h.reserve.toFixed(1).replace('.', ',')}%`;
    res.style.opacity = String(0.5 + Math.random() * 0.4);
    const v = $('hVitals');
    v.hidden = !h.powered || h.poweredT < 1.5;
    if (!v.hidden) {
      v.style.opacity = String(Math.min(1, (h.poweredT - 1.5) / 1.5));
      v.innerHTML = `<div class="lbl">Q-1 · ${BATTERY_POWER} W</div>
        <div class="row"><span>energia</span><b>${h.battery.toFixed(0)}%</b></div><div class="bar"><i style="width:${h.battery}%"></i></div>
        <div class="row"><span>temperatura</span><b>9°C</b></div>
        <div class="row"><span>wilgotność</span><b>64%</b></div>`;
    }
    const hint = h.hint();
    const tip = $('hTip');
    tip.hidden = !hint;
    if (hint) {
      const p = this.view.project(hint.at, 1.4);
      tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px';
      tip.innerHTML = `<span class="k">${hint.key}</span>${hint.text}` + (hint.progress ? `<div class="prog"><i style="width:${Math.min(1, hint.progress) * 100}%"></i></div>` : '');
    }
    const msg = $('hMsg');
    msg.hidden = !h.message;
    if (h.message) msg.textContent = h.message.text;
    const note = $('hNote');
    if (h.reading) {
      const n = NOTES[h.reading];
      note.hidden = false;
      note.innerHTML = noteHtml(n);
    } else if (this.journalOpen) {
      note.hidden = false;
      note.innerHTML = journalHtml();
    } else note.hidden = true;
    $('hKeys').style.opacity = h.awake ? '0' : String(Math.min(0.6, h.t / 3));
  }
}
