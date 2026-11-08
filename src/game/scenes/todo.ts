import { Ctx, Scene } from '../scene';
import { tr } from '../../i18n';

/** Placeholder for scenes not built yet: says where the story goes next. */
export class Todo implements Scene {
  next: string | null = null;
  private el!: HTMLDivElement;
  constructor(readonly id: string, private title: string) {}

  enter(c: Ctx) {
    c.fx.black = 0.92; c.fx.grain = 0.4; c.fx.lines = 0.3; c.fx.dot = { a: 0, r: 0 };
    this.el = document.createElement('div');
    this.el.className = 'card todo';
    this.el.innerHTML = `<p class="lbl">${this.title}</p><p>${tr('Ta scena jest w budowie. Wróć za jakiś czas.', 'This scene is under construction. Come back in a while.')}</p>
      <p class="small">${tr('Mechaniki można testować w <a href="./demo/">tech demo</a>.', 'You can try the mechanics in the <a href="./demo/">tech demo</a>.')}</p>`;
    c.hud.appendChild(this.el);
  }
  update() {}
  exit() { this.el.remove(); }
}
