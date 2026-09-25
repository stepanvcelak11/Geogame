import type { Vec3 } from '../core/math';

/** Souřadnice v S-JTSK [m] s výškou v Bpv [m]. */
export interface SjtskCoord {
  Y: number;
  X: number;
  H: number;
}

const TAU = Math.PI * 2;
export const normalizeAngle = (a: number): number => ((a % TAU) + TAU) % TAU;
export const radToGon = (a: number): number => (a * 200) / Math.PI;
export const gonToRad = (g: number): number => (g * Math.PI) / 200;

/**
 * Převod mezi herním rámcem a S-JTSK.
 *
 * Herní rámec (render i fyzika): x = východ, y = nahoru, z = jih, počátek uprostřed
 * mapy. GPU počítá ve float32 – s čísly kolem 1 000 000 m by byla přesnost jen
 * centimetry až decimetry a obraz by „třásl“. Proto velké souřadnice žijí jen
 * v logice (float64) a renderer vidí malá čísla kolem nuly.
 *
 * S-JTSK: +X k jihu, +Y k západu, obě kladné; směrník se měří od +X po směru
 * hodinových ručiček (k +Y).
 */
export class SjtskFrame {
  constructor(
    readonly originY: number,
    readonly originX: number,
    readonly originH: number,
  ) {}

  toSjtsk(p: Vec3): SjtskCoord {
    return { Y: this.originY - p.x, X: this.originX + p.z, H: this.originH + p.y };
  }

  toWorld(c: SjtskCoord): Vec3 {
    return { x: this.originY - c.Y, y: c.H - this.originH, z: c.X - this.originX };
  }

  /** Směrník herního směrového vektoru [rad, 0 … 2π). */
  bearingOfDirection(d: Vec3): number {
    return normalizeAngle(Math.atan2(-d.x, d.z));
  }
}

/** Směrník σ z A do B [rad, 0 … 2π). */
export function bearing(from: { Y: number; X: number }, to: { Y: number; X: number }): number {
  return normalizeAngle(Math.atan2(to.Y - from.Y, to.X - from.X));
}

export function horizontalDistance(a: { Y: number; X: number }, b: { Y: number; X: number }): number {
  return Math.hypot(b.Y - a.Y, b.X - a.X);
}
