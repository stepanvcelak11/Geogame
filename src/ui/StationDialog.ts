/**
 * Stanice: nastavení stanoviska na displeji přístroje. Výšku přístroje odečteš na pásmu
 * (od značky bodu k ryse točné osy na boku stanice) a zadáš ručně – jako v terénu.
 */
export class StationDialog {
  private readonly el: HTMLElement;
  private truth = 1.5;
  onConfirm: ((height: number) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stn';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="stn-body">
      <section class="stn-tape"><h3>Pásmo u přístroje</h3><canvas width="140" height="260"></canvas><p>Rysa točné osy na boku stanice. Odečti pásmo v její výšce (na mm).</p></section>
      <section class="stn-lcd">
        <h2>STANOVISKO</h2>
        <dl><dt>Bod</dt><dd class="stn-pt"></dd><dt>Y</dt><dd class="stn-y"></dd><dt>X</dt><dd class="stn-x"></dd><dt>H</dt><dd class="stn-h"></dd></dl>
        <label>Výška přístroje v<sub>p</sub> [m]<input class="stn-vp" type="number" inputmode="decimal" step="0.001" min="0.5" max="2.5" placeholder="1.xxx"></label>
        <label>Výška cíle (hranol) [m]<input value="2.000" disabled></label>
        <p class="stn-err" hidden></p>
        <div class="stn-actions"><button class="stn-ok">Potvrdit (F4)</button><button class="stn-cancel">Zpět</button></div>
      </section>
    </div>`;
    root.appendChild(this.el);
    this.el.querySelector('.stn-ok')?.addEventListener('click', () => this.confirm());
    this.el.querySelector('.stn-cancel')?.addEventListener('click', () => this.hide());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(point: { number: string; Y: number; X: number; H: number }, trueHeight: number): void {
    this.truth = trueHeight;
    const q = (s: string): HTMLElement => this.el.querySelector(s) as HTMLElement;
    q('.stn-pt').textContent = point.number;
    q('.stn-y').textContent = point.Y.toFixed(3);
    q('.stn-x').textContent = point.X.toFixed(3);
    q('.stn-h').textContent = point.H.toFixed(3);
    (q('.stn-vp') as HTMLInputElement).value = '';
    q('.stn-err').hidden = true;
    this.el.hidden = false;
    this.drawTape();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private confirm(): void {
    const v = Number((this.el.querySelector('.stn-vp') as HTMLInputElement).value.replace(',', '.'));
    const err = this.el.querySelector('.stn-err') as HTMLElement;
    if (!Number.isFinite(v) || v < 0.5 || v > 2.5) {
      err.textContent = 'Zadej výšku přístroje v metrech, třeba 1.562.';
      err.hidden = false;
      return;
    }
    this.el.hidden = true;
    this.onConfirm?.(Math.round(v * 1000) / 1000);
  }

  /** Pásmo: centimetry s čísly, milimetrové dílky; vodorovná rysa = výška točné osy. */
  private drawTape(): void {
    const c = this.el.querySelector('canvas') as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (!g) return;
    const W = c.width;
    const H = c.height;
    const pxPerMm = 3.2;
    const mid = H / 2;
    g.fillStyle = '#6b5a3c';
    g.fillRect(0, 0, W, H);
    // Bok stanice s rysou (vpravo).
    g.fillStyle = '#e9ebe6';
    g.fillRect(W * 0.62, 0, W * 0.38, H);
    g.fillStyle = '#1f2428';
    g.fillRect(W * 0.55, mid - 1, W * 0.45, 2);
    g.beginPath();
    g.moveTo(W * 0.62, mid);
    g.lineTo(W * 0.7, mid - 6);
    g.lineTo(W * 0.7, mid + 6);
    g.fill();
    // Pásmo (žluté) – čísla v cm; výš = větší hodnota.
    g.fillStyle = '#f2d23a';
    g.fillRect(W * 0.08, 0, W * 0.46, H);
    const mmTruth = this.truth * 1000;
    const top = mmTruth + mid / pxPerMm;
    const bottom = mmTruth - (H - mid) / pxPerMm;
    g.fillStyle = '#1b1b1b';
    for (let mm = Math.floor(bottom); mm <= Math.ceil(top); mm++) {
      const y = mid - (mm - mmTruth) * pxPerMm;
      const cm = mm % 10 === 0;
      const half = mm % 5 === 0;
      g.fillRect(W * 0.08, y - 0.5, cm ? W * 0.24 : half ? W * 0.16 : W * 0.1, cm ? 2 : 1);
      if (cm) {
        g.font = 'bold 15px sans-serif';
        g.fillText(String(mm / 10), W * 0.34, y + 5);
      }
    }
    // Každý metr červeně.
    g.fillStyle = '#c8362b';
    g.font = 'bold 12px sans-serif';
    g.fillText(`${Math.floor(this.truth)} m`, W * 0.1, 14);
  }
}
