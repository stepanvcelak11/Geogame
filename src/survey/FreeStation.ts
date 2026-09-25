import type { SjtskCoord } from '../geodesy/CoordinateSystem';

/** Jedno měření na známý bod pro výpočet volného stanoviska. */
export interface ResectionObs {
  markId: string;
  number: string;
  known: SjtskCoord; // katalog
  hz: number; // čtení kruhu [rad]
  zen: number; // zenitový úhel [rad]
  sd: number; // šikmá délka [m]
  vc: number; // výška cíle [m]
  use: boolean; // zařazen do výpočtu
}

export interface ResectionResult {
  station: SjtskCoord; // Y0, X0 a H = výška točné osy (v_p = 0)
  orientation: number; // O [rad]
  residuals: { markId: string; number: string; dY: number; dX: number; dH: number; use: boolean }[];
  sigma0: number; // střední polohová chyba jednotková [m]
  used: number;
}

/**
 * Volné stanovisko: shodnostní transformace (natočení + posun, měřítko 1) místních polárních
 * souřadnic na katalog metodou nejmenších čtverců. Výška z průměru měřených převýšení.
 * Opravy (katalog − výpočet) se počítají pro všechny body, i vyřazené.
 */
export function solveResection(obs: readonly ResectionObs[]): ResectionResult | null {
  const used = obs.filter((o) => o.use);
  if (used.length < 2) return null;
  // Místní souřadnice v soustavě kruhu: a = ΔX_l, b = ΔY_l (směrník = Hz).
  const local = (o: ResectionObs): { a: number; b: number } => {
    const hd = o.sd * Math.sin(o.zen);
    return { a: hd * Math.cos(o.hz), b: hd * Math.sin(o.hz) };
  };
  const L = used.map(local);
  const n = used.length;
  const ac = L.reduce((s, p) => s + p.a, 0) / n;
  const bc = L.reduce((s, p) => s + p.b, 0) / n;
  const Xc = used.reduce((s, o) => s + o.known.X, 0) / n;
  const Yc = used.reduce((s, o) => s + o.known.Y, 0) / n;
  let num = 0;
  let den = 0;
  used.forEach((o, i) => {
    const a = L[i].a - ac;
    const b = L[i].b - bc;
    const X = o.known.X - Xc;
    const Y = o.known.Y - Yc;
    num += a * Y - b * X;
    den += a * X + b * Y;
  });
  const O = Math.atan2(num, den);
  const c = Math.cos(O);
  const s = Math.sin(O);
  const X0 = Xc - (c * ac - s * bc);
  const Y0 = Yc - (s * ac + c * bc);
  // Výška točné osy: H_t + v_c − Sd·cos z
  const H0 = used.reduce((sum, o) => sum + o.known.H + o.vc - o.sd * Math.cos(o.zen), 0) / n;

  const residuals = obs.map((o) => {
    const p = local(o);
    const X = X0 + c * p.a - s * p.b;
    const Y = Y0 + s * p.a + c * p.b;
    const H = H0 + o.sd * Math.cos(o.zen) - o.vc;
    return { markId: o.markId, number: o.number, dY: o.known.Y - Y, dX: o.known.X - X, dH: o.known.H - H, use: o.use };
  });
  const r2 = residuals.filter((r) => r.use).reduce((sum, r) => sum + r.dY * r.dY + r.dX * r.dX, 0);
  const dof = 2 * n - 3;
  const sigma0 = dof > 0 ? Math.sqrt(r2 / dof) : 0;
  return { station: { Y: Y0, X: X0, H: H0 }, orientation: ((O % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), residuals, sigma0, used: n };
}
