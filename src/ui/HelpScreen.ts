import { chapter, MANUAL } from '../help/manual';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Příručka měřiče: kapitoly vlevo, postup s vysvětlením vpravo. */
export class HelpScreen {
  private readonly el: HTMLElement;
  private current = 'start';
  onClose: (() => void) | null = null;
  onCoach: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'help';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('.help-close')) return this.hide();
      if (t.closest('.help-coach')) return this.onCoach?.();
      const c = t.closest<HTMLElement>('[data-ch]');
      if (c) {
        this.current = c.dataset.ch ?? 'start';
        this.render();
      }
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(id?: string): void {
    if (id) this.current = id;
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private render(): void {
    const c = chapter(this.current);
    this.el.innerHTML = `<div class="help-body">
      <header><h2>Příručka měřiče</h2><button class="help-coach">Ovládání</button><button class="help-close">Zavřít</button></header>
      <div class="help-main">
        <nav>${MANUAL.map((m) => `<button data-ch="${m.id}" class="${m.id === c.id ? 'is-sel' : ''}">${esc(m.title)}</button>`).join('')}</nav>
        <article>
          <h3>${esc(c.title)}</h3>
          <p class="help-intro">${esc(c.intro)}</p>
          <ol>${c.steps.map((s) => `<li><span>${esc(s.do)}</span>${s.why ? `<small>Proč: ${esc(s.why)}</small>` : ''}</li>`).join('')}</ol>
          ${c.tips?.length ? `<ul class="help-tips">${c.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        </article>
      </div>
    </div>`;
  }
}
