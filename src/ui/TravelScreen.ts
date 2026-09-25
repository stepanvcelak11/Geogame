import { clamp } from '../core/math';
import type { LocationDef } from '../world/locations';

/** Hodiny „7:42“ z minut od půlnoci. */
export const clockText = (minutes: number): string => {
  const m = Math.floor(minutes) % (24 * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Přejezd mezi lokalitami: přehledová mapa kraje, dodávka jede po silnici,
 * hodiny běží. Klepnutím se dá přeskočit.
 */
export class TravelScreen {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private raf = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'travel';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="travel-card">
        <p class="travel-sub"></p>
        <h2 class="travel-title"></h2>
        <canvas aria-label="Trasa na mapě kraje"></canvas>
        <p class="travel-meta"><span class="travel-clock"></span><span class="travel-skip">Klepnutím přeskočíš</span></p>
      </div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas') as HTMLCanvasElement;
  }

  play(from: LocationDef, to: LocationDef, startMin: number, minutes: number, onEnd: () => void): void {
    (this.el.querySelector('.travel-sub') as HTMLElement).textContent = `Jízda ${minutes} min`;
    (this.el.querySelector('.travel-title') as HTMLElement).textContent = to.name;
    this.el.hidden = false;
    const dur = 3800;
    const t0 = performance.now();
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(this.raf);
      this.el.hidden = true;
      this.el.removeEventListener('pointerdown', finish);
      onEnd();
    };
    this.el.addEventListener('pointerdown', finish);
    const frame = (now: number): void => {
      const t = clamp((now - t0) / dur, 0, 1);
      this.draw(from, to, t);
      (this.el.querySelector('.travel-clock') as HTMLElement).textContent = clockText(startMin + minutes * t);
      if (t < 1) this.raf = requestAnimationFrame(frame);
      else setTimeout(finish, 450);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private draw(from: LocationDef, to: LocationDef, t: number): void {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x * w, y: p.y * h });

    // Podklad kraje: pole, lesy, řeka, silnice.
    g.fillStyle = '#ece8dc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160, 196, 140, 0.55)';
    for (const [x, y, rr] of [
      [0.15, 0.25, 0.12],
      [0.55, 0.7, 0.1],
      [0.85, 0.6, 0.14],
      [0.45, 0.2, 0.07],
    ]) {
      g.beginPath();
      g.ellipse(x * w, y * h, rr * w, rr * h * 1.3, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#8fb8d8';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, h * 0.45);
    g.bezierCurveTo(w * 0.3, h * 0.35, w * 0.5, h * 0.62, w, h * 0.48);
    g.stroke();
    g.strokeStyle = '#c9c1ab';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.05, h * 0.9);
    g.lineTo(w * 0.95, h * 0.1);
    g.stroke();

    // Trasa
    const a = P(from.region);
    const b = P(to.region);
    const m = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.25, y: (a.y + b.y) / 2 - (b.x - a.x) * 0.25 };
    const at = (u: number): { x: number; y: number } => ({
      x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * m.x + u * u * b.x,
      y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * m.y + u * u * b.y,
    });
    g.strokeStyle = '#f2b705';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.quadraticCurveTo(m.x, m.y, b.x, b.y);
    g.stroke();
    g.strokeStyle = '#1f2428';
    g.lineWidth = 2;
    g.setLineDash([2, 6]);
    g.stroke();
    g.setLineDash([]);

    for (const [p, name] of [
      [a, from.short],
      [b, to.short],
    ] as const) {
      g.fillStyle = '#c8362b';
      g.beginPath();
      g.arc(p.x, p.y, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1f2428';
      g.font = '700 15px "Barlow Semi Condensed", sans-serif';
      g.textAlign = 'center';
      g.fillText(name, p.x, p.y - 14);
    }

    // Dodávka
    const u = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // rozjezd a dojezd
    const v = at(u);
    const v2 = at(Math.min(1, u + 0.01));
    g.save();
    g.translate(v.x, v.y);
    g.rotate(Math.atan2(v2.y - v.y, v2.x - v.x));
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1f2428';
    g.lineWidth = 1.5;
    g.fillRect(-12, -6, 24, 12);
    g.strokeRect(-12, -6, 24, 12);
    g.fillStyle = '#f2b705';
    g.fillRect(-12, -1.5, 24, 3);
    g.fillStyle = '#324650';
    g.fillRect(6, -5, 5, 10);
    g.restore();
  }
}
