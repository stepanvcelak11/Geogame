/** Počasí na den: vzhled i vliv na měření. Deterministické podle čísla dne. */
export type WeatherKind = 'jasno' | 'polojasno' | 'zatazeno' | 'dest' | 'vitr' | 'mlha';

export interface Weather {
  kind: WeatherKind;
  label: string;
  wind: number; // 0…1 (1 ≈ 12 m/s)
  rain: number; // 0…1
  fog: number; // 0…1
  cloud: number; // 0…1 oblačnost
  temp: number; // °C
}

const TABLE: Record<WeatherKind, Omit<Weather, 'kind' | 'temp'> & { temp: [number, number] }> = {
  jasno: { label: 'jasno', wind: 0.15, rain: 0, fog: 0, cloud: 0.1, temp: [22, 29] },
  polojasno: { label: 'polojasno', wind: 0.25, rain: 0, fog: 0, cloud: 0.4, temp: [17, 23] },
  zatazeno: { label: 'zataženo', wind: 0.3, rain: 0, fog: 0.1, cloud: 0.85, temp: [12, 17] },
  dest: { label: 'déšť', wind: 0.4, rain: 1, fog: 0.25, cloud: 1, temp: [9, 14] },
  vitr: { label: 'silný vítr', wind: 1, rain: 0, fog: 0, cloud: 0.55, temp: [11, 17] },
  mlha: { label: 'mlha', wind: 0.05, rain: 0, fog: 1, cloud: 0.9, temp: [6, 11] },
};
const ORDER: WeatherKind[] = ['polojasno', 'jasno', 'vitr', 'zatazeno', 'dest', 'jasno', 'mlha', 'polojasno'];

export function weatherForDay(day: number): Weather {
  // První den je vždy polojasno – ať se hráč nejdřív rozkouká.
  let h = Math.imul(day * 2654435761, 0x9e3779b1) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  const kind = day <= 1 ? 'polojasno' : ORDER[h % ORDER.length];
  const t = TABLE[kind];
  const temp = Math.round(t.temp[0] + ((h >>> 8) % 100) / 100 * (t.temp[1] - t.temp[0]));
  return { kind, label: t.label, wind: t.wind, rain: t.rain, fog: t.fog, cloud: t.cloud, temp };
}

export function weatherText(w: Weather): string {
  return `${w.label}, ${w.temp} °C, vítr ${Math.round(w.wind * 12)} m/s`;
}

/** Násobitel třesu výtyčky v ruce. */
export function poleTremor(w: Weather): number {
  return 1 + w.wind * 1.8 + w.rain * 0.3;
}

/** Směrodatná odchylka čtení latě [m]: vítr rozechvěje přístroj, horké poledne tetelí dlouhé záměry. */
export function levelNoise(w: Weather, minutes: number, dist: number): number {
  const shimmer = w.kind === 'jasno' && minutes > 11 * 60 && minutes < 16 * 60 ? dist * 0.00003 : 0;
  return 0.0003 * (1 + w.wind * 2.5) + shimmer;
}

/** Dosah dálkoměru [m] podle viditelnosti. */
export function stationRanges(w: Weather): { prism: number; reflectorless: number } {
  return { prism: w.fog >= 1 ? 180 : 1500, reflectorless: w.fog >= 1 ? 60 : w.rain > 0 ? 150 : 300 };
}
