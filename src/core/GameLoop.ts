export interface LoopHandlers {
  /** Jednou za snímek: vstup, rozhlížení, UI akce. */
  beforeSteps(dt: number): void;
  /** Pevný krok simulace (fyzika, pohyb). */
  step(dt: number): void;
  /** Vykreslení; alpha = podíl do dalšího kroku pro interpolaci. */
  render(alpha: number, dt: number): void;
}

/**
 * Smyčka s pevným krokem simulace a interpolovaným vykreslováním.
 * Fyzika běží stejně na 60 Hz i 120 Hz displejích.
 */
export class GameLoop {
  private acc = 0;
  private last = -1;
  private raf = 0;
  private running = false;

  constructor(
    private readonly fixedDt: number,
    private readonly maxSubSteps: number,
    private readonly handlers: LoopHandlers,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    // Po návratu z pozadí (zamčený telefon) nesmí simulace „doskočit“ sekundy.
    const dt = this.last < 0 ? this.fixedDt : Math.min((now - this.last) / 1000, 0.25);
    this.last = now;

    this.handlers.beforeSteps(dt);
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.fixedDt && n < this.maxSubSteps) {
      this.handlers.step(this.fixedDt);
      this.acc -= this.fixedDt;
      n++;
    }
    if (n === this.maxSubSteps && this.acc > this.fixedDt) this.acc = 0;
    this.handlers.render(this.acc / this.fixedDt, dt);
  };
}
