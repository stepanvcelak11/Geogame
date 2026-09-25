import type { Vec3 } from '../core/math';
import type { SjtskCoord, SjtskFrame } from '../geodesy/CoordinateSystem';
import type { FeatureCode } from '../geodesy/types';
import type { ItemKind } from '../items/items';
import { rayObb, resolveCircleObb, type ColliderSet, type ColliderTag, type Obb } from './Colliders';
import type { Heightmap } from './Heightmap';

export type LocationId = 'kancelar' | 'stavba' | 'louka' | 'les';

export interface TreeInstance {
  x: number;
  z: number;
  groundY: number;
  kind: 'conifer' | 'broadleaf';
  height: number;
  trunkR: number;
  crownBase: number; // výška nasazení koruny nad terénem
  crownR: number;
  tint: number; // 0…1 barevná variace
}

/** TB trigonometrický, ZhB zhušťovací, PBPP podrobné pole, HZ hraniční znak, NZ nivelační značka. */
export type MarkType = 'TB' | 'ZhB' | 'PBPP' | 'HZ' | 'NZ' | 'PB';

export const MARK_TYPE_NAME: Record<MarkType, string> = {
  TB: 'Trigonometrický bod',
  ZhB: 'Zhušťovací bod',
  PBPP: 'Bod podrobného polohového pole',
  HZ: 'Hraniční znak',
  NZ: 'Nivelační značka',
  PB: 'Pomocný měřický bod',
};

/** Zkratky, které geodet zná z katalogu. */
export const MARK_TYPE_SHORT: Record<MarkType, string> = { TB: 'TB', ZhB: 'ZhB', PBPP: 'PBPP', HZ: 'HZ', NZ: 'NZ', PB: 'PB' };

/** Skutečný stav značky v terénu – katalog o něm neví. */
export type MarkCondition = 'ok' | 'damaged' | 'missing';

export interface ControlMark {
  id: string;
  number: string;
  type: MarkType;
  stabilization: string;
  description: string; // místopis
  pos: Vec3; // měřená značka (střed křížku / hlavy) v herním rámci
  catalog: SjtskCoord; // katalogové souřadnice na cm (NZ výška na mm)
  condition: MarkCondition;
  conditionNote?: string; // co hráč uvidí při prohlídce
}

/** Cesta podél osy x: asfaltová ulice s obrubníky, nebo polní cesta. */
export interface RoadInfo {
  surface: 'asphalt' | 'dirt';
  z: number; // osa
  halfWidth: number;
  xMin: number;
  xMax: number;
  curbHeight: number; // 0 = bez obrubníků
  curbWidth: number;
  inlets: { x: number; z: number }[]; // uliční vpusti
}

/** Jednoduchá budova (trafostanice), osově zarovnaná. */
export interface BuildingInfo {
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
  height: number;
  groundY: number;
}

export interface FenceInfo {
  posts: { x: number; z: number; groundY: number }[];
  height: number;
}

export interface ParcelInfo {
  name: string;
  corners: { x: number; z: number }[];
}

/** Skutečný prvek polohopisu – kontrola zakázky „zaměření“. */
export interface FeatureInfo {
  id: string;
  code: FeatureCode;
  label: string;
  pos: Vec3;
}

export type Surface = 'grass' | 'site' | 'road' | 'dirt';

/** Stavby a předměty scenérie (dům, buňka, bagr…). Rozměry w (osa x) × d (osa z) × h, osově zarovnané. */
export type SceneryKind =
  | 'house'
  | 'office'
  | 'garage'
  | 'shelf'
  | 'board'
  | 'siteOffice'
  | 'toilet'
  | 'excavator'
  | 'soilPile'
  | 'bricks'
  | 'hayBale'
  | 'shed'
  | 'powerPole'
  | 'car'
  | 'bench'
  | 'sign'
  | 'post'
  | 'culvert'
  | 'well';

export interface SceneryItem {
  kind: SceneryKind;
  x: number;
  z: number;
  yaw: number; // 0 nebo násobky π/2 (kolize jsou osově zarovnané)
  w: number;
  d: number;
  h: number;
  groundY: number;
  color?: number;
  variant?: number;
  text?: string; // cedule
}

/** Rybník: elipsa s hladinou. */
export interface WaterInfo {
  x: number;
  z: number;
  rx: number;
  rz: number;
  level: number;
}

/** Obdělávané pole pro obarvení terénu. */
export interface FieldInfo {
  corners: { x: number; z: number }[];
  crop: 'wheat' | 'plowed' | 'rapeseed' | 'meadow';
}

/** Stav dodávky – mění se při jízdě. */
export interface VehicleState {
  x: number;
  z: number;
  yaw: number; // stejná konvence jako hráč: 0 = sever, kladně doleva
  speed: number; // m/s, záporně = couvání
  steer: number; // úhel kol [rad]
  groundY: number;
  pitch: number;
  roll: number;
  length: number;
  width: number;
  height: number;
}

export interface ItemSpawn {
  kind: ItemKind;
  x: number;
  z: number;
  yaw: number;
}

export interface RayHit {
  t: number;
  kind: 'terrain' | 'vehicle' | ColliderTag;
}

export interface WorldSpec {
  location: LocationId;
  name: string; // „Stavba RD, Nová Ves“
  frame: SjtskFrame;
  heightmap: Heightmap;
  colliders: ColliderSet;
  trees: readonly TreeInstance[];
  marks: ControlMark[];
  vehicle: VehicleState;
  road: RoadInfo;
  building: BuildingInfo | null;
  fence: FenceInfo | null;
  parcels: readonly ParcelInfo[];
  features: readonly FeatureInfo[];
  flatRadius: number; // srovnaná plocha kolem počátku (0 = žádná)
  scenery: readonly SceneryItem[];
  water: readonly WaterInfo[];
  fields: readonly FieldInfo[];
  spawn: { x: number; z: number; yaw: number };
  itemSpawns: readonly ItemSpawn[];
}

/** Čistá data jedné lokality + dotazy. Nic z toho neví o vykreslování. */
export class World implements WorldSpec {
  readonly location!: LocationId;
  readonly name!: string;
  readonly frame!: SjtskFrame;
  readonly heightmap!: Heightmap;
  readonly colliders!: ColliderSet;
  readonly trees!: readonly TreeInstance[];
  readonly marks!: ControlMark[];
  readonly vehicle!: VehicleState;
  readonly road!: RoadInfo;
  readonly building!: BuildingInfo | null;
  readonly fence!: FenceInfo | null;
  readonly parcels!: readonly ParcelInfo[];
  readonly features!: readonly FeatureInfo[];
  readonly flatRadius!: number;
  readonly scenery!: readonly SceneryItem[];
  readonly water!: readonly WaterInfo[];
  readonly fields!: readonly FieldInfo[];
  readonly spawn!: { x: number; z: number; yaw: number };
  readonly itemSpawns!: readonly ItemSpawn[];

  constructor(spec: WorldSpec) {
    Object.assign(this, spec);
  }

  /** Povrch pod nohama / pod koly. */
  surfaceAt(x: number, z: number): Surface {
    const r = this.road;
    if (Math.abs(z - r.z) <= r.halfWidth + r.curbWidth && x >= r.xMin && x <= r.xMax) return r.surface === 'asphalt' ? 'road' : 'dirt';
    return this.flatRadius > 0 && Math.hypot(x, z) < this.flatRadius * 0.85 ? 'site' : 'grass';
  }

  /** Kvádr dodávky pro kolize hráče. */
  vehicleObb(): Obb {
    const v = this.vehicle;
    return { cx: v.x, cz: v.z, yaw: v.yaw, halfL: v.length / 2, halfW: v.width / 2, yMin: v.groundY - 1, yMax: v.groundY + v.height };
  }

  /** Vytlačí kruh z pevných překážek včetně (pohyblivé) dodávky. */
  resolveCircle(p: { x: number; z: number }, r: number, yFeet: number, yHead: number): { hit: boolean; nx: number; nz: number } {
    const a = this.colliders.resolveCircle(p, r, yFeet, yHead);
    const b = resolveCircleObb(p, r, yFeet, yHead, this.vehicleObb());
    if (!b.hit) return a;
    if (!a.hit) return b;
    const l = Math.hypot(a.nx + b.nx, a.nz + b.nz) || 1;
    return { hit: true, nx: (a.nx + b.nx) / l, nz: (a.nz + b.nz) / l };
  }

  /** Paprsek proti terénu i objektům. Základ pro interakci, GNSS a později laser. */
  raycast(o: Vec3, d: Vec3, maxDist: number): RayHit | null {
    const tTerrain = this.heightmap.raycast(o, d, maxDist);
    const hit = this.colliders.raycast(o, d, tTerrain ?? maxDist);
    let best: RayHit | null = hit ? { t: hit.t, kind: hit.collider.tag } : tTerrain !== null ? { t: tTerrain, kind: 'terrain' } : null;
    const tv = rayObb(o, d, this.vehicleObb(), best?.t ?? maxDist);
    if (tv !== null && (!best || tv < best.t)) best = { t: tv, kind: 'vehicle' };
    return best;
  }
}
