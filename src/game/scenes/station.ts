import { Ctx, Scene } from '../scene';
import { Station, WOLT_POWER, FAB_POWER, TURBINE_POWER, MACHINE_POWER, Flow } from '../sim/station';
import { StationView } from '../render/stationView';
import { NOTES, journal, noteHtml, journalHtml } from '../notes';
import { story } from '../state';

/**
 * Scene 2. Martwa stacja: the first daylight. Glue between the Station logic, its
 * 3D view, sound and HUD. Same HUD pieces as the hall (vitals, tip, message, notes).
 */
export class StationScene implements Scene {
  readonly id = 'station';
  next: string | null = null;
  private st = new Station(story.battery);
  private view!: StationView;
  private el!: HTMLDivElement;
  private fadeIn = 1;
  private doneT = -1;
  private justOpened = false;
  private journalOpen = false;
  private towAcc = 0;

  enter(c: Ctx) {
    this.view = new StationView(this.st, c.app, c.models);
    (window as unknown as { station: Station }).station = this.st;
    c.fx.black = 1; c.fx.grain = 0.15; c.fx.lines = 0; c.fx.dot = { a: 0, r: 0 };
    c.sound.muffle = 0; c.sound.wind = 1.1;
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <div class="lcol"><div class="vitals" id="sVitals"></div><div class="goal" id="sGoal"></div></div>
      <div class="grid" id="sGrid" hidden></div>
      <div class="htip" id="sTip" hidden></div>
      <div class="hmsg" id="sMsg" hidden></div>
      <div class="note" id="sNote" hidden></div>
      <div class="hkeys" id="sKeys"><b>WASD</b> ruch · <b>E</b> użyj · <b>J</b> archiwum</div>`;
    c.hud.appendChild(this.el);
  }

  exit(c: Ctx) {
    this.view.dispose();
    this.el.remove();
    c.sound.wind = 0.6;
  }

  update(dt: number, c: Ctx) {
    const st = this.st, k = c.input.keys, pr = c.input.pressed;
    if (st.reading && ['KeyE', 'Escape', 'Space'].some(x => pr.has(x)) && !this.justOpened) { st.closeNote(); pr.delete('KeyE'); }
    this.justOpened = false;
    if (pr.has('KeyJ')) {
      if (this.journalOpen || st.reading) { this.journalOpen = false; st.closeNote(); }
      else if (journal.list().length) this.journalOpen = true;
    }
    if (this.journalOpen) {
      if (pr.has('Escape')) this.journalOpen = false;
      const list = journal.list();
      for (let i = 0; i < Math.min(9, list.length); i++) if (pr.has('Digit' + (i + 1))) { this.journalOpen = false; st.reading = list[i].id; }
    }
    const busy = !!st.reading || this.journalOpen;
    const mx = busy ? 0 : (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const my = busy ? 0 : (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    st.update(dt, {
      move: { x: mx, y: my }, run: k.has('ShiftLeft') || k.has('ShiftRight'),
      use: !busy && k.has('KeyE'), usePressed: !busy && pr.has('KeyE'), drop: !busy && pr.has('KeyQ'),
    });
    for (const e of st.events) this.onEvent(e, c);
    st.events.length = 0;

    // the tyre scrapes over the ash while it is pulled
    if (st.towing && st.towTaut && st.moving) {
      this.towAcc += dt;
      if (this.towAcc > (st.bearingOnTyre ? 0.32 : 0.45)) { this.towAcc = 0; c.sound.step(!st.bearingOnTyre); }
    }

    if (st.done && this.doneT < 0) this.doneT = 0;
    if (this.doneT >= 0) {
      this.doneT += dt;
      if (this.doneT > 5) { story.battery = st.battery; this.next = 'crane'; }
    }
    this.fadeIn = Math.max(0, this.fadeIn - dt / 2);
    c.fx.black = Math.max(this.fadeIn, this.doneT > 3 ? (this.doneT - 3) / 2 : 0);
    this.view.frame(dt);
    this.hud();
  }

  private onEvent(e: string, c: Ctx) {
    const s = c.sound;
    switch (e) {
      case 'step': s.wheelCreak(0.5); break;
      case 'plug': s.clank(1.8, 0.05); s.blip(0.9); break;
      case 'door': s.creak(1); s.servo(1, 0.7); break;
      case 'deny': s.blip(0.5); setTimeout(() => s.blip(0.45), 160); break;
      case 'pickup': s.clank(1.4, 0.06); break;
      case 'hook': s.clank(0.9, 0.1); s.servo(0.7, 1); break;
      case 'unhook': s.clank(0.8, 0.08); break;
      case 'load': s.clank(0.6, 0.18); break;
      case 'repair': s.servo(1.1, 0.8); break;
      case 'turbine': s.swell(); s.creak(0.6); break;
      case 'grab': s.clank(1.2, 0.08); s.servo(0.6, 1.1); break;
      case 'drop': s.clank(0.7, 0.06); break;
      case 'connect': s.clank(2, 0.06); s.swell(); c.fx.static = 0.4; break;
      case 'note': { const up = journal.add(this.st.reading!); this.justOpened = true; s.blip(1.3); if (up) { this.st.message = { text: `Korpus urósł. Odkodowano: ${up}. Stare zapisy w archiwum nabierają treści.`, t: this.st.t }; setTimeout(() => s.swell(), 400); } break; }
    }
  }

  private hud() {
    const st = this.st, $ = (id: string) => document.getElementById(id)!;
    $('sVitals').innerHTML = `<div class="lbl">Q-1 · ${WOLT_POWER} W</div>
      <div class="row"><span>energia${st.charging ? ' <em class="chg" title="Q-1 odzyskuje energię na postoju">▲</em>' : ''}</span><b>${st.battery.toFixed(1).replace('.', ',')}%</b></div><div class="bar"><i style="width:${st.battery}%"></i></div>
      <div class="flows">${st.flows().map(f => `<div class="row"><span>${f.label}</span><b class="${f.rate > 0 ? 'pos' : f.rate < 0 ? 'neg' : 'dim'}">${pct(f.rate)}</b></div>`).join('')}</div>
      <div class="row"><span>temperatura</span><b>6°C</b></div>
      <div class="row"><span>wiatr</span><b>${st.turbine ? 'turbina ↻' : '4 m/s'}</b></div>`;
    $('sGoal').textContent = st.goal();
    const g = st.grid(), gel = $('sGrid');
    gel.hidden = !g;
    if (g) {
      const line = (f: Flow, need: number) => {
        const v = f.state === 'on' ? `${f.rate > 0 ? '+' : '−'}${Math.abs(f.rate)} W`
          : f.state === 'wait' ? (need ? `gotowy · ${need} W` : 'kręci się, brak odbioru') : need ? `${need} W · brak prądu` : 'wył.';
        return `<div class="row"><span>${f.label}</span><b class="${f.state === 'on' ? (f.rate > 0 ? 'pos' : 'neg') : 'dim'}">${v}</b></div>`;
      };
      gel.innerHTML = `<div class="lbl">SIEĆ STACJI</div>
        <div class="sub">źródła</div>${line(g.sources[0], 0)}${line(g.sources[1], 0)}
        <div class="sub">odbiorniki</div>${line(g.loads[0], MACHINE_POWER)}${line(g.loads[1], FAB_POWER)}
        <div class="row sum"><span>bilans</span><b class="${g.balance > 0 ? 'pos' : 'dim'}">${g.balance > 0 ? `+${g.balance} W zapasu` : st.turbine ? `turbina ${TURBINE_POWER} W czeka na kabel` : 'brak zasilania'}</b></div>`;
    }
    $('sKeys').innerHTML = `<b>WASD</b> ruch · <b>E</b> użyj · <b>J</b> archiwum` + (st.towing ? ' · <b>Q</b> odczep oponę' : st.cableHeld ? ' · <b>Q</b> połóż kabel' : '');
    const hint = st.hint(), tip = $('sTip');
    tip.hidden = !hint;
    if (hint) {
      const p = this.view.project(hint.at, 1.4);
      tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px';
      tip.innerHTML = `<span class="k">${hint.key}</span>${hint.text}` + (hint.progress ? `<div class="prog"><i style="width:${Math.min(1, hint.progress) * 100}%"></i></div>` : '');
    }
    const msg = $('sMsg');
    msg.hidden = !st.message;
    if (st.message) msg.textContent = st.message.text;
    const note = $('sNote');
    if (st.reading) {
      const n = NOTES[st.reading];
      note.hidden = false;
      note.innerHTML = noteHtml(n);
    } else if (this.journalOpen) {
      note.hidden = false;
      note.innerHTML = journalHtml();
    } else note.hidden = true;
    $('sKeys').style.opacity = st.towing || st.cableHeld ? '0.7' : String(Math.max(0, 0.6 - st.t / 20));
  }
}

/** %/s with a sign and a Polish decimal comma. */
function pct(x: number): string {
  if (Math.abs(x) < 0.005) return '0';
  return (x > 0 ? '+' : '−') + Math.abs(x).toFixed(2).replace('.', ',') + '%/s';
}
