import type { Vec3 } from '../core/math';
import type { FeatureCode } from '../geodesy/types';
import type { FeatureInfo } from '../world/World';

/** Tolerance identifikace: změřený bod musí ležet na skutečném prvku [m]. */
export const MAPPING_MATCH = 0.15;

/**
 * Zaměření polohopisu: každý požadovaný prvek zaměřit se správným kódem.
 * Špatný kód nebo bod mimo prvek se nezapočítá.
 */
export class MappingTask {
  readonly found = new Map<string, string>(); // featureId → číslo bodu
  wrongCode = 0;

  constructor(readonly required: FeatureInfo[]) {}

  /** Vrátí prvek, který měření splnilo, nebo null. */
  onMeasured(pointId: string, code: FeatureCode, truePos: Vec3): FeatureInfo | null {
    let near: FeatureInfo | null = null;
    let bd = MAPPING_MATCH;
    for (const f of this.required) {
      const d = Math.hypot(f.pos.x - truePos.x, f.pos.z - truePos.z);
      if (d <= bd) {
        bd = d;
        near = f;
      }
    }
    if (!near) return null;
    if (near.code !== code) {
      this.wrongCode++;
      return null;
    }
    if (this.found.has(near.id)) return null;
    this.found.set(near.id, pointId);
    return near;
  }

  get complete(): boolean {
    return this.found.size === this.required.length;
  }
}
