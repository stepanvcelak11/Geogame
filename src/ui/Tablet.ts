import type { ExportFormat } from '../survey/PointExport';
import { clamp } from '../core/math';
import type { MapLayers, MapOverlay, MapRenderer, MapView } from './MapRenderer';

export type TabletTab = 'job' | 'map' | 'station' | 'points';

export interface PanelRow {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  tone: 'pending' | 'ok' | 'bad' | 'info' | 'active';
  button?: { id: string; label: string };
}

export interface JobPanel {
  steps?: { text: string; done: boolean }[]; // postup krok za krokem
  title: string;
  subtitle?: string;
  brief?: string;
  rows: PanelRow[];
  footer?: string;
  actions: { id: string; label: string; primary?: boolean }[];
}

export interface PointRow {
  id: string;
  solution: string;
  main: string;
  detail: string;
  good: boolean | null;
}

export interface TabletState {
  place: string;
  clock: string;
  bar: { day: string; money: string; gnss: string | null; radio: string | null; battery: number };
  job: JobPanel;
  station: JobPanel;
  showStation: boolean;
  points: PointRow[];
  overlay: MapOverlay;
}

/**
 * Terénní tablet: mapa (tažení = posun, dva prsty / kolečko = zoom), zakázky a zápisník bodů.
 * Hra při otevřeném tabletu stojí – geodet se dívá do mapy, ne pod nohy.
 */
export class Tablet {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly view: MapView = { cx: 0, cz: 0, scale: 2 };
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private open = false;
  private followPlayer = true;
  private tab: TabletTab = 'job';
  private readonly panelKeys = new Map<string, string>();
  private layers: MapLayers = { ortofoto: false, contours: true, katastr: true, points: true };
  private pointsKey = '';
  private map: MapRenderer;
  onAction: ((id: string) => void) | null = null;
  onCopyPoints: (() => void) | null = null;
  onDownloadPoints: ((format: ExportFormat) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement, map: MapRenderer) {
    this.map = map;
    this.el = document.createElement('div');
    this.el.className = 'tablet';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="tablet-body one-view">
        <header class="tablet-bar">
          <div class="tablet-tabs" role="tablist">
            <button role="tab" data-tab="job" aria-selected="true">Zakázka</button>
            <button role="tab" data-tab="map" aria-selected="false">Mapa</button>
            <button role="tab" data-tab="station" aria-selected="false">Stanice</button>
            <button role="tab" data-tab="points" aria-selected="false"><span class="tab-points-label">Body</span></button>
          </div>
          <span class="tb-place"></span>
          <span class="tb-ind"></span>
          <span class="tb-clock"></span>
          <button class="tablet-close" aria-label="Zavřít tablet">Zavřít</button>
        </header>
        <div class="tablet-view tablet-map" data-view="map" hidden>
          <canvas aria-label="Mapa okolí"></canvas>
          <div class="map-tools">
            <button data-z="in" aria-label="Přiblížit">+</button>
            <button data-z="out" aria-label="Oddálit">−</button>
            <button data-z="me">Na mě</button>
            <button class="layers-btn" aria-expanded="false">Vrstvy</button>
          </div>
          <div class="map-layers" role="group" aria-label="Vrstvy mapy" hidden>
            <button data-layer="ortofoto" aria-pressed="false">Ortofoto</button>
            <button data-layer="contours" aria-pressed="true">Vrstevnice</button>
            <button data-layer="katastr" aria-pressed="true">Katastr</button>
            <button data-layer="points" aria-pressed="true">Body</button>
          </div>
          <div class="map-loading">Připravuji mapu…</div>
        </div>
        <div class="tablet-view tab-job panel-box" data-view="job">
          <div class="job-card">
            <h2 class="task-title"></h2>
            <p class="task-sub"></p>
            <ol class="task-steps"></ol>
            <p class="task-brief"></p>
            <ul class="task-list"></ul>
            <p class="task-progress"></p>
            <div class="task-actions"></div>
          </div>
        </div>
        <div class="tablet-view tab-station panel-box" data-view="station" hidden>
          <div class="job-card">
            <h2 class="task-title"></h2>
            <p class="task-sub"></p>
            <ol class="task-steps"></ol>
            <p class="task-brief"></p>
            <ul class="task-list"></ul>
            <p class="task-progress"></p>
            <div class="task-actions"></div>
          </div>
        </div>
        <div class="tablet-view tab-points" data-view="points" hidden>
          <div class="job-card">
            <div class="point-export">
              <button class="copy-points">Kopírovat CSV</button>
              <span class="point-export-label">Uložit</span>
              <button data-export="csv">CSV</button>
              <button data-export="txt">TXT</button>
              <button data-export="dxf">DXF</button>
            </div>
            <ul class="point-list"></ul>
            <p class="point-empty">Zatím nic. Vezmi GNSS rover nebo výtyčku, postav hrot na bod a změř ho.</p>
          </div>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas') as HTMLCanvasElement;

    this.el.querySelector('.tablet-close')?.addEventListener('click', () => this.close());
    this.el.querySelectorAll<HTMLButtonElement>('.map-tools button').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.z === 'in') this.zoom(1.6);
        else if (b.dataset.z === 'out') this.zoom(1 / 1.6);
        else this.followPlayer = true;
      }),
    );
    this.el.querySelector('.copy-points')?.addEventListener('click', () => this.onCopyPoints?.());
    this.el.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((b) =>
      b.addEventListener('click', () => this.onDownloadPoints?.(b.dataset.export as ExportFormat)),
    );
    const lb = this.el.querySelector('.layers-btn') as HTMLButtonElement;
    lb.addEventListener('click', () => {
      const box = this.el.querySelector('.map-layers') as HTMLElement;
      box.hidden = !box.hidden;
      lb.setAttribute('aria-expanded', String(!box.hidden));
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.layer as keyof MapLayers;
        this.layers = { ...this.layers, [k]: !this.layers[k] };
        b.setAttribute('aria-pressed', String(this.layers[k]));
        this.map.setLayers(this.layers);
        this.ensureBuilt();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.showTab((b.dataset.tab as TabletTab) ?? 'job')),
    );
    // Všechna tlačítka zakázky (v řádcích i dole) posílají své ID do hry.
    this.el.querySelectorAll('.panel-box').forEach((box) =>
      box.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
        if (btn && !btn.disabled) this.onAction?.(btn.dataset.act ?? '');
      }),
    );
    this.bindGestures();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Nová lokalita = nový mapový podklad. */
  setMap(map: MapRenderer): void {
    this.map = map;
    this.map.setLayers(this.layers);
    this.followPlayer = true;
  }

  showTab(tab: TabletTab): void {
    this.tab = tab;
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === tab)));
    this.el.querySelectorAll<HTMLElement>('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== tab));
    if (tab === 'map') this.ensureBuilt();
  }

  /** Zobrazí mapu vystředěnou na bod (např. cíl zakázky). */
  focus(x: number, z: number): void {
    this.followPlayer = false;
    this.view.cx = x;
    this.view.cz = z;
    this.view.scale = Math.max(this.view.scale, 3);
    this.showTab('map');
  }

  show(): void {
    this.open = true;
    this.el.hidden = false;
    this.followPlayer = true;
    this.panelKeys.clear();
    this.showTab(this.tab === 'station' || this.tab === 'points' ? this.tab : 'job');
    this.ensureBuilt();
  }

  /** Podklad mapy se počítá jen jednou (a po změně vrstev); napřed ukázat „Připravuji mapu…“. */
  private ensureBuilt(): void {
    const loading = this.el.querySelector('.map-loading') as HTMLElement;
    if (this.map.ready) {
      loading.hidden = true;
      return;
    }
    loading.hidden = false;
    setTimeout(() => {
      this.map.build();
      loading.hidden = true;
    }, 30);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    this.onClose?.();
  }

  update(state: TabletState): void {
    if (!this.open) return;
    (this.el.querySelector('.tb-place') as HTMLElement).textContent = `${state.place} · ${state.bar.day} · ${state.bar.money}`;
    (this.el.querySelector('.tb-clock') as HTMLElement).textContent = state.clock;
    const b = state.bar;
    const ind = [b.gnss ? `<span class="ind">GNSS ${b.gnss}</span>` : '', b.radio ? `<span class="ind">Rádio ${b.radio}</span>` : '', `<span class="batt${b.battery < 20 ? ' is-low' : ''}"><i style="width:${Math.round(b.battery)}%"></i></span><span class="ind">${Math.round(b.battery)} %</span>`].join('');
    const indEl = this.el.querySelector('.tb-ind') as HTMLElement;
    if (indEl.dataset.k !== ind) {
      indEl.dataset.k = ind;
      indEl.innerHTML = ind;
    }
    this.renderPanel('.tab-job', state.job);
    this.renderPanel('.tab-station', state.station);
    const stTab = this.el.querySelector('[data-tab="station"]') as HTMLElement;
    stTab.hidden = !state.showStation;
    if (!state.showStation && this.tab === 'station') this.showTab('job');
    this.renderPoints(state.points);
    if (!this.map.ready || this.tab !== 'map') return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    if (this.followPlayer) {
      this.view.cx = state.overlay.player.x;
      this.view.cz = state.overlay.player.z;
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.map.draw(ctx, w, h, this.view, state.overlay);
  }

  private renderPanel(rootSel: string, j: JobPanel): void {
    const key = JSON.stringify(j);
    if (key === this.panelKeys.get(rootSel)) return;
    this.panelKeys.set(rootSel, key);
    const root = this.el.querySelector(rootSel) as HTMLElement;
    const q = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
    q('.task-title').textContent = j.title;
    const steps = q('.task-steps');
    steps.hidden = !j.steps?.length;
    steps.replaceChildren(
      ...(j.steps ?? []).map((st) => {
        const li = document.createElement('li');
        li.className = st.done ? 'is-done' : '';
        li.textContent = st.text;
        return li;
      }),
    );
    const firstOpen = steps.querySelector('li:not(.is-done)');
    firstOpen?.classList.add('is-now');
    q('.task-sub').textContent = j.subtitle ?? '';
    q('.task-sub').hidden = !j.subtitle;
    q('.task-brief').textContent = j.brief ?? '';
    q('.task-brief').hidden = !j.brief;
    q('.task-progress').textContent = j.footer ?? '';
    q('.task-progress').hidden = !j.footer;
    q('.task-list').replaceChildren(
      ...j.rows.map((r) => {
        const li = document.createElement('li');
        li.className = `task-row is-${r.tone}`;
        const main = document.createElement('div');
        main.className = 'task-main';
        const t = document.createElement('strong');
        t.textContent = r.title;
        const sub = document.createElement('span');
        sub.textContent = r.subtitle;
        main.append(t, sub);
        const st = document.createElement('span');
        st.className = 'task-status';
        st.textContent = r.status;
        li.append(main, st);
        if (r.button) {
          const b = document.createElement('button');
          b.dataset.act = r.button.id;
          b.textContent = r.button.label;
          li.append(b);
        }
        return li;
      }),
    );
    q('.task-actions').replaceChildren(
      ...j.actions.map((a) => {
        const b = document.createElement('button');
        b.dataset.act = a.id;
        b.className = a.primary ? 'act-primary' : 'act-secondary';
        b.textContent = a.label;
        return b;
      }),
    );
  }

  private renderPoints(points: PointRow[]): void {
    const tab = this.el.querySelector('.tab-points-label') as HTMLElement;
    tab.textContent = points.length ? `Body ${points.length}` : 'Body';
    const key = points.map((p) => p.id).join('|');
    if (key === this.pointsKey) return;
    this.pointsKey = key;
    (this.el.querySelector('.point-empty') as HTMLElement).hidden = points.length > 0;
    (this.el.querySelector('.point-list') as HTMLElement).replaceChildren(
      ...[...points].reverse().map((p) => {
        const li = document.createElement('li');
        li.className = `point-row${p.good === true ? ' is-good' : p.good === false ? ' is-bad' : ''}`;
        const head = document.createElement('div');
        head.className = 'point-head';
        const id = document.createElement('strong');
        id.textContent = p.id;
        const sol = document.createElement('span');
        sol.className = 'point-sol';
        sol.textContent = p.solution;
        head.append(id, sol);
        const main = document.createElement('span');
        main.className = 'point-main';
        main.textContent = p.main;
        const detail = document.createElement('span');
        detail.className = 'point-detail';
        detail.textContent = p.detail;
        li.append(head, main, detail);
        return li;
      }),
    );
  }

  private zoom(f: number): void {
    this.view.scale = clamp(this.view.scale * f, 0.6, 12);
  }

  private bindGestures(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* nevadí */
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinchDist = this.currentPinch();
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.followPlayer = false;
        this.view.cx -= (e.clientX - p.x) / this.view.scale;
        this.view.cz -= (e.clientY - p.y) / this.view.scale;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 2) {
        const d = this.currentPinch();
        if (this.pinchDist > 0) this.zoom(d / this.pinchDist);
        this.pinchDist = d;
      }
    });
    const end = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      this.pinchDist = 0;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false },
    );
  }

  private currentPinch(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
