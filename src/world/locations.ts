import type { LocationId } from './World';

export interface LocationDef {
  id: LocationId;
  name: string;
  short: string;
  seed: number;
  sjtsk: { originY: number; originX: number; originH: number };
  /** Průjezdná krajina (silnice mezi lokalitami), ne cíl zakázek. */
  transit?: boolean;
  /** Poloha na přehledové mapě kraje (0…1) pro animaci cesty. */
  region: { x: number; y: number };
}

export const LOCATIONS: Record<LocationId, LocationDef> = {
  kancelar: {
    id: 'kancelar',
    name: 'Kancelář Geoměření, Brandýs',
    short: 'Kancelář',
    seed: 551_901,
    sjtsk: { originY: 746_300, originX: 1_042_800, originH: 238 },
    region: { x: 0.52, y: 0.5 },
  },
  stavba: {
    id: 'stavba',
    name: 'Stavba RD, Nová Ves',
    short: 'Stavba',
    seed: 20260924,
    sjtsk: { originY: 742_400, originX: 1_046_300, originH: 285 },
    region: { x: 0.34, y: 0.62 },
  },
  louka: {
    id: 'louka',
    name: 'Louka u Kněžívky',
    short: 'Louka',
    seed: 771_203,
    sjtsk: { originY: 751_800, originX: 1_036_900, originH: 331 },
    region: { x: 0.72, y: 0.28 },
  },
  les: {
    id: 'les',
    name: 'Lesní cesta u Hrušova',
    short: 'Les',
    seed: 430_117,
    sjtsk: { originY: 739_600, originX: 1_049_900, originH: 402 },
    region: { x: 0.18, y: 0.3 },
  },
  dalnice: {
    id: 'dalnice',
    name: 'Stavba dálnice D35, km 12',
    short: 'Dálnice',
    seed: 350_012,
    sjtsk: { originY: 738_200, originX: 1_040_600, originH: 268 },
    region: { x: 0.78, y: 0.72 },
  },
  kraj: {
    id: 'kraj',
    name: 'Silnice přes Kněžívku',
    short: 'Cesta',
    seed: 612_009,
    sjtsk: { originY: 745_000, originX: 1_042_000, originH: 300 },
    region: { x: 0.45, y: 0.45 },
    transit: true,
  },
};

/** Doba jízdy mezi lokalitami [min]. */
const TRAVEL: Record<string, number> = { 'kancelar-stavba': 14, 'kancelar-louka': 26, 'louka-stavba': 22, 'kancelar-les': 32, 'les-stavba': 21, 'les-louka': 41, 'dalnice-kancelar': 24, 'dalnice-stavba': 30, 'dalnice-louka': 22, 'dalnice-les': 44 };

export function travelMinutes(a: LocationId, b: LocationId): number {
  if (a === b) return 0;
  return TRAVEL[[a, b].sort().join('-')] ?? 20;
}
