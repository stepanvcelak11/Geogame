import { clamp } from '../core/math';
import type { Surface, VehicleState, World } from '../world/World';

export interface DriveIntent {
  throttle: number; // −1 … 1 (záporně = brzda / couvání)
  steer: number; // −1 … 1 (kladně = doprava)
}

const WHEELBASE = 3.0;
const MAX_STEER = 0.55; // rad
/** Rychlostní strop podle povrchu [m/s]: 50 km/h asfalt, 32 polní cesta, 20 tráva. */
const MAX_SPEED: Record<Surface, number> = { road: 13.9, dirt: 8.9, site: 6.5, grass: 5.6 };
const ROLLING: Record<Surface, number> = { road: 0.6, dirt: 1.0, site: 1.4, grass: 1.8 };
const REVERSE_MAX = 3.0;

/**
 * Jízda dodávky: kinematický model jízdního kola na heightmapě.
 * Kolize: dva kruhy (předek, záď) proti kmenům, budově a plotu.
 */
export class VehicleController {
  constructor(private readonly v: VehicleState) {}

  get state(): VehicleState {
    return this.v;
  }

  step(dt: number, intent: DriveIntent, world: World): void {
    const v = this.v;
    const hm = world.heightmap;
    const surface = world.surfaceAt(v.x, v.z);
    const fwd = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) };

    // Podélná síla: plyn, brzda, couvání, valivý odpor, svah.
    let a = 0;
    const th = clamp(intent.throttle, -1, 1);
    if (th > 0) a = v.speed >= -0.2 ? 2.6 * th : 7.5 * th; // při couvání plyn brzdí
    else if (th < 0) a = v.speed > 0.2 ? 7.5 * th : 1.8 * th;
    const roll = ROLLING[surface] * Math.sign(v.speed);
    if (th === 0 || Math.sign(th) !== Math.sign(v.speed)) a -= Math.abs(v.speed) < 0.05 ? 0 : roll;
    const g = hm.gradientAt(v.x, v.z);
    a -= 9.81 * (g.dx * fwd.x + g.dz * fwd.z) * 0.7;
    v.speed += a * dt;
    if (th === 0 && Math.abs(v.speed) < 0.08) v.speed = 0;
    v.speed = clamp(v.speed, -REVERSE_MAX, MAX_SPEED[surface]);

    // Řízení: plný rejd jen pomalu, ve vyšší rychlosti menší.
    const target = clamp(intent.steer, -1, 1) * MAX_STEER * (1 - Math.min(Math.abs(v.speed) / 22, 0.6));
    v.steer += (target - v.steer) * Math.min(1, dt * 6);
    v.yaw -= ((v.speed * Math.tan(v.steer)) / WHEELBASE) * dt;

    v.x += fwd.x * v.speed * dt;
    v.z += fwd.z * v.speed * dt;

    // Kolize předku a zádi.
    const nf = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) };
    let hit = false;
    for (const off of [1.45, -1.45]) {
      const p = { x: v.x + nf.x * off, z: v.z + nf.z * off };
      const gy = hm.heightAt(p.x, p.z);
      const r = world.colliders.resolveCircle(p, 1.0, gy + 0.3, gy + v.height);
      if (r.hit) {
        v.x = p.x - nf.x * off;
        v.z = p.z - nf.z * off;
        hit = true;
      }
    }
    if (hit) v.speed *= -0.15;

    const lim = hm.half - 6;
    v.x = clamp(v.x, -lim, lim);
    v.z = clamp(v.z, -lim, lim);

    // Usazení na terén: náklon podle kol.
    const hF = hm.heightAt(v.x + nf.x * 1.5, v.z + nf.z * 1.5);
    const hB = hm.heightAt(v.x - nf.x * 1.5, v.z - nf.z * 1.5);
    const rt = { x: Math.cos(v.yaw), z: -Math.sin(v.yaw) };
    const hR = hm.heightAt(v.x + rt.x * 0.85, v.z + rt.z * 0.85);
    const hL = hm.heightAt(v.x - rt.x * 0.85, v.z - rt.z * 0.85);
    v.groundY = (hF + hB + hR + hL) / 4;
    v.pitch = Math.atan2(hF - hB, 3.0);
    v.roll = Math.atan2(hR - hL, 1.7);
  }
}
