import { clamp, type Vec3 } from '../core/math';
import type { Rng } from '../core/Rng';

export interface V2 {
  x: number;
  z: number;
}

/** Tolerance ustavení. */
export const SETUP_TOL = {
  centering: 0.001, // m
  circularBubble: (8 / 60) * (Math.PI / 180), // 8′ – kroužek krabicové libely
  electronic: (0.01 * Math.PI) / 200, // 0,01 gon ≈ 32″
  compensator: (4 / 60) * (Math.PI / 180), // rozsah kompenzátoru ±4′
};

/** Efektivní rameno pro naklonění hlavy prodloužením nohy [m] a pro stavěcí šrouby [m]. */
const LEG_ARM = 0.73;
const SCREW_ARM = 0.082;
/** Posun apexu při prodloužení nohy kompenzuje 95 % posunu laseru (rotace kolem osy zbylých hrotů). */
const LEG_APEX_FOLLOW = 0.95;
const SCREW_RANGE = 0.004; // ±4 mm zdvih šroubu
const SHIFT_RANGE = 0.015; // ±15 mm posun trojnožky po hlavě
const LEG_RANGE = 0.25; // ±25 cm výsuv nohy
const TRUNNION_ABOVE_HEAD = 0.196; // klopná osa nad hlavou stativu [m]

/**
 * Fyzika ustavení totální stanice nad bodem (malé úhly).
 *
 * Sklon t je vodorovný posun horního konce svislé osy na metr výšky (x = východ, z = jih).
 * Laserová olovnice míří dolů po ose z hlavy stativu: P = C + posun − H·t.
 * - Prodloužení nohy i = otočení stativu kolem osy zbylých dvou hrotů: sklon se mění,
 *   apex se posune skoro stejně, takže laser na zemi zůstane téměř na místě.
 * - Stavěcí šroub nakloní přístroj nad trojnožkou: laser se posune o celé H·Δt.
 * - Posun trojnožky po hlavě mění jen polohu (±15 mm).
 */
export class InstrumentSetup {
  readonly legDirs: V2[]; // jednotkové směry ze středu k hrotům nohou
  readonly screwDirs: V2[]; // směry ke stavěcím šroubům (mezi nohama)
  center: V2; // apex stativu v půdorysu
  headHeight: number; // hlava stativu nad terénem [m]
  tiltLegs: V2;
  tiltScrews: V2 = { x: 0, z: 0 };
  shift: V2 = { x: 0, z: 0 };
  readonly legExt = [0, 0, 0];
  readonly screws = [0, 0, 0];
  done = false;

  constructor(
    center: V2,
    readonly groundY: number,
    readonly yaw: number,
    initialTilt: V2,
    readonly mark: Vec3 | null,
    private readonly rng: Rng,
  ) {
    this.center = { ...center };
    this.tiltLegs = { ...initialTilt };
    this.headHeight = 1.26;
    const dir = (a: number): V2 => ({ x: -Math.sin(a), z: -Math.cos(a) });
    this.legDirs = [0, 1, 2].map((i) => dir(yaw + (i * 2 * Math.PI) / 3));
    this.screwDirs = [0, 1, 2].map((i) => dir(yaw + Math.PI / 3 + (i * 2 * Math.PI) / 3));
  }

  get tilt(): V2 {
    return { x: this.tiltLegs.x + this.tiltScrews.x, z: this.tiltLegs.z + this.tiltScrews.z };
  }

  /** Úhel sklonu svislé osy [rad]. */
  get tiltAngle(): number {
    const t = this.tilt;
    return Math.atan(Math.hypot(t.x, t.z));
  }

  /** Kam svítí laserová olovnice na terénu. */
  get plummet(): V2 {
    const t = this.tilt;
    return { x: this.center.x + this.shift.x - this.headHeight * t.x, z: this.center.z + this.shift.z - this.headHeight * t.z };
  }

  /** Vodorovná vzdálenost laseru od bodu [m], null při volném stanovisku. */
  get centeringError(): number | null {
    if (!this.mark) return null;
    const p = this.plummet;
    return Math.hypot(p.x - this.mark.x, p.z - this.mark.z);
  }

  /** Sklon v ose přístroje: l = podélně (směr dalekohledu), t = příčně. */
  get tiltAxes(): { l: number; t: number } {
    const t = this.tilt;
    const f = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const r = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    return { l: Math.atan(t.x * f.x + t.z * f.z), t: Math.atan(t.x * r.x + t.z * r.z) };
  }

  get status(): { centered: boolean; coarse: boolean; fine: boolean; inCompensator: boolean } {
    const e = this.centeringError;
    const a = this.tiltAngle;
    return {
      centered: e === null || e <= SETUP_TOL.centering,
      coarse: a <= SETUP_TOL.circularBubble,
      fine: Math.abs(this.tiltAxes.l) <= SETUP_TOL.electronic && Math.abs(this.tiltAxes.t) <= SETUP_TOL.electronic,
      inCompensator: a <= SETUP_TOL.compensator,
    };
  }

  get ready(): boolean {
    const s = this.status;
    return s.centered && s.fine;
  }

  /** Výška přístroje v_p: klopná osa nad značkou (nebo nad terénem při volném stanovisku) [m]. */
  get instrumentHeight(): number {
    const base = this.mark ? this.mark.y : this.groundY;
    return this.groundY + this.headHeight + TRUNNION_ABOVE_HEAD - base;
  }

  /** Střed přístroje (průsečík os) v herním rámci; svislá osa prochází laserem olovnice. */
  get instrumentCenter(): { x: number; y: number; z: number } {
    const p = this.plummet;
    return { x: p.x, y: this.groundY + this.headHeight + TRUNNION_ABOVE_HEAD, z: p.z };
  }

  /** Posun celého stativu (přenesení nohou). Nohy dosednou jinak, takže se rozhodí i sklon. */
  moveTripod(dx: number, dz: number): void {
    this.center.x += dx;
    this.center.z += dz;
    const d = Math.hypot(dx, dz);
    this.tiltLegs.x += (this.rng.next() - 0.5) * d * 0.5;
    this.tiltLegs.z += (this.rng.next() - 0.5) * d * 0.5;
  }

  /** Změna délky nohy i [m]. Vrací skutečnou změnu (omezenou rozsahem výsuvu). */
  adjustLeg(i: number, dl: number): number {
    const next = clamp(this.legExt[i] + dl, -LEG_RANGE, LEG_RANGE);
    const real = next - this.legExt[i];
    this.legExt[i] = next;
    const u = this.legDirs[i];
    const dtx = -(real / LEG_ARM) * u.x;
    const dtz = -(real / LEG_ARM) * u.z;
    this.tiltLegs.x += dtx;
    this.tiltLegs.z += dtz;
    this.center.x += this.headHeight * dtx * LEG_APEX_FOLLOW;
    this.center.z += this.headHeight * dtz * LEG_APEX_FOLLOW;
    this.headHeight += (real * 0.94) / 3;
    return real;
  }

  /** Zdvih stavěcího šroubu i [m]. */
  turnScrew(i: number, ds: number): number {
    const next = clamp(this.screws[i] + ds, -SCREW_RANGE, SCREW_RANGE);
    const real = next - this.screws[i];
    this.screws[i] = next;
    const v = this.screwDirs[i];
    this.tiltScrews.x -= (real / SCREW_ARM) * v.x;
    this.tiltScrews.z -= (real / SCREW_ARM) * v.z;
    return real;
  }

  /** Posun trojnožky po hlavě stativu. Vrací true, pokud narazila na okraj. */
  shiftTribrach(dx: number, dz: number): boolean {
    let x = this.shift.x + dx;
    let z = this.shift.z + dz;
    const r = Math.hypot(x, z);
    const limited = r > SHIFT_RANGE;
    if (limited) {
      x *= SHIFT_RANGE / r;
      z *= SHIFT_RANGE / r;
    }
    this.shift = { x, z };
    return limited;
  }
}
