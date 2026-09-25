import * as THREE from 'three';

/**
 * Procedurální textury kreslené na canvas – žádné soubory ke stažení.
 * Každá se vyrobí jednou a sdílí; bez DOM (testy v Node) vrací null.
 */
const cache = new Map<string, THREE.Texture | null>();

function hash(i: number): number {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Kreslení textur – veřejné, aby šly zkontrolovat jako obrázky i bez WebGL. */
export const DRAW: Record<string, (g: CanvasRenderingContext2D, s: number) => void> = {
  /** Stíny mraků: měkké tmavé skvrny, dlaždicově navazující (kreslí se i přes okraje). */
  cloudShadow(g, s) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    let k = 77;
    for (let i = 0; i < 16; i++) {
      const x = hash(k++) * s;
      const y = hash(k++) * s;
      const r = s * (0.08 + hash(k++) * 0.16);
      for (const ox of [-s, 0, s])
        for (const oy of [-s, 0, s]) {
          const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          gr.addColorStop(0, 'rgba(255,255,255,0.9)');
          gr.addColorStop(0.6, 'rgba(255,255,255,0.45)');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
    }
  },
  /** Detail trávníku: šedé skvrny a stébla, násobí se barvou terénu (průměr ≈ 1). */
  grass(g, s) {
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, s, s);
    let k = 1;
    for (let i = 0; i < 2600; i++) {
      const x = hash(k++) * s;
      const y = hash(k++) * s;
      const v = 150 + Math.floor(hash(k++) * 105);
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      g.lineWidth = 1 + hash(k++) * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (hash(k++) - 0.5) * 4, y - 3 - hash(k++) * 7);
      g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const v = 185 + Math.floor(hash(k++) * 70);
      g.fillStyle = `rgba(${v},${v},${v - 10},0.35)`;
      g.beginPath();
      g.arc(hash(k++) * s, hash(k++) * s, 3 + hash(k++) * 9, 0, Math.PI * 2);
      g.fill();
    }
  },
  /** Hlína / štěrk staveniště. */
  dirt(g, s) {
    g.fillStyle = '#cfcfcf';
    g.fillRect(0, 0, s, s);
    let k = 7;
    for (let i = 0; i < 3200; i++) {
      const v = 120 + Math.floor(hash(k++) * 135);
      g.fillStyle = `rgba(${v},${v},${v},0.6)`;
      const r = 0.6 + hash(k++) * 2.4;
      g.beginPath();
      g.arc(hash(k++) * s, hash(k++) * s, r, 0, Math.PI * 2);
      g.fill();
    }
  },
  /** Asfalt se zrnem a opravovanými plochami. */
  asphalt(g, s) {
    g.fillStyle = '#bdbdbd';
    g.fillRect(0, 0, s, s);
    let k = 99;
    for (let i = 0; i < 5000; i++) {
      const v = 150 + Math.floor(hash(k++) * 105);
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      g.fillRect(hash(k++) * s, hash(k++) * s, 1.2, 1.2);
    }
    g.fillStyle = 'rgba(90,90,90,0.25)';
    g.fillRect(s * 0.1, s * 0.55, s * 0.35, s * 0.22);
    g.strokeStyle = 'rgba(40,40,40,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(s * 0.6, 0);
    g.bezierCurveTo(s * 0.7, s * 0.3, s * 0.5, s * 0.6, s * 0.65, s);
    g.stroke();
  },
  /** Stébla trávy s průhledností (trsy u hráče). */
  blades(g, s) {
    g.clearRect(0, 0, s, s);
    let k = 3;
    for (let i = 0; i < 70; i++) {
      const x = s * 0.08 + hash(k++) * s * 0.84;
      const hgt = s * (0.45 + hash(k++) * 0.5);
      const lean = (hash(k++) - 0.5) * s * 0.25;
      const v = 140 + Math.floor(hash(k++) * 115);
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 1.5 + hash(k++) * 2;
      g.beginPath();
      g.moveTo(x, s);
      g.quadraticCurveTo(x + lean * 0.3, s - hgt * 0.6, x + lean, s - hgt);
      g.stroke();
    }
  },
  /** Luční kvítí: stonky a barevné korunky (barvy jsou v textuře). */
  flowers(g, s) {
    g.clearRect(0, 0, s, s);
    let k = 41;
    const colors = ['#ffffff', '#f7e04a', '#b58ad8', '#ffffff', '#f2a0b8', '#fdf6c9'];
    for (let i = 0; i < 9; i++) {
      const x = s * 0.1 + hash(k++) * s * 0.8;
      const top = s * (0.4 + hash(k++) * 0.3);
      g.strokeStyle = '#5b7f3b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, s);
      g.lineTo(x + (hash(k++) - 0.5) * 8, top);
      g.stroke();
      g.fillStyle = colors[Math.floor(hash(k++) * colors.length)];
      const r = 7 + hash(k++) * 5;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * r * 0.8, top + Math.sin(a) * r * 0.8, r * 0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#e8b830';
      g.beginPath();
      g.arc(x, top, r * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  },
  /** Omítka s jemnou strukturou. */
  plaster(g, s) {
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, s, s);
    let k = 11;
    for (let i = 0; i < 2000; i++) {
      const v = 200 + Math.floor(hash(k++) * 55);
      g.fillStyle = `rgba(${v},${v},${v},0.4)`;
      g.fillRect(hash(k++) * s, hash(k++) * s, 2, 2);
    }
  },
  /** Fasáda s okny (dvě okna na dlaždici, tmavé sklo s rámem). */
  windows(g, s) {
    DRAW.plaster(g, s);
    for (const cx of [0.25, 0.75]) {
      const x = s * (cx - 0.13);
      const y = s * 0.28;
      g.fillStyle = '#f7f7f7';
      g.fillRect(x - 3, y - 3, s * 0.26 + 6, s * 0.38 + 6);
      g.fillStyle = '#44525c';
      g.fillRect(x, y, s * 0.26, s * 0.38);
      g.fillStyle = 'rgba(200,220,235,0.35)';
      g.fillRect(x + 2, y + 2, s * 0.1, s * 0.15);
      g.fillStyle = '#f7f7f7';
      g.fillRect(x + s * 0.125, y, 3, s * 0.38);
    }
  },
  /** Střešní tašky. */
  tiles(g, s) {
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, s, s);
    const rows = 16;
    for (let r = 0; r < rows; r++) {
      const y = (r * s) / rows;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y + s / rows - 3, s, 3);
      for (let c = 0; c < 8; c++) {
        const x = ((c + (r % 2) * 0.5) * s) / 8;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x, y, 2, s / rows);
      }
    }
  },
  /** Dřevěná prkna. */
  planks(g, s) {
    g.fillStyle = '#d6d6d6';
    g.fillRect(0, 0, s, s);
    let k = 21;
    for (let i = 0; i < 8; i++) {
      const x = (i * s) / 8;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, 0, 2, s);
      for (let j = 0; j < 30; j++) {
        g.strokeStyle = `rgba(0,0,0,${0.05 + hash(k++) * 0.1})`;
        g.beginPath();
        const px = x + 3 + hash(k++) * (s / 8 - 6);
        g.moveTo(px, 0);
        g.lineTo(px + (hash(k++) - 0.5) * 3, s);
        g.stroke();
      }
    }
  },
  /** Vlnitý plech (sklad, buňka). */
  metal(g, s) {
    for (let x = 0; x < s; x++) {
      const v = 190 + Math.round(40 * Math.sin((x / s) * Math.PI * 24));
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, 0, 1, s);
    }
  },
};

export function canvasTexture(name: keyof typeof DRAW, size = 256, repeat = true): THREE.Texture | null {
  const key = `${name}:${size}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (typeof document === 'undefined') {
    cache.set(key, null);
    return null;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;
  DRAW[name](g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  // Šedé detailní textury násobí barvu materiálu → lineární data, žádný převod ze sRGB
  // (jinak by 0,85 šedé ztmavilo terén na ~0,66).
  cache.set(key, t);
  return t;
}

/** Cedule s nápisem. */
export function signTexture(text: string, bg = '#1f4e79', fg = '#ffffff'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#f2b705';
  g.fillRect(0, 84, 512, 12);
  g.fillStyle = fg;
  g.font = '700 54px "Barlow Semi Condensed", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
