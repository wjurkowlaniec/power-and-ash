import { Fx } from './fx';
import { GameSound } from './audio/sound';
import { Models } from '../render/assets';

/** What a scene can touch. Shared by all scenes of the story. */
export interface Ctx {
  fx: Fx;
  sound: GameSound;
  models: Models;
  /** Container for the 3D canvas (a scene that needs 3D adds its own renderer here). */
  app: HTMLElement;
  /** HUD root; scenes add and remove their own elements. */
  hud: HTMLElement;
  input: Input;
}

export interface Input {
  keys: Set<string>;
  /** Keys pressed this frame (cleared after each update). */
  pressed: Set<string>;
  mouse: { x: number; y: number } | null;
}

export interface Scene {
  readonly id: string;
  enter(ctx: Ctx): void;
  update(dt: number, ctx: Ctx): void;
  exit?(ctx: Ctx): void;
  /** A note or the archive is open: Esc closes that instead of opening the menu. */
  modal?(): boolean;
  /** Set by the scene when it is over: the id of the next scene. */
  next: string | null;
}
