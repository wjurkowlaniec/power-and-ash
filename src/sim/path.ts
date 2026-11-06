import { V2 } from './vec';
import { World } from './world';

const SQ2 = Math.SQRT2;

/** Free tile for a walker of radius r (its centre must fit). */
function free(w: World, i: number, j: number, r: number) {
  return !w.isBlocked(i, j) && !w.circleBlocked({ x: i + 0.5, y: j + 0.5 }, r);
}

/** Can a circle of radius r slide straight from a to b? */
export function clearLine(w: World, a: V2, b: V2, r: number): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d / 0.15));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (w.circleBlocked({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, r)) return false;
  }
  return true;
}

/**
 * A* over the tile grid (8 neighbours, no corner cutting), then string-pulled so
 * Wolt walks straight where he can. Returns waypoints after `from`, ending at `to`
 * (or at the closest reachable tile when `to` is inside an obstacle). Null if no way.
 */
export function findPath(w: World, from: V2, to: V2, r: number): V2[] | null {
  if (clearLine(w, from, to, r)) return [to];
  const W = w.width, H = w.height;
  const si = Math.floor(from.x), sj = Math.floor(from.y);
  let gi = Math.floor(to.x), gj = Math.floor(to.y);
  let goal = to;
  if (!free(w, gi, gj, r)) {
    // nearest free tile around the goal, preferring the side facing Wolt
    let best = Infinity;
    for (let j = gj - 4; j <= gj + 4; j++)
      for (let i = gi - 4; i <= gi + 4; i++) {
        if (!free(w, i, j, r)) continue;
        const c = { x: i + 0.5, y: j + 0.5 };
        const s = Math.hypot(c.x - to.x, c.y - to.y) * 4 + Math.hypot(c.x - from.x, c.y - from.y) * 0.2;
        if (s < best) { best = s; gi = i; gj = j; goal = c; }
      }
    if (best === Infinity) return null;
  }
  const idx = (i: number, j: number) => j * W + i;
  const g = new Float32Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const open: number[] = [];
  const f = new Float32Array(W * H);
  const hfn = (i: number, j: number) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return dx + dy + (SQ2 - 2) * Math.min(dx, dy); };
  const s = idx(si, sj);
  if (si < 0 || sj < 0 || si >= W || sj >= H) return null;
  g[s] = 0; f[s] = hfn(si, sj); open.push(s);
  const goalI = idx(gi, gj);
  let found = false;
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === goalI) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % W, cj = (cur - ci) / W;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        if (!free(w, ni, nj, r)) continue;
        if (di && dj && (!free(w, ci + di, cj, r) || !free(w, ci, cj + dj, r))) continue;
        const n = idx(ni, nj);
        if (closed[n]) continue;
        const ng = g[cur] + (di && dj ? SQ2 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = cur; f[n] = ng + hfn(ni, nj); open.push(n); }
      }
  }
  if (!found) return null;
  const tiles: V2[] = [];
  for (let c = goalI; c !== s && c >= 0; c = came[c]) tiles.push({ x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5 });
  tiles.reverse();
  if (tiles.length) tiles[tiles.length - 1] = goal; else tiles.push(goal);
  // string pulling
  const out: V2[] = [];
  let at = from;
  let k = 0;
  while (k < tiles.length) {
    let far = k;
    for (let m = tiles.length - 1; m > k; m--) if (clearLine(w, at, tiles[m], r)) { far = m; break; }
    out.push(tiles[far]);
    at = tiles[far];
    k = far + 1;
  }
  return out;
}
