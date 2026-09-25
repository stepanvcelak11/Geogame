import { CONFIG } from '../config';
import type { Vec3 } from '../core/math';
import type { World } from '../world/World';

export interface InteractionPrompt {
  verb: string; // „Zvednout“ – i popisek akčního tlačítka na mobilu
  target: string; // „stativ“
  available: boolean;
  reason?: string; // proč akce teď nejde
}

export interface Interactable {
  readonly id: string;
  readonly radius: number;
  center(): Vec3;
  isActive(): boolean;
  prompt(): InteractionPrompt;
  use(): void;
}

// Asistence míření: na dotykové obrazovce se nemíří tak přesně jako myší.
const AIM_ASSIST = Math.tan((3 * Math.PI) / 180);

/**
 * Výběr objektu paprskem ze středu obrazovky: průsečík s koulí kolem objektu,
 * pak kontrola přímé viditelnosti proti terénu a překážkám.
 */
export class InteractionSystem {
  private readonly targets = new Map<string, Interactable>();
  private current: Interactable | null = null;

  register(target: Interactable): void {
    this.targets.set(target.id, target);
  }

  get focused(): Interactable | null {
    return this.current;
  }

  update(eye: Vec3, dir: Vec3, world: World): void {
    const range = CONFIG.interaction.range;
    let best: Interactable | null = null;
    let bestT = Infinity;
    for (const it of this.targets.values()) {
      if (!it.isActive()) continue;
      const c = it.center();
      const ox = c.x - eye.x;
      const oy = c.y - eye.y;
      const oz = c.z - eye.z;
      const tca = ox * dir.x + oy * dir.y + oz * dir.z;
      if (tca < 0 || tca > range + it.radius) continue;
      const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
      const r = it.radius + tca * AIM_ASSIST;
      if (d2 > r * r) continue;
      const t = Math.max(0, tca - Math.sqrt(r * r - d2));
      if (t <= range && t < bestT) {
        best = it;
        bestT = t;
      }
    }

    if (best) {
      // Viditelnost měříme ke středu objektu, ne podél osy pohledu.
      const c = best.center();
      const vx = c.x - eye.x;
      const vy = c.y - eye.y;
      const vz = c.z - eye.z;
      const dist = Math.hypot(vx, vy, vz);
      const reach = dist - best.radius * 0.9;
      if (reach > 0.05) {
        const hit = world.raycast(eye, { x: vx / dist, y: vy / dist, z: vz / dist }, reach);
        if (hit) best = null;
      }
    }
    this.current = best;
  }

}
