import type { Vec3 } from '../core/math';
import type { Rng } from '../core/Rng';
import type { World } from '../world/World';

export const ROD_LENGTH = 3.0;
export const SIGHT = { min: 2, max: 50 }; // délka záměry technické nivelace [m]

/** Nivelační přístroj: vodorovná záměra z výšky center.y s malou chybou horizontu (úhel i). */
export interface LevelInstrument {
  center: Vec3;
  collimation: number; // [rad], kladně = záměra stoupá
}

export type RodRead = { ok: true; reading: number; dist: number } | { ok: false; reason: string };

/** Digitální čtení latě postavené patou v rodBase. Šum 0,3 mm, výsledek na 0,1 mm. */
export function readRod(inst: LevelInstrument, rodBase: Vec3, world: World, rng: Rng, sigma = 0.0003): RodRead {
  const dx = rodBase.x - inst.center.x;
  const dz = rodBase.z - inst.center.z;
  const dist = Math.hypot(dx, dz);
  if (dist < SIGHT.min) return { ok: false, reason: 'Lať je moc blízko, přístroj nezaostří.' };
  if (dist > SIGHT.max) return { ok: false, reason: `Záměra je delší než ${SIGHT.max} m. Postav přístroj blíž.` };
  const yLos = inst.center.y + dist * Math.tan(inst.collimation);
  const r = yLos - rodBase.y;
  if (r < 0.02) return { ok: false, reason: 'Záměra jde nad patou latě. Lať je výš než přístroj.' };
  if (r > ROD_LENGTH - 0.02) return { ok: false, reason: 'Záměra jde nad latí. Přístroj je moc vysoko proti lati.' };
  const dir = { x: dx / dist, y: Math.tan(inst.collimation), z: dz / dist };
  const l = Math.hypot(dir.x, dir.y, dir.z);
  const hit = world.raycast(inst.center, { x: dir.x / l, y: dir.y / l, z: dir.z / l }, dist / Math.cos(inst.collimation) - 0.1);
  if (hit) return { ok: false, reason: hit.kind === 'crown' ? 'Záměru zakrývá koruna stromu.' : 'Záměra je zakrytá.' };
  const reading = Math.round((r + rng.gaussian() * sigma) * 10000) / 10000;
  return { ok: true, reading, dist };
}

export interface LevelShot {
  reading: number;
  dist: number;
  pointId: string; // na čem lať stála (ID bodu nebo přestavový bod)
  pointLabel: string;
}

/** Jedna sestava: zadní a přední záměra z jednoho postavení přístroje. */
export interface LevelSet {
  setupNo: number;
  back?: LevelShot;
  fore?: LevelShot;
}

/**
 * Nivelační pořad od známého bodu: výšky bodů H = H_start + Σ(Z − P).
 * Pořad uzavřený zpět na výchozí bod dává uzávěr (měřeno − katalog).
 */
export class LevelLine {
  readonly sets: LevelSet[] = [];

  constructor(
    readonly startId: string,
    readonly startLabel: string,
    readonly startH: number,
  ) {}

  /**
   * Zadní záměra patří k aktuálnímu postavení přístroje; nové postavení = nová sestava.
   * Hotovou sestavu nepřepíše – z téhož postavení se nová sestava začít nedá.
   */
  addBack(setupNo: number, shot: LevelShot): boolean {
    const last = this.sets[this.sets.length - 1];
    if (last && last.setupNo === setupNo) {
      if (last.fore) return false;
      last.back = shot;
      return true;
    }
    this.sets.push({ setupNo, back: shot });
    return true;
  }

  addFore(setupNo: number, shot: LevelShot): boolean {
    const last = this.sets[this.sets.length - 1];
    if (!last || last.setupNo !== setupNo || !last.back) return false;
    last.fore = shot;
    return true;
  }

  /** Výšky bodů podél pořadu (poslední výskyt vyhrává), převýšení sestav a délka. */
  get heights(): { points: Map<string, { label: string; H: number; setIndex: number }>; dh: number[]; length: number } {
    const points = new Map<string, { label: string; H: number; setIndex: number }>();
    let H = this.startH;
    const dh: number[] = [];
    let length = 0;
    this.sets.forEach((s, i) => {
      if (!s.back || !s.fore) return;
      const d = s.back.reading - s.fore.reading;
      dh.push(d);
      H += d;
      length += s.back.dist + s.fore.dist;
      points.set(s.fore.pointId, { label: s.fore.pointLabel, H, setIndex: i });
    });
    return { points, dh, length };
  }

  /** Uzávěr, když poslední přední záměra skončila zpět na výchozím bodě. */
  get closure(): number | null {
    const done = this.sets.filter((s) => s.back && s.fore);
    if (done.length < 2) return null;
    const last = done[done.length - 1];
    if (last.fore?.pointId !== this.startId) return null;
    return this.heights.points.get(this.startId)!.H - this.startH;
  }

  /** Návaznost: zadní záměra musí být na bodě, kde byla předchozí přední. */
  get continuityError(): number | null {
    const done = this.sets.filter((s) => s.back);
    for (let i = 1; i < done.length; i++) {
      const prev = done[i - 1].fore;
      if (prev && done[i].back && prev.pointId !== done[i].back?.pointId) return i;
    }
    if (done[0]?.back && done[0].back.pointId !== this.startId) return 0;
    return null;
  }
}

/** Mezní uzávěr technické nivelace pro délku pořadu L [m]: 20 mm · √(L v km), nejméně 3 mm. */
export function closureLimit(lengthM: number): number {
  return Math.max(0.003, 0.02 * Math.sqrt(lengthM / 1000));
}
