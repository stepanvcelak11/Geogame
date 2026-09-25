import type { EquipId, EquipState } from './Equipment';
import type { JobSpec } from './JobCatalog';

/** Postup hráče: den, účet a výsledky zakázek. Ukládá se do localStorage (když jde). */
export interface CareerJob {
  status: 'nova' | 'aktivni' | 'odevzdana';
  result?: { ok: boolean; text: string; pay: number };
}

export interface CareerState {
  v: 1;
  day: number;
  money: number;
  jobs: Record<string, CareerJob>;
  stats: { jobsDone: number; km: number; points: number; okJobs?: number };
  upgrades?: string[]; // koupené vybavení
  urgentDone?: number; // den, kdy už byla spěšná zakázka zaplacena
  equipment?: Record<EquipId, EquipState>; // stav přístrojů
  insured?: boolean; // pojištění vybavení (spoluúčast 2 000 Kč)
  orders?: JobSpec[]; // generované objednávky (nové každý den)
}

export interface Upgrade {
  id: 'imu' | 'antena' | 'nivelak' | 'dalkomer' | 'destnik';
  name: string;
  desc: string;
  price: number;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'imu',
    name: 'GNSS s náklonovým senzorem (IMU)',
    desc: 'Přijímač si náklon výtyčky dopočítá sám. S GNSS už nemusíš srovnávat bublinu.',
    price: 16000,
  },
  {
    id: 'antena',
    name: 'Anténa GPS + Galileo + BeiDou + GLONASS',
    desc: 'Víc družic: FIX i pod řidšími stromy a blíž u budov.',
    price: 9000,
  },
  {
    id: 'nivelak',
    name: 'Nivelák s magnetickým tlumením kompenzátoru',
    desc: 'Ve větru se obraz lati tolik nechvěje: šum čtení ve větru zhruba poloviční.',
    price: 12000,
  },
  {
    id: 'dalkomer',
    name: 'Totální stanice s výkonným dálkoměrem',
    desc: 'Bez hranolu dosáhne dvakrát dál, na hranol i v mlze až 400 m.',
    price: 22000,
  },
  {
    id: 'destnik',
    name: 'Deštník na přístroj',
    desc: 'V dešti chrání stanici a nivelák: optika nemokne a přístroj se neopotřebí dvojnásob.',
    price: 1800,
  },
];

/** Profesní stupeň: podle počtu zakázek odevzdaných bez vady. */
export interface Rank {
  name: string;
  minOk: number; // kolik zakázek v pořádku je potřeba
  maxDifficulty: 1 | 2 | 3; // nejtěžší zakázka, kterou dispečink svěří
  payBonus: number; // příplatek k odměně (0,05 = 5 %)
}

export const RANKS: Rank[] = [
  { name: 'Pomocník měřiče', minOk: 0, maxDifficulty: 1, payBonus: 0 },
  { name: 'Měřič', minOk: 2, maxDifficulty: 2, payBonus: 0 },
  { name: 'Samostatný geodet', minOk: 5, maxDifficulty: 3, payBonus: 0.05 },
  { name: 'Úředně oprávněný zeměměřický inženýr', minOk: 9, maxDifficulty: 3, payBonus: 0.1 },
];

/** Zakázky odevzdané v pořádku (starší uložení počítala jen všechny odevzdané). */
export function okJobs(c: CareerState): number {
  return c.stats.okJobs ?? c.stats.jobsDone;
}

export function rankIndex(c: CareerState): number {
  const n = okJobs(c);
  let i = 0;
  while (i + 1 < RANKS.length && n >= RANKS[i + 1].minOk) i++;
  return i;
}

export function rankOf(c: CareerState): Rank {
  return RANKS[rankIndex(c)];
}

/** Stupeň, který zakázku odemyká (první, jehož maxDifficulty stačí). */
export function rankFor(difficulty: number): Rank {
  return RANKS.find((r) => r.maxDifficulty >= difficulty) ?? RANKS[RANKS.length - 1];
}

/** Příplatek za spěšnou zakázku odevzdanou bez vady týž den. */
export const URGENT_BONUS = 0.3;

/**
 * Spěšná zakázka dne: deterministicky z čísla dne mezi zakázkami, které hráč smí vzít.
 * Stejný den = stejná zakázka, i po načtení uložené hry.
 */
export function urgentJob(day: number, allowed: readonly string[]): string | null {
  if (!allowed.length) return null;
  let h = Math.imul(day ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return allowed[(h >>> 0) % allowed.length];
}

const KEY = 'geodet-kariera-v1';

export function newCareer(): CareerState {
  return { v: 1, day: 1, money: 0, jobs: {}, stats: { jobsDone: 0, km: 0, points: 0 } };
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CareerState;
    return c && c.v === 1 && typeof c.day === 'number' ? c : null;
  } catch {
    return null;
  }
}

export function saveCareer(c: CareerState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* úložiště nemusí být k dispozici – hra jede dál */
  }
}

export function clearCareer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nevadí */
  }
}

const round100 = (v: number): number => Math.round(v / 100) * 100;

/** Příplatky k základní odměně (jen za zakázku v pořádku). */
export function extraPay(base: number, ok: boolean, rank: Rank, urgent: boolean): { rank: number; urgent: number } {
  if (!ok) return { rank: 0, urgent: 0 };
  return { rank: round100(base * rank.payBonus), urgent: urgent ? round100(base * URGENT_BONUS) : 0 };
}

/** Odměna za zakázku: v pořádku plná, k opravě 30 %. */
export function payFor(base: number, ok: boolean): number {
  return ok ? base : Math.round((base * 0.3) / 100) * 100;
}

export const kc = (v: number): string => `${Math.round(v).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`;
