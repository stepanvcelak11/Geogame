import { clamp } from '../core/math';
import { SETUP_TOL, type InstrumentSetup, type V2 } from '../survey/InstrumentSetup';

type Mode = 'tripod' | 'legs' | 'screws' | 'shift';

const MODE_HINT: Record<Mode, string> = {
  tripod: 'Táhni v okně olovnice: přeneseš celý stativ. Laser dostaň do 1 cm od bodu.',
  legs: 'Táhni nohou nahoru nebo dolů. Bublina krabicové libely jde ke straně, kterou zvedáš. Laser skoro neuteče.',
  screws: 'Otáčej šrouby tažením do stran. Elektronickou libelu dostaň do 0,01 gon. Laser se přitom posouvá.',
  shift: 'Povol trojnožku a táhni v okně olovnice. Posuneš ji po hlavě stativu, nejvýš o 15 mm.',
};

const ARCMIN = Math.PI / (180 * 60);
const gon = (rad: number): string => {
  const g = (rad * 200) / Math.PI;
  return `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(4).replace('.', ',')}`;
};

export interface SetupInfo {
  markLabel: string | null; // „bod 4001“, null = volné stanovisko
  markKind: 'nail' | 'stone' | 'cap' | null;
  viewYaw: number; // směr pohledu hráče – nahoru v okně olovnice
}

/**
 * Ustavení totální stanice: laserová olovnice, krabicová a elektronická libela,
 * nohy stativu, stavěcí šrouby a posun trojnožky.
 */
export class SetupScreen {
  private readonly el: HTMLElement;
  private readonly plumb: HTMLCanvasElement;
  private readonly levels: HTMLCanvasElement;
  private setup: InstrumentSetup | null = null;
  private info: SetupInfo = { markLabel: null, markKind: null, viewYaw: 0 };
  private mode: Mode = 'tripod';
  private range = 0.1; // poloměr okna olovnice [m], plynule se mění
  private soil: HTMLCanvasElement | null = null;
  private dragLast: { x: number; y: number } | null = null;
  private shiftLimited = false;
  onDone: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'setup';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="setup-body">
        <section class="setup-plumb">
          <h2>Laserová olovnice</h2>
          <canvas class="plumb-canvas" aria-label="Pohled laserové olovnice na bod"></canvas>
          <p class="plumb-read"></p>
        </section>
        <section class="setup-levels">
          <h2>Libely</h2>
          <canvas class="levels-canvas" aria-label="Krabicová a elektronická libela"></canvas>
          <dl class="setup-checks"></dl>
        </section>
        <section class="setup-ctrl">
          <div class="setup-modes" role="tablist">
            <button data-mode="tripod">Stativ</button>
            <button data-mode="legs">Nohy</button>
            <button data-mode="screws">Šrouby</button>
            <button data-mode="shift">Posun</button>
          </div>
          <p class="setup-hint"></p>
          <div class="setup-strips"></div>
          <div class="setup-actions">
            <button class="setup-done" disabled>Hotovo</button>
            <button class="setup-close">Zavřít</button>
          </div>
        </section>
      </div>`;
    root.appendChild(this.el);
    this.plumb = this.el.querySelector('.plumb-canvas') as HTMLCanvasElement;
    this.levels = this.el.querySelector('.levels-canvas') as HTMLCanvasElement;

    this.el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => this.setMode(b.dataset.mode as Mode)),
    );
    this.el.querySelector('.setup-done')?.addEventListener('click', () => {
      if (this.setup?.ready) {
        this.setup.done = true;
        this.onDone?.();
        this.hide();
      }
    });
    this.el.querySelector('.setup-close')?.addEventListener('click', () => this.hide());
    this.bindPlumbDrag();
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(setup: InstrumentSetup, info: SetupInfo): void {
    this.setup = setup;
    this.info = info;
    this.el.hidden = false;
    const err = setup.centeringError;
    this.range = clamp((err ?? 0.02) * 1.8, 0.02, 0.3);
    this.setMode(err !== null && err > 0.012 ? 'tripod' : setup.status.coarse ? 'screws' : 'legs');
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    (this.el.querySelector('.setup-hint') as HTMLElement).textContent = MODE_HINT[m];
    const strips = this.el.querySelector('.setup-strips') as HTMLElement;
    strips.replaceChildren();
    strips.className = `setup-strips is-${m}`;
    if (m === 'legs' || m === 'screws') {
      const labels = m === 'legs' ? ['Noha 1', 'Noha 2', 'Noha 3'] : ['Šroub A', 'Šroub B', 'Šroub C'];
      labels.forEach((label, i) => {
        const s = document.createElement('div');
        s.className = 'strip';
        s.innerHTML = `<span class="strip-label">${label}</span><span class="strip-track"><span class="strip-grip"></span></span><span class="strip-val"></span>`;
        this.bindStrip(s, i, m);
        strips.appendChild(s);
      });
    }
  }

  /** Nohy: tah nahoru = prodloužit (0,2 mm/px). Šrouby: tah doprava = zvednout (2 µm/px). */
  private bindStrip(el: HTMLElement, i: number, m: Mode): void {
    let last: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* nevadí */
      }
      last = { x: e.clientX, y: e.clientY };
      el.classList.add('is-drag');
    });
    el.addEventListener('pointermove', (e) => {
      if (!last || !this.setup) return;
      if (m === 'legs') this.setup.adjustLeg(i, -(e.clientY - last.y) * 0.0002);
      else this.setup.turnScrew(i, (e.clientX - last.x) * 0.000002);
      last = { x: e.clientX, y: e.clientY };
      const grip = el.querySelector('.strip-grip') as HTMLElement;
      const v = m === 'legs' ? this.setup.legExt[i] / 0.25 : this.setup.screws[i] / 0.004;
      grip.style.setProperty('--pos', String(clamp(v, -1, 1)));
    });
    const end = (): void => {
      last = null;
      el.classList.remove('is-drag');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  private bindPlumbDrag(): void {
    const c = this.plumb;
    c.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'tripod' && this.mode !== 'shift') return;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* nevadí */
      }
      this.dragLast = { x: e.clientX, y: e.clientY };
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragLast || !this.setup) return;
      const size = c.getBoundingClientRect().width;
      const mPerPx = this.range / (size / 2);
      const w = this.screenToWorld((e.clientX - this.dragLast.x) * mPerPx, (e.clientY - this.dragLast.y) * mPerPx);
      if (this.mode === 'tripod') this.setup.moveTripod(w.x, w.z);
      else this.shiftLimited = this.setup.shiftTribrach(w.x, w.z);
      this.dragLast = { x: e.clientX, y: e.clientY };
    });
    const end = (): void => {
      this.dragLast = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  /** Okno olovnice: nahoru = směr, kterým se hráč díval. */
  private screenToWorld(sx: number, sy: number): V2 {
    const y = this.info.viewYaw;
    const f = { x: -Math.sin(y), z: -Math.cos(y) };
    const r = { x: Math.cos(y), z: -Math.sin(y) };
    return { x: r.x * sx - f.x * sy, z: r.z * sx - f.z * sy };
  }

  private worldToScreen(d: V2): { x: number; y: number } {
    const y = this.info.viewYaw;
    const f = { x: -Math.sin(y), z: -Math.cos(y) };
    const r = { x: Math.cos(y), z: -Math.sin(y) };
    return { x: d.x * r.x + d.z * r.z, y: -(d.x * f.x + d.z * f.z) };
  }

  /** Volá se každý snímek, když je obrazovka otevřená. */
  render(): void {
    const s = this.setup;
    if (!s || this.el.hidden) return;
    this.drawPlumb(s);
    this.drawLevels(s);
    this.updateChecks(s);
  }

  private fit(c: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  private soilPattern(): HTMLCanvasElement {
    if (this.soil) return this.soil;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#7d6b52';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1800; i++) {
        const v = 70 + Math.floor(Math.random() * 90);
        g.fillStyle = `rgba(${v + 30}, ${v + 15}, ${v - 10}, ${0.25 + Math.random() * 0.4})`;
        const r = 0.6 + Math.random() * 2.2;
        g.beginPath();
        g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    this.soil = c;
    return c;
  }

  private drawPlumb(s: InstrumentSetup): void {
    const f = this.fit(this.plumb);
    if (!f) return;
    const { ctx, w, h } = f;
    const center = s.mark ? { x: s.mark.x, z: s.mark.z } : s.plummet;
    const p = s.plummet;
    const err = s.centeringError ?? 0;
    // Automatické přiblížení podle chyby centrace.
    const want = clamp(err * 1.8, 0.012, 0.3);
    this.range += (want - this.range) * 0.08;
    const k = Math.min(w, h) / 2 / this.range; // px na metr
    const cx = w / 2;
    const cy = h / 2;
    const toPx = (x: number, z: number): { x: number; y: number } => {
      const q = this.worldToScreen({ x: x - center.x, z: z - center.z });
      return { x: cx + q.x * k, y: cy + q.y * k };
    };

    // Terén
    ctx.save();
    const pat = ctx.createPattern(this.soilPattern(), 'repeat');
    if (pat) {
      const tScale = k / 1500; // jemnost zrna odpovídá měřítku
      pat.setTransform(new DOMMatrix().translate(cx, cy).scale(Math.max(0.05, tScale)));
      ctx.fillStyle = pat;
    } else ctx.fillStyle = '#7d6b52';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Značka
    if (s.mark) {
      const m = toPx(s.mark.x, s.mark.z);
      if (this.info.markKind === 'nail') {
        ctx.strokeStyle = 'rgba(200, 54, 43, 0.9)';
        ctx.lineWidth = Math.max(2, 0.03 * k);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 0.085 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#a7adb2';
        ctx.beginPath();
        ctx.arc(m.x, m.y, Math.max(3, 0.006 * k), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5d6368';
        ctx.beginPath();
        ctx.arc(m.x, m.y, Math.max(1, 0.0012 * k), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const half = (this.info.markKind === 'cap' ? 0.042 : 0.1) * k;
        ctx.fillStyle = this.info.markKind === 'cap' ? '#c8362b' : '#a09c92';
        if (this.info.markKind === 'cap') {
          ctx.beginPath();
          ctx.arc(m.x, m.y, half, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(-this.info.viewYaw);
          ctx.fillRect(-half, -half, half * 2, half * 2);
          ctx.restore();
        }
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = Math.max(1.2, 0.004 * k);
        const a = Math.min(half * 0.8, 0.05 * k);
        ctx.beginPath();
        ctx.moveTo(m.x - a, m.y);
        ctx.lineTo(m.x + a, m.y);
        ctx.moveTo(m.x, m.y - a);
        ctx.lineTo(m.x, m.y + a);
        ctx.stroke();
      }
    }

    // Laserová tečka se září
    const lp = toPx(p.x, p.z);
    const glow = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, Math.max(10, 0.004 * k));
    glow.addColorStop(0, 'rgba(255, 40, 30, 0.95)');
    glow.addColorStop(0.35, 'rgba(255, 40, 30, 0.45)');
    glow.addColorStop(1, 'rgba(255, 40, 30, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, Math.max(10, 0.004 * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9d4';
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, Math.max(1.5, 0.0008 * k), 0, Math.PI * 2);
    ctx.fill();

    // Rozsah posunu trojnožky (±15 mm kolem hlavy stativu)
    if (this.mode === 'shift') {
      const hc = toPx(s.center.x - s.headHeight * s.tilt.x, s.center.z - s.headHeight * s.tilt.z);
      ctx.strokeStyle = this.shiftLimited ? 'rgba(255, 120, 90, 0.9)' : 'rgba(255, 255, 255, 0.7)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hc.x, hc.y, 0.015 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Měřítko dole uprostřed kruhu
    const bars = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];
    const len = bars.find((b) => b * k >= 40) ?? 0.1;
    const bw = len * k;
    const by = h * 0.86;
    ctx.fillStyle = 'rgba(20, 24, 26, 0.7)';
    ctx.fillRect(cx - bw / 2 - 8, by - 18, bw + 16, 26);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - bw / 2, by, bw, 3);
    ctx.font = '600 11px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(len >= 0.01 ? `${Math.round(len * 100)} cm` : `${Math.round(len * 1000)} mm`, cx, by - 2);

    const read = this.el.querySelector('.plumb-read') as HTMLElement;
    read.textContent = s.mark
      ? `Laser od ${this.info.markLabel}: ${(err * 1000).toFixed(1).replace('.', ',')} mm`
      : 'Volné stanovisko, centrace se nedělá.';
  }

  private drawLevels(s: InstrumentSetup): void {
    const f = this.fit(this.levels);
    if (!f) return;
    const { ctx, w, h } = f;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w * 0.23, h * 0.42);
    const cx = R + 18;
    const cy = h / 2;

    // Nohy a šrouby kolem krabicové libely (v orientaci okna olovnice)
    ctx.font = '700 12px "Barlow Semi Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    s.legDirs.forEach((d, i) => {
      const q = this.worldToScreen(d);
      ctx.strokeStyle = 'rgba(184, 138, 82, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + q.x * (R + 3), cy + q.y * (R + 3));
      ctx.lineTo(cx + q.x * (R + 13), cy + q.y * (R + 13));
      ctx.stroke();
      ctx.fillStyle = '#e8c48f';
      ctx.fillText(String(i + 1), cx + q.x * (R + 13) + q.x * 8, cy + q.y * (R + 13) + q.y * 8);
    });
    s.screwDirs.forEach((d, i) => {
      const q = this.worldToScreen(d);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillText('ABC'[i], cx + q.x * (R + 10), cy + q.y * (R + 10));
    });

    // Krabicová libela: celý průměr = ±30′, kroužek = 8′
    const t = this.worldToScreen(s.tilt);
    const full = 30 * ARCMIN;
    const bx = clamp(-t.x / full, -1, 1);
    const by = clamp(-t.y / full, -1, 1);
    const bl = Math.hypot(bx, by);
    const scale = bl > 0.86 ? 0.86 / bl : 1; // bublina se opře o okraj
    const vial = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    vial.addColorStop(0, '#f6f3c9');
    vial.addColorStop(1, '#c9c27a');
    ctx.fillStyle = vial;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3d3f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (8 / 30) + R * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    const bxp = cx + bx * scale * R;
    const byp = cy + by * scale * R;
    const bub = ctx.createRadialGradient(bxp - 3, byp - 4, 1, bxp, byp, R * 0.12);
    bub.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    bub.addColorStop(1, 'rgba(210, 230, 170, 0.6)');
    ctx.fillStyle = bub;
    ctx.beginPath();
    ctx.arc(bxp, byp, R * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 70, 40, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Elektronická libela (displej přístroje)
    const ex = cx + R + 30;
    const ew = w - ex - 8;
    ctx.fillStyle = '#c8d3c0';
    ctx.fillRect(ex, cy - R, ew, R * 2);
    ctx.strokeStyle = '#2a2f2c';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex, cy - R, ew, R * 2);
    const ax = s.tiltAxes;
    const inComp = s.status.inCompensator;
    ctx.fillStyle = '#1b201d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const fs = clamp(ew / 7.2, 11, 17);
    ctx.font = `600 ${Math.round(fs * 0.72)}px "Barlow Semi Condensed", sans-serif`;
    ctx.fillText('Libela [gon]', ex + 6, cy - R + 5);
    ctx.font = `700 ${Math.round(fs)}px "Barlow Semi Condensed", sans-serif`;
    ctx.fillText(inComp ? `l ${gon(ax.l)}` : 'l mimo', ex + 6, cy - R + 5 + fs * 0.95);
    ctx.fillText(inComp ? `t ${gon(ax.t)}` : 't mimo', ex + 6, cy - R + 5 + fs * 2.1);
    // Jemná bublina: ±4′ na okraj, rámeček = 0,01 gon
    const fr = Math.min(ew * 0.3, R * 0.55);
    const fx = ex + ew - fr - 10;
    const fy = cy + R - fr - 10;
    ctx.strokeStyle = '#1b201d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.stroke();
    const tol = (SETUP_TOL.electronic / SETUP_TOL.compensator) * fr;
    ctx.strokeRect(fx - tol, fy - tol, tol * 2, tol * 2);
    const ebx = clamp(-ax.t / SETUP_TOL.compensator, -1, 1) * fr;
    const eby = clamp(ax.l / SETUP_TOL.compensator, -1, 1) * fr;
    ctx.fillStyle = s.status.fine ? '#2f7d32' : '#1b201d';
    ctx.beginPath();
    ctx.arc(fx + ebx, fy + eby, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateChecks(s: InstrumentSetup): void {
    const st = s.status;
    const err = s.centeringError;
    const rows: [string, string, boolean][] = [];
    if (err !== null) rows.push(['Centrace', `${(err * 1000).toFixed(1).replace('.', ',')} mm`, st.centered]);
    rows.push(['Krabicová libela', st.coarse ? 'v kroužku' : 'mimo kroužek', st.coarse]);
    const g = (s.tiltAngle * 200) / Math.PI;
    rows.push(['Horizontace', `${g.toFixed(4).replace('.', ',')} gon`, st.fine]);
    rows.push(['Výška přístroje', `${s.instrumentHeight.toFixed(3).replace('.', ',')} m`, true]);
    const dl = this.el.querySelector('.setup-checks') as HTMLElement;
    const key = rows.map((r) => r.join()).join('|');
    if (dl.dataset.key !== key) {
      dl.dataset.key = key;
      dl.replaceChildren(
        ...rows.flatMap(([k, v, ok]) => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          dd.className = ok ? 'is-ok' : 'is-bad';
          return [dt, dd];
        }),
      );
    }
    (this.el.querySelector('.setup-done') as HTMLButtonElement).disabled = !s.ready;
  }
}
