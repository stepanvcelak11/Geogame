/**
 * Program totální stanice (po vzoru Leica Captivate / FlexLine): zakázka, import bodů,
 * hranol a výška cíle, atmosférická korekce a přehled stanoviska. Stejné ovládání jako
 * kontroler GNSS: dlaždice, řádek „Další krok“, stránky.
 */
export interface TsSoftView {
  status: { clock: string; battery: number; station: string; ppm: string };
  job: string | null;
  jobs: string[];
  suggestedName: string;
  next: { page: TsPage; text: string } | null;
  files: { id: string; name: string; desc: string; count: number; imported: boolean }[];
  prisms: { id: string; label: string; constMm: number }[];
  prism: string;
  targetH: number;
  atm: { temp: number; press: number; ppm: string; hint: string };
  station: string[];
  canContinue: string | null; // text tlačítka „pokračovat“ (když se program otevřel při ustavení)
}

export type TsPage = 'home' | 'job' | 'import' | 'prism' | 'atm' | 'station';

const TILES: { page: TsPage; icon: string; label: string }[] = [
  { page: 'job', icon: '📁', label: 'Zakázka' },
  { page: 'import', icon: '⇩', label: 'Import bodů' },
  { page: 'prism', icon: '◈', label: 'Hranol a cíl' },
  { page: 'atm', icon: '🌡', label: 'Atmosféra' },
  { page: 'station', icon: '⌖', label: 'Stanovisko' },
];

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const num = (v: number, d: number): string => v.toFixed(d).replace('.', ',');

export class TsSoftware {
  private readonly el: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly pageEl: HTMLElement;
  private page: TsPage = 'home';
  private key = '';
  private view: TsSoftView | null = null;
  onAction: ((id: string, value?: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ctrl ts-soft';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="ctrl-device"><div class="ctrl-status"></div><div class="ctrl-page"></div></div>`;
    root.appendChild(this.el);
    this.statusEl = this.el.querySelector('.ctrl-status') as HTMLElement;
    this.pageEl = this.el.querySelector('.ctrl-page') as HTMLElement;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b || (b as HTMLButtonElement).disabled) return;
      this.click(b.dataset.c ?? '');
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(page: TsPage = 'home'): void {
    this.page = page;
    this.key = '';
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private go(page: TsPage): void {
    this.page = page;
    this.key = '';
    if (this.view) this.update(this.view);
  }

  private click(id: string): void {
    const cut = id.indexOf(':');
    const cmd = cut < 0 ? id : id.slice(0, cut);
    const arg = cut < 0 ? '' : id.slice(cut + 1);
    const act = (a: string, v?: string): void => this.onAction?.(a, v);
    const val = (sel: string): string => (this.pageEl.querySelector(sel) as HTMLInputElement | null)?.value ?? '';
    switch (cmd) {
      case 'close':
        return this.hide();
      case 'go':
        return this.go(arg as TsPage);
      case 'create':
        act('job:create', val('.tj-name'));
        return this.go('home');
      case 'open':
        act('job:open', arg);
        return this.go('home');
      case 'import':
        return act('import:toggle', arg);
      case 'prism':
        return act('prism:set', arg);
      case 'target':
        act('target:set', val('.tt-h'));
        return this.go('home');
      case 'atm':
        act('atm:set', `${val('.ta-t')}|${val('.ta-p')}`);
        return this.go('home');
      case 'continue':
        act('continue');
        return this.hide();
    }
  }

  update(v: TsSoftView): void {
    this.view = v;
    if (this.el.hidden) return;
    const s = v.status;
    this.statusEl.innerHTML = `
      <span class="cs-clock">${esc(s.clock)}</span>
      <span class="cs-sol is-${s.station.startsWith('Orient') ? 'fix' : s.station.startsWith('Bez') ? 'bad' : 'float'}">${esc(s.station)}</span>
      <span class="cs-pdop">${esc(s.ppm)}</span>
      <span class="cs-bat${s.battery < 15 ? ' is-low' : ''}">▮ ${Math.round(s.battery)} %</span>`;
    const key = JSON.stringify({ p: this.page, v: { ...v, status: undefined } });
    if (key === this.key) return;
    this.key = key;
    this.pageEl.innerHTML = this.renderPage(v);
  }

  private header(title: string, back = true): string {
    return `<header class="cp-head">${back ? '<button data-c="go:home" class="cp-back">‹ Zpět</button>' : ''}<h2>${esc(title)}</h2><button data-c="close" class="cp-x">Zavřít</button></header>`;
  }

  private renderPage(v: TsSoftView): string {
    switch (this.page) {
      case 'home':
        return `${this.header('Stanice TS16 · FlexField', false)}
          <p class="cp-job">${v.job ? `Zakázka <b>${esc(v.job)}</b>` : '<span class="cp-warn">Není otevřená žádná zakázka.</span>'}</p>
          ${v.next ? `<p class="cp-next"><b>Další krok:</b> ${esc(v.next.text)}</p>` : '<p class="cp-ok">Stanice je připravená k měření.</p>'}
          <div class="cp-tiles">${TILES.map((t) => `<button data-c="go:${t.page}" class="${v.next?.page === t.page ? 'is-next' : ''}"><span>${t.icon}</span>${t.label}</button>`).join('')}</div>
          ${v.canContinue ? `<button data-c="continue" class="cp-primary" ${v.next && v.next.page !== 'station' ? 'disabled' : ''}>${esc(v.canContinue)}</button>` : ''}`;
      case 'job':
        return `${this.header('Zakázka')}
          <div class="cp-scroll">
          ${v.jobs.length ? `<h3>Otevřít existující</h3><div class="cp-list">${v.jobs.map((n) => `<button data-c="open:${esc(n)}" class="${v.job === n ? 'is-sel' : ''}">${esc(n)}</button>`).join('')}</div>` : ''}
          <h3>Nová zakázka</h3>
          <label class="cp-field">Název <input class="tj-name" value="${esc(v.suggestedName)}" maxlength="32" autocomplete="off"></label>
          <p class="cp-note">Souřadnicový systém stanice: S-JTSK (souřadnice přebírá z nahraných bodů), výšky Bpv.</p>
          <button data-c="create" class="cp-primary">Vytvořit zakázku</button>
          </div>`;
      case 'import':
        return `${this.header('Import bodů')}
          <div class="cp-scroll">
          ${v.job ? '' : '<p class="cp-warn">Nejdřív založ nebo otevři zakázku.</p>'}
          <p class="cp-note">Z USB flash disku (CSV: číslo, Y, X, H). Stanice z nich bere souřadnice stanoviska a orientace – bez nich neví, kde stojí.</p>
          <div class="cp-list">${v.files
            .map((f) => `<button data-c="import:${f.id}" ${v.job ? '' : 'disabled'} class="${f.imported ? 'is-sel' : ''}"><b>${f.imported ? '✓ ' : ''}${esc(f.name)}</b><small>${esc(f.desc)} · ${f.count} bodů</small></button>`)
            .join('')}</div>
          </div>`;
      case 'prism':
        return `${this.header('Hranol a výška cíle')}
          <div class="cp-scroll">
          <h3>Typ hranolu</h3>
          <p class="cp-note">Adiční konstanta se přičítá ke každé délce na hranol. Podívej se, jaký hranol je na výtyčce.</p>
          <div class="cp-list">${v.prisms.map((p) => `<button data-c="prism:${p.id}" class="${v.prism === p.id ? 'is-sel' : ''}"><b>${esc(p.label)}</b><small>konstanta ${p.constMm >= 0 ? '+' : ''}${num(p.constMm, 1)} mm</small></button>`).join('')}</div>
          <h3>Výška cíle</h3>
          <p class="cp-note">Výška středu hranolu nad hrotem výtyčky (odečti na výtyčce).</p>
          <label class="cp-field">v<sub>c</sub> [m] <input class="tt-h" type="number" inputmode="decimal" step="0.001" min="0" max="5" value="${v.targetH.toFixed(3)}"></label>
          <button data-c="target" class="cp-primary">Uložit výšku cíle</button>
          </div>`;
      case 'atm':
        return `${this.header('Atmosférická korekce')}
          <div class="cp-scroll">
          <p class="cp-note">Rychlost světla ve vzduchu závisí na teplotě a tlaku. Špatné hodnoty zkreslí všechny délky úměrně vzdálenosti (1 °C ≈ 1 ppm = 1 mm na km).</p>
          <p class="cp-ok">${esc(v.atm.hint)}</p>
          <label class="cp-field">Teplota [°C] <input class="ta-t" type="number" inputmode="decimal" step="1" value="${v.atm.temp}"></label>
          <label class="cp-field">Tlak [hPa] <input class="ta-p" type="number" inputmode="decimal" step="1" value="${v.atm.press}"></label>
          <p class="cp-note">Korekce ${esc(v.atm.ppm)}</p>
          <button data-c="atm" class="cp-primary">Uložit</button>
          </div>`;
      case 'station':
        return `${this.header('Stanovisko')}
          <div class="cp-scroll">
          <ul class="cp-last">${v.station.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
          ${v.canContinue ? `<button data-c="continue" class="cp-primary" ${v.next && v.next.page !== 'station' ? 'disabled' : ''}>${esc(v.canContinue)}</button>` : ''}
          </div>`;
    }
  }
}
