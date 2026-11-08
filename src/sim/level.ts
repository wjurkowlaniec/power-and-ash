import { Obstacle } from './world';
import { V2 } from './vec';
import { LoadKind } from './tow';
import { tr } from '../i18n';

export interface PortDef {
  id: string;
  name: string;
  node: string;   // power node it belongs to
  pos: V2;        // where the cable attaches (ground plane)
  height: number; // visual height of the socket
}

/** A spot Wolt can use with E (fabricator, helm). */
export interface StationPoint { id: 'fabricator' | 'helm'; name: string; pos: V2 }

export interface LevelDef {
  name: string;
  width: number;
  height: number;
  obstacles: Obstacle[];
  ports: PortDef[];
  points: StationPoint[];
  playerStart: V2;
  startReel: number; // metres of cable Wolt starts with
  yacht: { x: number; y: number; w: number; h: number };
  station: { x: number; y: number; w: number; h: number };
  stationOutput: number; // W the old station still produces
  yachtBattery: number;  // Wh to charge before leaving
  /** Loose things Wolt can tow. */
  loads?: { kind: LoadKind; pos: V2; angle?: number }[];
}

/**
 * Level 1 "Rozruch". The yacht's battery is flat. Station 2 still has working solar
 * panels. Wolt has no cable: salvage scrap, craft 20 m in the fabricator, connect the
 * station to the yacht, wait for the charge, then leave.
 *
 * The ports are 17 m apart in a straight line with a container wall between them.
 * Around the north end the cable needs about 18.4 m. Around the south end it needs about 22.7 m (too long).
 */
export function level1(): LevelDef {
  const yacht = { x: 4, y: 20, w: 12, h: 6 };
  const station = { x: 34, y: 18, w: 7, h: 7 };
  const o: Obstacle[] = [
    { kind: 'yacht', ...yacht },
    { kind: 'station', ...station },
    { kind: 'container', x: 24, y: 21, w: 2, h: 5 },
    { kind: 'container', x: 24, y: 26, w: 2, h: 5 },
    { kind: 'rock', x: 19, y: 15, w: 2, h: 2 },
    { kind: 'rock', x: 29, y: 13, w: 3, h: 2 },
    { kind: 'rock', x: 12, y: 12, w: 2, h: 3 },
    { kind: 'rock', x: 44, y: 30, w: 3, h: 3 },
    { kind: 'rock', x: 8, y: 34, w: 2, h: 2 },
    { kind: 'rock', x: 50, y: 12, w: 2, h: 2 },
    { kind: 'rock', x: 38, y: 36, w: 2, h: 3 },
    // salvageable scrap: 6 copper, 6 plastic, 5 iron in total (the cable needs 4 + 4)
    { kind: 'scrap', x: 18, y: 34, w: 2, h: 1, loot: { copper: 1, iron: 1 }, name: tr('skrzynka przyłączeniowa', 'junction box'), desc: tr('zgnieciona puszka po bezpiecznikach, w środku miedziane szyny', 'a crushed fuse box with copper bus bars inside') },
    { kind: 'scrap', x: 23, y: 35, w: 2, h: 2, loot: { copper: 1, plastic: 2 }, name: tr('zwój starego przewodu', 'coil of old wire'), desc: tr('splątany kabel w popękanej izolacji', 'tangled cable in cracked insulation') },
    { kind: 'scrap', x: 28, y: 37, w: 1, h: 1, loot: { plastic: 1, glass: 1 }, name: tr('rozbita lampa uliczna', 'broken street lamp'), desc: tr('klosz z grubego szkła, obudowa z tworzywa', 'a thick glass cover in a plastic housing') },
    { kind: 'scrap', x: 14, y: 8, w: 2, h: 1, loot: { copper: 2, iron: 1 }, name: tr('silnik pompy', 'pump motor'), desc: tr('zatarty, ale uzwojenie z miedzi jest całe', 'seized, but the copper winding is intact') },
    { kind: 'scrap', x: 26, y: 9, w: 1, h: 2, loot: { plastic: 1, iron: 1 }, name: tr('połamane krzesło biurowe', 'broken office chair'), desc: tr('stalowy stelaż i plastikowe siedzisko', 'a steel frame and a plastic seat') },
    { kind: 'scrap', x: 45, y: 17, w: 2, h: 1, loot: { copper: 1, plastic: 1 }, name: tr('tablica sterownicza', 'control board'), desc: tr('panel z przełącznikami, na tyłach wiązka przewodów', 'a panel of switches with a wire harness at the back') },
    { kind: 'scrap', x: 32, y: 31, w: 2, h: 1, loot: { copper: 1, plastic: 1, iron: 2 }, name: tr('wrak skutera', 'scooter wreck'), desc: tr('rama, kawałek owiewki, resztki instalacji', 'frame, a piece of fairing, what is left of the wiring') },
    { kind: 'barrel', x: 26, y: 39, w: 1, h: 1, loot: { iron: 2 }, name: tr('pusta beczka', 'empty barrel'), desc: tr('blacha stalowa, nic w środku', 'sheet steel, nothing inside') },
    { kind: 'barrel', x: 22, y: 40, w: 1, h: 1, loot: { plastic: 1, iron: 1 }, name: tr('beczka z wężem', 'barrel with a hose'), desc: tr('blaszana beczka z plastikowym wężem i zaworem', 'a steel barrel with a plastic hose and a valve') },
    { kind: 'crate', x: 17, y: 18, w: 1, h: 1 },
    { kind: 'crate', x: 6, y: 27, w: 1, h: 1 },
    { kind: 'crate', x: 7, y: 27, w: 1, h: 1 },
    { kind: 'pylon', x: 30, y: 6, w: 2, h: 2 },
    // dead trees (the trunk blocks one tile)
    { kind: 'tree', x: 10, y: 41, w: 1, h: 1 },
    { kind: 'tree', x: 47, y: 7, w: 1, h: 1 },
    { kind: 'tree', x: 57, y: 37, w: 1, h: 1 },
    { kind: 'tree', x: 4, y: 9, w: 1, h: 1 },
    { kind: 'tree', x: 35, y: 43, w: 1, h: 1 },
    { kind: 'tree', x: 60, y: 16, w: 1, h: 1 },
    { kind: 'tree', x: 21, y: 4, w: 1, h: 1 },
    { kind: 'pylon', x: 54, y: 24, w: 2, h: 2 },
  ];
  const ports: PortDef[] = [
    { id: 'yacht', name: tr('port żaglowozu', 'the yacht port'), node: 'yacht', pos: { x: 16.45, y: 24.5 }, height: 1.0 },
    { id: 'station', name: tr('port Stacji 2', 'the Station 2 port'), node: 'station', pos: { x: 33.55, y: 23.5 }, height: 0.75 },
  ];
  const points: StationPoint[] = [
    { id: 'fabricator', name: tr('fabrykator', 'fabricator'), pos: { x: 8.5, y: 19.55 } },
    { id: 'helm', name: tr('ster', 'helm'), pos: { x: 3.55, y: 23 } },
  ];
  return {
    name: tr('Poziom 1 · Rozruch', 'Level 1 · Jump Start'), width: 64, height: 48, obstacles: o, ports, points,
    playerStart: { x: 9.5, y: 18.6 }, startReel: 0, yacht, station,
    stationOutput: 600, yachtBattery: 2000,
    loads: [
      { kind: 'tyre', pos: { x: 12.6, y: 16.4 } },
      { kind: 'bricks', pos: { x: 5.6, y: 16.2 }, angle: 0.4 },
    ],
  };
}
