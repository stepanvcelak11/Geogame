import * as THREE from 'three';

/**
 * Kvalita materiálů. Realistická = fyzikální (PBR) materiály, které odrážejí oblohu
 * (scene.environment); úsporná = levné Lambert materiály pro slabé telefony.
 * Nastavuje se jednou před stavbou scény (změna se projeví po restartu).
 */
let realistic = true;

export function setRealisticMaterials(on: boolean): void {
  realistic = on;
}

export function realisticMaterials(): boolean {
  return realistic;
}

export type MatteMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
type MatteParams = THREE.MeshStandardMaterialParameters & THREE.MeshLambertMaterialParameters;

/** Matný materiál (omítka, tráva, dřevo, plast): PBR s vysokou drsností, nebo Lambert. */
export function matte(p: MatteParams = {}): MatteMaterial {
  if (!realistic) return new THREE.MeshLambertMaterial(p);
  return new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...p });
}

const cache = new Map<string, MatteMaterial>();

/** Sdílené matné materiály podle barvy (bez zbytečných kompilací shaderů). */
export function lambert(color: number, key = String(color)): MatteMaterial {
  let m = cache.get(key);
  if (!m) {
    m = matte({ color });
    cache.set(key, m);
  }
  return m;
}

/**
 * Materiál s vlastní drsností a kovovostí (lakovaný plast přístrojů, hliník, sklo).
 * V úsporném režimu Phong s odleskem, ať kov pořád trochu svítí.
 */
export function pbr(color: number, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}): THREE.Material {
  const key = `pbr:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
  let m = cache.get(key) as THREE.Material | undefined;
  if (!m) {
    m = realistic
      ? new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
      : new THREE.MeshPhongMaterial({ color, shininess: Math.round((1 - roughness) * 90), specular: metalness > 0.5 ? 0x999999 : 0x333333 });
    cache.set(key, m as MatteMaterial);
  }
  return m;
}

export const PALETTE = {
  surveyYellow: 0xf2b705,
  stakeRed: 0xc8362b,
  white: 0xf2f2ee,
  granite: 0x8f8d88,
  concrete: 0xa8a59c,
  metal: 0x9aa0a6,
  darkMetal: 0x2e3236,
  wood: 0xb88a52,
  rubber: 0x1c1d1e,
  glass: 0x324650,
} as const;
