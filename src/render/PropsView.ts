import * as THREE from 'three';
import type { ControlMark } from '../world/World';
import { lambert, matte, PALETTE } from './materials';

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
}

function cylinder(rTop: number, rBottom: number, h: number, color: number, seg = 10): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), lambert(color));
}

let signTexture: THREE.CanvasTexture | null = null;
function triangulationSign(): THREE.CanvasTexture {
  if (signTexture) return signTexture;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#f4f4ef';
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = '#c8362b';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 244, 148);
    g.fillStyle = '#1d1d1d';
    g.textAlign = 'center';
    g.font = 'bold 30px "Barlow Semi Condensed", Arial, sans-serif';
    g.fillText('STÁTNÍ', 128, 58);
    g.fillText('TRIANGULACE', 128, 92);
    g.font = '20px "Barlow Semi Condensed", Arial, sans-serif';
    g.fillText('Poškození se trestá', 128, 128);
  }
  signTexture = new THREE.CanvasTexture(c);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  return signTexture;
}

/** Křížek na hlavě kamene. */
function cross(size: number): THREE.Group {
  const g = new THREE.Group();
  const a = box(size, 0.004, 0.012, PALETTE.darkMetal);
  const b = box(0.012, 0.004, size, PALETTE.darkMetal);
  g.add(a, b);
  return g;
}

/** Stabilizace bodu. Počátek skupiny = měřená značka (střed křížku / hlavy hřebu). */
export function createMarkMesh(mark: ControlMark): THREE.Group {
  const g = new THREE.Group();
  g.position.set(mark.pos.x, mark.pos.y, mark.pos.z);

  switch (mark.type) {
    case 'TB':
    case 'ZhB': {
      const stone = box(0.2, 0.7, 0.2, mark.type === 'TB' ? PALETTE.granite : PALETTE.concrete);
      stone.position.y = -0.35;
      const c = cross(0.13);
      c.position.y = 0.002;
      g.add(stone, c);
      if (mark.type === 'TB') {
        // Ochranná tyč 1 m severně (−z), pruhovaná, s výstražnou tabulkou.
        const pole = new THREE.Group();
        pole.position.set(0, -0.1, -1.0);
        for (let i = 0; i < 4; i++) {
          const seg = cylinder(0.03, 0.03, 0.5, i % 2 === 0 ? PALETTE.stakeRed : PALETTE.white, 8);
          seg.position.y = 0.25 + i * 0.5;
          pole.add(seg);
        }
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), matte({ map: triangulationSign() }));
        sign.position.set(0, 1.75, 0.04);
        const back = box(0.4, 0.25, 0.01, PALETTE.white);
        back.position.set(0, 1.75, 0.03);
        pole.add(back, sign);
        g.add(pole);
      }
      break;
    }
    case 'PBPP': {
      const missing = mark.condition === 'missing';
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.1, 20, 1, 0, missing ? Math.PI * 1.2 : Math.PI * 2).rotateX(-Math.PI / 2),
        matte({
          color: missing ? 0x9a5a48 : PALETTE.stakeRed,
          transparent: missing,
          opacity: missing ? 0.55 : 1,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      ring.position.y = 0.012;
      g.add(ring);
      // Zničený bod: hřeb chybí, zbyl jen kus vybledlého kroužku.
      if (!missing) g.add(cylinder(0.012, 0.012, 0.01, PALETTE.metal, 8));
      break;
    }
    case 'NZ': {
      // Hlava hřebu vystupuje z východní zdi (+x).
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12).rotateZ(Math.PI / 2), lambert(PALETTE.metal));
      head.position.x = -0.015;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 16).rotateZ(Math.PI / 2), lambert(0x6f7479));
      plate.position.x = -0.03;
      g.add(head, plate);
      break;
    }
    case 'HZ': {
      if (mark.stabilization.startsWith('Kamenný')) {
        // Starý kamenný hraniční znak s vytesaným křížkem.
        const stone = box(0.16, 0.6, 0.16, 0xa8a393);
        stone.position.y = -0.3;
        const c = cross(0.1);
        c.position.y = 0.002;
        g.add(stone, c);
        break;
      }
      const body = cylinder(0.04, 0.045, 0.55, 0xd9d9d2, 8);
      body.position.y = -0.275;
      const cap = cylinder(0.042, 0.042, 0.03, PALETTE.stakeRed, 8);
      cap.position.y = 0.0;
      g.add(body, cap);
      if (mark.condition === 'damaged') {
        // Vyvrácený mezník: hlava ujela ze své polohy.
        g.rotation.set(0.1, 0, 0.55);
        g.position.x += 0.14;
        g.position.y -= 0.05;
      }
      break;
    }
  }
  return g;
}

/** Rozměry pohledu řidiče v lokálních souřadnicích dodávky (čelo na −x, řidič vlevo = +z). */
export const DRIVER_EYE = { x: -1.3, y: 1.62, z: 0.45 };

/** Služební dodávka (osa podél x, čelo na −x). Pozici a natočení nastavuje syncVehicle. */
export function createVehicleMesh(v: { length: number; width: number; height: number }): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group(); // náklon karoserie
  g.add(body);
  const clearance = 0.42;
  const glass = matte({ color: 0x9fb7c4, transparent: true, opacity: 0.22, depthWrite: false });

  const cargo = box(v.length * 0.74, v.height - clearance, v.width, PALETTE.white);
  cargo.position.set(v.length * 0.13, clearance + (v.height - clearance) / 2, 0);
  // Kabina: střecha, spodní díl, sloupky a skla – zevnitř je vidět ven.
  const cabH = (v.height - clearance) * 0.78;
  const cabX = -v.length * 0.37;
  const cabL = v.length * 0.26;
  const roof = box(cabL, 0.08, v.width, PALETTE.white);
  roof.position.set(cabX, clearance + cabH - 0.04, 0);
  const lower = box(cabL, 0.62, v.width, PALETTE.white);
  lower.position.set(cabX, clearance + 0.31, 0);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.02, cabH - 0.72, v.width * 0.92), glass);
  windshield.position.set(-v.length * 0.5 + 0.01, clearance + 0.62 + (cabH - 0.72) / 2, 0);
  const pillars: THREE.Mesh[] = [];
  for (const sz of [-1, 1]) {
    const a = box(0.07, cabH - 0.62, 0.07, PALETTE.white);
    a.position.set(-v.length * 0.5 + 0.035, clearance + 0.62 + (cabH - 0.62) / 2, sz * (v.width / 2 - 0.035));
    const side = new THREE.Mesh(new THREE.BoxGeometry(cabL - 0.1, cabH - 0.72, 0.02), glass);
    side.position.set(cabX, clearance + 0.62 + (cabH - 0.72) / 2, sz * (v.width / 2 - 0.01));
    pillars.push(a, side);
  }
  // Interiér: palubní deska a volant (vidět z pohledu řidiče).
  const dash = box(0.35, 0.2, v.width * 0.94, 0x2c3033);
  dash.position.set(-v.length * 0.5 + 0.22, clearance + 0.72, 0);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 24), lambert(0x1c1d1e));
  wheel.rotation.y = Math.PI / 2;
  wheel.rotation.x = 0.0;
  wheel.rotation.z = 0.45;
  wheel.position.set(DRIVER_EYE.x - 0.45, DRIVER_EYE.y - 0.42, DRIVER_EYE.z);
  const stripe = box(v.length * 0.74 + 0.01, 0.16, v.width + 0.02, PALETTE.surveyYellow);
  stripe.position.set(v.length * 0.13, clearance + 0.55, 0);
  const bumper = box(0.12, 0.2, v.width * 0.96, PALETTE.darkMetal);
  bumper.position.set(-v.length * 0.5 - 0.04, clearance + 0.05, 0);
  const rearDoorLine = box(0.02, v.height - clearance - 0.2, 0.02, PALETTE.darkMetal);
  rearDoorLine.position.set(v.length * 0.5 + 0.005, clearance + (v.height - clearance) / 2, 0);
  body.add(cargo, roof, lower, windshield, ...pillars, dash, wheel, stripe, bumper, rearDoorLine);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14).rotateX(Math.PI / 2);
  for (const sx of [-0.33, 0.33]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, lambert(PALETTE.rubber));
      w.position.set(sx * v.length, 0.36, sz * (v.width / 2 - 0.1));
      g.add(w);
    }
  }
  g.userData = { body };
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== glass) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** Natočení modelu podle stavu dodávky (yaw 0 = sever; model má čelo na −x). */
export function syncVehicle(g: THREE.Group, v: { x: number; z: number; yaw: number; groundY: number; pitch: number; roll: number }): void {
  g.position.set(v.x, v.groundY, v.z);
  g.rotation.set(0, v.yaw - Math.PI / 2, 0);
  const body = (g.userData as { body: THREE.Object3D }).body;
  body.rotation.set(v.roll, 0, -v.pitch, 'XYZ'); // pravá strana výš = kladný roll, předek výš = kladný pitch
}
