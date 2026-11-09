import { tr } from '../i18n';

/**
 * Everything the crafting tech demo knows about: items, recipes, scrap, buildings,
 * Wolt's modules, the technology tree and the observations it needs. Pure data, no
 * logic; the rules that use it are in sim/craftGame.ts. Every player-facing string is
 * tr('polski', 'English').
 */

// ---------------------------------------------------------------- items

export type MaterialId = 'iron' | 'copper' | 'plastic' | 'glass' | 'electronics' | 'cells' | 'bearings' | 'silicon' | 'scrapmix' | 'sailcloth';
export type PartId = 'cable' | 'circuit' | 'motor' | 'pvcell' | 'frame' | 'cellpack' | 'yachtmast' | 'sail' | 'runners';
export type ToolId = 'wrench' | 'cutter' | 'solder' | 'meter';
export type BuildingId = 'splitter' | 'lamp' | 'solar' | 'wind' | 'battery' | 'charger' | 'recycler' | 'mast';
export type ModuleId = 'm_lamp' | 'm_arm' | 'm_cells' | 'm_radio' | 'm_remote' | 'm_ai';
export type ItemId = MaterialId | PartId | ToolId | BuildingId | ModuleId;
export type ItemKind = 'material' | 'part' | 'tool' | 'building' | 'module';

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  name: string;
  desc: string;
  /** How many fit in one slot. */
  stack: number;
  /** Too big for Wolt: only the cart carries it. */
  big?: boolean;
}

const I = (id: ItemId, kind: ItemKind, stack: number, name: string, desc: string, big = false): ItemDef => ({ id, kind, stack, name, desc, big });

export const ITEMS: Record<ItemId, ItemDef> = {
  iron: I('iron', 'material', 20, tr('żelazo', 'iron'), tr('blachy, pręty, śruby z rozbiórki', 'sheet, rods and bolts from scrap')),
  copper: I('copper', 'material', 20, tr('miedź', 'copper'), tr('druty i uzwojenia', 'wire and windings')),
  plastic: I('plastic', 'material', 20, tr('plastik', 'plastic'), tr('obudowy i izolacja', 'housings and insulation')),
  glass: I('glass', 'material', 20, tr('szkło', 'glass'), tr('szyby, klosze', 'panes and lamp covers')),
  electronics: I('electronics', 'material', 20, tr('elektronika', 'electronics'), tr('płytki, scalaki, przekaźniki', 'boards, chips, relays')),
  cells: I('cells', 'material', 20, tr('ogniwa', 'cells'), tr('stare ogniwa, jeszcze trzymają ładunek', 'old cells that still hold a charge')),
  bearings: I('bearings', 'material', 20, tr('łożyska', 'bearings'), tr('z kół i silników', 'from wheels and motors')),
  silicon: I('silicon', 'material', 20, tr('krzem', 'silicon'), tr('płytki z rozbitych paneli', 'wafers from broken panels')),
  scrapmix: I('scrapmix', 'material', 20, tr('złom mieszany', 'mixed scrap'), tr('wszystkiego po trochu, do przetwórni', 'a bit of everything, for the recycler')),
  sailcloth: I('sailcloth', 'material', 10, tr('powłoka balonu', 'balloon skin'), tr('lekka, szczelna tkanina z balonu meteo', 'light, airtight fabric from a weather balloon')),

  cable: I('cable', 'part', 40, tr('kabel', 'cable'), tr('metry kabla miedzianego w izolacji', 'metres of insulated copper cable')),
  circuit: I('circuit', 'part', 10, tr('płytka sterująca', 'control board'), tr('serce każdej maszyny', 'the heart of every machine')),
  motor: I('motor', 'part', 5, tr('silnik', 'motor'), tr('mały silnik elektryczny', 'a small electric motor')),
  pvcell: I('pvcell', 'part', 10, tr('moduł PV', 'PV module'), tr('sklejone ogniwa fotowoltaiczne', 'bonded photovoltaic cells')),
  frame: I('frame', 'part', 5, tr('rama stalowa', 'steel frame'), tr('spawana konstrukcja nośna', 'a welded load-bearing frame')),
  cellpack: I('cellpack', 'part', 5, tr('pakiet ogniw', 'cell pack'), tr('ogniwa w obudowie z zabezpieczeniem', 'cells in a casing with protection')),
  yachtmast: I('yachtmast', 'part', 1, tr('maszt z bomem', 'mast and boom'), tr('rura na 3 m, bom i wanty: do wózka', 'a 3 m pipe, a boom and shrouds: for the cart'), true),
  sail: I('sail', 'part', 1, tr('żagiel', 'sail'), tr('uszyty z powłoki balonu meteo, z linami', 'sewn from weather balloon skin, with lines')),
  runners: I('runners', 'part', 1, tr('płozy', 'runners'), tr('trzy płozy na belce: po popiele zamiast kół', 'three runners on a plank: for ash instead of wheels'), true),

  wrench: I('wrench', 'tool', 1, tr('klucz nasadowy', 'socket wrench'), tr('odkręca śruby: beczki, kontenery, panele', 'undoes bolts: barrels, bins, panels')),
  cutter: I('cutter', 'tool', 1, tr('przecinarka', 'cutter'), tr('tnie blachę: wraki aut, latarnie. Ciągnie prąd z Wolta', 'cuts sheet metal: car wrecks, lamp posts. Draws on Wolt\'s battery')),
  solder: I('solder', 'tool', 1, tr('lutownica', 'soldering iron'), tr('do płytek i modułów', 'for boards and modules')),
  meter: I('meter', 'tool', 1, tr('miernik', 'multimeter'), tr('pokazuje moc na kablach i maszynach', 'shows the power on cables and machines')),

  splitter: I('splitter', 'building', 5, tr('rozgałęźnik', 'splitter'), tr('skrzynka z czterema gniazdami, łączy kable w sieć', 'a box with four sockets, joins cables into a grid')),
  lamp: I('lamp', 'building', 5, tr('latarnia', 'lamp post'), tr('świeci nocą, 40 W', 'lights up at night, 40 W')),
  solar: I('solar', 'building', 1, tr('panel słoneczny', 'solar panel'), tr('do 400 W w pełnym słońcu, nocą nic', 'up to 400 W in full sun, nothing at night'), true),
  wind: I('wind', 'building', 1, tr('turbina wiatrowa', 'wind turbine'), tr('do 300 W, zależnie od wiatru', 'up to 300 W, depending on the wind'), true),
  battery: I('battery', 'building', 1, tr('magazyn energii', 'battery store'), tr('2 kWh zapasu na noc', '2 kWh to last the night'), true),
  charger: I('charger', 'building', 1, tr('kołyska ładująca', 'charging cradle'), tr('Wolt wjeżdża i ładuje się przez styki, 300 W', 'Wolt rolls on and charges through contacts, 300 W'), true),
  recycler: I('recycler', 'building', 1, tr('przetwórnia złomu', 'scrap recycler'), tr('z prądem rozbiera złom mieszany na surowce, 500 W', 'with power, breaks mixed scrap into materials, 500 W'), true),
  mast: I('mast', 'building', 1, tr('maszt antenowy', 'radio mast'), tr('nasłuch dalekiego zasięgu, 200 W, wymaga modułu radiowego', 'long-range listening, 200 W, needs the radio module'), true),

  m_lamp: I('m_lamp', 'module', 1, tr('moduł: reflektor', 'module: floodlight'), tr('dwa razy dalsze i szersze światło', 'light reaches twice as far and wide')),
  m_arm: I('m_arm', 'module', 1, tr('moduł: wzmocnione ramię', 'module: heavy arm'), tr('rozbiórka o 40% szybsza', 'salvage 40% faster')),
  m_cells: I('m_cells', 'module', 1, tr('moduł: dodatkowe ogniwa', 'module: extra cells'), tr('+100 Wh baterii Wolta', '+100 Wh for Wolt\'s battery')),
  m_radio: I('m_radio', 'module', 1, tr('moduł: radio', 'module: radio'), tr('odbiór i nadawanie, potrzebny do masztu', 'receive and transmit, needed for the mast')),
  m_remote: I('m_remote', 'module', 1, tr('moduł: zdalne sterowanie', 'module: remote control'), tr('włączanie i wyłączanie maszyn z każdego miejsca sieci', 'switch machines on and off from anywhere on the grid')),
  m_ai: I('m_ai', 'module', 1, tr('moduł: AI II', 'module: AI II'), tr('Q-1 rozpoznaje więcej prądu: widzi przepływy i zakopane kable, liczy 2× szybciej', 'Q-1 senses more current: sees flows and buried cables, computes 2× faster')),
};

// ---------------------------------------------------------------- recipes

export type TechId = 'hand' | 'tools' | 'bench' | 'grid' | 'solar' | 'storage' | 'wind' | 'recycle' | 'modules' | 'cells' | 'radio' | 'remote' | 'ai' | 'mast' | 'sailing';

export type Bag = Partial<Record<ItemId, number>>;

export interface Recipe {
  out: ItemId;
  n: number;
  in: Bag;
  /** s of work (half that at a powered workbench). */
  time: number;
  /** 'hand' = anywhere with the arm, 'bench' = at the workbench. */
  where: 'hand' | 'bench';
  tool?: ToolId;
  /** Known from the start when missing. */
  tech?: TechId;
}

export const RECIPES: Recipe[] = [
  { out: 'cable', n: 5, in: { copper: 1, plastic: 1 }, time: 2, where: 'hand' },
  { out: 'wrench', n: 1, in: { iron: 3 }, time: 3, where: 'hand', tech: 'tools' },
  { out: 'cutter', n: 1, in: { iron: 3, copper: 2, electronics: 1 }, time: 5, where: 'bench', tech: 'tools' },
  { out: 'solder', n: 1, in: { copper: 2, iron: 1, electronics: 1 }, time: 4, where: 'bench', tech: 'bench' },
  { out: 'meter', n: 1, in: { electronics: 1, copper: 1, plastic: 1 }, time: 3, where: 'bench', tech: 'bench' },
  { out: 'frame', n: 1, in: { iron: 4 }, time: 4, where: 'bench', tech: 'bench' },
  { out: 'circuit', n: 1, in: { electronics: 2, copper: 1 }, time: 4, where: 'bench', tool: 'solder', tech: 'bench' },
  { out: 'motor', n: 1, in: { iron: 2, copper: 2, bearings: 1 }, time: 5, where: 'bench', tech: 'bench' },
  { out: 'splitter', n: 1, in: { copper: 2, plastic: 1, iron: 1 }, time: 3, where: 'hand', tech: 'grid' },
  { out: 'lamp', n: 1, in: { iron: 2, glass: 1, copper: 1 }, time: 4, where: 'bench', tech: 'grid' },
  { out: 'pvcell', n: 1, in: { silicon: 2, glass: 1, copper: 1 }, time: 5, where: 'bench', tool: 'solder', tech: 'solar' },
  { out: 'solar', n: 1, in: { frame: 1, pvcell: 2, circuit: 1 }, time: 8, where: 'bench', tech: 'solar' },
  { out: 'cellpack', n: 1, in: { cells: 2, copper: 1, plastic: 1 }, time: 5, where: 'bench', tool: 'solder', tech: 'storage' },
  { out: 'battery', n: 1, in: { cellpack: 2, frame: 1, circuit: 1 }, time: 8, where: 'bench', tech: 'storage' },
  { out: 'charger', n: 1, in: { frame: 1, circuit: 1, copper: 2 }, time: 6, where: 'bench', tech: 'storage' },
  { out: 'wind', n: 1, in: { frame: 2, motor: 1, circuit: 1 }, time: 8, where: 'bench', tech: 'wind' },
  { out: 'recycler', n: 1, in: { frame: 2, motor: 2, circuit: 1 }, time: 10, where: 'bench', tech: 'recycle' },
  { out: 'm_lamp', n: 1, in: { glass: 2, copper: 1, circuit: 1 }, time: 5, where: 'bench', tool: 'solder', tech: 'modules' },
  { out: 'm_arm', n: 1, in: { motor: 1, frame: 1 }, time: 6, where: 'bench', tech: 'modules' },
  { out: 'm_cells', n: 1, in: { cellpack: 2, circuit: 1 }, time: 6, where: 'bench', tool: 'solder', tech: 'cells' },
  { out: 'm_radio', n: 1, in: { circuit: 2, copper: 2, electronics: 1 }, time: 6, where: 'bench', tool: 'solder', tech: 'radio' },
  { out: 'm_remote', n: 1, in: { circuit: 2, electronics: 2 }, time: 6, where: 'bench', tool: 'solder', tech: 'remote' },
  { out: 'm_ai', n: 1, in: { circuit: 3, electronics: 3, copper: 2 }, time: 8, where: 'bench', tool: 'solder', tech: 'ai' },
  { out: 'mast', n: 1, in: { frame: 3, circuit: 2, copper: 4, cable: 10 }, time: 12, where: 'bench', tech: 'mast' },
  // the land yacht (Żaglowóz): parts fitted onto the service cart
  { out: 'yachtmast', n: 1, in: { frame: 1, iron: 3 }, time: 6, where: 'bench', tech: 'sailing' },
  { out: 'sail', n: 1, in: { sailcloth: 3, cable: 6 }, time: 6, where: 'bench', tech: 'sailing' },
  { out: 'runners', n: 1, in: { frame: 1, iron: 4 }, time: 6, where: 'bench', tech: 'sailing' },
];

// ---------------------------------------------------------------- observations and technologies

/**
 * Observations: what Q-1 learns by taking things apart. Technologies need some of them and
 * computing time; that keeps to the decision "development comes from observations and
 * background computing on surplus power" (docs/SWIAT.md, Rozwój), shown here as a tree.
 */
export type ObsId = 'scrap' | 'tools' | 'pv' | 'car_battery' | 'motor' | 'lamp' | 'radio' | 'ai_chip' | 'buried' | 'iceyacht' | 'balloon';

export const OBS: Record<ObsId, string> = {
  scrap: tr('budowa złomu: blachy, śruby, druty', 'how scrap is built: sheet, bolts, wire'),
  tools: tr('narzędzia technika ze skrzynki', 'a technician\'s tools from a crate'),
  pv: tr('budowa panelu fotowoltaicznego', 'how a photovoltaic panel is built'),
  car_battery: tr('akumulator i ogniwa auta', 'a car\'s battery and cells'),
  motor: tr('silnik i łożyska', 'a motor and its bearings'),
  lamp: tr('oprawa latarni ulicznej', 'a street lamp fitting'),
  radio: tr('stara radiostacja', 'an old radio set'),
  ai_chip: tr('układ obliczeniowy serwera', 'a server\'s compute chip'),
  buried: tr('zakopana linia kablowa', 'a buried cable line'),
  iceyacht: tr('rama starego bojerka: płozy, maszt, wanty', 'an old ice yacht\'s frame: runners, mast, shrouds'),
  balloon: tr('powłoka balonu meteo: lekka i szczelna', 'a weather balloon\'s skin: light and airtight'),
};

export interface TechDef {
  id: TechId;
  name: string;
  desc: string;
  needs: TechId[];
  obs: ObsId[];
  /** Wh of computing on surplus power. */
  cost: number;
  /** Column and row in the tree view. */
  col: number;
  row: number;
  /** Extra module slots in Wolt. */
  slots?: number;
}

const T = (id: TechId, col: number, row: number, needs: TechId[], obs: ObsId[], cost: number, name: string, desc: string, slots?: number): TechDef =>
  ({ id, col, row, needs, obs, cost, name, desc, slots });

export const TECHS: Record<TechId, TechDef> = {
  hand: T('hand', 0, 2, [], [], 0, tr('Rozbiórka ręczna', 'Bare-hand salvage'), tr('Ramię Wolta rozbiera małe kupki złomu. Kabel z miedzi i plastiku.', 'Wolt\'s arm takes small scrap piles apart. Cable from copper and plastic.')),
  tools: T('tools', 1, 1, ['hand'], ['scrap', 'tools'], 20, tr('Narzędzia', 'Tools'), tr('Klucz i przecinarka: beczki, kontenery, wraki.', 'Wrench and cutter: barrels, bins, wrecks.')),
  bench: T('bench', 2, 0, ['tools'], ['motor'], 40, tr('Warsztat', 'Workshop'), tr('Lutownica, miernik, ramy, płytki i silniki.', 'Soldering iron, multimeter, frames, boards and motors.')),
  grid: T('grid', 2, 2, ['tools'], ['lamp'], 30, tr('Sieć rozgałęziona', 'Branching grid'), tr('Rozgałęźniki i latarnie: jedno źródło, wiele odbiorników.', 'Splitters and lamps: one source, many consumers.')),
  solar: T('solar', 3, 2, ['grid', 'bench'], ['pv'], 60, tr('Fotowoltaika', 'Photovoltaics'), tr('Moduły PV i panel słoneczny.', 'PV modules and the solar panel.')),
  storage: T('storage', 4, 2, ['solar'], ['car_battery'], 80, tr('Magazynowanie', 'Storage'), tr('Pakiety ogniw, magazyn energii i kołyska ładująca.', 'Cell packs, the battery store and the charging cradle.')),
  wind: T('wind', 3, 0, ['bench'], ['motor'], 60, tr('Turbina wiatrowa', 'Wind turbine'), tr('Własna turbina z silnika jako prądnicy.', 'Your own turbine, a motor run as a generator.')),
  recycle: T('recycle', 4, 0, ['wind'], [], 100, tr('Przetwarzanie', 'Recycling'), tr('Przetwórnia rozbiera złom mieszany sama, gdy ma prąd.', 'The recycler breaks mixed scrap down on its own when it has power.')),
  modules: T('modules', 3, 1, ['bench'], [], 50, tr('Moduły Wolta', 'Wolt\'s modules'), tr('Złącza w ramie Wolta: reflektor, wzmocnione ramię. +1 gniazdo modułu.', 'Sockets in Wolt\'s frame: floodlight, heavy arm. +1 module slot.'), 1),
  cells: T('cells', 5, 2, ['storage', 'modules'], [], 80, tr('Ogniwa Wolta', 'Wolt\'s cells'), tr('Moduł z dodatkowymi ogniwami.', 'A module with extra cells.')),
  radio: T('radio', 4, 1, ['modules'], ['radio'], 80, tr('Radio', 'Radio'), tr('Moduł radiowy. Słychać szum, czasem coś więcej.', 'The radio module. Static, sometimes more.')),
  remote: T('remote', 5, 1, ['radio'], [], 100, tr('Zdalne sterowanie', 'Remote control'), tr('Sterowanie maszynami przez radio i sieć.', 'Run machines over radio and the grid.'), 1),
  ai: T('ai', 4, 3, ['modules'], ['ai_chip'], 150, tr('Rozpoznawanie prądu', 'Current sensing'), tr('Moduł AI II: Q-1 widzi przepływy, zakopane kable i liczy szybciej.', 'AI II module: Q-1 sees flows and buried cables and computes faster.')),
  mast: T('mast', 5, 0, ['radio', 'solar'], [], 150, tr('Maszt antenowy', 'Radio mast'), tr('Maszt na 12 m: nasłuch innych miejsc na Ziemi.', 'A 12 m mast: listening for other places on Earth.')),
  sailing: T('sailing', 3, 3, ['bench'], ['iceyacht', 'balloon'], 60, tr('Żegluga lądowa', 'Land sailing'), tr('Maszt, żagiel i płozy na wózek: Żaglowóz jedzie na wietrze, nie na baterii.', 'A mast, a sail and runners for the cart: the land yacht runs on the wind, not the battery.')),
};

// ---------------------------------------------------------------- scrap

export type ScrapKind = 'pile' | 'crate' | 'barrel' | 'car' | 'solarwreck' | 'dumpster' | 'streetlight' | 'server' | 'radiobox' | 'buried' | 'bearingbox' | 'iceyacht' | 'balloon';

export interface ScrapDef {
  name: string;
  desc: string;
  tool?: ToolId;
  /** s per round. */
  time: number;
  /** Big things come apart in a few rounds, each giving `loot`. */
  rounds: number;
  loot: Bag;
  obs: ObsId[];
  w: number;
  h: number;
  /** Only Wolt with the AI II module sees it. */
  hidden?: boolean;
}

export const SCRAP: Record<ScrapKind, ScrapDef> = {
  pile: { name: tr('kupka złomu', 'scrap pile'), desc: tr('pogięte blachy i druty', 'bent sheet and wire'), time: 2.5, rounds: 1, loot: { iron: 2, copper: 1, plastic: 1, scrapmix: 1 }, obs: ['scrap'], w: 1, h: 1 },
  crate: { name: tr('skrzynia serwisowa', 'service crate'), desc: tr('zamknięta na zatrzaski, w środku coś stuka', 'latched shut, something rattles inside'), time: 3, rounds: 1, loot: { plastic: 2, electronics: 1, iron: 1 }, obs: ['tools'], w: 1, h: 1 },
  bearingbox: { name: tr('skrzynka z częściami', 'parts box'), desc: tr('łożyska w smarze, owinięte w szmatę', 'bearings in grease, wrapped in rags'), time: 3, rounds: 1, loot: { bearings: 2, iron: 1 }, obs: ['motor'], w: 1, h: 1 },
  barrel: { name: tr('beczka', 'barrel'), desc: tr('pusta, obręcze na śrubach', 'empty, the hoops are bolted'), tool: 'wrench', time: 3, rounds: 1, loot: { iron: 3, plastic: 1 }, obs: [], w: 1, h: 1 },
  dumpster: { name: tr('kontener na śmieci', 'dumpster'), desc: tr('plastikowy, z metalową ramą', 'plastic, with a metal frame'), tool: 'wrench', time: 4, rounds: 2, loot: { plastic: 3, iron: 2, scrapmix: 1 }, obs: [], w: 2, h: 1 },
  car: { name: tr('wrak auta', 'car wreck'), desc: tr('karoseria do cięcia; w środku akumulator, silnik, szyby', 'a body to cut open; inside a battery, motor, windows'), tool: 'cutter', time: 5, rounds: 3, loot: { iron: 3, copper: 1, glass: 1, plastic: 1, cells: 1, bearings: 1, electronics: 1 }, obs: ['car_battery', 'motor'], w: 2, h: 3 },
  solarwreck: { name: tr('rozbity panel', 'broken panel'), desc: tr('stara instalacja PV, szkło pęknięte', 'an old PV array, the glass cracked'), tool: 'wrench', time: 4, rounds: 2, loot: { silicon: 2, glass: 2, copper: 1 }, obs: ['pv'], w: 2, h: 2 },
  streetlight: { name: tr('przewrócona latarnia', 'fallen lamp post'), desc: tr('słup do pocięcia, oprawa ze szkłem', 'a pole to cut up, a fitting with glass'), tool: 'cutter', time: 4, rounds: 1, loot: { iron: 3, copper: 2, glass: 1, electronics: 1 }, obs: ['lamp'], w: 3, h: 1 },
  server: { name: tr('szafa serwerowa', 'server cabinet'), desc: tr('przewrócona, pełna płyt', 'toppled, full of boards'), tool: 'wrench', time: 5, rounds: 2, loot: { electronics: 3, copper: 1, plastic: 1 }, obs: ['ai_chip'], w: 1, h: 1 },
  radiobox: { name: tr('skrzynka radiowa', 'radio box'), desc: tr('przemiennik na słupku, antena urwana', 'a repeater on a post, the aerial snapped off'), tool: 'wrench', time: 4, rounds: 1, loot: { electronics: 2, copper: 2 }, obs: ['radio'], w: 1, h: 1 },
  iceyacht: { name: tr('wrak bojerka', 'ice yacht wreck'), desc: tr('rama na trzech płozach, maszt złamany', 'a frame on three runners, the mast snapped'), tool: 'wrench', time: 4, rounds: 1, loot: { runners: 1, iron: 3 }, obs: ['iceyacht'], w: 3, h: 2 },
  balloon: { name: tr('balon meteo', 'weather balloon'), desc: tr('spadł z nieba lata temu, powłoka jeszcze cała', 'fell from the sky years ago, the skin still whole'), time: 3, rounds: 2, loot: { sailcloth: 2, electronics: 1 }, obs: ['balloon'], w: 2, h: 2 },
  buried: { name: tr('zakopany kabel', 'buried cable'), desc: tr('Q-1 czuje w nim resztkę prądu', 'Q-1 senses a trace of current in it'), time: 6, rounds: 1, loot: { copper: 8, cable: 10 }, obs: ['buried'], w: 1, h: 4, hidden: true },
};

// ---------------------------------------------------------------- buildings

/** Fixed things in the yard plus everything Wolt can build. */
export type BuildKind = 'bench' | 'oldturbine' | BuildingId;

export interface BuildDef {
  name: string;
  w: number;
  h: number;
  /** How many cables can plug in. */
  sockets: number;
  /** Wh it can store. */
  store?: number;
  /** Does it have an on/off switch. */
  switchable?: boolean;
}

export const BUILD: Record<BuildKind, BuildDef> = {
  bench: { name: tr('stół warsztatowy', 'workbench'), w: 3, h: 1, sockets: 1, switchable: false },
  oldturbine: { name: tr('stara turbina', 'old turbine'), w: 2, h: 2, sockets: 1, switchable: true },
  splitter: { name: ITEMS.splitter.name, w: 1, h: 1, sockets: 4 },
  lamp: { name: ITEMS.lamp.name, w: 1, h: 1, sockets: 2, switchable: true },
  solar: { name: ITEMS.solar.name, w: 2, h: 2, sockets: 1, switchable: true },
  wind: { name: ITEMS.wind.name, w: 2, h: 2, sockets: 1, switchable: true },
  battery: { name: ITEMS.battery.name, w: 2, h: 1, sockets: 2, store: 2000, switchable: true },
  charger: { name: ITEMS.charger.name, w: 2, h: 2, sockets: 1, switchable: true },
  recycler: { name: ITEMS.recycler.name, w: 2, h: 2, sockets: 1, switchable: true },
  mast: { name: ITEMS.mast.name, w: 2, h: 2, sockets: 1, switchable: true },
};

/** Watts. */
export const POWER = {
  solarPeak: 400,
  windPeak: 300,
  oldTurbine: 180,
  lamp: 40,
  benchIdle: 10,
  benchWork: 150,
  charger: 300,
  recycler: 500,
  mast: 200,
} as const;

// ---------------------------------------------------------------- radio contacts

/** What the mast hears, in order. Human writing is unreadable to Q-1 at first (docs/DECYZJE.md, 2026-11-08). */
export const CONTACTS: { name: string; text: string }[] = [
  { name: tr('Rozdzielnia R-2', 'Substation R-2'), text: tr('Automatyczny nadajnik, 1 impuls na minutę: stan baterii 3%. Ktoś zostawił tam wózek.', 'An automatic beacon, one pulse a minute: battery at 3%. Someone left a cart there.') },
  { name: tr('Szum z północy', 'Static from the north'), text: tr('Regularny wzór, nie z natury. Q-1 rozpoznaje echo innego prototypu. Kierunek: Las Słupów.', 'A regular pattern, not natural. Q-1 recognises the echo of another prototype. Bearing: the Pylon Forest.') },
  { name: tr('Bunkier, głos ludzki', 'A bunker, a human voice'), text: tr('Mowa. Q-1 nie rozumie słów, zapisuje próbkę do korpusu. Powtarza się co godzinę.', 'Speech. Q-1 does not understand the words and saves a sample to the corpus. It repeats every hour.') },
  { name: tr('Daleki przekaźnik', 'A far relay'), text: tr('Stary satelitarny kanał serwisowy jeszcze odpowiada. Ktoś po drugiej stronie odpisał: „…”', 'An old satellite service channel still answers. Someone on the other side wrote back: "…"') },
];
