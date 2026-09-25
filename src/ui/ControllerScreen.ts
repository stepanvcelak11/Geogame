/**
 * Kontroler GNSS: polní software po vzoru skutečných aplikací (Trimble Access, Leica Captivate,
 * Carlson SurvCE). Stavový řádek + stránky: zakázka, import, Bluetooth, korekce NTRIP,
 * anténa, měření, vytyčení a seznam bodů. Hra dodává stav, obrazovka vrací akce.
 */

export interface ControllerView {
  status: {
    clock: string;
    bt: boolean;
    corr: 'off' | 'ok' | 'late';
    age: string;
    solution: string;
    tone: 'fix' | 'float' | 'bad';
    sats: number;
    pdop: string;
    prec: string; // „H 0,012 V 0,019“
    battery: number;
  };
  job: { name: string; crs: string } | null;
  next: { page: string; text: string } | null; // co udělat teď (zvýrazní dlaždici)
  jobs: string[];
  suggestedName: string;
  crs: { id: string; label: string; detail: string }[];
  files: { id: string; name: string; desc: string; count: number; imported: boolean }[];
  bt: { devices: { id: string; label: string }[]; connected: string | null };
  ntrip: { caster: string; host: string; port: number; user: string; mounts: { id: string; label: string }[]; mount: string | null; on: boolean };
  antenna: { types: { id: string; label: string }[]; type: string | null; height: number | null };
  measure: {
    nextId: string;
    codes: string[];
    code: number;
    epochs: number[];
    epoch: number;
    tol: string;
    obs: { t: number; need: number } | null;
    last: string[];
    blocked: string | null; // proč teď měřit nejde
  };
  stake: { targets: { id: string; label: string; state: 'pending' | 'done' }[]; selected: string | null; note: string };
  points: { id: string; code: string; coords: string; prec: string; check?: string }[];
}

type Page = 'home' | 'job' | 'import' | 'bt' | 'ntrip' | 'antenna' | 'measure' | 'stake' | 'points';

const TILES: { page: Page; icon: string; label: string }[] = [
  { page: 'job', icon: '📁', label: 'Zakázka' },
  { page: 'import', icon: '⇩', label: 'Import' },
  { page: 'bt', icon: 'ᛒ', label: 'Přijímač' },
  { page: 'ntrip', icon: '📶', label: 'Korekce' },
  { page: 'antenna', icon: '⌖', label: 'Anténa' },
  { page: 'measure', icon: '◎', label: 'Měřit body' },
  { page: 'stake', icon: '⚑', label: 'Vytyčit' },
  { page: 'points', icon: '☰', label: 'Body' },
];

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export class ControllerScreen {
  private readonly el: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly pageEl: HTMLElement;
  private page: Page = 'home';
  private key = '';
  private view: ControllerView | null = null;
  private btSearch: 'idle' | 'busy' | 'done' = 'idle';
  private mountsLoad: 'idle' | 'busy' | 'done' = 'idle';
  onAction: ((id: string, value?: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ctrl';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="ctrl-device">
        <div class="ctrl-status"></div>
        <div class="ctrl-page"></div>
      </div>`;
    root.appendChild(this.el);
    this.statusEl = this.el.querySelector('.ctrl-status') as HTMLElement;
    this.pageEl = this.el.querySelector('.ctrl-page') as HTMLElement;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b || (b as HTMLButtonElement).disabled) return;
      this.click(b.dataset.c ?? '', b);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(page: Page = 'home'): void {
    this.page = page;
    this.key = '';
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private go(page: Page): void {
    this.page = page;
    this.key = '';
    if (this.view) this.update(this.view);
  }

  private click(id: string, b: HTMLElement): void {
    const cut = id.indexOf(':');
    const cmd = cut < 0 ? id : id.slice(0, cut);
    const arg = cut < 0 ? '' : id.slice(cut + 1);
    const act = (a: string, v?: string): void => this.onAction?.(a, v);
    switch (cmd) {
      case 'close':
        return this.hide();
      case 'go':
        return this.go(arg as Page);
      case 'create': {
        const name = (this.pageEl.querySelector('.cj-name') as HTMLInputElement | null)?.value ?? '';
        const crs = (this.pageEl.querySelector('input[name="cj-crs"]:checked') as HTMLInputElement | null)?.value ?? '';
        if (!crs) return;
        act('job:create', `${name}|${crs}`);
        return this.go('home');
      }
      case 'open':
        act('job:open', arg);
        return this.go('home');
      case 'import':
        return act('import:toggle', arg);
      case 'btsearch':
        this.btSearch = 'busy';
        this.key = '';
        setTimeout(() => {
          this.btSearch = 'done';
          this.key = '';
          if (this.view) this.update(this.view);
        }, 1600);
        if (this.view) this.update(this.view);
        return;
      case 'bt':
        return act('bt:connect', arg);
      case 'btoff':
        return act('bt:disconnect');
      case 'mounts':
        this.mountsLoad = 'busy';
        this.key = '';
        setTimeout(() => {
          this.mountsLoad = 'done';
          this.key = '';
          if (this.view) this.update(this.view);
        }, 1200);
        if (this.view) this.update(this.view);
        return;
      case 'mount':
        return act('ntrip:mount', arg);
      case 'ntrip':
        return act(arg === 'on' ? 'ntrip:connect' : 'ntrip:disconnect');
      case 'anttype':
        return act('ant:type', arg);
      case 'antset': {
        const v = (this.pageEl.querySelector('.ant-h') as HTMLInputElement | null)?.value ?? '';
        return act('ant:height', v);
      }
      case 'code':
        return act('meas:code', arg);
      case 'epoch':
        return act('meas:epochs', arg);
      case 'measure':
        act('meas:start');
        return this.hide();
      case 'stake':
        act('stake:select', arg);
        return this.hide();
      default:
        void b;
    }
  }

  update(v: ControllerView): void {
    this.view = v;
    if (this.el.hidden) return;
    const s = v.status;
    this.statusEl.innerHTML = `
      <span class="cs-clock">${esc(s.clock)}</span>
      <span class="cs-bt${s.bt ? ' is-on' : ''}" title="Bluetooth">ᛒ</span>
      <span class="cs-corr is-${s.corr}" title="Korekce">📶 ${esc(s.age)}</span>
      <span class="cs-sol is-${s.tone}">${esc(s.solution)}</span>
      <span class="cs-sat">🛰 ${s.sats}</span>
      <span class="cs-pdop">PDOP ${esc(s.pdop)}</span>
      <span class="cs-prec">${esc(s.prec)}</span>
      <span class="cs-bat">▮ ${Math.round(s.battery)} %</span>`;
    const key = JSON.stringify({ p: this.page, v: { ...v, status: undefined, measure: { ...v.measure } }, bt: this.btSearch, m: this.mountsLoad });
    if (key === this.key) return;
    this.key = key;
    this.pageEl.innerHTML = this.renderPage(v);
  }

  private header(title: string, back = true): string {
    return `<header class="cp-head">${back ? '<button data-c="go:home" class="cp-back">‹ Zpět</button>' : ''}<h2>${esc(title)}</h2><button data-c="close" class="cp-x">Zavřít</button></header>`;
  }

  private renderPage(v: ControllerView): string {
    switch (this.page) {
      case 'home': {
        const warn = !v.job ? 'Není otevřená žádná zakázka.' : '';
        return `${this.header('GeoTerén', false)}
          <p class="cp-job">${v.job ? `Zakázka <b>${esc(v.job.name)}</b> · ${esc(v.job.crs)}` : `<span class="cp-warn">${warn}</span>`}</p>
          ${v.next ? `<p class="cp-next"><b>Další krok:</b> ${esc(v.next.text)}</p>` : ''}
          <div class="cp-tiles">${TILES.map((t) => `<button data-c="go:${t.page}" class="${v.next?.page === t.page ? 'is-next' : ''}"><span>${t.icon}</span>${t.label}</button>`).join('')}</div>`;
      }
      case 'job':
        return `${this.header('Zakázka')}
          <div class="cp-scroll">
          ${v.jobs.length ? `<h3>Otevřít existující</h3><div class="cp-list">${v.jobs.map((n) => `<button data-c="open:${esc(n)}" class="${v.job?.name === n ? 'is-sel' : ''}">${esc(n)}</button>`).join('')}</div>` : ''}
          <h3>Nová zakázka</h3>
          <label class="cp-field">Název <input class="cj-name" value="${esc(v.suggestedName)}" maxlength="32" autocomplete="off"></label>
          <h3>Souřadnicový systém</h3>
          <div class="cp-radios">${v.crs
            .map((c) => `<label><input type="radio" name="cj-crs" value="${c.id}"><span><b>${esc(c.label)}</b><small>${esc(c.detail)}</small></span></label>`)
            .join('')}</div>
          <button data-c="create" class="cp-primary">Vytvořit zakázku</button>
          </div>`;
      case 'import':
        return `${this.header('Import souřadnic')}
          <div class="cp-scroll">
          ${v.job ? '' : '<p class="cp-warn">Nejdřív založ nebo otevři zakázku.</p>'}
          <p class="cp-note">Soubory z kancelářské složky zakázky (CSV: číslo, Y, X, H). Nahrané body kontroler použije pro vytyčení a porovnání se známými body.</p>
          <div class="cp-list">${v.files
            .map(
              (f) =>
                `<button data-c="import:${f.id}" ${v.job ? '' : 'disabled'} class="${f.imported ? 'is-sel' : ''}"><b>${f.imported ? '✓ ' : ''}${esc(f.name)}</b><small>${esc(f.desc)} · ${f.count} bodů</small></button>`,
            )
            .join('')}</div>
          </div>`;
      case 'bt':
        return `${this.header('Připojení přijímače')}
          <div class="cp-scroll">
          <p class="cp-note">Bluetooth. Přijímač musí být zapnutý.</p>
          ${v.bt.connected ? `<p class="cp-ok">Připojeno: ${esc(v.bt.devices.find((d) => d.id === v.bt.connected)?.label ?? v.bt.connected)}</p><button data-c="btoff">Odpojit</button>` : ''}
          <button data-c="btsearch" ${this.btSearch === 'busy' ? 'disabled' : ''}>${this.btSearch === 'busy' ? 'Hledám zařízení…' : 'Hledat zařízení'}</button>
          ${this.btSearch === 'done' ? `<div class="cp-list">${v.bt.devices.map((d) => `<button data-c="bt:${d.id}" class="${v.bt.connected === d.id ? 'is-sel' : ''}">${esc(d.label)}</button>`).join('') || '<p class="cp-warn">Nic nenalezeno. Je přijímač zapnutý?</p>'}</div>` : ''}
          </div>`;
      case 'ntrip': {
        const n = v.ntrip;
        return `${this.header('Korekce RTK (NTRIP)')}
          <div class="cp-scroll">
          <dl class="cp-dl"><dt>Síť</dt><dd>${esc(n.caster)}</dd><dt>Server</dt><dd>${esc(n.host)}:${n.port}</dd><dt>Uživatel</dt><dd>${esc(n.user)}</dd><dt>Heslo</dt><dd>••••••••</dd></dl>
          <button data-c="mounts" ${this.mountsLoad === 'busy' || !v.bt.connected ? 'disabled' : ''}>${this.mountsLoad === 'busy' ? 'Načítám tabulku zdrojů…' : 'Načíst tabulku zdrojů (mountpointy)'}</button>
          ${v.bt.connected ? '' : '<p class="cp-warn">Nejdřív připoj přijímač.</p>'}
          ${this.mountsLoad === 'done' || n.mount ? `<div class="cp-list">${n.mounts.map((m) => `<button data-c="mount:${m.id}" class="${n.mount === m.id ? 'is-sel' : ''}"><b>${esc(m.id)}</b><small>${esc(m.label)}</small></button>`).join('')}</div>` : ''}
          ${n.mount ? (n.on ? '<button data-c="ntrip:off">Odpojit korekce</button>' : '<button data-c="ntrip:on" class="cp-primary">Připojit</button>') : ''}
          </div>`;
      }
      case 'antenna': {
        const a = v.antenna;
        return `${this.header('Anténa')}
          <div class="cp-scroll">
          <h3>Typ antény</h3>
          <div class="cp-list">${a.types.map((t) => `<button data-c="anttype:${t.id}" class="${a.type === t.id ? 'is-sel' : ''}">${esc(t.label)}</button>`).join('')}</div>
          <h3>Výška antény</h3>
          <p class="cp-note">Měřeno k patě antény (ARP), tj. vysunutí výtyčky.</p>
          <label class="cp-field">Výška [m] <input class="ant-h" type="number" inputmode="decimal" step="0.001" min="0" max="5" value="${a.height ?? ''}"></label>
          <button data-c="antset" class="cp-primary">Uložit výšku</button>
          ${a.height !== null ? `<p class="cp-ok">Zadáno ${a.height.toFixed(3).replace('.', ',')} m</p>` : ''}
          </div>`;
      }
      case 'measure': {
        const m = v.measure;
        return `${this.header('Měřit body')}
          <div class="cp-scroll">
          <dl class="cp-dl"><dt>Číslo bodu</dt><dd>${esc(m.nextId)}</dd><dt>Tolerance</dt><dd>${esc(m.tol)}</dd></dl>
          <h3>Kód</h3>
          <div class="cp-chips">${m.codes.map((c, i) => `<button data-c="code:${i}" class="${i === m.code ? 'is-sel' : ''}">${esc(c)}</button>`).join('')}</div>
          <h3>Doba observace</h3>
          <div class="cp-chips">${m.epochs.map((e) => `<button data-c="epoch:${e}" class="${e === m.epoch ? 'is-sel' : ''}">${e} s</button>`).join('')}</div>
          ${m.blocked ? `<p class="cp-warn">${esc(m.blocked)}</p>` : ''}
          <button data-c="measure" class="cp-primary" ${m.blocked || m.obs ? 'disabled' : ''}>${m.obs ? `Měřím ${m.obs.t.toFixed(0)} / ${m.obs.need} s` : 'Měřit'}</button>
          ${m.last.length ? `<h3>Poslední bod</h3><ul class="cp-last">${m.last.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
          </div>`;
      }
      case 'stake': {
        const st = v.stake;
        return `${this.header('Vytyčit body')}
          <div class="cp-scroll">
          <p class="cp-note">${esc(st.note)}</p>
          <div class="cp-list">${st.targets
            .map((t) => `<button data-c="stake:${t.id}" class="${st.selected === t.id ? 'is-sel' : ''}${t.state === 'done' ? ' is-done' : ''}"><b>${t.state === 'done' ? '✓ ' : ''}${esc(t.id)}</b><small>${esc(t.label)}</small></button>`)
            .join('')}</div>
          </div>`;
      }
      case 'points':
        return `${this.header('Body v zakázce')}
          <div class="cp-scroll">
          ${v.points.length ? `<table class="cp-table"><thead><tr><th>Bod</th><th>Kód</th><th>Y / X / H</th><th>σ</th></tr></thead><tbody>${v.points
            .map((p) => `<tr><td>${esc(p.id)}</td><td>${esc(p.code)}</td><td>${esc(p.coords)}${p.check ? `<br><small>${esc(p.check)}</small>` : ''}</td><td>${esc(p.prec)}</td></tr>`)
            .join('')}</tbody></table>` : '<p class="cp-note">V zakázce zatím nejsou žádné body.</p>'}
          </div>`;
    }
  }
}
