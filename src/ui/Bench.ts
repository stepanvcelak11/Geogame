import * as THREE from 'three';
import { dragAngle, Thread } from '../bench/Thread';
import { POLE_HEIGHTS, type RoverRig } from '../items/items';
import { buildController, buildReceiver, buildTotalStation, buildTripod, glove, setTripodPose } from '../render/InstrumentModels';
import { pbr } from '../render/materials';

/**
 * Fyzická montáž přístrojů „v rukou“: detail před kamerou, levá ruka drží (tlačítko ✋ nebo
 * mezerník), pravá táhne a otáčí. GNSS: aretace a stupnice výtyčky, přijímač na závit 5/8″,
 * držák s kontrolerem, tlačítka napájení přímo na přístrojích. Totální stanice: posadit na hlavu
 * stativu a přitáhnout upínacím šroubem zespodu.
 */
export type BenchMode = 'gnss-assemble' | 'gnss-pack' | 'ts-mount' | 'ts-unmount' | 'tripod';

type Stage =
  | 'height'
  | 'rxTake'
  | 'rxSeat'
  | 'rxScrew'
  | 'brTake'
  | 'brSeat'
  | 'brScrew'
  | 'ctTake'
  | 'ctSeat'
  | 'power'
  | 'off'
  | 'ctOut'
  | 'brUnscrew'
  | 'brOut'
  | 'rxUnscrew'
  | 'rxOut'
  | 'tsSeat'
  | 'tsScrew'
  | 'tsUnscrew'
  | 'tsLift'
  | 'trUnlock'
  | 'trExtend'
  | 'trLock'
  | 'trSpread'
  | 'trStep'
  | 'done';

const HINT: Record<Stage, string> = {
  height:
    'Výška výtyčky: klepni na páčku aretace (povolí se), táhni výtyčku nahoru/dolů a odečti stupnici u horní hrany svěrky. Pak páčku zase zaklapni. Výšku si zapamatuj.',
  rxTake: 'Vyndej přijímač z kufru (tlačítko dole).',
  rxSeat: 'Táhni přijímač nad vrchol výtyčky a nasaď ho na závit.',
  rxScrew:
    'Levou rukou drž výtyčku (✋ – ťukni a drží, nebo mezerník) a pravou otáčej přijímačem po směru hodinových ručiček – krouživým tahem kolem přijímače. Bez přidržení se výtyčka točí s ním.',
  brTake: 'Vyndej z kufru držák kontroleru.',
  brSeat: 'Přilož držák k výtyčce (táhni ho k ní).',
  brScrew: 'Drž výtyčku a utáhni šroub držáku krouživým tahem kolem knoflíku.',
  ctTake: 'Vyndej z kufru kontroler.',
  ctSeat: 'Zasuň kontroler do držáku (táhni ho k držáku).',
  power: 'Zapni přijímač a kontroler: podrž prst na tlačítku napájení přímo na přístroji (1,5 s).',
  off: 'Vypni přijímač i kontroler: podrž tlačítka napájení.',
  ctOut: 'Vytáhni kontroler z držáku (táhni ho pryč) a ulož ho do kufru.',
  brUnscrew: 'Drž výtyčku a povol šroub držáku (krouživě proti směru hodinových ručiček).',
  brOut: 'Sundej držák z výtyčky (táhni ho pryč) a ulož do kufru.',
  rxUnscrew: 'Drž výtyčku a odšroubuj přijímač proti směru hodinových ručiček.',
  rxOut: 'Zvedni přijímač ze závitu a ulož ho do kufru.',
  tsSeat: 'Stanici drž oběma rukama, posaď ji doprostřed hlavy stativu (táhni dolů).',
  tsScrew:
    'Levou rukou drž stanici (✋ – ťukni a drží, nebo mezerník), pravou zespodu zašroubuj upínací šroub stativu do trojnožky (krouživě kolem šroubu). Nepouštěj ji, dokud není přitažená!',
  tsUnscrew: 'Drž stanici a povol upínací šroub stativu (proti směru hodinových ručiček).',
  tsLift: 'Zvedni stanici z hlavy stativu (táhni nahoru) a ulož ji do kufru.',
  trUnlock: 'Povol svěrky všech tří nohou: ťukni na černou svěrku na každé noze.',
  trExtend:
    'Táhni dolů – nohy se vysunou. Hlavu stativu nastav zhruba do výšky hrudníku, aby byl okulár stanice u oka. Pak dej Délka nohou OK.',
  trLock: 'Zajisti svěrky (ťukni na každou), jinak se noha pod stanicí zasune.',
  trSpread: 'Roztáhni nohy do stran (táhni vodorovně). Široký postoj = stabilní stativ; úzký ve větru spadne.',
  trStep: 'Sešlápni ostruhy všech nohou do země (ťukni na patku každé nohy). Pak Hotovo.',
  done: 'Hotovo.',
};

const STEP_LABEL: Partial<Record<Stage, string>> = {
  height: 'Výška výtyčky',
  rxSeat: 'Přijímač na závit',
  rxScrew: 'Zašroubovat přijímač',
  brSeat: 'Držák na výtyčku',
  brScrew: 'Utáhnout držák',
  ctSeat: 'Kontroler do držáku',
  power: 'Zapnout',
  off: 'Vypnout',
  ctOut: 'Kontroler ven',
  brUnscrew: 'Povolit držák',
  brOut: 'Držák ven',
  rxUnscrew: 'Odšroubovat přijímač',
  rxOut: 'Přijímač do kufru',
  tsSeat: 'Posadit na stativ',
  tsScrew: 'Přitáhnout šroubem',
  tsUnscrew: 'Povolit šroub',
  tsLift: 'Zvednout do kufru',
  trUnlock: 'Povolit svěrky',
  trExtend: 'Vysunout nohy',
  trLock: 'Zajistit svěrky',
  trSpread: 'Roztáhnout nohy',
  trStep: 'Sešlápnout patky',
};

const CLAMP_Y = 1.0; // horní hrana svěrky nad hrotem [m]
const BRACKET_Y = 0.82; // kde se nasazuje držák kontroleru
const HOLD_MS = 1500;

/** Stupnice na horním dílu výtyčky: čtení u horní hrany svěrky = výška ARP nad hrotem. */
function scaleTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 2048;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#1e2124';
  g.fillRect(0, 0, 64, 2048);
  // Textura pokrývá 1,20 m horního dílu: v = 0 nahoře (vrchol), dole 1,20 m pod vrcholem.
  // Bod u pod vrcholem ukazuje čtení CLAMP_Y + u.
  const px = 2048 / 1.2;
  for (let mm = 0; mm <= 1200; mm += 10) {
    const y = (mm / 1000) * px;
    const val = CLAMP_Y + mm / 1000;
    const major = mm % 100 === 0;
    const mid = mm % 50 === 0;
    g.fillStyle = major ? '#f2b705' : '#e8e8e8';
    g.fillRect(0, y - 1.5, major ? 40 : mid ? 28 : 16, major ? 4 : 2.5);
    if (major || mid) {
      g.font = `bold ${major ? 22 : 16}px sans-serif`;
      g.fillText(val.toFixed(2), major ? 12 : 20, y - 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name = ''): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  return m;
}

export interface BenchCallbacks {
  onRig: (event: 'height' | 'receiver' | 'controller' | 'power' | 'screw' | 'click') => void;
  onTsMounted: (mounted: boolean) => void;
  /** Proč nejde přístroj zapnout (vybitá baterie), jinak null. */
  powerBlock?: (what: 'rx' | 'ct') => string | null;
  onClose: (completed: boolean) => void;
  /** Stativ rozložen: výška hlavy nad terénem, délka nohou a zda jsou ostruhy sešlápnuté. */
  onTripod?: (head: number, len: number, secured: boolean) => void;
}

export class Bench {
  private readonly el: HTMLElement;
  private readonly group = new THREE.Group();
  private readonly ray = new THREE.Raycaster();
  private mode: BenchMode = 'gnss-assemble';
  private rig: RoverRig | null = null;
  private stage: Stage = 'height';
  private held = false; // levá ruka drží výtyčku / stanici
  private keyHeld = false;
  private holdLocked = false; // ✋ zamknuté ťuknutím
  // --- GNSS
  private pole = new THREE.Group(); // počátek = hrot
  private upper!: THREE.Mesh;
  private clampLever!: THREE.Mesh;
  private clampOpen = false;
  private receiver = new THREE.Group();
  private bracket = new THREE.Group();
  private controller = new THREE.Group();
  private rxThread = new Thread(4);
  private brThread = new Thread(2);
  private rxHand = false; // přijímač v pravé ruce (mimo kufr, nenasazený)
  private brHand = false;
  private ctHand = false;
  private rxSeated = false;
  private brSeated = false;
  private ctSeated = false;
  private rxPos = new THREE.Vector3();
  private brPos = new THREE.Vector3();
  private ctPos = new THREE.Vector3();
  private rxSpin = 0;
  private poleSpin = 0;
  private leds: THREE.Mesh[] = [];
  private ctrlScreen: THREE.Mesh | null = null;
  // --- totální stanice
  private tsHead = new THREE.Group();
  private ts = new THREE.Group();
  private tsPos = new THREE.Vector3();
  private tsThread = new Thread(5);
  private tsSeated = false;
  private screwKnob!: THREE.Mesh;
  private tsSpin = 0;
  // --- stativ
  private tripod = new THREE.Group();
  private trLen = 1.0; // délka nohou (složené 1,0 m)
  private trSpread = 0.05; // rozevření [rad]
  private trClampOpen = [false, false, false];
  private trStepped = [false, false, false];
  private trLenOk = false;
  // --- ruce a kamera
  private readonly leftHand = glove();
  private readonly rightHand = glove();
  private focus = new THREE.Vector3();
  private focusGoal = new THREE.Vector3();
  private drag: { kind: 'move' | 'rotate' | 'height'; x: number; y: number; cx: number; cy: number } | null = null;
  private power: { what: 'rx' | 'ct'; t0: number } | null = null;
  private msgT = 0;
  private cb: BenchCallbacks | null = null;
  private readonly scaleTex = scaleTexture();

  constructor(
    root: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bench';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="bench-touch"></div>
      <div class="bench-ring" hidden><span>↻</span></div>
      <header class="bench-top"><h2 class="bench-title"></h2><button class="bench-help" aria-label="Nápověda">?</button><button class="bench-close">Zavřít</button></header>
      <p class="bench-hint"></p>
      <p class="bench-msg" hidden></p>
      <figure class="bench-gauge" hidden><canvas width="110" height="200"></canvas><figcaption>Stativ vůči tobě</figcaption></figure>
      <figure class="bench-loupe" hidden><canvas width="120" height="240"></canvas><figcaption>Detail u svěrky</figcaption></figure>
      <ol class="bench-steps"></ol>
      <button class="bench-hold" aria-label="Držet levou rukou">✋ <span>Držet</span></button>
      <div class="bench-actions"></div>`;
    root.appendChild(this.el);
    const touch = this.el.querySelector('.bench-touch') as HTMLElement;
    touch.addEventListener('pointerdown', (e) => this.down(e));
    touch.addEventListener('pointermove', (e) => this.move(e));
    const up = (e: PointerEvent): void => this.up(e);
    touch.addEventListener('pointerup', up);
    touch.addEventListener('pointercancel', up);
    const hold = this.el.querySelector('.bench-hold') as HTMLElement;
    // Podržet = drží, dokud je prst na tlačítku. Krátké ťuknutí = zamknout (drží, dokud neťukneš znovu).
    let t0 = 0;
    let wasLocked = false;
    hold.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      wasLocked = this.holdLocked;
      this.holdLocked = false;
      t0 = performance.now();
      this.held = !wasLocked || this.keyHeld;
    });
    const release = (): void => {
      if (!t0) return;
      const tap = performance.now() - t0 < 280;
      t0 = 0;
      if (tap && !wasLocked) this.holdLocked = true;
      this.held = this.holdLocked || this.keyHeld;
    };
    hold.addEventListener('pointerup', release);
    hold.addEventListener('pointercancel', release);
    addEventListener('keydown', (e) => {
      if (this.el.hidden || (e.code !== 'Space' && e.code !== 'ShiftLeft')) return;
      e.preventDefault();
      this.keyHeld = this.held = true;
    });
    addEventListener('keyup', (e) => {
      if (e.code !== 'Space' && e.code !== 'ShiftLeft') return;
      this.keyHeld = false;
      this.held = this.holdLocked;
    });
    this.el.querySelector('.bench-close')?.addEventListener('click', () => this.close());
    this.el.querySelector('.bench-help')?.addEventListener('click', () => this.flash(HINT[this.stage], 8));
    this.el.querySelector('.bench-actions')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (b) this.action(b.dataset.b ?? '');
    });
    this.buildGnss();
    this.buildTs();
    this.leftHand.rotation.set(0.2, 0.4, 0);
    this.rightHand.rotation.set(0.2, -0.4, 0);
    this.leftHand.scale.setScalar(0.65);
    this.rightHand.scale.setScalar(0.65);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  // ------------------------------------------------------------ stavba scény

  private buildGnss(): void {
    const lower = mesh(new THREE.CylinderGeometry(0.0135, 0.0135, CLAMP_Y, 16).translate(0, CLAMP_Y / 2, 0), pbr(0x2a2e32, 0.4, 0.3));
    const tex = this.scaleTex;
    const upperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex ?? undefined, roughness: 0.4, metalness: 0.2 });
    // Horní díl 1,20 m, textura: vrchol nahoře (v = 1 nahoře u CylinderGeometry).
    this.upper = mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 1.2, 16).translate(0, -0.6, 0), upperMat);
    const clamp = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16).translate(0, CLAMP_Y - 0.02, 0), pbr(0x2a2e32, 0.55, 0.1), 'clamp');
    this.clampLever = mesh(new THREE.BoxGeometry(0.012, 0.05, 0.01).translate(0, -0.025, 0), pbr(0xe8ae10, 0.5, 0), 'clamp');
    this.clampLever.position.set(0.022, CLAMP_Y, 0.005);
    const tip = mesh(new THREE.ConeGeometry(0.0135, 0.04, 12).rotateX(Math.PI), pbr(0x9aa0a6, 0.3, 1));
    tip.position.y = 0.02;
    this.pole.add(lower, this.upper, clamp, this.clampLever, tip);
    this.pole.rotation.z = 0.1;

    const rx = buildReceiver();
    this.receiver.add(rx);
    rx.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.geometry as THREE.SphereGeometry).parameters?.radius === 0.004) this.leds.push(m);
    });
    // Tlačítko napájení (to gumové na panelu) – pojmenovat pro zásah prstem.
    rx.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.position.z === 0.1 && m.position.x === 0.03) m.name = 'rxPower';
    });
    const rxHit = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12), new THREE.MeshBasicMaterial({ visible: false }), 'receiver');
    rxHit.position.y = 0.03;
    this.receiver.add(rxHit);

    const br = new THREE.Group();
    br.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), pbr(0x2a2e32, 0.5, 0.1)));
    br.add(mesh(new THREE.BoxGeometry(0.018, 0.02, 0.06), pbr(0x2a2e32, 0.5, 0.1)).translateZ(0.035));
    const knob = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12).rotateZ(Math.PI / 2), pbr(0xe07b16, 0.6, 0), 'knob');
    knob.position.set(-0.032, 0, 0);
    br.add(knob);
    br.add(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), new THREE.MeshBasicMaterial({ visible: false }), 'bracket'));
    this.bracket.add(br);

    const ct = buildController();
    ct.children.slice(0, 2).forEach((c) => (c.visible = false)); // objímka a rameno jsou na držáku
    ct.position.set(0, -0.03, -0.06);
    this.controller.add(ct);
    ct.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).emissiveMap) this.ctrlScreen = m;
    });
    const pwr = mesh(new THREE.BoxGeometry(0.012, 0.02, 0.012), pbr(0xc8362b, 0.5, 0), 'ctPower');
    pwr.position.set(0.052, 0.06, 0.005);
    this.controller.add(pwr);
    this.controller.add(mesh(new THREE.BoxGeometry(0.12, 0.2, 0.06), new THREE.MeshBasicMaterial({ visible: false }), 'controller').translateY(0.02));
  }

  private buildTs(): void {
    // Hlava stativu s upínacím šroubem zespodu a začátky nohou.
    const head = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 3).rotateY(Math.PI / 6), pbr(0xf2b705, 0.42, 0));
    this.tsHead.add(head);
    this.tsHead.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.052, 24), pbr(0xc3c8cc, 0.32, 0.9)));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = mesh(new THREE.BoxGeometry(0.038, 0.6, 0.022).translate(0, -0.3, 0), pbr(0xa87a45, 0.7, 0));
      leg.position.set(Math.sin(a) * 0.07, -0.02, Math.cos(a) * 0.07);
      leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      this.tsHead.add(leg);
    }
    this.screwKnob = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), pbr(0x2a2e32, 0.5, 0.2), 'screw');
    this.screwKnob.position.y = -0.07;
    this.tsHead.add(this.screwKnob);
    this.tsHead.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), pbr(0x9aa0a6, 0.3, 1)).translateY(-0.04));
    const st = buildTotalStation();
    this.ts.add(st.root);
    this.ts.add(mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshBasicMaterial({ visible: false }), 'ts').translateY(0.12));
  }

  // ------------------------------------------------------------ otevření / zavření

  openGnss(rig: RoverRig, mode: 'gnss-assemble' | 'gnss-pack', cb: BenchCallbacks): void {
    this.cb = cb;
    this.mode = mode;
    this.rig = rig;
    this.clear();
    const on = rig.receiver;
    this.rxThread = new Thread(4, on ? 4 : 0);
    this.brThread = new Thread(2, rig.controller ? 2 : 0);
    this.rxSeated = on;
    this.brSeated = rig.controller;
    this.ctSeated = rig.controller;
    this.rxHand = this.brHand = this.ctHand = false;
    this.rxPos.set(0, 0, 0);
    this.brPos.set(0, 0, 0);
    this.ctPos.set(0, 0, 0);
    this.clampOpen = false;
    // Už sestavený rover (nebo rozebírání) výšku znovu nenastavuje.
    this.heightConfirmed = mode === 'gnss-pack' || rig.receiver;
    this.stage = 'height';
    this.group.add(this.pole, this.leftHand, this.rightHand);
    this.pole.add(this.receiver, this.bracket, this.controller);
    this.stage = this.nextStage();
    this.show(mode === 'gnss-pack' ? 'Rozebrání GNSS roveru' : 'Sestavení GNSS roveru');
  }

  openTs(mode: 'ts-mount' | 'ts-unmount', cb: BenchCallbacks): void {
    this.cb = cb;
    this.mode = mode;
    this.rig = null;
    this.clear();
    const mounted = mode === 'ts-unmount';
    this.tsThread = new Thread(5, mounted ? 5 : 0);
    this.tsSeated = mounted;
    this.tsPos.set(mounted ? 0 : 0.05, mounted ? 0.051 : 0.28, 0);
    this.group.add(this.tsHead, this.ts, this.leftHand, this.rightHand);
    this.stage = this.nextStage();
    this.show(mounted ? 'Sundání stanice ze stativu' : 'Nasazení stanice na stativ');
  }

  openTripod(cb: BenchCallbacks): void {
    this.cb = cb;
    this.mode = 'tripod';
    this.rig = null;
    this.clear();
    if (!this.tripod.children.length) {
      const t = buildTripod();
      // Větší neviditelné cíle pro prst kolem patek a svěrek.
      const legs = (t.userData as { legs: { leg: THREE.Group }[] }).legs;
      legs.forEach((l, i) => {
        const foot = mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), `legFoot${i}`);
        foot.position.y = -0.93;
        const cl = mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), `legClamp${i}`);
        cl.position.y = -0.6;
        l.leg.add(foot, cl);
      });
      this.tripod.add(t);
    }
    this.trLen = 1.0;
    this.trSpread = 0.05;
    this.trClampOpen = [false, false, false];
    this.trStepped = [false, false, false];
    this.trLenOk = false;
    this.group.add(this.tripod);
    this.stage = this.nextStage();
    this.show('Rozložení stativu');
  }

  private clear(): void {
    this.group.clear();
    this.pole.remove(this.receiver, this.bracket, this.controller);
    this.held = this.keyHeld = this.holdLocked = false;
    this.drag = null;
    this.power = null;
    this.poleSpin = 0;
    this.tsSpin = 0;
  }

  private show(title: string): void {
    (this.el.querySelector('.bench-title') as HTMLElement).textContent = title;
    this.el.hidden = false;
    this.camera.add(this.group);
    this.focus.copy(this.focusFor(this.stage));
    this.render();
  }

  close(): void {
    if (this.el.hidden) return;
    const completed = this.stage === 'done';
    // Nedokončené díly se vrátí do kufru (nic nezůstane napůl přišroubované).
    if (this.rig && !completed) {
      if (!this.rxThread.tight) this.rig.receiver = false;
      if (!(this.brThread.tight && this.ctSeated)) this.rig.controller = false;
    }
    this.el.hidden = true;
    this.camera.remove(this.group);
    this.cb?.onClose(completed);
  }

  // ------------------------------------------------------------ logika kroků

  private nextStage(): Stage {
    const r = this.rig;
    switch (this.mode) {
      case 'gnss-assemble':
        if (!r) return 'done';
        if (!this.heightConfirmed) return 'height';
        if (!this.rxSeated) return this.rxHand ? 'rxSeat' : 'rxTake';
        if (!this.rxThread.tight) return 'rxScrew';
        if (!this.brSeated) return this.brHand ? 'brSeat' : 'brTake';
        if (!this.brThread.tight) return 'brScrew';
        if (!this.ctSeated) return this.ctHand ? 'ctSeat' : 'ctTake';
        if (!r.receiverOn || !r.controllerOn) return 'power';
        return 'done';
      case 'gnss-pack':
        if (!r) return 'done';
        if (r.receiverOn || r.controllerOn) return 'off';
        if (this.ctSeated || this.ctHand) return 'ctOut';
        if (this.brSeated && !this.brThread.loose) return 'brUnscrew';
        if (this.brSeated || this.brHand) return 'brOut';
        if (this.rxSeated && !this.rxThread.loose) return 'rxUnscrew';
        if (this.rxSeated || this.rxHand) return 'rxOut';
        return 'done';
      case 'ts-mount':
        if (!this.tsSeated) return 'tsSeat';
        if (!this.tsThread.tight) return 'tsScrew';
        return 'done';
      case 'ts-unmount':
        if (!this.tsThread.loose) return 'tsUnscrew';
        if (this.tsSeated) return 'tsLift';
        return 'done';
      case 'tripod':
        if (!this.trLenOk) return this.trClampOpen.every(Boolean) ? 'trExtend' : 'trUnlock';
        if (this.trClampOpen.some(Boolean)) return 'trLock';
        if (this.trSpread < 0.3) return 'trSpread';
        if (!this.trStepped.every(Boolean) && !this.trFinished) return 'trStep';
        return 'done';
    }
  }

  private heightConfirmed = false;
  private trFinished = false;

  /** Výška hlavy stativu nad terénem podle délky nohou a rozevření. */
  private get trHead(): number {
    return this.trLen * Math.cos(this.trSpread) + 0.03;
  }

  private advance(): void {
    const prev = this.stage;
    this.stage = this.nextStage();
    if (this.stage !== prev) {
      this.cb?.onRig('click');
      if (this.stage === 'done') {
        if (this.mode === 'ts-mount') this.cb?.onTsMounted(true);
        if (this.mode === 'ts-unmount') this.cb?.onTsMounted(false);
        this.flash('Hotovo. Zavři montáž tlačítkem Zavřít.', 5);
      }
    }
    this.render();
  }

  private action(id: string): void {
    const r = this.rig;
    switch (id) {
      case 'heightOk':
        if (this.clampOpen) return this.flash('Nejdřív zaklapni páčku aretace, jinak se výtyčka při postavení zasune.', 4);
        this.heightConfirmed = true;
        break;
      case 'rxTake':
        this.rxHand = true;
        this.rxPos.set(0.16, 0.02, 0);
        break;
      case 'brTake':
        this.brHand = true;
        this.brPos.set(0.15, 0, 0);
        break;
      case 'ctTake':
        this.ctHand = true;
        this.ctPos.set(0.18, -0.02, 0);
        break;
      case 'store':
        // Uložit do kufru, co je v ruce.
        if (this.ctHand) {
          this.ctHand = false;
          if (r) r.controller = false;
          this.cb?.onRig('controller');
        } else if (this.brHand) this.brHand = false;
        else if (this.rxHand) {
          this.rxHand = false;
          if (r) r.receiver = false;
          this.cb?.onRig('receiver');
        }
        break;
      case 'trLenOk':
        if (this.trHead < 1.05) return this.flash('Stativ je moc nízko – okulár by byl u pasu. Vysuň nohy víc.', 3);
        if (this.trHead > 1.55) return this.flash('Stativ je moc vysoko – na okulár nedosáhneš. Zasuň nohy.', 3);
        this.trLenOk = true;
        break;
      case 'trDone':
        this.trFinished = true;
        this.advance();
        if (this.stage === 'done') this.cb?.onTripod?.(this.trHead, this.trLen, this.trStepped.every(Boolean));
        return;
      case 'tsStore':
        this.tsPos.y = 0.6;
        this.stage = 'done';
        this.cb?.onTsMounted(false);
        break;
    }
    this.advance();
  }

  private flash(text: string, secs = 3): void {
    this.msgT = secs;
    const m = this.el.querySelector('.bench-msg') as HTMLElement;
    m.textContent = text;
    m.hidden = false;
  }

  // ------------------------------------------------------------ vstup

  private pick(e: PointerEvent): { name: string; point: THREE.Vector3 } | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.ray.intersectObject(this.group, true);
    // Tlačítka a páčky mají přednost před neviditelnými oblastmi pro uchopení dílů.
    const small = hits.find((h) => ['rxPower', 'ctPower', 'clamp'].includes(h.object.name) || /^leg(Clamp|Foot)\d$/.test(h.object.name));
    if (small) return { name: small.object.name, point: small.point };
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.name) o = o.parent;
      if (o?.name) return { name: o.name, point: h.point };
    }
    return null;
  }

  /** Střed objektu na obrazovce (pro krouživé otáčení). */
  private screenOf(o: THREE.Object3D, local = new THREE.Vector3()): { x: number; y: number } {
    const v = o.localToWorld(local.clone()).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Metrů na pixel v hloubce skupiny (posun v rovině obrazovky). */
  private mPerPx(): number {
    const r = this.canvas.getBoundingClientRect();
    const depth = this.mode.startsWith('ts') ? 0.5 : this.depth;
    return (2 * depth * Math.tan((this.camera.fov * Math.PI) / 360)) / r.height;
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const hit = this.pick(e);
    const s = this.stage;
    const r = this.rig;
    // Páčka aretace se přepne ťuknutím (bez tahu) – vyhodnotí se až při puštění.
    this.tap = { x: e.clientX, y: e.clientY, clamp: hit?.name === 'clamp' && s === 'height' };
    if (hit?.name === 'rxPower' || hit?.name === 'ctPower') {
      if (s === 'power' || s === 'off') {
        this.power = { what: hit.name === 'rxPower' ? 'rx' : 'ct', t0: performance.now() };
        return;
      }
    }
    if ((s === 'power' || s === 'off') && r) {
      this.flash('Tlačítko napájení je na přístroji: u přijímače gumové kolečko na šedém pásu, u kontroleru červené na boku.', 4);
    }
    let kind: 'move' | 'rotate' | 'height' = 'move';
    if (this.mode === 'tripod') {
      if (s === 'trExtend' || s === 'trSpread') this.drag = { kind: 'height', x: e.clientX, y: e.clientY, cx: 0, cy: 0 };
      return;
    }
    let c = { x: e.clientX, y: e.clientY };
    if (s === 'height') {
      if (!this.clampOpen) return; // zavřená aretace: tah nic nedělá (ťuknutí vyhodnotí up)
      kind = 'height';
    } else if (s === 'rxScrew' || s === 'rxUnscrew') {
      kind = 'rotate';
      c = this.screenOf(this.receiver);
    } else if (s === 'brScrew' || s === 'brUnscrew') {
      kind = 'rotate';
      c = this.screenOf(this.bracket, new THREE.Vector3(-0.032, 0, 0));
    } else if (s === 'tsScrew' || s === 'tsUnscrew') {
      kind = 'rotate';
      c = this.screenOf(this.screwKnob);
    }
    this.drag = { kind, x: e.clientX, y: e.clientY, cx: c.x, cy: c.y };
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const k = this.mPerPx();
    const s = this.stage;
    const r = this.rig;
    if (d.kind === 'height' && this.mode === 'tripod') {
      if (s === 'trExtend') this.trLen = Math.max(1.0, Math.min(1.62, this.trLen + dy * 0.0035));
      else if (s === 'trSpread') this.trSpread = Math.max(0.05, Math.min(0.5, this.trSpread + Math.abs(dx) * 0.0025));
      if (s === 'trSpread' && this.trSpread >= 0.3) this.advance();
    } else if (d.kind === 'height' && r) {
      const before = Math.round(r.height * 100);
      r.height = Math.max(POLE_HEIGHTS[0], Math.min(POLE_HEIGHTS[POLE_HEIGHTS.length - 1], r.height - dy * k * 0.6));
      if (Math.round(r.height * 100) !== before && Math.round(r.height * 100) % 5 === 0) this.cb?.onRig('screw');
    } else if (d.kind === 'rotate') {
      const a = dragAngle(d.cx, d.cy, d.x, d.y, e.clientX, e.clientY);
      const dir = s === 'rxScrew' || s === 'brScrew' || s === 'tsScrew' ? 1 : -1;
      const thread = s.startsWith('rx') ? this.rxThread : s.startsWith('br') ? this.brThread : this.tsThread;
      const gained = thread.rotate(a, this.held);
      if (!this.held && Math.abs(a) > 0.02) {
        if (s.startsWith('ts')) this.tsSpin += a;
        else this.poleSpin += a;
        if (this.msgT <= 0)
          this.flash(s.startsWith('ts') ? 'Stanice se točí se šroubem! Drž ji levou rukou (✋ – ťukni, nebo mezerník).' : 'Výtyčka se točí s ním. Drž ji levou rukou (✋ – ťukni, nebo mezerník).', 2.5);
      }
      if (s.startsWith('rx')) this.rxSpin += gained * Math.PI * 2;
      if (Math.abs(gained) > 0 && Math.floor(thread.turns * 4) !== Math.floor((thread.turns - gained) * 4)) this.cb?.onRig('screw');
      if (dir > 0 && a < 0 && this.held && Math.abs(gained) > 0) this.flash('Tímhle směrem povoluješ. Utahuje se po směru hodinových ručiček.', 2);
      if (thread.tight && dir > 0) {
        if (s === 'rxScrew' && r) {
          r.receiver = true;
          this.cb?.onRig('receiver');
        }
        this.drag = null;
        this.advance();
        return;
      }
      if (thread.loose && dir < 0) {
        if (s === 'rxUnscrew' && r) {
          r.receiver = false;
          this.cb?.onRig('receiver');
        }
        this.drag = null;
        this.advance();
        return;
      }
    } else if (d.kind === 'move') {
      const v = new THREE.Vector3(dx * k, -dy * k, 0);
      if (s === 'rxSeat' || s === 'rxOut') this.rxPos.add(v);
      else if (s === 'brSeat' || s === 'brOut') this.brPos.add(v);
      else if (s === 'ctSeat' || s === 'ctOut') this.ctPos.add(v);
      else if (s === 'tsSeat' || s === 'tsLift') this.tsPos.add(new THREE.Vector3(dx * k, -dy * k, 0));
      this.checkSeat();
    }
    d.x = e.clientX;
    d.y = e.clientY;
    this.render();
  }

  private tap: { x: number; y: number; clamp: boolean } | null = null;

  private up(e?: PointerEvent): void {
    const t = this.tap;
    this.tap = null;
    const still = !!t && !!e && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8;
    if (t && still && this.mode === 'tripod' && e) {
      const hit = this.pick(e);
      const m = hit?.name.match(/^leg(Clamp|Foot)(\d)$/);
      if (m) {
        // Svěrky (a patky) jsou u sebe: ťuknutí vyřídí tu trefenou, nebo nejbližší ještě nevyřízenou.
        const pick = (done: boolean[], want: boolean): number => {
          const i = Number(m[2]);
          if (done[i] !== want) return i;
          return done.findIndex((d) => d !== want);
        };
        if (m[1] === 'Clamp' && (this.stage === 'trUnlock' || this.stage === 'trLock')) {
          const open = this.stage === 'trUnlock';
          const i = pick(this.trClampOpen, open);
          if (i >= 0) this.trClampOpen[i] = open;
          this.cb?.onRig('click');
        } else if (m[1] === 'Foot' && this.stage === 'trStep') {
          const i = pick(this.trStepped, true);
          if (i >= 0) this.trStepped[i] = true;
          this.cb?.onRig('screw');
        }
        this.advance();
        if (this.stage === 'done') this.cb?.onTripod?.(this.trHead, this.trLen, this.trStepped.every(Boolean));
      } else if (this.stage === 'trUnlock' || this.stage === 'trLock') this.flash('Ťukni přímo na černou svěrku na noze stativu.', 2.5);
      else if (this.stage === 'trStep') this.flash('Ťukni na ocelovou patku dole na noze.', 2.5);
    }
    if (t && still && this.stage === 'height') {
      if (t.clamp) {
        this.clampOpen = !this.clampOpen;
        this.cb?.onRig('click');
        if (!this.clampOpen) this.snapHeight();
        this.render();
      } else if (!this.clampOpen) this.flash('Aretace je zavřená. Ťukni na žlutou páčku u svěrky.', 3);
    }
    this.drag = null;
    if (this.stage === 'height' && this.rig && !this.clampOpen) this.snapHeight();
  }

  private snapHeight(): void {
    const r = this.rig;
    if (!r) return;
    let best = POLE_HEIGHTS[0];
    for (const h of POLE_HEIGHTS) if (Math.abs(h - r.height) < Math.abs(best - r.height)) best = h;
    r.height = best;
    this.cb?.onRig('height');
  }

  /** Nasazení/vyjmutí podle vzdálenosti dílu od jeho místa na výtyčce. */
  private checkSeat(): void {
    const s = this.stage;
    const r = this.rig;
    if (s === 'rxSeat' && Math.abs(this.rxPos.x) < 0.025 && this.rxPos.y > -0.08 && this.rxPos.y < 0.03) {
      this.rxSeated = true;
      this.rxHand = false;
      this.rxPos.set(0, 0, 0);
      this.rxThread = new Thread(4, 0);
      this.drag = null;
      this.advance();
    } else if (s === 'rxOut' && this.rxPos.length() > 0.08) {
      this.rxSeated = false;
      this.rxHand = true;
      this.advance();
    } else if (s === 'brSeat' && Math.abs(this.brPos.x) < 0.03 && Math.abs(this.brPos.y) < 0.06) {
      this.brSeated = true;
      this.brHand = false;
      this.brPos.set(0, 0, 0);
      this.brThread = new Thread(2, 0);
      this.drag = null;
      this.advance();
    } else if (s === 'brOut' && this.brPos.length() > 0.08) {
      this.brSeated = false;
      this.brHand = true;
      this.advance();
    } else if (s === 'ctSeat' && Math.abs(this.ctPos.x) < 0.035 && Math.abs(this.ctPos.y) < 0.07) {
      this.ctSeated = true;
      this.ctHand = false;
      this.ctPos.set(0, 0, 0);
      if (r) r.controller = true;
      this.cb?.onRig('controller');
      this.drag = null;
      this.advance();
    } else if (s === 'ctOut' && this.ctPos.length() > 0.08) {
      this.ctSeated = false;
      this.ctHand = true;
      if (r) r.controller = false;
      this.cb?.onRig('controller');
      this.advance();
    } else if (s === 'tsSeat' && Math.hypot(this.tsPos.x, this.tsPos.z) < 0.02 && this.tsPos.y <= 0.052) {
      this.tsPos.set(0, 0.051, 0);
      this.tsSeated = true;
      this.tsThread = new Thread(5, 0);
      this.drag = null;
      this.advance();
    } else if (s === 'tsSeat' && this.tsPos.y < 0.051) {
      this.tsPos.y = 0.051; // leží na hlavě, ale mimo střed
      if (Math.hypot(this.tsPos.x, this.tsPos.z) >= 0.02 && this.msgT <= 0) this.flash('Posaď ji doprostřed hlavy stativu.', 2);
    } else if (s === 'tsLift' && this.tsPos.y > 0.2) {
      this.tsSeated = false;
      this.advance();
    }
  }

  // ------------------------------------------------------------ snímek

  private focusFor(s: Stage): THREE.Vector3 {
    const h = this.rig?.height ?? 2;
    switch (s) {
      case 'height':
        return new THREE.Vector3(0, CLAMP_Y + 0.01, 0);
      case 'brTake':
      case 'brSeat':
      case 'brScrew':
      case 'ctTake':
      case 'ctSeat':
      case 'ctOut':
      case 'brUnscrew':
      case 'brOut':
        return new THREE.Vector3(0, BRACKET_Y + 0.03, 0);
      case 'power':
      case 'off': {
        // Nejdřív přijímač nahoře, pak kontroler v držáku – tlačítko musí být vidět.
        const rxTodo = s === 'power' ? !this.rig?.receiverOn : !!this.rig?.receiverOn;
        return new THREE.Vector3(0, rxTodo ? h : BRACKET_Y + 0.05, 0);
      }
      case 'tsSeat':
      case 'tsScrew':
      case 'tsUnscrew':
      case 'tsLift':
      case 'done':
        return this.mode.startsWith('ts') ? new THREE.Vector3(0, 0.06, 0) : new THREE.Vector3(0, h, 0);
      default:
        return new THREE.Vector3(0, h - 0.02, 0);
    }
  }

  /** Každý snímek: plynulé najetí kamery, poloha dílů, napájení, rukou. */
  update(dt: number): void {
    if (this.el.hidden) return;
    const r = this.rig;
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) (this.el.querySelector('.bench-msg') as HTMLElement).hidden = true;
    }
    // Podržení tlačítka napájení.
    if (this.power && r) {
      if (performance.now() - this.power.t0 >= HOLD_MS) {
        const what = this.power.what;
        const block = (what === 'rx' ? !r.receiverOn : !r.controllerOn) ? this.cb?.powerBlock?.(what) : null;
        if (block) this.flash(block, 3);
        else if (what === 'rx') {
          if (!this.rxThread.tight) this.flash('Přijímač není na výtyčce.', 2);
          else r.receiverOn = !r.receiverOn;
        } else if (!this.ctSeated) this.flash('Kontroler není v držáku.', 2);
        else r.controllerOn = !r.controllerOn;
        this.power = null;
        this.cb?.onRig('power');
        this.advance();
      }
    }
    // Najetí kamery na aktuální místo (výtyčka se posune, aby byl detail uprostřed).
    this.focusGoal.copy(this.focusFor(this.stage));
    this.focus.lerp(this.focusGoal, 1 - Math.exp(-dt * 5));
    const want = this.stage === 'height' ? 0.26 : 0.46;
    this.depth += (want - this.depth) * (1 - Math.exp(-dt * 5));
    const depth = this.depth;
    const loupe = this.el.querySelector('.bench-loupe') as HTMLElement;
    loupe.hidden = this.stage !== 'height';
    if (!loupe.hidden) this.drawLoupe(loupe.querySelector('canvas') as HTMLCanvasElement);
    const gauge = this.el.querySelector('.bench-gauge') as HTMLElement;
    gauge.hidden = this.stage !== 'trExtend';
    if (!gauge.hidden) this.drawGauge(gauge.querySelector('canvas') as HTMLCanvasElement);
    if (this.mode === 'tripod') {
      const tg = this.tripod.children[0] as THREE.Group | undefined;
      if (tg) {
        setTripodPose(tg, this.trSpread, this.trLen);
        const u = tg.userData as { station: THREE.Object3D };
        u.station.visible = false;
      }
      // Stativ stojí svisle ve světě, i když se kamera dívá dolů (skupina je na kameře).
      const pitch = this.camera.rotation.x;
      const X = new THREE.Vector3(1, 0, 0);
      const held = this.stage === 'trUnlock' || this.stage === 'trExtend' || this.stage === 'trLock';
      const toCam = (v: THREE.Vector3): THREE.Vector3 => v.applyAxisAngle(X, -pitch);
      this.tripod.position.copy(toCam(new THREE.Vector3(0.05, -1.6 + (held ? 0.45 : 0), -1.25)));
      this.tripod.rotation.set(-pitch, 0.5, 0);
      // Ruce: levá drží hlavu, pravá u toho, na co se sahá.
      this.leftHand.position.copy(toCam(new THREE.Vector3(-0.16, -1.6 + (held ? 0.45 : 0) + this.trHead, -1.2)));
      this.rightHand.position.copy(toCam(new THREE.Vector3(0.2, -1.6 + (held ? 0.45 : 0) + this.trHead * 0.5, -1.15)));
      this.rightHand.visible = this.stage !== 'done' && this.stage !== 'trStep';
      (this.el.querySelector('.bench-hold') as HTMLElement).classList.remove('is-on');
      return;
    }
    if (this.mode.startsWith('gnss')) {
      const h = r?.height ?? 2;
      this.pole.position.set(-0.02 - this.focus.y * Math.sin(this.pole.rotation.z) * -1, -this.focus.y * Math.cos(0.1) - 0.02, -depth);
      this.pole.rotation.y = this.poleSpin;
      this.upper.position.y = h;
      // Stupnice: horní díl má texturu od vrcholu; posune se s výškou.
      this.clampLever.rotation.z = this.clampOpen ? -1.2 : 0;
      // Přijímač: na závitu klesá s otáčkami, jinak v ruce.
      const seatY = h + 0.015 + 0.012 * (1 - this.rxThread.turns / this.rxThread.maxTurns);
      this.receiver.visible = this.rxSeated || this.rxHand;
      this.receiver.position.set(this.rxPos.x, seatY + this.rxPos.y, this.rxPos.z);
      this.receiver.rotation.y = this.rxSpin;
      this.bracket.visible = this.brSeated || this.brHand;
      this.bracket.position.set(this.brPos.x, BRACKET_Y + this.brPos.y, this.brPos.z);
      this.controller.visible = this.ctSeated || this.ctHand;
      this.controller.position.set(this.ctPos.x, BRACKET_Y + this.ctPos.y, this.ctPos.z);
      for (const l of this.leds) {
        const m = l.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = r?.receiverOn ? 1.5 + Math.sin(performance.now() / 180) * 0.6 : 0;
      }
      if (this.ctrlScreen) {
        const m = this.ctrlScreen.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = r?.controllerOn ? 0.9 : 0.02;
      }
      // Ruce: levá na výtyčce (když drží), pravá u dílu, se kterým se pracuje.
      const lp = new THREE.Vector3(0, this.focus.y - 0.2, 0);
      this.pole.localToWorld(lp);
      this.group.worldToLocal(lp);
      this.leftHand.position.copy(this.held ? lp.add(new THREE.Vector3(-0.05, 0, 0.02)) : new THREE.Vector3(-0.32, -0.34, -0.5));
      const target = this.rxHand || this.stage.startsWith('rx') ? this.receiver : this.brHand || this.stage.startsWith('br') ? this.bracket : this.controller;
      const rp = target.getWorldPosition(new THREE.Vector3());
      this.group.worldToLocal(rp);
      this.rightHand.position.copy(rp.add(new THREE.Vector3(0.14, -0.04, 0.03)));
      this.rightHand.visible = this.stage !== 'height' && this.stage !== 'done';
    } else {
      this.tsHead.position.set(0, -0.2, -0.5);
      this.tsHead.rotation.x = 0.55;
      this.ts.position.copy(this.tsHead.position).add(new THREE.Vector3(this.tsPos.x, this.tsPos.y * Math.cos(0.55), this.tsPos.y * Math.sin(0.55) + this.tsPos.z));
      this.ts.rotation.x = 0.55;
      this.ts.rotation.y = this.tsSpin;
      this.screwKnob.rotation.y = this.tsThread.turns * Math.PI * 2;
      this.leftHand.position.copy(this.held ? this.ts.position.clone().add(new THREE.Vector3(-0.12, 0.1, 0)) : new THREE.Vector3(-0.32, -0.34, -0.5));
      this.rightHand.position.copy(
        this.stage === 'tsScrew' || this.stage === 'tsUnscrew' ? this.tsHead.position.clone().add(new THREE.Vector3(0.05, -0.1, 0.02)) : this.ts.position.clone().add(new THREE.Vector3(0.13, 0.08, 0)),
      );
      this.rightHand.visible = true;
    }
    // Kruhová značka: kudy vést prst při šroubování (šipka po směru nebo proti).
    const ring = this.el.querySelector('.bench-ring') as HTMLElement;
    const st = this.stage;
    const screwing = st === 'rxScrew' || st === 'rxUnscrew' || st === 'brScrew' || st === 'brUnscrew' || st === 'tsScrew' || st === 'tsUnscrew';
    ring.hidden = !screwing;
    if (screwing) {
      const c = st.startsWith('rx') ? this.screenOf(this.receiver) : st.startsWith('br') ? this.screenOf(this.bracket, new THREE.Vector3(-0.032, 0, 0)) : this.screenOf(this.screwKnob);
      const r = this.el.getBoundingClientRect();
      ring.style.left = `${c.x - r.left}px`;
      ring.style.top = `${c.y - r.top}px`;
      ring.classList.toggle('is-ccw', st.endsWith('Unscrew'));
      (ring.querySelector('span') as HTMLElement).textContent = st.endsWith('Unscrew') ? '↺' : '↻';
    }
    const hb = this.el.querySelector('.bench-hold') as HTMLElement;
    hb.classList.toggle('is-on', this.held);
    hb.classList.toggle('is-locked', this.holdLocked);
  }

  private depth = 0.52;

  /** Lupa: zvětšená stupnice kolem horní hrany svěrky. Číslo se neukazuje – odečte se z dílků. */
  private drawLoupe(c: HTMLCanvasElement): void {
    const g = c.getContext('2d');
    const r = this.rig;
    if (!g || !r) return;
    const W = c.width;
    const H = c.height;
    const pxPerCm = 16;
    const edge = H * 0.62; // horní hrana svěrky
    g.fillStyle = '#15181b';
    g.fillRect(0, 0, W, H);
    // Bod výš na výtyčce je blíž vrcholu, proto na něm stupnice ukazuje menší číslo.
    g.fillStyle = '#1e2124';
    g.fillRect(W * 0.2, 0, W * 0.6, H);
    const readAt = (y: number): number => r.height - (edge - y) / pxPerCm / 100;
    for (let cm = Math.floor(readAt(0) * 100) - 1; cm <= Math.ceil(readAt(H) * 100) + 1; cm++) {
      const y = edge - (r.height * 100 - cm) * pxPerCm;
      const major = cm % 10 === 0;
      const mid = cm % 5 === 0;
      g.fillStyle = major ? '#f2b705' : '#e8e8e8';
      g.fillRect(W * 0.2, y - 1, major ? W * 0.34 : mid ? W * 0.26 : W * 0.16, major ? 3 : 2);
      if (mid) {
        g.font = `bold ${major ? 17 : 14}px sans-serif`;
        g.fillText((cm / 100).toFixed(2).replace('.', ','), W * 0.42, y - 3);
      }
    }
    // Svěrka zakrývá výtyčku od své horní hrany dolů.
    const grd = g.createLinearGradient(0, edge, 0, H);
    grd.addColorStop(0, '#3a4046');
    grd.addColorStop(1, '#23272b');
    g.fillStyle = grd;
    g.fillRect(W * 0.12, edge, W * 0.76, H - edge);
    g.fillStyle = this.clampOpen ? '#c98a12' : '#e8ae10';
    g.fillRect(W * 0.8, edge + 4, W * 0.12, 40);
  }

  /** Postava 1,78 m a stativ vedle ní: hlava stativu vůči hrudníku, zelené pásmo = okulár u oka. */
  private drawGauge(c: HTMLCanvasElement): void {
    const g = c.getContext('2d');
    if (!g) return;
    const W = c.width;
    const H = c.height;
    const k = (H - 16) / 1.9; // px na metr
    const y = (m: number): number => H - 8 - m * k;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(76, 175, 80, 0.25)';
    g.fillRect(0, y(1.4), W, y(1.2) - y(1.4));
    g.strokeStyle = '#eef1ea';
    g.lineWidth = 3;
    g.lineCap = 'round';
    // Postava.
    const px = W * 0.3;
    g.beginPath();
    g.arc(px, y(1.66), 9, 0, Math.PI * 2);
    g.moveTo(px, y(1.56));
    g.lineTo(px, y(0.9));
    g.lineTo(px - 10, y(0));
    g.moveTo(px, y(0.9));
    g.lineTo(px + 10, y(0));
    g.moveTo(px - 16, y(1.2));
    g.lineTo(px, y(1.45));
    g.lineTo(px + 18, y(1.25));
    g.stroke();
    // Stativ.
    const tx = W * 0.72;
    const h = this.trHead;
    g.strokeStyle = '#c08a4a';
    g.beginPath();
    g.moveTo(tx - 4, y(0));
    g.lineTo(tx, y(h));
    g.lineTo(tx + 4, y(0));
    g.stroke();
    g.fillStyle = '#f2b705';
    g.fillRect(tx - 10, y(h) - 4, 20, 6);
    const ok = h >= 1.2 && h <= 1.4;
    g.fillStyle = ok ? '#7fd489' : '#f0a38f';
    g.font = 'bold 12px sans-serif';
    g.fillText(ok ? 'akorát' : h < 1.2 ? 'nízko' : 'vysoko', tx - 18, y(h) - 8);
  }

  private render(): void {
    const s = this.stage;
    (this.el.querySelector('.bench-hint') as HTMLElement).textContent = HINT[s];
    const order: Stage[] =
      this.mode === 'gnss-assemble'
        ? ['height', 'rxSeat', 'rxScrew', 'brSeat', 'brScrew', 'ctSeat', 'power']
        : this.mode === 'gnss-pack'
          ? ['off', 'ctOut', 'brUnscrew', 'brOut', 'rxUnscrew', 'rxOut']
          : this.mode === 'ts-mount'
            ? ['tsSeat', 'tsScrew']
            : this.mode === 'tripod'
              ? ['trUnlock', 'trExtend', 'trLock', 'trSpread', 'trStep']
              : ['tsUnscrew', 'tsLift'];
    const alias: Partial<Record<Stage, Stage>> = { rxTake: 'rxSeat', brTake: 'brSeat', ctTake: 'ctSeat' };
    const cur = order.indexOf(alias[s] ?? s);
    (this.el.querySelector('.bench-steps') as HTMLElement).innerHTML = order
      .map((st, i) => `<li class="${s === 'done' || i < cur ? 'is-done' : i === cur ? 'is-cur' : ''}">${STEP_LABEL[st] ?? st}</li>`)
      .join('');
    const acts: [string, string][] = [];
    if (s === 'height') acts.push(['heightOk', 'Výška nastavená']);
    if (s === 'rxTake') acts.push(['rxTake', 'Vyndat přijímač z kufru']);
    if (s === 'brTake') acts.push(['brTake', 'Vyndat držák z kufru']);
    if (s === 'ctTake') acts.push(['ctTake', 'Vyndat kontroler z kufru']);
    if ((s === 'ctOut' && this.ctHand) || (s === 'brOut' && this.brHand) || (s === 'rxOut' && this.rxHand)) acts.push(['store', 'Uložit do kufru']);
    if (s === 'tsLift' && this.tsPos.y > 0.12) acts.push(['tsStore', 'Uložit do kufru']);
    if (s === 'trExtend') acts.push(['trLenOk', 'Délka nohou OK']);
    if (s === 'trStep') acts.push(['trDone', 'Hotovo (bez sešlápnutí)']);
    (this.el.querySelector('.bench-actions') as HTMLElement).innerHTML = acts.map(([id, l]) => `<button data-b="${id}">${l}</button>`).join('');
    const needHold = s === 'rxScrew' || s === 'rxUnscrew' || s === 'brScrew' || s === 'brUnscrew' || s === 'tsScrew' || s === 'tsUnscrew';
    const hold = this.el.querySelector('.bench-hold') as HTMLElement;
    hold.hidden = !needHold;
    (hold.querySelector('span') as HTMLElement).textContent = this.mode.startsWith('ts') ? 'Držet stanici' : 'Držet výtyčku';
    (this.el.querySelector('.bench-close') as HTMLElement).textContent = s === 'done' ? 'Hotovo' : 'Zavřít';
  }
}
