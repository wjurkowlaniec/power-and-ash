import { tr } from '../i18n';
import { sailCn, YACHT } from './sim/landYacht';

/**
 * The intro: how the wind works, drawn like a pencil sketch on ash-grey paper. Lines "boil"
 * (re-jitter eight times a second) like hand-drawn animation; everything moves slowly.
 * Five short scenes: the wind and its gusts, the lee of a house, the apparent wind,
 * the forces on the sail, the heel. The numbers come from the same model the yacht sails by.
 */
const INK = '#2b2c2e', PAPER = '#d8d4ca', WIND = '#557f91', SAIL = '#b4623a', DRIVE = '#4f8a5b', SIDE = '#b9503c', SOFT = '#2b2c2e55';

type P = [number, number];

function hash(a: number, b: number) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }

/** A pencil: wobbly lines that re-jitter in steps. */
class Pen {
  frame = 0;
  constructor(public c: CanvasRenderingContext2D) {}
  private j(i: number, k: number, amt: number) { return (hash(i * 1.37 + k * 0.71, this.frame * 3.1 + k) - 0.5) * amt; }
  line(pts: P[], color = INK, w = 2, wobble = 1.6, id = 0) {
    const c = this.c;
    if (pts.length < 2) return;
    c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] + this.j(i, id * 2, wobble), y = p[1] + this.j(i, id * 2 + 1, wobble);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
  }
  /** A straight stroke broken into a few wobbly segments, slightly overshooting like a sketch. */
  stroke(a: P, b: P, color = INK, w = 2, id = 0) {
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 30));
    const pts: P[] = [];
    for (let i = 0; i <= n; i++) { const t = -0.02 + (i / n) * 1.04; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    this.line(pts, color, w, 1.4, id);
  }
  arrow(a: P, b: P, color: string, w = 3, label = '', id = 0) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4) return;
    this.stroke(a, b, color, w, id);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = Math.min(18, 6 + L * 0.2);
    this.stroke(b, [b[0] - Math.cos(ang - 0.45) * h, b[1] - Math.sin(ang - 0.45) * h], color, w, id + 1);
    this.stroke(b, [b[0] - Math.cos(ang + 0.45) * h, b[1] - Math.sin(ang + 0.45) * h], color, w, id + 2);
    if (label) this.text(label, b[0] + Math.cos(ang) * 14, b[1] + Math.sin(ang) * 14 + 5, color, 15, ang > Math.PI / 2 || ang < -Math.PI / 2 ? 'right' : 'left');
  }
  ring(x: number, y: number, r: number, color = INK, w = 2, id = 0) {
    const pts: P[] = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2 + 0.2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    this.line(pts, color, w, 1.2, id);
  }
  text(s: string, x: number, y: number, color = INK, size = 15, align: CanvasTextAlign = 'center') {
    const c = this.c;
    c.fillStyle = color; c.font = `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`; c.textAlign = align;
    c.fillText(s, x, y);
  }
  /** Hatching inside a rectangle (a house seen from above). */
  hatch(x: number, y: number, w: number, h: number, color = INK) {
    this.c.save();
    this.c.beginPath(); this.c.rect(x, y, w, h); this.c.clip();
    for (let k = -h; k < w; k += 9) this.stroke([x + k, y + h], [x + k + h, y], color, 1.2, k);
    this.c.restore();
    this.line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], INK, 2.5, 1.5, 7);
  }
}

interface Scene { title: string; text: string; draw(p: Pen, t: number): void }

/** Flowing wind strokes along a path y(x): short dashes that travel with the air. */
function flow(p: Pen, y: (x: number) => number, t: number, speed: (x: number) => number, color: string, w: number, id: number, x0 = 0, x1 = 1000) {
  // each dash rides the flow: its position advances by the local speed
  const gap = 90;
  for (let k = 0; k < 14; k++) {
    let x = x0 + (((k * gap + t * 70 + id * 37) % (x1 - x0 + gap)) + (x1 - x0 + gap)) % (x1 - x0 + gap) - gap / 2;
    const s = speed(x);
    if (s < 0.08) continue;
    const len = 18 + 38 * s;
    const pts: P[] = [];
    for (let i = 0; i <= 5; i++) { const xx = x + (i / 5) * len; pts.push([xx, y(xx)]); }
    x += len;
    p.line(pts, color, w * (0.6 + 0.6 * s), 1.1, id * 31 + k);
  }
}

/** Top-down yacht: hull triangle, axle, wheels, mast; returns the mast point. Heading up (−y). */
function yachtTop(p: Pen, x: number, y: number, scale: number, boom: number, side: number, fill: number, t: number): P {
  const s = scale;
  p.line([[x, y - 70 * s], [x + 22 * s, y + 40 * s], [x - 22 * s, y + 40 * s], [x, y - 70 * s]], INK, 2.5, 1.2, 101);
  p.stroke([x - 48 * s, y + 30 * s], [x + 48 * s, y + 30 * s], INK, 3, 102);
  for (const sx of [-1, 1]) p.line([[x + sx * 48 * s, y + 20 * s], [x + sx * 48 * s, y + 42 * s]], INK, 6, 0.8, 103 + sx);
  p.line([[x, y - 76 * s], [x, y - 58 * s]], INK, 5, 0.8, 106);
  const mast: P = [x, y - 20 * s];
  p.ring(mast[0], mast[1], 4 * s, INK, 2.5, 107);
  // the boom goes aft from the mast, swung out to one side; the sail bellies out to leeward
  const L = 80 * s;
  const end: P = [mast[0] + side * Math.sin(boom) * L, mast[1] + Math.cos(boom) * L];
  const nx = side * Math.cos(boom), ny = -Math.sin(boom); // normal to the boom, leeward and forward
  const pts: P[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const belly = Math.sin(u * Math.PI) * (6 + 16 * fill) * s;
    const flap = (1 - fill) * Math.sin(u * 9 - t * 14) * 7 * s * Math.sin(u * Math.PI);
    pts.push([mast[0] + (end[0] - mast[0]) * u + nx * (belly + flap), mast[1] + (end[1] - mast[1]) * u + ny * (belly + flap)]);
  }
  p.line(pts, SAIL, 4, 1, 108);
  p.stroke(mast, end, INK, 2, 109);
  return mast;
}

function scenes(): Scene[] {
  return [
    {
      title: tr('Wiatr', 'The wind'),
      text: tr('Wiatr nie wieje równo. Szkwały, czyli mocniejsze podmuchy, wędrują razem z wiatrem; na popiele widać je jako ciemne, biegnące zmarszczki. Między nimi trafiają się flauty, dziury bez wiatru. Patrz pod wiatr: to, co nadchodzi, będzie u ciebie za chwilę.',
        'The wind is never even. Gusts, the stronger puffs, travel with the wind; on the ash they show as dark running ripples. Between them there are lulls, holes with no wind. Look upwind: what comes there will reach you in a moment.'),
      draw(p, t) {
        const gx = ((t * 55) % 1300) - 150, gy = 300 + Math.sin(t * 0.4) * 40;
        const lx = ((t * 55 + 650) % 1300) - 150, ly = 170;
        for (let i = 0; i < 13; i++) {
          const y0 = 60 + i * 42;
          const yf = (x: number) => y0 + Math.sin(x * 0.006 + i * 0.7 + t * 0.3) * 10;
          const sp = (x: number) => {
            const g = Math.exp(-((x - gx) ** 2 / 26000 + (y0 - gy) ** 2 / 9000));
            const l = Math.exp(-((x - lx) ** 2 / 18000 + (y0 - ly) ** 2 / 5000));
            return Math.max(0, 0.45 + 0.7 * g - 0.5 * l);
          };
          flow(p, yf, t, sp, WIND, 2, i);
        }
        // cat's paws in the gust: little dark ripples on the ground
        for (let k = 0; k < 26; k++) {
          const x = gx + (hash(k, 1) - 0.5) * 260, y = gy + (hash(k, 2) - 0.5) * 150;
          if (Math.hypot((x - gx) / 130, (y - gy) / 75) > 1) continue;
          p.line([[x, y], [x + 7, y - 3], [x + 14, y]], INK, 1.5, 0.8, 300 + k);
        }
        p.text(tr('szkwał', 'gust'), gx, gy + 100, INK, 15);
        p.text(tr('flauta', 'lull'), lx, ly - 52, SOFT, 15);
        p.arrow([40, 560], [150, 560], WIND, 3, tr('wiatr', 'wind'), 400);
      },
    },
    {
      title: tr('Cień wiatrowy', 'The lee'),
      text: tr('Za domem, murem albo kępą drzew wiatr siada na długość kilku, nawet dziesięciu ich wysokości, a na brzegach tego cienia kręci się i szarpie. Gołe drzewa i kratownice słupów przepuszczają większość wiatru. Za wsią żaglowóz zwalnia; ktoś, kto zna ten teren, omija ją albo przecina szybko.',
        'Behind a house, a wall or a clump of trees the wind drops for several, even ten of their heights, and at the edges of that shadow it swirls and tugs. Bare trees and lattice pylons let most of it through. Behind the village the yacht slows down; someone who knows the land goes round it or cuts through fast.'),
      draw(p, t) {
        const hx = 300, hy = 250, hw = 110, hh = 100, cy = hy + hh / 2;
        const wake = (x: number, y: number) => {
          if (x < hx) return 1;
          const along = x - hx, w = hh / 2 + along * 0.13;
          const k = Math.max(0, 1 - along / 650) ** 1.2 * Math.exp(-(((y - cy) / w) ** 4));
          return 1 - 0.85 * k;
        };
        for (let i = 0; i < 13; i++) {
          const y0 = 50 + i * 42;
          const off = y0 - cy;
          const yf = (x: number) => {
            // the air bends round the house
            const near = Math.exp(-(((x - hx - hw / 2) / 120) ** 2)) * Math.exp(-((off / 120) ** 2));
            return y0 + Math.sign(off || 1) * near * 45 + Math.sin(x * 0.01 + i) * 4;
          };
          flow(p, yf, t, x => wake(x, yf(x)), WIND, 2, i + 20);
        }
        p.hatch(hx, hy, hw, hh);
        // eddies at the edges of the wake
        for (let k = 0; k < 6; k++) {
          const ex = hx + hw + 40 + k * 70 + ((t * 25) % 70), side = k % 2 ? 1 : -1;
          const ey = cy + side * (hh / 2 + (ex - hx) * 0.1);
          const pts: P[] = [];
          for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 1.6 + t * 2.5 * side, r = 4 + i * 1.3; pts.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r]); }
          p.line(pts, WIND, 1.6, 0.7, 500 + k);
        }
        p.text(tr('cisza', 'calm'), hx + hw + 150, cy + 6, SOFT, 16);
        p.text(tr('dom', 'house'), hx + hw / 2, hy - 14, INK, 14);
        p.arrow([40, 560], [150, 560], WIND, 3, tr('wiatr', 'wind'), 600);
      },
    },
    {
      title: tr('Wiatr pozorny', 'The apparent wind'),
      text: tr('Żagiel czuje nie ten wiatr, który wieje nad ziemią, tylko ten, który czujesz jadąc: wiatr rzeczywisty plus pęd jazdy prosto w twarz. Im szybciej jedziesz, tym bardziej wiatr pozorny przychodzi z przodu i tym jest silniejszy. Dlatego żaglowóz potrafi jechać szybciej niż sam wiatr, a żagiel trzeba wybierać, gdy przyspieszasz.',
        'The sail does not feel the wind blowing over the ground, but the one you feel while moving: the true wind plus the rush of your own speed in your face. The faster you go, the more the apparent wind comes from ahead and the stronger it is. That is why a land yacht can go faster than the wind itself, and why you haul in the sheet as you speed up.'),
      draw(p, t) {
        const W = 7, v = W * (1 + Math.sin(t * 0.45 - 1.4)) * 1.1; // 0 … 15 m/s and back
        const k = 16; // px per m/s
        const cx = 360, cy = 330;
        // the ground runs past: marks scroll down with the speed
        for (let i = 0; i < 18; i++) {
          const y = ((i * 37 + t * v * 9) % 640) - 20, x = 120 + hash(i, 5) * 480;
          p.line([[x, y], [x + 10, y + 1]], SOFT, 1.5, 0.6, 700 + i);
        }
        // true wind from the left (beam reach), head wind from the motion, apparent = sum
        const tw: P = [W * k, 0], hw: P = [0, v * k], app: P = [tw[0] + hw[0], tw[1] + hw[1]];
        const mast = yachtTop(p, cx, cy, 1.25, Math.max(0.1, Math.atan2(app[0], app[1]) - YACHT.stall) , 1, 1, t);
        const o: P = [mast[0] - app[0] - 60, mast[1] - app[1] - 10];
        p.arrow(o, [o[0] + tw[0], o[1] + tw[1]], WIND, 3, tr('rzeczywisty', 'true'), 710);
        p.arrow([o[0] + tw[0], o[1] + tw[1]], [o[0] + app[0], o[1] + app[1]], '#77736b', 2.5, v > 1 ? tr('pęd jazdy', 'own speed') : '', 720);
        p.arrow(o, [o[0] + app[0], o[1] + app[1]], SAIL, 4, '', 730);
        const appA = Math.round(Math.atan2(app[0], app[1]) * 180 / Math.PI);
        p.text(tr('pozorny', 'apparent'), o[0] + app[0] * 0.5 - 70, o[1] + app[1] * 0.5 + 4, SAIL, 15);
        // the numbers
        const x = 700;
        p.text(`${tr('wiatr', 'wind')}       ${W.toFixed(0)} m/s`, x, 220, WIND, 17, 'left');
        p.text(`${tr('prędkość', 'speed')}    ${v.toFixed(0)} m/s`, x, 252, INK, 17, 'left');
        p.text(`${tr('pozorny', 'apparent')}    ${Math.hypot(W, v).toFixed(0)} m/s`, x, 284, SAIL, 17, 'left');
        p.text(`${tr('od dziobu', 'off the bow')}  ${appA}°`, x, 316, SAIL, 17, 'left');
      },
    },
    {
      title: tr('Siły na żaglu', 'Forces on the sail'),
      text: tr('Wiatr pozorny opływa żagiel i pcha go prostopadle do jego powierzchni. Tylko część tej siły ciągnie do przodu (zielona), reszta pcha w bok (czerwona); w bok trzymają koła albo płozy. Szot ustawia kąt: za luźno żagiel łopocze i nic nie daje, za ciasno się dławi, mniej ciągnie, a mocniej przechyla. Najlepiej tuż przed łopotaniem.',
        'The apparent wind flows round the sail and pushes it at right angles to its surface. Only part of that force pulls forward (green); the rest pushes sideways (red), and the wheels or runners hold against it. The sheet sets the angle: too loose and the sail flaps and gives nothing, too tight and it stalls, pulls less and heels more. Best is just short of flapping.'),
      draw(p, t) {
        const cx = 420, cy = 330;
        const beta = 1.25; // apparent wind 72° off the bow, from the left
        // the sheet sweeps: luffing → right → stalled, and back
        const ph = (Math.sin(t * 0.35) + 1) / 2;
        const boom = 0.15 + ph * (beta - 0.08);
        const aoa = Math.max(0, beta - boom), cn = sailCn(aoa);
        const fill = Math.min(1, cn / 0.6);
        const mast = yachtTop(p, cx, cy, 1.6, boom, 1, fill, t);
        // wind streams in along the apparent wind
        const dx = Math.sin(beta), dy = Math.cos(beta); // where it blows to (screen): it comes from the upper left
        for (let i = 0; i < 9; i++) {
          const off = (i - 4) * 36;
          const sx = mast[0] - dx * 320 - dy * off, sy = mast[1] - dy * 320 + dx * off;
          for (let k = 0; k < 4; k++) {
            const s0 = ((t * 120 + k * 90 + i * 23) % 360);
            const a: P = [sx + dx * s0, sy + dy * s0];
            if (Math.hypot(a[0] - mast[0], a[1] - mast[1]) < 70) continue;
            p.stroke(a, [a[0] + dx * 30, a[1] + dy * 30], WIND, 1.8, 800 + i * 4 + k);
          }
        }
        // stalled: swirls behind the sail
        if (aoa > 0.65) for (let k = 0; k < 3; k++) {
          const ex = mast[0] + Math.sin(boom) * 60 + 20 + k * 22, ey = mast[1] + Math.cos(boom) * 40 + k * 18;
          const pts: P[] = [];
          for (let i = 0; i <= 12; i++) { const a = i * 0.5 + t * 3, r = 3 + i; pts.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r]); }
          p.line(pts, WIND, 1.5, 0.6, 850 + k);
        }
        // the force: normal to the boom, leeward; drive and side parts
        const N = cn * 120;
        const c: P = [mast[0] + Math.sin(boom) * 45, mast[1] + Math.cos(boom) * 45];
        const nx = Math.cos(boom), ny = -Math.sin(boom);
        p.arrow(c, [c[0] + nx * N, c[1] + ny * N], SAIL, 4, tr('siła żagla', 'sail force'), 860);
        p.arrow(c, [c[0], c[1] - N * Math.sin(boom)], DRIVE, 3.5, tr('ciąg', 'drive'), 870);
        p.arrow(c, [c[0] + N * Math.cos(boom), c[1]], SIDE, 3.5, tr('w bok', 'sideways'), 880);
        // the wheels hold against the side force
        p.arrow([cx + 60, cy + 70], [cx + 60 - N * Math.cos(boom) * 0.5, cy + 70], INK, 2.5, tr('koła trzymają', 'the wheels hold'), 890);
        const state = aoa < 0.12 ? tr('za luźno: łopocze', 'too loose: flapping') : aoa > 0.65 ? tr('za ciasno: dławi się', 'too tight: stalled') : tr('w sam raz', 'just right');
        p.text(state, 780, 200, aoa < 0.12 || aoa > 0.65 ? SIDE : DRIVE, 18, 'left');
        p.text(`${tr('ciąg', 'drive')}  ${Math.round(cn * Math.sin(boom) * 100)}`, 780, 236, DRIVE, 16, 'left');
        p.text(`${tr('w bok', 'sideways')} ${Math.round(cn * Math.cos(boom) * 100)}`, 780, 262, SIDE, 16, 'left');
        p.arrow([mast[0] - dx * 300, mast[1] - dy * 300], [mast[0] - dx * 220, mast[1] - dy * 220], WIND, 3, tr('wiatr pozorny', 'apparent wind'), 895);
      },
    },
    {
      title: tr('Przechył', 'Heeling'),
      text: tr('Siła w bok działa wysoko, na środku żagla, i próbuje przewrócić żaglowóz przez zawietrzne koło; trzyma go ciężar na szerokości osi. Gdy szkwał przyciśnie, nawietrzne koło się unosi: jest szybko i na krawędzi. Wtedy poluzuj szot, odpadnij od wiatru albo przeciągnij balast (skrzynię z baterią na szynie) na nawietrzną. Po zwrocie balast zostaje po złej stronie i pomaga wiatrowi, więc trzeba go przerzucić. Płozy mają szerszy rozstaw i trzymają więcej.',
        'The side force acts high up, in the middle of the sail, and tries to tip the yacht over its leeward wheel; its weight across the axle holds it. When a gust presses, the windward wheel lifts: fast, and on the edge. Then ease the sheet, bear away from the wind, or haul the ballast (the battery box on its rail) to windward. After a tack the ballast is left on the wrong side and helps the wind, so throw it across. Runners have a wider track and hold more.'),
      draw(p, t) {
        // seen from behind: a gust builds, the wheel lifts, the ballast is hauled to windward, it lands
        const cyc = t % 9;
        const gust = cyc < 3 ? cyc / 3 : cyc < 6 ? 1 : Math.max(0, 1 - (cyc - 6) / 2);
        const hike = cyc > 4.2 && cyc < 8 ? Math.min(1, (cyc - 4.2) / 0.6) : 0;
        const side = 0.55 + 0.75 * gust;            // side force, drawn
        const tip = (0.6 + 0.55 * gust) / (1 + 0.45 * hike); // heeling over righting
        const lift = Math.min(0.25, Math.max(0, tip - 1) * 1.6); // rad
        const gx = 480, gy = 500, track = 120, sc = 75;
        // turn about the leeward (right) wheel's contact point: the left wheel rises
        const rot = (q: P): P => {
          const px = gx + track, dx = q[0] - px, dy = q[1] - gy;
          return [px + dx * Math.cos(lift) - dy * Math.sin(lift), gy + dy * Math.cos(lift) + dx * Math.sin(lift)];
        };
        const R = (x: number, y: number) => rot([x, y]);
        p.line([[60, gy], [940, gy]], INK, 2, 1.5, 900); // the ground
        // axle, wheels, deck, mast, sail
        p.line([R(gx - track, gy - 28), R(gx + track, gy - 28)], INK, 4, 1, 901);
        p.ring(...R(gx - track, gy - 28), 26, INK, 3, 902);
        p.ring(...R(gx + track, gy - 28), 26, INK, 3, 903);
        p.line([R(gx - 60, gy - 60), R(gx + 60, gy - 60), R(gx + 60, gy - 85), R(gx - 60, gy - 85), R(gx - 60, gy - 60)], INK, 2.5, 1, 904);
        const top = R(gx, gy - 85 - 3.6 * sc), base = R(gx, gy - 85);
        p.line([base, top], INK, 4, 1, 905);
        p.line([R(gx, gy - 85 - 1.2 * sc), R(gx + 50, gy - 85 - 1.25 * sc), R(gx + 6, gy - 85 - 3.4 * sc)], SAIL, 4, 1, 906);
        // the ballast: the battery box on a rail across the deck, hauled out to windward (left)
        p.line([R(gx - track - 6, gy - 88), R(gx + track + 6, gy - 88)], INK, 2, 1, 907);
        const wx = gx - hike * (track - 16);
        p.line([R(wx - 16, gy - 90), R(wx + 16, gy - 90), R(wx + 16, gy - 118), R(wx - 16, gy - 118), R(wx - 16, gy - 90)], INK, 3, 1, 908);
        p.line([R(wx - 16, gy - 104), R(gx - track - 4, gy - 100)], SAIL, 1.5, 1, 909);
        p.line([R(wx + 16, gy - 104), R(gx + track + 4, gy - 100)], SAIL, 1.5, 1, 911);
        // forces
        const ce = R(gx + 20, gy - 85 - 2.0 * sc), cg = R(gx - hike * 46, gy - 70);
        p.arrow(ce, [ce[0] + 130 * side, ce[1]], SIDE, 4, tr('siła w bok', 'side force'), 910);
        p.arrow(cg, [cg[0], cg[1] + 110], INK, 3.5, tr('ciężar', 'weight'), 920);
        const pivot: P = [gx + track, gy];
        p.ring(pivot[0], pivot[1], 6, SIDE, 2.5, 930);
        p.text(tr('oś obrotu', 'pivot'), pivot[0] + 40, pivot[1] + 26, SIDE, 13);
        p.text(lift > 0.01 ? tr('koło w górze!', 'wheel up!') : hike > 0 ? tr('balast na nawietrznej: trzyma', 'ballast to windward: it holds') : tr('stoi pewnie', 'steady'), 800, 150, lift > 0.01 ? SIDE : DRIVE, 18);
        p.arrow([60, 120], [170, 120], WIND, 3, tr('szkwał', 'gust'), 940);
      },
    },
  ];
}

export class Intro {
  private el: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private pen: Pen;
  private list = scenes();
  private i = 0;
  private t = 0;
  private fade = 0;
  private open = false;
  private last = 0;
  private done: (() => void) | null = null;

  constructor() {
    const el = document.createElement('div');
    el.className = 'intro'; el.hidden = true;
    el.innerHTML = `<canvas></canvas><div class="cap"><div class="lbl n"></div><h2></h2><p></p>
      <div class="nav"><button class="btn" data-a="prev">‹</button><span class="dots"></span><button class="btn go" data-a="next"></button><button class="btn" data-a="skip">${tr('pomiń', 'skip')}</button></div></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.cv = el.querySelector('canvas')!;
    this.pen = new Pen(this.cv.getContext('2d')!);
    el.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.a === 'prev') this.go(this.i - 1);
      else if (b.dataset.a === 'next') this.go(this.i + 1);
      else if (b.dataset.a === 'skip') this.close();
      else if (b.dataset.d) this.go(+b.dataset.d);
    });
    addEventListener('keydown', e => {
      if (!this.open) return;
      if (e.code === 'ArrowRight' || e.code === 'Space' || e.code === 'Enter') { this.go(this.i + 1); e.preventDefault(); e.stopImmediatePropagation(); }
      else if (e.code === 'ArrowLeft') { this.go(this.i - 1); e.stopImmediatePropagation(); }
      else if (e.code === 'Escape') { this.close(); e.stopImmediatePropagation(); }
    }, true);
  }

  get isOpen() { return this.open; }

  show(onDone: () => void) {
    this.done = onDone;
    this.open = true;
    this.el.hidden = false;
    this.go(0);
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private go(i: number) {
    if (i >= this.list.length) { this.close(); return; }
    this.i = Math.max(0, i);
    this.t = 0; this.fade = 0;
    const s = this.list[this.i];
    const q = (sel: string) => this.el.querySelector(sel)!;
    q('.n').textContent = `${tr('JAK DZIAŁA WIATR', 'HOW THE WIND WORKS')} · ${this.i + 1}/${this.list.length}`;
    q('h2').textContent = s.title;
    q('p').textContent = s.text;
    q('.dots').innerHTML = this.list.map((_, k) => `<button class="dot ${k === this.i ? 'on' : ''}" data-d="${k}" aria-label="${k + 1}"></button>`).join('');
    q('[data-a=next]').textContent = this.i === this.list.length - 1 ? tr('Wypłyń', 'Set sail') : tr('dalej ›', 'next ›');
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    const d = this.done; this.done = null;
    d?.();
  }

  private frame = (now: number) => {
    if (!this.open) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.fade = Math.min(1, this.fade + dt * 1.5);
    const cv = this.cv, c = this.pen.c;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAPER; c.fillRect(0, 0, cv.width, cv.height);
    // paper grain
    c.fillStyle = '#00000008';
    for (let k = 0; k < 140; k++) c.fillRect(hash(k, 9) * cv.width, hash(k, 3) * cv.height, 2 * dpr, 2 * dpr);
    // the drawing lives in a 1000 × 600 box, fitted into the space above the caption
    const capH = (this.el.querySelector('.cap') as HTMLElement).offsetHeight + 20;
    const s = Math.min(w / 1000, (h - capH) / 620) * dpr;
    c.setTransform(s, 0, 0, s, (cv.width - 1000 * s) / 2, Math.max(0, (cv.height - capH * dpr - 600 * s) / 2));
    c.globalAlpha = this.fade;
    this.pen.frame = Math.floor(this.t * 8);
    this.list[this.i].draw(this.pen, this.t);
    c.globalAlpha = 1;
    requestAnimationFrame(this.frame);
  };
}
