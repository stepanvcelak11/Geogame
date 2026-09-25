import type { Vec3 } from '../core/math';

export type ItemKind = 'tripod' | 'tsCase' | 'prismPole' | 'gnssRover' | 'level' | 'rod';
export type Hand = 'right' | 'left';

export interface ItemDef {
  kind: ItemKind;
  name: string; // 1. pád – do HUD
  nameAcc: string; // 4. pád – „Zvednout …“
  short: string; // krátký popisek do slotu ruky na mobilu
  massKg: number;
  pickRadius: number; // poloměr zaměřovací koule [m]
  pickHeight: number; // výška středu nad terénem [m]
}

export const ITEM_DEFS: Record<ItemKind, ItemDef> = {
  tripod: { kind: 'tripod', name: 'Stativ', nameAcc: 'stativ', short: 'Stativ', massKg: 5.2, pickRadius: 0.5, pickHeight: 0.08 },
  tsCase: {
    kind: 'tsCase',
    name: 'Kufr s totální stanicí',
    nameAcc: 'kufr se stanicí',
    short: 'Stanice',
    massKg: 8.5,
    pickRadius: 0.32,
    pickHeight: 0.18,
  },
  prismPole: {
    kind: 'prismPole',
    name: 'Výtyčka s hranolem a tabletem',
    nameAcc: 'výtyčku s hranolem a tabletem',
    short: 'Výtyčka',
    massKg: 1.6,
    pickRadius: 0.7,
    pickHeight: 0.06,
  },
  gnssRover: { kind: 'gnssRover', name: 'GNSS rover', nameAcc: 'GNSS rover', short: 'GNSS', massKg: 2.4, pickRadius: 0.7, pickHeight: 0.1 },
  level: { kind: 'level', name: 'Nivelační přístroj', nameAcc: 'nivelační přístroj', short: 'Nivelák', massKg: 4.6, pickRadius: 0.5, pickHeight: 0.1 },
  rod: { kind: 'rod', name: 'Nivelační lať', nameAcc: 'nivelační lať', short: 'Lať', massKg: 2.3, pickRadius: 0.9, pickHeight: 0.05 },
};

/**
 * Předmět ve světě. ground = leží (pos je střed na terénu),
 * deployed = stojí v terénu (rozložený stativ, postavená výtyčka; pos je bod pod ním).
 */
export interface WorldItem {
  id: string;
  kind: ItemKind;
  state: 'ground' | 'held' | 'deployed' | 'stored'; // stored = naložený v dodávce
  location: 'kancelar' | 'stavba' | 'louka'; // kde leží / stojí (u held a stored nerozhoduje)
  pos: Vec3;
  yaw: number;
  hand: Hand | null;
  overMarkId?: string; // stojí nad známým bodem
  mounted?: boolean; // stativ: je na něm nasazená stanice
  stationYaw?: number; // stativ / nivelák: kam míří dalekohled
  pointId?: string; // lať: na čem stojí (ID bodu nebo přestavového bodu)
  pointLabel?: string;
  empty?: boolean; // kufr: stanice je venku
}
