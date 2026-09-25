/**
 * Řídicí panel 3D systému finišeru (po vzoru Leica iCON pave / Trimble Roadworks):
 * stav sledování stanicí, odchylky desky od 3D modelu, výběr modelu, kalibrace desky,
 * připojení robotické stanice a start/stop pokládky.
 */
export interface MachineView {
  status: { lock: 'ok' | 'lost' | 'off'; km: string; dist: string; speed: string };
  dev: { left: string; right: string; slope: string } | null;
  next: { page: MachinePage; text: string } | null;
  models: { id: string; file: string; label: string }[];
  model: string | null;
  calibrated: boolean;
  calibText: string;
  station: string[];
  canTrack: boolean;
  tracking: boolean;
  running: boolean;
  canStart: boolean;
  log: string[];
}

export type MachinePage = 'home' | 'model' | 'calib' | 'station';

const TILES: { page: MachinePage; icon: string; label: string }[] = [
  { page: 'model', icon: '🗺', label: '3D model' },
  { page: 'calib', icon: '⇕', label: 'Kalibrace desky' },
  { page: 'station', icon: '⌖', label: 'Stanice' },
];

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export class MachinePanel {
  private readonly el: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly pageEl: HTMLElement;
  private page: MachinePage = 'home';
  private key = '';
  private view: MachineView | null = null;
  onAction: ((id: string, value?: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ctrl ts-soft machine';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="ctrl-device"><div class="ctrl-status"></div><div class="ctrl-page"></div></div>`;
    root.appendChild(this.el);
    this.statusEl = this.el.querySelector('.ctrl-status') as HTMLElement;
    this.pageEl = this.el.querySelector('.ctrl-page') as HTMLElement;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b || (b as HTMLButtonElement).disabled) return;
      const id = b.dataset.c ?? '';
      const cut = id.indexOf(':');
      const cmd = cut < 0 ? id : id.slice(0, cut);
      const arg = cut < 0 ? '' : id.slice(cut + 1);
      if (cmd === 'close') return this.hide();
      if (cmd === 'go') return this.go(arg as MachinePage);
      this.onAction?.(cmd, arg);
      if (cmd === 'model' || cmd === 'calib') this.go('home');
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.page = 'home';
    this.key = '';
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private go(p: MachinePage): void {
    this.page = p;
    this.key = '';
    if (this.view) this.update(this.view);
  }

  update(v: MachineView): void {
    this.view = v;
    if (this.el.hidden) return;
    const s = v.status;
    this.statusEl.innerHTML = `
      <span class="cs-sol is-${s.lock === 'ok' ? 'fix' : s.lock === 'lost' ? 'bad' : 'float'}">${s.lock === 'ok' ? 'TPS zamčeno' : s.lock === 'lost' ? 'TPS ztraceno' : 'TPS nepřipojeno'}</span>
      <span class="cs-pdop">km ${esc(s.km)}</span>
      <span class="cs-pdop">${esc(s.dist)}</span>
      <span class="cs-bat">${esc(s.speed)}</span>`;
    const key = JSON.stringify({ p: this.page, v: { ...v, status: undefined, dev: this.page === 'home' ? v.dev : null } });
    if (key === this.key) return;
    this.key = key;
    this.pageEl.innerHTML = this.render(v);
  }

  private header(t: string, back = true): string {
    return `<header class="cp-head">${back ? '<button data-c="go:home" class="cp-back">‹ Zpět</button>' : ''}<h2>${esc(t)}</h2><button data-c="close" class="cp-x">Zavřít</button></header>`;
  }

  private render(v: MachineView): string {
    switch (this.page) {
      case 'home':
        return `${this.header('Finišer · 3D řízení desky', false)}
          ${v.next ? `<p class="cp-next"><b>Další krok:</b> ${esc(v.next.text)}</p>` : ''}
          ${v.dev ? `<dl class="cp-dl mp-dev"><dt>Deska vlevo</dt><dd>${esc(v.dev.left)}</dd><dt>Deska vpravo</dt><dd>${esc(v.dev.right)}</dd><dt>Příčný sklon</dt><dd>${esc(v.dev.slope)}</dd></dl>` : ''}
          <div class="cp-tiles">${TILES.map((t) => `<button data-c="go:${t.page}" class="${v.next?.page === t.page ? 'is-next' : ''}"><span>${t.icon}</span>${t.label}</button>`).join('')}</div>
          ${v.running ? '<button data-c="stop">Zastavit pokládku</button>' : `<button data-c="start" class="cp-primary" ${v.canStart ? '' : 'disabled'}>Spustit pokládku</button>`}
          ${v.log.length ? `<ul class="cp-last">${v.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`;
      case 'model':
        return `${this.header('3D model vrstvy')}
          <div class="cp-scroll">
          <p class="cp-note">Model horní plochy vrstvy, kterou se právě pokládá. Deska jede podle něj – špatný model = celá vrstva ve špatné výšce.</p>
          <div class="cp-list">${v.models.map((m) => `<button data-c="model:${m.id}" class="${v.model === m.id ? 'is-sel' : ''}"><b>${esc(m.file)}</b><small>${esc(m.label)}</small></button>`).join('')}</div>
          </div>`;
      case 'calib':
        return `${this.header('Kalibrace desky')}
          <div class="cp-scroll">
          <p class="cp-note">Stanice změří hranol na stožáru, zatímco deska stojí na podkladu. Systém tak zjistí výšku hrany desky pod hranolem (offset stožáru). Bez kalibrace jede deska o offset vedle.</p>
          <p class="${v.calibrated ? 'cp-ok' : 'cp-warn'}">${esc(v.calibText)}</p>
          <button data-c="calib" class="cp-primary" ${v.canTrack ? '' : 'disabled'}>Kalibrovat (stanice změří stožár)</button>
          ${v.canTrack ? '' : '<p class="cp-warn">Nejdřív ustav stanici se stanoviskem a orientací.</p>'}
          </div>`;
      case 'station':
        return `${this.header('Robotická stanice')}
          <div class="cp-scroll">
          <ul class="cp-last">${v.station.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
          ${v.tracking ? '<button data-c="untrack">Odpojit stanici</button>' : `<button data-c="track" class="cp-primary" ${v.canTrack ? '' : 'disabled'}>Připojit stanici a sledovat hranol</button>`}
          </div>`;
    }
  }
}
