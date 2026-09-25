import type { ItemKind } from '../items/items';

/**
 * Stav měřického vybavení: opotřebení prací, poškození pádem, servis a pojištění.
 * Čistá logika; ukládá se v kariéře.
 */
export type EquipId = 'ts' | 'gnss' | 'level' | 'tripod';

export interface EquipState {
  condition: number; // 1 = nové, pod 0,35 porucha
  repairReady?: number; // den, kdy se vrátí ze servisu (do té doby chybí ve skladu)
}

export const EQUIP_NAME: Record<EquipId, string> = {
  ts: 'Totální stanice',
  gnss: 'GNSS přijímač a kontroler',
  level: 'Nivelační přístroj',
  tripod: 'Stativ',
};

/** Pořizovací cena (nový kus, oprava se od ní odvozuje). */
export const EQUIP_PRICE: Record<EquipId, number> = { ts: 420000, gnss: 380000, level: 95000, tripod: 9000 };

/** Předmět ve světě → přístroj, jehož stav nese. */
export function equipOf(kind: ItemKind): EquipId | null {
  switch (kind) {
    case 'tsCase':
      return 'ts';
    case 'gnssCase':
    case 'gnssRover':
      return 'gnss';
    case 'level':
      return 'level';
    case 'tripod':
      return 'tripod';
    default:
      return null;
  }
}

export const BROKEN = 0.35;

export function newEquipment(): Record<EquipId, EquipState> {
  return { ts: { condition: 1 }, gnss: { condition: 1 }, level: { condition: 1 }, tripod: { condition: 1 } };
}

/** Násobek šumu měření podle stavu: nové 1×, opotřebené až ~3×. */
export function noiseFactor(condition: number): number {
  return 1 + Math.max(0, 1 - condition) * 2.5;
}

/** Soustavná chyba úhlů stanice po pádu (kolimace) [″]. */
export function collimationArcsec(condition: number): number {
  return condition >= 0.9 ? 0 : (0.9 - condition) * 120;
}

export function stateLabel(condition: number): string {
  if (condition < BROKEN) return 'porucha';
  if (condition < 0.6) return 'poškozený';
  if (condition < 0.85) return 'opotřebený';
  return 'v pořádku';
}

/** Cena opravy (servis + kalibrace); s pojištěním platíš jen spoluúčast. */
export function repairCost(id: EquipId, condition: number, insured: boolean): number {
  const full = Math.round((EQUIP_PRICE[id] * (1 - condition) * 0.12 + 1500) / 100) * 100;
  return insured ? Math.min(full, 2000) : full;
}

/** Opotřebení za jednu zakázku. */
export const WEAR_PER_JOB = 0.02;

/** Poškození pádem podle přístroje a toho, jak spadl. */
export function dropDamage(id: EquipId, hard: boolean): number {
  const base: Record<EquipId, number> = { ts: 0.35, gnss: 0.25, level: 0.3, tripod: 0.1 };
  return base[id] * (hard ? 1.4 : 0.6);
}
