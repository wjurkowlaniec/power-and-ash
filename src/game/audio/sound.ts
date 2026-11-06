/**
 * Game sound, procedural Web Audio (no files). Built for the opening scenes: a big
 * empty hall, wind outside the walls, sheet metal creaking, dripping water and the
 * battery pulse like a heartbeat through a wall.
 *
 * `muffle` (0..1) closes a low-pass on everything except the pulse: in reserve mode
 * Wolt hears the world as if under water; inserting the battery opens it.
 */
export class GameSound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private world!: GainNode;      // everything that gets muffled
  private muffleLp!: BiquadFilterNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private nextCreak = 3;
  private nextDrip = 1.5;
  private gust = 0.3;
  private gustTarget = 0.3;
  /** 0 = clear, 1 = heavy muffle. */
  muffle = 1;
  /** 0..1 how loud the wind is (outside the walls it stays muffled). */
  wind = 0.5;
  muted = false;
  /** Called on each drop (the view draws a ripple). */
  onDrip: (() => void) | null = null;

  get time(): number { return this.ctx?.currentTime ?? 0; }

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.muffleLp = ctx.createBiquadFilter(); this.muffleLp.type = 'lowpass'; this.muffleLp.frequency.value = 500; this.muffleLp.Q.value = 0.4;
    this.muffleLp.connect(this.master);
    this.world = ctx.createGain(); this.world.connect(this.muffleLp);

    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }

    // a big concrete hall: long, dark tail
    const irLen = ctx.sampleRate * 5;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < irLen; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; ch[i] = lp * Math.pow(1 - i / irLen, 2.6); }
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const rv = ctx.createGain(); rv.gain.value = 0.7; this.reverb.connect(rv); rv.connect(this.world);

    // wind outside the walls: low band-passed noise
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 260; this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.world);
    wind.start();
    // room tone
    const rum = ctx.createBufferSource(); rum.buffer = this.noise; rum.loop = true; rum.playbackRate.value = 0.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90;
    const rg = ctx.createGain(); rg.gain.value = 0.14;
    rum.connect(lp); lp.connect(rg); rg.connect(this.world); rum.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  update(dt: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    this.muffleLp.frequency.setTargetAtTime(400 + Math.pow(1 - this.muffle, 2) * 16000, t, 0.5);
    if (Math.random() < dt * 0.25) this.gustTarget = 0.15 + Math.random() * 0.85;
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 0.6);
    this.windGain.gain.setTargetAtTime(this.wind * (0.05 + this.gust * 0.16), t, 0.3);
    this.windFilter.frequency.setTargetAtTime(180 + this.gust * 260, t, 0.5);

    this.nextCreak -= dt;
    if (this.nextCreak <= 0) { this.creak(0.3 + this.gust * 0.7); this.nextCreak = 4 + Math.random() * 9; }
    this.nextDrip -= dt;
    if (this.nextDrip <= 0) { this.drip(); this.nextDrip = Math.random() < 0.3 ? 0.35 : 1.6 + Math.random() * 3.5; }
  }

  /** Sheet metal flexing in the wind somewhere up in the roof. */
  creak(amount = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 0.8 + Math.random() * 1.6;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = 70 + Math.random() * 90;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (0.7 + Math.random() * 0.6), t + dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600 + Math.random() * 900; bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * amount, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    // the creak judders
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9 + Math.random() * 14;
    const lg = ctx.createGain(); lg.gain.value = 0.03 * amount; lfo.connect(lg); lg.connect(g.gain);
    o.connect(bp); bp.connect(g); g.connect(this.reverb); g.connect(this.world);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  /** A single drop of water into a puddle. */
  drip() {
    const ctx = this.ctx; if (!ctx) return;
    this.onDrip?.();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = 900 + Math.random() * 1300;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.reverb); g.connect(this.world);
    o.start(t); o.stop(t + 0.12);
  }

  /**
   * The battery's pulse: a double low thump, like a heartbeat heard through a wall.
   * Never muffled (it is inside Wolt).
   */
  pulse(strength = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const beat = (at: number, amp: number) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(62, at);
      o.frequency.exponentialRampToValueAtTime(34, at + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      o.connect(g); g.connect(this.master); g.connect(this.reverb);
      o.start(at); o.stop(at + 0.4);
    };
    beat(t, 0.5 * strength);
    beat(t + 0.24, 0.32 * strength);
  }

  /** Video static when the eyes switch on. */
  staticBurst(dur = 0.6, amp = 0.12) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 2.2;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.setValueAtTime(amp * 0.3, t + dur * 0.4);
    g.gain.setValueAtTime(amp * 0.8, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(hp); hp.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }

  /** Servo whine of a slow, weak movement. */
  servo(amount = 1, pitch = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 0.35;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(320 * pitch, t);
    o.frequency.linearRampToValueAtTime(260 * pitch, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025 * amount, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.world);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** The wheel bearing: a dry, short squeak, a little different each turn. Louder on reserve (no grease, no power). */
  wheelCreak(dry = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, dur = 0.09 + Math.random() * 0.1;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const f = 1500 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (0.82 + Math.random() * 0.1), t + dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018 * dry, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(this.world); g.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
    // and the tyre on grit
    const n = ctx.createBufferSource(); n.buffer = this.noise; n.playbackRate.value = 0.9;
    const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.03, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(lp); lp.connect(ng); ng.connect(this.world);
    n.start(t, Math.random() * 2); n.stop(t + 0.2);
  }

  /** A heavy step on concrete. */
  step(weak: boolean) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = weak ? 350 : 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(weak ? 0.09 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    s.connect(lp); lp.connect(g); g.connect(this.world); g.connect(this.reverb);
    s.start(t, Math.random() * 2); s.stop(t + 0.15);
  }

  /** Metal on metal: a clank (pipe, lever, hatch). */
  clank(pitch = 1, amp = 0.12) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, a, d] of [[310, 1, 0.9], [747, 0.6, 0.6], [1290, 0.35, 0.4], [2110, 0.2, 0.25]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * pitch * (0.98 + Math.random() * 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp * a, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.world); g.connect(this.reverb);
      o.start(t); o.stop(t + d + 0.05);
    }
    this.step(false);
  }

  /** The world opening up: a slow swell when the battery goes in. */
  swell() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (const f of [55, 82.5, 110, 164.8]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      o.connect(g); g.connect(this.master); g.connect(this.reverb);
      o.start(t); o.stop(t + 9.2);
    }
  }

  /** A short soft blip for UI (log line appearing, item picked up). */
  blip(pitch = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 880 * pitch;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }
}
