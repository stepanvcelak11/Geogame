import { CONFIG } from '../config';

export type Action = 'jump' | 'use' | 'drop' | 'light' | 'crouch' | 'map' | 'switch' | 'debug' | 'controller';

/** Snímek vstupu – co hráč chce, bez ohledu na zařízení. */
export interface InputFrame {
  forward: number;
  right: number;
  sprint: boolean;
  lookX: number; // rad
  lookY: number; // rad
  actions: ReadonlySet<Action>;
}

const KEY_ACTIONS: Record<string, Action> = {
  Space: 'jump',
  KeyE: 'use',
  KeyG: 'drop',
  KeyF: 'light',
  KeyC: 'crouch',
  KeyM: 'map',
  KeyK: 'controller',
  KeyQ: 'switch',
  Tab: 'map',
  F3: 'debug',
};
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/**
 * Sjednocuje klávesnici/myš (ladění na PC) a dotykové ovládání (hlavní platforma).
 * Klávesy čteme přes e.code, takže WASD sedí i na české QWERTZ klávesnici.
 */
export class Input {
  private readonly keys = new Set<string>();
  private pending = new Set<Action>();
  lookScale = 1; // citlivost z nastavení
  invertY = false;
  private lookX = 0;
  private lookY = 0;
  private touchForward = 0;
  private touchRight = 0;
  private touchSprint = false;
  pointerLocked = false;
  onPointerLockChange: ((locked: boolean) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      this.onPointerLockChange?.(this.pointerLocked);
    });
  }

  requestPointerLock(): void {
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      /* prohlížeč pointer lock nepodporuje – nevadí */
    }
  }

  // --- Vstupy z dotykové vrstvy
  setTouchMove(right: number, forward: number, sprint: boolean): void {
    this.touchRight = right;
    this.touchForward = forward;
    this.touchSprint = sprint;
  }

  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  press(action: Action): void {
    this.pending.add(action);
  }

  /** Vrátí vstup za snímek a vynuluje jednorázové akce a pohyb kamery. */
  consume(): InputFrame {
    const k = this.keys;
    const kbF = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const kbR = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const frame: InputFrame = {
      forward: kbF !== 0 ? kbF : this.touchForward,
      right: kbR !== 0 ? kbR : this.touchRight,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight') || this.touchSprint,
      lookX: this.lookX * this.lookScale,
      lookY: this.lookY * this.lookScale * (this.invertY ? -1 : 1),
      actions: this.pending,
    };
    this.pending = new Set();
    this.lookX = 0;
    this.lookY = 0;
    return frame;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    const a = KEY_ACTIONS[e.code];
    if (a && !e.repeat) this.pending.add(a);
    if (MOVE_KEYS.has(e.code) || e.code === 'F3' || e.code === 'Tab') e.preventDefault();
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    // Chrome občas po zamknutí vrátí obří skok – ořízneme ho.
    const mx = Math.max(-200, Math.min(200, e.movementX));
    const my = Math.max(-200, Math.min(200, e.movementY));
    this.lookX += mx * CONFIG.look.mouse;
    this.lookY += my * CONFIG.look.mouse;
  };
}
