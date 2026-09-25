import { PlayerController, type MoveIntent } from '../player/PlayerController';
import type { World } from '../world/World';

export type HelperState = 'follow' | 'wait' | 'goto' | 'hold' | 'instrument';
export type HelperEvent = { kind: 'arrived'; purpose: 'hold' | 'instrument' } | { kind: 'detour' } | null;

/**
 * Pomocník (figurant): chodí po terénu stejnou fyzikou jako hráč, nosí výtyčku nebo lať,
 * drží ji na bodě, nebo stojí u přístroje. Bez hledání cesty: u překážky zkusí obejít stranou,
 * a když se zasekne, přejde to „oklikou“ (přesun o kus dál).
 */
export class Helper {
  readonly body: PlayerController;
  state: HelperState = 'follow';
  target: { x: number; z: number } | null = null;
  purpose: 'hold' | 'instrument' = 'hold';
  carryId: string | null = null; // co nese (výtyčka / lať)
  instrumentId: string | null = null;
  inVan = false;
  walkPhase = 0;
  private stuck = 0;
  private detour = 0;
  private detourSide = 1;
  private lastDist = Infinity;

  constructor(x: number, z: number, world: World) {
    this.body = new PlayerController({ x, z, yaw: 0 }, world);
  }

  get pos(): { x: number; y: number; z: number } {
    return this.body.pos;
  }

  teleport(x: number, z: number, world: World): void {
    const yaw = this.body.yaw;
    (this as { body: PlayerController }).body = new PlayerController({ x, z, yaw }, world);
    this.stuck = 0;
    this.lastDist = Infinity;
  }

  follow(): void {
    this.state = 'follow';
    this.target = null;
  }

  wait(): void {
    this.state = 'wait';
    this.target = null;
  }

  goTo(x: number, z: number, purpose: 'hold' | 'instrument'): void {
    this.state = 'goto';
    this.target = { x, z };
    this.purpose = purpose;
    this.lastDist = Infinity;
    this.stuck = 0;
  }

  update(dt: number, world: World, player: { x: number; z: number }): HelperEvent {
    let ev: HelperEvent = null;
    const p = this.body.pos;
    let goal: { x: number; z: number } | null = null;
    let stopAt = 0;
    if (this.state === 'follow') {
      goal = player;
      stopAt = 2.2;
    } else if (this.state === 'goto' && this.target) {
      goal = this.target;
      stopAt = this.purpose === 'hold' ? 0.75 : 1.1; // stojí vedle výtyčky / u stativu
    }
    const intent: MoveIntent = { forward: 0, right: 0, sprint: false, jump: false };
    if (goal) {
      const dx = goal.x - p.x;
      const dz = goal.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > stopAt) {
        let yaw = Math.atan2(-dx, -dz);
        // Uvízl u překážky → chvíli obchází stranou.
        if (this.detour > 0) {
          this.detour -= dt;
          yaw += this.detourSide * 1.1;
        }
        this.body.yaw = yaw;
        intent.forward = 1;
        intent.sprint = dist > 14;
        this.stuck += dt;
        if (this.stuck > 1.5) {
          if (this.lastDist - dist < 0.4) {
            this.detour = 1.2;
            this.detourSide = -this.detourSide;
            ev = { kind: 'detour' };
            if (this.lastDist - dist < 0.05 && dist > stopAt + 1) {
              // Úplně zaseklý: přejde oklikou o kus blíž k cíli.
              const k = Math.min(4, dist - stopAt) / dist;
              this.teleport(p.x + dx * k, p.z + dz * k, world);
            }
          }
          this.stuck = 0;
          this.lastDist = dist;
        }
      } else {
        this.stuck = 0;
        this.lastDist = Infinity;
        if (this.state === 'goto') {
          this.state = this.purpose === 'hold' ? 'hold' : 'instrument';
          ev = { kind: 'arrived', purpose: this.purpose };
          this.body.yaw = Math.atan2(-dx, -dz);
        }
      }
    }
    this.body.step(dt, intent, world);
    this.walkPhase += Math.hypot(this.body.vel.x, this.body.vel.z) * dt * 3.2;
    return ev;
  }
}
