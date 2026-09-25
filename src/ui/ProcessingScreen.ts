/**
 * Kancelářské zpracování (po vzoru programů Groma, Kokeš a podobných):
 * import zápisníku z přístroje, kontrola a vyřazení špatných měření, volba výstupu a odeslání objednateli.
 */
export interface ProcRow {
  id: string;
  code: string;
  coords: string;
  sol: string;
  sigma: string;
  flag: 'ok' | 'float' | 'tol' | 'check' | 'checkBad';
  note?: string;
}

export interface ProcessingView {
  job: string;
  client: string;
  rows: ProcRow[];
  outputs: { id: string; label: string }[];
  summary: string; // co se v terénu udělalo
}

type Step = 'import' | 'check' | 'output' | 'send';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const FLAG: Record<ProcRow['flag'], string> = {
  ok: '',
  float: 'jen FLOAT/autonomní',
  tol: 'mimo toleranci přesnosti',
  check: 'kontrola na známém bodě ✓',
  checkBad: 'kontrola nesedí!',
};

export class ProcessingScreen {
  private readonly el: HTMLElement;
  private view: ProcessingView | null = null;
  private step: Step = 'import';
  private imported = false;
  private excluded = new Set<string>();
  private output: string | null = null;
  onSend: ((excluded: Set<string>, output: string | null) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'proc';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLElement>('[data-p]');
      if (!b) return;
      const [cmd, arg] = (b.dataset.p ?? '').split(':');
      if (cmd === 'close') return this.hide();
      if (cmd === 'step') this.step = arg as Step;
      if (cmd === 'import') {
        this.imported = true;
        this.step = 'check';
      }
      if (cmd === 'ex') {
        if (this.excluded.has(arg)) this.excluded.delete(arg);
        else this.excluded.add(arg);
      }
      if (cmd === 'out') this.output = arg;
      if (cmd === 'next') this.step = arg as Step;
      if (cmd === 'send') {
        this.el.hidden = true;
        this.onSend?.(new Set(this.excluded), this.output);
        return;
      }
      this.render();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(v: ProcessingView): void {
    this.view = v;
    this.step = 'import';
    this.imported = false;
    this.excluded.clear();
    this.output = null;
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    const steps: [Step, string][] = [
      ['import', '1 Import dat'],
      ['check', '2 Kontrola'],
      ['output', '3 Výstup'],
      ['send', '4 Odeslat'],
    ];
    const bad = v.rows.filter((r) => (r.flag === 'float' || r.flag === 'tol' || r.flag === 'checkBad') && !this.excluded.has(r.id)).length;
    let body = '';
    switch (this.step) {
      case 'import':
        body = `<h3>Import zápisníku</h3>
          <p>Data zakázky jsou v přístroji. Načti zápisník (CSV z kontroleru / stanice) do zakázky v kanceláři.</p>
          <p class="pr-sum">${esc(v.summary)}</p>
          <button data-p="import" class="pr-primary">Načíst zápisník z přístroje</button>`;
        break;
      case 'check':
        body = !this.imported
          ? '<p>Nejdřív načti data (krok 1).</p>'
          : `<h3>Kontrola měření</h3>
          <p>Zkontroluj kontrolní body a vyřaď měření, která do výsledku nepatří (FLOAT, mimo toleranci). Vyřazený bod se neodevzdá – když to byl jediný záměr prvku, prvek bude chybět.</p>
          <div class="pr-table"><table><thead><tr><th>Bod</th><th>Kód</th><th>Y / X / H</th><th>Řešení</th><th>σ</th><th>Stav</th><th></th></tr></thead><tbody>
          ${v.rows
            .map(
              (r) => `<tr class="is-${r.flag}${this.excluded.has(r.id) ? ' is-ex' : ''}"><td>${esc(r.id)}</td><td>${esc(r.code)}</td><td>${esc(r.coords)}</td><td>${esc(r.sol)}</td><td>${esc(r.sigma)}</td>
              <td>${esc(FLAG[r.flag])}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td>
              <td><button data-p="ex:${esc(r.id)}">${this.excluded.has(r.id) ? 'Vrátit' : 'Vyřadit'}</button></td></tr>`,
            )
            .join('') || '<tr><td colspan="7">V zakázce nejsou žádné body.</td></tr>'}
          </tbody></table></div>
          <p class="${bad ? 'pr-warn' : 'pr-ok'}">${bad ? `Ve výsledku je ${bad} podezřelých měření.` : 'Nic podezřelého ve výsledku.'}</p>
          <button data-p="next:output" class="pr-primary">Pokračovat na výstup</button>`;
        break;
      case 'output':
        body = `<h3>Výstup pro objednatele</h3>
          <p>Co objednatel ${esc(v.client)} pro zakázku „${esc(v.job)}“ čeká?</p>
          <div class="pr-opts">${v.outputs.map((o) => `<button data-p="out:${o.id}" class="${this.output === o.id ? 'is-sel' : ''}">${esc(o.label)}</button>`).join('')}</div>
          <button data-p="next:send" class="pr-primary" ${this.output ? '' : 'disabled'}>Pokračovat</button>`;
        break;
      case 'send':
        body = `<h3>Odeslat objednateli</h3>
          <ul class="pr-list"><li>Bodů ve výsledku: ${v.rows.length - this.excluded.size} (vyřazeno ${this.excluded.size})</li>
          <li>Podezřelých měření ve výsledku: ${bad}</li>
          <li>Výstup: ${esc(v.outputs.find((o) => o.id === this.output)?.label ?? 'nevybrán')}</li></ul>
          <p>Po odeslání přijde kontrolní zaměření a protokol. Zpracování zabere asi 40 minut.</p>
          <button data-p="send" class="pr-primary" ${this.imported && this.output ? '' : 'disabled'}>Odeslat e-mailem a fakturovat</button>`;
        break;
    }
    this.el.innerHTML = `<div class="pr-win">
      <header><span class="pr-app">GeoKancl</span><span class="pr-title">${esc(v.job)}</span><button data-p="close">✕</button></header>
      <nav class="pr-menu"><span>Soubor</span><span>Úpravy</span><span>Výpočty</span><span>Výstupy</span><span>Nápověda</span></nav>
      <div class="pr-main">
        <aside>${steps.map(([id, l]) => `<button data-p="step:${id}" class="${this.step === id ? 'is-sel' : ''}">${l}</button>`).join('')}</aside>
        <section>${body}</section>
      </div>
    </div>`;
  }
}
