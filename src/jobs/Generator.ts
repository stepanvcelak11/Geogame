import { Rng } from '../core/Rng';
import type { JobSpec } from './JobCatalog';

/**
 * Nové objednávky na každý den: varianty zakázek (jiný dům, jiný výběr prvků a bodů,
 * jiný objednatel a odměna). Deterministické podle čísla dne.
 */
const CLIENTS = [
  'Ing. Horák, stavebník',
  'Manželé Kovářovi',
  'Stavby Polabí s.r.o.',
  'Obec Nová Ves',
  'Vodovody a kanalizace',
  'Projekce Mlynář',
  'Zemědělské družstvo Kněžívka',
  'Petr Dušek, soukromník',
  'Energetika Polabí',
  'Realitní kancelář Domov',
];

const STAVBA_MARKS = ['TB-0321-014', 'ZhB-4021', 'PBPP-4001', 'PBPP-4002', 'HZ-101', 'HZ-102', 'HZ-103', 'HZ-104', 'NZ-Ab7-12'];
const LOUKA_MARKS = ['TB-0418-022', 'PBPP-5101', 'PBPP-5102', 'HZ-301', 'HZ-302', 'NZ-Kn-15'];
const STAVBA_FEATURES = ['vpust-1', 'vpust-2', 'vpust-3', 'roh-SV', 'roh-JV', 'roh-JZ'];
const KULNA = ['kulna-SZ', 'kulna-SV', 'kulna-JV', 'kulna-JZ'];
const LES = ['propustek-vtok', 'propustek-vytok', 'les-hranice', 'les-dub'];
const LES_NAME: Record<string, string> = { 'propustek-vtok': 'vtok propustku', 'propustek-vytok': 'výtok propustku', 'les-hranice': 'hraniční kámen', 'les-dub': 'patu dubu' };

function pick<T>(rng: Rng, list: readonly T[], n: number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const round100 = (v: number): number => Math.round(v / 100) * 100;

type Template = (rng: Rng, id: string, day: number) => JobSpec;

const TEMPLATES: Template[] = [
  // Vytyčení domu: jiný rozměr a poloha na parcele.
  (rng, id, day) => {
    const w = 8 + Math.round(rng.next() * 10) / 2; // 8–13 m
    const d = 7 + Math.round(rng.next() * 6) / 2; // 7–10 m
    const du = Math.round((rng.next() * 8 - 4) * 2) / 2;
    const dv = Math.round((rng.next() * 5 - 3) * 2) / 2;
    const client = CLIENTS[Math.floor(rng.next() * 5)];
    return {
      id,
      title: `Vytyčení domu ${w.toFixed(1).replace('.', ',')} × ${d.toFixed(1).replace('.', ',')} m`,
      client,
      location: 'stavba',
      type: 'vytyceni',
      brief: `Nová objednávka: vytyč čtyři hlavní rohy domu ${w.toFixed(1).replace('.', ',')} × ${d.toFixed(1).replace('.', ',')} m podle vytyčovacího výkresu. Na každý roh kolík, mezní odchylka 2 cm.`,
      tolerance: { xy: 0.02 },
      stake: 'dum',
      house: { halfU: w / 2, halfV: d / 2, du, dv },
      pay: round100(4800 + w * d * 12 + rng.next() * 800),
      kit: ['gnssCase', 'gnssRover'],
      difficulty: 2,
      issued: day,
    };
  },
  // Polohopis na stavbě: jiný výběr vpustí a rohů.
  (rng, id, day) => {
    const ids = pick(rng, STAVBA_FEATURES, 3 + Math.floor(rng.next() * 3));
    return {
      id,
      title: `Zaměření ${ids.length} prvků u ulice`,
      client: CLIENTS[4 + Math.floor(rng.next() * 3)],
      location: 'stavba',
      type: 'polohopis',
      brief: `Nová objednávka: zaměř ${ids.map((f) => (f.startsWith('vpust') ? `vpust ${f.slice(6)}` : `roh trafostanice ${f.slice(4)}`)).join(', ')}. Každý bod se správným kódem.`,
      tolerance: { xy: 0.1 },
      featureIds: ids,
      pay: round100(2600 + ids.length * 450 + rng.next() * 500),
      kit: ['gnssCase', 'gnssRover'],
      difficulty: 1,
      issued: day,
    };
  },
  // Kůlna na louce: jen některé rohy (zbytek už mají).
  (rng, id, day) => {
    const ids = pick(rng, KULNA, 2 + Math.floor(rng.next() * 3));
    return {
      id,
      title: `Doměření ${ids.length} rohů kůlny`,
      client: CLIENTS[6],
      location: 'louka',
      type: 'polohopis',
      brief: `Nová objednávka: v katastru chybí rohy kůlny ${ids.map((f) => f.slice(6)).join(', ')}. Zaměř je s kódem roh budovy.`,
      tolerance: { xy: 0.1 },
      featureIds: ids,
      pay: round100(2400 + ids.length * 400 + rng.next() * 400),
      kit: ['gnssCase', 'gnssRover'],
      difficulty: 1,
      issued: day,
    };
  },
  // Les: jen některé prvky (pomocné body 8001, 8002 zůstávají, pokud už stojí).
  (rng, id, day) => {
    const ids = pick(rng, LES, 2 + Math.floor(rng.next() * 2));
    return {
      id,
      title: `Doměření ${ids.length} prvků v lese`,
      client: 'Lesy obce Hrušov',
      location: 'les',
      type: 'polohopis',
      brief: `Nová objednávka: zaměř ${ids.map((f) => LES_NAME[f]).join(', ')}. V lese GNSS nedá FIX – pomocné body 8001 a 8002 před lesem (když ještě nejsou, stabilizuj je), stanice na 8001, orientace na 8002.`,
      tolerance: { xy: 0.06 },
      featureIds: ids,
      requireStation: true,
      helperPoints: [
        { x: -62, z: 0 },
        { x: -140, z: 0 },
      ],
      stationAt: 'PB-8001',
      orientOn: 'PB-8002',
      stationTask: 'Zaměř zadané prvky v lese (hranol na prvek, správný kód)',
      pay: round100(6800 + ids.length * 900 + rng.next() * 600),
      kit: ['gnssCase', 'gnssRover', 'tripod', 'tsCase', 'prismPole'],
      difficulty: 3,
      issued: day,
    };
  },
  // Rekognoskace: jiná sada bodů na stavbě nebo na louce.
  (rng, id, day) => {
    const louka = rng.next() < 0.5;
    const marks = pick(rng, louka ? LOUKA_MARKS : STAVBA_MARKS, louka ? 3 + Math.floor(rng.next() * 2) : 4 + Math.floor(rng.next() * 3));
    return {
      id,
      title: `Rekognoskace ${marks.length} bodů (${louka ? 'louka' : 'stavba'})`,
      client: CLIENTS[Math.floor(rng.next() * CLIENTS.length)],
      location: louka ? 'louka' : 'stavba',
      type: 'rekognoskace',
      brief: 'Nová objednávka: před měřením ověř, které body z katalogu jsou na místě a v pořádku. Chybějící bod nahlas až na místě.',
      tolerance: { xy: 0.03 },
      reconMarks: marks,
      pay: round100(1800 + marks.length * 350 + rng.next() * 400),
      kit: ['gnssCase', 'gnssRover'],
      difficulty: 1,
      issued: day,
    };
  },
];

/** Dvě nové objednávky pro daný den (různé šablony). */
export function ordersForDay(day: number): JobSpec[] {
  const rng = new Rng(0x6e0 + day * 7919);
  const t = pick(rng, TEMPLATES.map((_, i) => i), 2);
  return t.map((ti, k) => TEMPLATES[ti](rng, `obj-${day}-${k + 1}`, day));
}
