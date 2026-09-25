export interface ProtocolView {
  title: string;
  meta: string[]; // objednatel, lokalita, datum, počasí, metoda
  headers: string[];
  rows: { cells: string[]; ok: boolean | null }[];
  verdict: string;
  ok: boolean;
  pay: string;
  bonus?: string;
}

/** Protokol o výsledku zakázky po odevzdání. */
export class ProtocolScreen {
  private readonly el: HTMLElement;
  private text = '';
  private title = '';
  onCopy: ((text: string) => void) | null = null;
  onDownload: ((text: string, title: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'proto';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.proto-copy')) this.onCopy?.(this.text);
      if (t.closest('.proto-save')) this.onDownload?.(this.text, this.title);
      if (t.closest('.proto-close')) this.hide();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(v: ProtocolView): void {
    const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    this.title = v.title;
    this.text = [v.title, ...v.meta, '', v.headers.join('\t'), ...v.rows.map((r) => r.cells.join('\t')), '', v.verdict, `Odměna: ${v.pay}`].join('\n');
    this.el.innerHTML = `<div class="proto-body">
      <p class="proto-kicker">Protokol o výsledku měření</p>
      <h2>${esc(v.title)}</h2>
      <ul class="proto-meta">${v.meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      ${
        v.rows.length
          ? `<div class="proto-table"><table><thead><tr>${v.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${v.rows
              .map(
                (r) =>
                  `<tr class="${r.ok === true ? 'is-ok' : r.ok === false ? 'is-bad' : ''}">${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`,
              )
              .join('')}</tbody></table></div>`
          : ''
      }
      <p class="proto-verdict ${v.ok ? 'is-ok' : 'is-bad'}">${esc(v.verdict)}</p>
      <p class="proto-pay">Odměna <strong>${esc(v.pay)}</strong></p>
      ${v.bonus ? `<p class="proto-bonus">${esc(v.bonus)}</p>` : ''}
      <div class="proto-actions"><button class="proto-copy">Kopírovat</button><button class="proto-save">Uložit do souboru</button><button class="proto-close">Pokračovat</button></div>
    </div>`;
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }
}
