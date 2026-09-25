/**
 * Denní světlo podle herních hodin: poloha slunce (východ → jih → západ), barvy oblohy,
 * mlhy a světel. Čistá funkce bez three.js – dá se testovat.
 */
export interface Daylight {
  sunDir: { x: number; y: number; z: number }; // jednotkový, herní rámec (x východ, z jih)
  sunColor: number;
  sunIntensity: number;
  skyLight: number; // polokoule: obloha
  groundLight: number; // polokoule: zem
  hemiIntensity: number;
  horizon: number;
  zenith: number;
  night: number; // 0 den … 1 noc
}

type Key = { t: number; sun: number; sunI: number; sky: number; ground: number; hemiI: number; horizon: number; zenith: number };
// t = minuty od půlnoci
const KEYS: Key[] = [
  { t: 5 * 60, sun: 0x3a4a7a, sunI: 0.05, sky: 0x2a3552, ground: 0x15130f, hemiI: 0.35, horizon: 0x2c3a58, zenith: 0x0f1628 },
  { t: 6 * 60 + 30, sun: 0xffb074, sunI: 1.3, sky: 0xc9b9b0, ground: 0x4d4332, hemiI: 1.0, horizon: 0xe8b98e, zenith: 0x5f84b0 },
  { t: 9 * 60, sun: 0xfff0d6, sunI: 2.3, sky: 0xd4e6f2, ground: 0x5b5236, hemiI: 1.45, horizon: 0xa9c4d6, zenith: 0x4f86c2 },
  { t: 15 * 60, sun: 0xfff3dd, sunI: 2.4, sky: 0xd4e6f2, ground: 0x5b5236, hemiI: 1.5, horizon: 0xa9c4d6, zenith: 0x4a82c0 },
  { t: 18 * 60, sun: 0xffc78a, sunI: 1.9, sky: 0xd8d0c4, ground: 0x544a33, hemiI: 1.2, horizon: 0xd9b48c, zenith: 0x5a7fae },
  { t: 19 * 60 + 45, sun: 0xff8a4a, sunI: 0.9, sky: 0x9c8aa0, ground: 0x3a3226, hemiI: 0.7, horizon: 0xd27a4e, zenith: 0x33466e },
  { t: 21 * 60, sun: 0x3a4a7a, sunI: 0.05, sky: 0x2a3552, ground: 0x15130f, hemiI: 0.35, horizon: 0x2c3a58, zenith: 0x0f1628 },
];

const mixHex = (a: number, b: number, k: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export function daylight(minutes: number): Daylight {
  const m = ((minutes % 1440) + 1440) % 1440;
  let i = KEYS.findIndex((k) => k.t > m);
  if (i <= 0) i = i === 0 ? 1 : KEYS.length - 1;
  const a = KEYS[i - 1];
  const b = KEYS[i];
  const k = m <= a.t ? 0 : m >= b.t ? 1 : (m - a.t) / (b.t - a.t);
  const lerp = (x: number, y: number): number => x + (y - x) * k;
  // Slunce: 6:00 východ, 13:15 nejvýš (~55°) na jihu, 20:30 západ.
  const u = Math.min(1, Math.max(0, (m - 6 * 60) / (14.5 * 60)));
  const elev = Math.max(-0.12, Math.sin(Math.PI * u) * 0.96 - 0.04);
  const az = Math.PI * u; // 0 = východ (+x), π/2 = jih (+z), π = západ
  const ce = Math.cos(elev);
  const night = m < 5 * 60 || m > 21 * 60 ? 1 : m < 6 * 60 + 30 ? 1 - (m - 5 * 60) / 90 : m > 19 * 60 + 45 ? (m - (19 * 60 + 45)) / 75 : 0;
  return {
    sunDir: { x: Math.cos(az) * ce, y: Math.max(0.05, Math.sin(elev)), z: Math.sin(az) * ce },
    sunColor: mixHex(a.sun, b.sun, k),
    sunIntensity: lerp(a.sunI, b.sunI),
    skyLight: mixHex(a.sky, b.sky, k),
    groundLight: mixHex(a.ground, b.ground, k),
    hemiIntensity: lerp(a.hemiI, b.hemiI),
    horizon: mixHex(a.horizon, b.horizon, k),
    zenith: mixHex(a.zenith, b.zenith, k),
    night: Math.min(1, Math.max(0, night)),
  };
}

const toGray = (hex: number, k: number, gray = 0x9aa3ab): number => mixHex(hex, gray, k);

/** Počasí přes denní světlo: oblačnost šedí a tlumí slunce, déšť ztmaví, mlha zkrátí dohled. */
export function weatherize(d: Daylight, w: { cloud: number; rain: number; fog: number }): Daylight & { fogScale: number } {
  const c = Math.min(1, w.cloud * 0.75 + w.rain * 0.25);
  return {
    ...d,
    sunIntensity: d.sunIntensity * (1 - c * 0.75),
    hemiIntensity: d.hemiIntensity * (1 - w.rain * 0.25),
    horizon: toGray(d.horizon, Math.max(c * 0.6, w.fog * 0.8), w.fog > 0.5 ? 0xc4c8cb : 0x9aa3ab),
    zenith: toGray(d.zenith, c * 0.7),
    skyLight: toGray(d.skyLight, c * 0.5),
    fogScale: 1 - w.fog * 0.82 - w.rain * 0.35,
  };
}
