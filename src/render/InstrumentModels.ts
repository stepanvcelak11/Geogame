import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr, PALETTE } from './materials';

/**
 * Detailní modely měřického vybavení: stativ, totální stanice na trojnožce, GNSS přijímač,
 * kontroler, výtyčky, hranol, nivelák, kufry. Všechno od y = 0 nahoru (hrot / dno).
 * Materiály: lakovaný plast, eloxovaný hliník, pryž, sklo a svítící displeje.
 */

const M = {
  yellow: () => pbr(PALETTE.surveyYellow, 0.42, 0),
  yellowPlastic: () => pbr(0xe8ae10, 0.55, 0),
  white: () => pbr(0xeef0ec, 0.38, 0),
  grey: () => pbr(0x6b7176, 0.5, 0.2),
  dark: () => pbr(0x2a2e32, 0.55, 0.1),
  rubber: () => pbr(0x151618, 0.9, 0),
  alu: () => pbr(0xc3c8cc, 0.32, 0.9),
  steel: () => pbr(0x9aa0a6, 0.28, 1),
  carbon: () => pbr(0x1e2124, 0.35, 0.3),
  wood: () => pbr(0xa87a45, 0.7, 0),
  glass: () => pbr(0x8fb4c8, 0.05, 0.1, { transparent: true, opacity: 0.55 }),
  lens: () => pbr(0x2a4a5e, 0.08, 0.6),
  red: () => pbr(0xc8362b, 0.45, 0),
};

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Zaoblený kvádr (hrany sražené) – kryty přístrojů, kufry. */
function rounded(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  shape.moveTo(x, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, y);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(x, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, y);
  shape.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

/** Displej jako textura (svítí i ve stínu). */
function screenMaterial(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 128, h = 96): THREE.Material {
  if (typeof document === 'undefined') return M.dark();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return M.dark();
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0 });
}

let ctrlScreen: THREE.Material | null = null;
let tsScreen: THREE.Material | null = null;

function controllerScreen(): THREE.Material {
  ctrlScreen ??= screenMaterial((g, w, h) => {
    g.fillStyle = '#f3f5f2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d3b53';
    g.fillRect(0, 0, w, 14);
    g.fillStyle = '#2e8b3e';
    g.fillRect(58, 3, 22, 8);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#c9d1ca';
      const x = 6 + (i % 4) * 30;
      const y = 22 + Math.floor(i / 4) * 34;
      g.fillRect(x, y, 26, 28);
      g.strokeRect(x, y, 26, 28);
      g.fillStyle = '#1d6fb5';
      g.fillRect(x + 9, y + 7, 8, 8);
    }
  }, 128, 96);
  return ctrlScreen;
}

function totalStationScreen(): THREE.Material {
  tsScreen ??= screenMaterial((g, w, h) => {
    g.fillStyle = '#c9d6c2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b2a1b';
    g.font = 'bold 14px monospace';
    g.fillText('Hz 123.4567', 6, 22);
    g.fillText('V  100.0012', 6, 42);
    g.fillText('SD   25.318', 6, 62);
    g.fillRect(0, h - 16, w, 16);
    g.fillStyle = '#c9d6c2';
    g.font = '10px monospace';
    g.fillText('MĚŘ  ORI  STN  ZÁZ', 6, h - 5);
  }, 128, 96);
  return tsScreen;
}

/** Trojnožka se třemi stavěcími šrouby a krabicovou libelou. */
function tribrach(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.075, 0.085, 0.018, 3).rotateY(Math.PI / 6), M.dark(), 0, 0.009, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const screw = part(new THREE.CylinderGeometry(0.014, 0.014, 0.028, 12), M.dark(), Math.sin(a) * 0.06, 0.03, Math.cos(a) * 0.06);
    g.add(screw);
  }
  g.add(part(new THREE.CylinderGeometry(0.068, 0.068, 0.018, 24), M.grey(), 0, 0.052, 0));
  const vial = part(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 16), M.glass(), 0.05, 0.064, 0.03);
  g.add(vial);
  // Zajišťovací páčka trojnožky.
  g.add(part(new THREE.BoxGeometry(0.03, 0.008, 0.012), M.dark(), 0.075, 0.05, 0));
  return g;
}

/** Totální stanice: trojnožka + otočná alidáda s dalekohledem, dvěma displeji a držadlem. */
export function buildTotalStation(): { root: THREE.Group; alidade: THREE.Group } {
  const root = new THREE.Group();
  root.add(tribrach());
  const alidade = new THREE.Group();
  alidade.position.y = 0.061;
  alidade.add(part(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 32), M.white(), 0, 0.025, 0));
  // Klávesnice a displej na obou stranách.
  const kb = rounded(0.15, 0.05, 0.03, 0.008);
  const scr = totalStationScreen();
  for (const s of [-1, 1]) {
    const panel = part(kb, M.dark(), 0, 0.075, s * 0.07);
    panel.rotation.x = s * 0.35;
    alidade.add(panel);
    const disp = part(new THREE.PlaneGeometry(0.07, 0.035), scr, 0, 0.084, s * 0.087);
    disp.rotation.y = s < 0 ? Math.PI : 0;
    disp.rotation.x = -0.35;
    alidade.add(disp);
  }
  // Nosníky (vidlice) a dalekohled mezi nimi.
  const upr = rounded(0.04, 0.16, 0.08, 0.01);
  for (const s of [-1, 1]) alidade.add(part(upr, M.white(), s * 0.07, 0.13, 0));
  const tel = new THREE.Group();
  tel.position.y = 0.155;
  tel.add(part(new THREE.CylinderGeometry(0.034, 0.03, 0.2, 24).rotateX(Math.PI / 2), M.grey()));
  tel.add(part(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 24).rotateX(Math.PI / 2), M.dark(), 0, 0, -0.1));
  tel.add(part(new THREE.CircleGeometry(0.03, 24).rotateY(Math.PI), M.lens(), 0, 0, -0.107));
  tel.add(part(new THREE.CylinderGeometry(0.018, 0.022, 0.035, 16).rotateX(Math.PI / 2), M.rubber(), 0, 0, 0.115));
  // Zaměřovací kolimátor nahoře.
  tel.add(part(new THREE.BoxGeometry(0.012, 0.012, 0.05), M.dark(), 0, 0.04, -0.02));
  alidade.add(tel);
  // Držadlo s baterií.
  alidade.add(part(new THREE.BoxGeometry(0.16, 0.018, 0.03), M.dark(), 0, 0.225, 0));
  // Jemné ustanovky (šroubky na boku).
  for (const s of [-1, 1]) alidade.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12).rotateZ(Math.PI / 2), M.dark(), s * 0.098, 0.1, 0.02));
  root.add(alidade);
  return { root, alidade };
}

/** Hliníková noha stativu (horní díl + vysouvací dolní díl, svěrka, patka s ostruhou). */
function tripodLeg(): THREE.Group {
  const leg = new THREE.Group();
  const upper = part(new THREE.BoxGeometry(0.038, 0.62, 0.022).translate(0, -0.31, 0), M.wood());
  const lower = part(new THREE.BoxGeometry(0.026, 0.55, 0.016).translate(0, -0.72, 0), M.alu());
  const clamp = part(new THREE.BoxGeometry(0.05, 0.05, 0.034), M.dark(), 0, -0.6, 0);
  const shoe = part(new THREE.CylinderGeometry(0.006, 0.014, 0.08, 8).translate(0, -0.97, 0), M.steel());
  const spur = part(new THREE.BoxGeometry(0.04, 0.01, 0.016), M.steel(), 0.018, -0.9, 0);
  leg.add(upper, lower, clamp, shoe, spur);
  return leg;
}

export function buildTripod(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Group();
  head.add(part(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 3).rotateY(Math.PI / 6), M.yellow()));
  head.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.052, 24), M.alu()));
  head.add(part(new THREE.CylinderGeometry(0.009, 0.009, 0.08, 8), M.steel(), 0, -0.05, 0)); // upínací šroub
  g.add(head);
  const legs: { pivot: THREE.Group; tilt: THREE.Group; leg: THREE.Group }[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 3) * Math.PI * 2;
    const tilt = new THREE.Group();
    tilt.position.z = -0.05;
    const leg = tripodLeg();
    tilt.add(leg);
    pivot.add(tilt);
    g.add(pivot);
    legs.push({ pivot, tilt, leg });
  }
  const ts = buildTotalStation();
  const station = ts.root;
  station.userData = { alidade: ts.alidade };
  station.visible = false;
  g.add(station);
  g.userData = { head, legs, station };
  return g;
}

/** GNSS přijímač: bílý kryt antény, šedý pás s LED a tmavá základna se závitem 5/8″. */
export function buildReceiver(): THREE.Group {
  const r = new THREE.Group();
  const dome = new THREE.SphereGeometry(0.1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const d = part(mergeVertices(dome), M.white(), 0, 0.045, 0);
  d.scale.y = 0.55;
  r.add(d);
  r.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 32), M.grey(), 0, 0.028, 0));
  r.add(part(new THREE.CylinderGeometry(0.1, 0.085, 0.022, 32), M.dark(), 0, 0.001, 0));
  // Panel s tlačítkem a LED.
  const leds = [0x3ad13a, 0xf2b705, 0x39a0ff];
  leds.forEach((c, i) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 }));
    led.position.set(-0.012 + i * 0.012, 0.03, 0.1);
    r.add(led);
  });
  r.add(part(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12).rotateX(Math.PI / 2), M.rubber(), 0.03, 0.028, 0.1));
  r.add(part(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), M.steel(), 0, -0.015, 0)); // závit
  return r;
}

/** Kontroler v držáku (odolný tablet s klávesnicí). */
export function buildController(): THREE.Group {
  const c = new THREE.Group();
  c.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12), M.dark(), 0, 0, 0)); // objímka
  c.add(part(new THREE.BoxGeometry(0.018, 0.02, 0.05), M.dark(), 0, 0, 0.03)); // rameno
  const body = part(rounded(0.1, 0.17, 0.028, 0.01), M.rubber(), 0, 0.03, 0.065);
  body.rotation.x = -0.35;
  c.add(body);
  const screen = part(new THREE.PlaneGeometry(0.08, 0.1), controllerScreen(), 0, 0.045, 0.081);
  screen.rotation.x = -0.35;
  c.add(screen);
  return c;
}

/** Výtyčka: karbonová (GNSS) nebo hliníková se žlutým hranolem (totální stanice). */
export function buildPole(kind: 'gnss' | 'prism'): { root: THREE.Group; pole: THREE.Mesh; receiver: THREE.Group; controller: THREE.Group } {
  const g = new THREE.Group();
  const pole = part(new THREE.CylinderGeometry(0.0125, 0.0125, 1.96, 16), kind === 'gnss' ? M.carbon() : M.alu(), 0, 1.0, 0);
  g.add(pole);
  g.add(part(new THREE.ConeGeometry(0.0125, 0.04, 12).rotateX(Math.PI), M.steel(), 0, 0.02, 0));
  // Rukojeť a krabicová libela.
  g.add(part(new THREE.CylinderGeometry(0.017, 0.017, 0.18, 16), M.rubber(), 0, 1.12, 0));
  g.add(part(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), M.dark(), 0.03, 1.35, 0));
  g.add(part(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 16), M.glass(), 0.03, 1.366, 0));
  // Aretace výšky (zajišťovací svěrky).
  for (const y of [0.9, 1.45]) g.add(part(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16), kind === 'gnss' ? M.dark() : M.red(), 0, y, 0));
  const receiver = new THREE.Group();
  const controller = new THREE.Group();
  if (kind === 'gnss') {
    receiver.add(buildReceiver());
    controller.add(buildController());
    controller.position.y = 1.2;
  } else {
    // Hranol v držáku s terčovou deskou; střed 2,000 m nad hrotem.
    const holder = new THREE.Group();
    holder.position.y = 2.0;
    holder.add(part(new THREE.TorusGeometry(0.038, 0.009, 10, 32), M.yellow()));
    holder.add(part(new THREE.CylinderGeometry(0.031, 0.031, 0.045, 24).rotateX(Math.PI / 2), M.lens()));
    holder.add(part(new THREE.BoxGeometry(0.1, 0.012, 0.012), M.yellow(), 0, -0.045, 0));
    for (const s of [-1, 1]) holder.add(part(new THREE.BoxGeometry(0.012, 0.06, 0.012), M.yellow(), s * 0.05, -0.02, 0));
    g.add(holder);
    // Tablet v držáku ovládá robotickou stanici.
    const tab = buildController();
    tab.position.y = 1.25;
    tab.scale.set(1.6, 1.1, 1);
    g.add(tab);
  }
  g.add(receiver, controller);
  return { root: g, pole, receiver, controller };
}

/** Nivelační přístroj na lehkém stativu; záměrná přímka ve výšce 1,45 m. */
export function buildLevel(): { root: THREE.Group; tilts: THREE.Object3D[]; body: THREE.Group } {
  const g = new THREE.Group();
  const legs = new THREE.Group();
  const tilts: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = 1.3;
    pivot.rotation.y = (i * 2 * Math.PI) / 3;
    const tilt = new THREE.Group();
    tilt.add(part(new THREE.CylinderGeometry(0.014, 0.01, 1.36, 8).translate(0, -0.68, 0), M.alu()));
    tilt.add(part(new THREE.CylinderGeometry(0.004, 0.009, 0.06, 6).translate(0, -1.38, 0), M.steel()));
    pivot.add(tilt);
    legs.add(pivot);
    tilts.push(tilt);
  }
  g.add(legs);
  g.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24), M.yellow(), 0, 1.315, 0));
  g.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 3).rotateY(Math.PI / 6), M.dark(), 0, 1.34, 0));
  const body = new THREE.Group();
  body.add(part(rounded(0.1, 0.09, 0.22, 0.012), M.white(), 0, 1.43, 0));
  body.add(part(new THREE.CylinderGeometry(0.032, 0.03, 0.05, 24).rotateX(Math.PI / 2), M.grey(), 0, 1.45, -0.13));
  body.add(part(new THREE.CircleGeometry(0.027, 24).rotateY(Math.PI), M.lens(), 0, 1.45, -0.156));
  body.add(part(new THREE.CylinderGeometry(0.014, 0.018, 0.035, 16).rotateX(Math.PI / 2), M.rubber(), 0, 1.45, 0.125));
  body.add(part(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16).rotateZ(Math.PI / 2), M.dark(), 0.06, 1.44, -0.03)); // zaostřovací knoflík
  body.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), M.glass(), 0.035, 1.478, 0.04)); // libela
  g.add(body);
  return { root: g, tilts, body };
}

/** Tvrdý přepravní kufr se zámky a držadlem. */
export function buildCase(kind: 'ts' | 'gnss'): THREE.Group {
  const g = new THREE.Group();
  const [w, h, d] = kind === 'ts' ? [0.42, 0.36, 0.26] : [0.46, 0.3, 0.3];
  const shell = kind === 'ts' ? M.yellowPlastic() : pbr(0x2f3a44, 0.6, 0);
  g.add(part(rounded(w, h * 0.62, d, 0.02), shell, 0, h * 0.31, 0));
  g.add(part(rounded(w, h * 0.36, d, 0.02), shell, 0, h * 0.8, 0));
  g.add(part(new THREE.BoxGeometry(w + 0.004, 0.012, d + 0.004), M.dark(), 0, h * 0.62, 0));
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.04, 0.05, 0.012), M.steel(), s * w * 0.3, h * 0.62, d / 2 + 0.004));
  g.add(part(new THREE.TorusGeometry(0.05, 0.01, 8, 16, Math.PI), M.rubber(), 0, h + 0.005, 0));
  return g;
}
