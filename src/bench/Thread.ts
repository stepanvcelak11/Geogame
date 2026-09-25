/**
 * Závit (přijímač na výtyčce, šroub držáku): otáčení tažením prstu kolem osy.
 * Utahuje se po směru hodinových ručiček; bez přidržení protikusu se točí obojí a nic se nestane.
 * Čistá logika – testuje se v Node.
 */
export class Thread {
  turns = 0; // kolik otáček je zašroubováno
  slipped = 0; // kolik se „protočilo naprázdno“ bez přidržení [rad]

  constructor(
    readonly maxTurns: number,
    turns = 0,
  ) {
    this.turns = turns;
  }

  get tight(): boolean {
    return this.turns >= this.maxTurns - 1e-6;
  }

  get loose(): boolean {
    return this.turns <= 1e-6;
  }

  /**
   * Otočení o úhel [rad] (kladný = po směru, utahuje). `held` = protikus je přidržený.
   * Vrací skutečnou změnu v otáčkách (0, když se jen protočilo nebo je na dorazu).
   */
  rotate(angle: number, held: boolean): number {
    if (!held) {
      this.slipped += Math.abs(angle);
      return 0;
    }
    const before = this.turns;
    this.turns = Math.max(0, Math.min(this.maxTurns, this.turns + angle / (Math.PI * 2)));
    return this.turns - before;
  }
}

/** Úhel mezi dvěma polohami prstu kolem středu (−π … π), po směru hodinových ručiček kladný. */
export function dragAngle(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): number {
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  let d = a1 - a0;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  // Obrazovka má osu y dolů: kladný úhel v souřadnicích obrazovky = po směru hodinových ručiček.
  return d;
}
