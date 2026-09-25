import * as THREE from 'three';

const cache = new Map<string, THREE.MeshLambertMaterial>();

/** Sdílené Lambert materiály – levné pro mobilní GPU a bez zbytečných kompilací shaderů. */
export function lambert(color: number, key = String(color)): THREE.MeshLambertMaterial {
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    cache.set(key, m);
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
