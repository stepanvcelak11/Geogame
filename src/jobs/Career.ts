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
  stats: { jobsDone: number; km: number; points: number };
  upgrades?: string[]; // koupené vybavení
}

export interface Upgrade {
  id: 'imu' | 'antena';
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
];

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

/** Odměna za zakázku: v pořádku plná, k opravě 30 %. */
export function payFor(base: number, ok: boolean): number {
  return ok ? base : Math.round((base * 0.3) / 100) * 100;
}

export const kc = (v: number): string => `${Math.round(v).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`;
