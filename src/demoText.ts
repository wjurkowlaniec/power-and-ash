import { lang } from './i18n';

/**
 * The tech demo's static page text (demo/index.html is written in Polish). In English
 * these pieces are swapped in before anything else touches the page.
 */
const EN: Record<string, string> = {
  '#vitals': `<div class="row lbl"><span>WOLT · BATTERY</span><span id="enNum"></span></div><div class="bar"><i id="en"></i></div>
    <div class="dim" id="enRate"></div>
    <div class="lbl" style="margin-top:8px">HULL</div><div class="bar"><i id="hp" style="width:100%"></i></div>`,
  '#help': `<b>LMB</b> walk / use (hold: lead) · <b>RMB</b> menu · <b>WASD</b> move · <b>Shift</b> run · <b>E</b> use, hitch / unhitch a load · <b>Q</b> reel in · <b>L</b> light · <b>wheel</b> zoom · <b>M</b> sound · <b>H</b> help`,
  '#start .card': `<h1>Ash and Power</h1>
    <p class="lbl">Level 1 · Jump Start</p>
    <p>The land yacht's battery is flat. Old Station 2 behind the wall of containers still has working panels. Salvage scrap, make 20 m of cable in the fabricator, connect the station to the land yacht, wait for it to charge and leave.</p>
    <p>The cable wraps around obstacles, and what counts is the length of its route, not the straight-line distance.</p>
    <p>Wolt has his own small battery: moving, running, the light and salvaging drain it, and standing still slowly recharges it. Next to the Station 2 port it charges fast.</p>
    <p class="keys"><b>LMB</b> walk / use &nbsp; <b>RMB</b> menu &nbsp; <b>WASD</b> move &nbsp; <b>E</b> use &nbsp; <b>Q</b> reel in &nbsp; <b>L</b> light &nbsp; <b>wheel</b> zoom</p>
    <button id="go" type="button">Start (with sound)</button>
    <p class="small">prototype · logic in plain TS, rendered with Three.js</p>`,
  '#end .card': `<p class="lbl">Level 1 · Jump Start</p>
    <h1>The land yacht is on its way</h1>
    <p id="endStats"></p>
    <button id="again" type="button">Play again</button>`,
};

export function localizeDemoPage() {
  if (lang !== 'en') return;
  document.title = 'Ash and Power · tech demo';
  for (const [sel, html] of Object.entries(EN)) {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = html;
  }
}
