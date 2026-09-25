import type { LocationId } from '../world/World';

/**
 * Polní software kontroleru GNSS (po vzoru běžných aplikací typu Trimble Access,
 * Leica Captivate nebo Carlson SurvCE): zakázka se souřadnicovým systémem, spojení
 * s přijímačem přes Bluetooth, korekce RTK ze sítě přes NTRIP, výška antény,
 * import seznamů souřadnic a nastavení měření. Čistá logika bez DOM.
 */

/** Souřadnicový systém zakázky. Správně je jen první; ostatní jsou skutečné pasti z praxe. */
export type CrsId = 'sjtsk' | 'sjtskEN' | 'sjtskElips' | 'utm33';

export const CRS_OPTIONS: { id: CrsId; label: string; detail: string }[] = [
  {
    id: 'sjtsk',
    label: 'S-JTSK / Krovak (EPSG:5513) + Bpv',
    detail: 'ETRS89 → S-JTSK upřesněnou globální transformací, výšky Bpv z kvazigeoidu CR-2005.',
  },
  {
    id: 'sjtskEN',
    label: 'S-JTSK / Krovak East North (EPSG:5514) + Bpv',
    detail: 'Varianta pro GIS: osy na východ a sever, souřadnice záporné.',
  },
  {
    id: 'sjtskElips',
    label: 'S-JTSK / Krovak (EPSG:5513), výšky elipsoidické',
    detail: 'Bez modelu kvazigeoidu: výška nad elipsoidem GRS80, ne v Bpv.',
  },
  {
    id: 'utm33',
    label: 'WGS 84 / UTM zóna 33N (EPSG:32633)',
    detail: 'Celosvětové zobrazení UTM, výšky elipsoidické.',
  },
];

/** Výšková anomálie kvazigeoidu v okolí Prahy (rozdíl elipsoidické výšky a Bpv) [m]. */
export const HEIGHT_ANOMALY = 44.9;

export interface Sjtsk {
  Y: number;
  X: number;
  H: number;
}

/**
 * Co kontroler ukáže, když přijímač změří bod se správnými souřadnicemi `c` (S-JTSK, Bpv).
 * `heightError` = skutečná výška výtyčky − zadaná výška antény (kladná = zadáno málo).
 */
export function reportCoords(c: Sjtsk, crs: CrsId, heightError: number): Sjtsk {
  const H = c.H + heightError;
  switch (crs) {
    case 'sjtsk':
      return { Y: c.Y, X: c.X, H };
    case 'sjtskEN':
      return { Y: -c.Y, X: -c.X, H };
    case 'sjtskElips':
      return { Y: c.Y, X: c.X, H: H + HEIGHT_ANOMALY };
    case 'utm33':
      // Přibližně: UTM míří na východ a sever, S-JTSK na západ a jih.
      return { Y: 1_205_000 - c.Y, X: 6_593_000 - c.X, H: H + HEIGHT_ANOMALY };
  }
}

/** Zdroje korekcí sítě CZEPOS (tabulka zdrojů NTRIP). */
export interface Mountpoint {
  id: string;
  label: string;
  kind: 'network' | 'single';
}

export const NTRIP_CASTER = { name: 'CZEPOS (ČÚZK)', host: 'czeposr.cuzk.cz', port: 2101 };

export const MOUNTPOINTS: Mountpoint[] = [
  { id: 'VRS3-GG', label: 'Virtuální referenční stanice (VRS), GPS + GLONASS, RTCM 3', kind: 'network' },
  { id: 'MAX3-GG', label: 'Síťové řešení MAX, GPS + GLONASS, RTCM 3', kind: 'network' },
  { id: 'NEAR3-GG', label: 'Nejbližší referenční stanice (jedna báze), RTCM 3', kind: 'single' },
];

/** Vzdálenost nejbližší referenční stanice od lokality [km]. Síťová řešení ji nepotřebují. */
export const NEAREST_BASE_KM: Record<LocationId, number> = { kancelar: 12, stavba: 31, louka: 38 };

/** Síla mobilního signálu pro NTRIP (0…1). Na louce za kopcem slabší, korekce občas vypadnou. */
export const DATA_SIGNAL: Record<LocationId, number> = { kancelar: 1, stavba: 0.9, louka: 0.55 };

/** Typy antén v kontroleru. Jen jedna odpovídá přijímači v kufru. */
export const ANTENNA_TYPES: { id: string; label: string; phaseOffset: number }[] = [
  { id: 'r7-int', label: 'GNSS R-7 interní', phaseOffset: 0 },
  { id: 'r5-int', label: 'GNSS R-5 interní (starší model)', phaseOffset: 0.023 },
  { id: 'gen-ext', label: 'Externí anténa (obecná, ARP 0)', phaseOffset: -0.061 },
];

/** Náš přijímač a jiná zařízení, která Bluetooth najde. */
export const RECEIVER_SERIAL = '5836R40112';
export const BT_DEVICES: { id: string; label: string; ours: boolean }[] = [
  { id: RECEIVER_SERIAL, label: `GNSS R-7 · SN ${RECEIVER_SERIAL}`, ours: true },
  { id: 'phone', label: 'Telefon Pepa', ours: false },
  { id: 'van', label: 'Autorádio dodávky', ours: false },
];

export const EPOCH_OPTIONS = [1, 5, 10, 30];

/** Soubor souřadnic, který jde do kontroleru nahrát. */
export interface ImportFile {
  id: string;
  name: string;
  desc: string;
  location: LocationId;
  points: { id: string; Y: number; X: number; H?: number; label: string }[];
}

export interface ControllerJob {
  name: string;
  crs: CrsId;
  location: LocationId;
  imported: string[]; // ID nahraných souborů
}

/** Kroky, bez kterých kontroler neměří. Pořadí = pořadí v průvodci. */
export type SetupStep = 'job' | 'bluetooth' | 'antenna' | 'ntrip';

export const SETUP_STEP_TEXT: Record<SetupStep, string> = {
  job: 'V kontroleru založ zakázku a vyber souřadnicový systém',
  bluetooth: 'V kontroleru připoj přijímač přes Bluetooth',
  antenna: 'V kontroleru zadej typ a výšku antény',
  ntrip: 'V kontroleru připoj korekce CZEPOS (NTRIP)',
};

export class FieldController {
  jobs: ControllerJob[] = [];
  job: ControllerJob | null = null;
  bt: string | null = null; // připojený přijímač (sériové číslo)
  mountpoint: string | null = null;
  ntripOn = false;
  antennaType: string | null = null;
  antennaHeight: number | null = null;
  epochs = 5;
  tolH = 0.03; // mez přesnosti pro uložení bodu [m]
  tolV = 0.05;
  correctionAge = 99; // stáří posledních korekcí [s]
  private dropout = 0; // zbývající výpadek dat [s]
  private dropTimer = 30;

  /** Co ještě chybí, aby šlo měřit v RTK. */
  missing(): SetupStep[] {
    const m: SetupStep[] = [];
    if (!this.job) m.push('job');
    if (this.bt !== RECEIVER_SERIAL) m.push('bluetooth');
    if (!this.antennaType || this.antennaHeight === null) m.push('antenna');
    if (!this.ntripOn || !this.mountpoint) m.push('ntrip');
    return m;
  }

  createJob(name: string, crs: CrsId, location: LocationId): ControllerJob {
    const job: ControllerJob = { name: name.trim() || 'Zakazka', crs, location, imported: [] };
    this.jobs.push(job);
    this.job = job;
    return job;
  }

  openJob(name: string): void {
    this.job = this.jobs.find((j) => j.name === name) ?? this.job;
  }

  /** Chyba výšky ze zadané antény: skutečná výška ARP − zadaná (s fázovým centrem vybraného typu). */
  heightError(actualPoleHeight: number): number {
    if (this.antennaHeight === null) return 0;
    const t = ANTENNA_TYPES.find((a) => a.id === this.antennaType);
    return actualPoleHeight - this.antennaHeight - (t?.phaseOffset ?? 0);
  }

  /** Vzdálenost od báze pro odhad přesnosti; síťové řešení se chová jako blízká báze. */
  baseKm(location: LocationId): number {
    const mp = MOUNTPOINTS.find((m) => m.id === this.mountpoint);
    return mp?.kind === 'single' ? NEAREST_BASE_KM[location] : 3;
  }

  /**
   * Tok korekcí: s připojeným NTRIP a signálem chodí každou sekundu.
   * Při slabém signálu občas vypadnou na 10–25 s. `rand` = náhoda 0…1.
   */
  updateCorrections(dt: number, location: LocationId, rand: () => number): void {
    if (!this.ntripOn || !this.mountpoint || this.bt !== RECEIVER_SERIAL) {
      this.correctionAge = 99;
      return;
    }
    const signal = DATA_SIGNAL[location];
    if (this.dropout > 0) {
      this.dropout -= dt;
      this.correctionAge += dt;
      return;
    }
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 20 + rand() * 60;
      if (rand() > signal) this.dropout = 10 + rand() * 15;
    }
    // Korekce chodí jednou za sekundu, se slabším signálem se zpožďují.
    this.correctionAge = 1 + (1 - signal) * 2 * rand();
  }

  /** Korekce jsou čerstvé (do 10 s), přijímač může držet RTK. */
  get correctionsOk(): boolean {
    return this.correctionAge <= 10;
  }
}
