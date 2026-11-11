import './touch.css';

/**
 * On-screen touch controls, shared by the game and the tech demos.
 *
 * The controls do not talk to the game: they press and release the same keys the
 * keyboard does (a synthetic `keydown`/`keyup` on window with the key's `code`), so
 * every page keeps one input path and a new key binding works on touch for free.
 * A button may instead run a callback (zoom, a panel toggle) when there is no key.
 *
 * Shown only on touch devices (`pointer: coarse`, or any touch points), or with
 * `?touch` in the URL to force them on a desktop (`?touch=0` forces them off).
 */

/** A rocker: hold one end or the other (a slide across switches ends). */
export interface Rocker {
  kind: 'h' | 'v';
  /** key codes: [left, right] for 'h', [up, down] for 'v' */
  codes: [string, string];
  /** labels at the two ends */
  labels: [string, string];
  /** a small caption on the rocker */
  caption?: string;
}

/** A thumb stick sending W/A/S/D (8 directions). */
export interface Stick { kind: 'stick' }

export interface TouchButton {
  label: string;
  /** a key to press: held while the finger is down (hold) or tapped */
  code?: string;
  hold?: boolean;
  /** run instead of (or as well as) the key on a tap */
  onTap?: () => void;
}

export interface TouchLayout {
  left?: Rocker | Stick;
  right?: Rocker | Stick;
  /** small buttons stacked above the right control */
  buttons?: TouchButton[];
  /** small buttons above the left control */
  leftButtons?: TouchButton[];
}

/** Whether to show touch controls on this device. */
export function wantsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(location.search).get('touch');
  if (q !== null) return q !== '0';
  return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 0 && matchMedia('(hover: none)').matches;
}

const held = new Map<string, number>(); // code -> how many controls hold it
function press(code: string) {
  const n = held.get(code) ?? 0;
  held.set(code, n + 1);
  if (n === 0) dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
}
function release(code: string) {
  const n = held.get(code) ?? 0;
  if (n <= 0) return;
  if (n === 1) { held.delete(code); dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); }
  else held.set(code, n - 1);
}
function tap(code: string) { press(code); release(code); }

/** Which keys a finger at (dx, dy) from the control's centre holds (dx, dy in -1..1). */
export function keysFor(c: Rocker | Stick, dx: number, dy: number): string[] {
  const dead = 0.22;
  if (c.kind === 'h') return Math.abs(dx) < dead * 0.5 ? [] : [dx < 0 ? c.codes[0] : c.codes[1]];
  if (c.kind === 'v') return Math.abs(dy) < dead * 0.5 ? [] : [dy < 0 ? c.codes[0] : c.codes[1]];
  if (Math.hypot(dx, dy) < dead) return [];
  const out: string[] = [];
  const a = Math.atan2(dy, dx), s = Math.sin(a), co = Math.cos(a);
  if (co > 0.38) out.push('KeyD'); else if (co < -0.38) out.push('KeyA');
  if (s > 0.38) out.push('KeyS'); else if (s < -0.38) out.push('KeyW');
  return out;
}

function control(c: Rocker | Stick, side: 'left' | 'right'): HTMLElement {
  const el = document.createElement('div');
  el.className = `tc-ctl tc-${c.kind} tc-${side}`;
  if (c.kind === 'stick') el.innerHTML = '<i class="tc-knob"></i>';
  else el.innerHTML = `<span class="tc-a">${c.labels[0]}</span>${c.caption ? `<span class="tc-cap">${c.caption}</span>` : ''}<span class="tc-b">${c.labels[1]}</span>`;
  const knob = el.querySelector('.tc-knob') as HTMLElement | null;
  const fingers = new Map<number, string[]>();
  const update = (id: number, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (x - r.left - r.width / 2) / (r.width / 2)));
    const dy = Math.max(-1, Math.min(1, (y - r.top - r.height / 2) / (r.height / 2)));
    const now = keysFor(c, dx, dy), was = fingers.get(id) ?? [];
    for (const k of was) if (!now.includes(k)) release(k);
    for (const k of now) if (!was.includes(k)) press(k);
    fingers.set(id, now);
    if (knob) knob.style.transform = `translate(${(dx * 34).toFixed(0)}px, ${(dy * 34).toFixed(0)}px)`;
    el.dataset.on = now.join(' ');
  };
  const end = (id: number) => {
    for (const k of fingers.get(id) ?? []) release(k);
    fingers.delete(id);
    if (!fingers.size) { el.dataset.on = ''; if (knob) knob.style.transform = ''; }
  };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    update(e.pointerId, e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', e => { if (fingers.has(e.pointerId)) update(e.pointerId, e.clientX, e.clientY); });
  el.addEventListener('pointerup', e => end(e.pointerId));
  el.addEventListener('pointercancel', e => end(e.pointerId));
  el.addEventListener('lostpointercapture', e => end(e.pointerId));
  return el;
}

function button(b: TouchButton): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tc-btn' + (b.hold ? ' tc-hold' : '');
  el.textContent = b.label;
  let down = false;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    el.classList.add('on');
    if (b.hold && b.code) { down = true; press(b.code); }
  });
  const up = (fire: boolean) => {
    if (!el.classList.contains('on')) return;
    el.classList.remove('on');
    if (down && b.code) { down = false; release(b.code); }
    else if (fire) { if (b.code) tap(b.code); b.onTap?.(); }
  };
  el.addEventListener('pointerup', () => up(true));
  el.addEventListener('pointercancel', () => up(false));
  el.addEventListener('click', e => e.preventDefault());
  return el;
}

/**
 * Put the controls on screen (only on touch devices, see `wantsTouch`). Adds the class
 * `touch` to <body> so a page can make room in its HUD. Returns the root, or null.
 */
export function mountTouch(layout: TouchLayout, force = false): HTMLElement | null {
  if (!force && !wantsTouch()) return null;
  document.body.classList.add('touch');
  const root = document.createElement('div');
  root.className = 'tc';
  root.addEventListener('contextmenu', e => e.preventDefault());
  const col = (side: 'left' | 'right', ctl?: Rocker | Stick, btns?: TouchButton[]) => {
    const c = document.createElement('div');
    c.className = `tc-col tc-col-${side}`;
    if (btns?.length) {
      const g = document.createElement('div');
      g.className = 'tc-btns';
      for (const b of btns) g.appendChild(button(b));
      c.appendChild(g);
    }
    if (ctl) c.appendChild(control(ctl, side));
    root.appendChild(c);
  };
  col('left', layout.left, layout.leftButtons);
  col('right', layout.right, layout.buttons);
  document.body.appendChild(root);
  // a finger lifted outside the page or the app sent to the background: let go of everything
  const letGo = () => { for (const [code] of held) { held.set(code, 1); release(code); } };
  addEventListener('blur', letGo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
  return root;
}

/** Show or hide the controls (e.g. hidden behind a card or the intro). */
export function showTouch(root: HTMLElement | null, on: boolean) { if (root) root.hidden = !on; }
