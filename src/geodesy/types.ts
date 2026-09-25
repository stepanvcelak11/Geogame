import type { SjtskCoord } from './CoordinateSystem';

/** Kódy prvků pro kódování bodů v kontroleru. */
export type FeatureCode =
  | 'PLOT'
  | 'OBRUBNIK'
  | 'ROH_BUDOVY'
  | 'STROM'
  | 'VPUST'
  | 'HRANICE'
  | 'TERENNI_BOD'
  | 'PEVNY_BOD'
  | 'PROPUSTEK';

export type MeasurementMethod = 'polarni' | 'gnss_rtk' | 'nivelace' | 'katalog';

/** Zaměřený nebo převzatý bod. Y, X v S-JTSK, Z = výška v Bpv [m]. */
export interface SurveyPoint {
  id: string;
  Y: number;
  X: number;
  Z: number;
  code: FeatureCode;
  sigmaXY: number; // střední polohová chyba [m]
  sigmaZ: number; // střední výšková chyba [m]
  method: MeasurementMethod;
  timestamp: number; // herní čas [ms]
  note?: string;
}

/** Stav totální stanice na stanovisku (Milník 2–3). Úhly v radiánech. */
export interface InstrumentState {
  station: SjtskCoord | null; // X0, Y0, Z0; null před výpočtem volného stanoviska
  instrumentHeight: number; // v_p [m]
  prismHeight: number; // v_h [m]
  orientationOffset: number; // orientační posun [rad]
  leveling: { pitch: number; roll: number }; // náklon svislé osy [rad]
  centeringOffset: number; // excentricita nad bodem [m]
  telescope: { hz: number; v: number }; // Hz a zenitový úhel V
}

export type JobKind = 'hranice' | 'polohopis_vyskopis' | 'vytyceni';

export interface JobDefinition {
  id: string;
  title: string;
  kind: JobKind;
  brief: string;
  tolerance: { xy: number; z: number }; // [m], např. 0,015
  knownPointIds: string[];
  area: { Y: number; X: number }[]; // polygon požadovaného rozsahu
  requiredCodes: FeatureCode[];
}
