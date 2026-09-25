export interface CargoView {
  items: { id: string; name: string }[];
  kit: { name: string; ok: boolean; where: string }[];
  jobTitle: string | null;
}

/** Nákladový prostor dodávky: co je naložené a co chybí k aktivní zakázce. */
export class CargoSheet {
  private readonly el: HTMLElement;
  onTake: ((id: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private shownAt = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'cargo';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLElement>('[data-take]');
      if (b) this.onTake?.(b.dataset.take ?? '');
      // Duchový klik po klepnutí, které okno otevřelo, nesmí okno hned zavřít.
      if (t.closest('.cargo-close') || (t === this.el && performance.now() - this.shownAt > 400)) this.hide();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(v: CargoView): void {
    const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    this.el.innerHTML = `<div class="cargo-body">
      <h2>Nákladový prostor</h2>
      ${v.items.length ? `<ul class="cargo-list">${v.items.map((i) => `<li><span>${esc(i.name)}</span><button data-take="${i.id}">Vyndat</button></li>`).join('')}</ul>` : '<p class="cargo-empty">Dodávka je prázdná.</p>'}
      ${
        v.jobTitle
          ? `<h3>K zakázce: ${esc(v.jobTitle)}</h3><ul class="od-kit">${v.kit.map((k) => `<li class="${k.ok ? 'is-ok' : 'is-miss'}"><span>${k.ok ? '✓' : '✗'} ${esc(k.name)}</span><span>${esc(k.where)}</span></li>`).join('')}</ul>`
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
