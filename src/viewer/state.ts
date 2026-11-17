/**
 * Pure helpers for the model viewer (/viewer/): the link state in the URL hash, the
 * search filter, framing distance and the playback clock. No Three.js, so they are tested.
 */

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

/** What the address bar keeps: the model, the view flags and changed parameters. */
export interface LinkState { id: string | null; params: Params }

const NUM = /^-?\d+(\.\d+)?$/;

/** `#wolt&speed=2&arm=work&strain=1` → { id: 'wolt', params: { speed: 2, arm: 'work', strain: true } }. */
export function parseHash(hash: string): LinkState {
  const h = hash.replace(/^#/, '');
  if (!h) return { id: null, params: {} };
  const [first, ...rest] = h.split('&');
  const params: Params = {};
  for (const kv of rest) {
    const i = kv.indexOf('=');
    if (i <= 0) continue;
    const k = decodeURIComponent(kv.slice(0, i)), v = decodeURIComponent(kv.slice(i + 1));
    params[k] = v === 'true' ? true : v === 'false' ? false : NUM.test(v) ? Number(v) : v;
  }
  return { id: first ? decodeURIComponent(first) : null, params };
}

/** The reverse of parseHash; only values that differ from the defaults go in. */
export function formatHash(id: string, params: Params, defaults: Params): string {
  const parts = [encodeURIComponent(id)];
  for (const [k, v] of Object.entries(params)) {
    if (defaults[k] === v) continue;
    const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return '#' + parts.join('&');
}

/** Lower case, without Polish diacritics, so "zaglowoz" finds "Żaglowóz". */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

/** Every word of the query must appear somewhere in the haystack. */
export function matches(query: string, ...hay: string[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const all = fold(hay.join(' '));
  return words.every(w => all.includes(w));
}

/**
 * Camera distance that fits a bounding sphere of `radius` in a perspective view with a
 * vertical field of view `fovDeg` and the given aspect (width / height), with a margin.
 */
export function frameDistance(radius: number, fovDeg: number, aspect: number, margin = 1.25): number {
  const v = (fovDeg * Math.PI) / 360;
  const h = Math.atan(Math.tan(v) * aspect);
  const half = Math.min(v, h);
  return Math.max(0.05, (radius * margin) / Math.sin(half));
}

/** The playback clock: paused, slowed down or sped up, stepped frame by frame. */
export class Clock {
  t = 0;
  speed = 1;
  playing = true;
  private pendingStep = 0;

  /** One step of `frame` seconds of scene time, even while paused. */
  step(frame = 1 / 30) { this.pendingStep += frame; }

  /** Real seconds since the last frame → scene seconds for this frame (capped, a hidden tab does not jump). */
  advance(realDt: number): number {
    const dt = (this.playing ? Math.min(realDt, 0.1) * this.speed : 0) + this.pendingStep;
    this.pendingStep = 0;
    this.t += dt;
    return dt;
  }
}
