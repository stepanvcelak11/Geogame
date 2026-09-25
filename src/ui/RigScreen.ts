import { POLE_HEIGHTS, type RoverRig } from '../items/items';

export type RigMode = 'assemble' | 'pack';

/** Kolik otáček má závit 5/8″, než přijímač dosedne. */
const SCREW_TURNS = 4;
const PX_PER_TURN = 160;
const HOLD_MS = 1500;

/**
 * Sestavení GNSS roveru u otevřeného kufru: vysunout výtyčku na aretaci, našroubovat
 * přijímač, nasadit držák s kontrolerem a obojí zapnout (podržením tlačítka).
 * Obráceně rozebrání do kufru. Mění přímo předaný stav výtyčky.
 */
export class RigScreen {
  private readonly el: HTMLElement;
  private rig: RoverRig | null = null;
  private mode: RigMode = 'assemble';
  private screw = 0; // 0…1 dotažení (při rozebírání 1 → 0)
  private dragX: number | null = null;
  private hold: { what: 'receiver' | 'controller'; t0: number; timer: number } | null = null;
  onChange: ((event: 'height' | 'screw' | 'receiver' | 'controller' | 'power') => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'rig';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rig]');
      if (!b || !this.rig) return;
      this.click(b.dataset.rig ?? '');
    });
    this.el.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.rig-screw')) {
        this.dragX = e.clientX;
        (t.closest('.rig-screw') as HTMLElement).setPointerCapture(e.pointerId);
      }
      const p = t.closest<HTMLElement>('[data-power]');
      if (p && !(p as HTMLButtonElement).disabled) this.startHold(p.dataset.power as 'receiver' | 'controller');
    });
    this.el.addEventListener('pointermove', (e) => {
      if (this.dragX === null || !this.rig) return;
      const dx = e.clientX - this.dragX;
      this.dragX = e.clientX;
      this.turn(dx);
    });
    const end = (): void => {
      this.dragX = null;
      this.stopHold();
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('pointerleave', end);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(rig: RoverRig, mode: RigMode): void {
    this.rig = rig;
    this.mode = mode;
    this.screw = rig.receiver ? 1 : 0;
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.stopHold();
    this.el.hidden = true;
    this.onClose?.();
  }

  /** Otáčení závitem tažením do strany: doprava utahuje, doleva povoluje. */
  private turn(dx: number): void {
    const rig = this.rig;
    if (!rig) return;
    if (this.mode === 'assemble' && rig.receiver) return;
    if (this.mode === 'pack' && (!rig.receiver || rig.receiverOn)) return;
    const before = Math.floor(this.screw * SCREW_TURNS * 4);
    const dir = this.mode === 'assemble' ? 1 : -1;
    this.screw = Math.max(0, Math.min(1, this.screw + (dir * Math.max(0, dir * dx)) / (PX_PER_TURN * SCREW_TURNS)));
    if (Math.floor(this.screw * SCREW_TURNS * 4) !== before) this.onChange?.('screw');
    if (this.mode === 'assemble' && this.screw >= 1) {
      rig.receiver = true;
      this.onChange?.('receiver');
    }
    if (this.mode === 'pack' && this.screw <= 0) {
      rig.receiver = false;
      this.onChange?.('receiver');
    }
    this.render();
  }

  private click(id: string): void {
    const rig = this.rig as RoverRig;
    const i = POLE_HEIGHTS.findIndex((h) => Math.abs(h - rig.height) < 1e-6);
    if (id === 'up' || id === 'down') {
      const j = Math.max(0, Math.min(POLE_HEIGHTS.length - 1, (i < 0 ? 14 : i) + (id === 'up' ? 1 : -1)));
      rig.height = POLE_HEIGHTS[j];
      this.onChange?.('height');
    } else if (id === 'controller') {
      if (this.mode === 'assemble') rig.controller = true;
      else if (!rig.controllerOn) rig.controller = false;
      this.onChange?.('controller');
    } else if (id === 'close') return this.hide();
    this.render();
  }

  private startHold(what: 'receiver' | 'controller'): void {
    this.stopHold();
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      const k = (performance.now() - t0) / HOLD_MS;
      const bar = this.el.querySelector<HTMLElement>(`[data-power="${what}"] i`);
      if (bar) bar.style.width = `${Math.min(100, k * 100)}%`;
      if (k >= 1) this.stopHold();
    }, 50);
    this.hold = { what, t0, timer };
  }

  /** Konec podržení: když trvalo aspoň HOLD_MS, přepne napájení (i když časovač nestihl tiknout). */
  private stopHold(): void {
    const h = this.hold;
    if (!h) return;
    clearInterval(h.timer);
    this.hold = null;
    const bar = this.el.querySelector<HTMLElement>(`[data-power="${h.what}"] i`);
    if (bar) bar.style.width = '0';
    if (performance.now() - h.t0 < HOLD_MS || !this.rig) return;
    if (h.what === 'receiver') this.rig.receiverOn = !this.rig.receiverOn;
    else this.rig.controllerOn = !this.rig.controllerOn;
    this.onChange?.('power');
    this.render();
  }

  private render(): void {
    const rig = this.rig;
    if (!rig) return;
    const pack = this.mode === 'pack';
    const h = rig.height.toFixed(2).replace('.', ',');
    const turns = (this.screw * SCREW_TURNS).toFixed(1).replace('.', ',');
    const step = (done: boolean, n: number, title: string, body: string): string =>
      `<li class="rig-step${done ? ' is-done' : ''}"><span class="rig-n">${done ? '✓' : n}</span><div><h3>${title}</h3>${body}</div></li>`;
    const power = (what: 'receiver' | 'controller', label: string, on: boolean, can: boolean): string =>
      `<button class="rig-power${on ? ' is-on' : ''}" data-power="${what}" ${can ? '' : 'disabled'}><i></i><span>⏻ ${label}: ${on ? 'zapnutý' : 'vypnutý'}</span><small>podrž 1,5 s</small></button>`;

    const heightStep = step(
      true,
      1,
      'Výška výtyčky',
      `<div class="rig-height"><button data-rig="down" aria-label="Zasunout">−</button><strong>${h} m</strong><button data-rig="up" aria-label="Vysunout">+</button></div>
       <p>Aretace po 5 cm. Výška platí od hrotu k patě antény (ARP). <b>Zapamatuj si ji</b>, v kontroleru ji zadáš ručně.</p>`,
    );
    const screwStep = (n: number): string => step(
      pack ? !rig.receiver : rig.receiver,
      n,
      pack ? 'Odšroubovat přijímač' : 'Našroubovat přijímač na závit 5/8″',
      `<div class="rig-screw${(pack ? !rig.receiver : rig.receiver) ? ' is-done' : ''}" style="--p:${this.screw}">
         <span class="rig-thread" style="transform: rotate(${this.screw * SCREW_TURNS * 360}deg)"></span>
         <em>${pack ? (rig.receiverOn ? 'Nejdřív přijímač vypni' : 'Táhni doleva') : 'Táhni doprava'} · ${turns} z ${SCREW_TURNS} otáček</em>
       </div>`,
    );
    const ctrlStep = (n: number): string => step(
      pack ? !rig.controller : rig.controller,
      n,
      pack ? 'Vyjmout kontroler z držáku' : 'Držák na výtyčku, kontroler do držáku',
      `<button class="rig-btn" data-rig="controller" ${(pack ? !rig.controller || rig.controllerOn : rig.controller) ? 'disabled' : ''}>${pack ? (rig.controllerOn ? 'Nejdřív kontroler vypni' : 'Vyjmout kontroler') : 'Nasadit držák a kontroler'}</button>`,
    );
    const powerStep = (n: number): string => step(
      pack ? !rig.receiverOn && !rig.controllerOn : rig.receiverOn && rig.controllerOn,
      n,
      pack ? 'Vypnout přijímač i kontroler' : 'Zapnout přijímač a kontroler',
      `<div class="rig-powers">${power('receiver', 'Přijímač', rig.receiverOn, rig.receiver)}${power('controller', 'Kontroler', rig.controllerOn, rig.controller)}</div>`,
    );
    const done = pack ? !rig.receiver && !rig.controller : rig.receiver && rig.controller && rig.receiverOn && rig.controllerOn;
    this.el.innerHTML = `<div class="rig-body">
      <header><h2>${pack ? 'Rozebrat rover do kufru' : 'Sestavení GNSS roveru'}</h2><button class="rig-close" data-rig="close">${done ? 'Hotovo' : 'Zavřít'}</button></header>
      <ol class="rig-steps">${pack ? powerStep(1) + ctrlStep(2) + screwStep(3) : heightStep + screwStep(2) + ctrlStep(3) + powerStep(4)}</ol>
    </div>`;
  }
}
