/**
 * Wind over the ash: direction and strength drift slowly (sum of slow sines) and
 * gusts come and go. Deterministic for a given seed. Angle is where the wind blows TO,
 * in radians on the ground plane (0 = +x, π/2 = +y).
 */
export class Wind {
  dir = 0;
  speed = 6;    // m/s
  gust = 0;     // 0..1, extra on top of speed
  private t = 0;
  private phases: number[];
  private gustTarget = 0;
  private gustTimer = 3;
  private rnd: () => number;

  constructor(seed = 7, readonly base = { dir: Math.PI, speed: 6 }) {
    let s = seed;
    this.rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.phases = Array.from({ length: 6 }, () => this.rnd() * Math.PI * 2);
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t, p = this.phases;
    // direction swings up to ~±80° over a few minutes
    this.dir = this.base.dir + 0.9 * Math.sin(t * 0.021 + p[0]) + 0.45 * Math.sin(t * 0.057 + p[1]) + 0.12 * Math.sin(t * 0.23 + p[2]);
    const calm = 0.5 + 0.5 * Math.sin(t * 0.017 + p[3]);
    this.speed = Math.max(0.5, this.base.speed * (0.45 + calm) + 1.5 * Math.sin(t * 0.11 + p[4]) + 0.6 * Math.sin(t * 0.37 + p[5]));

    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTarget = this.gustTarget > 0.1 ? 0 : 0.4 + this.rnd() * 0.6;
      this.gustTimer = this.gustTarget > 0 ? 1.5 + this.rnd() * 3 : 4 + this.rnd() * 9;
    }
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 1.2);
  }

  /** Effective speed including the current gust. */
  get strength(): number { return this.speed * (1 + this.gust * 0.6); }

  /** Arrow for the HUD, pointing where the wind blows (screen: +y is down). */
  arrow(): string {
    const a = ((Math.atan2(this.dirVec().y, this.dirVec().x) * 180 / Math.PI) + 360) % 360;
    return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][Math.round(a / 45) % 8];
  }

  dirVec() { return { x: Math.cos(this.dir), y: Math.sin(this.dir) }; }
}
