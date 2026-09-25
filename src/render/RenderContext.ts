import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import type { Vec3 } from '../core/math';

/** Výkonnostní třída zařízení: slabý telefon / běžný telefon / počítač. */
export type Tier = 'low' | 'mid' | 'high';

export interface Quality {
  mobile: boolean;
  tier: Tier;
  pixelRatioMax: number;
  pixelRatioMin: number;
  shadows: boolean;
  antialias: boolean;
  drawDistance: number;
}

/** Slabé mobilní GPU (staré Mali, Adreno 3xx–5xx, PowerVR, starší Apple). */
const WEAK_GPU = /mali-(4|t[6-8])|mali-g(31|51|52|57|68|71|72)\b|adreno[^0-9]*(3\d\d|4\d\d|50\d|51\d|52\d|53\d|60\d|61\d)\b|powervr|sgx|apple a(7|8|9|10|11)\b|swiftshader|llvmpipe/i;

/** Název GPU z WebGL (pokud ho prohlížeč prozradí). */
export function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

export function detectTier(mobile: boolean, gpu = gpuName()): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (mobile && (mem <= 3 || cores <= 4 || WEAK_GPU.test(gpu))) return 'low';
  if (!mobile && (mem <= 2 || cores <= 2)) return 'low';
  return mobile ? 'mid' : 'high';
}

export function detectQuality(): Quality {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const tier = detectTier(mobile);
  if (tier === 'low') return { mobile, tier, pixelRatioMax: 1, pixelRatioMin: 0.6, shadows: true, antialias: false, drawDistance: 240 };
  return mobile
    ? { mobile, tier, pixelRatioMax: 1.5, pixelRatioMin: 0.75, shadows: true, antialias: false, drawDistance: 300 }
    : { mobile, tier, pixelRatioMax: 2, pixelRatioMin: 1, shadows: true, antialias: true, drawDistance: 460 };
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
  // Okolní světlo z oblohy (odrazy na PBR materiálech) a zastínění AO.
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envScene = new THREE.Scene();
  private readonly envSky: THREE.Mesh;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = '';
  private envTimer = 0;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private realistic = true;
  private readonly vignette: HTMLElement;

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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'view';
    container.appendChild(this.renderer.domElement);
    // Jemná vinětace (jen CSS vrstva nad plátnem, GPU ji skoro nepocítí).
    this.vignette = document.createElement('div');
    this.vignette.className = 'vignette';
    container.appendChild(this.vignette);

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
      const ms = quality.tier === 'low' ? 512 : quality.mobile ? 1024 : 2048;
      this.sun.shadow.mapSize.set(ms, ms);
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

    // Obloha pro mapu okolí: koule s přechodem zenit → horizont → zem a jasným místem slunce.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envSky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          zenith: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          ground: { value: new THREE.Color() },
          sun: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
        },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vD;
          void main(){
            float h = vD.y;
            vec3 c = h > 0.0 ? mix(horizon, zenith, pow(h, 0.6)) : mix(horizon, ground, pow(-h, 0.35));
            c += sun * pow(max(dot(vD, normalize(sunDir)), 0.0), 64.0) * 6.0;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    this.envScene.add(this.envSky);

    this.resize();
    addEventListener('resize', this.resize);
    screen.orientation?.addEventListener?.('change', this.resize);
  }

  /**
   * Úroveň grafiky: 0 úsporná (Lambert, bez odrazů), 1 realistická (PBR + mapa okolí),
   * 2 vysoká (navíc zastínění GTAO a vyhlazení).
   */
  setGraphics(level: 0 | 1 | 2): void {
    this.realistic = level >= 1;
    this.vignette.hidden = level === 0;
    this.scene.environment = this.realistic ? (this.envTarget?.texture ?? null) : null;
    this.envKey = '';
    const wantAo = level >= 2;
    if (wantAo && !this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      // Průhledné plošky (tráva, mraky, déšť, obloha) by v normálovém průchodu kreslily plné
      // čtverce – z AO je vyřadíme (userData.noAO nebo sprite).
      const gtao = this.gtao as unknown as { overrideVisibility: () => void; _visibilityCache: Map<THREE.Object3D, boolean> };
      const base = gtao.overrideVisibility.bind(gtao);
      gtao.overrideVisibility = () => {
        base();
        this.scene.traverse((o) => {
          if (!o.visible) return;
          if ((o as THREE.Sprite).isSprite || o.userData.noAO) {
            if (!gtao._visibilityCache.has(o)) gtao._visibilityCache.set(o, o.visible);
            o.visible = false;
          }
        });
      };
      this.gtao.blendIntensity = 0.65;
      this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1, scale: 1, samples: 12 });
      this.composer.addPass(this.gtao);
      this.composer.addPass(new OutputPass());
      this.resize();
    } else if (!wantAo && this.composer) {
      this.composer.dispose();
      this.gtao?.dispose();
      this.composer = null;
      this.gtao = null;
    }
  }

  /** Přepočítá mapu okolí, když se obloha změnila (nejvýš jednou za pár sekund). */
  private updateEnvironment(d: { sunDir: Vec3; sunColor: number; sunIntensity: number; skyLight: number; groundLight: number; horizon: number; zenith?: number }, dt: number): void {
    if (!this.realistic) return;
    this.envTimer -= dt;
    const key = [d.horizon, d.skyLight, d.groundLight, d.sunColor, Math.round(d.sunIntensity * 10), Math.round(d.sunDir.y * 20), Math.round(d.sunDir.x * 20)].join();
    if (key === this.envKey || this.envTimer > 0) return;
    this.envKey = key;
    this.envTimer = 3;
    const u = (this.envSky.material as THREE.ShaderMaterial).uniforms;
    (u.zenith.value as THREE.Color).setHex(d.zenith ?? d.skyLight).convertSRGBToLinear();
    (u.horizon.value as THREE.Color).setHex(d.horizon).convertSRGBToLinear();
    (u.ground.value as THREE.Color).setHex(d.groundLight).convertSRGBToLinear().multiplyScalar(0.6);
    (u.sun.value as THREE.Color).setHex(d.sunColor).convertSRGBToLinear().multiplyScalar(Math.min(1, d.sunIntensity / 2.4));
    (u.sunDir.value as THREE.Vector3).set(d.sunDir.x, d.sunDir.y, d.sunDir.z);
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 50);
    this.envTarget?.dispose();
    this.envTarget = rt;
    this.scene.environment = rt.texture;
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
    zenith?: number;
    fogScale?: number;
  }, dt = 0): void {
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
    // S mapou okolí svítí obloha i odrazy – polokoule jen doplňuje.
    this.hemi.intensity = d.hemiIntensity * (this.realistic ? 0.8 : 1);
    this.scene.environmentIntensity = this.realistic ? 0.5 : 0;
    this.updateEnvironment(d, dt);
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
  adapt(dt: number, targetFps = 60): void {
    this.fpsAvg += (1 / Math.max(dt, 1e-3) - this.fpsAvg) * 0.05;
    this.adaptTimer += dt;
    if (this.adaptTimer < 2) return;
    this.adaptTimer = 0;
    const q = this.quality;
    const max = Math.min(devicePixelRatio, this.pixelCap);
    let next = this.pixelRatio;
    if (this.fpsAvg < targetFps * 0.7) next = Math.max(q.pixelRatioMin, this.pixelRatio - 0.25);
    else if (this.fpsAvg > targetFps * 0.95) next = Math.min(max, this.pixelRatio + 0.125);
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
    if (this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.composer.setPixelRatio(1);
      this.composer.setSize(size.x, size.y);
    }
  };

  private frame = 0;

  render(): void {
    // Na telefonu se stínová mapa překresluje jen každý druhý snímek (stíny se hýbou pomalu).
    this.frame++;
    const sm = this.renderer.shadowMap;
    if (this.quality.mobile && sm.enabled) {
      sm.autoUpdate = false;
      if (this.frame % 2 === 0) sm.needsUpdate = true;
    } else sm.autoUpdate = true;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
