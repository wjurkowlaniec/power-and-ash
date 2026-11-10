import { SurfaceId } from './sim/terrain';

/**
 * The land yacht's own sounds, procedural like the rest (no audio files): the hum and hiss
 * of the wheels or runners on the ground (pitch and grain from the surface, loudness from
 * the speed) and the sail flogging when it luffs.
 */
const TONE: Record<SurfaceId, { f: number; q: number; gain: number }> = {
  road: { f: 520, q: 0.9, gain: 1 },
  ash: { f: 900, q: 0.7, gain: 0.8 },
  loose: { f: 420, q: 0.6, gain: 1.1 },
  lake: { f: 2600, q: 0.8, gain: 0.7 },
  gravel: { f: 1500, q: 1.4, gain: 1.3 },
  mud: { f: 260, q: 1.2, gain: 0.9 },
};

export class RollSound {
  private ctx: AudioContext | null = null;
  private roll!: GainNode; private rollF!: BiquadFilterNode;
  private flap!: GainNode;
  private flapPhase = 0;
  muted = false;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = (rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    this.rollF = ctx.createBiquadFilter(); this.rollF.type = 'bandpass'; this.rollF.frequency.value = 900; this.rollF.Q.value = 0.7;
    this.roll = ctx.createGain(); this.roll.gain.value = 0;
    src().connect(this.rollF); this.rollF.connect(this.roll); this.roll.connect(ctx.destination);
    const ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 700;
    this.flap = ctx.createGain(); this.flap.gain.value = 0;
    src(0.6).connect(ff); ff.connect(this.flap); this.flap.connect(ctx.destination);
  }

  toggleMute() { this.muted = !this.muted; }

  update(dt: number, speed: number, surface: SurfaceId, onGround: boolean, luff: number, app: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const s = TONE[surface];
    const v = Math.min(1, speed / 18);
    this.rollF.frequency.setTargetAtTime(s.f * (0.7 + 0.6 * v), t, 0.15);
    this.rollF.Q.setTargetAtTime(s.q, t, 0.2);
    const g = this.muted || !onGround ? 0 : 0.11 * s.gain * v * (surface === 'gravel' ? 0.7 + Math.random() * 0.6 : 1);
    this.roll.gain.setTargetAtTime(g, t, 0.08);
    // a luffing sail flogs: bursts at a rate that rises with the wind
    this.flapPhase += dt * (3 + app * 0.6);
    const beat = Math.max(0, Math.sin(this.flapPhase * Math.PI * 2)) ** 3;
    const fg = this.muted ? 0 : luff * Math.min(1, app / 10) * 0.12 * beat;
    this.flap.gain.setTargetAtTime(fg, t, 0.02);
  }
}
