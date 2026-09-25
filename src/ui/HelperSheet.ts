export interface HelperMenu {
  status: string;
  actions: { id: string; label: string; hint?: string; disabled?: boolean }[];
  points: { id: string; label: string; dist: string }[];
  carrying: string | null;
}

/** Vysílačka: povely pro pomocníka Pepu. */
export class HelperSheet {
  private readonly el: HTMLElement;
  onCommand: ((id: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private shownAt = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'cargo helper-sheet';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLButtonElement>('[data-cmd]');
      if (b && !b.disabled) {
        this.onCommand?.(b.dataset.cmd ?? '');
        this.hide();
        return;
      }
      // Duchový klik po klepnutí, které okno otevřelo, nesmí okno hned zavřít.
      if (t.closest('.cargo-close') || (t === this.el && performance.now() - this.shownAt > 400)) this.hide();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(m: HelperMenu): void {
    const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    this.el.innerHTML = `<div class="cargo-body">
      <h2>Vysílačka: Pepa</h2>
      <p class="hs-status">${esc(m.status)}</p>
      <div class="hs-actions">${m.actions
        .map((a) => `<button data-cmd="${a.id}" ${a.disabled ? 'disabled' : ''}>${esc(a.label)}${a.hint ? `<small>${esc(a.hint)}</small>` : ''}</button>`)
        .join('')}</div>
      ${
        m.points.length
          ? `<h3>${m.carrying ? `Jdi s ${esc(m.carrying)} na bod` : 'Jdi na bod'}</h3><ul class="hs-points">${m.points
              .map((p) => `<li><button data-cmd="goto:${p.id}"><span>${esc(p.label)}</span><span>${esc(p.dist)}</span></button></li>`)
              .join('')}</ul>`
          : ''
      }
      <button class="cargo-close">Zavřít</button>
    </div>`;
    this.el.hidden = false;
    this.shownAt = performance.now();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }
}
