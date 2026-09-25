import * as THREE from 'three';

/** Kupovité mraky jako billboardy s procedurální texturou; plují a drží se kolem kamery. */
export class Clouds {
  private readonly group = new THREE.Group();
  private readonly items: { s: THREE.Sprite; x: number; z: number; y: number }[] = [];
  private drift = 0;

  constructor(scene: THREE.Scene, radius: number) {
    const tex = cloudTexture();
    if (!tex) return;
    let k = 3;
    const rnd = (): number => {
      k = (k * 16807) % 2147483647;
      return k / 2147483647;
    };
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.75 + rnd() * 0.2 });
      const s = new THREE.Sprite(mat);
      const w = 70 + rnd() * 90;
      s.scale.set(w, w * 0.42, 1);
      const a = rnd() * Math.PI * 2;
      const r = radius * (0.35 + rnd() * 0.6);
      this.items.push({ s, x: Math.cos(a) * r, z: Math.sin(a) * r, y: 110 + rnd() * 70 });
      this.group.add(s);
    }
    this.group.renderOrder = -1;
    scene.add(this.group);
  }

  /** Oblačnost: víc a tmavších mraků. */
  setCover(cloud: number, rain: number): void {
    this.items.forEach((c, i) => {
      const m = c.s.material as THREE.SpriteMaterial;
      m.opacity = i / this.items.length < 0.25 + cloud * 0.75 ? 0.55 + cloud * 0.4 : 0;
      m.color.setScalar(1 - rain * 0.45 - cloud * 0.15);
    });
  }

  update(dt: number, eye: { x: number; z: number }, radius: number): void {
    this.drift += dt * 1.6; // mírný vítr od západu
    for (const c of this.items) {
      let x = c.x + this.drift;
      x = ((((x + radius) % (2 * radius)) + 2 * radius) % (2 * radius)) - radius;
      c.s.position.set(eye.x + x, c.y, eye.z + c.z);
    }
  }
}

function cloudTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  let k = 11;
  const rnd = (): number => {
    k = (k * 16807) % 2147483647;
    return k / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    // Kapky drž uvnitř plátna, ať okraje sprite plynule mizí (žádné rovné hrany).
    const r = 16 + rnd() * 24;
    const x = 56 + rnd() * 144;
    const y = Math.min(128 - r - 2, Math.max(r + 2, 58 + rnd() * 26 - Math.abs(x - 128) * 0.1));
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.6, 'rgba(245,247,250,0.55)');
    grd.addColorStop(1, 'rgba(235,240,245,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Spodek mraku trochu do šeda.
  const shade = g.createLinearGradient(0, 60, 0, 128);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(120,130,145,0.35)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
