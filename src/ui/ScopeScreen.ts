/** Obsah displeje a tlačítek – stejná obrazovka slouží totální stanici i nivelačnímu přístroji. */
export interface ScopeView {
  head: string; // „Stan. 4001, v_p 1,460“
  rows: [string, string][]; // řádky displeje
  foot: string;
  measureLabel: string;
  canMeasure: boolean;
  modeLabel: string | null; // null = tlačítko skryté
  codeLabel: string | null;
  faces?: boolean | null; // měření ve dvou polohách: null = tlačítko skryté
  setupLabel: string; // „Ustavení“ / „Složit“
  finder: boolean;
  last: string | null;
  steps?: { label: string; state: 'done' | 'cur' | 'todo' }[]; // program stanice
  hint?: string; // co teď udělat
  atr?: boolean; // tlačítko automatického cílení
}

/**
 * Pohled dalekohledem totální stanice: nitkový kříž, displej, hrubé otáčení tažením
 * a jemné ustanovky (plocha „Jemně“, 12× citlivější).
 */
export class ScopeScreen {
  private readonly el: HTMLElement;
  private key = '';
  onLook: ((dx: number, dy: number) => void) | null = null;
  onMeasure: (() => void) | null = null;
  onMode: (() => void) | null = null;
  onFaces: (() => void) | null = null;
  onZoom: (() => void) | null = null;
  onAtr: (() => void) | null = null;
  onCode: (() => void) | null = null;
  onSetup: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'scope';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="scope-vignette"></div>
      <svg class="scope-cross" viewBox="-100 -100 200 200" aria-hidden="true">
        <g stroke="#111" stroke-width="0.45" fill="none">
          <line x1="-100" y1="0" x2="-6" y2="0"/><line x1="6" y1="0" x2="100" y2="0"/>
          <line x1="0" y1="-100" x2="0" y2="-6"/><line x1="0" y1="6" x2="0" y2="100"/>
          <line x1="-6" y1="0" x2="6" y2="0" stroke-width="0.25"/><line x1="0" y1="-6" x2="0" y2="6" stroke-width="0.25"/>
          <line x1="-4" y1="-30" x2="4" y2="-30"/><line x1="-4" y1="30" x2="4" y2="30"/>
          <line x1="40" y1="-1.2" x2="100" y2="-1.2" stroke-width="0.3"/><line x1="40" y1="1.2" x2="100" y2="1.2" stroke-width="0.3"/>
        </g>
      </svg>
      <p class="scope-finder-mark" hidden>Hledáček</p>
      <p class="scope-hint" hidden></p>
      <section class="scope-lcd">
        <p class="lcd-steps"></p>
        <p class="lcd-head"></p>
        <dl class="lcd-rows"></dl>
        <p class="lcd-foot"></p>
      </section>
      <div class="scope-fine" aria-label="Jemné ustanovky"><span>Jemně</span></div>
      <p class="scope-last" hidden></p>
      <nav class="scope-btns">
        <button class="sc-measure"></button>
        <button class="sc-atr" hidden>Cílit (ATR)</button>
        <button class="sc-mode"></button>
        <div class="sc-row sc-row-auto"><button class="sc-zoom"></button><button class="sc-faces" hidden title="Měřit v I. i II. poloze dalekohledu"></button></div>
        <button class="sc-code"></button>
        <div class="sc-row"><button class="sc-setup">Ustavení</button><button class="sc-close">Zavřít</button></div>
      </nav>`;
    root.appendChild(this.el);

    const btn = (sel: string, fn: () => void): void => {
      const b = this.el.querySelector(sel) as HTMLElement;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', () => fn());
    };
    btn('.sc-measure', () => this.onMeasure?.());
    btn('.sc-mode', () => this.onMode?.());
    btn('.sc-zoom', () => this.onZoom?.());
    btn('.sc-atr', () => this.onAtr?.());
    btn('.sc-code', () => this.onCode?.());
    btn('.sc-faces', () => this.onFaces?.());
    btn('.sc-setup', () => this.onSetup?.());
    btn('.sc-close', () => this.hide());

    // Hrubé otáčení: tažení kdekoli. Jemné: plocha „Jemně“.
    this.bindDrag(this.el, 1);
    this.bindDrag(this.el.querySelector('.scope-fine') as HTMLElement, 1 / 12);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.key = '';
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private bindDrag(target: HTMLElement, factor: number): void {
    const pts = new Map<number, { x: number; y: number }>();
    target.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* nevadí */
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    target.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      this.onLook?.((e.clientX - p.x) * factor, (e.clientY - p.y) * factor);
      p.x = e.clientX;
      p.y = e.clientY;
    });
    const end = (e: PointerEvent): void => {
      pts.delete(e.pointerId);
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  update(v: ScopeView): void {
    if (this.el.hidden) return;
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    const q = (s: string): HTMLElement => this.el.querySelector(s) as HTMLElement;
    q('.lcd-head').textContent = v.head;
    q('.lcd-rows').replaceChildren(
      ...v.rows.flatMap(([k, val]) => {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = val;
        return [dt, dd];
      }),
    );
    q('.lcd-foot').textContent = v.foot;
    q('.lcd-steps').innerHTML = (v.steps ?? []).map((st) => `<span class="is-${st.state}">${st.state === 'done' ? '✓ ' : ''}${st.label}</span>`).join('<i>›</i>');
    q('.scope-hint').hidden = !v.hint;
    q('.scope-hint').textContent = v.hint ?? '';
    q('.sc-atr').hidden = !v.atr;
    const m = q('.sc-measure') as HTMLButtonElement;
    m.textContent = v.measureLabel;
    m.disabled = !v.canMeasure;
    q('.sc-mode').hidden = !v.modeLabel;
    q('.sc-mode').textContent = v.modeLabel ?? '';
    q('.sc-zoom').textContent = v.finder ? 'Dalekohled 30×' : 'Hledáček';
    q('.sc-code').hidden = !v.codeLabel;
    q('.sc-code').textContent = v.codeLabel ? `Kód: ${v.codeLabel}` : '';
    const fb = q('.sc-faces');
    fb.hidden = v.faces === null || v.faces === undefined;
    fb.textContent = v.faces ? 'I+II ✓' : 'I+II';
    fb.classList.toggle('is-on', !!v.faces);
    q('.sc-setup').textContent = v.setupLabel;
    q('.scope-finder-mark').hidden = !v.finder;
    this.el.classList.toggle('is-finder', v.finder);
    q('.scope-last').hidden = !v.last;
    q('.scope-last').textContent = v.last ?? '';
  }
}
