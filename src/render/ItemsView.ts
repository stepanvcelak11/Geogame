import * as THREE from 'three';
import type { ItemKind, WorldItem } from '../items/items';
import { lambert, PALETTE } from './materials';

type Triple = [number, number, number];
interface Pose {
  pos: Triple;
  rot: Triple;
}

/** Jak předmět leží: model je postavený „nastojato“ od y = 0, tady ho položíme na bok se středem v počátku. */
const GROUND_POSE: Record<ItemKind, Pose> = {
  tripod: { pos: [0.53, 0.06, 0], rot: [0, 0, Math.PI / 2] },
  tsCase: { pos: [0, 0, 0], rot: [0, 0, 0] },
  gnssCase: { pos: [0, 0, 0], rot: [0, 0, 0] },
  prismPole: { pos: [1.0, 0.03, 0], rot: [0, 0, Math.PI / 2] },
  gnssRover: { pos: [1.0, 0.05, 0], rot: [0, 0, Math.PI / 2] },
  level: { pos: [0.6, 0.08, 0], rot: [0, 0, Math.PI / 2] },
  rod: { pos: [1.5, 0.03, 0], rot: [0, 0, Math.PI / 2] },
};

/** Poloha v pravé ruce v prostoru kamery (x doprava, y nahoru, −z dopředu); levá ruka je zrcadlo. */
const HELD_POSE: Record<ItemKind, Pose> = {
  tripod: { pos: [0.36, -1.32, -0.52], rot: [-0.12, 0, -0.1] },
  tsCase: { pos: [0.4, -0.82, -0.3], rot: [0, 0.25, 0] },
  gnssCase: { pos: [0.4, -0.8, -0.3], rot: [0, 0.25, 0] },
  prismPole: { pos: [0.3, -1.5, -0.62], rot: [-0.08, 0, -0.07] },
  gnssRover: { pos: [0.3, -1.45, -0.62], rot: [-0.08, 0, -0.07] },
  level: { pos: [0.36, -1.3, -0.52], rot: [-0.12, 0, -0.1] },
  rod: { pos: [0.3, -1.6, -0.62], rot: [-0.08, 0, -0.07] },
};

/** Čárový kód digitální latě (žlutá s černými pruhy), jedna textura pro všechny latě. */
let rodTexture: THREE.Texture | null = null;
function rodMaterial(): THREE.Material {
  if (!rodTexture && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 1024;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#f3d23a';
      g.fillRect(0, 0, 8, 1024);
      g.fillStyle = '#141414';
      let y = 0;
      let seed = 7;
      const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      while (y < 1024) {
        const w = 2 + Math.floor(rnd() * 9);
        if (rnd() > 0.45) g.fillRect(0, y, 8, w);
        y += w;
      }
    }
    rodTexture = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshLambertMaterial({ color: 0xffffff, map: rodTexture ?? undefined });
}

function mesh(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, lambert(color));
  m.castShadow = true;
  return m;
}

function buildModel(kind: ItemKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'tripod': {
      // Nohy na kloubech pod hlavou – stejný model složený i rozložený (setTripodPose).
      const head = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), PALETTE.surveyYellow);
      g.add(head);
      const legs: { pivot: THREE.Group; tilt: THREE.Group; leg: THREE.Group }[] = [];
      for (let i = 0; i < 3; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 3) * Math.PI * 2;
        const tilt = new THREE.Group();
        tilt.position.z = -0.045;
        const leg = new THREE.Group();
        const wood = mesh(new THREE.BoxGeometry(0.035, 1, 0.035), PALETTE.wood);
        wood.position.y = -0.5;
        const shoe = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), PALETTE.surveyYellow);
        shoe.position.y = -0.95;
        leg.add(wood, shoe);
        tilt.add(leg);
        pivot.add(tilt);
        g.add(pivot);
        legs.push({ pivot, tilt, leg });
      }
      // Totální stanice (viditelná po nasazení).
      const station = new THREE.Group();
      const base = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 16), PALETTE.darkMetal);
      base.position.y = 0.025;
      const body = mesh(new THREE.BoxGeometry(0.2, 0.2, 0.14), PALETTE.surveyYellow);
      body.position.y = 0.15;
      const scope = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 14).rotateX(Math.PI / 2), PALETTE.darkMetal);
      scope.position.y = 0.2;
      const display = mesh(new THREE.BoxGeometry(0.12, 0.07, 0.01), PALETTE.glass);
      display.position.set(0, 0.12, 0.075);
      // Alhidáda (tělo s dalekohledem) se otáčí nad pevnou trojnožkou – robot se natáčí za hranolem.
      const alidade = new THREE.Group();
      alidade.add(body, scope, display);
      station.add(base, alidade);
      station.userData = { alidade };
      station.visible = false;
      g.add(station);
      g.userData = { head, legs, station };
      setTripodPose(g, FOLDED.spread, FOLDED.len);
      break;
    }
    case 'tsCase': {
      const body = mesh(new THREE.BoxGeometry(0.42, 0.36, 0.26), PALETTE.surveyYellow);
      body.position.y = 0.18;
      const seam = mesh(new THREE.BoxGeometry(0.43, 0.02, 0.27), PALETTE.darkMetal);
      seam.position.y = 0.22;
      const handle = mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), PALETTE.darkMetal);
      handle.position.y = 0.385;
      g.add(body, seam, handle);
      break;
    }
    case 'gnssCase': {
      // Tvrdý kufr: přijímač, kontroler, držák a baterie ve výlisku.
      const body = mesh(new THREE.BoxGeometry(0.46, 0.3, 0.3), 0x2f3a44);
      body.position.y = 0.15;
      const seam = mesh(new THREE.BoxGeometry(0.47, 0.02, 0.31), PALETTE.surveyYellow);
      seam.position.y = 0.2;
      const handle = mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), PALETTE.darkMetal);
      handle.position.y = 0.315;
      g.add(body, seam, handle);
      break;
    }
    case 'level': {
      // Nivelační přístroj na lehkém stativu; záměrná přímka ve výšce 1,45 m.
      const legs = new THREE.Group();
      const tilts: THREE.Object3D[] = [];
      for (let i = 0; i < 3; i++) {
        const pivot = new THREE.Group();
        pivot.position.y = 1.3;
        pivot.rotation.y = (i * 2 * Math.PI) / 3;
        const tilt = new THREE.Group();
        const leg = mesh(new THREE.CylinderGeometry(0.014, 0.01, 1.36, 6).translate(0, -0.68, 0), 0xb08a5a);
        tilt.add(leg);
        pivot.add(tilt);
        legs.add(pivot);
        tilts.push(tilt);
      }
      const head = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), PALETTE.darkMetal);
      head.position.y = 1.315;
      const body = new THREE.Group();
      const box = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), PALETTE.surveyYellow);
      box.position.y = 1.43;
      const obj = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12).rotateX(Math.PI / 2), PALETTE.darkMetal);
      obj.position.set(0, 1.45, -0.13);
      body.add(box, obj);
      g.add(legs, head, body);
      g.userData = { tilts, body };
      break;
    }
    case 'rod': {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.014).translate(0, 1.5, 0), rodMaterial());
      const foot = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), PALETTE.darkMetal);
      foot.position.y = 0.015;
      const bubble = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), PALETTE.darkMetal);
      bubble.position.set(0.035, 1.4, 0);
      g.add(rod, foot, bubble);
      break;
    }
    case 'prismPole':
    case 'gnssRover': {
      const pole = mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 1.96, 8), PALETTE.metal);
      pole.position.y = 1.0;
      const tip = mesh(new THREE.ConeGeometry(0.0125, 0.04, 8).rotateX(Math.PI), PALETTE.darkMetal);
      tip.position.y = 0.02;
      const bubble = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), PALETTE.darkMetal);
      bubble.position.set(0.03, 1.35, 0);
      g.add(pole, tip, bubble);
      if (kind === 'prismPole') {
        // Tablet v držáku na výtyčce – ovládá robotickou stanici.
        const tablet = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.015), PALETTE.darkMetal);
        tablet.position.set(0, 1.3, 0.05);
        tablet.rotation.x = -0.5;
        const screen = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.002), 0x7fb0c9);
        screen.position.set(0, 1.3 + 0.004, 0.058);
        screen.rotation.x = -0.5;
        g.add(tablet, screen);
        // Hranol: výška středu přesně 2,000 m nad hrotem, sklo vidět z obou stran.
        const housing = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.04, 16).rotateX(Math.PI / 2), PALETTE.surveyYellow);
        housing.position.y = 2.0;
        const glass = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.043, 16).rotateX(Math.PI / 2), 0xb9d7e6);
        glass.position.set(0, 2.0, 0);
        g.add(housing, glass);
      } else {
        // Přijímač sedí na vrcholu výtyčky (výška podle vysunutí), kontroler v držáku.
        const receiver = new THREE.Group();
        const antenna = mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe9ebe6);
        antenna.position.y = 0.015;
        antenna.scale.y = 0.55;
        const base = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 16), PALETTE.darkMetal);
        receiver.add(antenna, base);
        const controller = new THREE.Group();
        const bracket = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.05), PALETTE.darkMetal);
        bracket.position.set(0, 0, 0.02);
        const body = mesh(new THREE.BoxGeometry(0.09, 0.16, 0.03), PALETTE.darkMetal);
        body.position.set(0, 0.02, 0.05);
        const screen = mesh(new THREE.BoxGeometry(0.075, 0.1, 0.002), 0x7fb0c9);
        screen.position.set(0, 0.04, 0.066);
        controller.add(bracket, body, screen);
        controller.position.y = 1.18;
        g.add(receiver, controller);
        g.userData = { pole, receiver, controller };
      }
      break;
    }
  }
  return g;
}

const FOLDED = { spread: 0.035, len: 1.0 };
const DEPLOYED = { spread: 0.36, len: 1.38 };

/** Rozevření nohou [rad] a délka vysunutých nohou [m]; hroty vždy na y = 0. */
function setTripodPose(g: THREE.Group, spread: number, len: number): void {
  const u = g.userData as {
    head: THREE.Object3D;
    station: THREE.Object3D;
    legs: { pivot: THREE.Group; tilt: THREE.Group; leg: THREE.Group }[];
  };
  const h = len * Math.cos(spread);
  u.head.position.y = h + 0.03;
  u.station.position.y = h + 0.06;
  for (const l of u.legs) {
    l.pivot.position.y = h;
    l.tilt.rotation.x = spread;
    l.leg.scale.y = len;
  }
}

interface Entry {
  root: THREE.Group;
  model: THREE.Group;
}

/** Předměty na zemi nebo v rukou – čte stav z logiky, sám nic nerozhoduje. */
export class ItemsView {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    items: readonly WorldItem[],
  ) {
    for (const it of items) {
      const root = new THREE.Group();
      const model = buildModel(it.kind);
      root.add(model);
      scene.add(root);
      this.entries.set(it.id, { root, model });
    }
  }

  private heldHidden = false;
  private poleTilt = { sx: 0, sy: 0 };

  /** Náklon výtyčky v ruce na obrazovce (rad, vpravo / k sobě) – kreslí se zveličeně. */
  setPoleTilt(sx: number, sy: number): void {
    this.poleTilt = { sx, sy };
  }
  private hiddenId: string | null = null;

  /** Skryje jeden předmět (stativ se stanicí, když se díváš dalekohledem). */
  setHidden(id: string | null): void {
    this.hiddenId = id;
  }

  /** V dalekohledu nejsou vidět předměty v rukou. */
  setHeldHidden(v: boolean): void {
    this.heldHidden = v;
  }

  sync(items: readonly WorldItem[], location: string): void {
    for (const it of items) {
      const e = this.entries.get(it.id);
      if (!e) continue;
      e.root.visible =
        it.id !== this.hiddenId && ((it.state === 'held' && !this.heldHidden) || (it.state !== 'held' && it.state !== 'stored' && it.location === location));
      if (!e.root.visible) continue;
      if (it.kind === 'tripod') {
        const p = it.state === 'deployed' ? DEPLOYED : FOLDED;
        setTripodPose(e.model, p.spread, p.len);
        const station = (e.model.userData as { station: THREE.Object3D }).station;
        station.visible = it.state === 'deployed' && !!it.mounted;
        (station.userData as { alidade: THREE.Object3D }).alidade.rotation.y = (it.stationYaw ?? it.yaw) - it.yaw;
      }
      if (it.kind === 'gnssRover') {
        const u = e.model.userData as { pole: THREE.Object3D; receiver: THREE.Object3D; controller: THREE.Object3D };
        const h = it.rig?.height ?? 2;
        u.pole.scale.y = h / 1.96;
        u.pole.position.y = h / 2;
        u.receiver.position.y = h - 0.02;
        u.receiver.visible = !!it.rig?.receiver;
        u.controller.visible = !!it.rig?.controller;
      }
      if (it.kind === 'level') {
        const u = e.model.userData as { tilts: THREE.Object3D[]; body: THREE.Object3D };
        const spread = it.state === 'deployed' ? 0.33 : 0.04;
        for (const t of u.tilts) t.rotation.x = spread;
        u.body.rotation.y = it.state === 'deployed' ? (it.stationYaw ?? it.yaw) - it.yaw : 0;
      }
      if (it.state === 'deployed') {
        // Stojí na bodě: model je postavený od hrotu (y = 0) nahoru.
        if (e.root.parent !== this.scene) this.scene.add(e.root);
        e.root.position.set(it.pos.x, it.pos.y, it.pos.z);
        e.root.rotation.set(0, it.yaw, 0);
        e.model.position.set(0, 0, 0);
        e.model.rotation.set(0, 0, 0);
      } else if (it.state === 'held') {
        if (e.root.parent !== this.camera) this.camera.add(e.root);
        const p = HELD_POSE[it.kind];
        const m = it.hand === 'left' ? -1 : 1;
        e.root.position.set(p.pos[0] * m, p.pos[1], p.pos[2]);
        const pole = it.kind === 'gnssRover' || it.kind === 'prismPole';
        const k = pole ? 6 : 0; // náklon zveličený, ať je vidět
        e.root.rotation.set(p.rot[0] + this.poleTilt.sy * k, p.rot[1] * m, p.rot[2] * m - this.poleTilt.sx * k);
        e.model.position.set(0, 0, 0);
        e.model.rotation.set(0, 0, 0);
      } else {
        if (e.root.parent !== this.scene) this.scene.add(e.root);
        e.root.position.set(it.pos.x, it.pos.y, it.pos.z);
        e.root.rotation.set(0, it.yaw, 0);
        const p = GROUND_POSE[it.kind];
        e.model.position.set(...p.pos);
        e.model.rotation.set(...p.rot);
      }
    }
  }
}
