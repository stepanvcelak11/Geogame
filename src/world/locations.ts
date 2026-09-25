import type { LocationId } from './World';

export interface LocationDef {
  id: LocationId;
  name: string;
  short: string;
  seed: number;
  sjtsk: { originY: number; originX: number; originH: number };
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
};

/** Doba jízdy mezi lokalitami [min]. */
const TRAVEL: Record<string, number> = { 'kancelar-stavba': 14, 'kancelar-louka': 26, 'louka-stavba': 22 };

export function travelMinutes(a: LocationId, b: LocationId): number {
  if (a === b) return 0;
  return TRAVEL[[a, b].sort().join('-')] ?? 20;
}
