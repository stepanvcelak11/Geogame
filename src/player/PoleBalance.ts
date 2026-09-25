import type { Rng } from '../core/Rng';

/** Kroužek krabicové libely na výtyčce: 20′. */
export const BUBBLE_LIMIT = (20 / 60) * (Math.PI / 180);
/** Víc se výtyčka „sama“ nenakloní: bublina dojde k okraji libely (3× kroužek). */
export const MAX_TILT = 3 * BUBBLE_LIMIT;

/**
 * Výtyčka držená v ruce: hrot stojí na bodě, vrchol (anténa / hranol ve 2 m) se kývá.
 * Ruka pomalu driftuje jedním směrem a třese se; chůze ji rozhoupe. Hráč bublinu
 * táhne zpátky do kroužku (nebo klepnutím zhruba srovná).
 */
export class PoleBalance {
  tilt = { x: 0, z: 0 }; // [rad] kam se vrchol naklání (herní rámec)
  private driftAng = 0; // kam ruka táhne
  private grip = 1; // 0 hned po srovnání … 1 plný drift

  constructor(private readonly rng: Rng) {}

  update(dt: number, speed: number, tremor = 1): void {
    const g = (): number => this.rng.gaussian();
    // Ruka ujíždí vytrvale jedním směrem, ten se jen pomalu stáčí.
    this.driftAng += g() * 0.9 * Math.sqrt(dt);
    this.grip = Math.min(1, this.grip + dt * 0.6);
    const v = 0.0024 * tremor * this.grip;
    const shake = (0.0009 * tremor + Math.min(speed, 4) * 0.006) * Math.sqrt(dt);
    this.tilt.x += Math.cos(this.driftAng) * v * dt + g() * shake;
    this.tilt.z += Math.sin(this.driftAng) * v * dt + g() * shake;
    const m = Math.hypot(this.tilt.x, this.tilt.z);
    if (m > MAX_TILT) {
      this.tilt.x *= MAX_TILT / m;
      this.tilt.z *= MAX_TILT / m;
    }
  }

  /** Posun vrcholu výtyčky (korekce hráče) v radiánech v herním rámci. */
  nudge(dx: number, dz: number): void {
    this.tilt.x += dx;
    this.tilt.z += dz;
    this.grip = Math.min(this.grip, 0.5); // chytil ji pevněji
  }

  /** Klepnutí na libelu: rychlé zhruba srovnání (zůstane malá odchylka). */
  quickLevel(): void {
    this.tilt.x *= 0.3;
    this.tilt.z *= 0.3;
    this.grip = 0;
    this.driftAng = this.rng.next() * Math.PI * 2;
  }

  offset(h = 2): { x: number; z: number } {
    return { x: this.tilt.x * h, z: this.tilt.z * h };
  }

  get angle(): number {
    return Math.hypot(this.tilt.x, this.tilt.z);
  }

  get inCircle(): boolean {
    return this.angle <= BUBBLE_LIMIT;
  }
}
