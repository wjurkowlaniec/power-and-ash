import { Ctx, Scene } from '../scene';
import { tr } from '../../i18n';

/**
 * Scene 0. Ciemność (docs/POCZATEK.md). Black screen, wind, metal, dripping water and a
 * low pulse like a heartbeat through a wall: the battery. The pulse grows, a pale green
 * dot appears (the only colour), then video static: Wolt switches his eyes on at 4% reserve.
 * No captions, no logo.
 */
export const DARKNESS_LEN = 20; // s

export class Darkness implements Scene {
  readonly id = 'darkness';
  next: string | null = null;
  private t = 0;
  private nextPulse = 0.8;
  private beat = 0;      // 1 right after a pulse, decays
  private eyesOn = false;
  private readout!: HTMLDivElement;
  private skipHold = 0;

  enter(c: Ctx) {
    c.fx.black = 1; c.fx.grain = 0; c.fx.dot = { a: 0, r: 0 };
    c.sound.muffle = 1; c.sound.wind = 0.6;
    this.readout = document.createElement('div');
    this.readout.className = 'reserve';
    this.readout.hidden = true;
    c.hud.appendChild(this.readout);
  }

  update(dt: number, c: Ctx) {
    this.t += dt;
    const t = this.t;
    // hold Space to skip (testing, and for players who have seen it)
    this.skipHold = c.input.keys.has('Space') ? this.skipHold + dt : 0;
    if (this.skipHold > 0.8 && !this.eyesOn) { this.t = Math.max(t, 16); this.nextPulse = 0; }

    // the pulse: faint and slow, then stronger and closer together
    const k = Math.min(1, Math.max(0, (t - 1) / 13));
    this.nextPulse -= dt;
    if (this.nextPulse <= 0 && t < DARKNESS_LEN - 2) {
      c.sound.pulse(0.25 + k * 0.75);
      this.beat = 1;
      this.nextPulse = 2.4 - k * 1.0;
    }
    this.beat = Math.max(0, this.beat - dt * 1.4);

    // the dot appears from ~2.5 s, glows with each beat
    const dk = Math.min(1, Math.max(0, (t - 2.5) / 10));
    c.fx.dot = { a: dk * (0.25 + this.beat * 0.75), r: 1.5 + dk * 3 + this.beat * 2 * dk };

    // eyes on: static, then the reserve readout
    if (!this.eyesOn && t >= 16) {
      this.eyesOn = true;
      c.sound.staticBurst(0.9, 0.14);
      c.fx.static = 1.4;
      this.readout.hidden = false;
      this.readout.textContent = tr('REZERWA 4%', 'RESERVE 4%');
    }
    if (this.eyesOn) {
      c.fx.grain = 0.6;
      c.fx.lines = 0.6;
      // the readout flickers
      this.readout.style.opacity = String(0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 1)));
      c.fx.dot.a *= Math.max(0, 1 - (t - 16) / 3);
    }
    if (t >= DARKNESS_LEN) this.next = 'hall';
  }

  exit() { this.readout.remove(); }
}
