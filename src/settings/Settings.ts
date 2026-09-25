/** Nastavení hráče (grafika, ovládání, zvuk). Ukládá se do localStorage, když jde. */
export interface Settings {
  v: 1;
  gfx: 0 | 1 | 2; // úsporná / realistická (PBR) / vysoká (PBR + AO)
  shadows: boolean;
  grass: 0 | 1 | 2; // vypnutá / řídká / plná
  draw: 0 | 1 | 2; // dohled krátký / střední / dlouhý
  saver: boolean; // úsporné rozlišení
  lookSens: number; // 0,5 … 2
  invertY: boolean;
  volume: number; // 0 … 1
  ambience: boolean;
  guide: boolean;
  fps: boolean;
  fps30?: boolean; // úspora baterie: nejvýš 30 snímků za sekundu
}

const KEY = 'geodet-nastaveni-v1';

export type Tier = 'low' | 'mid' | 'high';

/** Grafické předvolby podle výkonu zařízení. */
export function preset(tier: Tier): Pick<Settings, 'gfx' | 'shadows' | 'grass' | 'draw' | 'saver' | 'fps30'> {
  if (tier === 'low') return { gfx: 0, shadows: false, grass: 1, draw: 0, saver: true, fps30: true };
  if (tier === 'mid') return { gfx: 1, shadows: true, grass: 1, draw: 1, saver: false, fps30: false };
  return { gfx: 2, shadows: true, grass: 2, draw: 1, saver: false, fps30: false };
}

export function defaultSettings(mobile: boolean, tier: Tier = mobile ? 'mid' : 'high'): Settings {
  return { v: 1, ...preset(tier), lookSens: 1, invertY: false, volume: 0.8, ambience: true, guide: true, fps: false };
}

export function loadSettings(mobile: boolean, tier?: Tier): Settings {
  const d = defaultSettings(mobile, tier);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw) as Partial<Settings>;
    return s && s.v === 1 ? { ...d, ...s } : d;
  } catch {
    return d;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bez úložiště se nastavení jen neuloží */
  }
}

/** Dohled [m] podle volby; mobil má kratší základ. */
export function drawDistanceFor(s: Settings, mobile: boolean): number {
  const base = mobile ? 300 : 460;
  return base * [0.65, 1, 1.35][s.draw];
}
