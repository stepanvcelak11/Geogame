import type { Vec3 } from '../core/math';

export interface StakeTarget {
  id: string;
  label: string;
  design: { Y: number; X: number }; // projekt, S-JTSK na cm
  world: { x: number; z: number };
  existingMarkId?: string; // dochovaná značka – stačí ověřit měřením
}

export interface StakeRecord {
  targetId: string;
  kind: 'kolik' | 'overeno';
  truePos: Vec3; // kde kolík skutečně je
  shownDev: number; // odchylka, kterou ukazoval kontroler [m]
}

export type StakeStatus = 'pending' | 'staked' | 'verified';

/**
 * Vytyčení: dostat se na projektovou souřadnici a stabilizovat bod kolíkem.
 * Kontroler ukazuje polohu zatíženou chybou GNSS; skutečná odchylka kolíku se pozná až při kontrole.
 */
export class StakeoutTask {
  readonly records = new Map<string, StakeRecord>();

  constructor(
    readonly targets: StakeTarget[],
    readonly tolerance: number,
  ) {}

  status(id: string): StakeStatus {
    const r = this.records.get(id);
    return !r ? 'pending' : r.kind === 'kolik' ? 'staked' : 'verified';
  }

  /** Nejbližší dosud nevytyčený bod. */
  nextPending(from: { x: number; z: number }): StakeTarget | null {
    let best: StakeTarget | null = null;
    let bd = Infinity;
    for (const t of this.targets) {
      if (this.records.has(t.id)) continue;
      const d = Math.hypot(t.world.x - from.x, t.world.z - from.z);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  stake(targetId: string, truePos: Vec3, shownDev: number): void {
    this.records.set(targetId, { targetId, kind: 'kolik', truePos: { ...truePos }, shownDev });
  }

  verify(targetId: string, truePos: Vec3, shownDev: number): void {
    this.records.set(targetId, { targetId, kind: 'overeno', truePos: { ...truePos }, shownDev });
  }

  get doneCount(): number {
    return this.records.size;
  }

  get complete(): boolean {
    return this.records.size === this.targets.length;
  }

  /** Kontrolní zaměření: skutečná odchylka každého bodu od projektu. */
  evaluate(): { rows: { id: string; dev: number; ok: boolean }[]; allOk: boolean } {
    const rows = this.targets.map((t) => {
      const r = this.records.get(t.id);
      const dev = r ? Math.hypot(r.truePos.x - t.world.x, r.truePos.z - t.world.z) : Infinity;
      return { id: t.id, dev, ok: dev <= this.tolerance };
    });
    return { rows, allOk: rows.every((r) => r.ok) };
  }
}
