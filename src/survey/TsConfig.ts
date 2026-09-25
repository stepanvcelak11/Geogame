/**
 * Nastavení totální stanice v jejím programu: zakázka, import bodů, typ hranolu (konstanta),
 * výška cíle a atmosférická korekce. Chybné nastavení se propíše do měření stejně jako ve skutečnosti:
 * konstanta hranolu posune každou délku na hranol, výška cíle všechny výšky, špatná teplota
 * a tlak délky úměrně vzdálenosti (ppm).
 */
export interface PrismType {
  id: 'gpr1' | 'gmp101' | 'grz4' | 'foil';
  label: string;
  constMm: number; // adiční konstanta (Leica) [mm]
}

export const PRISMS: PrismType[] = [
  { id: 'gpr1', label: 'Kruhový hranol GPR1 (standard)', constMm: 0 },
  { id: 'gmp101', label: 'Mini hranol GMP101', constMm: 17.5 },
  { id: 'grz4', label: '360° hranol GRZ4', constMm: 23.1 },
  { id: 'foil', label: 'Odrazná fólie 60 mm', constMm: 34.4 },
];

/** Na výtyčce ve hře je kruhový hranol GPR1 ve výšce 2,000 m. */
export const REAL_PRISM: PrismType['id'] = 'gpr1';
export const REAL_TARGET_H = 2.0;

export interface TsConfig {
  jobs: string[];
  job: string | null;
  imported: string[]; // lokality, jejichž bodové pole je nahrané v zakázce
  prism: PrismType['id'];
  targetH: number; // výška cíle v_c [m]
  tempC: number; // zadaná teplota
  pressHpa: number; // zadaný tlak
}

/** Výchozí stav stanice po předchozím uživateli: 360° hranol, výška cíle 1,5 m, „laboratorní“ atmosféra. */
export function defaultTsConfig(): TsConfig {
  return { jobs: [], job: null, imported: [], prism: 'grz4', targetH: 1.5, tempC: 12, pressHpa: 1013 };
}

/** Atmosférická korekce dálkoměru [ppm] (přibližný vzorec Leica, 50 % vlhkost). */
export function atmPpm(tempC: number, pressHpa: number): number {
  return 286.338 - (0.29535 * pressHpa) / (1 + 0.003661 * tempC);
}

/** Tlak podle nadmořské výšky (barometrická formule). */
export function pressureAt(heightM: number): number {
  return 1013.25 * Math.pow(1 - 2.25577e-5 * heightM, 5.25588);
}

export function prismConst(id: PrismType['id']): number {
  return PRISMS.find((p) => p.id === id)?.constMm ?? 0;
}

/**
 * Chyba délky z nastavení: konstanta hranolu [m] (jen u hranolu) a měřítko z atmosféry [ppm].
 * `realTemp`/`realPress` = skutečné podmínky v terénu.
 */
export function distanceError(cfg: TsConfig, prismMode: boolean, realTemp: number, realPress: number): { addM: number; ppm: number } {
  const addM = prismMode ? (prismConst(cfg.prism) - prismConst(REAL_PRISM)) / 1000 : 0;
  const ppm = atmPpm(cfg.tempC, cfg.pressHpa) - atmPpm(realTemp, realPress);
  return { addM, ppm };
}

/** Co je v programu stanice ještě potřeba udělat (v pořadí), vzhledem k terénu. */
export function tsMissing(cfg: TsConfig, location: string, realTemp: number, realPress: number): ('job' | 'import' | 'prism' | 'target' | 'atm')[] {
  const m: ('job' | 'import' | 'prism' | 'target' | 'atm')[] = [];
  if (!cfg.job) m.push('job');
  if (!cfg.imported.includes(location)) m.push('import');
  if (cfg.prism !== REAL_PRISM) m.push('prism');
  if (Math.abs(cfg.targetH - REAL_TARGET_H) > 0.0005) m.push('target');
  if (Math.abs(cfg.tempC - realTemp) > 3 || Math.abs(cfg.pressHpa - realPress) > 8) m.push('atm');
  return m;
}
