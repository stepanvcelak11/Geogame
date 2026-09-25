import type { Vec3 } from '../core/math';
import type { World } from '../world/World';

export type LinkState = 'off' | 'search' | 'locked' | 'lost';
export type LinkEvent = { kind: 'locked' } | { kind: 'notFound'; reason: string } | { kind: 'lost'; reason: string };

export const LINK_RANGE = 600; // dosah rádia i vyhledání hranolu [m]
const SEARCH_TIME = 2.6; // PowerSearch: stanice se otočí dokola [s]
const CHECK_EVERY = 0.1;

const BLOCKER: Record<string, string> = {
  crown: 'koruna stromu',
  trunk: 'kmen stromu',
  prop: 'budova nebo plot',
  terrain: 'terén',
  vehicle: 'dodávka',
};

/** Je mezi středem stanice a hranolem volno? Vrací název překážky, nebo null. */
export function lineBlocker(center: Vec3, prism: Vec3, world: World): string | null {
  const dx = prism.x - center.x;
  const dy = prism.y - center.y;
  const dz = prism.z - center.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > LINK_RANGE) return 'mimo dosah';
  const d = { x: dx / dist, y: dy / dist, z: dz / dist };
  const hit = world.raycast(center, d, dist - 0.05);
  return hit ? (BLOCKER[hit.kind] ?? 'překážka') : null;
}

/**
 * Rádiové spojení tabletu na výtyčce s robotickou stanicí a zámek na hranol (ATR + LOCK).
 * Stanice se natáčí za hranolem; když se mezi ně něco postaví, zámek se ztratí.
 */
export class RoboticLink {
  state: LinkState = 'off';
  aimYaw = 0; // natočení dalekohledu (herní konvence yaw)
  private timer = 0;
  private check = 0;

  constructor(initialYaw: number) {
    this.aimYaw = initialYaw;
  }

  startSearch(): void {
    this.state = 'search';
    this.timer = SEARCH_TIME;
  }

  update(dt: number, center: Vec3, prism: Vec3 | null, world: World): LinkEvent | null {
    const yawTo = prism ? Math.atan2(-(prism.x - center.x), -(prism.z - center.z)) : this.aimYaw;
    if (this.state === 'search') {
      this.timer -= dt;
      this.aimYaw += dt * ((Math.PI * 2) / SEARCH_TIME); // otočka dokola
      if (this.timer > 0) return null;
      const blocker = prism ? lineBlocker(center, prism, world) : 'výtyčka není u tebe';
      if (!prism || blocker) {
        this.state = 'off';
        return { kind: 'notFound', reason: blocker ?? 'překážka' };
      }
      this.state = 'locked';
      this.aimYaw = yawTo;
      return { kind: 'locked' };
    }
    if (this.state !== 'locked') return null;
    // Sledování: dalekohled jede za hranolem.
    let dy = yawTo - this.aimYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.aimYaw += dy * Math.min(1, dt * 12);
    this.check -= dt;
    if (this.check > 0) return null;
    this.check = CHECK_EVERY;
    const blocker = prism ? lineBlocker(center, prism, world) : 'výtyčka není u tebe';
    if (blocker) {
      this.state = 'lost';
      return { kind: 'lost', reason: blocker };
    }
    return null;
  }
}
