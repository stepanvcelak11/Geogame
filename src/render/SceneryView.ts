import * as THREE from 'three';
import type { SceneryItem, World } from '../world/World';
import { inPolygon } from '../world/WorldGen';
import { lambert, matte, PALETTE, type MatteMaterial } from './materials';
import { canvasTexture, signTexture } from './textures';

const texMat = new Map<string, MatteMaterial>();
const texRep = new Map<string, THREE.Texture | null>();
/** Materiál s procedurální texturou (sdílený podle klíče; textura sdílená podle vzoru a opakování). */
function tmat(name: Parameters<typeof canvasTexture>[0], color: number, repeat: [number, number] = [1, 1]): MatteMaterial {
  const key = `${name}:${color}:${repeat.join('x')}`;
  let m = texMat.get(key);
  if (!m) {
    const tk = `${name}:${repeat.join('x')}`;
    let t = texRep.get(tk);
    if (t === undefined) {
      const base = canvasTexture(name, 256);
      t = base ? base.clone() : null;
      if (t) {
        t.repeat.set(repeat[0], repeat[1]);
        t.needsUpdate = true;
      }
      texRep.set(tk, t);
    }
    m = matte({ color, map: t ?? undefined });
    texMat.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Sedlová střecha s hřebenem podél osy x; štíty jako trojúhelníky. */
function gableRoof(w: number, d: number, wallH: number, roofH: number, roofMat: THREE.Material, gableMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const half = d / 2 + 0.35;
  const slope = Math.hypot(half, roofH);
  const a = Math.atan2(roofH, half);
  for (const side of [-1, 1]) {
    const plane = box(w + 0.6, 0.12, slope, roofMat);
    plane.position.set(0, wallH + roofH / 2, (side * half) / 2);
    plane.rotation.x = side * a;
    g.add(plane);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0);
  tri.lineTo(d / 2, 0);
  tri.lineTo(0, roofH);
  tri.closePath();
  const tg = new THREE.ShapeGeometry(tri).rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const gm = new THREE.Mesh(tg, gableMat);
    gm.material = gableMat;
    gm.position.set((sx * w) / 2, wallH, 0);
    if (sx < 0) gm.rotation.y = Math.PI;
    g.add(gm);
  }
  return g;
}

function house(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const wallCol = s.color ?? 0xe8dcc0;
  const floors = s.h > 4.2 ? 2 : 1;
  g.add(box(s.w + 0.1, 0.8, s.d + 0.1, lambert(0x8e8a82, 'plinth'), 0, -0.2, 0));
  g.add(box(s.w, s.h, s.d, tmat('windows', wallCol, [Math.max(1, Math.round(s.w / 4)), floors]), 0, s.h / 2, 0));
  const roofCol = s.variant === 1 ? 0x3c4046 : s.variant === 2 ? 0x6d3a2a : 0x9a4630;
  g.add(gableRoof(s.w, s.d, s.h, 2.6 + (s.variant ?? 0) * 0.3, tmat('tiles', roofCol, [3, 1]), tmat('plaster', wallCol)));
  g.add(box(0.7, 1.4, 0.7, lambert(0x8a5a44, 'chimney'), s.w * 0.25, s.h + 2.3, s.d * 0.12));
  g.add(box(1.1, 2.1, 0.08, lambert(0x5a3b28, 'door'), -s.w * 0.2, 1.05, -s.d / 2 - 0.03));
  return g;
}

function office(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s.w, s.h, s.d, tmat('windows', s.color ?? 0xece6d8, [4, 2]), 0, s.h / 2, 0));
  g.add(box(s.w + 0.4, 0.4, s.d + 0.4, lambert(0x6b6f73, 'parapet'), 0, s.h + 0.2, 0));
  // Vchod k jihu (+z) se stříškou a cedulí.
  g.add(box(2.2, 2.4, 0.1, lambert(0x2f3a42, 'glassdoor'), 0, 1.2, s.d / 2 + 0.05));
  g.add(box(3.4, 0.15, 1.6, lambert(0x3a4148, 'canopy'), 0, 2.8, s.d / 2 + 0.8));
  const t = signTexture(s.text ?? 'KANCELÁŘ');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), matte({ color: 0xffffff, map: t ?? undefined }));
  sign.position.set(0, s.h - 1.0, s.d / 2 + 0.06);
  g.add(sign);
  return g;
}

function garage(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const wall = tmat('metal', s.color ?? 0xc9cdd1, [4, 1]);
  g.add(box(s.w, 0.1, s.d, lambert(PALETTE.concrete, 'floor'), 0, 0.05, 0));
  g.add(box(s.w, s.h, 0.25, wall, 0, s.h / 2, -s.d / 2 + 0.125));
  g.add(box(0.25, s.h, s.d, wall, -s.w / 2 + 0.125, s.h / 2, 0));
  g.add(box(0.25, s.h, s.d, wall, s.w / 2 - 0.125, s.h / 2, 0));
  g.add(box(s.w + 0.4, 0.15, s.d + 0.6, tmat('metal', 0x8d9296, [6, 1]), 0, s.h + 0.05, 0.1));
  const lamp = box(0.6, 0.06, 0.2, matte({ color: 0xffffff, emissive: 0xfff2c0 }), 0, s.h - 0.1, 0);
  g.add(lamp);
  return g;
}

function shelf(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const steel = lambert(s.color ?? 0x6d7479, 'shelfsteel');
  for (const x of [-s.w / 2, -s.w / 6, s.w / 6, s.w / 2]) g.add(box(0.06, s.h, s.d, steel, x, s.h / 2, 0));
  const colors = [0x3f6ea8, 0xc8362b, 0xf2b705, 0x5b7f3b, 0x8a8f94];
  for (const y of [0.45, 1.2, 1.95]) {
    g.add(box(s.w, 0.04, s.d, lambert(0x9da3a8, 'shelfboard'), 0, y, 0));
    for (let i = 0; i < 6; i++) {
      const w = 0.35 + ((i * 7 + y * 10) % 5) * 0.08;
      g.add(box(w, 0.3, s.d * 0.8, lambert(colors[(i + Math.round(y * 3)) % colors.length]), -s.w / 2 + 0.5 + i * (s.w / 6.3), y + 0.17, 0));
    }
  }
  return g;
}

function board(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-s.w / 2 + 0.05, s.w / 2 - 0.05]) g.add(box(0.1, s.h, 0.1, lambert(0x5a4632, 'post'), x, s.h / 2, 0));
  g.add(box(s.w, 1.2, 0.08, lambert(0xb08a5a, 'cork'), 0, 1.45, 0));
  g.add(box(s.w + 0.3, 0.1, 0.5, lambert(s.color ?? 0x3b4a57, 'boardroof'), 0, s.h, 0));
  const papers = [0xffffff, 0xf7f3c8, 0xdfeaf5, 0xffffff, 0xf5dcdc];
  papers.forEach((c, i) => g.add(box(0.36, 0.48, 0.01, lambert(c), -0.9 + i * 0.45, 1.5 + (i % 2) * 0.12, 0.05)));
  return g;
}

function container(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s.w, s.h, s.d, tmat('metal', s.color ?? 0xd8dde0, [3, 1]), 0, s.h / 2 + 0.1, 0));
  g.add(box(0.9, 2.0, 0.05, lambert(0x4a5560, 'contdoor'), s.w * 0.3, 1.1, s.d / 2 + 0.02));
  for (const x of [-s.w * 0.25, 0.05]) g.add(box(1.1, 0.8, 0.05, lambert(PALETTE.glass), x, 1.6, s.d / 2 + 0.02));
  return g;
}

function toilet(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s.w, s.h, s.d, lambert(s.color ?? 0x2f7d4f, 'toilet'), 0, s.h / 2, 0));
  g.add(box(s.w + 0.08, 0.1, s.d + 0.08, lambert(0xf2f2ee), 0, s.h + 0.05, 0));
  return g;
}

function excavator(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const yellow = lambert(s.color ?? 0xe0a31a, 'excavator');
  const dark = lambert(0x26292c, 'tracks');
  for (const z of [-1.0, 1.0]) g.add(box(3.6, 0.8, 0.6, dark, 0, 0.4, z));
  g.add(box(2.8, 1.1, 2.4, yellow, 0.3, 1.35, 0));
  g.add(box(1.2, 1.4, 1.1, lambert(PALETTE.glass), -0.6, 2.55, 0.55));
  g.add(box(1.25, 0.1, 1.15, yellow, -0.6, 3.3, 0.55));
  const boom = box(3.4, 0.4, 0.35, yellow, -2.2, 2.6, -0.3);
  boom.rotation.z = -0.55;
  g.add(boom);
  const stick = box(2.2, 0.3, 0.3, yellow, -4.1, 1.4, -0.3);
  stick.rotation.z = 1.1;
  g.add(stick);
  g.add(box(0.8, 0.6, 0.9, dark, -4.6, 0.35, -0.3));
  return g;
}

function soilPile(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 10, 2), tmat('dirt', s.color ?? 0x6f5a3e, [4, 2]));
  cone.scale.set(s.w, s.h, s.d);
  cone.position.y = s.h / 2 - 0.1;
  g.add(cone);
  return g;
}

function bricks(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s.w, 0.14, s.d, tmat('planks', 0xb88a52), 0, 0.07, 0));
  g.add(box(s.w * 0.95, s.h - 0.14, s.d * 0.95, tmat('tiles', s.color ?? 0xb5553c, [2, 2]), 0, 0.14 + (s.h - 0.14) / 2, 0));
  return g;
}

function hayBale(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, s.w, 16).rotateZ(Math.PI / 2), tmat('planks', s.color ?? 0xc9b26a));
  c.position.y = 0.7;
  g.add(c);
  return g;
}

function shed(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const wood = tmat('planks', s.color ?? 0x8b6a45, [2, 1]);
  g.add(box(s.w, s.h, s.d, wood, 0, s.h / 2, 0));
  g.add(gableRoof(s.w, s.d, s.h, 1.4, tmat('metal', 0x5d6166, [3, 1]), wood));
  g.add(box(1.4, 2.0, 0.06, lambert(0x4a3525, 'sheddoor'), 0, 1.0, s.d / 2 + 0.03));
  return g;
}

function car(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const paint = lambert(s.color ?? 0x8a1f24);
  g.add(box(s.w, 0.7, s.d, paint, 0, 0.6, 0));
  g.add(box(s.w * 0.55, 0.6, s.d * 0.92, lambert(PALETTE.glass), -0.1, 1.2, 0));
  const wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateX(Math.PI / 2);
  for (const x of [-1.35, 1.35]) for (const z of [-0.85, 0.85]) {
    const w = new THREE.Mesh(wheel, lambert(PALETTE.rubber));
    w.position.set(x, 0.32, z);
    g.add(w);
  }
  return g;
}

function bench(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const wood = tmat('planks', s.color ?? 0x8b6a45);
  g.add(box(s.w, 0.06, s.d, wood, 0, 0.45, 0));
  g.add(box(s.w, 0.4, 0.06, wood, 0, 0.75, -s.d / 2));
  for (const x of [-s.w / 2 + 0.1, s.w / 2 - 0.1]) g.add(box(0.08, 0.45, s.d, lambert(0x2e3236), x, 0.22, 0));
  return g;
}

function powerPole(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, s.h, 7).translate(0, s.h / 2, 0), lambert(0x6b5540, 'pole')));
  g.add(box(1.6, 0.1, 0.1, lambert(0x3a3d40, 'crossarm'), 0, s.h - 0.4, 0));
  return g;
}

function post(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s.w, s.h + 0.3, s.d, lambert(PALETTE.concrete, 'post'), 0, (s.h - 0.3) / 2, 0));
  g.add(box(0.02, 0.012, 0.02, lambert(PALETTE.metal, 'postnail'), 0, s.h + 0.006, 0));
  return g;
}

/** Betonové čelo propustku s troubou (osa trouby podél lokálního z, výtok na +z). */
function culvert(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const conc = lambert(PALETTE.concrete, 'culvert');
  g.add(box(s.w, s.h + 0.25, s.d, conc, 0, (s.h - 0.25) / 2, 0));
  g.add(box(0.14, s.h + 0.1, 0.9, conc, -s.w / 2 + 0.07, (s.h - 0.1) / 2, -0.45));
  g.add(box(0.14, s.h + 0.1, 0.9, conc, s.w / 2 - 0.07, (s.h - 0.1) / 2, -0.45));
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.34, 16, 1, true).rotateX(Math.PI / 2), lambert(0x6f6a62, 'pipe'));
  pipe.position.set(0, 0.24, 0.02);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.23, 16), lambert(0x15130f, 'pipehole'));
  hole.position.set(0, 0.24, s.d / 2 + 0.005);
  g.add(pipe, hole);
  return g;
}

/** Kamenná obruba studánky s hladinou. */
function well(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const r = s.w / 2;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, s.h, 14, 1, true), lambert(0x7d786e, 'wellstone'));
  ring.position.y = s.h / 2 - 0.1;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 16).rotateX(Math.PI / 2), lambert(0x8a857a, 'wellrim'));
  rim.position.y = s.h - 0.08;
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 16).rotateX(-Math.PI / 2), lambert(0x1c2a2c, 'wellwater'));
  water.position.y = 0.05;
  g.add(ring, rim, water);
  return g;
}

/** Cedule na dvou kůlech (text na desce). */
function sign(s: SceneryItem): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0x5a4632, 'post');
  for (const x of [-s.w / 2 + 0.08, s.w / 2 - 0.08]) g.add(box(0.08, s.h, 0.08, wood, x, s.h / 2, 0));
  const bh = s.w * (96 / 512) * 1.4;
  const t = signTexture(s.text ?? '', '#2f5d3a');
  const board = new THREE.Mesh(new THREE.PlaneGeometry(s.w, bh), matte({ color: 0xffffff, map: t ?? undefined }));
  board.position.set(0, s.h - bh / 2 - 0.05, 0.05);
  g.add(box(s.w + 0.04, bh + 0.04, 0.04, wood, 0, s.h - bh / 2 - 0.05, 0.02), board);
  return g;
}

const BUILDERS: Partial<Record<SceneryItem['kind'], (s: SceneryItem) => THREE.Group>> = {
  post,
  culvert,
  sign,
  well,
  house,
  office,
  garage,
  shelf,
  board,
  siteOffice: container,
  toilet,
  excavator,
  soilPile,
  bricks,
  hayBale,
  shed,
  car,
  bench,
  powerPole,
};

/** Všechny stavby a předměty scenérie jedné lokality + dráty vedení + kameny. */
export function createScenery(world: World, mobile: boolean): THREE.Group {
  const root = new THREE.Group();
  for (const s of world.scenery) {
    const b = BUILDERS[s.kind];
    if (!b) continue;
    const g = b(s);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = !mobile || s.kind !== 'powerPole';
        o.receiveShadow = true;
      }
    });
    g.position.set(s.x, s.groundY, s.z);
    g.rotation.y = s.yaw;
    root.add(g);
  }
  // Dráty mezi sousedními sloupy (prověšené).
  const poles = world.scenery.filter((s) => s.kind === 'powerPole').sort((a, b) => a.x - b.x);
  const pts: number[] = [];
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i];
    const b = poles[i + 1];
    if (Math.hypot(b.x - a.x, b.z - a.z) > 45) continue;
    for (const off of [-0.7, 0, 0.7]) {
      const seg = 12;
      for (let k = 0; k < seg; k++) {
        for (const t of [k / seg, (k + 1) / seg]) {
          const sag = Math.sin(t * Math.PI) * 0.9;
          pts.push(a.x + (b.x - a.x) * t, a.groundY + a.h - 0.35 + (b.groundY - a.groundY) * t - sag, a.z + (b.z - a.z) * t + off);
        }
      }
    }
  }
  if (pts.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }
  root.add(createRocks(world, mobile ? 260 : 520));
  return root;
}

/** Kameny v trávě a na svazích (jen vzhled, bez kolizí). */
function createRocks(world: World, count: number): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geo, matte({ color: 0xffffff, flatShading: true }), count);
  const hm = world.heightmap;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  let k = 1;
  const rnd = (): number => {
    k = (k * 16807) % 2147483647;
    return k / 2147483647;
  };
  for (let attempt = 0; attempt < count * 8 && n < count; attempt++) {
    const x = (rnd() - 0.5) * hm.half * 1.9;
    const z = (rnd() - 0.5) * hm.half * 1.9;
    if (world.surfaceAt(x, z) !== 'grass') continue;
    const slope = hm.slopeAt(x, z);
    if (slope < 0.25 && rnd() > 0.25) continue;
    if (world.fields.some((f) => inPolygon(x, z, f.corners))) continue;
    if (world.marks.some((mk) => Math.hypot(mk.pos.x - x, mk.pos.z - z) < 3)) continue;
    if (world.scenery.some((sc) => Math.abs(sc.x - x) < sc.w / 2 + 1 && Math.abs(sc.z - z) < sc.d / 2 + 1)) continue;
    const r = 0.15 + rnd() * rnd() * 0.9;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3);
    q.setFromEuler(e);
    m.compose(p.set(x, hm.heightAt(x, z) - r * 0.35, z), q, s.set(r * (1 + rnd() * 0.6), r * 0.7, r));
    mesh.setMatrixAt(n, m);
    const v = 0.42 + rnd() * 0.2;
    col.setRGB(v, v * 0.98, v * 0.93);
    mesh.setColorAt(n++, col);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
