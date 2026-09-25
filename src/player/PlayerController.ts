import { CONFIG } from '../config';
import { clamp, copyVec3, DEG, lerp, vec3, type Vec3 } from '../core/math';
import type { World } from '../world/World';

export interface MoveIntent {
  forward: number; // −1 … 1
  right: number; // −1 … 1
  sprint: boolean;
  jump: boolean;
}

/**
 * Kinematický FPV controller: válec proti heightmapě a kolizním objektům.
 * Čistá logika – kameru nastavuje až renderovací vrstva.
 */
export class PlayerController {
  readonly pos: Vec3; // chodidla
  readonly prevPos: Vec3;
  readonly vel = vec3();
  yaw: number;
  pitch = 0;
  grounded = false;
  crouched = false;
  crouchT = 0; // 0 = stojí, 1 = přikrčený
  onSteepSlope = false;
  loadFactor = 1; // zpomalení nesenou zátěží
  stepCount = 0; // přibývá s každým krokem (zvuk kroků)
  private bobPhase = 0;
  private bobAmount = 0;

  constructor(spawn: { x: number; z: number; yaw: number }, world: World) {
    this.pos = vec3(spawn.x, world.heightmap.heightAt(spawn.x, spawn.z), spawn.z);
    this.prevPos = { ...this.pos };
    this.yaw = spawn.yaw;
  }

  /** Rozhlížení v radiánech (kladné dx = doprava, kladné dy = dolů). */
  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -CONFIG.look.maxPitch, CONFIG.look.maxPitch);
  }

  toggleCrouch(): void {
    this.crouched = !this.crouched;
  }

  get eyeHeight(): number {
    return lerp(CONFIG.player.eyeStand, CONFIG.player.eyeCrouch, this.crouchT);
  }

  step(dt: number, intent: MoveIntent, world: World): void {
    const P = CONFIG.player;
    const hm = world.heightmap;
    copyVec3(this.prevPos, this.pos);

    this.crouchT += clamp((this.crouched ? 1 : 0) - this.crouchT, -dt * 6, dt * 6);

    // Požadovaný směr v rovině.
    let f = intent.forward;
    let r = intent.right;
    const l = Math.hypot(f, r);
    if (l > 1) {
      f /= l;
      r /= l;
    }
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    let wx = -s * f + c * r;
    let wz = -c * f - s * r;

    const sprinting = intent.sprint && !this.crouched && f > 0.1;
    let speed = (this.crouched ? P.crouchSpeed : sprinting ? P.sprintSpeed : P.walkSpeed) * this.loadFactor;

    // Svah: do kopce zpomalí, přes limit se nedá vyšlápnout a sklouzává se.
    let ux = 0;
    let uz = 0;
    this.onSteepSlope = false;
    if (this.grounded) {
      const g = hm.gradientAt(this.pos.x, this.pos.z);
      const gl = Math.hypot(g.dx, g.dz);
      if (gl > 1e-4) {
        ux = g.dx / gl;
        uz = g.dz / gl;
        const slope = Math.atan(gl);
        this.onSteepSlope = slope > P.maxSlopeDeg * DEG;
        const uphill = wx * ux + wz * uz;
        if (uphill > 0) {
          speed *= 1 - 0.45 * clamp((slope - 12 * DEG) / (28 * DEG), 0, 1) * uphill;
          if (this.onSteepSlope) {
            wx -= ux * uphill;
            wz -= uz * uphill;
          }
        }
      }
    }

    const k = 1 - Math.exp(-(this.grounded ? P.groundResponse : P.airResponse) * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.onSteepSlope) {
      const up = this.vel.x * ux + this.vel.z * uz;
      if (up > 0) {
        this.vel.x -= ux * up;
        this.vel.z -= uz * up;
      }
      this.vel.x -= ux * P.gravity * 0.5 * dt;
      this.vel.z -= uz * P.gravity * 0.5 * dt;
    }

    if (intent.jump && this.grounded && !this.onSteepSlope) {
      this.vel.y = P.jumpSpeed;
      this.grounded = false;
    }
    this.vel.y -= P.gravity * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Překážky (kmeny, auto): vytlačit a ořezat rychlost do kontaktu.
    const height = lerp(P.heightStand, P.heightCrouch, this.crouchT);
    const res = world.resolveCircle(this.pos, P.radius, this.pos.y, this.pos.y + height);
    if (res.hit) {
      const vn = this.vel.x * res.nx + this.vel.z * res.nz;
      if (vn < 0) {
        this.vel.x -= vn * res.nx;
        this.vel.z -= vn * res.nz;
      }
    }

    const lim = hm.half - 3;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);

    // Terén: přistání a přilepení při chůzi z kopce.
    const gy = hm.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    } else if (this.grounded && this.vel.y <= 0 && this.pos.y - gy < P.groundSnap) {
      this.pos.y = gy;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }

    // Pohupování hlavy: půl periody na krok (~0,8 m).
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded) {
      const before = Math.floor(this.bobPhase / Math.PI);
      this.bobPhase += (hs / 0.8) * Math.PI * dt;
      if (Math.floor(this.bobPhase / Math.PI) !== before && hs > 0.6) this.stepCount++;
    }
    this.bobAmount += ((this.grounded ? clamp(hs / P.sprintSpeed, 0, 1) : 0) - this.bobAmount) * Math.min(1, dt * 8);
  }

  /** Interpolovaná pozice oka pro vykreslení. */
  eyePosition(alpha: number, out: Vec3): Vec3 {
    const a = this.bobAmount;
    out.x = lerp(this.prevPos.x, this.pos.x, alpha) + Math.cos(this.bobPhase) * 0.025 * a * Math.cos(this.yaw);
    out.y = lerp(this.prevPos.y, this.pos.y, alpha) + this.eyeHeight + Math.sin(this.bobPhase * 2) * 0.035 * a;
    out.z = lerp(this.prevPos.z, this.pos.z, alpha) - Math.cos(this.bobPhase) * 0.025 * a * Math.sin(this.yaw);
    return out;
  }
}
