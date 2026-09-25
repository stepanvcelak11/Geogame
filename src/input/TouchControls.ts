import { CONFIG } from '../config';
import type { Action, Input } from './Input';

/**
 * Dotykové ovládání: plovoucí joystick vlevo, rozhlížení tažením vpravo,
 * kontextové akční tlačítko (mění popisek podle cíle) a pomocná tlačítka.
 * Každý prst sledujeme podle pointerId, takže jde chodit a rozhlížet se zároveň.
 */
export class TouchControls {
  readonly el: HTMLElement;
  private readonly actionBtn: HTMLButtonElement;
  private readonly lightBtn: HTMLButtonElement;
  private readonly crouchBtn: HTMLButtonElement;
  private readonly dropBtn: HTMLButtonElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private movePointer: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private readonly lookPointers = new Map<number, { x: number; y: number }>();

  constructor(root: HTMLElement, private readonly input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `
      <div class="touch-zone touch-move"></div>
      <div class="touch-zone touch-look"></div>
      <div class="stick" hidden><div class="stick-knob"></div></div>
      <div class="touch-buttons">
        <div class="tb-extra">
          <button class="tb tb-small" data-action="light" aria-pressed="false">Světlo</button>
          <button class="tb tb-small" data-action="crouch" aria-pressed="false">Přikrčit</button>
          <button class="tb tb-small" data-action="jump">Skok</button>
        </div>
        <div class="tb-row">
          <button class="tb-more" aria-label="Další tlačítka" aria-expanded="false">⋯</button>
          <button class="tb tb-small" data-action="drop" hidden>Položit</button>
        </div>
        <button class="tb tb-action" data-action="use" disabled>Použít</button>
      </div>`;
    root.appendChild(this.el);

    this.stick = this.el.querySelector('.stick') as HTMLElement;
    this.knob = this.el.querySelector('.stick-knob') as HTMLElement;
    const more = this.el.querySelector('.tb-more') as HTMLButtonElement;
    more.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = !this.el.classList.contains('is-more');
      this.el.classList.toggle('is-more', open);
      more.setAttribute('aria-expanded', String(open));
    });
    this.actionBtn = this.el.querySelector('[data-action="use"]') as HTMLButtonElement;
    this.lightBtn = this.el.querySelector('[data-action="light"]') as HTMLButtonElement;
    this.crouchBtn = this.el.querySelector('[data-action="crouch"]') as HTMLButtonElement;
    this.dropBtn = this.el.querySelector('[data-action="drop"]') as HTMLButtonElement;

    this.bindMoveZone(this.el.querySelector('.touch-move') as HTMLElement);
    this.bindLookZone(this.el.querySelector('.touch-look') as HTMLElement);
    this.el.querySelectorAll<HTMLButtonElement>('.tb').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (b.disabled) return;
        this.input.press(b.dataset.action as Action);
        b.classList.add('is-down');
        navigator.vibrate?.(8);
      });
      const up = (): void => b.classList.remove('is-down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    // Bez dlouhého stisku / kontextového menu na iOS i Androidu.
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** V dodávce: joystick = plyn/brzda a volant, jen akční tlačítko. */
  setDriving(on: boolean): void {
    this.el.classList.toggle('is-driving', on);
  }

  setVisible(v: boolean): void {
    this.el.classList.toggle('is-on', v);
  }

  /** Popisek akčního tlačítka podle toho, na co hráč míří. */
  setAction(verb: string | null, available: boolean): void {
    const label = verb ?? 'Použít';
    if (this.actionBtn.textContent !== label) this.actionBtn.textContent = label;
    this.actionBtn.disabled = !verb || !available;
  }

  setToggles(light: boolean, crouched: boolean, holding: boolean): void {
    this.lightBtn.setAttribute('aria-pressed', String(light));
    this.crouchBtn.setAttribute('aria-pressed', String(crouched));
    this.dropBtn.hidden = !holding;
  }

  private bindMoveZone(zone: HTMLElement): void {
    const R = CONFIG.touch.joystickRadius;
    zone.addEventListener('pointerdown', (e) => {
      if (this.movePointer !== null) return;
      e.preventDefault();
      capture(zone, e.pointerId);
      this.movePointer = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
      this.stick.hidden = false;
      this.stick.style.transform = `translate(${e.clientX - R}px, ${e.clientY - R}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.movePointer) return;
      let dx = e.clientX - this.moveOrigin.x;
      let dy = e.clientY - this.moveOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, d / R);
      this.input.setTouchMove(dx / R, -dy / R, mag >= CONFIG.touch.sprintThreshold && dy < -R * 0.5);
      this.stick.classList.toggle('is-sprint', mag >= CONFIG.touch.sprintThreshold && dy < -R * 0.5);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.stick.hidden = true;
      this.stick.classList.remove('is-sprint');
      this.input.setTouchMove(0, 0, false);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private bindLookZone(zone: HTMLElement): void {
    const s = CONFIG.look.touch;
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(zone, e.pointerId);
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    zone.addEventListener('pointermove', (e) => {
      const last = this.lookPointers.get(e.pointerId);
      if (!last) return;
      this.input.addLook((e.clientX - last.x) * s, (e.clientY - last.y) * s);
      last.x = e.clientX;
      last.y = e.clientY;
    });
    const end = (e: PointerEvent): void => {
      this.lookPointers.delete(e.pointerId);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}

/** Zachycení prstu na zónu; některé prohlížeče u zrušených dotyků hází výjimku. */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* prst už neexistuje – nevadí */
  }
}
