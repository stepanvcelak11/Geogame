/**
 * 3D řízení finišeru: projektová výška vrstvy, simulace pokládky a chybový model.
 * Robotická stanice sleduje 360° hranol na stožáru desky, systém porovnává polohu desky
 * s 3D modelem a hydraulikou drží výšku. Co se pokazí v nastavení, to se položí do asfaltu.
 */

/** Trasa pokládky v herním rámci (osa podél x). */
export const PAVING = {
  x0: -150, // začátek pokládky (staničení 0,000)
  x1: 90, // konec úseku
  halfWidth: 4, // polovina šířky pokládky [m]
  thickness: 0.06, // tloušťka ložné vrstvy ACL 22+ [m]
  crossSlope: 0.025, // příčný sklon 2,5 % (střechovitý ne – jednostranný, doprava dolů)
  speed: 1.2, // pojezd finišeru [m/s reálného času] (≈ 7 m za herní minutu)
  maxRange: 150, // spolehlivý dosah sledování stanicí [m]
  lockRange: 230, // za touhle vzdáleností stanice hranol ztratí
  checkX: [-100, -20, 60] as const, // kontrolní profily
  checkZ: [-3.5, 0, 3.5] as const, // vlevo, osa, vpravo
};

/** Výška podkladu (horní hrana staré vrstvy) v ose: mírné stoupání a výškový oblouk. */
export function baseAxis(x: number): number {
  return 1.2 + 0.012 * x + 0.00003 * (x - 20) * (x - 20);
}

/** Projektová výška horní plochy ložné vrstvy (3D model) v bodě (x, z). */
export function designTop(x: number, z: number): number {
  return baseAxis(x) + PAVING.thickness - PAVING.crossSlope * z;
}

/** Podklad pod pokládkou (stejný příčný sklon). */
export function baseTop(x: number, z: number): number {
  return baseAxis(x) - PAVING.crossSlope * z;
}

export interface PaverModel {
  id: 'lozna' | 'obrusna' | 'podklad';
  file: string;
  label: string;
  offset: number; // o kolik je horní plocha modelu výš než projekt ložné vrstvy [m]
}

export const PAVER_MODELS: PaverModel[] = [
  { id: 'podklad', file: 'D35_km12_podklad_ACP.xml', label: 'Podkladní vrstva ACP 22+ (hotová)', offset: -0.06 },
  { id: 'lozna', file: 'D35_km12_lozna_ACL22.xml', label: 'Ložná vrstva ACL 22+ tl. 60 mm', offset: 0 },
  { id: 'obrusna', file: 'D35_km12_obrusna_SMA11.xml', label: 'Obrusná vrstva SMA 11 tl. 40 mm', offset: 0.04 },
];

/** Stav řídicího systému a pokládky. */
export class PaverSim {
  x = PAVING.x0 - 6; // poloha zadní hrany desky (kde se právě pokládá)
  model: PaverModel['id'] | null = null;
  calibrated = false;
  tracking = false; // stanice je připojená a sleduje hranol
  running = false; // pokládka spuštěná
  stops = 0; // kolikrát finišer zastavil kvůli ztrátě signálu (příčné spáry)
  private wasStopped = false;
  /** Položená výška po metru: odchylka od projektu [m] pro vlevo / osa / vpravo. */
  readonly laid: { x: number; dev: [number, number, number] }[] = [];

  get done(): boolean {
    return this.x >= PAVING.x1;
  }

  get started(): boolean {
    return this.x >= PAVING.x0;
  }

  /**
   * Krok pokládky. `lock` = stanice vidí hranol a je v dosahu, `stationDh` = chyba výšky
   * stanoviska [m] (deska se řídí podle ní, takže se položí opačně), `range` = vzdálenost.
   */
  update(dt: number, lock: boolean, stationDh: number, range: number, noise: () => number): 'moving' | 'stopped' | 'idle' | 'done' {
    if (this.done) return 'done';
    if (!this.running) return 'idle';
    if (!this.tracking || !lock) {
      if (!this.wasStopped) this.stops += this.started ? 1 : 0;
      this.wasStopped = true;
      return 'stopped';
    }
    this.wasStopped = false;
    const nx = Math.min(PAVING.x1, this.x + PAVING.speed * dt);
    // Po každém metru se zapíše, jak vysoko deska jela vůči projektu.
    let next = this.laid.length ? this.laid[this.laid.length - 1].x + 1 : PAVING.x0;
    while (next <= nx) {
      if (next >= PAVING.x0) this.laid.push({ x: next, dev: this.deviation(stationDh, range, noise) });
      next += 1;
    }
    this.x = nx;
    return this.done ? 'done' : 'moving';
  }

  /** Odchylka položené plochy od projektu ložné vrstvy v jednom řezu. */
  deviation(stationDh: number, range: number, noise: () => number): [number, number, number] {
    const model = PAVER_MODELS.find((m) => m.id === this.model);
    const base = (model?.offset ?? 0) + (this.calibrated ? 0 : 0.018) - stationDh;
    const s = 0.001 + range * 0.000008; // šum řízení roste se vzdáleností od stanice
    return [base + noise() * s, base + noise() * s * 0.7, base + noise() * s];
  }

  /** Položená výška v bodě (nebo null, kde ještě není položeno). */
  laidTop(x: number, z: number): number | null {
    if (x < PAVING.x0 || x > this.x || !this.laid.length) return null;
    const i = Math.max(0, Math.min(this.laid.length - 1, Math.round(x - PAVING.x0)));
    const d = this.laid[i].dev;
    // Interpolace přes šířku: vlevo (z < 0) – osa – vpravo.
    const t = Math.max(-1, Math.min(1, z / PAVING.halfWidth));
    const dev = t < 0 ? d[1] + (d[0] - d[1]) * -t : d[1] + (d[2] - d[1]) * t;
    return designTop(x, z) + dev;
  }
}
