import type { ControlMark } from '../world/World';

export type ReconStatus = 'pending' | 'found' | 'reportedMissing';

export interface ReconEntry {
  markId: string;
  status: ReconStatus;
}

export interface ReconResult {
  found: number;
  reportedMissing: number;
  /** Nahlášen jako nenalezený, ale v terénu existuje. */
  falseMissing: string[];
}

/** Maximální vzdálenost od katalogové polohy, odkud jde bod nahlásit jako nenalezený [m]. */
export const REPORT_RADIUS = 4;

/**
 * Rekognoskace bodového pole: ověřit, že body z katalogu v terénu existují.
 * Bod je vyřízen, když ho hráč prohlédne (nalezen), nebo když ho na místě
 * nenajde a nahlásí jako nenalezený.
 */
export class ReconTask {
  readonly title = 'Rekognoskace bodového pole';
  readonly brief = 'Před měřením ověř, které body z katalogu jsou na místě a v pořádku. Chybějící bod nahlas až na místě podle mapy.';
  readonly entries: ReconEntry[];
  private finished = false;

  constructor(markIds: string[]) {
    this.entries = markIds.map((markId) => ({ markId, status: 'pending' }));
  }

  has(markId: string): boolean {
    return this.entries.some((e) => e.markId === markId);
  }

  status(markId: string): ReconStatus | null {
    return this.entries.find((e) => e.markId === markId)?.status ?? null;
  }

  /** Vrací true, pokud se stav změnil. */
  markFound(markId: string): boolean {
    const e = this.entries.find((x) => x.markId === markId);
    if (!e || e.status === 'found') return false;
    e.status = 'found';
    return true;
  }

  reportMissing(markId: string): boolean {
    const e = this.entries.find((x) => x.markId === markId);
    if (!e || e.status !== 'pending') return false;
    e.status = 'reportedMissing';
    return true;
  }

  get resolvedCount(): number {
    return this.entries.filter((e) => e.status !== 'pending').length;
  }

  get complete(): boolean {
    return this.resolvedCount === this.entries.length;
  }

  /** Jednorázově při dokončení vrátí vyhodnocení, jinak null. */
  takeResult(marks: readonly ControlMark[]): ReconResult | null {
    if (this.finished || !this.complete) return null;
    this.finished = true;
    const byId = new Map(marks.map((m) => [m.id, m]));
    return {
      found: this.entries.filter((e) => e.status === 'found').length,
      reportedMissing: this.entries.filter((e) => e.status === 'reportedMissing').length,
      falseMissing: this.entries
        .filter((e) => e.status === 'reportedMissing' && byId.get(e.markId)?.condition !== 'missing')
        .map((e) => byId.get(e.markId)?.number ?? e.markId),
    };
  }
}
