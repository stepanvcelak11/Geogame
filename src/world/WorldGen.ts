import { CONFIG } from '../config';
import { DEG, lerp, smoothstep } from '../core/math';
import { Rng } from '../core/Rng';
import { SjtskFrame } from '../geodesy/CoordinateSystem';
import { ColliderSet } from './Colliders';
import { Heightmap } from './Heightmap';
import { LOCATIONS } from './locations';
import { Noise2D } from './Noise';
import {
  World,
  type BuildingInfo,
  type ControlMark,
  type FeatureInfo,
  type FieldInfo,
  type SceneryItem,
  type SceneryKind,
  type WaterInfo,
  type FenceInfo,
  type ItemSpawn,
  type Lane,
  type RegionExit,
  type LocationId,
  type MarkCondition,
  type MarkType,
  type RoadInfo,
  type TreeInstance,
  type VehicleState,
} from './World';

interface Zone {
  x: number;
  z: number;
  r: number;
}

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;
const PALETTE_SITE = { excavator: 0xe0a31a } as const;

const DIRECTIONS = ['severně', 'severovýchodně', 'východně', 'jihovýchodně', 'jižně', 'jihozápadně', 'západně', 'severozápadně'];
/** Slovní směr z A do B v herním rámci (sever = −z). */
export function directionWord(fromX: number, fromZ: number, toX: number, toZ: number): string {
  const a = Math.atan2(toX - fromX, -(toZ - fromZ));
  return DIRECTIONS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** Rozvržení stavby – jedno místo, ze kterého čte terén i objekty. */
export const LAYOUT = {
  road: { z: 44, halfWidth: 3, xMin: -104, xMax: 104, grade: 0.012 },
  building: { x: -30, z: -28, sizeX: 4.2, sizeZ: 3.0, height: 3.2 },
  fence: { z: -50, xFrom: -36, xTo: 19, spacing: 2.5, height: 1.2 },
  parcel: { x: 4, z: -8, halfU: 20, halfV: 15, rotDeg: 12, name: '1254/3' },
} as const;

/** Výkop vodovodní přípojky na stavbě: od domu k řadu v ulici (lomy = měřené body). */
export const TRENCH = [
  { x: 12, z: 6 },
  { x: 12, z: 25 },
  { x: 16, z: 33 },
  { x: 16, z: 40.3 },
] as const;

/** Rozvržení louky. */
export const MEADOW = {
  road: { z: 34, halfWidth: 1.8, xMin: -150, xMax: 150 },
  parcel: { x: -10, z: -18, halfU: 30, halfV: 18, rotDeg: 7, name: '812/5' },
  hedges: [
    { x0: -130, z0: -62, x1: 60, z1: -66 },
    { x0: 72, z0: -140, x1: 76, z1: 20 },
  ],
} as const;

/** Rozvržení lesa: louka na západě, hustý smrkový les na východě, lesní cesta podél osy x. */
export const FOREST = {
  road: { z: 0, halfWidth: 2.2, xMin: -210, xMax: 210 },
  edgeX: -40, // okraj lesa
  culvertX: 28,
  stoneX: 61,
  oakX: 92,
  lane: { x: 40, zEnd: -58, half: 2.6 }, // průsek na jih od cesty ke studánce
  spring: { x: 40.4, z: -47 },
} as const;

export function rectCorners(p: { x: number; z: number; halfU: number; halfV: number; rotDeg: number }): { x: number; z: number }[] {
  const rot = p.rotDeg * DEG;
  return [
    [-p.halfU, -p.halfV],
    [p.halfU, -p.halfV],
    [p.halfU, p.halfV],
    [-p.halfU, p.halfV],
  ].map(([u, v]) => ({ x: p.x + u * Math.cos(rot) - v * Math.sin(rot), z: p.z + u * Math.sin(rot) + v * Math.cos(rot) }));
}

export function frameFor(location: LocationId): SjtskFrame {
  const o = LOCATIONS[location].sjtsk;
  return new SjtskFrame(o.originY, o.originX, o.originH);
}

/** Deterministicky vygeneruje lokalitu. */
export function generateWorld(location: LocationId): World {
  if (location === 'kraj') return generateRegion();
  return location === 'louka' ? generateMeadow() : location === 'kancelar' ? generateOffice() : location === 'les' ? generateForest() : generateSite();
}

/** Bod v mnohoúhelníku (paprsková metoda). */
export function inPolygon(x: number, z: number, poly: readonly { x: number; z: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

interface PlaceOpts {
  yaw?: number;
  color?: number;
  variant?: number;
  text?: string;
  solid?: boolean; // default true: kvádrová kolize
  clear?: number; // okraj, kde neporostou stromy
}

/** Položí objekt scenérie na terén (na nejnižší roh), přidá kolizi a místo bez stromů. */
function place(c: Ctx, out: SceneryItem[], kind: SceneryKind, x: number, z: number, w: number, d: number, h: number, o: PlaceOpts = {}): SceneryItem {
  const yaw = o.yaw ?? 0;
  const swap = Math.abs(Math.sin(yaw)) > 0.5;
  const hw = (swap ? d : w) / 2;
  const hd = (swap ? w : d) / 2;
  let gy = Infinity;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) gy = Math.min(gy, c.heightmap.heightAt(x + sx * hw, z + sz * hd));
  const item: SceneryItem = { kind, x, z, yaw, w, d, h, groundY: gy, color: o.color, variant: o.variant, text: o.text };
  out.push(item);
  if (o.solid !== false) {
    c.colliders.add({ kind: 'box', minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, yMin: gy - 1, yMax: gy + h + (kind === 'house' ? 3 : 0), tag: 'prop' });
  }
  c.clear.push({ x, z, r: Math.hypot(hw, hd) + (o.clear ?? 2) });
  return item;
}

// ------------------------------------------------------------------ společné

interface Ctx {
  rng: Rng;
  heightmap: Heightmap;
  frame: SjtskFrame;
  colliders: ColliderSet;
  marks: ControlMark[];
  clear: Zone[];
}

function addMark(
  c: Ctx,
  type: MarkType,
  number: string,
  x: number,
  z: number,
  y: number,
  stabilization: string,
  description: string,
  condition: MarkCondition = 'ok',
  conditionNote?: string,
): void {
  const rawC = c.frame.toSjtsk({ x, y, z });
  const catalog = { Y: round(rawC.Y, 2), X: round(rawC.X, 2), H: round(rawC.H, type === 'NZ' ? 3 : 2) };
  c.marks.push({ id: `${type}-${number}`, number, type, stabilization, description, pos: c.frame.toWorld(catalog), catalog, condition, conditionNote });
  c.clear.push({ x, z, r: type === 'TB' ? 9 : 4 });
}

/** Trigonometrický bod na nejvyšším mírném vrcholu v prstenci. */
function placeTB(c: Ctx, number: string, avoid: (x: number, z: number) => boolean): void {
  const hm = c.heightmap;
  let tb = { x: 150, z: -60, h: -Infinity };
  for (let z = -190; z <= 190; z += 6) {
    for (let x = -190; x <= 190; x += 6) {
      const d = Math.hypot(x, z);
      if (d < 110 || d > 190 || avoid(x, z)) continue;
      const h = hm.heightAt(x, z);
      if (h > tb.h && hm.slopeAt(x, z) < 18 * DEG) tb = { x, z, h };
    }
  }
  addMark(
    c,
    'TB',
    number,
    tb.x,
    tb.z,
    hm.heightAt(tb.x, tb.z) + 0.1,
    'Žulový hranol s vytesaným křížkem, ochranná tyč, výstražná tabulka',
    `Na vrcholu kopce asi ${Math.round(Math.hypot(tb.x, tb.z))} m ${directionWord(0, 0, tb.x, tb.z)} od středu lokality, v travnatém porostu. Ochranná tyč 1 m severně od kamene.`,
  );
}

function vehicleAt(x: number, z: number, yaw: number, hm: Heightmap): VehicleState {
  return { x, z, yaw, speed: 0, steer: 0, groundY: hm.heightAt(x, z), pitch: 0, roll: 0, length: 4.9, width: 2.0, height: 2.3 };
}

/** Les: zamítací vzorkování s maskou hustoty a minimálním rozestupem. */
function scatterTrees(
  c: Ctx,
  forestNoise: Noise2D,
  blocked: (x: number, z: number) => boolean,
  density: (x: number, z: number, forest: number) => number,
  extra: TreeInstance[] = [],
  maxTrees = 950,
): TreeInstance[] {
  const hm = c.heightmap;
  const half = hm.half;
  const trees: TreeInstance[] = [];
  const occ = new Map<number, { x: number; z: number }[]>();
  const occKey = (ix: number, iz: number): number => (ix + 512) * 2048 + (iz + 512);
  const minSpacing = 2.8;
  const remember = (x: number, z: number): void => {
    const k = occKey(Math.floor(x / 4), Math.floor(z / 4));
    const list = occ.get(k);
    if (list) list.push({ x, z });
    else occ.set(k, [{ x, z }]);
  };
  const spaced = (x: number, z: number): boolean => {
    const ix = Math.floor(x / 4);
    const iz = Math.floor(z / 4);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const t of occ.get(occKey(ix + dx, iz + dz)) ?? []) if ((t.x - x) ** 2 + (t.z - z) ** 2 < minSpacing * minSpacing) return false;
    return true;
  };
  const addCollider = (t: TreeInstance): void => {
    c.colliders.add({ kind: 'circle', x: t.x, z: t.z, r: t.trunkR, yMin: t.groundY - 1, yMax: t.groundY + t.height, tag: 'trunk' });
    c.colliders.add({ kind: 'circle', x: t.x, z: t.z, r: t.crownR * 0.75, yMin: t.groundY + t.crownBase, yMax: t.groundY + t.height, tag: 'crown' });
  };
  for (const t of extra) {
    trees.push(t);
    remember(t.x, t.z);
    addCollider(t);
  }
  for (let attempt = 0, tries = maxTrees === 950 ? 16000 : maxTrees * 17; attempt < tries; attempt++) {
    if (trees.length >= maxTrees) break;
    const x = c.rng.range(-half + 8, half - 8);
    const z = c.rng.range(-half + 8, half - 8);
    if (blocked(x, z)) continue;
    const forest = smoothstep(-0.02, 0.22, forestNoise.fbm(x / 120 + 13.1, z / 120 - 7.7, 3));
    if (c.rng.next() > density(x, z, forest)) continue;
    if (hm.slopeAt(x, z) > 38 * DEG || !spaced(x, z)) continue;
    const t = makeTree(c.rng, x, z, hm.heightAt(x, z), c.rng.next() < 0.35 + 0.5 * forest);
    trees.push(t);
    remember(x, z);
    addCollider(t);
  }
  return trees;
}

function makeTree(rng: Rng, x: number, z: number, groundY: number, conifer: boolean): TreeInstance {
  const height = conifer ? rng.range(11, 21) : rng.range(8, 15);
  return {
    x,
    z,
    groundY,
    kind: conifer ? 'conifer' : 'broadleaf',
    height,
    trunkR: 0.12 + (height / 21) * 0.18 + rng.range(-0.02, 0.02),
    crownBase: conifer ? rng.range(2.8, 4.2) : rng.range(3.0, 4.5),
    crownR: conifer ? 1.5 + height * 0.08 : rng.range(2.4, 3.8),
    tint: rng.next(),
  };
}

// ------------------------------------------------------------------ stavba

function generateSite(): World {
  const loc = LOCATIONS.stavba;
  const frame = frameFor('stavba');
  const rng = new Rng(loc.seed);
  const terrainNoise = new Noise2D(rng);
  const forestNoise = new Noise2D(rng);
  const { size, cell, plotRadius } = CONFIG.world;
  const half = size / 2;
  const R = LAYOUT.road;

  const raw = (x: number, z: number): number =>
    terrainNoise.fbm(x / 170, z / 170, 5) * 44 + terrainNoise.fbm(x / 23 + 91.7, z / 23 - 37.3, 3) * 1.4;
  const plotH = raw(0, 0);
  const roadH = (x: number): number => plotH - 0.25 + x * R.grade;
  const heightmap = Heightmap.generate(size, cell, (x, z) => {
    let h = raw(x, z);
    const wPlot = 1 - smoothstep(plotRadius, plotRadius + 35, Math.hypot(x, z));
    h = lerp(h, plotH + terrainNoise.noise(x / 7, z / 7) * 0.12, wPlot);
    const wRoad = (1 - smoothstep(R.halfWidth + 1, R.halfWidth + 12, Math.abs(z - R.z))) * (1 - smoothstep(R.xMax - 4, R.xMax + 14, Math.abs(x)));
    h = lerp(h, roadH(x), wRoad);
    const e = smoothstep(half * 0.76, half, Math.max(Math.abs(x), Math.abs(z)));
    return h + e * e * 32;
  });

  const c: Ctx = { rng, heightmap, frame, colliders: new ColliderSet(8), marks: [], clear: [{ x: 0, z: 0, r: plotRadius + 6 }] };
  const onGround = (x: number, z: number, lift: number): number => heightmap.heightAt(x, z) + lift;

  placeTB(c, '0321-014', (_x, z) => Math.abs(z - R.z) < 14);
  addMark(c, 'ZhB', '4021', 58, -2, onGround(58, -2, 0.08), 'Betonový hranol s křížkem', `Na louce asi 58 m ${directionWord(0, 0, 58, -2)} od středu staveniště. Hlava hranolu 8 cm nad terénem.`);
  addMark(c, 'PBPP', '4001', -26, 14, onGround(-26, 14, 0), 'Měřický hřeb s červeným kroužkem', 'Západní část staveniště, v udusané zemině. Kroužek barvy o průměru 20 cm.');
  addMark(
    c,
    'PBPP',
    '4002',
    30,
    22,
    onGround(30, 22, 0),
    'Měřický hřeb s červeným kroužkem',
    'Jihovýchodní část staveniště, poblíž okraje travnaté plochy.',
    'missing',
    'Hřeb chybí, v zemině zůstaly jen zbytky červené barvy. Nejspíš ho zničila technika.',
  );

  const P = LAYOUT.parcel;
  const corners = rectCorners(P);
  corners.forEach((p, i) => {
    const damaged = i === 2;
    addMark(
      c,
      'HZ',
      String(101 + i),
      p.x,
      p.z,
      onGround(p.x, p.z, 0.08),
      'Plastový mezník s červenou hlavou',
      `Lomový bod hranice parcely ${P.name}.`,
      damaged ? 'damaged' : 'ok',
      damaged ? 'Mezník je vyvrácený a nakloněný. Poloha hlavy už neodpovídá katalogu.' : undefined,
    );
  });

  // Trafostanice s nivelační značkou ve východní zdi.
  const B = LAYOUT.building;
  const building: BuildingInfo = { ...B, groundY: Infinity };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) building.groundY = Math.min(building.groundY, heightmap.heightAt(B.x + (sx * B.sizeX) / 2, B.z + (sz * B.sizeZ) / 2));
  c.colliders.add({
    kind: 'box',
    minX: B.x - B.sizeX / 2,
    maxX: B.x + B.sizeX / 2,
    minZ: B.z - B.sizeZ / 2,
    maxZ: B.z + B.sizeZ / 2,
    yMin: building.groundY - 1,
    yMax: building.groundY + B.height,
    tag: 'prop',
  });
  c.clear.push({ x: B.x, z: B.z, r: 9 });
  addMark(
    c,
    'NZ',
    'Ab7-12',
    B.x + B.sizeX / 2 + 0.03,
    B.z + 0.4,
    building.groundY + 0.55,
    'Hřebová nivelační značka ve zdi trafostanice',
    'Východní zeď trafostanice na severozápadním okraji staveniště, 0,55 m nad terénem. Výška platí pro vrchol hlavy hřebu.',
  );

  // Plot sousední zahrady.
  const F = LAYOUT.fence;
  const fence: FenceInfo = { posts: [], height: F.height };
  for (let x: number = F.xFrom; x <= F.xTo + 1e-6; x += F.spacing) fence.posts.push({ x, z: F.z, groundY: heightmap.heightAt(x, F.z) });
  for (let i = 0; i < fence.posts.length - 1; i++) {
    const a = fence.posts[i];
    const b = fence.posts[i + 1];
    c.colliders.add({
      kind: 'box',
      minX: a.x,
      maxX: b.x,
      minZ: F.z - 0.06,
      maxZ: F.z + 0.06,
      yMin: Math.min(a.groundY, b.groundY) - 1,
      yMax: Math.max(a.groundY, b.groundY) + F.height,
      tag: 'prop',
    });
  }

  const road: RoadInfo = {
    surface: 'asphalt',
    z: R.z,
    halfWidth: R.halfWidth,
    xMin: R.xMin,
    xMax: R.xMax,
    curbHeight: 0.12,
    curbWidth: 0.15,
    inlets: [
      { x: 12, z: R.z - R.halfWidth + 0.35 },
      { x: -46, z: R.z + R.halfWidth - 0.35 },
      { x: 58, z: R.z - R.halfWidth + 0.35 },
    ],
  };

  // Skutečné prvky polohopisu (pro kontrolu zakázky zaměření).
  const surf = (x: number, z: number): number => heightmap.heightAt(x, z) + 0.02;
  const features: FeatureInfo[] = [
    ...road.inlets.map((v, i) => ({ id: `vpust-${i + 1}`, code: 'VPUST' as const, label: `Uliční vpust ${i + 1}`, pos: { x: v.x, y: surf(v.x, v.z), z: v.z } })),
    ...[
      [-1, -1, 'SZ'],
      [1, -1, 'SV'],
      [1, 1, 'JV'],
      [-1, 1, 'JZ'],
    ].map(([sx, sz, n]) => {
      const x = B.x + ((sx as number) * B.sizeX) / 2;
      const z = B.z + ((sz as number) * B.sizeZ) / 2;
      return { id: `roh-${n}`, code: 'ROH_BUDOVY' as const, label: `Roh trafostanice ${n}`, pos: { x, y: heightmap.heightAt(x, z), z } };
    }),
    // Nový výškový bod: hřeb v severním obrubníku u vjezdu na staveniště (výšku zatím nikdo nezná).
    (() => {
      const x = 6;
      const z = R.z - R.halfWidth - 0.075;
      return { id: 'vb1', code: 'PEVNY_BOD' as const, label: 'Výškový bod VB1', pos: { x, y: heightmap.heightAt(x, z) + 0.12, z } };
    })(),
  ];

  const vehicle = vehicleAt(-14, R.z - 1.4, Math.PI / 2, heightmap);
  c.clear.push({ x: vehicle.x, z: vehicle.z, r: 12 });

  // Vesnice podél ulice, stavební technika na staveništi, sloupy vedení.
  const scenery: SceneryItem[] = [];
  const facades = [0xe8dcc0, 0xd9c7a3, 0xf0ece0, 0xc9d3c9, 0xe3c9a8, 0xd6d0c4];
  [-88, -64, -40, -16, 8, 32, 56, 80].forEach((x, i) =>
    place(c, scenery, 'house', x + rng.range(-3, 3), R.z + 15.5, rng.range(8.5, 11), rng.range(8, 9.5), rng.range(3.2, 5.8), {
      color: facades[i % facades.length],
      variant: i % 3,
    }),
  );
  place(c, scenery, 'house', -80, R.z - 17, 10, 9, 5.2, { color: 0xe6e0d0, variant: 1 });
  place(c, scenery, 'house', 80, R.z - 17, 9, 8.5, 3.4, { color: 0xd7c9ad, variant: 2 });
  place(c, scenery, 'siteOffice', 24, 31, 6, 2.5, 2.7, { color: 0xd8dde0 });
  place(c, scenery, 'toilet', 29, 31.4, 1.2, 1.2, 2.3, { color: 0x2f7d4f });
  place(c, scenery, 'excavator', 12, -30, 3, 2.6, 3.1, { color: PALETTE_SITE.excavator });
  place(c, scenery, 'soilPile', 32, -18, 9, 7, 2.6, { color: 0x6f5a3e });
  place(c, scenery, 'bricks', -6, 28, 1.2, 1, 1.05, { color: 0xb5553c });
  place(c, scenery, 'bricks', -4.4, 28.2, 1.2, 1, 1.05, { color: 0xb5553c });
  for (let x = -100; x <= 100; x += 33) {
    const z = R.z - R.halfWidth - 1.6;
    scenery.push({ kind: 'powerPole', x, z, yaw: 0, w: 0.3, d: 0.3, h: 9, groundY: heightmap.heightAt(x, z) });
    c.colliders.add({ kind: 'circle', x, z, r: 0.15, yMin: heightmap.heightAt(x, z) - 1, yMax: heightmap.heightAt(x, z) + 9, tag: 'trunk' });
  }

  const itemSpawns: ItemSpawn[] = [
    { kind: 'tripod', x: -16.2, z: 39.2, yaw: 0.1 },
    { kind: 'tsCase', x: -14.6, z: 39.4, yaw: -0.2 },
    { kind: 'prismPole', x: -12.6, z: 39.0, yaw: 0.05 },
    { kind: 'gnssRover', x: -12.4, z: 38.2, yaw: -0.08 },
    { kind: 'gnssCase', x: -13.4, z: 37.2, yaw: 0.15 },
    { kind: 'level', x: -10.6, z: 39.2, yaw: 0.2 },
    { kind: 'rod', x: -9.8, z: 38.0, yaw: 0.02 },
  ];

  const blocked = (x: number, z: number): boolean =>
    c.clear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) ||
    (Math.abs(z - R.z) < R.halfWidth + 7 && Math.abs(x) < R.xMax + 12) ||
    (Math.abs(z - F.z) < 3.5 && x > F.xFrom - 3 && x < F.xTo + 3);
  const trees = scatterTrees(c, forestNoise, blocked, (_x, _z, forest) => 0.03 + 0.92 * forest);

  const pipeLabels = ['Konec přípojky u domu', 'Lom přípojky 1', 'Lom přípojky 2', 'Napojení na řad (navrtávací pas)'];
  TRENCH.forEach((q, k) =>
    features.push({ id: `vodovod-${k + 1}`, code: 'VODOVOD', label: pipeLabels[k], pos: { x: q.x, y: heightmap.heightAt(q.x, q.z) + 0.04, z: q.z } }),
  );
  return new World({
    location: 'stavba',
    name: loc.name,
    frame,
    heightmap,
    colliders: c.colliders,
    trees,
    marks: c.marks,
    vehicle,
    road,
    building,
    fence,
    parcels: [{ name: P.name, corners }],
    features,
    flatRadius: plotRadius,
    scenery,
    water: [],
    fields: [],
    spawn: { x: -13.5, z: 34.8, yaw: Math.PI },
    itemSpawns,
    trench: TRENCH,
  });
}

// ------------------------------------------------------------------ louka

function generateMeadow(): World {
  const loc = LOCATIONS.louka;
  const frame = frameFor('louka');
  const rng = new Rng(loc.seed);
  const terrainNoise = new Noise2D(rng);
  const forestNoise = new Noise2D(rng);
  const { size, cell } = CONFIG.world;
  const half = size / 2;
  const R = MEADOW.road;

  // Mírně zvlněná krajina, polní cesta kopíruje podélný profil, napříč je vodorovná.
  const raw = (x: number, z: number): number =>
    terrainNoise.fbm(x / 210, z / 210, 5) * 30 + terrainNoise.fbm(x / 31 + 13.3, z / 31 + 4.1, 3) * 0.9;
  const POND = { x: -78, z: -28, rx: 13, rz: 8 };
  const heightmap = Heightmap.generate(size, cell, (x, z) => {
    let h = raw(x, z);
    const pd = ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2;
    h -= (1 - smoothstep(0.3, 1.35, pd)) * 1.7; // mísa rybníka
    const wRoad = 1 - smoothstep(R.halfWidth + 0.5, R.halfWidth + 6, Math.abs(z - R.z));
    h = lerp(h, raw(x, R.z) - 0.08, wRoad);
    const e = smoothstep(half * 0.78, half, Math.max(Math.abs(x), Math.abs(z)));
    return h + e * e * 26;
  });

  const P = MEADOW.parcel;
  const c: Ctx = { rng, heightmap, frame, colliders: new ColliderSet(8), marks: [], clear: [{ x: P.x, z: P.z, r: 55 }] };
  const onGround = (x: number, z: number, lift: number): number => heightmap.heightAt(x, z) + lift;

  placeTB(c, '0418-022', (x, z) => Math.abs(z - R.z) < 12 || Math.hypot(x - P.x, z - P.z) < 70);
  addMark(c, 'PBPP', '5101', -64, R.z - 4, onGround(-64, R.z - 4, 0.05), 'Plastový znak s kovovou hlavou', 'U polní cesty, 4 m severně od její osy, na okraji louky.');
  addMark(c, 'PBPP', '5102', 42, R.z - 5, onGround(42, R.z - 5, 0.05), 'Plastový znak s kovovou hlavou', 'U polní cesty naproti rozcestí, v travnatém pruhu.');

  // Pozemek 812/5: dochovány dva hraniční znaky (lomy 1 a 2), zbylé dva se vytyčují.
  const corners = rectCorners(P);
  corners.slice(0, 2).forEach((p, i) =>
    addMark(
      c,
      'HZ',
      String(301 + i),
      p.x,
      p.z,
      onGround(p.x, p.z, 0.06),
      'Kamenný hraniční znak s křížkem',
      `Lomový bod hranice pozemku ${P.name}, dochovaný. Zarostlý trávou.`,
    ),
  );

  // Meze: stromořadí listnáčů podél hranic polí.
  const hedgeTrees: TreeInstance[] = [];
  for (const hd of MEADOW.hedges) {
    const len = Math.hypot(hd.x1 - hd.x0, hd.z1 - hd.z0);
    for (let d = 0; d < len; d += rng.range(5, 9)) {
      const t = d / len;
      const x = lerp(hd.x0, hd.x1, t) + rng.range(-1, 1);
      const z = lerp(hd.z0, hd.z1, t) + rng.range(-1, 1);
      hedgeTrees.push(makeTree(rng, x, z, heightmap.heightAt(x, z), rng.next() < 0.15));
    }
  }

  const vehicle = vehicleAt(-92, R.z, -Math.PI / 2, heightmap); // na polní cestě čelem na východ
  c.clear.push({ x: vehicle.x, z: vehicle.z, r: 10 });

  // Rybník: hladina kousek pod nejnižším místem břehu.
  let rim = Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.2) rim = Math.min(rim, heightmap.heightAt(POND.x + Math.cos(a) * POND.rx * 1.05, POND.z + Math.sin(a) * POND.rz * 1.05));
  const water: WaterInfo[] = [{ ...POND, level: rim - 0.2 }];
  c.clear.push({ x: POND.x, z: POND.z, r: POND.rx + 3 });

  const scenery: SceneryItem[] = [];
  for (const [x, z] of [
    [12, 22],
    [15.5, 24.5],
    [21, 21.5],
    [28, 23.5],
    [33, 20.5],
  ])
    place(c, scenery, 'hayBale', x, z, 1.5, 1.4, 1.45, { yaw: rng.range(0, 1) > 0.5 ? Math.PI / 2 : 0, color: 0xc9b26a, clear: 1 });
  const shed = place(c, scenery, 'shed', -40, 48, 6, 4, 3, { color: 0x8b6a45 });
  addMark(
    c,
    'NZ',
    'Kn-15',
    shed.x + shed.w / 2 + 0.03,
    shed.z + 0.6,
    shed.groundY + 0.5,
    'Hřebová nivelační značka ve zdi kůlny',
    'Východní zeď polní kůlny u cesty, 0,5 m nad terénem. Výška platí pro vrchol hlavy hřebu.',
  );
  // Výškový bod VB2: betonový patník na hrázi rybníka.
  const vb2x = POND.x + POND.rx * 1.3;
  const vb2z = POND.z;
  const vb2y = heightmap.heightAt(vb2x, vb2z) + 0.15;
  scenery.push({ kind: 'post', x: vb2x, z: vb2z, yaw: 0, w: 0.16, d: 0.16, h: 0.15, groundY: heightmap.heightAt(vb2x, vb2z) });
  const features: FeatureInfo[] = [
    { id: 'vb2', code: 'PEVNY_BOD', label: 'Výškový bod VB2 (hráz)', pos: { x: vb2x, y: vb2y, z: vb2z } },
    // Rohy polní kůlny (osově zarovnaná, w podél x, d podél z).
    ...(
      [
        [-1, -1, 'SZ'],
        [1, -1, 'SV'],
        [1, 1, 'JV'],
        [-1, 1, 'JZ'],
      ] as const
    ).map(([sx, sz, n]) => {
      const x = shed.x + (sx * shed.w) / 2;
      const z = shed.z + (sz * shed.d) / 2;
      return { id: `kulna-${n}`, code: 'ROH_BUDOVY' as const, label: `Roh kůlny ${n}`, pos: { x, y: heightmap.heightAt(x, z), z } };
    }),
  ];
  // Hraniční kameny na mezi pod stromořadím (pod korunami GNSS nedá FIX – měří se stanicí).
  // Východní mez u bodu 5102: kámen vždy u kmene, pod korunou, ale se záměrou na stanovisko.
  const eastHedge = hedgeTrees.filter((q) => q.x > 65 && q.x < 90);
  (
    [
      [9.5, -1.5, 2.5],
      [0.6, 1, -2.5],
      [-6.5, 0, 2.5],
    ] as const
  ).forEach(([tz, dx, dz], i) => {
    const t = eastHedge.reduce((b, q) => (Math.abs(q.z - tz) < Math.abs(b.z - tz) ? q : b), eastHedge[0]);
    const x = t.x + dx;
    const z = t.z + dz;
    const gy = heightmap.heightAt(x, z);
    scenery.push({ kind: 'post', x, z, yaw: 0.3 * i, w: 0.18, d: 0.14, h: 0.08, groundY: gy, color: 0x8f8d88 });
    features.push({ id: `mez-${i + 1}`, code: 'HRANICE', label: `Hraniční kámen na mezi ${i + 1}`, pos: { x, y: gy + 0.08, z } });
  });
  const fields: FieldInfo[] = [
    { crop: 'wheat', corners: [ { x: -200, z: -72 }, { x: 62, z: -76 }, { x: 62, z: -200 }, { x: -200, z: -200 } ] },
    { crop: 'plowed', corners: [ { x: 82, z: -150 }, { x: 200, z: -150 }, { x: 200, z: 18 }, { x: 82, z: 18 } ] },
    { crop: 'rapeseed', corners: [ { x: -200, z: 44 }, { x: -60, z: 44 }, { x: -60, z: 200 }, { x: -200, z: 200 } ] },
  ];

  const blocked = (x: number, z: number): boolean =>
    c.clear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) ||
    (Math.abs(z - R.z) < R.halfWidth + 5 && Math.abs(x) < R.xMax + 10) ||
    fields.some((f) => inPolygon(x, z, f.corners));
  // Louka je hlavně otevřená; les jen v okrajových remízcích.
  const trees = scatterTrees(
    c,
    forestNoise,
    blocked,
    (x, z, forest) => (Math.hypot(x - P.x, z - P.z) < 110 ? 0.004 : 0.01 + 0.85 * forest * smoothstep(0.1, 0.5, forest)),
    hedgeTrees,
  );

  return new World({
    location: 'louka',
    name: loc.name,
    frame,
    heightmap,
    colliders: c.colliders,
    trees,
    marks: c.marks,
    vehicle,
    road: { surface: 'dirt', z: R.z, halfWidth: R.halfWidth, xMin: R.xMin, xMax: R.xMax, curbHeight: 0, curbWidth: 0, inlets: [] },
    building: null,
    fence: null,
    parcels: [{ name: P.name, corners }],
    features,
    flatRadius: 0,
    scenery,
    water,
    fields,
    spawn: { x: vehicle.x + 2, z: vehicle.z - 3, yaw: 0 },
    itemSpawns: [],
  });
}

// ------------------------------------------------------------------ les

function generateForest(): World {
  const loc = LOCATIONS.les;
  const frame = frameFor('les');
  const rng = new Rng(loc.seed);
  const terrainNoise = new Noise2D(rng);
  const forestNoise = new Noise2D(rng);
  const { size, cell } = CONFIG.world;
  const half = size / 2;
  const R = FOREST.road;

  // Údolí mírně stoupá k východu; cesta má hladký podélný sklon, aby byla podél ní vidět stanicí.
  const raw = (x: number, z: number): number => terrainNoise.fbm(x / 180, z / 180, 5) * 22 + terrainNoise.fbm(x / 29 + 7.7, z / 29 - 3.1, 3) * 0.8;
  const roadH = (x: number): number => raw(-60, R.z) + (x + 60) * 0.018;
  const heightmap = Heightmap.generate(size, cell, (x, z) => {
    let h = raw(x, z) + Math.abs(z) * 0.04; // svahy údolí
    const wRoad = 1 - smoothstep(R.halfWidth + 2, R.halfWidth + 16, Math.abs(z - R.z));
    h = lerp(h, roadH(x) + Math.abs(z - R.z) * 0.012, wRoad);
    const e = smoothstep(half * 0.78, half, Math.max(Math.abs(x), Math.abs(z)));
    return h + e * e * 28;
  });

  const c: Ctx = { rng, heightmap, frame, colliders: new ColliderSet(8), marks: [], clear: [] };
  const onGround = (x: number, z: number, lift: number): number => heightmap.heightAt(x, z) + lift;
  const inForest = (x: number): boolean => x > FOREST.edgeX;

  placeTB(c, '0311-041', (x, z) => inForest(x + 25) || Math.abs(z - R.z) < 15);
  addMark(c, 'PBPP', '6101', -126, R.z - 5, onGround(-126, R.z - 5, 0.05), 'Plastový znak s kovovou hlavou', 'U lesní cesty na louce, 5 m severně od její osy, u závory.');

  const scenery: SceneryItem[] = [];
  const features: FeatureInfo[] = [];
  // Propustek pod cestou: dvě betonová čela, měří se dno trouby před čelem.
  for (const side of [-1, 1] as const) {
    const z = R.z + side * (R.halfWidth + 1.1);
    place(c, scenery, 'culvert', FOREST.culvertX, z, 1.6, 0.3, 0.55, { yaw: side > 0 ? 0 : Math.PI, clear: 0.2 });
    const fz = z + side * 0.4;
    features.push({
      id: side < 0 ? 'propustek-vtok' : 'propustek-vytok',
      code: 'PROPUSTEK',
      label: side < 0 ? 'Vtok propustku' : 'Výtok propustku',
      pos: { x: FOREST.culvertX, y: heightmap.heightAt(FOREST.culvertX, fz), z: fz },
    });
  }
  // Hraniční kámen lesního pozemku na kraji cesty.
  {
    const x = FOREST.stoneX;
    const z = R.z + R.halfWidth + 1.4;
    const gy = heightmap.heightAt(x, z);
    scenery.push({ kind: 'post', x, z, yaw: 0.2, w: 0.2, d: 0.16, h: 0.12, groundY: gy, color: 0x8f8d88 });
    features.push({ id: 'les-hranice', code: 'HRANICE', label: 'Hraniční kámen u cesty', pos: { x, y: gy + 0.12, z } });
  }
  // Lesní cesta: dvě řady stromů těsně u cesty, koruny ji zastíní.
  const rows: TreeInstance[] = [];
  const oakZ = R.z - (R.halfWidth + 1.6);
  const oak: TreeInstance = { ...makeTree(rng, FOREST.oakX, oakZ, heightmap.heightAt(FOREST.oakX, oakZ), false), height: 17, trunkR: 0.55, crownR: 5.2, crownBase: 3.6 };
  rows.push(oak);
  features.push({ id: 'les-dub', code: 'STROM', label: 'Památný dub (pata kmene u cesty)', pos: { x: oak.x, y: oak.groundY, z: oak.z + oak.trunkR + 0.05 } });
  for (const side of [-1, 1]) {
    for (const band of [
      [R.halfWidth + 1.4, R.halfWidth + 3],
      [R.halfWidth + 5, R.halfWidth + 8],
    ]) {
      for (let x = FOREST.edgeX + rng.range(0, 3); x < half - 10; x += rng.range(3.2, 5)) {
        const z = R.z + side * rng.range(band[0], band[1]);
        if ((side < 0 && Math.abs(x - FOREST.lane.x) < FOREST.lane.half + 0.6) || Math.abs(x - FOREST.culvertX) < 2.2 || Math.hypot(x - oak.x, z - oak.z) < 6 || Math.hypot(x - FOREST.stoneX, z - (R.z + R.halfWidth + 1.4)) < 3.5) continue;
        rows.push(makeTree(rng, x, z, heightmap.heightAt(x, z), rng.next() < 0.75));
      }
    }
  }
  // Studánka na konci průseku a hraniční kámen za ní.
  {
    const S = FOREST.spring;
    const gy = heightmap.heightAt(S.x, S.z);
    scenery.push({ kind: 'well', x: S.x, z: S.z, yaw: 0, w: 1.3, d: 1.3, h: 0.35, groundY: gy });
    c.clear.push({ x: S.x, z: S.z, r: 2.2 });
    features.push({ id: 'les-studanka', code: 'STUDANKA', label: 'Studánka (střed obruby)', pos: { x: S.x, y: gy, z: S.z } });
    const kx = FOREST.lane.x - 0.8;
    const kz = FOREST.lane.zEnd + 2;
    const ky = heightmap.heightAt(kx, kz);
    scenery.push({ kind: 'post', x: kx, z: kz, yaw: -0.3, w: 0.2, d: 0.16, h: 0.1, groundY: ky, color: 0x8f8d88 });
    features.push({ id: 'les-hranice-2', code: 'HRANICE', label: 'Hraniční kámen v průseku', pos: { x: kx, y: ky + 0.1, z: kz } });
  }
  // Hustá smrčina jižně od cesty: z louky do průseku není vidět, u studánky není FIX.
  for (let x = FOREST.edgeX + 6; x < 120; x += rng.range(3.4, 4.6)) {
    for (let z = -(R.halfWidth + 10); z > FOREST.lane.zEnd - 14; z -= rng.range(3.4, 4.6)) {
      const tx = x + rng.range(-1, 1);
      const tz = z + rng.range(-1, 1);
      if (Math.abs(tx - FOREST.lane.x) < FOREST.lane.half + 0.9 && tz > FOREST.lane.zEnd - 1) continue;
      if (Math.hypot(tx - FOREST.spring.x, tz - FOREST.spring.z) < 3) continue;
      if (Math.hypot(tx - oak.x, tz - oak.z) < 6) continue;
      rows.push(makeTree(rng, tx, tz, heightmap.heightAt(tx, tz), rng.next() < 0.85));
    }
  }
  place(c, scenery, 'sign', FOREST.edgeX - 4, R.z + R.halfWidth + 2.2, 1.2, 0.1, 2, { color: 0x2f5d3a, text: 'LESY OBCE HRUŠOV', clear: 1 });

  const vehicle = vehicleAt(-150, R.z - 1.3, -Math.PI / 2, heightmap); // na cestě na louce čelem k lesu
  c.clear.push({ x: vehicle.x, z: vehicle.z, r: 10 });
  const blocked = (x: number, z: number): boolean =>
    c.clear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) ||
    Math.abs(z - R.z) < R.halfWidth + 9 ||
    (Math.abs(x - FOREST.lane.x) < FOREST.lane.half + 1.2 && z < R.z && z > FOREST.lane.zEnd - 3);
  const trees = scatterTrees(
    c,
    forestNoise,
    blocked,
    (x, _z, forest) => (inForest(x) ? 0.75 + 0.25 * forest : 0.004 + 0.02 * forest),
    rows,
    2600,
  );

  return new World({
    location: 'les',
    name: loc.name,
    frame,
    heightmap,
    colliders: c.colliders,
    trees,
    marks: c.marks,
    vehicle,
    road: { surface: 'dirt', z: R.z, halfWidth: R.halfWidth, xMin: R.xMin, xMax: R.xMax, curbHeight: 0, curbWidth: 0, inlets: [] },
    building: null,
    fence: null,
    parcels: [],
    features,
    flatRadius: 0,
    scenery,
    water: [],
    fields: [],
    spawn: { x: vehicle.x + 2, z: vehicle.z - 3, yaw: 0 },
    itemSpawns: [],
  });
}

// ------------------------------------------------------------------ krajina se silnicemi

/** Silnice krajiny: z křižovatky u Kněžívky ke kanceláři, stavbě, louce a lesu. */
export const REGION = {
  size: 1536,
  cell: 4,
  roads: [
    { to: 'kancelar' as const, label: 'Brandýs – Geoměření', pts: [[0, 0], [-90, 20], [-220, 70], [-380, 40], [-560, 90], [-730, 60]] },
    { to: 'stavba' as const, label: 'Nová Ves', pts: [[0, 0], [30, -120], [-40, -260], [-10, -420], [-90, -580], [-60, -730]] },
    { to: 'louka' as const, label: 'Kněžívka – louka', pts: [[0, 0], [140, -20], [300, 40], [460, -10], [600, 30], [730, 10]] },
    { to: 'les' as const, label: 'Hrušov – lesy', pts: [[0, 0], [-30, 150], [40, 300], [-20, 460], [60, 600], [30, 730]] },
  ],
  halfWidth: 3.1,
};

/** Hladká křivka (Catmull-Rom) přes řídicí body, vzorkovaná po `step` metrech. */
function smoothPath(ctrl: readonly (readonly number[])[], step: number): { x: number; z: number }[] {
  const P = ctrl.map(([x, z]) => ({ x, z }));
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...P[P.length - 1] });
  return out;
}

function generateRegion(): World {
  const loc = LOCATIONS.kraj;
  const frame = frameFor('kraj');
  const rng = new Rng(loc.seed);
  const terrainNoise = new Noise2D(rng);
  const forestNoise = new Noise2D(rng);
  const { size, cell } = REGION;
  const half = size / 2;
  const n = Math.round(size / cell) + 1;
  const raw = (x: number, z: number): number => terrainNoise.fbm(x / 420, z / 420, 5) * 34 + terrainNoise.fbm(x / 60 + 3.3, z / 60 - 1.1, 3) * 1.4;

  // Osy silnic a výška vozovky: terén pod osou vyhlazený klouzavým průměrem (mírné stoupání).
  const lanes: Lane[] = REGION.roads.map((r) => {
    const pts = smoothPath(r.pts, 4);
    const h = pts.map((p) => raw(p.x, p.z));
    const win = 30;
    const ys = h.map((_, i) => {
      let sum = 0;
      let cnt = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(h.length - 1, i + win); k++) {
        sum += h[k];
        cnt++;
      }
      return sum / cnt;
    });
    return { pts: pts.map((p, i) => ({ x: p.x, z: p.z, y: ys[i] })), halfWidth: REGION.halfWidth };
  });
  // Křižovatka: všechny větve začínají ve stejné výšce.
  const y0 = lanes.reduce((a, l) => a + l.pts[0].y, 0) / lanes.length;
  for (const l of lanes) {
    const pts = l.pts as { x: number; z: number; y: number }[];
    for (let i = 0; i < Math.min(40, pts.length); i++) pts[i].y = y0 + (pts[i].y - y0) * (i / 40);
  }

  // Terén: surový, u silnic srovnaný na výšku vozovky (razítko vzdálenosti po buňkách).
  const heights = new Float32Array(n * n);
  const dist = new Float32Array(n * n).fill(1e9);
  const roadY = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) heights[iz * n + ix] = raw(-half + ix * cell, -half + iz * cell);
  const R = 20;
  for (const l of lanes)
    for (let k = 0; k + 1 < l.pts.length; k++) {
      const a = l.pts[k];
      const b = l.pts[k + 1];
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R + half) / cell));
      const i1 = Math.min(n - 1, Math.ceil((Math.max(a.x, b.x) + R + half) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - R + half) / cell));
      const j1 = Math.min(n - 1, Math.ceil((Math.max(a.z, b.z) + R + half) / cell));
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const vv = vx * vx + vz * vz || 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = -half + i * cell;
          const z = -half + j * cell;
          const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / vv));
          const d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
          const q = j * n + i;
          if (d < dist[q]) {
            dist[q] = d;
            roadY[q] = a.y + (b.y - a.y) * t;
          }
        }
    }
  for (let q = 0; q < n * n; q++) {
    const w = 1 - smoothstep(REGION.halfWidth + 2, REGION.halfWidth + 17, dist[q]);
    const ix = q % n;
    const iz = Math.floor(q / n);
    const e = smoothstep(half * 0.9, half, Math.max(Math.abs(-half + ix * cell), Math.abs(-half + iz * cell)));
    heights[q] += e * e * 30; // val na okraji mapy (u silnice ho srovná vozovka níž)
    if (w > 0) heights[q] = lerp(heights[q], roadY[q] - 0.05, w);
  }
  const heightmap = new Heightmap(size, cell, heights);

  const c: Ctx = { rng, heightmap, frame, colliders: new ColliderSet(16), marks: [], clear: [] };
  const scenery: SceneryItem[] = [];
  const nearRoad = (x: number, z: number, m: number): boolean => {
    const i = Math.round((x + half) / cell);
    const j = Math.round((z + half) / cell);
    return i >= 0 && j >= 0 && i < n && j < n && dist[j * n + i] < m;
  };

  // Výjezdy do lokalit na koncích silnic + cedule obce.
  const exits: RegionExit[] = REGION.roads.map((r, k) => {
    const pts = lanes[k].pts;
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 6];
    return { location: r.to, x: end.x, z: end.z, yaw: Math.atan2(end.x - prev.x, end.z - prev.z), r: 24, label: r.label };
  });
  REGION.roads.forEach((r, k) => {
    const pts = lanes[k].pts;
    // Směrovka u křižovatky a cedule před výjezdem.
    for (const [idx, text] of [
      [12, `→ ${r.label}`],
      [pts.length - 14, r.label.toUpperCase()],
    ] as const) {
      const p = pts[idx];
      const q = pts[idx + 1];
      const nx = -(q.z - p.z);
      const nz = q.x - p.x;
      const l = Math.hypot(nx, nz) || 1;
      const x = p.x + (nx / l) * (REGION.halfWidth + 2.2);
      const z = p.z + (nz / l) * (REGION.halfWidth + 2.2);
      place(c, scenery, 'sign', x, z, 1.8, 0.1, 2.3, { color: 0x1f4e79, text, clear: 1, yaw: Math.round(Math.atan2(q.x - p.x, q.z - p.z) / (Math.PI / 2)) * (Math.PI / 2) });
    }
  });
  // Vesnička u křižovatky.
  for (let k = 0; k < 9; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(28, 70);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (nearRoad(x, z, 13)) continue;
    place(c, scenery, 'house', x, z, rng.range(8, 11), rng.range(7.5, 9.5), rng.range(3.2, 5.6), {
      yaw: rng.next() < 0.5 ? 0 : Math.PI / 2,
      color: [0xe6e0d0, 0xd7c9ad, 0xefe8da, 0xcfd5d8][k % 4],
      variant: k % 3,
    });
  }
  // Sloupy vedení podél silnice ke kanceláři.
  {
    const pts = lanes[0].pts;
    for (let i = 10; i < pts.length - 5; i += 10) {
      const p = pts[i];
      const q = pts[i + 1];
      const nx = -(q.z - p.z);
      const nz = q.x - p.x;
      const l = Math.hypot(nx, nz) || 1;
      const x = p.x - (nx / l) * (REGION.halfWidth + 5);
      const z = p.z - (nz / l) * (REGION.halfWidth + 5);
      const gy = heightmap.heightAt(x, z);
      scenery.push({ kind: 'powerPole', x, z, yaw: 0, w: 0.3, d: 0.3, h: 9, groundY: gy });
      c.colliders.add({ kind: 'circle', x, z, r: 0.15, yMin: gy - 1, yMax: gy + 9, tag: 'trunk' });
    }
  }
  const fields: FieldInfo[] = [
    { crop: 'wheat', corners: [ { x: -600, z: -300 }, { x: -260, z: -320 }, { x: -240, z: -60 }, { x: -620, z: -40 } ] },
    { crop: 'rapeseed', corners: [ { x: 160, z: -380 }, { x: 520, z: -400 }, { x: 540, z: -120 }, { x: 180, z: -100 } ] },
    { crop: 'plowed', corners: [ { x: 140, z: 160 }, { x: 560, z: 180 }, { x: 540, z: 460 }, { x: 160, z: 440 } ] },
    { crop: 'wheat', corners: [ { x: -560, z: 240 }, { x: -220, z: 220 }, { x: -200, z: 540 }, { x: -600, z: 560 } ] },
  ];
  const first = exits[0];
  const vehicle = vehicleAt(first.x + Math.sin(first.yaw + Math.PI) * 30, first.z + Math.cos(first.yaw + Math.PI) * 30, first.yaw, heightmap);
  const blocked = (x: number, z: number): boolean =>
    nearRoad(x, z, 11) || c.clear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) || fields.some((f) => inPolygon(x, z, f.corners)) || Math.hypot(x, z) < 90;
  const trees = scatterTrees(c, forestNoise, blocked, (_x, _z, forest) => 0.03 + 0.9 * forest * forest, [], 2200);

  return new World({
    location: 'kraj',
    name: loc.name,
    frame,
    heightmap,
    colliders: c.colliders,
    trees,
    marks: [],
    vehicle,
    road: { surface: 'asphalt', z: 1e6, halfWidth: 0, xMin: 0, xMax: 0, curbHeight: 0, curbWidth: 0, inlets: [] },
    building: null,
    fence: null,
    parcels: [],
    features: [],
    flatRadius: 0,
    scenery,
    water: [],
    fields,
    spawn: { x: vehicle.x + 3, z: vehicle.z, yaw: 0 },
    itemSpawns: [],
    lanes,
    exits,
  });
}

// ------------------------------------------------------------------ kancelář

/** Dvůr geodetické kanceláře: budova s nástěnkou zakázek, sklad s vybavením, parkoviště. */
function generateOffice(): World {
  const loc = LOCATIONS.kancelar;
  const frame = frameFor('kancelar');
  const rng = new Rng(loc.seed);
  const terrainNoise = new Noise2D(rng);
  const forestNoise = new Noise2D(rng);
  const { size, cell } = CONFIG.world;
  const half = size / 2;
  const RZ = 32;
  const raw = (x: number, z: number): number => terrainNoise.fbm(x / 190, z / 190, 5) * 16 + terrainNoise.fbm(x / 27, z / 27, 3) * 0.7;
  const yardH = raw(0, 0);
  const heightmap = Heightmap.generate(size, cell, (x, z) => {
    let h = raw(x, z);
    h = lerp(h, yardH, 1 - smoothstep(34, 60, Math.hypot(x, z * 1.2)));
    const wRoad = (1 - smoothstep(4, 14, Math.abs(z - RZ))) * (1 - smoothstep(110, 126, Math.abs(x)));
    h = lerp(h, yardH - 0.2 + x * 0.006, wRoad);
    const e = smoothstep(half * 0.78, half, Math.max(Math.abs(x), Math.abs(z)));
    return h + e * e * 24;
  });
  const c: Ctx = { rng, heightmap, frame, colliders: new ColliderSet(8), marks: [], clear: [{ x: 0, z: 0, r: 34 }] };
  const scenery: SceneryItem[] = [];
  place(c, scenery, 'office', -14, -16, 16, 10, 6.4, { color: 0xece6d8, text: 'GEOMĚŘENÍ s.r.o.' });
  place(c, scenery, 'board', -14, -10.3, 2.6, 0.3, 2.1, { color: 0x3b4a57 });
  // Sklad: otevřený k jihu, kolize jen stěny, uvnitř regály.
  const G = { x: 12, z: -12, w: 10, d: 8, h: 3.8 };
  place(c, scenery, 'garage', G.x, G.z, G.w, G.d, G.h, { color: 0xc9cdd1, solid: false });
  const gy = heightmap.heightAt(G.x, G.z);
  const wall = (minX: number, maxX: number, minZ: number, maxZ: number): void =>
    c.colliders.add({ kind: 'box', minX, maxX, minZ, maxZ, yMin: gy - 1, yMax: gy + G.h, tag: 'prop' });
  wall(G.x - G.w / 2, G.x + G.w / 2, G.z - G.d / 2, G.z - G.d / 2 + 0.25);
  wall(G.x - G.w / 2, G.x - G.w / 2 + 0.25, G.z - G.d / 2, G.z + G.d / 2);
  wall(G.x + G.w / 2 - 0.25, G.x + G.w / 2, G.z - G.d / 2, G.z + G.d / 2);
  place(c, scenery, 'shelf', G.x, G.z - G.d / 2 + 0.65, 8.6, 0.6, 2.2, { color: 0x6d7479, clear: 0 });
  place(c, scenery, 'car', -2, -2, 4.3, 1.8, 1.45, { color: 0x8a1f24 });
  place(c, scenery, 'car', 4, -2.5, 4.3, 1.8, 1.45, { color: 0x3a5f8a });
  place(c, scenery, 'bench', -22, -8.5, 2, 0.6, 0.9, { color: 0x8b6a45, solid: false });
  for (const x of [-110, -70, -30, 10, 50, 90]) {
    const z = RZ - 4.6;
    scenery.push({ kind: 'powerPole', x, z, yaw: 0, w: 0.3, d: 0.3, h: 9, groundY: heightmap.heightAt(x, z) });
    c.colliders.add({ kind: 'circle', x, z, r: 0.15, yMin: heightmap.heightAt(x, z) - 1, yMax: heightmap.heightAt(x, z) + 9, tag: 'trunk' });
  }
  const vehicle = vehicleAt(-6, 12, -Math.PI / 2, heightmap); // na parkovišti čelem k výjezdu
  const road: RoadInfo = { surface: 'asphalt', z: RZ, halfWidth: 3, xMin: -126, xMax: 126, curbHeight: 0.12, curbWidth: 0.15, inlets: [{ x: 20, z: RZ - 2.65 }] };
  const blocked = (x: number, z: number): boolean =>
    c.clear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) || (Math.abs(z - RZ) < 10 && Math.abs(x) < 130) || Math.hypot(x, z * 1.2) < 42;
  const trees = scatterTrees(c, forestNoise, blocked, (_x, _z, forest) => 0.02 + 0.8 * forest);
  const itemSpawns: ItemSpawn[] = [
    { kind: 'tripod', x: 9.4, z: -13.9, yaw: 0 },
    { kind: 'tsCase', x: 12.2, z: -13.9, yaw: 0 },
    { kind: 'level', x: 14.8, z: -13.7, yaw: 0 },
    { kind: 'rod', x: 11.4, z: -11.9, yaw: 0 },
    { kind: 'prismPole', x: 11.8, z: -10.8, yaw: 0 },
    { kind: 'gnssRover', x: 11.8, z: -9.7, yaw: 0 },
    { kind: 'gnssCase', x: 14.8, z: -11.6, yaw: 0 },
  ];
  return new World({
    location: 'kancelar',
    name: loc.name,
    frame,
    heightmap,
    colliders: c.colliders,
    trees,
    marks: [],
    vehicle,
    road,
    building: null,
    fence: null,
    parcels: [],
    features: [],
    flatRadius: 36,
    scenery,
    water: [],
    fields: [],
    spawn: { x: -14, z: -8.4, yaw: 0 },
    itemSpawns,
  });
}
