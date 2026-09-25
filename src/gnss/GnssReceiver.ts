import { clamp, DEG, type Vec3 } from '../core/math';
import type { Rng } from '../core/Rng';
import type { World } from '../world/World';

export type GnssSolution = 'none' | 'autonomous' | 'float' | 'fix';
const RANK: Record<GnssSolution, number> = { none: 0, autonomous: 1, float: 2, fix: 3 };
const NEXT: Record<GnssSolution, GnssSolution> = { none: 'autonomous', autonomous: 'float', float: 'fix', fix: 'fix' };
/** Čas potřebný k postupu na další úroveň řešení [s]. */
const STEP_TIME: Record<GnssSolution, number> = { none: 2, autonomous: 2.5, float: 4, fix: 0 };

const ELEVATIONS = [15, 35, 60].map((e) => e * DEG);
const AZIMUTHS = 12;

/**
 * Zjednodušený RTK rover. Kvalita řešení závisí na tom, kolik oblohy vidí anténa:
 * paprsky k obloze narážejí na koruny stromů, budovy a terén.
 * FIX jen při otevřené obloze, pod stromy FLOAT, v hustém lese autonomní řešení.
 */
export class GnssReceiver {
  on = false;
  solution: GnssSolution = 'none';
  openness = 0; // 0 … 1, podíl volných směrů k obloze
  antennaBoost = false; // vylepšení: anténa pro víc družicových systémů
  sats = 0;
  pdop = 99;
  sigmaH = 99; // střední polohová chyba [m]
  sigmaV = 99; // střední výšková chyba [m]
  private stateTime = 0;
  private skyTimer = 0;

  constructor(private readonly rng: Rng) {}

  powerOn(): void {
    if (this.on) return;
    this.on = true;
    this.solution = 'none';
    this.stateTime = 0;
    this.skyTimer = 0;
  }

  powerOff(): void {
    this.on = false;
    this.solution = 'none';
    this.sats = 0;
  }

  /** Podíl volných směrů k obloze z polohy antény. */
  static skyOpenness(world: World, antenna: Vec3): number {
    let free = 0;
    let total = 0;
    for (const el of ELEVATIONS) {
      for (let i = 0; i < AZIMUTHS; i++) {
        const az = (i / AZIMUTHS) * Math.PI * 2 + el; // pootočení mezi prstenci
        const c = Math.cos(el);
        const d = { x: Math.sin(az) * c, y: Math.sin(el), z: Math.cos(az) * c };
        total++;
        if (!world.raycast(antenna, d, 120)) free++;
      }
    }
    total++;
    if (!world.raycast(antenna, { x: 0, y: 1, z: 0 }, 120)) free++;
    return free / total;
  }

  update(dt: number, antenna: Vec3, world: World): void {
    if (!this.on) return;
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) {
      this.skyTimer = 0.5;
      this.openness = GnssReceiver.skyOpenness(world, antenna);
    }
    const o = this.antennaBoost ? Math.min(1, this.openness * 1.3 + 0.06) : this.openness;
    const target: GnssSolution = o >= 0.66 ? 'fix' : o >= 0.3 ? 'float' : 'autonomous';
    this.stateTime += dt;
    if (RANK[target] < RANK[this.solution]) {
      this.solution = target; // zakrytí oblohy = okamžitá ztráta řešení
      this.stateTime = 0;
    } else if (RANK[target] > RANK[this.solution] && this.stateTime >= STEP_TIME[this.solution]) {
      this.solution = NEXT[this.solution];
      this.stateTime = 0;
    }

    this.pdop = clamp(1.1 + (1 - o) ** 1.5 * 7, 1.1, 9.9);
    if (this.solution === 'none') {
      this.sats = Math.min(4, Math.floor(this.stateTime * 2));
      this.sigmaH = this.sigmaV = 99;
      return;
    }
    this.sats = Math.round(6 + o * 22);
    switch (this.solution) {
      case 'fix':
        this.sigmaH = 0.008 + this.pdop * 0.003;
        break;
      case 'float':
        this.sigmaH = 0.12 + (1 - o) * 0.5;
        break;
      default:
        this.sigmaH = 1.5 + this.pdop * 0.4;
    }
    this.sigmaV = this.sigmaH * 1.6;
  }

  /** Změří polohu hrotu výtyčky: skutečná poloha + náhodná chyba podle aktuální přesnosti. */
  measure(truePos: Vec3): { pos: Vec3; sigmaH: number; sigmaV: number } {
    const s = this.sigmaH / Math.SQRT2; // na souřadnici
    return {
      pos: { x: truePos.x + this.gauss() * s, y: truePos.y + this.gauss() * this.sigmaV, z: truePos.z + this.gauss() * s },
      sigmaH: this.sigmaH,
      sigmaV: this.sigmaV,
    };
  }

  private gauss(): number {
    const u = Math.max(1e-12, this.rng.next());
    const v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export const SOLUTION_LABEL: Record<GnssSolution, string> = {
  none: 'Hledá',
  autonomous: 'Autonomní',
  float: 'FLOAT',
  fix: 'FIX',
};
