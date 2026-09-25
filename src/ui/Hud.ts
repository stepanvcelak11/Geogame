import type { EventBus } from '../core/EventBus';
import type { GameEvents, InspectPayload } from '../events';
import type { SjtskCoord } from '../geodesy/CoordinateSystem';
import type { InteractionPrompt } from '../interaction/InteractionSystem';
import type { Hand } from '../items/items';

export interface HandsView {
  right: string | null;
  left: string | null;
  active: Hand;
  massKg: number;
}

export interface NavView {
  title: string; // „Vytyčuji 303“
  forward: number; // [m], záporně = vzad
  right: number; // [m], záporně = vlevo
  dist: number;
  close: boolean; // v toleranci
}

export interface GnssView {
  title?: string; // „GNSS“ / „Totálka“
  solution: string; // popisek řešení
  tone: 'fix' | 'float' | 'bad';
  detail: string; // satelity, PDOP, přesnost
  last: string | null; // poslední změřený bod
}

const RETICLE = `
<svg viewBox="-50 -50 100 100" aria-hidden="true">
  <g class="r-shadow">
    <path d="M-44 0H-7M7 0H44M0 -44V-7M0 7V44M-8 -24H8M-8 24H8"/>
  </g>
  <g class="r-line">
    <path d="M-44 0H-7M7 0H44M0 -44V-7M0 7V44M-8 -24H8M-8 24H8"/>
  </g>
  <circle class="r-dot" r="1.6"/>
</svg>`;

/** DOM HUD. Nezná herní objekty – jen zobrazuje, co dostane. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly q = <T extends HTMLElement>(sel: string): T => this.el.querySelector(sel) as T;
  private promptKey = '';
  private handsKey = '';
  private toastTimer = 0;
  private inspectVisible = false;
  private touchMode = false;
  onHandTap: ((hand: Hand) => void) | null = null;
  onInspectClose: (() => void) | null = null;
  onOpenTablet: (() => void) | null = null;
  onCodeTap: (() => void) | null = null;
  onHelper: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onBubbleDrag: ((dx: number, dy: number, radiusPx: number) => void) | null = null;
  onBubbleTap: (() => void) | null = null;
  onBipod: (() => void) | null = null;
  private navKey = '';

  constructor(root: HTMLElement, bus: EventBus<GameEvents>) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="reticle">${RETICLE}</div>
      <div class="prompt" hidden><kbd>E</kbd><span class="prompt-text"></span></div>
      <nav class="topbtns" aria-label="Nabídka">
        <button class="map-btn" aria-label="Otevřít tablet s mapou">Tablet<kbd>M</kbd></button><button class="helper-btn" aria-label="Vysílačka: pomocník Pepa">Pepa</button><button class="gear-btn" aria-label="Nastavení">⚙</button>
      </nav>
      <section class="panel pos" aria-label="Přibližná poloha">
        <h2><span class="pos-title">Poloha</span> <span class="pos-acc muted">±5 m</span><span class="gnss-badge" hidden></span></h2>
        <dl>
          <dt>Y</dt><dd class="pos-y">–</dd>
          <dt>X</dt><dd class="pos-x">–</dd>
          <dt>H</dt><dd class="pos-h">–</dd>
          <dt>Směr</dt><dd class="pos-b">–</dd>
        </dl>
        <p class="gnss-detail" hidden></p>
        <p class="gnss-last" hidden></p>
        <button class="code-chip" hidden aria-label="Změnit kód bodu"></button>
      </section>
      <section class="panel hands" aria-label="Ruce">
        <button class="hand" data-hand="left"><span class="hand-side">Levá</span><span class="hand-item">volná</span></button>
        <button class="hand" data-hand="right"><span class="hand-side">Pravá</span><span class="hand-item">volná</span></button>
        <p class="hand-mass"></p>
      </section>
      <div class="toast" role="status" hidden></div>
      <button class="goal" hidden aria-label="Co dál: nápověda dalšího kroku"><span class="goal-arrow" hidden>↑</span><span class="goal-dist" hidden></span><span class="goal-t"></span></button>
      <section class="nav" hidden aria-live="polite">
        <p class="nav-title"></p>
        <p class="nav-row"><span class="nav-arrow nav-f"></span><span class="nav-f-txt"></span></p>
        <p class="nav-row"><span class="nav-arrow nav-r"></span><span class="nav-r-txt"></span></p>
      </section>
      <button class="bipod-btn" hidden aria-pressed="false">Dvojnožka</button>
      <div class="vial" hidden aria-label="Libela výtyčky: táhni bublinu do kroužku">
        <div class="vial-ring"></div>
        <div class="vial-bubble"></div>
        <span class="vial-label">Táhni bublinu do kroužku</span>
      </div>
      <div class="speedo" hidden><span class="speedo-val">0</span><span class="speedo-unit">km/h</span></div>
      <aside class="inspect" hidden>
        <p class="inspect-sub"></p>
        <h2 class="inspect-title"></h2>
        <dl class="inspect-rows"></dl>
        <p class="inspect-desc"></p>
        <button class="inspect-close">Zavřít</button>
      </aside>
      <div class="fps" hidden></div>
      <div class="lock-hint" hidden>Klikni do scény a pokračuj</div>`;
    root.appendChild(this.el);

    bus.on('toast', ({ text, tone }) => this.toast(text, tone));
    bus.on('inspect', (p) => this.openInspect(p));
    this.el.querySelectorAll<HTMLButtonElement>('.hand').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onHandTap?.(b.dataset.hand as Hand);
      }),
    );
    // Libela: tažení bubliny = srovnání výtyčky.
    const vial = this.q('.vial');
    let last: { x: number; y: number; id: number } | null = null;
    let moved = 0;
    vial.addEventListener('pointerdown', (e) => {
      moved = 0;
      e.preventDefault();
      e.stopPropagation();
      try {
        vial.setPointerCapture(e.pointerId);
      } catch {
        /* nevadí */
      }
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    vial.addEventListener('pointermove', (e) => {
      if (!last || e.pointerId !== last.id) return;
      moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
      this.onBubbleDrag?.(e.clientX - last.x, e.clientY - last.y, vial.getBoundingClientRect().width / 2);
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    const endVial = (): void => {
      if (last && moved < 6) this.onBubbleTap?.(); // klepnutí = zhruba srovnat
      last = null;
    };
    vial.addEventListener('pointerup', endVial);
    vial.addEventListener('pointercancel', endVial);
    this.q('.code-chip').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onCodeTap?.();
    });
    this.q('.bipod-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onBipod?.();
    });
    this.q('.goal').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.q('.goal').classList.toggle('is-min');
    });
    this.q('.gear-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onSettings?.();
    });
    this.q('.helper-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onHelper?.();
    });
    this.q('.map-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onOpenTablet?.();
    });
    this.q('.inspect-close').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeInspect();
    });
  }

  setTouchMode(on: boolean): void {
    this.touchMode = on;
    this.el.classList.toggle('is-touch', on);
    this.promptKey = '';
  }

  /** decimals = 0 pro orientační polohu, 2 pro polohu hrotu z GNSS. */
  setPosition(c: SjtskCoord, bearingGon: number, decimals = 0): void {
    this.q('.pos-y').textContent = c.Y.toFixed(decimals);
    this.q('.pos-x').textContent = c.X.toFixed(decimals);
    this.q('.pos-h').textContent = `${c.H.toFixed(decimals)} m`;
    this.q('.pos-b').textContent = `${Math.round(bearingGon) % 400} gon`;
  }

  /** Režim GNSS roveru: panel polohy ukazuje hrot výtyčky a stav řešení. null = orientační poloha. */
  setGnss(g: GnssView | null): void {
    const panel = this.q('.pos');
    panel.classList.toggle('is-gnss', !!g);
    this.q('.pos-title').textContent = g ? (g.title ?? 'GNSS') : 'Poloha';
    this.q('.pos-acc').hidden = !!g;
    const badge = this.q('.gnss-badge');
    badge.hidden = !g;
    const detail = this.q('.gnss-detail');
    detail.hidden = !g;
    const last = this.q('.gnss-last');
    last.hidden = !g?.last;
    if (!g) return;
    badge.textContent = g.solution;
    badge.dataset.tone = g.tone;
    detail.textContent = g.detail;
    last.textContent = g.last ?? '';
  }

  setPrompt(p: InteractionPrompt | null): void {
    const key = p ? `${p.verb}|${p.target}|${p.available}|${p.reason ?? ''}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    this.q('.reticle').classList.toggle('is-focus', !!p && p.available);
    const box = this.q('.prompt');
    if (!p) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.toggle('is-blocked', !p.available);
    this.q('.prompt-text').textContent = p.available ? `${p.verb} ${p.target}` : (p.reason ?? `${p.verb} ${p.target}`);
  }

  /** Kód bodu pro měření (jen u zakázky zaměření). */
  setCode(label: string | null): void {
    const c = this.q('.code-chip');
    c.hidden = !label;
    if (label && c.textContent !== `Kód: ${label}`) c.textContent = `Kód: ${label}`;
  }

  /** Navigace k vytyčovanému bodu, jako v kontroleru: vpřed/vzad a vpravo/vlevo vůči směru chůze. */
  setNav(n: NavView | null): void {
    const box = this.q('.nav');
    box.hidden = !n;
    if (!n) return;
    const f = (v: number): string => (Math.abs(v) < 1 ? `${Math.round(Math.abs(v) * 1000)} mm` : `${Math.abs(v).toFixed(2).replace('.', ',')} m`);
    const key = `${n.title}|${f(n.forward)}|${f(n.right)}|${n.close}`;
    if (key === this.navKey) return;
    this.navKey = key;
    box.classList.toggle('is-close', n.close);
    this.q('.nav-title').textContent = n.close ? `${n.title}: jsi na bodě` : `${n.title}, ${f(n.dist)}`;
    this.q('.nav-f').textContent = n.forward >= 0 ? '↑' : '↓';
    this.q('.nav-f-txt').textContent = `${n.forward >= 0 ? 'Vpřed' : 'Vzad'} ${f(n.forward)}`;
    this.q('.nav-r').textContent = n.right >= 0 ? '→' : '←';
    this.q('.nav-r-txt').textContent = `${n.right >= 0 ? 'Vpravo' : 'Vlevo'} ${f(n.right)}`;
  }

  /** Průvodce „Co dál?“ – klepnutím se sbalí / rozbalí. */
  setGoal(text: string | null, pointer: { angle: number; dist: number } | null = null): void {
    const g = this.q('.goal');
    g.hidden = !text;
    const arrow = this.q('.goal-arrow');
    const dist = this.q('.goal-dist');
    arrow.hidden = dist.hidden = !pointer;
    if (pointer) {
      arrow.style.transform = `rotate(${pointer.angle.toFixed(3)}rad)`;
      dist.textContent = pointer.dist < 1000 ? `${Math.round(pointer.dist)} m` : `${(pointer.dist / 1000).toFixed(1).replace('.', ',')} km`;
    }
    if (text && this.q('.goal-t').textContent !== text) {
      this.q('.goal-t').textContent = text;
      g.classList.add('is-new');
      setTimeout(() => g.classList.remove('is-new'), 900);
    }
  }

  /** Libela výtyčky: bublina v násobcích poloměru (−1…1), null = skrýt. */
  setBubble(b: { x: number; y: number; inCircle: boolean } | null): void {
    const v = this.q('.vial');
    v.hidden = !b;
    if (!b) return;
    v.classList.toggle('is-ok', b.inCircle);
    const bub = this.q('.vial-bubble');
    bub.style.left = `${50 + b.x * 42}%`;
    bub.style.top = `${50 + b.y * 42}%`;
    bub.style.transform = 'translate(-50%, -50%)';
  }

  /** Tlačítko dvojnožky u libely (null = skryté). */
  setBipod(on: boolean | null): void {
    const b = this.q('.bipod-btn');
    b.hidden = on === null;
    if (on !== null) {
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? 'Na dvojnožce' : 'Dvojnožka';
    }
  }

  /** Tachometr při jízdě; null = pěšky. */
  setDrive(kmh: number | null): void {
    const s = this.q('.speedo');
    s.hidden = kmh === null;
    this.el.classList.toggle('is-driving', kmh !== null);
    if (kmh !== null) this.q('.speedo-val').textContent = String(Math.round(Math.abs(kmh)));
  }

  setHands(h: HandsView): void {
    const key = `${h.left}|${h.right}|${h.active}|${h.massKg}`;
    if (key === this.handsKey) return;
    this.handsKey = key;
    for (const side of ['left', 'right'] as const) {
      const b = this.q(`.hand[data-hand="${side}"]`);
      const name = h[side];
      const sideName = side === 'left' ? 'Levá' : 'Pravá';
      b.classList.toggle('is-full', !!name);
      b.classList.toggle('is-active', side === h.active);
      b.setAttribute('aria-pressed', String(side === h.active));
      (b.querySelector('.hand-side') as HTMLElement).textContent = side === h.active ? `${sideName}, aktivní` : sideName;
      (b.querySelector('.hand-item') as HTMLElement).textContent = name ?? 'volná';
      b.setAttribute('aria-label', `${sideName} ruka: ${name ?? 'volná'}. Klepnutím ji uděláš aktivní.`);
    }
    this.q('.hand-mass').textContent = h.massKg > 0 ? `Neseš ${h.massKg.toFixed(1).replace('.', ',')} kg` : '';
  }

  toast(text: string, tone: 'info' | 'warn' = 'info'): void {
    const t = this.q('.toast');
    t.textContent = text;
    t.classList.toggle('is-warn', tone === 'warn');
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (t.hidden = true), 2200);
  }

  openInspect(p: InspectPayload): void {
    this.q('.inspect-sub').textContent = p.subtitle;
    this.q('.inspect-title').textContent = p.title;
    const rows = this.q('.inspect-rows');
    rows.replaceChildren(
      ...p.rows.flatMap(([k, v]) => {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        return [dt, dd];
      }),
    );
    this.q('.inspect-desc').textContent = p.description;
    this.q('.inspect-close').textContent = this.touchMode ? 'Zavřít' : 'Zavřít (E)';
    this.q('.inspect').hidden = false;
    this.inspectVisible = true;
  }

  closeInspect(): void {
    if (!this.inspectVisible) return;
    this.q('.inspect').hidden = true;
    this.inspectVisible = false;
    this.onInspectClose?.();
  }

  get inspectOpen(): boolean {
    return this.inspectVisible;
  }

  setLockHint(v: boolean): void {
    this.q('.lock-hint').hidden = !v;
  }

  setFpsVisible(on: boolean): void {
    this.q('.fps').hidden = !on;
  }

  toggleFps(): void {
    const f = this.q('.fps');
    f.hidden = !f.hidden;
  }

  setFps(fps: number, pixelRatio: number): void {
    const f = this.q('.fps');
    if (!f.hidden) f.textContent = `${Math.round(fps)} FPS, rozlišení ×${pixelRatio.toFixed(2)}`;
  }
}

/** Úvodní obrazovka. Tlačítko Začít je zároveň gesto pro fullscreen a zámek orientace. */
export function showStartScreen(root: HTMLElement, touch: boolean, onStart: () => void): void {
  const el = document.createElement('div');
  el.className = 'start';
  const controls = touch
    ? `<li><b>Levý palec</b><span>chůze, vytlačením nahoru na okraj běh</span></li>
       <li><b>Pravý palec</b><span>rozhlížení</span></li>
       <li><b>Žluté tlačítko</b><span>zvednout, prohlédnout, rozložit, změřit</span></li>
       <li><b>Ruce vpravo nahoře</b><span>klepnutím vybereš, se kterou věcí pracuješ</span></li>
       <li><b>Mapa</b><span>terénní tablet se zakázkou</span></li>`
    : `<li><b>W A S D</b><span>chůze, Shift běh</span></li>
       <li><b>Myš</b><span>rozhlížení</span></li>
       <li><b>E</b><span>zvednout, prohlédnout, použít věc v aktivní ruce</span></li>
       <li><b>Q, G</b><span>přepnout aktivní ruku, položit z ní věc</span></li>
       <li><b>M nebo Tab</b><span>terénní tablet s mapou a zakázkou</span></li>
       <li><b>Mezerník, C, F</b><span>skok, přikrčení, baterka</span></li>`;
  el.innerHTML = `
    <div class="start-card">
      <div class="start-mark">${RETICLE}</div>
      <h1>Geodet</h1>
      <p class="start-lead">Terénní simulátor. První zakázka: rekognoskace bodového pole před zaměřením staveniště.</p>
      <p class="start-task">Vybavení leží u dodávky. Otevři tablet, podle mapy obejdi body a každý prohlédni. Katalog je starý, takže ne všechno musí na místě být.</p>
      <ul class="start-controls">${controls}</ul>
      <button class="start-go">Začít</button>
      ${touch ? '<p class="start-rotate">Nejlíp se hraje na šířku.</p>' : ''}
    </div>`;
  root.appendChild(el);
  el.querySelector('.start-go')?.addEventListener('click', () => {
    el.remove();
    onStart();
  });
}
