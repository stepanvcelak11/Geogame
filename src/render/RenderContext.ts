import * as THREE from 'three';
import type { Vec3 } from '../core/math';

export interface Quality {
  mobile: boolean;
  pixelRatioMax: number;
  pixelRatioMin: number;
  shadows: boolean;
  antialias: boolean;
  drawDistance: number;
}

export function detectQuality(): Quality {
  const mobile = matchMedia('(pointer: coarse)').matches;
  return mobile
    ? { mobile, pixelRatioMax: 1.5, pixelRatioMin: 0.75, shadows: true, antialias: false, drawDistance: 300 }
    : { mobile, pixelRatioMax: 2, pixelRatioMin: 1, shadows: true, antialias: true, drawDistance: 460 };
}

export const SKY_HORIZON = 0xa9c4d6;
/** Směr ke slunci (jednotky nevadí). */
export const SUN_DIR = { x: 70, y: 95, z: 40 };
const SKY = SKY_HORIZON;

/**
 * Renderer, scéna, kamera a světla. Na mobilu: bez stínů, Lambert materiály,
 * kratší dohled a dynamické rozlišení podle FPS.
 */
export class RenderContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private sunOffset = { x: SUN_DIR.x, y: SUN_DIR.y, z: SUN_DIR.z };
  private pixelRatio: number;
  private pixelCap: number;
  private drawDist: number;
  private fpsAvg = 60;
  private adaptTimer = 0;

  constructor(
    private readonly container: HTMLElement,
    readonly quality: Quality,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
    this.pixelCap = quality.pixelRatioMax;
    this.drawDist = quality.drawDistance;
    this.pixelRatio = Math.min(devicePixelRatio, quality.pixelRatioMax);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'view';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, quality.drawDistance * 0.3, quality.drawDistance);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, quality.drawDistance + 20);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // děti kamery: předměty v rukou, baterka

    this.hemi = new THREE.HemisphereLight(0xd4e6f2, 0x5b5236, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
    if (quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(quality.mobile ? 1024 : 2048, quality.mobile ? 1024 : 2048);
      const cam = this.sun.shadow.camera;
      cam.left = -45;
      cam.right = 45;
      cam.top = 45;
      cam.bottom = -45;
      cam.near = 1;
      cam.far = 220;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun, this.sun.target);

    this.resize();
    addEventListener('resize', this.resize);
    screen.orientation?.addEventListener?.('change', this.resize);
  }

  /** Slunce (a stínová kamera) jde s hráčem. */
  /** Denní světlo: slunce, polokoule, pozadí a mlha. */
  setDaylight(d: {
    sunDir: Vec3;
    sunColor: number;
    sunIntensity: number;
    skyLight: number;
    groundLight: number;
    hemiIntensity: number;
    horizon: number;
    fogScale?: number;
  }): void {
    const fog = this.scene.fog as THREE.Fog;
    const k = Math.max(0.12, d.fogScale ?? 1);
    fog.near = this.drawDist * 0.3 * k;
    fog.far = this.drawDist * k;
    const r = 120;
    this.sunOffset = { x: d.sunDir.x * r, y: d.sunDir.y * r, z: d.sunDir.z * r };
    this.sun.color.setHex(d.sunColor);
    this.sun.intensity = d.sunIntensity;
    this.hemi.color.setHex(d.skyLight);
    this.hemi.groundColor.setHex(d.groundLight);
    this.hemi.intensity = d.hemiIntensity;
    (this.scene.background as THREE.Color).setHex(d.horizon);
    (this.scene.fog as THREE.Fog).color.setHex(d.horizon);
  }

  /** Stíny zap/vyp – materiály se musí přeložit. */
  setShadows(on: boolean): void {
    if (this.renderer.shadowMap.enabled === on) return;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }

  /** Úsporné rozlišení: nižší strop pixel ratio. */
  setPixelCap(cap: number): void {
    this.pixelCap = cap;
    if (this.pixelRatio > cap) {
      this.pixelRatio = Math.max(this.quality.pixelRatioMin, cap);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  }

  setDrawDistance(d: number): void {
    this.drawDist = d;
    this.camera.far = d + 20;
    this.camera.updateProjectionMatrix();
  }

  followSun(p: Vec3): void {
    this.sun.position.set(p.x + this.sunOffset.x, p.y + this.sunOffset.y, p.z + this.sunOffset.z);
    this.sun.target.position.set(p.x, p.y, p.z);
    this.sun.target.updateMatrixWorld();
  }

  /** Dynamické rozlišení: při dlouhodobě nízkém FPS sníží pixel ratio, při rezervě ho vrátí. */
  adapt(dt: number): void {
    this.fpsAvg += (1 / Math.max(dt, 1e-3) - this.fpsAvg) * 0.05;
    this.adaptTimer += dt;
    if (this.adaptTimer < 2) return;
    this.adaptTimer = 0;
    const q = this.quality;
    const max = Math.min(devicePixelRatio, this.pixelCap);
    let next = this.pixelRatio;
    if (this.fpsAvg < 42) next = Math.max(q.pixelRatioMin, this.pixelRatio - 0.25);
    else if (this.fpsAvg > 57) next = Math.min(max, this.pixelRatio + 0.125);
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  get fps(): number {
    return this.fpsAvg;
  }

  get currentPixelRatio(): number {
    return this.pixelRatio;
  }

  readonly resize = (): void => {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Na výšku by byl vodorovný záběr moc úzký – rozšíříme svislé FOV.
    this.camera.fov = w < h ? 88 : 72;
    this.camera.updateProjectionMatrix();
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
