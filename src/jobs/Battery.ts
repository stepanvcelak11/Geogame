/**
 * Baterie přístrojů: každý přístroj má baterii ve stroji a jednu náhradní v kufru.
 * Zapnutý přístroj ji vybíjí (v zimě rychleji), náhradní se nabíjí v autonabíječce
 * v dodávce a přes noc v nabíječce v kanceláři.
 */
export type PackId = 'gnss' | 'ctrl' | 'ts';

export interface Pack {
  main: number; // % v přístroji
  spare: number; // % náhradní v kufru
}

export type Batteries = Record<PackId, Pack>;

/** Výdrž plné baterie za provozu v herních minutách (při 20 °C). */
export const RUNTIME_MIN: Record<PackId, number> = {
  gnss: 7 * 60, // přijímač s modemem a Bluetooth
  ctrl: 9 * 60, // kontroler s displejem
  ts: 5 * 60, // stanice se servomotory a ATR
};

export const PACK_NAME: Record<PackId, string> = { gnss: 'přijímače', ctrl: 'kontroleru', ts: 'stanice' };

/** Pod tímhle stavem přístroj hlásí slabou baterii. */
export const LOW = 15;
/** Autonabíječka v dodávce nabije baterii za 3 herní hodiny. */
export const VAN_CHARGE_MIN = 180;

export function freshBatteries(): Batteries {
  return { gnss: { main: 100, spare: 100 }, ctrl: { main: 100, spare: 100 }, ts: { main: 100, spare: 100 } };
}

/** Mráz zkracuje výdrž Li-ion článků. */
export function coldFactor(tempC: number): number {
  if (tempC < 0) return 1.6;
  if (tempC < 6) return 1.3;
  return 1;
}

export type DrainEvent = 'low' | 'empty' | null;

/** Vybije baterii v přístroji; vrací, zda zrovna překročila hranici slabé nebo vybité baterie. */
export function drain(p: Pack, id: PackId, minutes: number, tempC: number): DrainEvent {
  if (p.main <= 0 || minutes <= 0) return null;
  const before = p.main;
  p.main = Math.max(0, p.main - (minutes / RUNTIME_MIN[id]) * 100 * coldFactor(tempC));
  if (p.main <= 0) return 'empty';
  if (before > LOW && p.main <= LOW) return 'low';
  return null;
}

/** Náhradní baterie v kufru se nabíjí (v dodávce). */
export function chargeSpare(p: Pack, minutes: number): void {
  p.spare = Math.min(100, p.spare + (minutes / VAN_CHARGE_MIN) * 100);
}

/** Výměna: vybitá jde do kufru, náhradní do přístroje. Má smysl, jen když je náhradní plnější. */
export function canSwap(p: Pack): boolean {
  return p.spare > p.main + 5;
}

export function swap(p: Pack): void {
  [p.main, p.spare] = [p.spare, p.main];
}
