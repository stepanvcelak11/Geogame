import { clamp } from '../core/math';
import type { SjtskFrame } from '../geodesy/CoordinateSystem';
import type { ReconStatus } from '../jobs/ReconTask';
import type { ControlMark, World } from '../world/World';
import { terrainColor } from '../render/TerrainView';

export interface MapLayers {
  ortofoto: boolean;
  contours: boolean;
  katastr: boolean;
  points: boolean;
}

export interface MapView {
  cx: number; // střed pohledu v herním rámci [m]
  cz: number;
  scale: number; // CSS px na metr
}

export interface MapOverlay {
  player: { x: number; z: number; yaw: number };
  status: (markId: string) => ReconStatus | null;
  points: { id: string; x: number; z: number }[]; // změřené body
  design: { id: string; x: number; z: number; done: boolean; selected: boolean }[]; // projektované body k vytyčení
  stakes: { x: number; z: number }[];
  vehicle: { x: number; z: number; yaw: number };
  station: { x: number; z: number; locked: boolean; px: number; pz: number } | null; // robotická stanice a záměra na hranol
}

const PPM = 2; // rozlišení podkladu [px/m]
const INK = '#23282c';
const PAPER = [241, 238, 228];
const FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';

/**
 * Mapový podklad ve stylu základní mapy: stínovaný reliéf, vrstevnice po 2 m
 * (zesílené po 10 m), les, ulice, budova, plot, hranice parcely.
 * Podklad se vykreslí jednou (líně při prvním otevření), přes něj se kreslí
 * mřížka S-JTSK, body a poloha hráče.
 */
export class MapRenderer {
  private base: HTMLCanvasElement | null = null;
  layers: MapLayers = { ortofoto: false, contours: true, katastr: true, points: true };

  /** Změna vrstev podkladu = přestavět ho při dalším zobrazení. */
  setLayers(l: MapLayers): void {
    const rebuild = l.ortofoto !== this.layers.ortofoto || l.contours !== this.layers.contours || l.katastr !== this.layers.katastr;
    this.layers = { ...l };
    if (rebuild) this.base = null;
  }

  private readonly frame: SjtskFrame;

  /** Rozlišení podkladu [px/m] a krok stínovaného reliéfu [m/px]: velká krajina hruběji. */
  private readonly ppm: number;
  private readonly mpp: number;

  constructor(private readonly world: World) {
    this.frame = world.frame;
    const big = world.heightmap.size > 600;
    this.ppm = big ? 0.6 : PPM;
    this.mpp = big ? 3 : 1;
  }

  get ready(): boolean {
    return this.base !== null;
  }

  build(): void {
    if (this.base) return;
    const hm = this.world.heightmap;
    const half = hm.half;
    const size = hm.size * this.ppm;
    const toPx = (v: number): number => (v + half) * this.ppm;

    // 1) Stínovaný reliéf v 1 px/m, pak zvětšit s vyhlazením.
    const lo = document.createElement('canvas');
    const R = Math.ceil(hm.size / this.mpp);
    lo.width = R;
    lo.height = R;
    const lctx = lo.getContext('2d');
    if (!lctx) return;
    const img = lctx.createImageData(R, R);
    const L = { x: -0.55, y: 0.72, z: -0.42 }; // světlo od severozápadu
    const plotR = this.world.flatRadius;
    const paint = { flatRadius: plotR, gravelYard: this.world.location === 'kancelar', fields: this.world.fields, water: this.world.water };
    for (let py = 0; py < R; py++) {
      for (let px = 0; px < R; px++) {
        const x = -half + (px + 0.5) * this.mpp;
        const z = -half + (py + 0.5) * this.mpp;
        const dx = (hm.heightAt(x + 1, z) - hm.heightAt(x - 1, z)) / 2;
        const dz = (hm.heightAt(x, z + 1) - hm.heightAt(x, z - 1)) / 2;
        const inv = 1 / Math.hypot(dx, 1, dz);
        const lit = (-dx * L.x + L.y - dz * L.z) * inv;
        const shade = clamp(0.93 + (lit - L.y) * 1.15, 0.74, 1.05);
        const site = plotR > 0 && Math.hypot(x, z) < plotR * 0.9 ? 1 : 0;
        const i = (py * R + px) * 4;
        if (this.layers.ortofoto) {
          // Ortofoto: stejné barvy jako 3D terén (lineární → sRGB), se stínováním.
          const c = terrainColor(x, z, hm.heightAt(x, z), Math.atan(Math.hypot(dx, dz)), paint);
          const s8 = (v: number): number => 255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
          img.data[i] = s8(c[0] * shade);
          img.data[i + 1] = s8(c[1] * shade);
          img.data[i + 2] = s8(c[2] * shade);
        } else {
          img.data[i] = (PAPER[0] - site * 8) * shade;
          img.data[i + 1] = (PAPER[1] - site * 14) * shade;
          img.data[i + 2] = (PAPER[2] - site * 26) * shade;
        }
        img.data[i + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);

    const base = document.createElement('canvas');
    base.width = size;
    base.height = size;
    const g = base.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = true;
    g.drawImage(lo, 0, 0, size, size);

    // 2) Les: sjednocené koruny + stromové značky.
    g.fillStyle = this.layers.ortofoto ? 'rgba(38, 66, 30, 0.78)' : 'rgba(176, 208, 150, 0.62)';
    g.beginPath();
    for (const t of this.world.trees) {
      g.moveTo(toPx(t.x) + t.crownR * this.ppm, toPx(t.z));
      g.arc(toPx(t.x), toPx(t.z), t.crownR * this.ppm, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = 'rgba(62, 100, 52, 0.55)';
    for (const t of this.world.trees) {
      g.beginPath();
      g.arc(toPx(t.x), toPx(t.z), t.kind === 'conifer' ? 1.3 : 1.8, 0, Math.PI * 2);
      g.fill();
    }

    // 2b) Pole (šrafa), voda, budovy.
    if (!this.layers.ortofoto) {
      for (const f of this.world.fields) {
        g.fillStyle = f.crop === 'plowed' ? 'rgba(150, 110, 70, 0.18)' : 'rgba(210, 180, 60, 0.2)';
        g.beginPath();
        f.corners.forEach((p, i) => (i ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z))));
        g.closePath();
        g.fill();
      }
    }
    for (const wt of this.world.water) {
      g.fillStyle = 'rgba(120, 170, 205, 0.9)';
      g.strokeStyle = 'rgba(40, 90, 140, 0.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(toPx(wt.x), toPx(wt.z), wt.rx * this.ppm, wt.rz * this.ppm, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    for (const sc of this.world.scenery) {
      if (!['house', 'office', 'garage', 'siteOffice', 'shed', 'toilet'].includes(sc.kind)) continue;
      g.fillStyle = this.layers.ortofoto ? (sc.kind === 'house' ? '#9a4630' : '#7d8286') : '#8d8a84';
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.fillRect(toPx(sc.x - sc.w / 2), toPx(sc.z - sc.d / 2), sc.w * this.ppm, sc.d * this.ppm);
      g.strokeRect(toPx(sc.x - sc.w / 2), toPx(sc.z - sc.d / 2), sc.w * this.ppm, sc.d * this.ppm);
    }

    // 3) Vrstevnice (marching squares na mříži heightmapy).
    if (this.layers.contours) {
    const H0 = this.frame.originH;
    const thin = new Path2D();
    const thick = new Path2D();
    const n = hm.n;
    const edge = (ax: number, az: number, ha: number, bx: number, bz: number, hb: number, lv: number): [number, number] => {
      const t = (lv - ha) / (hb - ha);
      return [toPx(ax + (bx - ax) * t), toPx(az + (bz - az) * t)];
    };
    for (let iz = 0; iz < n - 1; iz++) {
      for (let ix = 0; ix < n - 1; ix++) {
        const x0 = hm.vertexCoord(ix);
        const z0 = hm.vertexCoord(iz);
        const x1 = x0 + hm.cell;
        const z1 = z0 + hm.cell;
        const a = hm.vertexHeight(ix, iz) + H0;
        const b = hm.vertexHeight(ix + 1, iz) + H0;
        const c = hm.vertexHeight(ix + 1, iz + 1) + H0;
        const d = hm.vertexHeight(ix, iz + 1) + H0;
        const mn = Math.min(a, b, c, d);
        const mx = Math.max(a, b, c, d);
        for (let lv = Math.ceil(mn / 2) * 2; lv <= mx; lv += 2) {
          const pts: [number, number][] = [];
          if (a < lv !== b < lv) pts.push(edge(x0, z0, a, x1, z0, b, lv));
          if (b < lv !== c < lv) pts.push(edge(x1, z0, b, x1, z1, c, lv));
          if (c < lv !== d < lv) pts.push(edge(x1, z1, c, x0, z1, d, lv));
          if (d < lv !== a < lv) pts.push(edge(x0, z1, d, x0, z0, a, lv));
          const path = lv % 10 === 0 ? thick : thin;
          for (let k = 0; k + 1 < pts.length; k += 2) {
            path.moveTo(pts[k][0], pts[k][1]);
            path.lineTo(pts[k + 1][0], pts[k + 1][1]);
          }
        }
      }
    }
    g.strokeStyle = 'rgba(160, 105, 55, 0.55)';
    g.lineWidth = 0.9;
    g.stroke(thin);
    g.strokeStyle = 'rgba(150, 92, 42, 0.8)';
    g.lineWidth = 1.8;
    g.stroke(thick);

    }

    // Silnice krajiny.
    for (const l of this.world.lanes ?? []) {
      g.strokeStyle = INK;
      g.lineWidth = Math.max(3, l.halfWidth * 2 * this.ppm + 2);
      g.lineJoin = 'round';
      g.beginPath();
      l.pts.forEach((p, i) => (i ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z))));
      g.stroke();
      g.strokeStyle = '#f2d98a';
      g.lineWidth = Math.max(1.5, l.halfWidth * 2 * this.ppm);
      g.stroke();
    }
    for (const e of this.world.exits ?? []) {
      g.fillStyle = INK;
      g.font = `600 14px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(e.label, toPx(e.x), toPx(e.z) + (e.z > 0 ? -14 : 22));
    }

    // 4) Ulice s obrubníky a vpustmi / polní cesta čárkovaně.
    const r = this.world.road;
    g.fillStyle = r.surface === 'dirt' ? '#e7dcc0' : '#dcd6c8';
    g.fillRect(toPx(r.xMin), toPx(r.z - r.halfWidth), (r.xMax - r.xMin) * this.ppm, r.halfWidth * 2 * this.ppm);
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    if (r.surface === 'dirt') g.setLineDash([6, 4]);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(toPx(r.xMin), toPx(r.z + side * r.halfWidth));
      g.lineTo(toPx(r.xMax), toPx(r.z + side * r.halfWidth));
      g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = INK;
    for (const v of r.inlets) g.fillRect(toPx(v.x) - 1.5, toPx(v.z) - 1.5, 3, 3);

    // 5) Trafostanice.
    const bld = this.world.building;
    if (bld) {
    g.fillStyle = '#6d6a64';
    g.strokeStyle = INK;
    g.lineWidth = 1.2;
    g.fillRect(toPx(bld.x - bld.sizeX / 2), toPx(bld.z - bld.sizeZ / 2), bld.sizeX * this.ppm, bld.sizeZ * this.ppm);
    g.strokeRect(toPx(bld.x - bld.sizeX / 2), toPx(bld.z - bld.sizeZ / 2), bld.sizeX * this.ppm, bld.sizeZ * this.ppm);
    }

    // 6) Plot: linie s příčnými značkami na sloupcích.
    const posts = this.world.fence?.posts ?? [];
    g.strokeStyle = '#5b4328';
    g.lineWidth = 1.1;
    g.beginPath();
    posts.forEach((p, i) => (i ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z))));
    g.stroke();
    for (const p of posts) {
      g.beginPath();
      g.moveTo(toPx(p.x), toPx(p.z) - 3);
      g.lineTo(toPx(p.x), toPx(p.z) + 3);
      g.stroke();
    }

    // 7) Hranice parcel (katastrální mapa).
    for (const pc of this.layers.katastr ? this.world.parcels : []) {
      g.strokeStyle = 'rgba(176, 44, 34, 0.9)';
      g.lineWidth = 1.6;
      g.setLineDash([7, 4]);
      g.beginPath();
      pc.corners.forEach((p, i) => (i ? g.lineTo(toPx(p.x), toPx(p.z)) : g.moveTo(toPx(p.x), toPx(p.z))));
      g.closePath();
      g.stroke();
      g.setLineDash([]);
      const cx = pc.corners.reduce((s, p) => s + p.x, 0) / pc.corners.length;
      const cz = pc.corners.reduce((s, p) => s + p.z, 0) / pc.corners.length;
      g.fillStyle = 'rgba(176, 44, 34, 0.9)';
      g.font = `italic 600 20px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(pc.name, toPx(cx), toPx(cz));
    }
    this.base = base;
  }

  /** Vykreslí aktuální pohled do ctx (w × h v CSS px, ctx už je škálovaný na DPR). */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, view: MapView, overlay: MapOverlay): void {
    this.build();
    const half = this.world.heightmap.half;
    const s = view.scale;
    const sx = (x: number): number => w / 2 + (x - view.cx) * s;
    const sy = (z: number): number => h / 2 + (z - view.cz) * s;

    ctx.fillStyle = '#d9d5c9';
    ctx.fillRect(0, 0, w, h);
    if (this.base) {
      ctx.save();
      ctx.imageSmoothingEnabled = s < this.ppm * 2;
      ctx.translate(sx(-half), sy(-half));
      ctx.scale(s / this.ppm, s / this.ppm);
      ctx.drawImage(this.base, 0, 0);
      ctx.restore();
    }

    this.drawGrid(ctx, w, h, view, sx, sy);
    if (this.layers.points) {
      for (const m of this.world.marks) this.drawMark(ctx, m, sx(m.pos.x), sy(m.pos.z), overlay.status(m.id), s);
      this.drawDesign(ctx, overlay, sx, sy);
    }
    if (overlay.station) {
      const st = overlay.station;
      if (st.locked) {
        ctx.strokeStyle = 'rgba(242, 183, 5, 0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sx(st.x), sy(st.z));
        ctx.lineTo(sx(st.px), sy(st.pz));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const x = sx(st.x);
      const y = sy(st.z);
      ctx.fillStyle = '#f2b705';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 8, y + 6);
      ctx.lineTo(x - 8, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (this.layers.points) this.drawMeasured(ctx, overlay.points, sx, sy, s);
    this.drawVehicle(ctx, sx(overlay.vehicle.x), sy(overlay.vehicle.z), overlay.vehicle.yaw, s);
    this.drawPlayer(ctx, sx(overlay.player.x), sy(overlay.player.z), overlay.player.yaw, s);
    this.drawScaleBar(ctx, h, s);
  }

  /** Mřížka S-JTSK po 100 m (po 50 m při větším přiblížení) s popisem na okrajích. */
  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, view: MapView, sx: (x: number) => number, sy: (z: number) => number): void {
    const f = this.frame;
    const step = view.scale > 4 ? 50 : 100;
    const x0 = view.cx - w / 2 / view.scale;
    const x1 = view.cx + w / 2 / view.scale;
    const z0 = view.cz - h / 2 / view.scale;
    const z1 = view.cz + h / 2 / view.scale;
    ctx.strokeStyle = 'rgba(40, 70, 110, 0.35)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(30, 50, 80, 0.85)';
    ctx.font = `500 11px ${FONT}`;
    // Y roste k západu → svislé čáry x = Y0 − Y.
    for (let Y = Math.ceil((f.originY - x1) / step) * step; Y <= f.originY - x0; Y += step) {
      const px = Math.round(sx(f.originY - Y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Y ${Y}`, px + 3, 4);
    }
    // X roste k jihu → vodorovné čáry z = X − X0.
    for (let X = Math.ceil((f.originX + z0) / step) * step; X <= f.originX + z1; X += step) {
      const py = Math.round(sy(X - f.originX)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`X ${X}`, 4, py - 2);
    }
  }

  private drawMark(ctx: CanvasRenderingContext2D, m: ControlMark, x: number, y: number, status: ReconStatus | null, scale: number): void {
    const big = m.type === 'TB';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#fbfaf5';

    // Zvýraznění bodů zakázky.
    if (status === 'pending') {
      ctx.strokeStyle = '#e08a00';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, big ? 13 : 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = INK;
    }

    ctx.beginPath();
    switch (m.type) {
      case 'TB':
      case 'ZhB': {
        const r = big ? 8 : 6;
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.87, y + r * 0.5);
        ctx.lineTo(x - r * 0.87, y + r * 0.5);
        ctx.closePath();
        break;
      }
      case 'NZ':
        ctx.rect(x - 4, y - 4, 8, 8);
        break;
      default:
        ctx.arc(x, y, m.type === 'HZ' ? 3 : 4.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();

    if (status === 'found' || status === 'reportedMissing') {
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = status === 'found' ? '#2f7d32' : '#c0392b';
      ctx.beginPath();
      if (status === 'found') {
        ctx.moveTo(x + 7, y - 2);
        ctx.lineTo(x + 10, y + 2);
        ctx.lineTo(x + 16, y - 7);
      } else {
        ctx.moveTo(x + 8, y - 7);
        ctx.lineTo(x + 16, y + 1);
        ctx.moveTo(x + 16, y - 7);
        ctx.lineTo(x + 8, y + 1);
      }
      ctx.stroke();
    }

    // Popis: HZ jen při přiblížení.
    if (m.type !== 'HZ' || scale > 3) {
      ctx.font = `${status ? 700 : 500} ${big ? 13 : 12}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(251, 250, 245, 0.9)';
      const tx = x + (status === 'found' || status === 'reportedMissing' ? 19 : 10);
      ctx.strokeText(m.number, tx, y);
      ctx.fillStyle = INK;
      ctx.fillText(m.number, tx, y);
    }
  }

  /** Projektové body k vytyčení (fialově) a zatlučené kolíky. */
  private drawDesign(ctx: CanvasRenderingContext2D, o: MapOverlay, sx: (x: number) => number, sy: (z: number) => number): void {
    ctx.fillStyle = '#7a4a1e';
    for (const k of o.stakes) ctx.fillRect(sx(k.x) - 2.5, sy(k.z) - 2.5, 5, 5);
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const d of o.design) {
      const x = sx(d.x);
      const y = sy(d.z);
      ctx.strokeStyle = d.done ? '#2f7d32' : '#b0249a';
      ctx.lineWidth = d.selected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(251, 250, 245, 0.9)';
      ctx.strokeText(d.id, x + 10, y);
      ctx.fillStyle = d.done ? '#2f7d32' : '#b0249a';
      ctx.fillText(d.id, x + 10, y);
      ctx.fillStyle = '#7a4a1e';
    }
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    const l = Math.max(10, 4.9 * scale);
    const w = Math.max(5, 2 * scale);
    ctx.fillStyle = '#f2b705';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.fillRect(-w / 2, -l / 2, w, l);
    ctx.strokeRect(-w / 2, -l / 2, w, l);
    ctx.fillStyle = INK;
    ctx.fillRect(-w / 2, -l / 2, w, Math.max(2, l * 0.2)); // kabina vpředu
    ctx.restore();
  }

  /** Změřené body: modrý křížek, číslo až při přiblížení. */
  private drawMeasured(
    ctx: CanvasRenderingContext2D,
    pts: MapOverlay['points'],
    sx: (x: number) => number,
    sy: (z: number) => number,
    scale: number,
  ): void {
    ctx.strokeStyle = '#1f6fb5';
    ctx.fillStyle = '#1f6fb5';
    ctx.lineWidth = 2;
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const p of pts) {
      const x = sx(p.x);
      const y = sy(p.z);
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
      if (scale > 3) ctx.fillText(p.id, x + 5, y + 3);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number, scale: number): void {
    // Kruh nejistoty ±5 m (poloha jen z telefonu, ne z RTK).
    ctx.fillStyle = 'rgba(33, 120, 200, 0.15)';
    ctx.strokeStyle = 'rgba(33, 120, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(8, 5 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw); // yaw 0 = sever (nahoru), kladný = doleva
    ctx.fillStyle = '#1f6fb5';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D, h: number, scale: number): void {
    const target = 90 / scale;
    const len = [5, 10, 20, 25, 50, 100, 200].find((v) => v >= target) ?? 200;
    const px = len * scale;
    const x = 12;
    const y = h - 14;
    ctx.fillStyle = 'rgba(251, 250, 245, 0.85)';
    ctx.fillRect(x - 6, y - 20, px + 12, 28);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y - 3, px / 2, 4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - 3.5, px, 4);
    ctx.font = `500 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('0', x - 2, y - 7);
    ctx.textAlign = 'right';
    ctx.fillText(`${len} m`, x + px + 2, y - 7);
  }
}
