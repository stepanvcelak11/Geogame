import type { SurveyPoint } from '../geodesy/types';

/** Zaměřený bod + porovnání s katalogem, pokud byl hrot na známém bodě. */
export interface MeasuredPoint extends SurveyPoint {
  solution: string;
  location: string; // lokalita, kde se měřilo
  markId?: string;
  markNumber?: string;
  dev?: { dY: number; dX: number; dH: number }; // změřeno − katalog [m]
}

/** Zápisník kontroleru: body se číslují od 1001. */
export class PointLog {
  readonly points: MeasuredPoint[] = [];
  private next = 1001;

  add(p: Omit<MeasuredPoint, 'id'>): MeasuredPoint {
    const point: MeasuredPoint = { ...p, id: String(this.next++) };
    this.points.push(point);
    return point;
  }
}

/** „+6“ / „−12“ v milimetrech. */
export function mm(v: number): string {
  const r = Math.round(v * 1000);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
}
