import { Ctx, Scene } from '../scene';
import { Island, PLAYER_R, SLED_CAP, CraftMode, GridLine, TERMINAL_W } from '../sim/island';
import { ITEMS, RECIPES, RecipeId, bagText } from '../sim/craft';
import { MouseWalk } from './mouse';
import { IslandView } from '../render/islandView';
import { NOTES, journal, noteHtml, journalHtml } from '../notes';
import { tr, num } from '../../i18n';

const LOG_KEY = 'pip.testWyspa';
const ORDER: RecipeId[] = ['cable', 'connector', 'fuse', 'splitter', 'pin', 'frame', 'panel', 'storage'];

/**
 * Level "Wyspa" (docs/POZIOM-WYSPA.md): glue between the Island logic, its 3D view, sound
 * and HUD. The HUD adds what the crafting test needs: the slots and the sled, what Q-1 is
 * learning, the C panel with the recipes, the grid, and the test log at the end.
 * `?craft=a` (repair in place only) and `?craft=b` (C panel only) compare the two ways.
 */
export class IslandScene implements Scene {
  readonly id = 'wyspa';
  next: string | null = null;
  private st: Island;
  private view!: IslandView;
  private el!: HTMLDivElement;
  private fadeIn = 1;
  private justOpened = false;
  private journalOpen = false;
  private panelOpen = false;
  private ended = false;
  private towAcc = 0;
  private mouse = new MouseWalk(PLAYER_R);

  constructor() {
    let mode: CraftMode = 'ab';
    try { const q = new URLSearchParams(location.search).get('craft'); if (q === 'a' || q === 'b') mode = q; } catch { /* no location */ }
    this.st = new Island(mode);
  }

  enter(c: Ctx) {
    this.view = new IslandView(this.st, c.app);
    (window as unknown as { island: Island }).island = this.st;
    c.fx.black = 1; c.fx.grain = 0.12; c.fx.lines = 0; c.fx.dot = { a: 0, r: 0 };
    c.sound.muffle = 0; c.sound.wind = 0.8;
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <div class="lcol"><div class="vitals" id="iVitals"></div><div class="think" id="iThink" hidden></div><div class="goal" id="iGoal"></div></div>
      <div class="grid" id="iGrid" hidden></div>
      <div class="dock" id="iDock"></div>
      <div class="craftp" id="iCraft" hidden></div>
      <div class="htip" id="iTip" hidden></div>
      <div class="hmsg" id="iMsg" hidden></div>
      <div class="note" id="iNote" hidden></div>
      <div class="note endcard" id="iEnd" hidden></div>
      <div class="hkeys" id="iKeys"></div>`;
    c.hud.appendChild(this.el);
    this.el.querySelector('#iCraft')!.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.r) { if (this.st.craft(b.dataset.r as RecipeId)) this.panelOpen = false; }
      else if (b?.dataset.close) this.panelOpen = false;
    });
  }

  modal() { return !!this.st.reading || this.journalOpen || this.panelOpen; }

  exit(c: Ctx) {
    this.mouse.dispose();
    this.view.dispose();
    this.el.remove();
    c.sound.wind = 0.6;
  }

  update(dt: number, c: Ctx) {
    const st = this.st, k = c.input.keys, pr = c.input.pressed;
    if (st.reading && (['KeyE', 'Escape', 'Space'].some(x => pr.has(x)) || c.input.click) && !this.justOpened) { st.closeNote(); pr.delete('KeyE'); c.input.click = null; }
    this.justOpened = false;
    if (pr.has('KeyJ') && !this.panelOpen) {
      if (this.journalOpen || st.reading) { this.journalOpen = false; st.closeNote(); }
      else if (journal.list().length) this.journalOpen = true;
    }
    if (this.journalOpen) {
      if (pr.has('Escape')) this.journalOpen = false;
      const list = journal.list();
      for (let i = 0; i < Math.min(9, list.length); i++) if (pr.has('Digit' + (i + 1))) { this.journalOpen = false; st.reading = list[i].id; }
    }
    // the C panel: crafting from the list (variant B of the test)
    if (pr.has('KeyC') && !st.reading && !this.journalOpen && st.mode !== 'a') this.togglePanel();
    if (this.panelOpen) {
      if (pr.has('Escape')) this.panelOpen = false;
      ORDER.forEach((id, i) => { if (pr.has('Digit' + (i + 1)) && st.craft(id)) this.panelOpen = false; });
    }
    const busy = !!st.reading || this.journalOpen || this.panelOpen || this.ended;
    const mx = busy ? 0 : (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const my = busy ? 0 : (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const still = busy || st.lighthouseT >= 0 || st.bridged;
    if (still) this.mouse.cancel();
    const m = still ? null : this.mouse.update(dt, c.input, st, this.view, mx !== 0 || my !== 0);
    st.update(dt, {
      move: m ? m.move : { x: mx, y: my }, run: k.has('ShiftLeft') || k.has('ShiftRight'),
      use: !busy && (k.has('KeyE') || !!m?.use), usePressed: !busy && (pr.has('KeyE') || !!m?.usePressed), drop: !busy && pr.has('KeyQ'),
      stopIn: m?.stopIn,
    });
    for (const e of st.events) this.onEvent(e, c);
    st.events.length = 0;
    if (st.towing && st.towTaut && st.moving) {
      this.towAcc += dt;
      if (this.towAcc > 0.4 - st.cargo.length * 0.04) { this.towAcc = 0; c.sound.step(st.cargo.length === 0); }
    }
    if (st.done && !this.ended) this.end();
    this.fadeIn = Math.max(0, this.fadeIn - dt / 2);
    c.fx.black = this.fadeIn;
    this.view.frame(dt);
    this.hud();
  }

  private togglePanel() {
    this.panelOpen = !this.panelOpen;
    if (this.panelOpen) this.st.log.menuOpens++;
  }

  private onEvent(e: string, c: Ctx) {
    const s = c.sound;
    switch (e) {
      case 'step': s.wheelCreak(0.4); break;
      case 'bog': s.step(true); s.servo(0.35, 0.7); break;
      case 'deny': s.blip(0.5); setTimeout(() => s.blip(0.45), 160); break;
      case 'scan': s.blip(1.4); setTimeout(() => s.blip(1.7), 120); break;
      case 'learn': s.swell(); s.blip(1.9); break;
      case 'take': s.clank(1.3, 0.07); break;
      case 'craft': s.servo(1.1, 0.8 + Math.random() * 0.4); if (Math.random() < 0.4) s.clank(2.2, 0.03); break;
      case 'fit': s.clank(1.6, 0.08); s.servo(0.6, 1.2); break;
      case 'hook': s.clank(0.9, 0.1); s.servo(0.7, 1); break;
      case 'unhook': case 'drop': s.clank(0.8, 0.07); break;
      case 'link': s.clank(1.9, 0.05); break;
      case 'power': s.swell(); c.fx.static = 0.25; break;
      case 'door': s.creak(1); s.servo(1, 0.6); break;
      case 'dock': case 'plug': s.clank(1.8, 0.05); s.blip(0.9); break;
      case 'download': s.blip(1.2); setTimeout(() => s.blip(1.5), 140); setTimeout(() => s.blip(1.8), 280); break;
      case 'blow': s.staticBurst(0.9, 0.3); s.clank(0.5, 0.25); c.fx.static = 1; break;
      case 'bridge': s.staticBurst(0.4, 0.15); s.servo(1.4, 0.5); c.fx.static = 0.6; break;
      case 'lighthouse': s.swell(); setTimeout(() => s.swell(), 1600); break;
      case 'answer': for (let i = 0; i < 6; i++) setTimeout(() => s.blip(2.2), (i < 3 ? i : i + 2) * 450); break;
      case 'full': s.blip(0.6); break;
      case 'panel': if (this.st.mode !== 'a') this.togglePanel(); break;
      case 'note': journal.add(this.st.reading!); this.justOpened = true; s.blip(1.3); break;
    }
    if (e === 'lighthouse') journal.add('mapaMisji');
  }

  /** The end card: the test log, saved in the browser and ready to copy. */
  private end() {
    this.ended = true;
    const st = this.st, L = st.log;
    const text = [
      `Popiół i Prąd · test craftingu · Wyspa · tryb ${st.mode}`,
      `etapy (s): ${Object.entries(L.stages).map(([k, v]) => `${k} ${v}`).join(', ')}`,
      `naprawy w miejscu (części): ${L.inPlace}`,
      `panel C: otwarcia ${L.menuOpens}, zrobione ${L.menuCrafts}`,
      `przepełniony ekwipunek: ${L.overflow}`,
      `doczepienia sanek: ${L.sledHooks}`,
      `odmowy: ${L.denies}`,
      `czas: ${Math.round(st.t)} s`,
    ].join('\n');
    try { localStorage.setItem(LOG_KEY, text); } catch { /* no storage */ }
    const el = document.getElementById('iEnd')!;
    el.hidden = false;
    el.innerHTML = `<div class="lbl">${tr('Koniec testu', 'End of the test')}</div><h2>${tr('Wyspa', 'The island')}</h2>
      <p>${tr('Dziennik testu (zapisany w przeglądarce). Skopiuj i wyślij razem z wrażeniami.', 'Test log (saved in the browser). Copy it and send it with your impressions.')}</p>
      <textarea readonly rows="9">${text}</textarea>
      <p class="small">${tr('<b>Esc</b> menu', '<b>Esc</b> menu')}</p>`;
    el.querySelector('textarea')!.addEventListener('focus', e => (e.target as HTMLTextAreaElement).select());
  }

  private hud() {
    const st = this.st, $ = (id: string) => document.getElementById(id)!;
    $('iVitals').innerHTML = `<div class="lbl">Q-1</div>
      <div class="row"><span>${tr('energia', 'energy')}${st.charging ? ' <em class="chg">▲</em>' : ''}</span><b>${num(st.battery)}%</b></div><div class="bar"><i style="width:${st.battery}%"></i></div>
      <div class="row"><span>${tr('słońce', 'sun')}</span><b>${Math.round(st.sun(st.pos) * 100)}%</b></div>`;
    const th = st.thinking(), te = $('iThink');
    te.hidden = !th;
    if (th) te.innerHTML = `<div class="lbl">${tr('Q-1 analizuje', 'Q-1 analyses')}</div><div>${th.what}${th.queue ? ` <span class="dim">+${th.queue}</span>` : ''}</div><div class="bar"><i style="width:${th.p * 100}%"></i></div>`;
    $('iGoal').textContent = st.goal();

    // the grid
    const g = st.grid(), gel = $('iGrid');
    gel.hidden = !g;
    if (g) {
      const line = (l: GridLine) => `<div class="row"><span>${l.label}</span><b class="${l.state === 'on' && l.w ? (l.w > 0 ? 'pos' : 'neg') : 'dim'}">${l.state === 'off' ? '—' : `${l.w > 0 ? '+' : l.w < 0 ? '−' : ''}${Math.abs(l.w)} W`}</b></div>`;
      const nd = st.terminalNeed();
      gel.innerHTML = `<div class="lbl">${tr('SIEĆ WYSPY', 'ISLAND GRID')}${st.regOk ? '' : st.bridged ? tr(' · MOSTEK: WOLT', ' · BRIDGE: WOLT') : tr(' · REGULATOR STOI', ' · REGULATOR DOWN')}</div>
        <div class="sub">${tr('źródła', 'sources')}</div>${g.sources.map(line).join('')}
        ${g.loads.length ? `<div class="sub">${tr('odbiorniki', 'consumers')}</div>${g.loads.map(line).join('')}` : ''}
        ${st.scanned.has('terminal') ? `<div class="row sum"><span>${tr('terminal', 'terminal')}</span><b class="${nd.have >= TERMINAL_W ? 'pos' : 'neg'}">${Math.max(0, nd.have)} / ${nd.want} W</b></div>` : ''}
        ${st.downloading || st.progress > 0 ? `<div class="row"><span>${tr('pobieranie', 'download')}</span><b>${Math.floor(st.progress * 100)}%</b></div><div class="bar"><i style="width:${st.progress * 100}%"></i></div>` : ''}`;
    }

    // slots and the sled
    const slot = (s: { id: keyof typeof ITEMS; n: number } | null) => s ? `<div class="slot"><b>${s.n}${ITEMS[s.id].unit ?? ''}</b><span>${ITEMS[s.id].name}</span></div>` : '<div class="slot empty"></div>';
    const sled = Array.from({ length: SLED_CAP }, (_, i) => st.cargo[i] ? `<div class="slot big"><span>${ITEMS[st.cargo[i]].name}</span></div>` : '<div class="slot big empty"></div>').join('');
    const craft = st.crafting ? `<div class="crafting">${RECIPES[st.crafting.recipe].name} <div class="bar"><i style="width:${Math.min(1, st.crafting.t / RECIPES[st.crafting.recipe].time) * 100}%"></i></div>${RECIPES[st.crafting.recipe].bench && !st.benchOn ? `<span class="neg">${tr('stół czeka na prąd', 'the bench waits for power')}</span>` : ''}</div>` : '';
    $('iDock').innerHTML = `${craft}<div class="slots">${st.inv.slots.map(slot).join('')}<div class="sep" title="${tr('sanki', 'sled')}"></div>${sled}</div>`;

    // the C panel
    const cp = $('iCraft');
    cp.hidden = !this.panelOpen;
    if (this.panelOpen) {
      cp.innerHTML = `<div class="lbl">${tr('Wytwarzanie (C)', 'Crafting (C)')}</div>` + ORDER.map((id, i) => {
        const r = RECIPES[id], known = st.known.has(id), why = st.whyNot(id);
        if (!known) return `<div class="rc unknown"><span class="n">${i + 1}</span><span>???</span><span class="dim">${tr('Q-1 jeszcze nie wie', 'Q-1 does not know yet')}</span></div>`;
        return `<button type="button" class="rc${why ? ' no' : ''}" data-r="${id}"><span class="n">${i + 1}</span><span>${r.name}${r.bench ? tr(' · stół', ' · bench') : ''}</span><span class="dim">${bagText(r.need)}</span>${why ? `<span class="neg">${why}</span>` : ''}</button>`;
      }).join('') + `<button type="button" class="rc close" data-close="1">${tr('zamknij (Esc)', 'close (Esc)')}</button>`;
    }

    $('iKeys').innerHTML = tr('<b>klik</b> / <b>WASD</b> ruch · <b>E</b> użyj / przytrzymaj · ', '<b>click</b> / <b>WASD</b> move · <b>E</b> use / hold · ')
      + (st.mode !== 'a' ? tr('<b>C</b> wytwarzanie · ', '<b>C</b> crafting · ') : '') + tr('<b>J</b> archiwum', '<b>J</b> archive')
      + (st.towing ? tr(' · <b>Q</b> odczep sanki', ' · <b>Q</b> unhitch the sled') : st.bridged ? tr(' · <b>Q</b> puść', ' · <b>Q</b> let go') : '');
    const hint = st.hint(), tip = $('iTip');
    tip.hidden = !hint || this.panelOpen;
    if (hint) {
      const p = this.view.project(hint.at, 1.4);
      tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px';
      tip.classList.toggle('no', !hint.ok);
      tip.innerHTML = `<span class="k">${hint.key}</span>${hint.text}` + (hint.progress ? `<div class="prog"><i style="width:${Math.min(1, hint.progress) * 100}%"></i></div>` : '');
    }
    const msg = $('iMsg');
    msg.hidden = !st.message;
    if (st.message) msg.textContent = st.message.text;
    const note = $('iNote');
    if (st.reading) { note.hidden = false; note.innerHTML = noteHtml(NOTES[st.reading]); }
    else if (this.journalOpen) { note.hidden = false; note.innerHTML = journalHtml(); }
    else note.hidden = true;
  }
}
