import { tr } from '../../i18n';
import { Cable } from '../../sim/cable';
import { findPath } from '../../sim/path';
import { dist } from '../../sim/vec';
import { ItemId, TechId, ObsId, ModuleId, BuildingId, TECHS, Bag, SCRAP } from '../data';
import { CraftGame, Building } from './craftGame';

/**
 * The demo is a walk through stages, one system at a time. Each stage has goals you can
 * do by hand, and a shortcut (`setup`) that puts the yard in the state the stage leaves
 * behind, so any stage can be opened directly and they can be clicked through in order.
 */
export interface Goal { text: string; done: (g: CraftGame) => boolean }
export interface Stage { id: string; name: string; intro: string; goals: Goal[]; setup: (g: CraftGame) => void }

// where the shortcuts put things down (free tiles in the yard)
const SPOT: Record<string, [BuildingId, number, number]> = {
  hubA: ['splitter', 26, 12], hubB: ['splitter', 24, 17], hubC: ['splitter', 30, 17],
  lamp: ['lamp', 23, 13], solar: ['solar', 29, 11], battery: ['battery', 21, 16], charger: ['charger', 14, 11],
  wind: ['wind', 34, 13], recycler: ['recycler', 32, 18], mast: ['mast', 27, 15],
};

function give(g: CraftGame, bag: Bag) { for (const [id, n] of Object.entries(bag) as [ItemId, number][]) g.give(id, n); }
function learn(g: CraftGame, obs: ObsId[], techs: TechId[]) { for (const o of obs) g.obs.add(o); for (const t of techs) g.completeTech(t); }

function built(g: CraftGame, key: string): Building {
  const [kind, x, y] = SPOT[key];
  const have = g.buildings.find(b => b.kind === kind && b.x === x && b.y === y);
  if (have) return have;
  for (const s of [...g.scrap]) {
    // clear junk off the spot
    if (s.o.x < x + 3 && s.o.x + s.o.w > x - 1 && s.o.y < y + 3 && s.o.y + s.o.h > y - 1 && !SCRAP[s.kind].hidden) { g.world.remove(s.o); g.removed.push(s.o); g.scrap = g.scrap.filter(q => q !== s); }
  }
  return g.addBuilding(kind, x, y);
}

/** A cable laid along a drivable route between two ports. */
function link(g: CraftGame, a: Building, b: Building) {
  if (g.links.some(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) return;
  const c = new Cable(a.port, a.port);
  const route = findPath(g.world, a.port, b.port, 0.05) ?? [b.port];
  for (const p of route) {
    // move in small steps so the cable wraps the corners it sweeps past
    const from = c.end, d = dist(from, p), n = Math.max(1, Math.ceil(d / 0.5));
    for (let k = 1; k <= n; k++) c.moveEnd(g.world, { x: from.x + (p.x - from.x) * k / n, y: from.y + (p.y - from.y) * k / n });
  }
  c.moveEnd(g.world, b.port);
  g.links.push({ id: `l${g.links.length + 100}`, a: a.id, b: b.id, cable: c, metres: Math.ceil(c.length()) });
}

/** As if Wolt had taken one of these apart already. */
function taken(g: CraftGame, ...kinds: string[]) {
  for (const k of kinds) {
    const s = g.scrap.find(x => x.kind === k);
    if (!s) continue;
    if (!SCRAP[s.kind].hidden) g.world.remove(s.o);
    g.scrap = g.scrap.filter(x => x !== s);
  }
}

const bench = (g: CraftGame) => g.buildings.find(b => b.kind === 'bench')!;
const turbine = (g: CraftGame) => g.buildings.find(b => b.kind === 'oldturbine')!;
const has = (g: CraftGame, id: ItemId) => g.have(id) > 0;
const builtKind = (g: CraftGame, k: BuildingId) => g.buildings.some(b => b.kind === k);
const onGrid = (g: CraftGame, k: BuildingId) => g.buildings.some(b => b.kind === k && (g.net(b)?.nodes.length ?? 0) > 1);
const fitted = (g: CraftGame, m: ModuleId) => g.modules.includes(m);
function fit(g: CraftGame, m: ModuleId) { if (!g.modules.includes(m)) { g.modules.push(m); } }

function cartReady(g: CraftGame) {
  g.cart.repaired = true;
  g.hitched = true;
  g.cart.pos = { x: g.pos.x - Math.cos(g.facing) * 2.4, y: g.pos.y - Math.sin(g.facing) * 2.4 };
  if (g.world.circleBlocked(g.cart.pos, 0.7)) g.cart.pos = { x: g.pos.x - 2.2, y: g.pos.y + 0.6 };
}

export const STAGES: Stage[] = [
  {
    id: 'salvage', name: tr('1. Rozbiórka ręczna', '1. Bare-hand salvage'),
    intro: tr('Wolt ma tylko 6 miejsc w ekwipunku i gołe ramię. Rozbierz małe kupki złomu (LPM na kupce albo przytrzymaj E obok) i zrób z miedzi i plastiku pierwszy kabel (C).',
      'Wolt has just 6 inventory slots and a bare arm. Take small scrap piles apart (LMB on a pile or hold E next to it) and make your first cable from copper and plastic (C).'),
    goals: [
      { text: tr('Rozbierz 3 kupki złomu', 'Salvage 3 scrap piles'), done: g => g.stats.salvaged >= 3 },
      { text: tr('Wytwórz 10 m kabla', 'Make 10 m of cable'), done: g => g.have('cable') >= 10 || g.links.length > 0 },
      { text: tr('Zobacz, jak szybko kończy się miejsce (I)', 'See how quickly the slots fill up (I)'), done: g => g.inv.used() >= 4 },
    ],
    setup: g => { give(g, { iron: 4, copper: 2, plastic: 2, cable: 10 }); learn(g, ['scrap'], []); taken(g, 'pile', 'pile', 'pile'); g.stats.salvaged = Math.max(3, g.stats.salvaged); },
  },
  {
    id: 'tools', name: tr('2. Narzędzia', '2. Tools'),
    intro: tr('Beczki i kontenery są skręcone. W skrzyni serwisowej są narzędzia technika: Q-1 je obejrzy i policzy, jak zrobić własne (T, drzewko technologii). Liczy tylko, gdy bateria Wolta ma ponad połowę.',
      'Barrels and bins are bolted together. A service crate holds a technician\'s tools: Q-1 looks at them and computes how to make its own (T, the technology tree). It computes only while Wolt\'s battery is above half.'),
    goals: [
      { text: tr('Rozbierz skrzynię serwisową', 'Open a service crate'), done: g => g.obs.has('tools') },
      { text: tr('Policz technologię: Narzędzia (T)', 'Compute the technology: Tools (T)'), done: g => g.techs.has('tools') },
      { text: tr('Zrób klucz nasadowy', 'Make a socket wrench'), done: g => has(g, 'wrench') },
      { text: tr('Rozbierz beczkę kluczem', 'Take a barrel apart with the wrench'), done: g => g.scrap.filter(s => s.kind === 'barrel').length < 4 },
    ],
    setup: g => { learn(g, ['tools'], ['tools']); taken(g, 'crate', 'barrel'); give(g, { wrench: 1, electronics: 1, iron: 3, plastic: 1 }); },
  },
  {
    id: 'cart', name: tr('3. Wózek', '3. The cart'),
    intro: tr('Obok warsztatu stoi wózek serwisowy z zatartymi kołami. Łożyska są w skrzynce z częściami. Naprawiony i doczepiony daje 12 miejsc i wozi rzeczy, które Wolt sam nie uniesie.',
      'A service cart with seized wheels stands by the workshop. Bearings are in the parts box. Fixed and hitched, it adds 12 slots and carries what Wolt cannot lift himself.'),
    goals: [
      { text: tr('Rozbierz skrzynkę z częściami (łożyska)', 'Open the parts box (bearings)'), done: g => g.obs.has('motor') },
      { text: tr('Napraw wózek', 'Fix the cart'), done: g => g.cart.repaired },
      { text: tr('Doczep wózek (E)', 'Hitch the cart (E)'), done: g => g.hitched },
    ],
    setup: g => { learn(g, ['motor'], []); taken(g, 'bearingbox'); cartReady(g); give(g, { bearings: 2, iron: 1 }); },
  },
  {
    id: 'cutter', name: tr('4. Przecinarka i wrak', '4. Cutter and wreck'),
    intro: tr('Wraki aut to skarbnica: akumulator, silnik, łożyska, szyby. Karoserię trzeba ciąć. Przecinarkę zrobisz przy stole warsztatowym; ciągnie prąd z Wolta, więc pilnuj baterii.',
      'Car wrecks are a treasure trove: battery, motor, bearings, glass. The body has to be cut. Make the cutter at the workbench; it draws on Wolt\'s battery, so watch the charge.'),
    goals: [
      { text: tr('Zrób przecinarkę przy stole', 'Make a cutter at the workbench'), done: g => has(g, 'cutter') },
      { text: tr('Rozetnij wrak auta', 'Cut up a car wreck'), done: g => g.obs.has('car_battery') },
    ],
    setup: g => { learn(g, ['car_battery'], []); taken(g, 'car'); give(g, { cutter: 1, iron: 6, copper: 4, glass: 2, cells: 2, bearings: 3, electronics: 3, plastic: 2 }); },
  },
  {
    id: 'power', name: tr('5. Pierwszy prąd', '5. First power'),
    intro: tr('Stara turbina za warsztatem ma spalony silnik. Q-1 policzy Warsztat (silniki, płytki, ramy), zrobisz silnik, naprawisz turbinę i pociągniesz kabel do stołu. Stół z prądem pracuje dwa razy szybciej i nie ciągnie z Wolta.',
      'The old turbine behind the workshop has a burnt-out motor. Q-1 computes the Workshop (motors, boards, frames), you make a motor, fix the turbine and run a cable to the bench. A powered bench works twice as fast and spares Wolt\'s battery.'),
    goals: [
      { text: tr('Policz technologię: Warsztat', 'Compute the technology: Workshop'), done: g => g.techs.has('bench') },
      { text: tr('Zrób silnik', 'Make a motor'), done: g => has(g, 'motor') || turbine(g).ok },
      { text: tr('Napraw starą turbinę', 'Fix the old turbine'), done: g => turbine(g).ok },
      { text: tr('Połącz turbinę ze stołem kablem', 'Connect the turbine to the bench with a cable'), done: g => !!g.net(bench(g)) && g.net(bench(g))!.nodes.includes(turbine(g).id) },
    ],
    setup: g => { learn(g, [], ['bench']); turbine(g).ok = true; link(g, turbine(g), bench(g)); give(g, { solder: 1, cable: 20, copper: 4, plastic: 3 }); },
  },
  {
    id: 'grid', name: tr('6. Sieć i rozgałęźnik', '6. Grid and splitter'),
    intro: tr('Jedno gniazdo turbiny to za mało. Rozgałęźnik ma cztery: łączy źródło z wieloma odbiornikami. Latarnia świeci nocą i ciągnie 40 W. Q-1 potrzebuje obejrzeć oprawę starej latarni.',
      'One turbine socket is not enough. The splitter has four: it joins a source to many consumers. A lamp post lights up at night and draws 40 W. Q-1 needs to look at an old street lamp first.'),
    goals: [
      { text: tr('Rozetnij przewróconą latarnię', 'Cut up a fallen lamp post'), done: g => g.obs.has('lamp') },
      { text: tr('Policz: Sieć rozgałęziona', 'Compute: Branching grid'), done: g => g.techs.has('grid') },
      { text: tr('Postaw rozgałęźnik i latarnię', 'Put down a splitter and a lamp post'), done: g => builtKind(g, 'splitter') && builtKind(g, 'lamp') },
      { text: tr('Podłącz latarnię do sieci z turbiną', 'Connect the lamp to the grid with the turbine'), done: g => onGrid(g, 'lamp') },
    ],
    setup: g => {
      learn(g, ['lamp'], ['grid']); taken(g, 'streetlight');
      const A = built(g, 'hubA'), L = built(g, 'lamp');
      g.links = g.links.filter(l => !(l.a === turbine(g).id || l.b === turbine(g).id));
      link(g, turbine(g), A); link(g, A, bench(g)); link(g, A, L);
      give(g, { cable: 10 });
    },
  },
  {
    id: 'solar', name: tr('7. Panel słoneczny', '7. Solar panel'),
    intro: tr('Rozbite panele na północy mają krzem i szkło. Z modułów PV, ramy i płytki złożysz panel na 400 W. Jest duży: mieści się tylko na wózku. Postaw go i wepnij w sieć. Nocą nie daje nic.',
      'The broken panels up north hold silicon and glass. From PV modules, a frame and a board you assemble a 400 W panel. It is big: only the cart carries it. Put it down and plug it into the grid. At night it gives nothing.'),
    goals: [
      { text: tr('Rozbierz rozbity panel', 'Take a broken panel apart'), done: g => g.obs.has('pv') },
      { text: tr('Policz: Fotowoltaika', 'Compute: Photovoltaics'), done: g => g.techs.has('solar') },
      { text: tr('Zrób panel słoneczny', 'Make a solar panel'), done: g => has(g, 'solar') || builtKind(g, 'solar') },
      { text: tr('Postaw go i podłącz do sieci', 'Put it down and connect it to the grid'), done: g => onGrid(g, 'solar') },
    ],
    setup: g => {
      learn(g, ['pv'], ['solar']); taken(g, 'solarwreck');
      const A = built(g, 'hubA'), B = built(g, 'hubB'), S = built(g, 'solar');
      link(g, A, B); link(g, B, S);
    },
  },
  {
    id: 'storage', name: tr('8. Magazyn i kołyska', '8. Storage and cradle'),
    intro: tr('Słońce zachodzi, wiatr cichnie. Ogniwa z wraków aut złożysz w magazyn energii na 2 kWh. Kołyska ładująca ładuje Wolta przez styki, bez indukcji: wjedź na nią.',
      'The sun sets, the wind drops. Cells from car wrecks make a 2 kWh battery store. The charging cradle charges Wolt through contacts, never by induction: roll onto it.'),
    goals: [
      { text: tr('Policz: Magazynowanie', 'Compute: Storage'), done: g => g.techs.has('storage') },
      { text: tr('Postaw magazyn energii w sieci', 'Put a battery store on the grid'), done: g => onGrid(g, 'battery') },
      { text: tr('Postaw kołyskę w sieci i wjedź na nią', 'Put a cradle on the grid and roll onto it'), done: g => onGrid(g, 'charger') && g.docked },
    ],
    setup: g => {
      learn(g, [], ['storage']);
      const B = built(g, 'hubB'), Bat = built(g, 'battery'), C = built(g, 'charger');
      Bat.stored = 1200;
      link(g, B, Bat); link(g, Bat, C);
      give(g, { cells: 2, copper: 2 });
    },
  },
  {
    id: 'modules', name: tr('9. Ulepszenia Wolta', '9. Upgrading Wolt'),
    intro: tr('Rama Wolta ma gniazda na moduły (U). Reflektor, wzmocnione ramię, dodatkowe ogniwa. Moduł AI II to więcej Q-1: rozpoznaje przepływy prądu, widzi zakopane kable i liczy dwa razy szybciej. Potrzebuje układu z szafy serwerowej.',
      'Wolt\'s frame has module sockets (U). Floodlight, heavy arm, extra cells. The AI II module is more of Q-1: it senses current, sees buried cables and computes twice as fast. It needs a chip from a server cabinet.'),
    goals: [
      { text: tr('Policz: Moduły Wolta', 'Compute: Wolt\'s modules'), done: g => g.techs.has('modules') },
      { text: tr('Zamontuj pierwszy moduł (U)', 'Fit your first module (U)'), done: g => g.modules.length > 0 },
      { text: tr('Rozbierz szafę serwerową', 'Take a server cabinet apart'), done: g => g.obs.has('ai_chip') },
      { text: tr('Zamontuj moduł AI II', 'Fit the AI II module'), done: g => fitted(g, 'm_ai') },
      { text: tr('Wykop zakopany kabel', 'Dig up the buried cable'), done: g => g.obs.has('buried') },
    ],
    setup: g => { learn(g, ['ai_chip', 'buried'], ['modules', 'ai']); taken(g, 'server', 'buried'); fit(g, 'm_lamp'); fit(g, 'm_arm'); fit(g, 'm_ai'); give(g, { copper: 6, cable: 10 }); },
  },
  {
    id: 'machines', name: tr('10. Maszyny', '10. Machines'),
    intro: tr('Własna turbina wiatrowa z silnika jako prądnicy, i przetwórnia: z prądem sama rozbiera złom mieszany na surowce. Wsyp złom i patrz, co wypada.',
      'Your own wind turbine with a motor as the generator, and the recycler: with power, it breaks mixed scrap into materials on its own. Load scrap and watch what drops out.'),
    goals: [
      { text: tr('Postaw turbinę wiatrową w sieci', 'Put a wind turbine on the grid'), done: g => onGrid(g, 'wind') },
      { text: tr('Postaw przetwórnię w sieci', 'Put a recycler on the grid'), done: g => onGrid(g, 'recycler') },
      { text: tr('Wsyp do niej złom mieszany', 'Load it with mixed scrap'), done: g => g.buildings.some(b => b.kind === 'recycler' && (b.hopper > 0 || b.work > 0)) },
    ],
    setup: g => {
      learn(g, [], ['wind', 'recycle']);
      const B = built(g, 'hubB'), C = built(g, 'hubC'), W = built(g, 'wind'), R = built(g, 'recycler');
      link(g, B, C); link(g, C, W); link(g, C, R);
      R.hopper = 4;
    },
  },
  {
    id: 'radio', name: tr('11. Antena', '11. The mast'),
    intro: tr('Moduł radiowy w Wolcie i maszt antenowy na 200 W. Nasłuch przeszukuje pasma: może ktoś jeszcze nadaje. Ludzkiej mowy Q-1 nie rozumie, ale zapisuje ją do korpusu.',
      'A radio module in Wolt and a 200 W radio mast. Listening sweeps the bands: maybe someone still transmits. Q-1 does not understand human speech yet, but saves it to the corpus.'),
    goals: [
      { text: tr('Rozbierz skrzynkę radiową', 'Take the radio box apart'), done: g => g.obs.has('radio') },
      { text: tr('Zamontuj moduł radiowy', 'Fit the radio module'), done: g => fitted(g, 'm_radio') },
      { text: tr('Postaw maszt w sieci', 'Put the mast on the grid'), done: g => onGrid(g, 'mast') },
      { text: tr('Złap pierwszy sygnał (R)', 'Catch the first signal (R)'), done: g => g.radio.heard > 0 },
    ],
    setup: g => {
      learn(g, ['radio'], ['radio', 'remote', 'mast']); taken(g, 'radiobox');
      if (g.modules.length >= g.moduleSlots()) g.modules.pop();
      fit(g, 'm_radio');
      const C = built(g, 'hubC'), M = built(g, 'mast');
      link(g, C, M);
      g.radio.heard = Math.max(g.radio.heard, 1);
    },
  },
  {
    id: 'sandbox', name: tr('12. Piaskownica', '12. Sandbox'),
    intro: tr('Wszystko odblokowane, wytwarzanie i budowa za darmo. Poligon do sprawdzania pomysłów: sieci, bilansu prądu, nocy.',
      'Everything unlocked, crafting and building for free. A proving ground for ideas: grids, the power balance, nights.'),
    goals: [{ text: tr('Baw się', 'Have fun'), done: () => false }],
    setup: g => { g.sandbox = true; for (const t of Object.keys(TECHS) as TechId[]) g.completeTech(t); },
  },
];

/** A fresh yard as it stands at the start of stage `i`: every earlier stage's shortcut applied. */
export function yardAtStage(i: number): CraftGame {
  const g = new CraftGame();
  for (let k = 0; k < i; k++) STAGES[k].setup(g);
  g.stage = i;
  g.energy = g.battery() * (i === 0 ? 0.7 : 0.9);
  g.update(0.001, { x: 0, y: 0 }, false, false); // solve the grid once
  g.events.length = 0; g.toasts.length = 0; g.removed.length = 0;
  return g;
}

export const stageDone = (g: CraftGame, i: number) => STAGES[i].goals.every(x => x.done(g));
