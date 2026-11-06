import { Obstacle } from './world';
import { V2 } from './vec';

export interface PortDef {
  id: string;
  name: string;
  node: string;   // power node it belongs to
  pos: V2;        // where the cable attaches (ground plane)
  height: number; // visual height of the socket
}

export interface LevelDef {
  width: number;
  height: number;
  obstacles: Obstacle[];
  ports: PortDef[];
  playerStart: V2;
  yacht: { x: number; y: number; w: number; h: number };
  station: { x: number; y: number; w: number; h: number };
}

/**
 * MVP map, 64 × 48 m. The yacht port and the station port are 17 m apart in a straight
 * line, but a container wall stands between them. Around the north end the cable needs
 * about 18.4 m (fits, in the orange zone). Around the south end it needs about 22.7 m (too long).
 */
export function mvpLevel(): LevelDef {
  const yacht = { x: 4, y: 20, w: 12, h: 6 };
  const station = { x: 34, y: 18, w: 7, h: 7 };
  const o: Obstacle[] = [
    { kind: 'yacht', ...yacht },
    { kind: 'station', ...station },
    // container wall between yacht and station
    { kind: 'container', x: 24, y: 21, w: 2, h: 5 },
    { kind: 'container', x: 24, y: 26, w: 2, h: 5 },
    // rocks
    { kind: 'rock', x: 19, y: 15, w: 2, h: 2 },
    { kind: 'rock', x: 29, y: 13, w: 3, h: 2 },
    { kind: 'rock', x: 12, y: 12, w: 2, h: 3 },
    { kind: 'rock', x: 44, y: 30, w: 3, h: 3 },
    { kind: 'rock', x: 8, y: 34, w: 2, h: 2 },
    { kind: 'rock', x: 50, y: 12, w: 2, h: 2 },
    { kind: 'rock', x: 38, y: 36, w: 2, h: 3 },
    // scrap field south
    { kind: 'scrap', x: 17, y: 33, w: 2, h: 1 },
    { kind: 'scrap', x: 20, y: 35, w: 1, h: 2 },
    { kind: 'scrap', x: 23, y: 34, w: 2, h: 2 },
    { kind: 'scrap', x: 27, y: 36, w: 1, h: 1 },
    { kind: 'scrap', x: 18, y: 38, w: 3, h: 1 },
    { kind: 'scrap', x: 29, y: 33, w: 2, h: 1 },
    { kind: 'barrel', x: 26, y: 39, w: 1, h: 1 },
    { kind: 'barrel', x: 22, y: 40, w: 1, h: 1 },
    // crates near the yacht
    { kind: 'crate', x: 17, y: 19, w: 1, h: 1 },
    { kind: 'crate', x: 6, y: 27, w: 1, h: 1 },
    { kind: 'crate', x: 7, y: 27, w: 1, h: 1 },
    // old pylons
    { kind: 'pylon', x: 30, y: 6, w: 2, h: 2 },
    { kind: 'pylon', x: 54, y: 24, w: 2, h: 2 },
  ];
  const ports: PortDef[] = [
    { id: 'yacht', name: 'port żaglowozu', node: 'yacht', pos: { x: 16.45, y: 24.5 }, height: 1.0 },
    { id: 'station', name: 'port Stacji 2', node: 'station', pos: { x: 33.55, y: 23.5 }, height: 0.75 },
  ];
  return { width: 64, height: 48, obstacles: o, ports, playerStart: { x: 17.3, y: 24.2 }, yacht, station };
}
