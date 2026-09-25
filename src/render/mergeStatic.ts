import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Sdílené bílé materiály s barvou ve vrcholech (podle typu, textury a drsnosti). */
const vcMats = new Map<string, THREE.Material>();
function vcKey(src: THREE.MeshStandardMaterial): string {
  const std = src.isMeshStandardMaterial;
  return [src.type, src.map?.uuid ?? '-', src.bumpMap?.uuid ?? '-', src.bumpScale ?? 0, std ? src.roughness.toFixed(2) : 1, std ? src.metalness.toFixed(2) : 0, src.side, src.flatShading ?? false].join('|');
}
function vcMaterial(src: THREE.MeshStandardMaterial): THREE.Material {
  const key = vcKey(src);
  let m = vcMats.get(key);
  if (!m) {
    const c = src.clone();
    c.color.setHex(0xffffff);
    c.vertexColors = true;
    m = c;
    vcMats.set(key, m);
  }
  return m;
}

/** Materiál, jehož barvu jde zapéct do vrcholů (textura zůstává sdílená). */
function plainColor(mat: THREE.Material): THREE.Color | null {
  const m = mat as THREE.MeshStandardMaterial;
  if (!(m.isMeshStandardMaterial || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial)) return null;
  if (m.emissiveMap || m.alphaMap || m.normalMap || m.polygonOffset || m.alphaTest > 0) return null;
  if (m.onBeforeCompile.toString() !== THREE.Material.prototype.onBeforeCompile.toString()) return null;
  if (m.emissive && m.emissive.getHex() !== 0) return null;
  return m.color;
}

const CELL = 96; // statické kusy se slučují po dlaždicích, ať funguje frustum culling [m]

/**
 * Sloučí statické meshe skupiny podle materiálu (a dlaždice) do pár velkých meshí:
 * z desítek až stovek draw callů jich zbude jen hrstka. Instancované meshe, čáry
 * a průhledné plošky nechá, jak jsou.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o === root) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh) {
      if ((o as THREE.Line).isLine || (o as THREE.Points).isPoints) keep.push(o);
      return;
    }
    const mat = m.material as THREE.Material;
    if ((m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || mat.transparent || m.userData.noMerge) {
      keep.push(o);
      return;
    }
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    g.applyMatrix4(m.matrixWorld);
    g.computeBoundingSphere();
    const c = g.boundingSphere?.center ?? new THREE.Vector3();
    const cell = `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`;
    const base = plainColor(mat);
    let bucketMat = mat;
    let key: string;
    if (base) {
      // Barva materiálu → barva vrcholů; všechny jednobarevné kusy pak sdílí jeden materiál.
      const cnt = g.getAttribute('position').count;
      const own = g.getAttribute('color') as THREE.BufferAttribute | undefined;
      const arr = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) {
        arr[i * 3] = base.r * (own ? own.getX(i) : 1);
        arr[i * 3 + 1] = base.g * (own ? own.getY(i) : 1);
        arr[i * 3 + 2] = base.b * (own ? own.getZ(i) : 1);
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      bucketMat = vcMaterial(mat as THREE.MeshStandardMaterial);
      key = `vc:${bucketMat.uuid}|${cell}`;
    } else key = `${mat.uuid}|${!!g.getAttribute('color')}|${cell}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: bucketMat, geos: [], cast: false, receive: false }));
    b.geos.push(g);
    b.cast ||= m.castShadow;
    b.receive ||= m.receiveShadow;
  });
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
    for (const g of b.geos) if (g !== merged) g.dispose();
  }
  // Ponechané objekty přeneseme i s jejich světovou maticí.
  for (const o of keep) {
    o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
    o.updateMatrix();
    o.matrixAutoUpdate = false;
    out.add(o);
  }
  return out;
}
