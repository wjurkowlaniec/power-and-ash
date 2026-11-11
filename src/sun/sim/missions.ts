import { V2 } from '../../sim/vec';
import { tr } from '../../i18n';

/**
 * Deliveries in the sun: pick the load up at A, bring it to B. The load lives off the
 * yacht's solar panels and has a small buffer for the shade. The wind blows from the
 * west-north-west (towards the east-south-east) and carries the clouds with it.
 */
export interface Mission {
  id: string;
  name: string;
  /** What is carried and what happens to it when the power runs out. */
  cargo: string;
  lost: string;
  hint: string;
  start: V2; heading: number;
  /** Pick-up and drop-off. */
  a: V2; b: V2;
  /** Share of the ground in cloud shade, the clouds' speed as a share of the wind, the sky seed. */
  cover: number; cloudK: number; seed: number;
  gear: 'wheels' | 'runners';
}

export const MISSIONS: Mission[] = [
  {
    id: 'seedlings', name: tr('Sadzonki do wsi', 'Seedlings to the village'),
    cargo: tr('inkubator z sadzonkami', 'an incubator of seedlings'),
    lost: tr('Sadzonki zmarzły w cieniu.', 'The seedlings froze in the shade.'),
    hint: tr('Z wiatrem, drogą na wschód. Chmury płyną w tę samą stronę: dogoń prześwit i jedź w nim.', 'Downwind, east along the road. The clouds drift the same way: catch a gap and ride inside it.'),
    start: { x: 48, y: 196 }, heading: 0, a: { x: 72, y: 196 }, b: { x: 352, y: 192 },
    cover: 0.35, cloudK: 0.5, seed: 13, gear: 'wheels',
  },
  {
    id: 'samples', name: tr('Próbki pod wiatr', 'Samples upwind'),
    cargo: tr('chłodziarka z próbkami', 'a cooler of samples'),
    lost: tr('Próbki się zagrzały: chłodziarka stanęła.', 'The samples warmed up: the cooler stopped.'),
    hint: tr('Ze wsi pod wiatr na zachód, do skraju lasu. Halsujesz, a cienie płyną prosto na ciebie: czekaj w słońcu na lukę.', 'From the village upwind to the edge of the wood. You tack while the shadows drift straight at you: wait in the sun for a gap.'),
    start: { x: 330, y: 210 }, heading: Math.PI, a: { x: 318, y: 212 }, b: { x: 100, y: 170 },
    cover: 0.42, cloudK: 0.55, seed: 5, gear: 'wheels',
  },
  {
    id: 'culture', name: tr('Hodowla przez wydmy', 'A culture over the dunes'),
    cargo: tr('szklana hodowla mchu', 'a glass moss culture'),
    lost: tr('Mech zwiędł bez światła.', 'The moss withered without light.'),
    hint: tr('Przez solnisko i wydmy, więcej chmur i szybszych. Na wydmach płozy (R), a na płozach silnik Wolta nie pomoże.', 'Over the salt pan and the dunes, more clouds and faster. Runners on the dunes (R), and on runners Wolt’s motor cannot help.'),
    start: { x: 30, y: 300 }, heading: 0.1, a: { x: 52, y: 302 }, b: { x: 372, y: 340 },
    cover: 0.5, cloudK: 0.7, seed: 9, gear: 'wheels',
  },
];
