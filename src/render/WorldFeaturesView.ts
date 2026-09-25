import * as THREE from 'three';
import type { BuildingInfo, FenceInfo, RoadInfo } from '../world/World';
import type { Heightmap } from '../world/Heightmap';
import { lambert, matte } from './materials';
import { canvasTexture as proceduralTexture } from './textures';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Asfalt, obrubníky a uliční vpusti. */
export function createRoad(road: RoadInfo, hm: Heightmap): THREE.Group {
  const g = new THREE.Group();
  const step = 2;
  const count = Math.floor((road.xMax - road.xMin) / step) + 1;
  const z0 = road.z - road.halfWidth;
  const z1 = road.z + road.halfWidth;
  const surf = (x: number, z: number): number => hm.heightAt(x, z) + 0.02;

  // Asfaltový pás (dva vrcholy na řez) s jemnou barevnou variací.
  const pos = new Float32Array(count * 2 * 3);
  const col = new Float32Array(count * 2 * 3);
  const uv = new Float32Array(count * 2 * 2);
  const dirt = road.surface === 'dirt';
  const base = new THREE.Color(dirt ? 0x9a876a : 0x5a5d60);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = road.xMin + i * step;
    for (const [j, z] of [
      [0, z0],
      [1, z1],
    ] as const) {
      const k = (i * 2 + j) * 3;
      pos[k] = x;
      pos[k + 1] = surf(x, z);
      pos[k + 2] = z;
      uv[(i * 2 + j) * 2] = x / 6;
      uv[(i * 2 + j) * 2 + 1] = (j * road.halfWidth * 2) / 6;
      c.copy(base).multiplyScalar(0.92 + (dirt ? 0.2 : 0.12) * (0.5 + 0.5 * Math.sin(x * (dirt ? 0.9 : 0.37) + j * 1.7)));
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const cc = a + 2;
    const d = a + 3;
    idx.push(a, b, cc, cc, b, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = proceduralTexture(dirt ? 'dirt' : 'asphalt', 256);
  const asphalt = new THREE.Mesh(
    geo,
    matte({ vertexColors: true, map: tex ?? undefined, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  asphalt.receiveShadow = true;
  g.add(asphalt);

  // Přerušovaná středová čára na asfaltu.
  if (!dirt) {
    const dash = new THREE.PlaneGeometry(3, 0.12).rotateX(-Math.PI / 2);
    const white = matte({ color: 0xe8e8e2, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let x = road.xMin + 4; x < road.xMax - 4; x += 7) {
      const d = new THREE.Mesh(dash, white);
      d.position.set(x, surf(x + 1.5, road.z) + 0.01, road.z);
      g.add(d);
    }
  }

  if (road.curbHeight <= 0) return g; // polní cesta bez obrubníků a vpustí

  // Obrubníky: 2m segmenty jako instance.
  const segGeo = new THREE.BoxGeometry(step, road.curbHeight + 0.2, road.curbWidth);
  const curbs = new THREE.InstancedMesh(segGeo, lambert(0xb9b6ad), (count - 1) * 2);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < count - 1; i++) {
    const x = road.xMin + (i + 0.5) * step;
    for (const side of [-1, 1]) {
      const z = road.z + side * (road.halfWidth + road.curbWidth / 2);
      m.makeTranslation(x, surf(x, z) + road.curbHeight / 2 - 0.1, z);
      curbs.setMatrixAt(n++, m);
    }
  }
  curbs.instanceMatrix.needsUpdate = true;
  curbs.computeBoundingSphere();
  curbs.receiveShadow = true;
  g.add(curbs);

  // Uliční vpusti: litinová mříž.
  const grate = canvasTexture(64, 64, (x) => {
    x.fillStyle = '#2a2b2c';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#0d0e0f';
    for (let i = 0; i < 7; i++) x.fillRect(6 + i * 8, 6, 4, 52);
  });
  for (const inlet of road.inlets) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2),
      matte({ map: grate, polygonOffset: true, polygonOffsetFactor: -3 }),
    );
    plate.position.set(inlet.x, surf(inlet.x, inlet.z) + 0.004, inlet.z);
    g.add(plate);
  }
  return g;
}

/** Trafostanice s plechovými dveřmi a výstražnou tabulkou. */
export function createBuilding(b: BuildingInfo): THREE.Group {
  const g = new THREE.Group();
  g.position.set(b.x, b.groundY, b.z);
  const sink = 0.6; // základ zapuštěný pod terén (budova stojí na nejnižším rohu)
  const walls = new THREE.Mesh(new THREE.BoxGeometry(b.sizeX, b.height + sink, b.sizeZ), lambert(0xd3cbb9));
  walls.position.y = (b.height + sink) / 2 - sink;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.sizeX + 0.04, 0.35 + sink, b.sizeZ + 0.04), lambert(0x8e8a80));
  plinth.position.y = (0.35 + sink) / 2 - sink;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.sizeX + 0.3, 0.14, b.sizeZ + 0.3), lambert(0x4a4d4f));
  roof.position.y = b.height + 0.07;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.05, 0.04), lambert(0x5e6b5c));
  door.position.set(-0.6, 1.03, b.sizeZ / 2 + 0.02);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.27),
    matte({
      transparent: true,
      map: canvasTexture(128, 116, (x) => {
        x.fillStyle = '#f2b705';
        x.strokeStyle = '#111';
        x.lineWidth = 8;
        x.beginPath();
        x.moveTo(64, 8);
        x.lineTo(122, 110);
        x.lineTo(6, 110);
        x.closePath();
        x.fill();
        x.stroke();
        x.fillStyle = '#111';
        x.beginPath();
        x.moveTo(70, 34);
        x.lineTo(48, 72);
        x.lineTo(64, 72);
        x.lineTo(56, 100);
        x.lineTo(82, 58);
        x.lineTo(66, 58);
        x.closePath();
        x.fill();
      }),
    }),
  );
  sign.position.set(-0.6, 1.55, b.sizeZ / 2 + 0.045);
  g.add(walls, plinth, roof, door, sign);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** Dřevěný laťkový plot: sloupky, dvě příčky, plaňky jako instance. */
export function createFence(f: FenceInfo): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0x8a6a45, 'fence-wood');
  const postGeo = new THREE.BoxGeometry(0.09, 1, 0.09).translate(0, 0.5, 0);
  const posts = new THREE.InstancedMesh(postGeo, wood, f.posts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  f.posts.forEach((pt, i) => {
    m.compose(p.set(pt.x, pt.groundY - 0.3, pt.z), q.identity(), s.set(1, f.height + 0.4, 1));
    posts.setMatrixAt(i, m);
  });

  const pickets: THREE.Matrix4[] = [];
  const rails: THREE.Matrix4[] = [];
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < f.posts.length - 1; i++) {
    const a = f.posts[i];
    const b = f.posts[i + 1];
    const len = Math.hypot(b.x - a.x, b.groundY - a.groundY);
    const ang = Math.atan2(b.groundY - a.groundY, b.x - a.x);
    for (const hr of [0.3, f.height - 0.2]) {
      rails.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3((a.x + b.x) / 2, (a.groundY + b.groundY) / 2 + hr, a.z - 0.06),
          new THREE.Quaternion().setFromAxisAngle(zAxis, ang),
          new THREE.Vector3(len, 1, 1),
        ),
      );
    }
    const nP = Math.floor((b.x - a.x) / 0.16);
    for (let k = 1; k < nP; k++) {
      const x = a.x + (k / nP) * (b.x - a.x);
      const y = a.groundY + (k / nP) * (b.groundY - a.groundY);
      pickets.push(new THREE.Matrix4().makeTranslation(x, y + 0.05, a.z - 0.09));
    }
  }
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.03), wood, rails.length);
  rails.forEach((mm, i) => railMesh.setMatrixAt(i, mm));
  const picketMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, f.height - 0.05, 0.018).translate(0, (f.height - 0.05) / 2, 0), lambert(0x9c7a52, 'fence-picket'), pickets.length);
  pickets.forEach((mm, i) => picketMesh.setMatrixAt(i, mm));

  for (const mesh of [posts, railMesh, picketMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}

