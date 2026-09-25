/** Minimální matematika pro herní logiku – záměrně bez závislosti na three.js. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const copyVec3 = (out: Vec3, v: Vec3): Vec3 => {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
};

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const DEG = Math.PI / 180;

/**
 * Směr pohledu v herním rámci (x = východ, y = nahoru, z = jih).
 * yaw 0 = sever (−z), kladný yaw otáčí doleva; pitch > 0 = nahoru.
 */
export function lookDirection(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}
