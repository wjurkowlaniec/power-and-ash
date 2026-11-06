/**
 * Procedural sound, no audio files. Wind over ash, gusts, distant metal creaks with
 * a long reverb, footsteps, cable clicks and the relay hum. Starts on the first click
 * (browsers block audio before that).
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private humGain!: GainNode;
  private tensionGain!: GainNode;
  private nextCreak = 4;
  private gust = 0.4;
  private gustTarget = 0.4;
  muted = false;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);

    // noise buffer
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }

    // reverb impulse: long, dark tail = big empty space
    const irLen = ctx.sampleRate * 4;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const rv = ctx.createGain(); rv.gain.value = 0.5; this.reverb.connect(rv); rv.connect(this.master);

    // wind: band-passed noise, slowly moving
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 380; this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.15;
    wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    wind.start();
    // low rumble
    const rum = ctx.createBufferSource(); rum.buffer = this.noise; rum.loop = true; rum.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
    const rg = ctx.createGain(); rg.gain.value = 0.18;
    rum.connect(lp); lp.connect(rg); rg.connect(this.master); rum.start();
    // fine sand hiss
    const hiss = ctx.createBufferSource(); hiss.buffer = this.noise; hiss.loop = true; hiss.playbackRate.value = 1.7;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const hg = ctx.createGain(); hg.gain.value = 0.012;
    hiss.connect(hp); hp.connect(hg); hg.connect(this.master); hiss.start();

    // relay hum (silent until the station is online)
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0; this.humGain.connect(this.master);
    for (const [f, a] of [[50, 0.5], [100, 0.3], [150, 0.12], [250, 0.05]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(this.humGain); o.start();
    }
    // cable tension groan
    const tn = ctx.createBufferSource(); tn.buffer = this.noise; tn.loop = true; tn.playbackRate.value = 0.25;
    const tf = ctx.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 180; tf.Q.value = 6;
    this.tensionGain = ctx.createGain(); this.tensionGain.gain.value = 0;
    tn.connect(tf); tf.connect(this.tensionGain); this.tensionGain.connect(this.master); tn.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  update(dt: number, s: { humNear: number; tension: number; wind: number }) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    // wind strength from the simulation (0 calm .. ~1.5 strong gust), plus a little of our own wobble
    if (Math.abs(this.gust - this.gustTarget) < 0.02) this.gustTarget = s.wind * (0.85 + Math.random() * 0.3);
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 0.8);
    this.windGain.gain.setTargetAtTime(0.04 + this.gust * 0.2, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(220 + this.gust * 480, t, 0.5);
    this.humGain.gain.setTargetAtTime(0.03 * s.humNear, t, 0.4);
    this.tensionGain.gain.setTargetAtTime(0.25 * s.tension, t, 0.15);

    this.nextCreak -= dt;
    if (this.nextCreak <= 0) { this.creak(); this.nextCreak = 7 + Math.random() * 12; }
  }

  /** Distant metal: a slow pitch-bent tone + filtered scrape, mostly reverb. */
  private creak() {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    const g = ctx.createGain(); g.gain.value = 0;
    const dur = 1.5 + Math.random() * 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 120 + Math.random() * 260;
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0 * 3; bp.Q.value = 12;
    o.connect(bp); bp.connect(g); g.connect(pan);
    const dry = ctx.createGain(); dry.gain.value = 0.15; pan.connect(dry); dry.connect(this.master);
    pan.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.1);
  }

  private burst(freq: number, q: number, gain: number, dur: number, type: BiquadFilterType = 'lowpass', rate = 1, wet = 0.1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.reverb); }
    src.start(t, Math.random() * 2, dur + 0.05);
  }

  private tone(freq: number, gain: number, dur: number, type: OscillatorType = 'sine', bend = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    const w = ctx.createGain(); w.gain.value = 0.2; g.connect(w); w.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
  }

  step(run: boolean) { this.burst(run ? 900 : 700, 0.7, run ? 0.32 : 0.24, 0.09, 'lowpass', 0.8 + Math.random() * 0.4, 0.02); }
  cableTick() { this.burst(3200, 4, 0.05, 0.025, 'bandpass', 1, 0); }
  grab() { this.tone(180, 0.18, 0.15, 'triangle', 0.6); this.burst(2500, 2, 0.12, 0.06, 'bandpass'); }
  plug() { this.tone(90, 0.35, 0.35, 'sine', 0.5); this.burst(1800, 3, 0.25, 0.08, 'bandpass', 1, 0.3); }
  unplug() { this.burst(2200, 3, 0.2, 0.07, 'bandpass'); this.tone(140, 0.15, 0.12, 'triangle', 1.4); }
  reel() { for (let i = 0; i < 10; i++) setTimeout(() => this.cableTick(), i * 35); }
  deny() { this.tone(120, 0.15, 0.18, 'square', 0.8); }
  salvage() { for (let i = 0; i < 5; i++) setTimeout(() => this.burst(1200 + Math.random() * 1500, 2, 0.18, 0.08, 'bandpass', 0.7, 0.2), i * 70); this.tone(70, 0.2, 0.4, 'sine', 0.6); }
  scrape() { this.burst(900 + Math.random() * 900, 3, 0.06, 0.12, 'bandpass', 0.6, 0.05); }
  craft() { this.tone(440, 0.08, 0.5, 'sine', 1.01); setTimeout(() => this.tone(660, 0.06, 0.8, 'sine', 1.0), 120); }
  craftTick() { this.burst(2400, 6, 0.04, 0.04, 'bandpass', 1, 0); }
  charged() { this.tone(330, 0.08, 1.2, 'sine', 1.0); setTimeout(() => this.tone(495, 0.07, 1.6, 'sine', 1.0), 200); }
  depart() { this.tone(55, 0.3, 3.5, 'sawtooth', 1.8); this.burst(300, 0.7, 0.3, 3, 'lowpass', 0.5, 0.3); }
  win() { for (const [f, d] of [[262, 0], [330, 150], [392, 300], [523, 500]] as const) setTimeout(() => this.tone(f, 0.07, 2.5, 'sine', 1), d); }
  play(e: string) {
    switch (e) {
      case 'grab': return this.grab();
      case 'plug': return this.plug();
      case 'unplug': return this.unplug();
      case 'reel': return this.reel();
      case 'deny': return this.deny();
      case 'salvage': return this.salvage();
      case 'craft': return this.craft();
      case 'charged': return this.charged();
      case 'depart': return this.depart();
      case 'win': return this.win();
    }
  }
  online() { this.tone(220, 0.1, 1.8, 'sine', 1.5); this.tone(330, 0.06, 2.2, 'sine', 1.5); }
}
