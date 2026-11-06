/**
 * Screen effects on a 2D canvas over the 3D view: film grain / video static, the
 * green battery dot in the dark, a black fade. The 3D canvas itself is greyed and
 * colourised through a CSS filter (cheap, and the transition can be animated).
 */
export class Fx {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private grainTiles: HTMLCanvasElement[] = [];
  private frameN = 0;
  /** 0..1 film grain strength. */
  grain = 0.5;
  /** 0..1 black over everything. */
  black = 1;
  /** 0..1 a burst of video static (decays by itself). */
  static = 0;
  /** The battery dot: brightness 0..1 and radius in px (0 = hidden). */
  dot = { a: 0, r: 0 };
  /** Horizontal interference lines 0..1 (reserve mode). */
  lines = 0;

  constructor(parent: HTMLElement) {
    Object.assign(this.canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    parent.appendChild(this.canvas);
    // pre-rendered grain tiles, cycled every frame
    for (let k = 0; k < 6; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.grainTiles.push(c);
    }
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
  }

  frame(dt: number) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    this.static = Math.max(0, this.static - dt * 2.2);
    if (this.black > 0) { ctx.globalAlpha = this.black; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    if (this.dot.r > 0 && this.dot.a > 0) {
      const cx = W / 2, cy = H / 2, r = this.dot.r * (W / innerWidth);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
      grd.addColorStop(0, `rgba(190,255,200,${this.dot.a})`);
      grd.addColorStop(0.15, `rgba(120,220,150,${this.dot.a * 0.6})`);
      grd.addColorStop(1, 'rgba(60,140,90,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, r * 6, 0, Math.PI * 2); ctx.fill();
    }
    const g = Math.min(1, this.grain + this.static);
    if (g > 0) {
      const tile = this.grainTiles[this.frameN++ % this.grainTiles.length];
      ctx.globalCompositeOperation = this.static > 0.3 ? 'source-over' : 'overlay';
      ctx.globalAlpha = Math.min(1, g * (this.static > 0.3 ? 0.8 : 0.16));
      const ox = Math.random() * 256, oy = Math.random() * 256;
      ctx.save(); ctx.translate(-ox, -oy);
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
      ctx.fillRect(0, 0, W + 256, H + 256);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.lines > 0) {
      ctx.globalAlpha = this.lines * 0.18; ctx.fillStyle = '#000';
      const off = (performance.now() / 40) % 6;
      for (let y = -6 + off; y < H; y += 6) ctx.fillRect(0, y, W, 2);
      if (Math.random() < this.lines * 0.08) {
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
        ctx.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
      }
    }
    ctx.globalAlpha = 1;
  }
}
