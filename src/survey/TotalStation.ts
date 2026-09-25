import type { Vec3 } from '../core/math';
import type { Rng } from '../core/Rng';
import type { SjtskCoord } from '../geodesy/CoordinateSystem';
import type { World } from '../world/World';

/** Hranol na výtyčce. */
export interface Prism {
  id: string;
  center: Vec3; // střed hranolu
  foot: Vec3; // hrot výtyčky
  height: number; // výška cíle v_c [m]
  markId?: string; // stojí na známém bodě
}

export type TsMode = 'prism' | 'reflectorless';

export interface TsShot {
  hz: number; // čtení vodorovného kruhu [rad], 0…2π
  zen: number; // zenitový úhel [rad]
  sd: number; // šikmá délka [m]
  mode: TsMode;
  prism: Prism | null;
  hit: Vec3; // skutečný bod dopadu (střed hranolu / místo na povrchu)
  hitKind: string;
}

export type ShotResult = { ok: true; shot: TsShot } | { ok: false; reason: string };

const TAU = Math.PI * 2;
const norm = (a: number): number => ((a % TAU) + TAU) % TAU;
const ARCSEC = Math.PI / (180 * 3600);
export const PRISM_RADIUS = 0.03;
export const RANGE = { prism: 1500, reflectorless: 300 };

/** Směr v herním rámci → směrník S-JTSK (od +X po směru hodin k +Y). */
export function bearingOf(d: { x: number; z: number }): number {
  return norm(Math.atan2(-d.x, d.z));
}

/**
 * Totální stanice na stanovisku: úhly 1″, délky 1 mm + 1,5 ppm (hranol) a 2 mm + 2 ppm (bez hranolu).
 * Počítá se ze skutečného středu přístroje, souřadnice stanoviska ale bere z katalogu,
 * takže chyba centrace se do výsledku propíše jako v terénu.
 */
export class TotalStation {
  readonly circleZero: number; // natočení limbu – kde má kruh nulu
  orientation: number | null = null; // orientační posun O [rad]
  orientedOn: string | null = null;

  constructor(
    readonly center: Vec3,
    public station: SjtskCoord | null, // známé stanovisko (katalog) nebo vypočtené volné
    public instrumentHeight: number,
    private readonly rng: Rng,
  ) {
    this.circleZero = rng.next() * TAU;
  }

  /** Bezšumové čtení pro displej (Hz od nuly limbu, V zenitově). */
  reading(dir: Vec3): { hz: number; zen: number } {
    return { hz: norm(bearingOf(dir) - this.circleZero), zen: Math.acos(Math.max(-1, Math.min(1, dir.y))) };
  }

  shoot(dir: Vec3, world: World, prisms: readonly Prism[], mode: TsMode, range: { prism: number; reflectorless: number } = RANGE): ShotResult {
    const o = this.center;
    const obstacle = world.raycast(o, dir, range[mode]);
    const n = (): number => this.rng.gaussian();
    const angles = (): { hz: number; zen: number } => {
      const r = this.reading(dir);
      return { hz: norm(r.hz + n() * ARCSEC), zen: r.zen + n() * ARCSEC };
    };
    if (mode === 'prism') {
      let best: { p: Prism; t: number } | null = null;
      for (const p of prisms) {
        const v = { x: p.center.x - o.x, y: p.center.y - o.y, z: p.center.z - o.z };
        const t = v.x * dir.x + v.y * dir.y + v.z * dir.z;
        if (t <= 0.5 || t > range.prism) continue;
        const perp = Math.hypot(v.x - dir.x * t, v.y - dir.y * t, v.z - dir.z * t);
        if (perp <= PRISM_RADIUS && (!best || t < best.t)) best = { p, t };
      }
      if (!best) return { ok: false, reason: range.prism < RANGE.prism ? 'Hranol nenalezen. V mlze dálkoměr dosáhne jen na kratší vzdálenost.' : 'Hranol nenalezen. Zamiř na střed hranolu.' };
      if (obstacle && obstacle.t < best.t - 0.05) {
        return { ok: false, reason: obstacle.kind === 'crown' ? 'Paprsek zastínila koruna stromu.' : 'Mezi stanicí a hranolem je překážka.' };
      }
      const d = Math.hypot(best.p.center.x - o.x, best.p.center.y - o.y, best.p.center.z - o.z);
      const sd = d + n() * (0.001 + d * 1.5e-6);
      return { ok: true, shot: { ...angles(), sd, mode, prism: best.p, hit: { ...best.p.center }, hitKind: 'prism' } };
    }
    if (!obstacle) return { ok: false, reason: range.reflectorless < RANGE.reflectorless ? `Bez odrazu. Za tohoto počasí laser dosáhne jen na ${range.reflectorless} m.` : 'Bez odrazu. Laser nic nezasáhl.' };
    const t = obstacle.t;
    const hit = { x: o.x + dir.x * t, y: o.y + dir.y * t, z: o.z + dir.z * t };
    const sd = t + n() * (0.002 + t * 2e-6);
    return { ok: true, shot: { ...angles(), sd, mode, prism: null, hit, hitKind: obstacle.kind } };
  }

  /** Přijetí volného stanoviska: souřadnice točné osy (v_p = 0) a orientace z vyrovnání. */
  acceptFreeStation(station: SjtskCoord, orientation: number): void {
    this.station = station;
    this.instrumentHeight = 0;
    this.orientation = orientation;
    this.orientedOn = 'volné st.';
  }

  /** Orientace na známý bod: O = σ − Hz. Vrací kontrolu vodorovné délky. */
  orient(shot: TsShot, target: SjtskCoord, targetId: string): { orientation: number; dDist: number } | null {
    const s = this.station;
    if (!s) return null;
    const dY = target.Y - s.Y;
    const dX = target.X - s.X;
    const sigma = norm(Math.atan2(dY, dX));
    this.orientation = norm(sigma - shot.hz);
    this.orientedOn = targetId;
    const hd = shot.sd * Math.sin(shot.zen);
    return { orientation: this.orientation, dDist: hd - Math.hypot(dY, dX) };
  }

  /** Polární metoda: souřadnice cíle (u hranolu jeho pata = hrot výtyčky). */
  compute(shot: TsShot): SjtskCoord | null {
    const s = this.station;
    if (!s || this.orientation === null) return null;
    const sigma = shot.hz + this.orientation;
    const hd = shot.sd * Math.sin(shot.zen);
    const vc = shot.prism ? shot.prism.height : 0;
    return {
      Y: s.Y + hd * Math.sin(sigma),
      X: s.X + hd * Math.cos(sigma),
      H: s.H + this.instrumentHeight + shot.sd * Math.cos(shot.zen) - vc,
    };
  }
}
