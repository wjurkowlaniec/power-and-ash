import { Input } from '../scene';
import { ClickWalk, ClickBody, ClickInput, pickThing } from '../sim/clickWalk';
import { V2 } from '../../sim/vec';

/** s between new "follow the cursor" orders while the button is held on the ground */
const FOLLOW_EVERY = 0.15;

/** What the mouse needs from a scene's 3D view. */
export interface PickView {
  project(p: V2, y?: number): { x: number; y: number };
  pick(x: number, y: number): V2 | null;
}

/**
 * Mouse glue shared by the game scenes: a click on a usable thing walks there and uses
 * it, a click on the ground walks there, holding the button on the ground makes Wolt
 * follow the cursor. Any movement key cancels the walk (the keyboard always wins).
 */
export class MouseWalk {
  private walk: ClickWalk;
  private following = false;
  private followT = 0;

  constructor(radius: number) { this.walk = new ClickWalk(radius); }

  cancel() { this.walk.cancel(); this.following = false; }

  /** Input from the mouse for this frame, or null (then the keys drive). */
  update(dt: number, inp: Input, body: ClickBody & { usables(): { id: string; at: V2 }[] }, view: PickView, keyMove: boolean): ClickInput | null {
    const things = body.usables();
    const proj = (p: V2, y: number) => view.project(p, y);
    // the hand cursor over something usable, so the player sees what a click would do
    document.body.style.cursor = inp.cursor && pickThing(things, inp.cursor, proj) ? 'pointer' : '';
    if (keyMove) { this.cancel(); return null; }
    if (inp.click) {
      const t = pickThing(things, inp.click, proj);
      if (t) { this.walk.go(body, t.at, t.id); this.following = false; }
      else {
        const at = view.pick(inp.click.x, inp.click.y);
        if (at) { this.walk.go(body, at); this.following = true; this.followT = FOLLOW_EVERY; }
      }
    }
    if (this.following) {
      if (!inp.lmb) this.following = false;
      else if ((this.followT -= dt) <= 0 && inp.cursor) {
        this.followT = FOLLOW_EVERY;
        const at = view.pick(inp.cursor.x, inp.cursor.y);
        if (at) this.walk.go(body, at);
      }
    }
    return this.walk.step(body, dt);
  }

  /** Leaving the scene: the default cursor back. */
  dispose() { document.body.style.cursor = ''; }
}
