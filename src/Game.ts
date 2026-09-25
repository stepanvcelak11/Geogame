import * as THREE from 'three';
import { Sfx } from './audio/Sfx';
import { CONFIG } from './config';
import { EventBus } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { clamp, DEG, lookDirection, vec3, type Vec3 } from './core/math';
import { Rng } from './core/Rng';
import type { GameEvents } from './events';
import { radToGon } from './geodesy/CoordinateSystem';
import type { FeatureCode } from './geodesy/types';
import { GnssReceiver, SOLUTION_LABEL } from './gnss/GnssReceiver';
import {
  ANTENNA_TYPES,
  BT_DEVICES,
  CRS_OPTIONS,
  EPOCH_OPTIONS,
  FieldController,
  MOUNTPOINTS,
  NTRIP_CASTER,
  RECEIVER_SERIAL,
  reportCoords,
  SETUP_STEP_TEXT,
  type CrsId,
  type ImportFile,
} from './gnss/FieldController';
import { ControllerScreen, type ControllerView } from './ui/ControllerScreen';
import { Bench } from './ui/Bench';
import {
  BROKEN,
  collimationArcsec,
  dropDamage,
  EQUIP_NAME,
  equipOf,
  newEquipment,
  noiseFactor,
  repairCost,
  stateLabel,
  WEAR_PER_JOB,
  type EquipId,
} from './jobs/Equipment';
import { canSwap, chargeSpare, drain, freshBatteries, LOW, PACK_NAME, swap, type Batteries, type DrainEvent, type PackId } from './jobs/Battery';
import { HelpScreen } from './ui/HelpScreen';
import { coachSeen, showCoach } from './ui/Coach';
import { StationDialog } from './ui/StationDialog';
import { ProcessingScreen, type ProcRow } from './ui/ProcessingScreen';
import { Input } from './input/Input';
import { TouchControls } from './input/TouchControls';
import { InteractionSystem, type InteractionPrompt } from './interaction/InteractionSystem';
import { ITEM_DEFS, type Hand, type ItemKind, type WorldItem } from './items/items';
import { designTargets } from './jobs/designTargets';
import { JOB_TYPE_NAME, JOBS, type JobSpec } from './jobs/JobCatalog';
import { ordersForDay } from './jobs/Generator';
import { EXPORT_FORMATS, exportPoints, pointsCsv, type ExportFormat } from './survey/PointExport';
import { MappingTask } from './jobs/MappingTask';
import { ReconTask, REPORT_RADIUS } from './jobs/ReconTask';
import { StakeoutTask, type StakeTarget } from './jobs/StakeoutTask';
import { HandInventory } from './player/HandInventory';
import { Helper } from './npc/Helper';
import { Birds } from './render/Birds';
import { Clouds } from './render/Clouds';
import { Horizon } from './render/Horizon';
import { daylight, weatherize } from './render/DayCycle';
import { Rain } from './render/Rain';
import { Beacon } from './render/Beacon';
import { levelNoise, poleTremor, stationRanges, weatherForDay, weatherText, type Weather } from './world/Weather';
import { HelperView } from './render/HelperView';
import { HelperSheet, type HelperMenu } from './ui/HelperSheet';
import { BUBBLE_LIMIT, MAX_TILT, PoleBalance } from './player/PoleBalance';
import { PlayerController, type MoveIntent } from './player/PlayerController';
import { Flashlight } from './render/Flashlight';
import { ItemsView } from './render/ItemsView';
import { createMarkMesh, createVehicleMesh, DRIVER_EYE, syncVehicle } from './render/PropsView';
import { setRealisticMaterials } from './render/materials';
import { detectQuality, RenderContext, SKY_HORIZON, SUN_DIR } from './render/RenderContext';
import { Sky } from './render/Sky';
import { StakesView } from './render/StakesView';
import { TargetMarker } from './render/TargetMarker';
import { GrassView } from './render/GrassView';
import { createScenery } from './render/SceneryView';
import { createTerrainMesh, createWater } from './render/TerrainView';
import { createVegetation } from './render/VegetationView';
import { createBuilding, createFence, createRoad } from './render/WorldFeaturesView';
import { InstrumentSetup } from './survey/InstrumentSetup';
import { solveResection, type ResectionObs } from './survey/FreeStation';
import { closureLimit, LevelLine, readRod, type LevelInstrument, type LevelShot } from './survey/Leveling';
import { RoboticLink } from './survey/RoboticLink';
import { TotalStation, type Prism, type ShotResult, type TsMode, type TsShot } from './survey/TotalStation';
import { mm, PointLog, type MeasuredPoint } from './survey/PointLog';
import { Hud, type GnssView, type NavView } from './ui/Hud';
import { CargoSheet } from './ui/CargoSheet';
import { SettingsScreen } from './ui/SettingsScreen';
import { ProtocolScreen, type ProtocolView } from './ui/ProtocolScreen';
import { drawDistanceFor, loadSettings, saveSettings, type Settings } from './settings/Settings';
import { showIntro } from './ui/IntroScreen';
import { OfficeScreen, type KitRow, type OfficeCard, type OfficeView } from './ui/OfficeScreen';
import {
  clearCareer,
  extraPay,
  kc,
  loadCareer,
  newCareer,
  okJobs,
  payFor,
  rankFor,
  rankIndex,
  rankOf,
  RANKS,
  saveCareer,
  UPGRADES,
  urgentJob,
  type CareerState,
} from './jobs/Career';
import { MapRenderer } from './ui/MapRenderer';
import { describeMark } from './ui/presenters';
import { ScopeScreen } from './ui/ScopeScreen';
import { SetupScreen } from './ui/SetupScreen';
import { Tablet, type JobPanel, type PanelRow, type PointRow, type TabletState } from './ui/Tablet';
import { clockText, TravelScreen } from './ui/TravelScreen';
import { VehicleController } from './vehicle/VehicleController';
import { LOCATIONS, travelMinutes } from './world/locations';
import { MARK_TYPE_SHORT, type ControlMark, type FeatureInfo, type LocationId, type World } from './world/World';
import { FOREST, generateWorld } from './world/WorldGen';

/** Bod na zemi, kam míří hráč (pro stativ, výtyčku, hrot roveru). */
interface AimPoint {
  x: number;
  y: number;
  z: number;
  groundY: number;
  mark: ControlMark | null; // přichyceno ke známému bodu
  feature: FeatureInfo | null; // přichyceno k prvku polohopisu
  valid: boolean;
}

interface ActionPlan extends InteractionPrompt {
  run?: () => void;
}

type JobStatus = 'nova' | 'aktivni' | 'odevzdana';
interface JobRun {
  spec: JobSpec;
  status: JobStatus;
  recon?: ReconTask;
  stake?: StakeoutTask;
  mapping?: MappingTask;
  level?: LevelLine;
  result?: { ok: boolean; text: string };
  check?: { mark: string; dPos: number; dH: number }; // kontrolní měření GNSS na bodu bodového pole
  firstPoint?: number; // index v zápisníku, od kterého jsou body této zakázky
}

const CHECK_TOL = { xy: 0.03, h: 0.05 };
const SNAP_RADIUS = 0.3;
const CODES: { code: FeatureCode; label: string }[] = [
  { code: 'TERENNI_BOD', label: 'Terén' },
  { code: 'VPUST', label: 'Vpust' },
  { code: 'ROH_BUDOVY', label: 'Roh budovy' },
  { code: 'OBRUBNIK', label: 'Obrubník' },
  { code: 'PLOT', label: 'Plot' },
  { code: 'STROM', label: 'Strom' },
  { code: 'HRANICE', label: 'Hranice' },
  { code: 'PROPUSTEK', label: 'Propustek' },
];
const GAME_MIN_PER_SEC = 10 / 60; // herní čas běží 10× rychleji
const INSURANCE = 12000; // jednorázové pojištění vybavení [Kč]
/** „Roh trafostanice SV“ → „roh trafostanice SV“ (zkratky zůstanou velké). */
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
/** Metry → „−0,6“ mm s typografickým minus. */
const mmTxt = (v: number): string => (v * 1000).toFixed(1).replace('.', ',').replace('-', '−');

type RobotKind = 'orient' | 'measure' | 'resect';

export interface GameOptions {
  start?: LocationId; // testy: začít rovnou na stavbě
  steadyPole?: boolean; // testy: výtyčka se nekývá
}

/** Lokální bod dodávky (čelo na −x, řidič vlevo = +z) → herní rámec. */
function vanLocal(v: { x: number; z: number; yaw: number; groundY: number }, lx: number, ly: number, lz: number): Vec3 {
  const t = v.yaw - Math.PI / 2;
  return { x: v.x + lx * Math.cos(t) + lz * Math.sin(t), y: v.groundY + ly, z: v.z - lx * Math.sin(t) + lz * Math.cos(t) };
}

/**
 * Propojení vrstev: logika (lokality, hráč, dodávka, zakázky, GNSS, ustavení) ← vstup, → render, UI a zvuk.
 * Logika nikdy nesahá na three.js ani DOM; komunikuje přes stav a EventBus.
 */
export class Game {
  private readonly bus = new EventBus<GameEvents>();
  private readonly hands = new HandInventory();
  private readonly items: WorldItem[];
  private readonly itemIds: Set<string>;
  private readonly gnss = new GnssReceiver(new Rng(CONFIG.seed ^ 0x9e3779b9));
  private readonly ctrl = new FieldController();
  private readonly bench: Bench;
  private readonly help: HelpScreen;
  private readonly stationDialog: StationDialog;
  private readonly proc: ProcessingScreen;
  private procJob: string | null = null;
  private readonly ctrlScreen: ControllerScreen;
  private rigCase: WorldItem | null = null; // kufr, u kterého se rover skládá
  /** Probíhající observace bodu GNSS (měří se po epochách, hráč musí stát). */
  private obs: { t: number; need: number; aim: AimPoint; helper?: string } | null = null;
  private ctrlLast: string[] = [];
  private readonly rng = new Rng(CONFIG.seed ^ 0x51ed27);
  private readonly log = new PointLog();
  private readonly pole = new PoleBalance(new Rng(CONFIG.seed ^ 0x7a11));
  private readonly worlds = new Map<LocationId, World>();
  private readonly jobs = new Map<string, JobRun>();
  private readonly stakes: { id: string; location: LocationId; pos: Vec3 }[] = [];
  private readonly setups = new Map<string, InstrumentSetup>();
  private readonly stations = new Map<string, TotalStation>();
  private readonly links = new Map<string, RoboticLink>(); // rádio tablet ↔ robotická stanice
  private readonly resections = new Map<string, ResectionObs[]>(); // měření pro volné stanovisko
  private robotMeasure: { t: number; kind: RobotKind; aim: AimPoint; from: { x: number; z: number } } | null = null;
  private robotLive: { hz: number; hd: number } | null = null;
  private readonly gfx: RenderContext;
  private readonly sky: Sky;
  private readonly itemsView: ItemsView;
  private readonly flashlight: Flashlight;
  private readonly input: Input;
  private readonly touch: TouchControls;
  private readonly hud: Hud;
  private readonly tablet: Tablet;
  private readonly setupScreen: SetupScreen;
  private readonly travelScreen: TravelScreen;
  private readonly scopeScreen: ScopeScreen;
  private readonly sfx = new Sfx();
  private readonly loop: GameLoop;

  // --- aktuální lokalita
  private world!: World;
  private player!: PlayerController;
  private vehicle!: VehicleController;
  private interaction!: InteractionSystem;
  private locGroup: THREE.Group | null = null;
  private vanMesh!: THREE.Group;
  private stakesView!: StakesView;
  private marker!: TargetMarker;
  private grass!: GrassView;

  private started = false;
  private traveling = false;
  private touchMode: boolean;
  private driving = false;
  private driveLook = { yaw: 0, pitch: -0.05 };
  private jumpQueued = false;
  private intent: MoveIntent = { forward: 0, right: 0, sprint: false, jump: false };
  private readonly eye = vec3();
  private aim: AimPoint | null = null;
  private plan: ActionPlan | null = null;
  private twoFaces = false; // stanice měří v I. i II. poloze dalekohledu
  private facesWarned = new Set<string>(); // stanice, u kterých už padlo varování na chybu 2c
  private lastMeasure: string | null = null;
  private activeJobId: string | null = null;
  private showBoard = true;
  private selectedTarget: string | null = null;
  private navReading: { x: number; z: number } | null = null;
  private navTimer = 0;
  private codeIdx = 0;
  private departConfirm: LocationId | null = null;
  private clockMin = 7 * 60 + 30;
  private scope: {
    kind: 'ts' | 'level';
    itemId: string;
    yaw: number;
    pitch: number;
    finder: boolean;
    mode: TsMode;
    last: string | null;
    shot: { sd: number; hd: number; dh: number } | null;
    sight?: 'back' | 'fore'; // nivelace: vynucená záměra (jinak automaticky)
    read?: { reading: number; dist: number } | null;
  } | null = null;
  private lastLevelRead: { reading: number; dist: number } | null = null;
  private levelSetupNo = 0; // každé postavení nivelačního přístroje = nová sestava
  private tpCounter = 0; // přestavové body
  private levelCollimation = 0; // chyba horizontu nivelačního přístroje (nastaví se v konstruktoru)
  private hudTimer = 0;
  private lastStep = 0;

  private career: CareerState = newCareer();
  private readonly officeScreen: OfficeScreen;
  private readonly cargoSheet: CargoSheet;
  private officeSel: string | null = null;
  private helper!: Helper;
  private readonly helperView: HelperView;
  private readonly helperSheet: HelperSheet;
  private readonly clouds: Clouds;
  private daylightT = 0;
  private poleHintShown = false;
  private gnssCaseHintShown = false;
  private lastBonus = 0;
  private lastExtra = { rank: 0, urgent: 0, rankName: '' };
  private precise = false;
  private bipodTip: { x: number; z: number } | null = null; // výtyčka opřená o dvojnožku
  private navHistory: { x: number; z: number }[] = [];
  private goalPoint: { x: number; y: number; z: number } | null = null;
  private settings!: Settings;
  private readonly settingsScreen: SettingsScreen;
  private readonly protocolScreen: ProtocolScreen;
  private weather: Weather = weatherForDay(1);
  private readonly rain: Rain;
  private readonly horizon: Horizon;
  private readonly birds: Birds;
  private readonly beacon: Beacon;
  private night = 0;
  private helperGoal: { x: number; y: number; z: number; label: string; mark?: ControlMark; feature?: FeatureInfo } | null = null;
  private dayEarned = 0;
  private windT = 1;
  private lowFpsT = 0;
  private qualityCooldown = 20; // chvíli po startu nehodnotit (načítání)

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: GameOptions = {},
  ) {
    for (const spec of JOBS) this.jobs.set(spec.id, { spec, status: 'nova' });
    this.levelCollimation = ((this.rng.next() - 0.5) * 2 * 8 * Math.PI) / (180 * 3600); // ±8″
    const first = this.worldOf(opts.start ?? 'kancelar');
    this.items = first.itemSpawns.map((s, i) => ({
      id: `${s.kind}-${i}`,
      kind: s.kind,
      state: 'ground' as const,
      location: first.location,
      pos: { x: s.x, y: first.heightmap.heightAt(s.x, s.z), z: s.z },
      yaw: s.yaw,
      hand: null,
    }));
    this.itemIds = new Set(this.items.map((i) => i.id));
    for (const it of this.items) it.home = { ...it.pos };
    // Výtyčka pro GNSS: kolega ji nechal vysunutou na 1,80 m, přijímač a kontroler jsou v kufru.
    for (const it of this.items)
      if (it.kind === 'gnssRover') it.rig = { height: 1.8, receiver: false, controller: false, receiverOn: false, controllerOn: false };

    // --- Render (trvalé části)
    const quality = detectQuality();
    setRealisticMaterials(loadSettings(quality.mobile).gfx >= 1); // materiály se staví se scénou
    this.touchMode = quality.mobile;
    this.gfx = new RenderContext(root, quality);
    this.sky = new Sky(this.gfx.scene, quality.drawDistance * 0.95, SKY_HORIZON, SUN_DIR);
    this.itemsView = new ItemsView(this.gfx.scene, this.gfx.camera, this.items);
    this.flashlight = new Flashlight(this.gfx.camera);

    // --- Vstup a UI
    this.input = new Input(this.gfx.renderer.domElement);
    this.hud = new Hud(root, this.bus);
    this.touch = new TouchControls(root, this.input);
    this.tablet = new Tablet(root, new MapRenderer(first));
    this.setupScreen = new SetupScreen(root);
    this.travelScreen = new TravelScreen(root);
    this.scopeScreen = new ScopeScreen(root);
    this.bindScope();
    this.hud.setTouchMode(this.touchMode);
    this.hud.onHandTap = (hand) => this.selectHand(hand);
    this.hud.onOpenTablet = () => this.openTablet();
    this.hud.onBubbleDrag = (dx, dy, radius) => {
      // Bublina se táhne do kroužku: posun bubliny = opačný náklon vrcholu výtyčky.
      const pxPerRad = (radius * 0.84) / (3 * BUBBLE_LIMIT);
      const sx = -dx / pxPerRad;
      const sy = -dy / pxPerRad;
      const y = this.player.yaw;
      const f = { x: -Math.sin(y), z: -Math.cos(y) };
      const r = { x: Math.cos(y), z: -Math.sin(y) };
      this.pole.nudge(r.x * sx - f.x * sy, r.z * sx - f.z * sy);
    };
    this.hud.onBipod = () => this.toggleBipod();
    this.hud.onBubbleTap = () => {
      this.pole.quickLevel();
      this.sfx.click();
    };
    this.hud.onCodeTap = () => {
      this.codeIdx = (this.codeIdx + 1) % CODES.length;
      this.sfx.click();
    };
    this.tablet.onAction = (id) => this.tabletAction(id);
    this.tablet.onCopyPoints = () => this.copyPoints();
    this.tablet.onDownloadPoints = (f) => this.downloadPoints(f);
    this.tablet.onClose = () => {
      this.sfx.click();
      this.departConfirm = null;
      this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    };
    this.bench = new Bench(root, this.gfx.camera, this.gfx.renderer.domElement);
    this.proc = new ProcessingScreen(root);
    this.proc.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.proc.onSend = (ex, out) => this.processSend(ex, out);
    this.stationDialog = new StationDialog(root);
    this.stationDialog.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.help = new HelpScreen(root);
    this.help.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.help.onCoach = () => {
      this.help.hide();
      this.openCoach();
    };
    this.hud.onHelp = () => {
      if (this.input.pointerLocked) document.exitPointerLock();
      this.help.show(this.helpTopic());
    };
    this.ctrlScreen = new ControllerScreen(root);
    this.ctrlScreen.onAction = (id, v) => this.controllerAction(id, v);
    this.ctrlScreen.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.hud.onOpenController = () => this.openController();
    this.setupScreen.onDone = () => this.setupDone();
    this.setupScreen.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.input.onPointerLockChange = (locked) => this.hud.setLockHint(this.started && !locked && !this.touchMode && !this.modalOpen);
    this.gfx.renderer.domElement.addEventListener('click', () => {
      if (this.started && !this.touchMode && !this.input.pointerLocked && !this.modalOpen) this.input.requestPointerLock();
    });
    addEventListener('touchstart', () => this.setTouchMode(true), { once: true, passive: true });

    this.helperView = new HelperView(this.gfx.scene);
    this.clouds = new Clouds(this.gfx.scene, quality.drawDistance * 0.9);
    this.rain = new Rain(this.gfx.scene, quality.mobile);
    this.horizon = new Horizon(this.gfx.scene, quality.drawDistance * 0.9);
    this.birds = new Birds(this.gfx.scene);
    this.beacon = new Beacon(this.gfx.scene);
    this.helperSheet = new HelperSheet(root);
    this.helperSheet.onCommand = (id) => this.helperCommand(id);
    this.helperSheet.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.hud.onHelper = () => this.openHelper();
    this.protocolScreen = new ProtocolScreen(root);
    this.protocolScreen.onCopy = (t) => this.copyText(t, 'Protokol zkopírován.');
    this.protocolScreen.onDownload = (t, title) =>
      this.downloadText(`protokol-den${this.career.day}-${title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`, t, 'text/plain');
    this.settingsScreen = new SettingsScreen(root);
    this.settingsScreen.onChange = (s) => this.applySettings(s);
    this.settingsScreen.onResetCareer = () => {
      clearCareer();
      this.bus.emit('toast', { text: 'Uložená kariéra smazána. Nová začne při příštím spuštění.' });
    };
    this.settingsScreen.onClose = () => this.hud.setLockHint(this.started && !this.touchMode && !this.input.pointerLocked);
    this.hud.onSettings = () => {
      if (this.input.pointerLocked) document.exitPointerLock();
      this.settingsScreen.show(this.settings);
    };
    this.officeScreen = new OfficeScreen(root);
    this.officeScreen.onAction = (id) => this.officeAction(id);
    this.officeScreen.onClose = () => this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    this.cargoSheet = new CargoSheet(root);
    this.cargoSheet.onTake = (id) => {
      const it = this.items.find((i) => i.id === id);
      if (!it) return;
      if (!this.hands.freeHand()) {
        this.bus.emit('toast', { text: this.fullHandsReason(), tone: 'warn' });
        return;
      }
      this.pickUp(it);
      this.cargoSheet.hide();
    };
    this.loadLocation(first.location, 'spawn');
    this.applySettings(loadSettings(quality.mobile), false);
    this.refreshHands();

    this.loop = new GameLoop(CONFIG.loop.fixedDt, CONFIG.loop.maxSubSteps, {
      beforeSteps: (dt) => this.beforeSteps(dt),
      step: (dt) => this.step(dt),
      render: (alpha, dt) => this.render(alpha, dt),
    });
  }

  start(): void {
    this.loop.start();
    this.root.classList.add('is-intro');
    const saved = loadCareer();
    showIntro(this.root, { touch: this.touchMode, save: saved ? { day: saved.day, money: kc(saved.money) } : null, onSettings: () => this.settingsScreen.show(this.settings) }, (mode) => {
      if (mode === 'continue' && saved) this.applyCareer(saved);
      else {
        clearCareer();
        this.career = newCareer();
        this.refreshOrders();
      }
      this.started = true;
      this.weatherTip();
      // Při prvním spuštění krátký úvod do ovládání (v automatických testech ne).
      const testing = (window as unknown as { __GEODET_TEST?: boolean }).__GEODET_TEST;
      if (!coachSeen() && !testing) setTimeout(() => this.openCoach(), 900);
      this.root.classList.remove('is-intro');
      this.sfx.unlock();
      if (this.touchMode) {
        this.touch.setVisible(true);
        void this.enterFullscreen();
      } else {
        this.input.requestPointerLock();
      }
      this.bus.emit('toast', {
        text:
          this.world.location === 'kancelar'
            ? `Den ${this.career.day}. Zakázky jsou na nástěnce u vchodu, vybavení ve skladu.`
            : this.touchMode
              ? 'Zakázky čekají v tabletu. Klepni na Tablet.'
              : 'Zakázky čekají v tabletu. Otevři ho klávesou M.',
      });
    });
  }

  // ================================================================ lokality

  private worldOf(loc: LocationId): World {
    let w = this.worlds.get(loc);
    if (!w) {
      w = generateWorld(loc);
      this.worlds.set(loc, w);
    }
    return w;
  }

  /** Postaví scénu a logiku lokality. arrive = 'van': hráč sedí v dodávce. */
  private loadLocation(loc: LocationId, arrive: 'spawn' | 'van'): void {
    const world = this.worldOf(loc);
    this.world = world;

    // Scéna: stará lokalita pryč (geometrie uvolnit, sdílené materiály nechat).
    if (this.locGroup) {
      this.gfx.scene.remove(this.locGroup);
      this.locGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    const g = new THREE.Group();
    const quality = this.gfx.quality;
    // Zapečené stíny: koruny stromů (posunuté k severu, slunce je většinou na jihu) a obrysy staveb.
    const occluders = [
      ...world.trees.map((t) => ({ x: t.x, z: t.z - t.crownR * 0.35, r: t.crownR * 1.25, k: t.kind === 'conifer' ? 0.5 : 0.42 })),
      ...world.scenery
        .filter((s) => s.h > 1)
        .map((s) => ({ x: s.x, z: s.z - 0.6, r: Math.hypot(s.w, s.d) / 2 + 1.6, k: s.kind === 'powerPole' ? 0.1 : 0.38 })),
    ];
    g.add(
      createTerrainMesh(world.heightmap, {
        occluders,
        flatRadius: world.flatRadius,
        gravelYard: world.location === 'kancelar',
        forestEdgeX: world.location === 'les' ? FOREST.edgeX : undefined,
        fields: world.fields,
        water: world.water,
      }),
    );
    g.add(createWater(world.water));
    g.add(createScenery(world, quality.mobile));
    this.grass = new GrassView(g, world, quality.mobile);
    if (this.settings) this.grass.setDensity([0, 0.5, 1][this.settings.grass]);
    g.add(createVegetation(world.trees, quality.shadows));
    g.add(createRoad(world.road, world.heightmap));
    if (world.building) g.add(createBuilding(world.building));
    if (world.fence) g.add(createFence(world.fence));
    for (const m of world.marks) g.add(createMarkMesh(m));
    this.vanMesh = createVehicleMesh(world.vehicle);
    g.add(this.vanMesh);
    this.stakesView = new StakesView(g);
    this.marker = new TargetMarker(this.gfx.scene);
    this.gfx.scene.add(g);
    this.locGroup = g;

    this.vehicle = new VehicleController(world.vehicle);
    this.player = new PlayerController(world.spawn, world);
    // Pepa: na začátku vedle hráče, po příjezdu sedí v dodávce.
    const hs = { x: world.spawn.x + 1.6, z: world.spawn.z + 1.2 };
    if (!this.helper) this.helper = new Helper(hs.x, hs.z, world);
    else this.helper.teleport(hs.x, hs.z, world);
    this.helper.follow();
    this.helper.inVan = arrive === 'van';
    this.helperGoal = null;
    this.interaction = new InteractionSystem();
    this.registerInteractables();
    this.tablet.setMap(new MapRenderer(world));
    this.selectedTarget = null;
    this.driving = false;
    if (arrive === 'van') this.enterVan(true);
    else this.exitVanState();
  }

  // ================================================================ dodávka

  private enterVan(silent = false): void {
    this.driving = true;
    if (this.helper?.state === 'follow' && !this.helper.carryId) this.helper.inVan = true;
    this.driveLook = { yaw: 0, pitch: -0.05 };
    this.touch.setDriving(true);
    this.marker.hide();
    this.sfx.setEngine(0);
    if (!silent) this.bus.emit('toast', { text: this.touchMode ? 'Jízda: levý palec plyn, brzda a volant.' : 'Jízda: W plyn, S brzda a couvání, A D volant, E vystoupit.' });
  }

  private exitVanState(): void {
    this.driving = false;
    this.touch.setDriving(false);
    this.sfx.setEngine(null);
    this.hud.setDrive(null);
  }

  private exitVan(): void {
    const v = this.world.vehicle;
    if (Math.abs(v.speed) > 0.5) {
      this.bus.emit('toast', { text: 'Nejdřív zastav.', tone: 'warn' });
      return;
    }
    // Vystoupit dveřmi řidiče, když tam je místo, jinak na druhé straně.
    for (const side of [1, -1]) {
      const p = vanLocal(v, -1.3, 0, side * 1.7);
      const probe = { x: p.x, z: p.z };
      const gy = this.world.heightmap.heightAt(p.x, p.z);
      this.world.resolveCircle(probe, CONFIG.player.radius, gy, gy + 1.8);
      if (Math.hypot(probe.x - p.x, probe.z - p.z) < 0.05) {
        this.player = new PlayerController({ x: p.x, z: p.z, yaw: v.yaw + this.driveLook.yaw }, this.world);
        this.player.pitch = this.driveLook.pitch;
        this.exitVanState();
        if (this.helper.inVan) {
          const q = vanLocal(v, -1.3, 0, -side * 1.7);
          this.helper.teleport(q.x, q.z, this.world);
          this.helper.inVan = false;
          this.helper.follow();
        }
        this.sfx.drop();
        return;
      }
    }
    this.bus.emit('toast', { text: 'U dveří není místo.', tone: 'warn' });
  }

  /** Věci, které by na místě zůstaly, kdyby se teď odjelo. */
  private leftBehind(): WorldItem[] {
    return this.items.filter((i) => (i.state === 'ground' || i.state === 'deployed') && i.location === this.world.location);
  }

  private depart(dest: LocationId, force: boolean): void {
    if (!this.driving || Math.abs(this.world.vehicle.speed) > 0.5) return;
    if (this.helper.carryId) {
      const it = this.items.find((i) => i.id === this.helper.carryId);
      if (it) {
        it.state = 'stored';
        this.say(`${ITEM_DEFS[it.kind].name} jsem naložil do auta.`);
      }
      this.helper.carryId = null;
    }
    const left = this.leftBehind();
    const spec = this.activeJobId ? this.jobs.get(this.activeJobId)?.spec : undefined;
    const missing = spec && spec.location === dest ? this.kitRows(spec).filter((k) => !k.ok) : [];
    const leftHere = this.world.location === 'kancelar' ? [] : left; // ve skladu vybavení nechat můžeš
    if ((leftHere.length || missing.length) && !force) {
      this.departConfirm = dest;
      const parts: string[] = [];
      if (missing.length) parts.push(`K zakázce chybí: ${missing.map((k) => k.name).join(', ')}.`);
      if (leftHere.length) parts.push(`Na místě zůstává: ${leftHere.map((i) => this.itemName(i)).join(', ')}.`);
      this.bus.emit('toast', { text: parts.join(' '), tone: 'warn' });
      return;
    }
    this.departConfirm = null;
    this.tablet.close();
    this.traveling = true;
    this.helper.follow();
    this.helper.inVan = true;
    this.sfx.setEngine(null);
    const minutes = travelMinutes(this.world.location, dest);
    const from = LOCATIONS[this.world.location];
    this.travelScreen.play(from, LOCATIONS[dest], this.clockMin, minutes, () => {
      this.clockMin += minutes;
      this.batteryTick(minutes);
      this.career.stats.km += Math.round(minutes * 0.9);
      this.loadLocation(dest, 'van');
      this.traveling = false;
      this.bus.emit('toast', { text: `Jsi na místě: ${LOCATIONS[dest].name}` });
    });
  }

  // ================================================================ interakce

  private get modalOpen(): boolean {
    return (
      this.hud.inspectOpen ||
      this.tablet.isOpen ||
      this.setupScreen.isOpen ||
      this.scopeScreen.isOpen ||
      this.officeScreen.isOpen ||
      this.cargoSheet.isOpen ||
      this.settingsScreen.isOpen ||
      this.protocolScreen.isOpen ||
      this.helperSheet.isOpen ||
      this.bench.isOpen ||
      this.help.isOpen ||
      this.coachOpen ||
      this.stationDialog.isOpen ||
      this.proc.isOpen ||
      this.ctrlScreen.isOpen ||
      this.traveling
    );
  }

  private activeItem(): WorldItem | undefined {
    const id = this.hands.activeItem();
    return id ? this.items.find((i) => i.id === id) : undefined;
  }

  private fullHandsReason(): string {
    return this.touchMode ? 'Plné ruce. Polož něco tlačítkem Položit.' : 'Plné ruce. Polož něco klávesou G.';
  }

  private registerMark(mark: ControlMark): void {
    this.interaction.register({
      id: mark.id,
      radius: mark.type === 'TB' ? 0.3 : 0.22,
      center: () => mark.pos,
      isActive: () => mark.condition !== 'missing',
      prompt: () => ({ verb: 'Prohlédnout', target: `bod ${mark.number}`, available: true }),
      use: () => this.inspect(mark),
    });
  }

  private registerInteractables(): void {
    for (const item of this.items) {
      const def = ITEM_DEFS[item.kind];
      const deployed = (): boolean => item.state === 'deployed';
      this.interaction.register({
        id: item.id,
        get radius() {
          return deployed() ? 0.35 : def.pickRadius;
        },
        center: () =>
          deployed()
            ? { x: item.pos.x, y: item.pos.y + (item.kind === 'tripod' ? 1.15 : 1.3), z: item.pos.z }
            : { x: item.pos.x, y: item.pos.y + def.pickHeight, z: item.pos.z },
        isActive: () => (item.state === 'ground' || item.state === 'deployed') && item.location === this.world.location,
        prompt: () => this.itemAction(item),
        use: () => this.itemAction(item).run?.(),
      });
    }
    for (const mark of this.world.marks) this.registerMark(mark);
    // Nástěnka zakázek v kanceláři.
    const board = this.world.scenery.find((s) => s.kind === 'board');
    if (board) {
      this.interaction.register({
        id: 'office-board',
        radius: 1.3,
        center: () => ({ x: board.x, y: board.groundY + 1.45, z: board.z + 0.2 }),
        isActive: () => !this.driving,
        prompt: () => ({ verb: 'Otevřít', target: 'dispečink zakázek', available: true }),
        use: () => this.openOffice(),
      });
    }
    // Dodávka: dveře řidiče a zadní dveře nákladového prostoru.
    const v = this.world.vehicle;
    this.interaction.register({
      id: 'van-driver',
      radius: 0.75,
      center: () => vanLocal(v, -1.3, 1.25, 1.05),
      isActive: () => !this.driving,
      prompt: () =>
        this.hands.heldIds().length
          ? { verb: 'Nastoupit', target: 'do dodávky', available: false, reason: 'Nejdřív ulož věci do auta zadními dveřmi' }
          : { verb: 'Nastoupit', target: 'do dodávky', available: true },
      use: () => this.enterVan(),
    });
    this.interaction.register({
      id: 'van-cargo',
      radius: 0.85,
      center: () => vanLocal(v, 2.5, 1.1, 0),
      isActive: () => !this.driving,
      prompt: () => this.cargoAction(),
      use: () => this.cargoAction().run?.(),
    });
  }

  private cargoAction(): ActionPlan {
    const active = this.activeItem();
    if (active) {
      return {
        verb: 'Uložit',
        target: `${ITEM_DEFS[active.kind].nameAcc} do auta`,
        available: true,
        run: () => {
          if (active.hand) this.hands.release(active.hand);
          active.state = 'stored';
          active.hand = null;
          this.setups.delete(active.id);
          this.dropStation(active.id);
          this.sfx.drop();
          this.bus.emit('toast', { text: `${this.itemName(active)} v autě` });
          this.refreshHands();
        },
      };
    }
    return { verb: 'Otevřít', target: 'nákladový prostor', available: true, run: () => this.openCargo() };
  }

  private itemAction(item: WorldItem): ActionPlan {
    const def = ITEM_DEFS[item.kind];
    const active = this.activeItem();
    const take = (verb: string, target: string): ActionPlan =>
      this.hands.freeHand()
        ? { verb, target, available: true, run: () => this.pickUp(item) }
        : { verb, target, available: false, reason: this.fullHandsReason() };

    if (item.state === 'deployed' && item.kind === 'tripod') {
      // Nohy se sešlapují hned po rozložení – drží pak i ve větru.
      if (!item.secured && !active)
        return {
          verb: 'Sešlápnout',
          target: 'nohy stativu do země',
          available: true,
          run: () => {
            item.secured = true;
            this.sfx.drop();
            navigator.vibrate?.([20, 80, 20, 80, 20]);
            this.bus.emit('toast', { text: 'Ostruhy všech tří nohou zašlápnuté do země. Stativ drží pevně i ve větru.' });
          },
        };
      if (item.mounted) {
        const swapPlan = this.batterySwapPlan('ts');
        if (swapPlan && (this.tsDead || (this.bat.ts.main <= LOW && swapPlan.available))) return swapPlan;
        if (active?.kind === 'tsCase') return { verb: 'Sundat', target: 'stanici do kufru', available: true, run: () => this.openTsBench(item, active, false) };
        if (this.stations.has(item.id)) return { verb: 'Měřit', target: 'totální stanicí', available: true, run: () => this.openScope(item) };
        return { verb: 'Ustavit', target: 'přístroj', available: true, run: () => this.openSetup(item) };
      }
      if (active?.kind === 'tsCase' && !active.empty) {
        return { verb: 'Nasadit', target: 'stanici na stativ', available: true, run: () => this.openTsBench(item, active, true) };
      }
      return take('Složit', 'stativ');
    }
    if (item.state === 'deployed' && item.kind === 'level') {
      return { verb: 'Nivelovat', target: 'přístrojem', available: true, run: () => this.openLevel(item) };
    }
    if (item.kind === 'gnssCase' && item.state === 'ground' && active?.kind === 'gnssRover' && active.rig) {
      for (const id of ['gnss', 'ctrl'] as const) {
        const sp = this.batterySwapPlan(id);
        if (sp && this.bat[id].main <= LOW && (id === 'gnss' ? active.rig.receiver : active.rig.controller)) return sp;
      }
      if (!active.rig.receiver || !active.rig.controller || !active.rig.receiverOn || !active.rig.controllerOn)
        return { verb: 'Sestavit', target: 'GNSS rover z kufru', available: true, run: () => this.openRig(item, active, 'assemble') };
      return { verb: 'Rozebrat', target: 'rover do kufru', available: true, run: () => this.openRig(item, active, 'pack') };
    }
    if (item.state === 'deployed') return take('Vzít', def.nameAcc);
    return take('Zvednout', (item.kind === 'tsCase' || item.kind === 'gnssCase') && item.empty ? 'prázdný kufr' : def.nameAcc);
  }

  private planAction(): ActionPlan | null {
    if (this.driving) {
      return Math.abs(this.world.vehicle.speed) < 0.5
        ? { verb: 'Vystoupit', target: 'z dodávky', available: true, run: () => this.exitVan() }
        : { verb: 'Vystoupit', target: 'z dodávky', available: false, reason: 'Nejdřív zastav' };
    }
    const active = this.activeItem();
    const focus = this.interaction.focused;
    const focusIsItem = !!focus && (this.itemIds.has(focus.id) || focus.id.startsWith('van-'));
    if (active?.kind === 'gnssRover' && !focusIsItem) return this.planRover();
    // Výtyčka s tabletem: s ustavenou stanicí měří na dálku, jinak se staví.
    if (active?.kind === 'prismPole' && !focusIsItem) return this.planPole(active);
    // Se stativem má rozložení nad bodem přednost před prohlídkou bodu.
    if (active?.kind === 'tripod' && !focusIsItem) return this.planUseItem(active);
    if (focus) {
      if (this.itemIds.has(focus.id)) return this.itemAction(this.items.find((i) => i.id === focus.id) as WorldItem);
      return { ...focus.prompt(), run: () => focus.use() };
    }
    if (active) return this.planUseItem(active);
    return null;
  }

  private planUseItem(item: WorldItem): ActionPlan {
    const aim = this.aim;
    const noAim = 'Před tebou je překážka';
    switch (item.kind) {
      case 'tripod': {
        const target = aim?.mark ? `stativ nad bodem ${aim.mark.number}` : 'stativ';
        if (!aim) return { verb: 'Rozložit', target, available: false, reason: noAim };
        if (!aim.valid) return { verb: 'Rozložit', target, available: false, reason: 'Tady je moc strmý svah' };
        return { verb: 'Rozložit', target, available: true, run: () => this.openTripodBench(item, aim) };
      }
      case 'prismPole': {
        const target = aim?.mark ? `výtyčku na bod ${aim.mark.number}` : 'výtyčku';
        if (!aim) return { verb: 'Postavit', target, available: false, reason: noAim };
        return { verb: 'Postavit', target, available: true, run: () => this.deploy(item, aim) };
      }
      case 'level': {
        if (!aim) return { verb: 'Postavit', target: 'nivelační přístroj', available: false, reason: noAim };
        if (!aim.valid) return { verb: 'Postavit', target: 'nivelační přístroj', available: false, reason: 'Tady je moc strmý svah' };
        return { verb: 'Postavit', target: 'nivelační přístroj', available: true, run: () => this.deploy(item, { ...aim, mark: null, feature: null, y: aim.groundY }) };
      }
      case 'rod': {
        const on = aim?.mark ? `na ${aim.mark.type === 'NZ' ? 'značku' : 'bod'} ${aim.mark.number}` : aim?.feature ? `na ${lowerFirst(aim.feature.label)}` : '';
        if (!aim) return { verb: 'Postavit', target: 'lať', available: false, reason: noAim };
        return { verb: 'Postavit', target: on ? `lať ${on}` : 'lať', available: true, run: () => this.deploy(item, aim) };
      }
      case 'tsCase':
        return {
          verb: 'Nasadit',
          target: 'stanici',
          available: false,
          reason: item.empty ? 'Stanice je na stativu. Zamiř na něj a sundej ji.' : 'Rozlož stativ a zamiř na něj.',
        };
      default:
        return this.planRover();
    }
  }

  /** Rover: u vytyčovaného bodu „Zatlouct kolík“, jinak „Změřit“. */
  private planRover(): ActionPlan {
    const aim = this.aim;
    const rig = this.activeItem()?.rig;
    const notReady = this.roverBlocked();
    if (notReady) {
      if (!rig?.receiver) return { verb: 'Sestavit', target: 'rover', available: false, reason: notReady };
      if (rig.controllerOn && this.ctrl.missing().length)
        return { verb: 'Nastavit', target: 'kontroler', available: true, run: () => this.openController() };
      return { verb: 'Změřit', target: 'bod', available: false, reason: notReady };
    }
    if (this.obs) return { verb: 'Měřím', target: `${Math.floor(this.obs.t)} / ${this.obs.need} s`, available: false, reason: 'Stůj a drž bublinu v kroužku' };
    const stake = this.activeRun()?.stake;
    const target = this.currentTarget();
    if (stake && target && !target.existingMarkId && this.navReading && aim) {
      const d = Math.hypot(target.world.x - this.navReading.x, target.world.z - this.navReading.z);
      if (d <= 0.1) {
        if (this.gnss.solution === 'none') return { verb: 'Zatlouct', target: 'kolík', available: false, reason: 'Přijímač hledá satelity…' };
        return { verb: 'Zatlouct', target: `kolík na bod ${target.id}`, available: true, run: () => this.drive(target, aim, d) };
      }
    }
    const helper = this.nextHelper();
    if (helper && aim && !aim.mark && !aim.feature) {
      const hb = { verb: 'Stabilizovat', target: `pomocný bod ${helper}` };
      if (this.gnss.solution !== 'fix') return { ...hb, available: false, reason: `Pomocný bod jen s FIXem – tady je ${SOLUTION_LABEL[this.gnss.solution]}. Jdi dál od lesa.` };
      if (Math.hypot(this.player.vel.x, this.player.vel.z) > 0.3) return { ...hb, available: false, reason: 'Při měření stůj na místě' };
      return { ...hb, available: true, run: () => this.startObservation(aim, helper) };
    }
    const what = aim?.mark ? `bod ${aim.mark.number}` : aim?.feature ? lowerFirst(aim.feature.label) : 'bod';
    const base = { verb: 'Změřit', target: what };
    if (!aim) return { ...base, available: false, reason: 'Před tebou je překážka' };
    if (this.gnss.solution === 'none') return { ...base, available: false, reason: 'Přijímač hledá satelity…' };
    if (Math.hypot(this.player.vel.x, this.player.vel.z) > 0.3) return { ...base, available: false, reason: 'Při měření stůj na místě' };
    return { ...base, available: true, run: () => this.startObservation(aim) };
  }

  /** Bod na zemi pod křížem (do 3 m); přichytí se ke značce nebo prvku do 30 cm. Jinak 0,8 m před hráčem. */
  private computeAim(eye: Vec3, dir: Vec3): AimPoint | null {
    const hm = this.world.heightmap;
    const pp = this.player.pos;
    let x: number;
    let z: number;
    const poleKind = this.activeItem()?.kind;
    if (this.bipodTip && (poleKind === 'gnssRover' || poleKind === 'prismPole')) {
      // Výtyčka stojí na dvojnožce: hrot se nehýbe, ať se hráč rozhlíží, jak chce.
      x = this.bipodTip.x;
      z = this.bipodTip.z;
    } else if (poleKind === 'gnssRover' || poleKind === 'prismPole') {
      // Hrot výtyčky je vždy 60 cm před hráčem – žádné míření kamerou do země.
      const f = lookDirection(this.player.yaw, 0);
      x = pp.x + f.x * 0.6;
      z = pp.z + f.z * 0.6;
      const probe = { x, z };
      const gy = hm.heightAt(x, z);
      this.world.resolveCircle(probe, 0.04, gy - 1, gy + 2);
      x = probe.x;
      z = probe.z;
    } else {
      const t = hm.raycast(eye, dir, 3.8, 0.1);
      const blocker = t !== null ? this.world.colliders.raycast(eye, dir, t) : null;
      // Pohled zastavený zdí těsně u rohu budovy (nebo u bodu) – hrot jde na patu zdi, kde se přichytí.
      const nearSnap = (px: number, pz: number): boolean =>
        this.world.features.some((f) => Math.hypot(f.pos.x - px, f.pos.z - pz) < SNAP_RADIUS) ||
        this.world.marks.some((m) => m.condition === 'ok' && Math.hypot(m.pos.x - px, m.pos.z - pz) < SNAP_RADIUS);
      const bx = blocker ? eye.x + dir.x * blocker.t : 0;
      const bz = blocker ? eye.z + dir.z * blocker.t : 0;
      if (t !== null && !blocker && Math.hypot(eye.x + dir.x * t - pp.x, eye.z + dir.z * t - pp.z) <= 3.2) {
        x = eye.x + dir.x * t;
        z = eye.z + dir.z * t;
      } else if (blocker && blocker.collider.tag === 'prop' && nearSnap(bx, bz) && Math.hypot(bx - pp.x, bz - pp.z) <= 3.2) {
        x = bx;
        z = bz;
      } else {
        const f = lookDirection(this.player.yaw, 0);
        x = pp.x + f.x * 0.8;
        z = pp.z + f.z * 0.8;
        const probe = { x, z };
        const gy = hm.heightAt(x, z);
        this.world.resolveCircle(probe, 0.05, gy - 1, gy + 2);
        if (Math.hypot(probe.x - x, probe.z - z) > 1e-6) return null;
      }
    }
    let y = hm.heightAt(x, z);
    let mark: ControlMark | null = null;
    let feature: FeatureInfo | null = null;
    let best = SNAP_RADIUS;
    const rodActive = this.activeItem()?.kind === 'rod';
    for (const m of this.world.marks) {
      if (m.condition !== 'ok' || (m.type === 'NZ' && !rodActive)) continue;
      const d = Math.hypot(m.pos.x - x, m.pos.z - z);
      if (d < best) {
        best = d;
        mark = m;
      }
    }
    if (!mark) {
      for (const f of this.world.features) {
        const d = Math.hypot(f.pos.x - x, f.pos.z - z);
        if (d < best) {
          best = d;
          feature = f;
        }
      }
    }
    const snap = mark?.pos ?? feature?.pos;
    if (snap) {
      x = snap.x;
      z = snap.z;
      y = snap.y;
    }
    return { x, y, z, groundY: hm.heightAt(x, z), mark, feature, valid: hm.slopeAt(x, z) < 25 * DEG };
  }

  private deploy(item: WorldItem, aim: AimPoint): void {
    if (item.hand) this.hands.release(item.hand);
    item.state = 'deployed';
    item.hand = null;
    item.location = this.world.location;
    item.yaw = this.player.yaw;
    item.overMarkId = aim.mark?.id;
    if (item.kind === 'level') {
      this.levelSetupNo++;
      item.stationYaw = this.player.yaw;
    }
    if (item.kind === 'rod') {
      const f = aim.feature;
      if (aim.mark) {
        item.pointId = aim.mark.id;
        item.pointLabel = aim.mark.number;
      } else if (f) {
        item.pointId = f.id;
        item.pointLabel = f.id.startsWith('vb') ? f.id.toUpperCase() : f.label;
      } else {
        this.tpCounter++;
        item.pointId = `TP${this.tpCounter}`;
        item.pointLabel = `přestav ${this.tpCounter}`;
      }
    }
    if (item.kind === 'tripod') {
      // Stativ nikdy nedosedne přesně: 3–9 cm vedle, hlava nakloněná podle terénu.
      const a = this.rng.next() * Math.PI * 2;
      const off = aim.mark ? 0.03 + this.rng.next() * 0.06 : 0;
      const cx = aim.x + Math.cos(a) * off;
      const cz = aim.z + Math.sin(a) * off;
      const g = this.world.heightmap.gradientAt(cx, cz);
      const jitter = (): number => (this.rng.next() - 0.5) * 3 * DEG;
      const tilt = { x: -g.dx * 0.8 + jitter(), z: -g.dz * 0.8 + jitter() };
      const gy = this.world.heightmap.heightAt(cx, cz);
      item.pos = { x: cx, y: gy, z: cz };
      this.setups.set(item.id, new InstrumentSetup({ x: cx, z: cz }, gy, this.player.yaw, tilt, aim.mark ? { ...aim.mark.pos } : null, this.rng));
    } else {
      item.pos = { x: aim.x, y: aim.y, z: aim.z };
    }
    this.sfx.drop();
    navigator.vibrate?.(12);
    const where = aim.mark ? ` nad bodem ${aim.mark.number}` : '';
    const msg =
      item.kind === 'tripod'
        ? `Stativ rozložen${where}`
        : item.kind === 'level'
          ? 'Nivelák stojí, kompenzátor urovnal záměru'
          : item.kind === 'rod'
            ? `Lať stojí na: ${item.pointLabel}`
            : `Výtyčka stojí${aim.mark ? ` na bodě ${aim.mark.number}` : ''}`;
    this.bus.emit('toast', { text: msg });
    this.refreshHands();
  }

  private mount(tripod: WorldItem, kase: WorldItem): void {
    tripod.mounted = true;
    kase.empty = true;
    // Prázdný kufr jde stranou: aktivní je volná ruka, další krok je ustavení.
    if (kase.hand) this.hands.setActive(kase.hand === 'right' ? 'left' : 'right');
    this.sfx.pickup();
    this.bus.emit('toast', { text: 'Stanice nasazená. Teď ji ustav nad bodem.' });
    this.refreshHands();
  }

  private unmount(tripod: WorldItem, kase: WorldItem): void {
    tripod.mounted = false;
    kase.empty = false;
    const s = this.setups.get(tripod.id);
    if (s) s.done = false;
    this.dropStation(tripod.id);
    this.sfx.pickup();
    this.bus.emit('toast', { text: 'Stanice zpátky v kufru' });
    this.refreshHands();
  }

  private openSetup(tripod: WorldItem): void {
    const s = this.setups.get(tripod.id);
    if (!s || this.tsDeadToast()) return;
    const mark = tripod.overMarkId ? this.world.marks.find((m) => m.id === tripod.overMarkId) : undefined;
    const kind = !mark ? null : mark.type === 'PBPP' || mark.type === 'PB' ? 'nail' : mark.type === 'HZ' && !mark.stabilization.startsWith('Kamenný') ? 'cap' : 'stone';
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.setupScreen.show(s, { markLabel: mark ? `bodu ${mark.number}` : null, markKind: kind, viewYaw: this.player.yaw });
  }

  private setupDone(): void {
    const tripod = this.items.find((i) => i.kind === 'tripod');
    const s = tripod ? this.setups.get(tripod.id) : undefined;
    if (!s || !tripod) return;
    const mark = tripod.overMarkId ? this.world.marks.find((m) => m.id === tripod.overMarkId) : undefined;
    this.sfx.success();
    // Nové ustavení = nová stanice, orientace se musí udělat znovu.
    const known = mark && mark.type !== 'NZ' ? mark.catalog : null;
    const cond = this.cond('ts');
    if (cond < BROKEN) {
      this.bus.emit('toast', { text: 'Stanice hlásí chybu 5001: kompenzátor mimo rozsah. Po pádu potřebuje servis.', tone: 'warn' });
      return;
    }
    if (known && mark) {
      // Na známém bodě: výška přístroje se odečte pásmem a zadá do stanice ručně.
      this.stationDialog.onConfirm = (vp) => this.createStation(tripod, known, vp, s.instrumentHeight, mark.number);
      this.stationDialog.show({ number: mark.number, ...known }, s.instrumentHeight);
      return;
    }
    this.createStation(tripod, null, s.instrumentHeight, s.instrumentHeight, null);
  }

  /** Stanice po ustavení. `vp` = zadaná výška přístroje, `trueVp` = skutečná (rozdíl se propíše do výšek). */
  private createStation(tripod: WorldItem, known: { Y: number; X: number; H: number } | null, vp: number, trueVp: number, markNo: string | null): void {
    const s = this.setups.get(tripod.id);
    if (!s) return;
    const cond = this.cond('ts');
    const ts = new TotalStation(s.instrumentCenter, known, vp, this.rng);
    ts.wear = noiseFactor(cond);
    ts.bias = (collimationArcsec(cond) * Math.PI) / (180 * 3600);
    this.stations.set(tripod.id, ts);
    if (Math.abs(vp - trueVp) > 0.005)
      setTimeout(() => this.bus.emit('toast', { text: `Pozor: zadaná výška přístroje ${vp.toFixed(3)} m. Zkontroluj ji na pásmu, jinak budou výšky bodů posunuté.`, tone: 'warn' }), 2500);
    this.links.set(tripod.id, new RoboticLink(this.player.yaw));
    this.resections.delete(tripod.id);
    tripod.stationYaw = this.player.yaw;
    this.bus.emit('toast', {
      text: `${markNo ? `Stanovisko ${markNo} nastaveno` : 'Přístroj urovnán na volném stanovisku'}, výška přístroje ${vp.toFixed(3).replace('.', ',')} m.`,
    });
    if (this.scope) this.scopeScreen.show();
  }

  // ================================================================ totální stanice

  private bindScope(): void {
    const sc = this.scopeScreen;
    sc.onLook = (dx, dy) => {
      if (!this.scope) return;
      // Obraz se posouvá s prstem: rad na pixel podle zorného pole.
      const k = (this.scopeFov() * DEG) / Math.max(1, this.root.clientHeight);
      this.scope.yaw -= dx * k;
      // Nivelák má záměru vodorovnou – dalekohled se nesklápí.
      if (this.scope.kind === 'ts') this.scope.pitch = clamp(this.scope.pitch - dy * k, -1.2, 1.2);
    };
    sc.onMeasure = () => (this.scope?.kind === 'level' ? this.levelMeasure() : this.scopeMeasure());
    sc.onAtr = () => this.scopeAtr();
    sc.onFaces = () => {
      this.twoFaces = !this.twoFaces;
      this.sfx.click();
      this.bus.emit('toast', {
        text: this.twoFaces
          ? 'Měření ve dvou polohách: stanice změří, proloží dalekohled, změří znovu a výsledek zprůměruje. Chyby přístroje (kolimace, index) se vyruší – trvá to ale déle.'
          : 'Měření jen v I. poloze: rychlejší, chyby přístroje zůstanou ve výsledku.',
      });
    };
    sc.onMode = () => {
      if (!this.scope) return;
      if (this.scope.kind === 'level') {
        this.scope.sight = this.levelSight() === 'back' ? 'fore' : 'back';
        this.sfx.click();
        return;
      }
      this.scope.mode = this.scope.mode === 'prism' ? 'reflectorless' : 'prism';
      this.scope.shot = null;
      this.sfx.click();
    };
    sc.onZoom = () => {
      if (!this.scope) return;
      this.scope.finder = !this.scope.finder;
      this.sfx.click();
    };
    sc.onCode = () => {
      this.codeIdx = (this.codeIdx + 1) % CODES.length;
      this.sfx.click();
    };
    sc.onSetup = () => {
      const item = this.scope ? this.items.find((i) => i.id === this.scope?.itemId) : undefined;
      const level = this.scope?.kind === 'level';
      if (level && !this.hands.freeHand()) {
        this.bus.emit('toast', { text: this.fullHandsReason(), tone: 'warn' });
        return;
      }
      sc.hide();
      if (item && level) this.pickUp(item);
      else if (item) this.openSetup(item);
    };
    sc.onClose = () => {
      this.scope = null;
      this.root.classList.remove('is-scope');
      this.itemsView.setHeldHidden(false);
      this.itemsView.setHidden(null);
      this.gfx.resize(); // vrátí běžné zorné pole
      this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    };
  }

  private scopeFov(): number {
    return this.scope?.finder ? 40 : 1.6; // svislé zorné pole [°]: hledáček / dalekohled 30×
  }

  /** Měření stanicí v jedné nebo obou polohách; u obou poloh ohlídá rozdíl 2c. */
  private tsShoot(ts: TotalStation, stationId: string, dir: Vec3, prisms: Prism[], mode: TsMode): ShotResult {
    if (!this.twoFaces) return ts.shoot(dir, this.world, prisms, mode, this.stationRanges());
    const r = ts.shootBoth(dir, this.world, prisms, mode, this.stationRanges());
    this.sfx.servo(1.6); // proložení dalekohledu a otočení o 200 gon
    this.clockMin += 0.5;
    const f = r.ok ? r.shot.faces : undefined;
    if (f) {
      const c2 = (f.dHz * 180 * 3600) / Math.PI;
      const i2 = (f.dZen * 180 * 3600) / Math.PI;
      const cc = (Math.abs(c2) * 10000) / 3240; // ″ → cc (setinné vteřiny)
      if (Math.abs(c2) > 20 && !this.facesWarned.has(stationId)) {
        this.facesWarned.add(stationId);
        this.bus.emit('toast', {
          text: `Rozdíl poloh 2c = ${Math.round(cc)} cc, 2i = ${Math.round((Math.abs(i2) * 10000) / 3240)} cc – přístroj má kolimační chybu (asi po pádu). Průměr obou poloh ji ruší; nech ho ale v servisu rektifikovat.`,
          tone: 'warn',
        });
      }
    }
    return r;
  }

  private openScope(tripod: WorldItem): void {
    if (!this.stations.has(tripod.id) || this.tsDeadToast()) return;
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.scope = { kind: 'ts', itemId: tripod.id, yaw: this.player.yaw, pitch: 0, finder: true, mode: 'prism', last: null, shot: null };
    this.itemsView.setHeldHidden(true);
    this.itemsView.setHidden(tripod.id);
    this.root.classList.add('is-scope');
    this.scopeScreen.show();
  }

  /** Hranoly = výtyčky postavené v této lokalitě. */
  private prisms(): Prism[] {
    return this.items
      .filter((i) => i.kind === 'prismPole' && i.state === 'deployed' && i.location === this.world.location)
      .map((i) => ({ id: i.id, center: { x: i.pos.x, y: i.pos.y + 2, z: i.pos.z }, foot: { ...i.pos }, height: 2, markId: i.overMarkId }));
  }

  private scopeMeasure(): void {
    const sc = this.scope;
    const ts = sc ? this.stations.get(sc.itemId) : undefined;
    if (!sc || !ts) return;
    const warn = (text: string): void => {
      sc.last = text;
      this.sfx.click();
      this.bus.emit('toast', { text, tone: 'warn' });
    };
    const dir = lookDirection(sc.yaw, sc.pitch);
    const r = this.tsShoot(ts, sc.itemId, dir, this.prisms(), sc.mode);
    if (!r.ok) return warn(r.reason);
    const shot = r.shot;
    const hd = shot.sd * Math.sin(shot.zen);
    sc.shot = { sd: shot.sd, hd, dh: ts.instrumentHeight + shot.sd * Math.cos(shot.zen) - (shot.prism?.height ?? 0) };
    const mark = shot.prism?.markId ? this.world.marks.find((m) => m.id === shot.prism?.markId) : undefined;

    if (!ts.station) {
      if (!mark || mark.type === 'NZ' || shot.mode !== 'prism') return warn('Volné stanovisko připoj měřením na hranol na známém bodě.');
      sc.last = this.addResection(ts, shot, mark);
      return;
    }
    if (ts.orientation === null) {
      if (!mark || mark.type === 'NZ') return warn('Orientaci měř na hranol postavený na známém bodě.');
      sc.last = this.orientStation(ts, shot, mark);
      return;
    }
    sc.last = this.recordStationPoint(shot, mark, shot.prism ? shot.prism.foot : shot.hit);
  }

  /**
   * Automatické cílení (ATR): stanice najde hranol blízko nitkového kříže (do ~6°)
   * a dotočí se na jeho střed. Jen v režimu hranol a s volnou záměrou.
   */
  private scopeAtr(): void {
    const sc = this.scope;
    const ts = sc ? this.stations.get(sc.itemId) : undefined;
    if (!sc || !ts || sc.kind !== 'ts') return;
    const warn = (text: string): void => {
      sc.last = text;
      this.sfx.click();
      this.bus.emit('toast', { text, tone: 'warn' });
    };
    if (sc.mode !== 'prism') return warn('ATR cílí jen na hranol. Přepni režim na hranol.');
    const view = lookDirection(sc.yaw, sc.pitch);
    const o = ts.center;
    let best: { d: Vec3; dist: number; ang: number } | null = null;
    for (const pr of this.prisms()) {
      const v = { x: pr.center.x - o.x, y: pr.center.y - o.y, z: pr.center.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      const d = { x: v.x / dist, y: v.y / dist, z: v.z / dist };
      const ang = Math.acos(clamp(d.x * view.x + d.y * view.y + d.z * view.z, -1, 1));
      if (ang < 6 * DEG && (!best || ang < best.ang)) best = { d, dist, ang };
    }
    if (!best) return warn('ATR: v zorném poli není hranol. Namiř dalekohled zhruba na hranol (v hledáčku) a zkus znovu.');
    const hit = this.world.raycast(o, best.d, best.dist - 0.1);
    if (hit) return warn(hit.kind === 'crown' ? 'ATR: hranol je za korunou stromu.' : 'ATR: mezi stanicí a hranolem je překážka.');
    sc.yaw = Math.atan2(-best.d.x, -best.d.z);
    sc.pitch = Math.asin(best.d.y);
    sc.finder = false;
    sc.last = `ATR: zacíleno na hranol, ${best.dist.toFixed(1).replace('.', ',')} m`;
    this.sfx.click();
  }

  /** Program stanice: kroky a rada, co teď udělat (na displeji a nad dalekohledem). */
  private stationProgram(ts: TotalStation, itemId: string): { steps: { label: string; state: 'done' | 'cur' | 'todo' }[]; hint: string } {
    const free = !ts.station;
    const oriented = ts.orientation !== null;
    const tripod = this.items.find((i) => i.id === itemId);
    const stMark = tripod?.overMarkId;
    const steps: { label: string; state: 'done' | 'cur' | 'todo' }[] = [
      { label: 'Stanovisko', state: free ? 'cur' : 'done' },
      { label: 'Orientace', state: free ? 'todo' : oriented ? 'done' : 'cur' },
      { label: 'Měření', state: oriented ? 'cur' : 'todo' },
    ];
    const o = ts.center;
    const known = this.world.marks
      .filter((m) => m.condition === 'ok' && m.type !== 'NZ' && m.id !== stMark)
      .map((m) => ({ m, d: Math.hypot(m.pos.x - o.x, m.pos.z - o.z) }))
      .filter((k) => k.d > 5 && k.d < 250)
      .sort((a, b) => a.d - b.d);
    const onMark = this.prisms().filter((p) => p.markId && p.markId !== stMark);
    let hint: string;
    if (free) {
      const n = this.resections.get(itemId)?.length ?? 0;
      hint =
        n < 2
          ? `Volné stanovisko: zamiř na hranol na známém bodě (ATR pomůže) a dej Připojit. Připojeno ${n} z aspoň 2.`
          : 'Máš dost bodů. V tabletu (Stanice) zkontroluj opravy a dej Přijmout stanovisko.';
    } else if (!oriented) {
      const pm = onMark.length ? this.world.marks.find((m) => m.id === onMark[0].markId) : undefined;
      hint = pm
        ? `Orientace: namiř zhruba na hranol na bodě ${pm.number}, dej Cílit (ATR) a pak Orientovat.`
        : `Orientace: postav výtyčku s hranolem na známý bod${known[0] ? ` (nejbližší ${known[0].m.number}, ${Math.round(known[0].d)} m)` : ''} – nebo ji dej Pepovi – a zamiř na ni.`;
    } else hint = `Měř body: hranol na bodě, nebo bez hranolu na roh či zeď. Kód bodu: ${CODES[this.codeIdx].label}.`;
    return { steps, hint };
  }

  /** Orientace stanice na známý bod; vrací text pro displej. */
  private orientStation(ts: TotalStation, shot: TsShot, mark: ControlMark): string {
    const o = ts.orient(shot, mark.catalog, mark.number);
    if (!o) return '';
    const ddmm = o.dDist * 1000;
    this.sfx.success();
    this.bus.emit('toast', {
      text: Math.abs(o.dDist) > 0.01 ? `Orientováno, ale délka nesedí o ${Math.abs(ddmm).toFixed(0)} mm. Zkontroluj cíl.` : `Stanice orientována na bod ${mark.number}`,
      tone: Math.abs(o.dDist) > 0.01 ? 'warn' : 'info',
    });
    return `Orientace na ${mark.number}: kontrola délky ${ddmm >= 0 ? '+' : '−'}${Math.abs(ddmm).toFixed(1).replace('.', ',')} mm`;
  }

  /** Bod změřený stanicí (dalekohledem i z výtyčky): zápisník + zakázky. Vrací text výsledku. */
  private recordStationPoint(shot: TsShot, mark: ControlMark | undefined, truePos: Vec3): string {
    const ts = this.connected()?.ts ?? (this.scope ? this.stations.get(this.scope.itemId) : undefined);
    const c = ts?.compute(shot);
    if (!c) return '';
    const code: FeatureCode = mark ? 'PEVNY_BOD' : CODES[this.codeIdx].code;
    const dev = mark ? { dY: c.Y - mark.catalog.Y, dX: c.X - mark.catalog.X, dH: c.H - mark.catalog.H } : undefined;
    const p = this.log.add({
      Y: c.Y,
      X: c.X,
      Z: c.H,
      code,
      sigmaXY: shot.mode === 'prism' ? 0.003 : 0.004,
      sigmaZ: shot.mode === 'prism' ? 0.003 : 0.005,
      method: 'polarni',
      timestamp: Date.now(),
      solution: 'Totálka',
      markId: mark?.id,
      markNumber: mark?.number,
      dev,
      location: this.world.location,
    });
    this.sfx.success();
    navigator.vibrate?.(20);
    const text = dev
      ? `${p.id} na ${mark?.number}: ΔY ${mm(dev.dY)}, ΔX ${mm(dev.dX)}, ΔH ${mm(dev.dH)} mm`
      : `${p.id} (${CODES[this.codeIdx].label}) uložen${shot.mode === 'reflectorless' && shot.hitKind === 'crown' ? ', laser ale skončil v koruně stromu!' : ''}`;
    this.lastMeasure = text;
    this.bus.emit('toast', { text: `Bod ${p.id} uložen (totální stanice)` });

    const run = this.activeRun();
    if (!run) return text;
    if (mark && run.recon?.markFound(mark.id)) setTimeout(() => this.bus.emit('toast', { text: `Bod ${mark.number} ověřen měřením` }), 1800);
    if (mark && run.stake) {
      const t = run.stake.targets.find((x) => x.existingMarkId === mark.id);
      if (t && run.stake.status(t.id) === 'pending') {
        run.stake.verify(t.id, mark.pos, Math.hypot(dev?.dY ?? 0, dev?.dX ?? 0));
        setTimeout(() => this.bus.emit('toast', { text: `Znak ${t.id} ověřen, sedí s projektem` }), 1800);
      }
    }
    if (run.mapping) {
      const f = run.mapping.onMeasured(p.id, code, truePos);
      if (f) setTimeout(() => this.bus.emit('toast', { text: `${f.label} zaměřen` }), 1800);
      else {
        const near = run.mapping.required.find((x) => Math.hypot(x.pos.x - truePos.x, x.pos.z - truePos.z) < 0.4);
        if (near && near.code !== code) setTimeout(() => this.bus.emit('toast', { text: `Kód nesedí: tohle je ${lowerFirst(near.label)}`, tone: 'warn' }), 1800);
      }
    }
    return text;
  }

  /** Měření na známý bod pro volné stanovisko. */
  private addResection(ts: TotalStation, shot: TsShot, mark: ControlMark): string {
    const id = [...this.stations].find(([, v]) => v === ts)?.[0];
    if (!id) return '';
    const list = this.resections.get(id) ?? [];
    const obs: ResectionObs = { markId: mark.id, number: mark.number, known: mark.catalog, hz: shot.hz, zen: shot.zen, sd: shot.sd, vc: shot.prism?.height ?? 0, use: true };
    const i = list.findIndex((o) => o.markId === mark.id);
    if (i >= 0) list[i] = obs;
    else list.push(obs);
    this.resections.set(id, list);
    this.sfx.success();
    const n = list.length;
    this.bus.emit('toast', {
      text: n >= 2 ? `Bod ${mark.number} připojen (${n} ${n <= 4 ? 'body' : 'bodů'}). Výpočet je v tabletu v záložce Stanice.` : `Bod ${mark.number} připojen. Změř ještě aspoň jeden známý bod.`,
    });
    return `Volné st.: ${mark.number} změřen, Hd ${(shot.sd * Math.sin(shot.zen)).toFixed(3).replace('.', ',')} m`;
  }

  /** Záložka Stanice v tabletu: stanovisko, orientace, výpočet volného stanoviska. */
  private stationPanel(): JobPanel {
    const c = this.connected();
    if (!c) return { title: 'Stanice', brief: 'V této lokalitě není ustavená totální stanice. Rozlož stativ, nasaď stanici a ustav ji.', rows: [], actions: [] };
    const { ts, tripod } = c;
    const mm1 = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v * 1000).toFixed(1).replace('.', ',')}`;
    const stMark = tripod.overMarkId ? this.world.marks.find((m) => m.id === tripod.overMarkId) : undefined;
    if (stMark) {
      return {
        title: `Stanovisko ${stMark.number}`,
        subtitle: `Známý bod, výška přístroje ${ts.instrumentHeight.toFixed(3).replace('.', ',')} m`,
        rows: [
          {
            key: 'o',
            title: 'Orientace',
            subtitle: ts.orientation === null ? 'Změř hranol na jiném známém bodě' : `na bod ${ts.orientedOn}`,
            status: ts.orientation === null ? 'Chybí' : 'Hotová',
            tone: ts.orientation === null ? 'pending' : 'ok',
          },
        ],
        footer: this.lastMeasure?.startsWith('Orientace') ? this.lastMeasure : undefined,
        actions: ts.orientation !== null ? [{ id: 'st-reorient', label: 'Nová orientace' }] : [],
      };
    }
    const obs = this.resections.get(tripod.id) ?? [];
    const res = solveResection(obs);
    const accepted = ts.station !== null;
    const rows: PanelRow[] = obs.map((o) => {
      const r = res?.residuals.find((x) => x.markId === o.markId);
      const big = !!r && Math.hypot(r.dY, r.dX) > 0.01;
      return {
        key: o.markId,
        title: o.number,
        subtitle: r
          ? `vYX ${(Math.hypot(r.dY, r.dX) * 1000).toFixed(1).replace('.', ',')} mm, vH ${mm1(r.dH)}`
          : `Hd ${(o.sd * Math.sin(o.zen)).toFixed(3).replace('.', ',')} m`,
        status: o.use ? 'Ve výpočtu' : 'Vyřazen',
        tone: !o.use ? 'info' : big ? 'bad' : r ? 'ok' : 'pending',
        button: accepted ? undefined : { id: `fs-toggle:${o.markId}`, label: o.use ? 'Vyřadit' : 'Zařadit' },
      };
    });
    const footer = res
      ? `Y ${res.station.Y.toFixed(3)}, X ${res.station.X.toFixed(3)}, H osy ${res.station.H.toFixed(3)} · σ0 ${(res.sigma0 * 1000).toFixed(1).replace('.', ',')} mm z ${res.used} bodů`
      : 'Změř výtyčkou (nebo dalekohledem na hranol) aspoň dva známé body. Opravy nad 10 mm prozradí chybný bod.';
    const actions: JobPanel['actions'] = accepted
      ? [{ id: 'fs-reset', label: 'Nové volné stanovisko' }]
      : res
        ? [{ id: 'fs-accept', label: 'Přijmout stanovisko', primary: true }]
        : [];
    const n = obs.length;
    const cnt = n === 1 ? '1 měřený bod' : n >= 2 && n <= 4 ? `${n} měřené body` : `${n} měřených bodů`;
    return { title: accepted ? 'Volné stanovisko (přijato)' : 'Volné stanovisko', subtitle: cnt, rows, footer, actions };
  }

  private stationAction(cmd: string, arg: string): void {
    const c = this.connected();
    if (!c) return;
    const list = this.resections.get(c.tripod.id) ?? [];
    if (cmd === 'fs-toggle') {
      const o = list.find((x) => x.markId === arg);
      if (o) o.use = !o.use;
    } else if (cmd === 'fs-accept') {
      const res = solveResection(list);
      if (!res) return;
      c.ts.acceptFreeStation(res.station, res.orientation);
      this.sfx.success();
      this.bus.emit('toast', { text: `Volné stanovisko přijato, σ0 ${(res.sigma0 * 1000).toFixed(1).replace('.', ',')} mm. Stanice je orientovaná, můžeš měřit.` });
    } else if (cmd === 'fs-reset') {
      c.ts.station = null;
      c.ts.orientation = null;
      this.resections.delete(c.tripod.id);
    } else if (cmd === 'st-reorient') {
      c.ts.orientation = null;
      c.ts.orientedOn = null;
    }
  }

  // ================================================================ robotická stanice

  private dropStation(id: string): void {
    this.stations.delete(id);
    this.links.delete(id);
    this.resections.delete(id);
    if (this.robotMeasure) this.robotMeasure = null;
  }

  /** Ustavená stanice v této lokalitě, se kterou může tablet na výtyčce mluvit. */
  private connected(): { tripod: WorldItem; ts: TotalStation; link: RoboticLink } | null {
    for (const [id, ts] of this.stations) {
      const tripod = this.items.find((i) => i.id === id);
      const link = this.links.get(id);
      if (tripod && link && tripod.state === 'deployed' && tripod.location === this.world.location && !this.tsDead) return { tripod, ts, link };
    }
    return null;
  }

  /** Kde je hranol: držená výtyčka má hranol 2 m nad hrotem, postavená nad svou patou. */
  private prismPosition(): Vec3 | null {
    const pole = this.items.find((i) => i.kind === 'prismPole');
    if (!pole) return null;
    if (pole.state === 'deployed' && pole.location === this.world.location) return { x: pole.pos.x, y: pole.pos.y + 2, z: pole.pos.z };
    if (pole.state !== 'held') return null;
    const tip =
      this.activeItem()?.kind === 'prismPole' && this.aim
        ? this.aim
        : { x: this.player.pos.x, y: this.world.heightmap.heightAt(this.player.pos.x, this.player.pos.z), z: this.player.pos.z };
    return { x: tip.x, y: tip.y + 2, z: tip.z };
  }

  private updateRobot(dt: number): void {
    const c = this.connected();
    this.robotLive = null;
    if (!c) return;
    const prism = this.prismPosition();
    const ev = c.link.update(dt, c.ts.center, prism, this.world);
    c.tripod.stationYaw = c.link.aimYaw;
    if (ev?.kind === 'locked') {
      this.sfx.success();
      this.bus.emit('toast', { text: 'Stanice našla hranol a drží ho' });
    } else if (ev?.kind === 'notFound') {
      this.sfx.lost();
      this.bus.emit('toast', { text: `Hranol nenalezen: ${ev.reason}`, tone: 'warn' });
    } else if (ev?.kind === 'lost') {
      this.sfx.lost();
      this.robotMeasure = null;
      this.bus.emit('toast', { text: `Ztráta zámku: v záměře je ${ev.reason}`, tone: 'warn' });
    }
    if (c.link.state === 'locked' && prism) {
      const r = c.ts.reading({ x: prism.x - c.ts.center.x, y: 0, z: prism.z - c.ts.center.z });
      this.robotLive = { hz: r.hz, hd: Math.hypot(prism.x - c.ts.center.x, prism.z - c.ts.center.z) };
    }

    // Probíhající měření: výtyčka musí stát, zámek držet.
    const rm = this.robotMeasure;
    if (!rm) return;
    if (Math.hypot(this.player.pos.x - rm.from.x, this.player.pos.z - rm.from.z) > 0.05) {
      this.robotMeasure = null;
      this.bus.emit('toast', { text: 'Pohnul ses, měření přerušeno.', tone: 'warn' });
      return;
    }
    rm.t -= dt;
    if (rm.t <= 0) {
      this.robotMeasure = null;
      this.finishRobot(c.ts, rm.kind, rm.aim);
    }
  }

  private startRobot(kind: RobotKind, aim: AimPoint): void {
    this.robotMeasure = { t: 1.1, kind, aim: { ...aim }, from: { x: this.player.pos.x, z: this.player.pos.z } };
    this.sfx.servo(0.3);
  }

  /** ATR domíří na střed hranolu a změří. Výtyčka držená v ruce není úplně svislá (σ 2,5 mm). */
  private finishRobot(ts: TotalStation, kind: RobotKind, aim: AimPoint): void {
    const off = this.pole.offset();
    const foot = { x: aim.x, y: aim.y, z: aim.z };
    const prism: Prism = { id: 'held', center: { x: aim.x + off.x, y: aim.y + 2, z: aim.z + off.z }, foot, height: 2, markId: aim.mark?.id };
    if (!this.pole.inCircle) this.bus.emit('toast', { text: 'Bublina byla mimo kroužek, měření je zatížené náklonem.', tone: 'warn' });
    const d = { x: prism.center.x - ts.center.x, y: prism.center.y - ts.center.y, z: prism.center.z - ts.center.z };
    const l = Math.hypot(d.x, d.y, d.z);
    const tri = [...this.stations].find(([, v]) => v === ts)?.[0] ?? '';
    const r = this.tsShoot(ts, tri, { x: d.x / l, y: d.y / l, z: d.z / l }, [prism], 'prism');
    if (!r.ok) {
      this.bus.emit('toast', { text: r.reason, tone: 'warn' });
      return;
    }
    if (kind === 'resect' && aim.mark) this.lastMeasure = this.addResection(ts, r.shot, aim.mark);
    else if (kind === 'orient' && aim.mark) this.lastMeasure = this.orientStation(ts, r.shot, aim.mark);
    else this.recordStationPoint(r.shot, aim.mark ?? undefined, foot);
  }

  /** Akce s výtyčkou v ruce, když je v lokalitě ustavená stanice. */
  private planPole(pole: WorldItem): ActionPlan {
    const c = this.connected();
    if (!c) return this.planUseItem(pole);
    const { ts, link } = c;
    const aim = this.aim;
    if (this.robotMeasure) return { verb: 'Měřím', target: '…', available: false, reason: 'Drž výtyčku v klidu, stanice měří' };
    if (link.state === 'search') return { verb: 'Hledám', target: 'hranol', available: false, reason: 'Stanice se otáčí a hledá hranol' };
    if (link.state !== 'locked') {
      return { verb: 'Hledat', target: 'hranol', available: true, run: () => (link.startSearch(), this.sfx.servo(2.4)) };
    }
    if (!aim) return { verb: 'Změřit', target: 'bod', available: false, reason: 'Před tebou je překážka' };
    const still = Math.hypot(this.player.vel.x, this.player.vel.z) <= 0.3;
    if (!ts.station) {
      // Volné stanovisko: měří se na známé body, výpočet a přijetí v tabletu (záložka Stanice).
      const m = aim.mark;
      if (!m || m.type === 'NZ') return { verb: 'Připojit', target: 'stanovisko', available: false, reason: 'Volné stanovisko: postav hrot na známý bod' };
      if (!still) return { verb: 'Připojit', target: `na bod ${m.number}`, available: false, reason: 'Stůj s výtyčkou v klidu' };
      return { verb: 'Připojit', target: `na bod ${m.number}`, available: true, run: () => this.startRobot('resect', aim) };
    }
    if (ts.orientation === null) {
      const stMark = c.tripod.overMarkId;
      const m = aim.mark;
      if (!m || m.type === 'NZ' || m.id === stMark) return { verb: 'Orientovat', target: 'stanici', available: false, reason: 'Postav hrot na jiný známý bod, třeba 4021' };
      if (!still) return { verb: 'Orientovat', target: `na bod ${m.number}`, available: false, reason: 'Stůj s výtyčkou v klidu' };
      return { verb: 'Orientovat', target: `na bod ${m.number}`, available: true, run: () => this.startRobot('orient', aim) };
    }
    const target = this.currentTarget();
    if (target && !target.existingMarkId && this.navReading) {
      const d = Math.hypot(target.world.x - this.navReading.x, target.world.z - this.navReading.z);
      if (d <= 0.1) return { verb: 'Zatlouct', target: `kolík na bod ${target.id}`, available: true, run: () => this.drive(target, aim, d) };
    }
    const what = aim.mark ? `bod ${aim.mark.number}` : aim.feature ? lowerFirst(aim.feature.label) : 'bod';
    if (!still) return { verb: 'Změřit', target: what, available: false, reason: 'Stůj s výtyčkou v klidu' };
    return { verb: 'Změřit', target: what, available: true, run: () => this.startRobot('measure', aim) };
  }

  private scopeViewModel(): import('./ui/ScopeScreen').ScopeView | null {
    const sc = this.scope;
    if (sc?.kind === 'level') return this.levelViewModel();
    const ts = sc ? this.stations.get(sc.itemId) : undefined;
    if (!sc || !ts) return null;
    const r = ts.reading(lookDirection(sc.yaw, sc.pitch));
    const g4 = (rad: number): string => `${radToGon(rad).toFixed(4).replace('.', ',')}`;
    const m3 = (v: number | undefined, sign = false): string =>
      v === undefined ? '—' : `${sign && v >= 0 ? '+' : ''}${v.toFixed(3).replace('.', ',').replace('-', '−')}`;
    const tripod = this.items.find((i) => i.id === sc.itemId);
    const stMark = tripod?.overMarkId ? this.world.marks.find((m) => m.id === tripod.overMarkId) : undefined;
    return {
      head: `▮${Math.round(this.bat.ts.main)} % · ` + (stMark ? `Stan. ${stMark.number}, v_p ${ts.instrumentHeight.toFixed(3).replace('.', ',')}` : `Volné st.${ts.station ? ', přijato' : `, bodů ${this.resections.get(sc.itemId)?.length ?? 0}`}`),
      rows: [
        ['Hz', g4(r.hz)],
        ['V', g4(r.zen)],
        ['Sd', m3(sc.shot?.sd)],
        ['Hd', m3(sc.shot?.hd)],
        ['ΔH', m3(sc.shot?.dh, true)],
      ],
      foot: `${sc.mode === 'prism' ? 'Hranol 2,000 m' : 'Bez hranolu'} · ${ts.orientation === null ? 'neorientováno' : `orient. ${ts.orientedOn}`}`,
      measureLabel: !ts.station ? 'Připojit' : ts.orientation === null ? 'Orientovat' : 'Měřit',
      canMeasure: true,
      modeLabel: sc.mode === 'prism' ? 'Režim: hranol' : 'Režim: bez hranolu',
      faces: this.twoFaces,
      codeLabel: CODES[this.codeIdx].label,
      setupLabel: 'Ustavení',
      finder: sc.finder,
      last: sc.last,
      ...this.stationProgram(ts, sc.itemId),
      atr: sc.mode === 'prism',
    };
  }

  // ================================================================ nivelace

  private levelInstrument(item: WorldItem): LevelInstrument {
    return { center: { x: item.pos.x, y: item.pos.y + 1.45, z: item.pos.z }, collimation: this.levelCollimation };
  }

  private openLevel(item: WorldItem): void {
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.scope = { kind: 'level', itemId: item.id, yaw: this.player.yaw, pitch: 0, finder: true, mode: 'prism', last: null, shot: null, read: null };
    this.itemsView.setHeldHidden(true);
    this.itemsView.setHidden(item.id);
    this.root.classList.add('is-scope');
    this.scopeScreen.show();
  }

  private deployedRod(): WorldItem | undefined {
    return this.items.find((i) => i.kind === 'rod' && i.state === 'deployed' && i.location === this.world.location);
  }

  /** Která záměra je na řadě: po zadní přední, jinak zadní (dá se přepnout). */
  private levelSight(): 'back' | 'fore' {
    if (this.scope?.sight) return this.scope.sight;
    const line = this.activeRun()?.level;
    const last = line?.sets[line.sets.length - 1];
    return last && last.setupNo === this.levelSetupNo && last.back && !last.fore ? 'fore' : 'back';
  }

  private levelMeasure(): void {
    const sc = this.scope;
    const lv = sc ? this.items.find((i) => i.id === sc.itemId) : undefined;
    if (!sc || !lv) return;
    const warn = (text: string): void => {
      sc.last = text;
      this.sfx.click();
      this.bus.emit('toast', { text, tone: 'warn' });
    };
    const rod = this.deployedRod();
    if (!rod) return warn('Lať nikde nestojí. Postav ji na bod.');
    if (sc.finder) return warn('Přepni na dalekohled a zaměř lať.');
    const inst = this.levelInstrument(lv);
    const yawTo = Math.atan2(-(rod.pos.x - inst.center.x), -(rod.pos.z - inst.center.z));
    const diff = Math.atan2(Math.sin(yawTo - sc.yaw), Math.cos(yawTo - sc.yaw));
    if (Math.abs(diff) > 0.7 * DEG) return warn('Lať není v zorném poli. Zaměř ji nitkovým křížem.');
    const res = this.levelRecord(lv, rod);
    sc.last = res.text;
    if (!res.ok) {
      this.sfx.click();
      this.bus.emit('toast', { text: res.text, tone: 'warn' });
    }
  }

  /** Čtení latě a zápis do nivelačního pořadu – dalekohledem hráče i pomocníkem u přístroje. */
  private levelRecord(lv: WorldItem, rod: WorldItem): { ok: boolean; text: string } {
    const inst = this.levelInstrument(lv);
    const sightLen = Math.hypot(rod.pos.x - inst.center.x, rod.pos.z - inst.center.z);
    if (this.cond('level') < BROKEN) return { ok: false, text: 'Kompenzátor se zasekl, obraz lati ujíždí. Nivelák po pádu potřebuje servis.' };
    const r = readRod(
      inst,
      rod.pos,
      this.world,
      this.rng,
      levelNoise(this.weather, this.clockMin, sightLen) * (this.hasUpgrade('nivelak') ? 1 / (1 + this.weather.wind) : 1) * noiseFactor(this.cond('level')),
    );
    if (!r.ok) return { ok: false, text: r.reason };
    this.lastLevelRead = { reading: r.reading, dist: r.dist };
    this.sfx.success();
    const f4 = (v: number): string => v.toFixed(4).replace('.', ',');
    const line = this.activeRun()?.level;
    if (!line) return { ok: true, text: `Čtení ${f4(r.reading)} m, vzdálenost ${r.dist.toFixed(1).replace('.', ',')} m` };
    const shot: LevelShot = { reading: r.reading, dist: r.dist, pointId: rod.pointId ?? '?', pointLabel: rod.pointLabel ?? '?' };
    const sight = this.levelSight();
    if (this.scope) this.scope.sight = undefined;
    if (sight === 'back') {
      if (!line.sets.some((s) => s.back) && shot.pointId !== line.startId) return { ok: false, text: `Pořad začni zadní záměrou na značce ${line.startLabel}.` };
      if (!line.addBack(this.levelSetupNo, shot)) return { ok: false, text: 'Sestava z tohoto postavení je hotová. Přestav nivelák na nové místo.' };
      return { ok: true, text: `Zadní na ${shot.pointLabel}: ${f4(r.reading)} m (${r.dist.toFixed(1).replace('.', ',')} m)` };
    }
    if (!line.addFore(this.levelSetupNo, shot)) return { ok: false, text: 'Nejdřív z tohoto postavení změř zadní záměru.' };
    const set = line.sets[line.sets.length - 1];
    const h = line.heights.points.get(shot.pointId)?.H;
    const dz = set.back?.dist ?? 0;
    if (Math.abs(dz - r.dist) > 5) {
      setTimeout(
        () => this.bus.emit('toast', { text: `Záměry nejsou vyrovnané (Z ${dz.toFixed(0)} m, P ${r.dist.toFixed(0)} m). Chyba horizontu se nevyruší.`, tone: 'warn' }),
        1600,
      );
    }
    const cl = line.closure;
    if (cl !== null) {
      const lim = closureLimit(line.heights.length);
      this.bus.emit('toast', {
        text: `Pořad uzavřen: uzávěr ${mmTxt(cl)} mm, mez ${(lim * 1000).toFixed(1).replace('.', ',')} mm`,
        tone: Math.abs(cl) <= lim ? 'info' : 'warn',
      });
    }
    return { ok: true, text: `Přední na ${shot.pointLabel}: ${f4(r.reading)} m, výška ${h?.toFixed(4).replace('.', ',')} m` };
  }

  private levelViewModel(): import('./ui/ScopeScreen').ScopeView | null {
    const sc = this.scope;
    if (!sc) return null;
    const line = this.activeRun()?.level;
    const set = line?.sets[line.sets.length - 1];
    const cur = set && set.setupNo === this.levelSetupNo ? set : undefined;
    const f4 = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(4).replace('.', ','));
    const sight = this.levelSight();
    const rod = this.deployedRod();
    return {
      head: `Nivelace, postavení ${this.levelSetupNo}`,
      rows: [
        ['Čtení', f4(this.lastLevelRead?.reading)],
        ['Délka', this.lastLevelRead ? this.lastLevelRead.dist.toFixed(2).replace('.', ',') : '—'],
        ['Z', f4(cur?.back?.reading)],
        ['P', f4(cur?.fore?.reading)],
        ['Δh', cur?.back && cur.fore ? f4(cur.back.reading - cur.fore.reading) : '—'],
      ],
      foot: `Lať: ${rod?.pointLabel ?? 'nestojí'} · na řadě ${sight === 'back' ? 'zadní' : 'přední'}`,
      measureLabel: sight === 'back' ? 'Měřit zadní' : 'Měřit přední',
      canMeasure: true,
      modeLabel: sight === 'back' ? 'Přepnout na přední' : 'Přepnout na zadní',
      codeLabel: null,
      setupLabel: 'Složit nivelák',
      finder: sc.finder,
      last: sc.last,
    };
  }

  // ================================================================ měření a zakázky

  private activeRun(): JobRun | undefined {
    const r = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
    return r && r.spec.location === this.world.location ? r : undefined;
  }

  private currentTarget(): StakeTarget | null {
    const run = this.activeRun();
    const st = run?.stake;
    if (!st || !run) return null;
    // S GNSS roverem zná kontroler jen body, které se do zakázky nahrály.
    if (this.activeItem()?.kind === 'gnssRover' && !this.ctrl.job?.imported.includes(`stake-${run.spec.id}`)) return null;
    const sel = this.selectedTarget ? st.targets.find((t) => t.id === this.selectedTarget && st.status(t.id) === 'pending') : undefined;
    return sel ?? st.nextPending(this.player.pos);
  }

  private measure(aim: AimPoint, r: { pos: Vec3; sigmaH: number; sigmaV: number }, helper = false): { Y: number; X: number; H: number } {
    const g = this.gnss;
    const c = this.reportedSjtsk(r.pos);
    if (!this.pole.inCircle && !this.hasUpgrade('imu') && !this.bipodTip)
      setTimeout(() => this.bus.emit('toast', { text: 'Bublina byla mimo kroužek, bod je zatížený náklonem výtyčky.', tone: 'warn' }), 900);
    const mark = aim.mark;
    const code: FeatureCode = mark ? 'PEVNY_BOD' : CODES[this.codeIdx].code;
    const dev = mark ? { dY: c.Y - mark.catalog.Y, dX: c.X - mark.catalog.X, dH: c.H - mark.catalog.H } : undefined;
    const p = this.log.add({
      Y: c.Y,
      X: c.X,
      Z: c.H,
      code,
      sigmaXY: r.sigmaH,
      sigmaZ: r.sigmaV,
      method: 'gnss_rtk',
      timestamp: Date.now(),
      solution: SOLUTION_LABEL[g.solution],
      note: r.sigmaH > this.ctrl.tolH || r.sigmaV > this.ctrl.tolV ? 'mimo toleranci přesnosti' : undefined,
      markId: mark?.id,
      markNumber: mark?.number,
      dev,
      location: this.world.location,
    });
    this.sfx.success();
    navigator.vibrate?.(20);
    this.lastMeasure = dev
      ? `${p.id} na ${mark?.number}: ΔY ${mm(dev.dY)}, ΔX ${mm(dev.dX)}, ΔH ${mm(dev.dH)} mm`
      : `${p.id} (${CODES[this.codeIdx].label}), σ ${(r.sigmaH * 100).toFixed(1).replace('.', ',')} cm`;
    this.bus.emit('toast', {
      text: `Bod ${p.id} uložen (${p.solution})${p.note ? ` – ${p.note}, σH ${(r.sigmaH * 100).toFixed(1).replace('.', ',')} cm` : ''}`,
      tone: g.solution === 'fix' && !p.note ? 'info' : 'warn',
    });
    this.ctrlLast = [
      `${p.id} · ${CODES[this.codeIdx].label} · ${p.solution}`,
      `Y ${c.Y.toFixed(3)}  X ${c.X.toFixed(3)}  H ${c.H.toFixed(3)}`,
      `σH ${(r.sigmaH * 1000).toFixed(0)} mm, σV ${(r.sigmaV * 1000).toFixed(0)} mm`,
    ];
    if (mark && dev) {
      const known = this.ctrl.job?.imported.includes(`bp-${this.world.location}`);
      this.ctrlLast.push(
        known
          ? `Kontrola na ${mark.number}: ΔY ${mm(dev.dY)}, ΔX ${mm(dev.dX)}, ΔH ${mm(dev.dH)} mm`
          : `Bod ${mark.number} není v zakázce – nahraj bodové pole, ať kontroler ukáže odchylky`,
      );
    }

    const run = this.activeRun();
    if (!run || helper) return c;
    if (mark && dev) run.check = { mark: mark.number, dPos: Math.hypot(dev.dY, dev.dX), dH: dev.dH };
    if (mark && run.recon?.markFound(mark.id)) {
      setTimeout(() => this.bus.emit('toast', { text: `Bod ${mark.number} ověřen měřením` }), 1800);
    }
    if (mark && run.stake) {
      const t = run.stake.targets.find((x) => x.existingMarkId === mark.id);
      if (t && run.stake.status(t.id) === 'pending') {
        run.stake.verify(t.id, mark.pos, Math.hypot(dev?.dY ?? 0, dev?.dX ?? 0));
        setTimeout(() => this.bus.emit('toast', { text: `Znak ${t.id} ověřen, sedí s projektem` }), 1800);
      }
    }
    if (run.mapping && run.spec.requireStation) {
      if (!mark) setTimeout(() => this.bus.emit('toast', { text: 'Tuhle zakázku měř totální stanicí.', tone: 'warn' }), 1800);
    } else if (run.mapping) {
      // Prvek se pozná podle odevzdaných souřadnic, ne podle toho, kde hráč stál.
      const f = run.mapping.onMeasured(p.id, code, this.world.frame.toWorld(c));
      if (f) setTimeout(() => this.bus.emit('toast', { text: `${f.label} zaměřena` }), 1800);
      else if (aim.feature && aim.feature.code !== code)
        setTimeout(() => this.bus.emit('toast', { text: `Kód nesedí: tohle je ${lowerFirst(aim.feature?.label ?? "")}`, tone: 'warn' }), 1800);
    }
    return c;
  }

  /** Zatlučení kolíku na vytyčovaný bod. Skutečná poloha = hrot; kontroler ukazoval odchylku d. */
  private drive(target: StakeTarget, aim: AimPoint, shown: number): void {
    const st = this.activeRun()?.stake;
    if (!st) return;
    const pos = { x: aim.x, y: aim.groundY + 0.01, z: aim.z };
    st.stake(target.id, pos, shown);
    this.stakes.push({ id: `${this.world.location}-${target.id}-${this.stakes.length}`, location: this.world.location, pos });
    this.selectedTarget = null;
    this.sfx.drop();
    navigator.vibrate?.([15, 60, 15]);
    const cm = (shown * 100).toFixed(1).replace('.', ',');
    this.bus.emit('toast', {
      text: shown > st.tolerance ? `Kolík ${target.id} zatlučen, ale kontroler ukazoval ${cm} cm.` : `Kolík ${target.id} zatlučen (${cm} cm)`,
      tone: shown > st.tolerance ? 'warn' : 'info',
    });
  }

  private inspect(mark: ControlMark): void {
    this.sfx.click();
    this.bus.emit('inspect', describeMark(mark, this.player.pos));
    const run = this.activeRun();
    if (run?.recon?.markFound(mark.id)) {
      this.bus.emit('toast', { text: `Bod ${mark.number} ověřen (${run.recon.resolvedCount}/${run.recon.entries.length})` });
    }
  }

  private distanceTo(mark: ControlMark): number {
    return Math.hypot(mark.pos.x - this.player.pos.x, mark.pos.z - this.player.pos.z);
  }

  // ================================================================ nastavení

  private applySettings(s: Settings, persist = true): void {
    this.settings = s;
    const mobile = this.gfx.quality.mobile;
    this.gfx.setShadows(s.shadows);
    this.gfx.setGraphics(s.gfx);
    this.gfx.setPixelCap(s.saver ? (mobile ? 1 : 1.25) : this.gfx.quality.pixelRatioMax);
    this.gfx.setDrawDistance(drawDistanceFor(s, mobile));
    this.daylightT = 0; // mlha se přepočítá s novým dohledem
    this.grass.setDensity([0, 0.5, 1][s.grass]);
    this.input.lookScale = s.lookSens;
    this.input.invertY = s.invertY;
    this.sfx.setVolume(s.volume);
    this.sfx.ambienceOn = s.ambience;
    this.hud.setFpsVisible(s.fps);
    if (persist) saveSettings(s);
  }

  // ================================================================ postup a cíl

  private applyUpgrades(): void {
    this.gnss.antennaBoost = this.hasUpgrade('antena');
  }

  /** Dosah dálkoměru podle počasí a vybavení. */
  private stationRanges(): { prism: number; reflectorless: number } {
    const r = stationRanges(this.weather);
    return this.hasUpgrade('dalkomer') ? { prism: Math.max(r.prism, 400), reflectorless: r.reflectorless * 2 } : r;
  }

  private jobsWord(n: number): string {
    return n === 1 ? 'zakázku' : n >= 2 && n <= 4 ? 'zakázky' : 'zakázek';
  }

  /** Číslo bodu z katalogu (4001 z PBPP-4001). */
  private markNo(id: string | undefined): string {
    const n = id && this.worldOf(this.activeRun()?.spec.location ?? this.world.location).marks.find((m) => m.id === id)?.number;
    return n || (id?.startsWith('PB-') ? `pomocný bod ${id.slice(3)}` : 'známý bod');
  }

  /** Pevné zakázky + generované objednávky kariéry. */
  private allJobs(): JobSpec[] {
    return [...JOBS, ...(this.career.orders ?? [])];
  }

  /**
   * Denní objednávky: dnešní dvě nové, včerejší nepřevzaté ještě platí, starší propadnou.
   * Převzaté a odevzdané zůstávají (kvůli výsledkům).
   */
  private refreshOrders(): void {
    const day = this.career.day;
    const keep = (this.career.orders ?? []).filter((o) => {
      const st = this.jobs.get(o.id)?.status ?? this.career.jobs[o.id]?.status ?? 'nova';
      return st !== 'nova' || (o.issued ?? day) >= day - 1;
    });
    for (const o of ordersForDay(day)) if (!keep.some((k) => k.id === o.id)) keep.push(o);
    // Odevzdaných generovaných necháme jen posledních pár, ať seznam neroste donekonečna.
    const done = keep.filter((o) => (this.jobs.get(o.id)?.status ?? this.career.jobs[o.id]?.status) === 'odevzdana');
    const drop = new Set(done.slice(0, Math.max(0, done.length - 4)).map((o) => o.id));
    this.career.orders = keep.filter((o) => !drop.has(o.id));
    const ids = new Set(this.career.orders.map((o) => o.id));
    for (const id of [...this.jobs.keys()]) if (id.startsWith('obj-') && !ids.has(id)) {
      this.jobs.delete(id);
      delete this.career.jobs[id];
    }
    for (const o of this.career.orders) if (!this.jobs.has(o.id)) this.jobs.set(o.id, { spec: o, status: 'nova' });
  }

  /** Dispečink svěří jen zakázky do obtížnosti podle profesního stupně. */
  private jobUnlocked(spec: JobSpec): boolean {
    return spec.difficulty <= rankOf(this.career).maxDifficulty;
  }

  /** Spěšná zakázka dnešního dne (příplatek, když se odevzdá bez vady ještě dnes). */
  private urgentToday(): string | null {
    if (this.career.urgentDone === this.career.day) return null; // příplatek jen jednou za den
    return urgentJob(
      this.career.day,
      this.allJobs().filter((j) => this.jobUnlocked(j)).map((j) => j.id),
    );
  }

  private hasUpgrade(id: string): boolean {
    return !!this.career.upgrades?.includes(id);
  }

  /** Kontroler průměruje poslední čtyři polohy – čísla neskáčou. Po přeskoku (>15 cm) začne znovu. */
  private smoothNav(p: { x: number; z: number }): { x: number; z: number } {
    const last = this.navHistory[this.navHistory.length - 1];
    if (last && Math.hypot(last.x - p.x, last.z - p.z) > 0.15) this.navHistory = [];
    this.navHistory.push(p);
    const win = this.bipodTip ? 14 : 4; // na dvojnožce průměruje déle (jako když přijímač nechá stát)
    while (this.navHistory.length > win) this.navHistory.shift();
    const n = this.navHistory.length;
    return { x: this.navHistory.reduce((s, q) => s + q.x, 0) / n, z: this.navHistory.reduce((s, q) => s + q.z, 0) / n };
  }

  /** Dvojnožka: opře výtyčku na současném místě hrotu a drží ji svisle. */
  private toggleBipod(): void {
    if (this.bipodTip) {
      this.bipodTip = null;
      this.sfx.click();
      return;
    }
    if (!this.aim) return;
    this.bipodTip = { x: this.aim.x, z: this.aim.z };
    this.sfx.drop();
    this.bus.emit('toast', { text: 'Výtyčka opřená o dvojnožku, stojí svisle. Rozhlížet se můžeš, pohybem ji složíš.' });
  }

  /** Postup zakázky krok za krokem (co udělat, co je hotové). */
  private jobSteps(run: JobRun): { text: string; done: boolean }[] {
    const spec = run.spec;
    const here = this.world.location;
    const where = LOCATIONS[spec.location].short;
    const kitOk = this.kitRows(spec).every((k) => k.ok);
    const onSite = spec.location === here;
    const steps: { text: string; done: boolean }[] = [
      { text: `Nalož vybavení: ${spec.kit.map((k) => ITEM_DEFS[k].short).join(', ')}`, done: kitOk },
      { text: `Dojeď na místo: ${where}`, done: onSite },
    ];
    switch (spec.type) {
      case 'rekognoskace': {
        const r = run.recon;
        const done = r?.resolvedCount ?? 0;
        const total = r?.entries.length ?? 0;
        steps.push({ text: 'Dojdi ke žlutě označenému bodu (šipka nahoře ukazuje směr)', done: done > 0 });
        steps.push({ text: `Bod prohlédni nebo změř roverem, chybějící nahlas v tabletu${total ? ` (${done} z ${total})` : ''}`, done: done === total && total > 0 });
        break;
      }
      case 'vytyceni': {
        const st = run.stake;
        const d = st?.doneCount ?? 0;
        const n = st?.targets.length ?? 0;
        const cnt = n > 0 ? ` (${d} z ${n})` : '';
        steps.push(...this.gnssSetupSteps(d > 0));
        steps.push({ text: 'V kontroleru nahraj body k vytyčení (Import) a vyber bod (Vytyčit)', done: !!this.ctrl.job?.imported.includes(`stake-${spec.id}`) || d > 0 });
        steps.push({ text: 'Jdi po šipce k bodu. U bodu se sám zpomalíš, dole uvidíš Vpřed / Vpravo v cm', done: d > 0 });
        steps.push({
          text: `${this.hasUpgrade('imu') ? 'Až bude navigace do 2 cm' : 'Opři výtyčku o Dvojnožku (tlačítko nad libelou)'}, pak Zatlouct kolík${cnt}`,
          done: d === n && n > 0,
        });
        break;
      }
      case 'polohopis': {
        const m = run.mapping;
        const f = m?.found.size ?? 0;
        const n = m?.required.length ?? spec.featureIds?.length ?? 0;
        const cnt = n > 0 ? ` (${f} z ${n})` : '';
        if (spec.requireStation) {
          const c = this.connected();
          if (spec.helperPoints?.length) {
            const need = spec.helperPoints.length;
            const have = this.worldOf(spec.location).marks.filter((m) => m.type === 'PB').length;
            steps.push(...this.gnssSetupSteps(have > 0));
            steps.push({ text: `Mimo les stabilizuj GNSS pomocné body ${spec.helperPoints.map((_, k) => 8001 + k).join(' a ')} (${Math.min(have, need)} z ${need})`, done: have >= need });
          }
          const at = this.markNo(spec.stationAt);
          const on = this.markNo(spec.orientOn);
          steps.push({ text: `Rozlož stativ nad bodem ${at}, nasaď stanici a ustav ji`, done: !!c });
          steps.push({ text: `Orientuj stanici: výtyčku s hranolem postav na ${on}`, done: !!c && c.ts.orientation !== null });
          steps.push({ text: `${spec.stationTask ?? 'Změř požadované prvky'}${cnt}`, done: f === n && n > 0 });
        } else {
          steps.push(...this.gnssSetupSteps(f > 0));
          steps.push({ text: 'Vyber správný kód (kontroler: Měřit body, nebo růžové tlačítko)', done: f > 0 });
          steps.push({ text: `Změř všechny prvky${cnt}`, done: f === n && n > 0 });
        }
        break;
      }
      case 'nivelace': {
        const line = run.level;
        const from = line?.startLabel ?? '';
        const to = (spec.levelTo ?? '').toUpperCase();
        const sets = line?.sets ?? [];
        steps.push({ text: `Postav lať na značku ${from} (nebo ji dej Pepovi)`, done: sets.length > 0 });
        steps.push({ text: 'Nivelák postav mezi body, přečti zadní záměru', done: sets.length > 0 });
        steps.push({ text: `Lať přenes k ${to} a přečti přední záměru`, done: !!line?.heights.points.has(spec.levelTo ?? '') });
        steps.push({ text: `Přestav nivelák a veď pořad zpátky na ${from}`, done: line?.closure !== null && line?.closure !== undefined });
        break;
      }
    }
    steps.push({ text: 'V kanceláři zpracuj data (dispečink → Zpracovat data) a odevzdej', done: run.status === 'odevzdana' });
    return steps;
  }

  /** Příprava GNSS: sestavení roveru, nastavení kontroleru a kontrola na známém bodě. */
  private gnssSetupSteps(started: boolean): { text: string; done: boolean }[] {
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    const run = this.activeRun();
    const built = !!rig?.receiver && !!rig.controller && rig.receiverOn && rig.controllerOn;
    const miss = this.ctrl.missing();
    return [
      { text: 'Polož kufr GNSS, vezmi výtyčku a sestav rover (výška, přijímač, kontroler, zapnout)', done: built || started },
      ...(['job', 'bluetooth', 'antenna', 'ntrip'] as const).map((k) => ({ text: SETUP_STEP_TEXT[k], done: (built && !miss.includes(k)) || started })),
      { text: 'Změř kontrolu na bodu bodového pole (ověření připojení)', done: !!run?.check },
    ];
  }

  /** Kam má hráč teď jít (pro šipku a světelný sloup). */
  private goalTarget(): { x: number; y: number; z: number } | null {
    if (this.driving || !this.started) return null;
    const here = this.world.location;
    const v = this.world.vehicle;
    const run = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
    const board = this.world.scenery.find((s) => s.kind === 'board');
    if (!run) return board ? { x: board.x, y: board.groundY, z: board.z + 0.8 } : null;
    const spec = run.spec;
    if (this.jobComplete(run)) return here === 'kancelar' ? (board ? { x: board.x, y: board.groundY, z: board.z + 0.8 } : null) : vanLocal(v, -1.3, 0, 1.7);
    if (spec.location !== here) {
      if (here === 'kancelar') {
        const miss = spec.kit.map((k) => this.items.find((i) => i.kind === k)).find((i) => i && i.state === 'ground' && i.location === here);
        if (miss) return { ...miss.pos };
        const held = spec.kit.map((k) => this.items.find((i) => i.kind === k)).find((i) => i?.state === 'held');
        if (held) return vanLocal(v, 3.1, 0, 0);
      }
      return vanLocal(v, -1.3, 0, 1.7);
    }
    const stored = spec.kit.map((k) => this.items.find((i) => i.kind === k)).find((i) => i?.state === 'stored');
    if (stored) return vanLocal(v, 3.1, 0, 0);
    const p = this.player.pos;
    const nearest = <T extends { x: number; z: number }>(list: T[]): T | null =>
      list.reduce<T | null>((b, q) => (!b || Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? q : b), null);
    switch (spec.type) {
      case 'rekognoskace': {
        const pend = (run.recon?.entries ?? []).filter((e) => e.status === 'pending').map((e) => this.world.marks.find((m) => m.id === e.markId)?.pos).filter((q): q is Vec3 => !!q);
        return nearest(pend);
      }
      case 'vytyceni': {
        const t = this.currentTarget();
        return t ? { x: t.world.x, y: this.world.heightmap.heightAt(t.world.x, t.world.z), z: t.world.z } : null;
      }
      case 'polohopis': {
        if (spec.requireStation) {
          const c = this.connected();
          const hn = this.nextHelper();
          if (hn && spec.helperPoints) {
            // Nejdřív kontrola GNSS na bodu bodového pole, pak doporučené místo pomocného bodu.
            if (this.gnssGoal(run)) return nearest(this.world.marks.filter((m) => m.type === 'PBPP' && m.condition === 'ok').map((m) => m.pos));
            const q = spec.helperPoints[Number(hn) - 8001];
            return { x: q.x, y: this.world.heightmap.heightAt(q.x, q.z), z: q.z };
          }
          if (!c) return this.world.marks.find((m) => m.id === spec.stationAt)?.pos ?? null;
          if (c.ts.station && c.ts.orientation === null) return this.world.marks.find((m) => m.id === spec.orientOn)?.pos ?? null;
        }
        return nearest((run.mapping?.required ?? []).filter((f) => !run.mapping?.found.has(f.id)).map((f) => f.pos));
      }
      case 'nivelace': {
        const line = run.level;
        const start = this.world.marks.find((m) => m.id === line?.startId)?.pos;
        const to = this.world.features.find((f) => f.id === spec.levelTo)?.pos;
        if (!line || !line.sets.length) return start ?? null;
        if (!line.heights.points.has(spec.levelTo ?? '')) return to ?? null;
        return line.closure === null ? (start ?? null) : null;
      }
    }
    return null;
  }

  // ================================================================ průvodce „Co dál?“

  /** Další krok podle situace – od nástěnky přes sklad a dodávku až po konkrétní měření. */
  private goalText(): string | null {
    const here = this.world.location;
    const run = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
    const late = this.clockMin > 17 * 60;
    if (!run) {
      if (here === 'kancelar') return late ? 'Den končí: ukonči směnu na nástěnce u vchodu.' : 'Vyber si zakázku na nástěnce u vchodu kanceláře.';
      return 'Vyber další zakázku v tabletu (Mapa → Zakázka), nebo jeď zpátky do kanceláře.';
    }
    const spec = run.spec;
    const where = LOCATIONS[spec.location].short;
    if (this.jobComplete(run)) {
      if (here === 'kancelar') return this.driving ? 'Zastav a vystup, jsi u kanceláře.' : 'Otevři dispečink u vchodu a dej Zpracovat data a odevzdat.';
      return this.driving ? 'Odjeď do kanceláře (tablet → Odjet: Kancelář).' : 'Hotovo v terénu! Sbal vybavení do dodávky a jeď do kanceláře zpracovat data.';
    }
    if (spec.location !== here) {
      const missing = this.kitRows(spec).filter((k) => !k.ok);
      if (missing.length && here === 'kancelar') {
        const m = missing[0];
        const kind = spec.kit.find((k) => ITEM_DEFS[k].name === m.name);
        const held = this.items.find((i) => i.kind === kind && i.state === 'held');
        return held ? `Nalož ${ITEM_DEFS[held.kind].nameAcc} do dodávky zadními dveřmi.` : `Ve skladu vedle kanceláře vezmi ${kind ? ITEM_DEFS[kind].nameAcc : m.name}.`;
      }
      if (this.driving) return `Odjeď v tabletu: Mapa → Odjet: ${where}.`;
      return `Nastup do dodávky a odjeď na místo: ${where}.`;
    }
    if (this.driving) return 'Zastav a vystup, jsi na místě.';
    if (this.jobComplete(run)) return 'Hotovo v terénu! Sbal vybavení a jeď do kanceláře zpracovat data.';
    const stored = spec.kit.map((k) => this.items.find((i) => i.kind === k)).find((i) => i?.state === 'stored');
    if (stored) return `Vyndej z dodávky ${ITEM_DEFS[stored.kind].nameAcc} (zadní dveře).`;
    const active = this.activeItem()?.kind;
    switch (spec.type) {
      case 'rekognoskace':
        return 'Obejdi body z katalogu (tablet: Zakázka). Prohlédni je, nebo je změř roverem. Chybějící nahlas na místě.';
      case 'polohopis': {
        if (spec.requireStation) {
          const c = this.connected();
          const hn = this.nextHelper();
          if (hn && !c) {
            const g = this.gnssGoal(run);
            if (g) return g;
            return `Pomocný bod ${hn}: na cestě před lesem (šipka ukazuje doporučené místo, kde je FIX a je odtud vidět do lesa) zamiř roverem na volné místo a dej Stabilizovat.`;
          }
          if (!c) {
            const t = this.items.find((i) => i.kind === 'tripod');
            if (t?.state === 'deployed' && !t.secured) return 'Sešlápni nohy stativu (s prázdnýma rukama zamiř na stativ), pak nasaď stanici z kufru.';
            return `Rozlož stativ nad ${this.markNo(spec.stationAt)}, sešlápni nohy, nasaď stanici z kufru a ustav ji.`;
          }
          if (!c.ts.station) return 'Volné stanovisko: připoj ho výtyčkou na dva známé body, pak ho přijmi v tabletu (Stanice).';
          if (c.ts.orientation === null) return `Orientuj stanici: výtyčku s hranolem postav na ${this.markNo(spec.orientOn)}, namiř, Cílit (ATR) a Orientovat.`;
          return spec.stationTask ? `${spec.stationTask}.` : 'Měř prvky: výtyčku s hranolem na prvek, nebo bez hranolu dalekohledem.';
        }
        {
          const g = this.gnssGoal(run);
          if (g) return g;
        }
        return `Vyber kód (růžové tlačítko) a změř prvky. Máš ${run.mapping?.found.size ?? 0} z ${run.mapping?.required.length ?? 0}.`;
      }
      case 'vytyceni': {
        if (active !== 'prismPole') {
          const g = this.gnssGoal(run);
          if (g) return g;
          if (!this.ctrl.job?.imported.includes(`stake-${spec.id}`)) return 'V kontroleru nahraj body k vytyčení: Import → soubor zakázky.';
        }
        const t = this.currentTarget();
        return t
          ? `Jdi po šipce k bodu ${t.id}${t.existingMarkId ? ' a změř dochovaný znak' : '. U něj se zpomalíš, opři výtyčku o dvojnožku a zatluč kolík'}.`
          : 'Všechny body máš. Jeď do kanceláře zpracovat data.';
      }
      case 'nivelace': {
        const line = run.level;
        const last = line?.sets[line.sets.length - 1];
        const from = line?.startLabel ?? spec.levelFrom ?? '';
        const to = (spec.levelTo ?? '').toUpperCase();
        if (!line || !line.sets.length) return `Postav lať na značku ${from} (nebo ji dej Pepovi) a nivelák mezi značku a ${to}.`;
        if (last && !last.fore) return `Přenes lať na další bod a změř přední záměru (cíl ${to}).`;
        if (!line.heights.points.has(spec.levelTo ?? '')) return `Pokračuj pořadem až na ${to}. Když lať nestačí, udělej přestavový bod.`;
        return `Přestav nivelák a veď pořad zpátky na ${from}.`;
      }
    }
    return null;
  }

  /** Další krok přípravy GNSS pro průvodce, nebo null, když je všechno hotové. */
  private gnssGoal(run: JobRun): string | null {
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    const rig = rover?.rig;
    const kase = this.items.find((i) => i.kind === 'gnssCase');
    if (!rig?.receiver || !rig.controller) {
      if (kase?.state === 'held') return 'Polož kufr GNSS na zem (G), vezmi výtyčku a zamiř na kufr: Sestavit rover.';
      if (rover?.state !== 'held') return 'Vezmi výtyčku pro GNSS a zamiř s ní na položený kufr GNSS: Sestavit rover.';
      return 'Zamiř výtyčkou na položený kufr GNSS a sestav rover.';
    }
    if (!rig.receiverOn || !rig.controllerOn) return 'Zapni přijímač i kontroler (u kufru: Sestavit, tlačítka ⏻ podržet).';
    if (rover?.state !== 'held') return 'Vezmi rover do ruky.';
    const miss = this.ctrl.missing();
    if (miss.length) return `${SETUP_STEP_TEXT[miss[0]]} (tlačítko Kontroler, klávesa K).`;
    if (!run.check) return 'Nejdřív změř kontrolu na bodu bodového pole (hrot na znak, Změřit) a porovnej odchylky.';
    return null;
  }

  /** Zápisník bodů jako CSV do schránky. */
  private copyPoints(): void {
    this.copyText(pointsCsv(this.log.points), `Zápisník zkopírován (${pointsCount(this.log.points.length)}, CSV se středníky).`);
  }

  /** Zápisník jako soubor do telefonu (CSV, seznam souřadnic TXT nebo výkres DXF). */
  private downloadPoints(format: ExportFormat): void {
    if (!this.log.points.length) {
      this.bus.emit('toast', { text: 'Zápisník je prázdný, zatím není co uložit.', tone: 'warn' });
      return;
    }
    const f = EXPORT_FORMATS.find((x) => x.id === format) ?? EXPORT_FORMATS[0];
    this.downloadText(`zapisnik-den${this.career.day}.${f.id}`, exportPoints(this.log.points, f.id), f.mime);
    this.bus.emit('toast', { text: `Zápisník uložen jako ${f.label} (${pointsCount(this.log.points.length)}).` });
  }

  /** Soubor ke stažení. CSV a TXT dostanou BOM, ať je Excel otevře v UTF-8; DXF ne, CAD by ho nepřečetl. */
  private downloadText(name: string, text: string, mime: string): void {
    try {
      const url = URL.createObjectURL(new Blob([mime === 'application/dxf' ? text : '\ufeff' + text], { type: `${mime};charset=utf-8` }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      this.bus.emit('toast', { text: 'Uložení souboru tady prohlížeč nepovolil.', tone: 'warn' });
    }
  }

  private copyText(text: string, okMsg: string): void {
    const done = (): void => this.bus.emit('toast', { text: okMsg });
    const fallback = (): void => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      if (ok) done();
      else this.bus.emit('toast', { text: 'Kopírování tady prohlížeč nepovolil.', tone: 'warn' });
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }


  // ================================================================ GNSS rover a kontroler

  /** Proč rover v ruce teď neměří (null = měří). */
  private roverBlocked(): string | null {
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    if (!rig?.receiver) return 'Výtyčka je holá: polož kufr GNSS na zem a u něj sestav rover';
    if (!rig.controller) return 'Chybí kontroler: nasaď ho v kufru do držáku';
    if (!rig.receiverOn) return this.bat.gnss.main <= 0 ? 'Vybitá baterie přijímače – u kufru GNSS ji vyměň' : 'Přijímač je vypnutý';
    if (!rig.controllerOn) return this.bat.ctrl.main <= 0 ? 'Vybitá baterie kontroleru – u kufru GNSS ji vyměň' : 'Kontroler je vypnutý';
    const miss = this.ctrl.missing();
    if (miss.length) return SETUP_STEP_TEXT[miss[0]];
    return null;
  }

  /** Souřadnice, které kontroler zobrazí a uloží (se zvoleným systémem a zadanou výškou antény). */
  private reportedSjtsk(p: Vec3): { Y: number; X: number; H: number } {
    const c = this.world.frame.toSjtsk(p);
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    const crs: CrsId = this.ctrl.job?.crs ?? 'sjtsk';
    return reportCoords(c, crs, this.ctrl.heightError(rig?.height ?? 2));
  }

  /** Kam by bod padl v terénu, kdyby zobrazené souřadnice byly S-JTSK. */
  private reportedWorld(p: Vec3): Vec3 {
    return this.world.frame.toWorld(this.reportedSjtsk(p));
  }

  private openRig(kase: WorldItem, pole: WorldItem, mode: 'assemble' | 'pack'): void {
    if (!pole.rig) return;
    if (this.input.pointerLocked) document.exitPointerLock();
    this.rigCase = kase;
    this.sfx.click();
    this.itemsView.setHeldHidden(true);
    this.root.classList.add('is-bench');
    this.bench.openGnss(pole.rig, mode === 'pack' ? 'gnss-pack' : 'gnss-assemble', {
      onRig: (ev) => this.rigChanged(ev === 'click' ? 'screw' : ev),
      onTsMounted: () => {},
      powerBlock: (what) => {
        const id = what === 'rx' ? 'gnss' : 'ctrl';
        return this.bat[id].main > 0 ? null : `Baterie ${PACK_NAME[id]} je vybitá. Zavři montáž a u kufru dej Vyměnit baterii.`;
      },
      onClose: () => this.closeBench(),
    });
  }

  /** Nasazení / sundání totální stanice rukama: posadit na hlavu stativu a přitáhnout šroubem. */
  private openTsBench(tripod: WorldItem, kase: WorldItem, mount: boolean): void {
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.itemsView.setHeldHidden(true);
    this.itemsView.setHidden(tripod.id);
    this.root.classList.add('is-bench');
    this.bench.openTs(mount ? 'ts-mount' : 'ts-unmount', {
      onRig: (ev) => (ev === 'screw' ? this.sfx.click() : this.sfx.drop()),
      onTsMounted: (m) => (m ? this.mount(tripod, kase) : this.unmount(tripod, kase)),
      onClose: () => this.closeBench(),
    });
  }

  /** Rozložení stativu rukama: svěrky, délka nohou, rozkročení, sešlápnutí. Pak stojí nad bodem. */
  private openTripodBench(item: WorldItem, aim: AimPoint): void {
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.itemsView.setHeldHidden(true);
    this.root.classList.add('is-bench');
    const spot = { ...aim };
    this.player.pitch = -0.62; // podívat se dolů ke stativu a nohám
    this.bench.openTripod({
      onRig: (ev) => (ev === 'screw' ? this.sfx.drop() : this.sfx.click()),
      onTsMounted: () => {},
      onClose: () => this.closeBench(),
      onTripod: (head, len, secured) => {
        this.deploy(item, spot);
        const s = this.setups.get(item.id);
        if (s) s.headHeight = head;
        item.legLen = len;
        item.secured = secured;
      },
    });
  }

  private closeBench(): void {
    this.rigCase = null;
    this.itemsView.setHeldHidden(false);
    this.itemsView.setHidden(null);
    this.root.classList.remove('is-bench');
    this.refreshHands();
    this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
  }

  private rigChanged(ev: 'height' | 'screw' | 'receiver' | 'controller' | 'power'): void {
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    if (!rig) return;
    if (this.rigCase) this.rigCase.empty = rig.receiver || rig.controller;
    if (!rig.receiverOn) {
      // Vypnutý přijímač = ztracené spojení Bluetooth i korekce.
      this.ctrl.bt = null;
      this.ctrl.ntripOn = false;
    }
    if (!rig.controllerOn) this.ctrlScreen.hide();
    if (ev === 'screw' || ev === 'height') this.sfx.click();
    else if (ev === 'power') {
      this.sfx.success();
      this.bus.emit('toast', {
        text: `Přijímač ${rig.receiverOn ? 'zapnutý: LED bliká, hledá družice' : 'vypnutý'}, kontroler ${rig.controllerOn ? 'nabíhá do polního softwaru' : 'vypnutý'}.`,
      });
    } else this.sfx.drop();
    this.refreshHands();
  }

  /**
   * Když hra dlouho běží pod ~22 FPS, sníží náročnost o jeden krok (AO → stíny → tráva)
   * a řekne to hráči. Nastavení se uloží, v Nastavení jde vrátit.
   */
  private autoQuality(dt: number): void {
    if (!this.started || this.traveling || this.modalOpen) return;
    this.lowFpsT = this.gfx.fps < 22 ? this.lowFpsT + dt : Math.max(0, this.lowFpsT - dt * 2);
    this.qualityCooldown -= dt;
    if (this.lowFpsT < 10 || this.qualityCooldown > 0) return;
    this.lowFpsT = 0;
    this.qualityCooldown = 25;
    const s = { ...this.settings };
    let what = '';
    if (s.gfx === 2) {
      s.gfx = 1;
      what = 'vypnul zastínění (AO)';
    } else if (s.shadows) {
      s.shadows = false;
      what = 'vypnul stíny';
    } else if (s.grass > 0) {
      s.grass = 0;
      what = 'vypnul trávu';
    } else if (!s.saver) {
      s.saver = true;
      what = 'zapnul úsporné rozlišení';
    } else return;
    this.applySettings(s);
    this.bus.emit('toast', { text: `Hra se sekala, tak jsem ${what}. Vrátíš to v Nastavení (⚙).` });
  }

  // ================================================================ zpracování v kanceláři

  private static readonly OUTPUTS: { id: string; label: string }[] = [
    { id: 'rek', label: 'Záznam o rekognoskaci bodového pole' },
    { id: 'vyt', label: 'Protokol o vytyčení (odchylky od projektu)' },
    { id: 'dxf', label: 'Výkres DXF a seznam souřadnic zaměřených prvků' },
    { id: 'niv', label: 'Nivelační zápisník a výpočet výšky' },
    { id: 'gp', label: 'Geometrický plán' },
  ];

  private correctOutput(run: JobRun): string {
    return { rekognoskace: 'rek', vytyceni: 'vyt', polohopis: 'dxf', nivelace: 'niv' }[run.spec.type];
  }

  /** Body zakázky ze zápisníku (od převzetí, v její lokalitě). */
  private jobPoints(run: JobRun): MeasuredPoint[] {
    return this.log.points.slice(run.firstPoint ?? 0).filter((p) => p.location === run.spec.location);
  }

  private openProcessing(id: string): void {
    const run = this.jobs.get(id);
    if (!run || this.world.location !== 'kancelar') return;
    this.procJob = id;
    const rows: ProcRow[] = this.jobPoints(run).map((p) => {
      const devBad = p.dev && (Math.hypot(p.dev.dY, p.dev.dX) > CHECK_TOL.xy * 2 || Math.abs(p.dev.dH) > CHECK_TOL.h * 2);
      const weak = p.method === 'gnss_rtk' && p.solution !== SOLUTION_LABEL.fix;
      const flag: ProcRow['flag'] = p.dev ? (devBad ? 'checkBad' : 'check') : weak ? 'float' : p.note ? 'tol' : 'ok';
      return {
        id: p.id,
        code: CODES.find((c) => c.code === p.code)?.label ?? (p.code === 'PEVNY_BOD' ? 'Pevný bod' : p.code),
        coords: `${p.Y.toFixed(3)} / ${p.X.toFixed(3)} / ${p.Z.toFixed(3)}`,
        sol: p.solution,
        sigma: `${(p.sigmaXY * 1000).toFixed(0)} mm`,
        flag,
        note: p.dev ? `${p.markNumber}: ΔY ${mm(p.dev.dY)} ΔX ${mm(p.dev.dX)} ΔH ${mm(p.dev.dH)} mm` : undefined,
      };
    });
    const summary =
      run.stake
        ? `Vytyčeno ${run.stake.doneCount} z ${run.stake.targets.length} bodů, ověřené znaky se počítají.`
        : run.mapping
          ? `Zaměřeno ${run.mapping.found.size} z ${run.mapping.required.length} požadovaných prvků.`
          : run.level
            ? `Nivelační pořad: ${run.level.sets.length} sestav, uzávěr ${run.level.closure !== null ? `${mmTxt(run.level.closure)} mm` : '—'}.`
            : `Rekognoskace: vyřízeno ${run.recon?.resolvedCount ?? 0} bodů.`;
    this.officeScreen.hide();
    this.sfx.click();
    this.proc.show({ job: run.spec.title, client: run.spec.client, rows, outputs: Game.OUTPUTS, summary });
  }

  /** Odeslání zpracované zakázky: podezřelá měření ve výsledku, vyřazené prvky a špatný výstup se reklamují. */
  private processSend(excluded: Set<string>, output: string | null): void {
    const run = this.procJob ? this.jobs.get(this.procJob) : undefined;
    this.procJob = null;
    if (!run) return;
    const pts = this.jobPoints(run).filter((p) => !excluded.has(p.id));
    const badIncluded = pts.filter((p) => (p.method === 'gnss_rtk' && p.solution !== SOLUTION_LABEL.fix && !p.dev) || (p.note && !p.dev)).length;
    const missing: string[] = [];
    if (run.mapping) for (const [fid, pid] of run.mapping.found) if (excluded.has(pid)) missing.push(run.mapping.required.find((f) => f.id === fid)?.label ?? fid);
    const wrongOutput = output !== this.correctOutput(run);
    this.clockMin += 40;
    this.activeJobId = run.spec.id;
    this.submitJob({ badIncluded, missing, wrongOutput, outputLabel: Game.OUTPUTS.find((o) => o.id === output)?.label ?? '' });
  }

  // ================================================================ stav vybavení

  // ================================================================ baterie

  private get bat(): Batteries {
    return (this.career.batteries ??= freshBatteries());
  }

  /** Stanice je nasazená na stativu (a tedy zapnutá), dokud nedojde baterie. */
  private get tsOn(): boolean {
    return this.bat.ts.main > 0 && this.items.some((i) => i.kind === 'tripod' && i.state === 'deployed' && i.mounted);
  }

  private get tsDead(): boolean {
    return this.bat.ts.main <= 0;
  }

  private tsDeadToast(): boolean {
    if (!this.tsDead) return false;
    this.sfx.click();
    this.bus.emit('toast', {
      text: canSwap(this.bat.ts)
        ? 'Stanice je vypnutá – vybitá baterie. Náhradní je v kufru stanice: přines kufr ke stativu a dej Vyměnit baterii.'
        : 'Stanice je vypnutá a i náhradní baterie je vybitá. Nabij ji v dodávce (kufr naložený v autě) nebo přes noc v kanceláři.',
      tone: 'warn',
    });
    return true;
  }

  /** Vybíjení zapnutých přístrojů a nabíjení náhradních baterií v autonabíječce dodávky. */
  private batteryTick(min: number): void {
    const b = this.bat;
    const t = this.weather.temp;
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    const rig = rover?.rig;
    if (rig?.receiver && rig.receiverOn && rover?.state !== 'stored') this.batteryEvent('gnss', drain(b.gnss, 'gnss', min, t));
    if (rig?.controller && rig.controllerOn && rover?.state !== 'stored') this.batteryEvent('ctrl', drain(b.ctrl, 'ctrl', min, t));
    if (this.tsOn) this.batteryEvent('ts', drain(b.ts, 'ts', min, t));
    const stored = (kind: ItemKind): boolean => this.items.some((i) => i.kind === kind && i.state === 'stored');
    if (stored('gnssCase')) {
      chargeSpare(b.gnss, min);
      chargeSpare(b.ctrl, min);
    }
    if (stored('tsCase')) chargeSpare(b.ts, min);
  }

  private batteryEvent(id: PackId, ev: DrainEvent): void {
    if (!ev) return;
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    if (ev === 'low') {
      this.sfx.click();
      navigator.vibrate?.([60, 60, 60]);
      this.bus.emit('toast', { text: `Slabá baterie ${PACK_NAME[id]} (${LOW} %). Náhradní je v kufru – vyměň ji, než přístroj zhasne.`, tone: 'warn' });
      return;
    }
    if (id === 'gnss' && rig) {
      rig.receiverOn = false;
      this.rigChanged('screw');
    }
    if (id === 'ctrl' && rig) {
      rig.controllerOn = false;
      this.ctrlScreen.hide();
    }
    if (id === 'ts') {
      if (this.scope?.kind === 'ts') this.scopeScreen.hide();
      this.links.forEach((l) => (l.state = 'off'));
    }
    this.sfx.lost();
    this.bus.emit('toast', {
      text:
        id === 'ts'
          ? 'Stanice zhasla – vybitá baterie. Ustavení i orientace zůstaly v paměti; vyměň baterii (náhradní v kufru stanice).'
          : `${id === 'gnss' ? 'Přijímač' : 'Kontroler'} se vypnul – vybitá baterie. U kufru GNSS dej Vyměnit baterii a přístroj znovu zapni.`,
      tone: 'warn',
    });
  }

  /** Výměna baterie: náhradní je v kufru, kufr musí být u ruky (v ruce nebo do 3 m). */
  private batterySwapPlan(id: PackId): ActionPlan | null {
    const p = this.bat[id];
    if (!canSwap(p)) return null;
    const kind: ItemKind = id === 'ts' ? 'tsCase' : 'gnssCase';
    const kase = this.items.find((i) => i.kind === kind);
    const near =
      !!kase &&
      (kase.state === 'held' || (kase.state === 'ground' && kase.location === this.world.location && Math.hypot(kase.pos.x - this.player.pos.x, kase.pos.z - this.player.pos.z) < 3));
    const target = `baterii ${PACK_NAME[id]} (${Math.round(p.main)} → ${Math.round(p.spare)} %)`;
    if (!near) return { verb: 'Vyměnit', target, available: false, reason: `Náhradní baterie je v kufru ${id === 'ts' ? 'stanice' : 'GNSS'} – přines ho sem` };
    return {
      verb: 'Vyměnit',
      target,
      available: true,
      run: () => {
        swap(p);
        this.sfx.click();
        navigator.vibrate?.(30);
        this.bus.emit('toast', {
          text: `Baterie ${PACK_NAME[id]} vyměněná: v přístroji ${Math.round(p.main)} %, vybitá (${Math.round(p.spare)} %) jde do kufru – v dodávce se nabije.${id === 'ts' ? '' : ' Přístroj zase zapni.'}`,
        });
        if (id === 'ts') this.bus.emit('toast', { text: 'Stanice naběhla. Zkontroluj urovnání – kompenzátor hlídá sklon, orientace platí, pokud se stativ nepohnul.' });
      },
    };
  }

  /** V noci se v kanceláři nabije všechno, co v ní je (nebo v dodávce); co zůstalo v terénu, ne. */
  private chargeOvernight(): void {
    const b = this.bat;
    const home = (kind: ItemKind): boolean => this.items.some((i) => i.kind === kind && (i.state === 'stored' || i.state === 'held' || i.location === 'kancelar'));
    const left: string[] = [];
    if (home('gnssCase') && home('gnssRover')) (b.gnss = { main: 100, spare: 100 }), (b.ctrl = { main: 100, spare: 100 });
    else left.push('GNSS');
    const tsHome = home('tsCase') && !this.items.some((i) => i.kind === 'tripod' && i.mounted && i.location !== 'kancelar' && i.state === 'deployed');
    if (tsHome) b.ts = { main: 100, spare: 100 };
    else left.push('stanice');
    if (left.length) setTimeout(() => this.bus.emit('toast', { text: `Baterie ${left.join(' a ')} se přes noc nenabily – vybavení nebylo v kanceláři.`, tone: 'warn' }), 3000);
  }

  private cond(id: EquipId): number {
    return this.career.equipment?.[id]?.condition ?? 1;
  }

  private damage(id: EquipId, amount: number, sudden: boolean): void {
    const e = (this.career.equipment ??= newEquipment());
    const before = e[id].condition;
    e[id].condition = Math.max(0, before - amount);
    if (sudden && before >= BROKEN && e[id].condition < BROKEN)
      setTimeout(() => this.bus.emit('toast', { text: `${EQUIP_NAME[id]} je po pádu v poruše. Bez servisu s ní neměříš.`, tone: 'warn' }), 2600);
    // Stanice na stativu dostane nový stav hned.
    if (id === 'ts') for (const ts of this.stations.values()) ts.wear = noiseFactor(e[id].condition);
    this.persist();
  }

  /** Předměty v servisu: skryté, dokud nejsou opravené; hotové se vrátí do skladu. */
  private syncRepairs(): void {
    const e = this.career.equipment;
    if (!e) return;
    for (const it of this.items) {
      const id = equipOf(it.kind);
      if (!id) continue;
      const st = e[id];
      if (st.repairReady && st.repairReady > this.career.day) {
        it.location = 'servis';
        it.state = 'ground';
      } else if (it.location === 'servis') {
        st.repairReady = undefined;
        it.location = 'kancelar';
        it.state = 'ground';
        it.pos = { ...(it.home ?? it.pos) };
        if (it.kind === 'tsCase' || it.kind === 'gnssCase') it.empty = false;
      }
    }
  }

  /** Servis v kanceláři: oprava přístroje přes noc. */
  private sendToRepair(id: EquipId): void {
    const e = this.career.equipment;
    if (!e || this.world.location !== 'kancelar') return;
    const cost = repairCost(id, e[id].condition, !!this.career.insured);
    const parts = this.items.filter((i) => equipOf(i.kind) === id);
    if (parts.some((i) => i.state === 'held' || i.state === 'deployed' || (i.location !== 'kancelar' && i.state !== 'stored'))) {
      this.bus.emit('toast', { text: 'Do servisu přines všechny díly přístroje sem do kanceláře (a nic nedrž v ruce).', tone: 'warn' });
      return;
    }
    if (this.career.money < cost) {
      this.bus.emit('toast', { text: `Oprava stojí ${kc(cost)}, na účtu nemáš dost.`, tone: 'warn' });
      return;
    }
    this.career.money -= cost;
    e[id] = { condition: 1, repairReady: this.career.day + 1 };
    if (id === 'gnss') {
      const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
      if (rig) Object.assign(rig, { receiver: false, controller: false, receiverOn: false, controllerOn: false });
    }
    this.syncRepairs();
    this.refreshHands();
    this.persist();
    this.sfx.success();
    this.bus.emit('toast', { text: `${EQUIP_NAME[id]} odeslán do servisu za ${kc(cost)}. Zítra ráno bude zpátky ve skladu, zkalibrovaný.` });
  }

  /** Vítr a nezajištěný stativ se stanicí: časem se převrhne. Kontrola jednou za herní minutu. */
  private windCheck(dt: number): void {
    this.windT -= dt * GAME_MIN_PER_SEC;
    if (this.windT > 0) return;
    this.windT = 1;
    if (this.weather.wind < 0.6) return;
    for (const t of this.items) {
      if (t.kind !== 'tripod' || t.state !== 'deployed' || !t.mounted || t.secured || t.location !== this.world.location) continue;
      if (this.rng.next() > 0.12 * this.weather.wind) continue;
      const kase = this.items.find((i) => i.kind === 'tsCase');
      t.mounted = false;
      t.state = 'ground';
      this.setups.delete(t.id);
      this.dropStation(t.id);
      if (kase) kase.empty = false;
      this.damage('ts', dropDamage('ts', true), true);
      this.damage('tripod', dropDamage('tripod', true), false);
      this.sfx.drop();
      navigator.vibrate?.([80, 40, 120]);
      this.bus.emit('toast', {
        text: `Poryv větru převrátil stativ se stanicí! Stanici jsi uložil do kufru – stav ${Math.round(this.cond('ts') * 100)} %. Ve větru nohy stativu vždycky sešlápni.`,
        tone: 'warn',
      });
    }
  }

  private coachOpen = false;

  private openCoach(): void {
    if (this.coachOpen) return;
    if (this.input.pointerLocked) document.exitPointerLock();
    this.coachOpen = true;
    showCoach(this.root, this.touchMode, () => {
      this.coachOpen = false;
      this.hud.setLockHint(!this.touchMode && !this.input.pointerLocked);
    });
  }

  /** Kapitola příručky podle toho, co hráč právě dělá. */
  private helpTopic(): string {
    const active = this.activeItem();
    const run = this.activeRun();
    if (active?.kind === 'gnssRover' || active?.kind === 'gnssCase') {
      const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
      if (!rig?.receiver || !rig.controllerOn) return 'gnss-rig';
      if (this.ctrl.missing().length) return 'gnss-ctrl';
      return run?.spec.type === 'vytyceni' ? 'stakeout' : 'gnss-measure';
    }
    if (active?.kind === 'tripod' || active?.kind === 'tsCase') return 'tripod';
    if (active?.kind === 'prismPole' || this.connected()) return 'ts-measure';
    if (active?.kind === 'level' || active?.kind === 'rod' || run?.spec.type === 'nivelace') return 'level';
    if (!run) return this.world.location === 'kancelar' ? 'start' : 'career';
    if (this.jobComplete(run)) return 'office';
    return run.spec.kit.includes('gnssRover') ? 'gnss-rig' : run.spec.requireStation ? 'tripod' : 'start';
  }

  private openController(): void {
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    if (!rover?.rig?.controller || !rover.rig.controllerOn || rover.state !== 'held') {
      this.bus.emit('toast', { text: 'Kontroler je na výtyčce roveru. Vezmi rover do ruky a kontroler zapni.', tone: 'warn' });
      return;
    }
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.ctrlScreen.show();
    this.ctrlScreen.update(this.controllerView());
  }

  /** Soubory souřadnic dostupné v kanceláři pro tuto lokalitu (bodové pole a data k převzatým zakázkám). */
  private importFiles(): ImportFile[] {
    const loc = this.world.location;
    const files: ImportFile[] = [
      {
        id: `bp-${loc}`,
        name: `bodove_pole_${loc}.csv`,
        desc: 'Body bodového pole z databáze ČÚZK (S-JTSK, Bpv)',
        location: loc,
        points: this.world.marks.map((m) => ({ id: m.number, Y: m.catalog.Y, X: m.catalog.X, H: m.catalog.H, label: m.stabilization })),
      },
    ];
    const names: Record<string, [string, string]> = {
      'stavba-rd': ['RD_Novak_vytycovaci_vykres.csv', 'Projektant: hlavní body domu'],
      'stavba-hranice': ['hranice_1254-3_SGI.csv', 'Katastr: souřadnice lomových bodů parcely 1254/3'],
      'louka-hranice': ['hranice_812-5_SGI.csv', 'Katastr: souřadnice lomových bodů pozemku 812/5'],
    };
    for (const run of this.jobs.values()) {
      if (run.spec.location !== loc || run.status === 'nova' || !run.spec.stake) continue;
      const [name, desc] = names[run.spec.id] ?? [`vytyceni_${run.spec.id}.csv`, run.spec.title];
      const targets = run.stake?.targets ?? designTargets(run.spec, this.world);
      files.push({
        id: `stake-${run.spec.id}`,
        name,
        desc,
        location: loc,
        points: targets.map((t) => ({ id: t.id, Y: t.design.Y, X: t.design.X, label: t.label })),
      });
    }
    return files;
  }

  private controllerView(): ControllerView {
    const g = this.gnss;
    const c = this.ctrl;
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    const job = c.job;
    const files = this.importFiles();
    const run = this.activeRun();
    const st = run?.stake;
    const imported = !!run && !!job?.imported.includes(`stake-${run.spec.id}`);
    const f3 = (v: number): string => v.toFixed(3);
    return {
      status: {
        clock: clockText(this.clockMin),
        bt: c.bt === RECEIVER_SERIAL,
        corr: !c.ntripOn ? 'off' : c.correctionsOk ? 'ok' : 'late',
        age: !c.ntripOn ? 'bez korekcí' : c.correctionAge > 60 ? 'výpadek' : `${Math.round(c.correctionAge)} s`,
        solution: c.bt ? SOLUTION_LABEL[g.solution] : 'Nepřipojeno',
        tone: !c.bt ? 'bad' : g.solution === 'fix' ? 'fix' : g.solution === 'float' ? 'float' : 'bad',
        sats: c.bt ? g.sats : 0,
        pdop: c.bt && g.solution !== 'none' ? g.pdop.toFixed(1).replace('.', ',') : '–',
        prec: c.bt && g.solution !== 'none' ? `H ${g.sigmaH < 1 ? f3(g.sigmaH) : g.sigmaH.toFixed(1)} V ${g.sigmaV < 1 ? f3(g.sigmaV) : g.sigmaV.toFixed(1)}` : 'H – V –',
        battery: this.bat.ctrl.main,
        rxBattery: c.bt ? this.bat.gnss.main : null,
      },
      job: job ? { name: job.name, crs: CRS_OPTIONS.find((o) => o.id === job.crs)?.label ?? job.crs } : null,
      next: this.controllerNext(),
      jobs: c.jobs.filter((j) => j.location === this.world.location).map((j) => j.name),
      suggestedName: `${LOCATIONS[this.world.location].short.replace(/\s+/g, '')}_den${this.career.day}`,
      crs: CRS_OPTIONS,
      files: files.map((fl) => ({ id: fl.id, name: fl.name, desc: fl.desc, count: fl.points.length, imported: !!job?.imported.includes(fl.id) })),
      bt: {
        // Najde jen zapnutá zařízení.
        devices: BT_DEVICES.filter((d) => !d.ours || rig?.receiverOn).map((d) => ({ id: d.id, label: d.label })),
        connected: c.bt,
      },
      ntrip: {
        caster: NTRIP_CASTER.name,
        host: NTRIP_CASTER.host,
        port: NTRIP_CASTER.port,
        user: 'geomereni_brandys',
        mounts: MOUNTPOINTS.map((m) => ({ id: m.id, label: m.label })),
        mount: c.mountpoint,
        on: c.ntripOn,
      },
      antenna: { types: ANTENNA_TYPES.map((a) => ({ id: a.id, label: a.label })), type: c.antennaType, height: c.antennaHeight },
      measure: {
        nextId: String(1001 + this.log.points.length),
        codes: CODES.map((x) => x.label),
        code: this.codeIdx,
        epochs: EPOCH_OPTIONS,
        epoch: c.epochs,
        tol: `H ${(c.tolH * 100).toFixed(0)} cm, V ${(c.tolV * 100).toFixed(0)} cm`,
        obs: this.obs ? { t: this.obs.t, need: this.obs.need } : null,
        last: this.ctrlLast,
        blocked: this.roverBlocked() ?? (g.solution === 'none' ? 'Přijímač hledá družice…' : null),
      },
      stake: {
        targets: imported && st ? st.targets.map((t) => ({ id: t.id, label: t.label, state: st.status(t.id) === 'pending' ? ('pending' as const) : ('done' as const) })) : [],
        selected: this.selectedTarget,
        note: !run?.spec.stake
          ? 'Aktivní zakázka nic nevytyčuje.'
          : imported
            ? 'Vyber bod. Kontroler tě navede (Vpřed / Vpravo), u bodu zatluč kolík.'
            : 'Body k vytyčení nejsou v zakázce. Nahraj je v Importu.',
      },
      points: this.log.points
        .filter((p) => p.method === 'gnss_rtk' && p.location === this.world.location)
        .slice(-40)
        .reverse()
        .map((p) => ({
          id: p.id,
          code: CODES.find((x) => x.code === p.code)?.label ?? (p.code === 'PEVNY_BOD' ? 'Pevný bod' : p.code === 'HRANICE' ? 'Hranice' : p.code),
          coords: `${f3(p.Y)} / ${f3(p.X)} / ${f3(p.Z)}`,
          prec: `${(p.sigmaXY * 1000).toFixed(0)} mm${p.note ? ' !' : ''}`,
          check: p.dev && job?.imported.includes(`bp-${this.world.location}`) ? `kontrola ${p.markNumber}: ΔY ${mm(p.dev.dY)} ΔX ${mm(p.dev.dX)} ΔH ${mm(p.dev.dH)} mm` : undefined,
        })),
    };
  }

  /** Průvodce kontrolerem: další krok a dlaždice, na kterou ťuknout. */
  private controllerNext(): { page: string; text: string } | null {
    const c = this.ctrl;
    const run = this.activeRun();
    const job = c.job;
    const miss = c.missing();
    if (!job) return { page: 'job', text: 'Založ zakázku a vyber souřadnicový systém S-JTSK (EPSG:5513) + Bpv.' };
    if (!job.imported.includes(`bp-${this.world.location}`)) return { page: 'import', text: 'Nahraj bodové pole – kontroler pak ukáže odchylky na kontrolním bodě.' };
    if (miss.includes('bluetooth')) return { page: 'bt', text: 'Spáruj přijímač přes Bluetooth.' };
    if (miss.includes('antenna')) return { page: 'antenna', text: 'Zadej typ antény a výšku, kterou jsi odečetl na výtyčce.' };
    if (miss.includes('ntrip')) return { page: 'ntrip', text: 'Připoj korekce CZEPOS: načti tabulku zdrojů a vyber VRS3-GG.' };
    if (this.gnss.solution !== 'fix') return { page: 'ntrip', text: 'Čekej na FIX (zelený stav nahoře). U zdí a pod stromy nepřijde – popojdi na volno.' };
    if (run && run.spec.kit.includes('gnssRover') && run.spec.type !== 'rekognoskace' && !run.check)
      return { page: 'measure', text: 'Nejdřív změř kontrolu: hrot na bod bodového pole, Měřit. Odchylky do 2–3 cm jsou v pořádku.' };
    if (run?.spec.stake && !job.imported.includes(`stake-${run.spec.id}`)) return { page: 'import', text: 'Nahraj souřadnice bodů k vytyčení (soubor zakázky).' };
    if (run?.spec.stake) return { page: 'stake', text: 'Vyber bod k vytyčení a jdi podle navigace.' };
    return { page: 'measure', text: 'Měř body: vyber kód, postav hrot a změř.' };
  }

  private controllerAction(id: string, value?: string): void {
    const c = this.ctrl;
    const rig = this.items.find((i) => i.kind === 'gnssRover')?.rig;
    const toast = (text: string, tone: 'info' | 'warn' = 'info'): void => this.bus.emit('toast', { text, tone });
    this.sfx.click();
    switch (id) {
      case 'job:create': {
        const [rawName, crs] = (value ?? '').split('|');
        const name = rawName.replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 32) || 'Zakazka';
        if (c.jobs.some((j) => j.name === name)) return toast(`Zakázka ${name} už existuje, otevři ji nebo zvol jiný název.`, 'warn');
        c.createJob(name, crs as CrsId, this.world.location);
        toast(`Zakázka ${name} založena.`);
        break;
      }
      case 'job:open':
        c.openJob(value ?? '');
        break;
      case 'import:toggle': {
        const job = c.job;
        if (!job || !value) return;
        const f = this.importFiles().find((x) => x.id === value);
        if (job.imported.includes(value)) job.imported = job.imported.filter((x) => x !== value);
        else {
          job.imported.push(value);
          toast(`Nahráno ${f?.points.length ?? 0} bodů ze souboru ${f?.name ?? value}.`);
        }
        break;
      }
      case 'bt:connect': {
        const d = BT_DEVICES.find((x) => x.id === value);
        if (!d) return;
        if (!d.ours) return toast(`${d.label}: tohle není přijímač GNSS.`, 'warn');
        if (!rig?.receiverOn) return toast('Přijímač se nehlásí. Je zapnutý?', 'warn');
        c.bt = d.id;
        toast(`Připojeno k přijímači SN ${d.id}.`);
        break;
      }
      case 'bt:disconnect':
        c.bt = null;
        c.ntripOn = false;
        break;
      case 'ntrip:mount':
        c.mountpoint = value ?? null;
        c.ntripOn = false;
        break;
      case 'ntrip:connect':
        if (c.bt !== RECEIVER_SERIAL) return toast('Korekce se posílají do přijímače: nejdřív ho připoj.', 'warn');
        if (!c.mountpoint) return;
        c.ntripOn = true;
        c.correctionAge = 99;
        toast(`Připojeno k ${NTRIP_CASTER.name}, zdroj ${c.mountpoint}. Přijímač čeká na FIX.`);
        break;
      case 'ntrip:disconnect':
        c.ntripOn = false;
        break;
      case 'ant:type':
        c.antennaType = value ?? null;
        break;
      case 'ant:height': {
        const v = Number((value ?? '').replace(',', '.'));
        if (!Number.isFinite(v) || v <= 0 || v > 5) return toast('Zadej výšku antény v metrech, třeba 2.000.', 'warn');
        c.antennaHeight = Math.round(v * 1000) / 1000;
        toast(`Výška antény ${c.antennaHeight.toFixed(3).replace('.', ',')} m.`);
        break;
      }
      case 'meas:code':
        this.codeIdx = clamp(Number(value) || 0, 0, CODES.length - 1);
        break;
      case 'meas:epochs':
        c.epochs = EPOCH_OPTIONS.includes(Number(value)) ? Number(value) : 5;
        break;
      case 'meas:start':
        if (this.aim && !this.roverBlocked() && this.gnss.solution !== 'none') this.startObservation(this.aim);
        break;
      case 'stake:select':
        this.selectedTarget = value ?? null;
        break;
    }
  }

  /** Začne observaci bodu: kontroler sbírá epochy, hráč musí stát a držet výtyčku svisle. */
  private startObservation(aim: AimPoint, helper?: string): void {
    if (this.obs) return;
    // Pomocný bod: nejdřív zatlouct hřeb, pak delší observace (aspoň 30 s) – ponese celé měření stanicí.
    this.obs = { t: 0, need: helper ? Math.max(30, this.ctrl.epochs) : this.ctrl.epochs, aim: { ...aim }, helper };
    if (helper) this.sfx.drop();
    else this.sfx.click();
    this.bus.emit('toast', {
      text: helper
        ? `Hřeb zatlučen. Měřím pomocný bod ${helper}: ${this.obs.need} s, stůj a drž bublinu v kroužku.`
        : `Měřím bod ${1001 + this.log.points.length}: ${this.ctrl.epochs} s, stůj a drž bublinu v kroužku.`,
    });
  }

  /** Číslo dalšího pomocného bodu, který si zakázka žádá, nebo null. */
  private nextHelper(): string | null {
    const run = this.activeRun();
    const need = run?.spec.helperPoints?.length ?? 0;
    if (!need || run?.spec.location !== this.world.location) return null;
    for (let k = 1; k <= need; k++) {
      const n = String(8000 + k);
      if (!this.world.marks.some((m) => m.id === `PB-${n}`)) return n;
    }
    return null;
  }

  /** Nový pomocný bod: hřeb v terénu, souřadnice z GNSS měření (i s jeho chybou). */
  private createHelperMark(number: string, aim: AimPoint, c: { Y: number; X: number; H: number }): void {
    const r3 = (v: number): number => Math.round(v * 1000) / 1000;
    const mark: ControlMark = {
      id: `PB-${number}`,
      number,
      type: 'PB',
      stabilization: 'Měřický hřeb, kolem oranžový kroužek sprejem',
      description: `Pomocný bod stabilizovaný dne ${this.career.day}. Souřadnice z GNSS RTK (${SOLUTION_LABEL[this.gnss.solution]}).`,
      pos: { x: aim.x, y: aim.groundY, z: aim.z },
      catalog: { Y: r3(c.Y), X: r3(c.X), H: r3(c.H) },
      condition: 'ok',
    };
    this.world.marks.push(mark);
    this.locGroup?.add(createMarkMesh(mark));
    this.registerMark(mark);
    this.tablet.setMap(new MapRenderer(this.world));
    setTimeout(
      () =>
        this.bus.emit('toast', {
          text: `Pomocný bod ${number} stabilizován: Y ${mark.catalog.Y.toFixed(3)}, X ${mark.catalog.X.toFixed(3)}. Stanice ho vezme jako známý bod.`,
        }),
      1600,
    );
  }

  private updateObservation(dt: number): void {
    const o = this.obs;
    if (!o) return;
    const abort = (why: string): void => {
      this.obs = null;
      this.bus.emit('toast', { text: `Observace přerušena: ${why}`, tone: 'warn' });
    };
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    if (!rover || rover.state !== 'held') return abort('rover není v ruce.');
    if (this.gnss.solution === 'none') return abort('přijímač ztratil družice.');
    const tip = this.aim;
    if (!tip || Math.hypot(tip.x - o.aim.x, tip.z - o.aim.z) > 0.03 || Math.hypot(this.player.vel.x, this.player.vel.z) > 0.2)
      return abort('výtyčka se pohnula.');
    if (!this.pole.inCircle && !this.hasUpgrade('imu') && !this.bipodTip) return abort('bublina utekla z kroužku.');
    o.t += dt;
    if (o.t < o.need) return;
    this.obs = null;
    // Víc epoch zprůměruje šum, ale jen zčásti (chyby RTK jsou v čase korelované).
    const off = this.hasUpgrade('imu') ? { x: 0, z: 0 } : this.pole.offset();
    const truth = { x: o.aim.x + off.x, y: o.aim.y, z: o.aim.z + off.z };
    const r = this.gnss.measure(truth);
    const k = 1 / Math.sqrt(1 + o.need / 10);
    const pos = { x: truth.x + (r.pos.x - truth.x) * k, y: truth.y + (r.pos.y - truth.y) * k, z: truth.z + (r.pos.z - truth.z) * k };
    const c = this.measure(o.aim, { pos, sigmaH: r.sigmaH * k, sigmaV: r.sigmaV * k }, !!o.helper);
    if (o.helper) this.createHelperMark(o.helper, o.aim, c);
  }

  // ================================================================ pomocník Pepa

  /** Hlášení vysílačkou. */
  private say(text: string, tone: 'info' | 'warn' = 'info'): void {
    this.sfx.click();
    this.bus.emit('toast', { text: `Pepa: ${text}`, tone });
  }

  private helperDist(): number {
    const h = this.helper.pos;
    return Math.hypot(h.x - this.player.pos.x, h.z - this.player.pos.z);
  }

  /** Přístroje v lokalitě, ke kterým se dá postavit: ustavená stanice nebo nivelák. */
  private instruments(): WorldItem[] {
    return this.items.filter(
      (i) => i.state === 'deployed' && i.location === this.world.location && ((i.kind === 'tripod' && this.stations.has(i.id)) || i.kind === 'level'),
    );
  }

  /** Pojmenované body pro povel „jdi na bod“: značky, prvky, vytyčované body. */
  private helperPoints(): { id: string; label: string; x: number; y: number; z: number; mark?: ControlMark; feature?: FeatureInfo }[] {
    const out: { id: string; label: string; x: number; y: number; z: number; mark?: ControlMark; feature?: FeatureInfo }[] = [];
    for (const m of this.world.marks) if (m.condition === 'ok') out.push({ id: `m:${m.id}`, label: `${m.number} (${MARK_TYPE_SHORT[m.type]})`, ...m.pos, mark: m });
    for (const f of this.world.features) out.push({ id: `f:${f.id}`, label: f.label, ...f.pos, feature: f });
    const st = this.activeRun()?.stake;
    if (st)
      for (const t of st.targets)
        if (st.status(t.id) === 'pending') out.push({ id: `t:${t.id}`, label: `${t.label} (projekt)`, x: t.world.x, y: this.world.heightmap.heightAt(t.world.x, t.world.z), z: t.world.z });
    const p = this.player.pos;
    return out.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 10);
  }

  private openHelper(): void {
    if (!this.started || this.modalOpen || this.driving) return;
    if (this.input.pointerLocked) document.exitPointerLock();
    const h = this.helper;
    const d = this.helperDist();
    const carry = h.carryId ? this.items.find((i) => i.id === h.carryId) : undefined;
    const active = this.activeItem();
    const stateTxt = { follow: 'jde za tebou', wait: 'čeká', goto: 'je na cestě', hold: 'drží na bodě', instrument: 'stojí u přístroje' }[h.state];
    const actions: HelperMenu['actions'] = [
      { id: 'follow', label: 'Pojď za mnou' },
      { id: 'wait', label: 'Počkej tady' },
    ];
    if (!carry && (active?.kind === 'prismPole' || active?.kind === 'rod'))
      actions.push({ id: 'give', label: `Vezmi si ${ITEM_DEFS[active.kind].nameAcc}`, disabled: d > 3.5, hint: d > 3.5 ? 'Musí stát u tebe' : undefined });
    if (carry)
      actions.push({
        id: 'return',
        label: `Vrať mi ${ITEM_DEFS[carry.kind].nameAcc}`,
        disabled: d > 3.5 || !this.hands.freeHand(),
        hint: d > 3.5 ? 'Musí stát u tebe' : !this.hands.freeHand() ? 'Máš plné ruce' : undefined,
      });
    actions.push({ id: 'goto:here', label: 'Jdi tam, kam se dívám', hint: carry ? `s ${ITEM_DEFS[carry.kind].nameAcc}` : undefined });
    for (const inst of this.instruments())
      actions.push({
        id: `instrument:${inst.id}`,
        label: inst.kind === 'level' ? 'Stůj u niveláku' : 'Stůj u totálky',
        disabled: !!carry,
        hint: carry ? 'Nejdřív mu vezmi, co nese' : undefined,
      });
    const inst = h.state === 'instrument' ? this.items.find((i) => i.id === h.instrumentId) : undefined;
    if (inst) actions.push({ id: 'measure', label: inst.kind === 'level' ? 'Přečti lať' : 'Změř můj hranol' });
    this.helperSheet.show({
      status: `Pepa ${stateTxt}${carry ? `, nese ${ITEM_DEFS[carry.kind].nameAcc}` : ''}, ${Math.round(d)} m od tebe.`,
      actions,
      points: this.helperPoints().map((p) => ({ id: p.id, label: p.label, dist: `${Math.round(Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z))} m` })),
      carrying: carry ? ITEM_DEFS[carry.kind].nameAcc : null,
    });
  }

  private helperCommand(id: string): void {
    const h = this.helper;
    const [cmd, arg] = id.split(/:(.*)/s);
    const carry = h.carryId ? this.items.find((i) => i.id === h.carryId) : undefined;
    switch (cmd) {
      case 'follow':
        h.follow();
        return this.say(carry ? 'Jdu za tebou i s ní.' : 'Jdu za tebou.');
      case 'wait':
        h.wait();
        return this.say('Čekám tady.');
      case 'give': {
        const it = this.activeItem();
        if (!it || (it.kind !== 'prismPole' && it.kind !== 'rod') || this.helperDist() > 3.5) return;
        if (it.hand) this.hands.release(it.hand);
        it.hand = null;
        it.state = 'deployed';
        it.location = this.world.location;
        it.overMarkId = undefined;
        h.carryId = it.id;
        this.refreshHands();
        return this.say(`Beru si ${ITEM_DEFS[it.kind].nameAcc}.`);
      }
      case 'return':
        if (carry && this.helperDist() <= 3.5 && this.hands.freeHand()) {
          h.carryId = null;
          this.pickUp(carry);
          this.say('Tady máš.');
        }
        return;
      case 'goto': {
        let goal: { x: number; y: number; z: number; label: string; mark?: ControlMark; feature?: FeatureInfo } | null = null;
        if (arg === 'here') {
          const p = this.player.pos;
          const eye = { x: p.x, y: p.y + this.player.eyeHeight, z: p.z };
          const dir = lookDirection(this.player.yaw, this.player.pitch);
          const t = this.world.heightmap.raycast(eye, dir, 160, 0.25);
          if (t === null) return this.say('Nevidím, kam ukazuješ. Ukaž na zem.', 'warn');
          const x = eye.x + dir.x * t;
          const z = eye.z + dir.z * t;
          const near = this.helperPoints().find((q) => Math.hypot(q.x - x, q.z - z) < 0.6);
          goal = near ? { ...near } : { x, y: this.world.heightmap.heightAt(x, z), z, label: 'místo, kam jsi ukázal' };
        } else {
          const q = this.helperPoints().find((pp) => pp.id === arg) ?? this.allHelperPoint(arg);
          if (q) goal = { ...q };
        }
        if (!goal) return;
        this.helperGoal = goal;
        h.goTo(goal.x, goal.z, 'hold');
        return this.say(carry ? `Jdu s ${ITEM_DEFS[carry.kind].nameAcc === 'nivelační lať' ? 'latí' : 'výtyčkou'} na ${goal.label}.` : `Jdu na ${goal.label}.`);
      }
      case 'instrument': {
        const inst = this.items.find((i) => i.id === arg);
        if (!inst || carry) return;
        h.instrumentId = inst.id;
        h.goTo(inst.pos.x, inst.pos.z, 'instrument');
        return this.say(inst.kind === 'level' ? 'Jdu k niveláku.' : 'Jdu k totálce.');
      }
      case 'measure':
        return this.helperMeasure();
    }
  }

  /** Bod podle ID i mimo nejbližších deset. */
  private allHelperPoint(id: string): { id: string; label: string; x: number; y: number; z: number; mark?: ControlMark; feature?: FeatureInfo } | undefined {
    const [k, v] = id.split(/:(.*)/s);
    if (k === 'm') {
      const m = this.world.marks.find((x) => x.id === v);
      return m ? { id, label: m.number, ...m.pos, mark: m } : undefined;
    }
    if (k === 'f') {
      const f = this.world.features.find((x) => x.id === v);
      return f ? { id, label: f.label, ...f.pos, feature: f } : undefined;
    }
    return undefined;
  }

  /** Pepa došel. S výtyčkou / latí ji postaví svisle na bod. */
  private helperArrived(purpose: 'hold' | 'instrument'): void {
    const h = this.helper;
    if (purpose === 'instrument') return this.say('Jsem u přístroje. Řekni, až mám měřit.');
    const g = this.helperGoal;
    const carry = h.carryId ? this.items.find((i) => i.id === h.carryId) : undefined;
    if (!g) return;
    if (!carry) return this.say(`Jsem na ${g.label}.`);
    if (carry.kind === 'rod') {
      if (g.mark) {
        carry.pointId = g.mark.id;
        carry.pointLabel = g.mark.number;
      } else if (g.feature) {
        carry.pointId = g.feature.id;
        carry.pointLabel = g.feature.id.startsWith('vb') ? g.feature.id.toUpperCase() : g.feature.label;
      } else {
        this.tpCounter++;
        carry.pointId = `TP${this.tpCounter}`;
        carry.pointLabel = `přestav ${this.tpCounter}`;
      }
    } else {
      carry.overMarkId = g.mark?.id;
    }
    this.say(`Stojím na ${g.label}, ${carry.kind === 'rod' ? 'lať' : 'výtyčku'} držím svisle.`);
  }

  /** Pepa u přístroje: nivelák přečte lať, totálka změří hranol na tvé výtyčce. */
  private helperMeasure(): void {
    const inst = this.items.find((i) => i.id === this.helper.instrumentId);
    if (!inst || this.helper.state !== 'instrument') return;
    if (inst.kind === 'level') {
      const rod = this.deployedRod();
      if (!rod) return this.say('Lať nikde nestojí.', 'warn');
      const r = this.levelRecord(inst, rod);
      return this.say(r.text, r.ok ? 'info' : 'warn');
    }
    const ts = this.stations.get(inst.id);
    if (!ts) return this.say('Stanice není ustavená.', 'warn');
    const pole = this.activeItem();
    if (pole?.kind !== 'prismPole' || !this.aim) return this.say('Nevidím hranol. Vezmi si výtyčku a postav ji na bod.', 'warn');
    const aim = this.aim;
    let kind: RobotKind = 'measure';
    if (!ts.station) {
      if (!aim.mark || aim.mark.type === 'NZ') return this.say('Na volné stanovisko potřebuju hranol na známém bodě.', 'warn');
      kind = 'resect';
    } else if (ts.orientation === null) {
      if (!aim.mark || aim.mark.type === 'NZ' || aim.mark.id === inst.overMarkId) return this.say('Nejdřív orientace: postav se na jiný známý bod.', 'warn');
      kind = 'orient';
    }
    this.say('Mířím… drž výtyčku svisle.');
    this.startRobot(kind, aim);
    if (this.robotMeasure) this.robotMeasure.t = 2.4; // člověk míří déle než robot
  }

  /** Nesená / držená výtyčka nebo lať se kreslí u Pepy. */
  private syncHelperCarry(): void {
    const h = this.helper;
    const it = h.carryId ? this.items.find((i) => i.id === h.carryId) : undefined;
    if (!it) return;
    if (it.state !== 'deployed') {
      h.carryId = null;
      return;
    }
    it.location = this.world.location;
    if (h.state === 'hold' && this.helperGoal) {
      it.pos = { x: this.helperGoal.x, y: this.helperGoal.y, z: this.helperGoal.z };
      return;
    }
    const p = h.pos;
    const r = { x: Math.cos(h.body.yaw), z: -Math.sin(h.body.yaw) };
    const x = p.x + r.x * 0.32;
    const z = p.z + r.z * 0.32;
    it.pos = { x, y: this.world.heightmap.heightAt(x, z) + 0.05, z };
    it.yaw = h.body.yaw;
  }

  // ================================================================ kariéra a kancelář

  /** Rada k dnešnímu počasí (jednou ráno). */
  private weatherTip(): void {
    const w = this.weather;
    const tip =
      w.kind === 'vitr'
        ? 'Silný vítr: výtyčka se bude klátit a nivelák chvět. Drž bublinu, záměry kratší.'
        : w.kind === 'mlha'
          ? 'Mlha: stanice bez hranolu dosáhne jen ~60 m, na hranol ~180 m.'
          : w.kind === 'dest'
            ? 'Déšť: horší viditelnost, laser bez hranolu jen ~150 m.'
            : w.kind === 'jasno'
              ? 'Jasno a teplo: v poledne se vzduch tetelí, dlouhé nivelační záměry budou horší.'
              : null;
    if (tip) setTimeout(() => this.bus.emit('toast', { text: `Předpověď: ${tip}` }), 4200);
  }

  /** Obnoví uloženou kariéru: den, účet a stavy zakázek. */
  private applyCareer(c: CareerState): void {
    this.career = c;
    c.equipment = { ...newEquipment(), ...(c.equipment ?? {}) };
    this.syncRepairs();
    this.refreshOrders();
    this.applyUpgrades();
    this.weather = weatherForDay(c.day);
    for (const [id, cj] of Object.entries(c.jobs)) {
      const run = this.jobs.get(id);
      if (!run) continue;
      if (cj.status === 'aktivni') {
        run.status = 'nova';
        this.startJob(run);
      } else if (cj.status === 'odevzdana') {
        run.status = 'odevzdana';
        run.result = cj.result ? { ok: cj.result.ok, text: cj.result.text } : undefined;
      }
    }
    const active = Object.entries(c.jobs).find(([, j]) => j.status === 'aktivni');
    this.activeJobId = active?.[0] ?? null;
  }

  private persist(): void {
    for (const [id, run] of this.jobs) {
      if (run.status === 'nova') delete this.career.jobs[id];
      else
        this.career.jobs[id] = {
          status: run.status,
          result: run.result ? { ...run.result, pay: this.career.jobs[id]?.result?.pay ?? 0 } : undefined,
        };
    }
    this.career.stats.points = this.log.points.length;
    saveCareer(this.career);
  }

  /** Kde je které vybavení potřebné k zakázce. */
  private kitRows(spec: JobSpec): KitRow[] {
    return spec.kit.map((kind) => {
      const it = this.items.find((i) => i.kind === kind);
      const name = ITEM_DEFS[kind].name;
      if (!it) return { name, where: 'chybí', ok: false };
      if (it.state === 'stored') return { name, where: 'v dodávce', ok: true };
      if (it.state === 'held') return { name, where: 'v ruce', ok: true };
      if (it.location === 'servis') return { name, where: 'v servisu', ok: false };
      const at = it.location === this.world.location;
      if (it.location === spec.location) return { name, where: at ? 'tady na místě' : `na místě (${LOCATIONS[it.location as LocationId].short})`, ok: true };
      return { name, where: at ? (it.location === 'kancelar' ? 've skladu' : 'tady, nenaloženo') : `zůstalo: ${LOCATIONS[it.location as LocationId].short}`, ok: false };
    });
  }

  private openOffice(): void {
    if (this.input.pointerLocked) document.exitPointerLock();
    this.sfx.click();
    this.officeSel =
      this.officeSel ?? this.activeJobId ?? this.allJobs().find((j) => this.jobs.get(j.id)?.status === 'nova' && this.jobUnlocked(j))?.id ?? null;
    this.officeScreen.show();
  }

  private officeView(): OfficeView {
    const urgent = this.urgentToday();
    const cards = this.allJobs().map((spec) => {
      const r = this.jobs.get(spec.id) as JobRun;
      const locked = !this.jobUnlocked(spec) && r.status !== 'aktivni';
      const status = locked
        ? 'Zamčeno'
        : r.status === 'nova'
          ? 'Nová'
          : r.status === 'aktivni'
            ? this.activeJobId === spec.id
              ? 'Aktivní'
              : 'Převzatá'
            : r.result?.ok
              ? 'Hotovo'
              : 'K opravě';
      const tone: OfficeCard['tone'] = locked ? 'locked' : r.status === 'nova' ? 'new' : r.status === 'aktivni' ? 'active' : r.result?.ok ? 'done' : 'bad';
      return {
        id: spec.id,
        title: spec.title,
        place: `${LOCATIONS[spec.location].name}, ${travelMinutes('kancelar', spec.location)} min jízdy`,
        pay: kc(spec.pay),
        difficulty: spec.difficulty,
        status,
        tone,
        badge: locked
          ? `od stupně ${rankFor(spec.difficulty).name}`
          : spec.id === urgent
            ? 'Spěchá +30 %'
            : spec.issued !== undefined && r.status === 'nova'
              ? spec.issued === this.career.day
                ? 'Nová objednávka dnes'
                : 'Objednávka platí do zítřka'
              : undefined,
      };
    }).sort(
      (a, b) =>
        Number(a.tone === 'locked') - Number(b.tone === 'locked') ||
        Number(b.id === urgent) - Number(a.id === urgent) ||
        Number(b.id.startsWith('obj-') && b.tone === 'new') - Number(a.id.startsWith('obj-') && a.tone === 'new'),
    );
    const spec = this.allJobs().find((j) => j.id === this.officeSel);
    let detail: OfficeView['detail'] = null;
    if (spec) {
      const r = this.jobs.get(spec.id) as JobRun;
      const actions: { id: string; label: string; primary?: boolean }[] = [];
      const locked = !this.jobUnlocked(spec) && r.status !== 'aktivni';
      if (locked) {
        /* zamčená zakázka: jen popis */
      } else if (r.status === 'nova') actions.push({ id: `accept:${spec.id}`, label: 'Převzít zakázku', primary: true });
      else if (r.status === 'aktivni' && this.jobComplete(r)) actions.push({ id: `process:${spec.id}`, label: 'Zpracovat data a odevzdat', primary: true });
      else if (r.status === 'aktivni' && this.activeJobId !== spec.id) actions.push({ id: `open:${spec.id}`, label: 'Nastavit jako aktivní', primary: true });
      else if (r.status === 'odevzdana') actions.push({ id: `redo:${spec.id}`, label: 'Přijmout novou objednávku' });
      detail = {
        title: spec.title,
        client: spec.client,
        place: LOCATIONS[spec.location].name,
        brief: r.result ? `${spec.brief} Výsledek: ${r.result.text}` : spec.brief,
        notice: locked
          ? `Tuhle zakázku dispečink svěří až od stupně ${rankFor(spec.difficulty).name}. Odevzdej bez vady ještě ${rankFor(spec.difficulty).minOk - okJobs(this.career)} ${this.jobsWord(rankFor(spec.difficulty).minOk - okJobs(this.career))}.`
          : spec.id === urgent
            ? `Spěchá: odevzdáš-li ji bez vady ještě dnes, objednatel přidá ${kc(Math.round((spec.pay * 0.3) / 100) * 100)}.`
            : undefined,
        steps: this.jobSteps(r)
          .slice(0, -1)
          .map((s) => s.text),
        pay: kc(spec.pay),
        kit: this.kitRows(spec),
        actions,
      };
    }
    const loaded = this.items.filter((i) => i.state === 'stored').length;
    const ri = rankIndex(this.career);
    const next = RANKS[ri + 1];
    const done = okJobs(this.career);
    return {
      day: `Den ${this.career.day} · ${weatherText(this.weather)}`,
      rank: {
        name: RANKS[ri].name,
        progress: next ? `Další stupeň ${next.name}: ${done} z ${next.minOk} zakázek bez vady` : `Nejvyšší stupeň, příplatek ${Math.round(RANKS[ri].payBonus * 100)} % ke každé zakázce`,
        frac: next ? (done - RANKS[ri].minOk) / (next.minOk - RANKS[ri].minOk) : 1,
      },
      clock: clockText(this.clockMin),
      money: kc(this.career.money),
      cards,
      selected: this.officeSel,
      detail,
      shop: UPGRADES.map((u) => ({ id: u.id, name: u.name, desc: u.desc, price: kc(u.price), owned: this.hasUpgrade(u.id), canBuy: this.career.money >= u.price })),
      service: (['ts', 'gnss', 'level', 'tripod'] as EquipId[]).map((id) => {
        const st = this.career.equipment?.[id] ?? { condition: 1 };
        const away = !!st.repairReady && st.repairReady > this.career.day;
        const cost = repairCost(id, st.condition, !!this.career.insured);
        return {
          id,
          name: EQUIP_NAME[id],
          state:
            (away ? `v servisu, zpátky den ${st.repairReady}` : `${stateLabel(st.condition)} · ${Math.round(st.condition * 100)} %`) +
            (id === 'ts' || id === 'gnss' ? ` · baterie ${Math.round(this.bat[id].main)} + ${Math.round(this.bat[id].spare)} %` : ''),
          tone: away ? 'away' : st.condition < BROKEN ? 'bad' : st.condition < 0.85 ? 'worn' : 'ok',
          cost: kc(cost),
          canRepair: !away && st.condition < 0.99 && this.career.money >= cost,
        };
      }),
      insured: !!this.career.insured,
      note: `V dodávce ${loaded} ${loaded === 1 ? 'věc' : loaded >= 2 && loaded <= 4 ? 'věci' : 'věcí'}. Vybavení je ve skladu vedle, nakládá se zadními dveřmi dodávky.`,
    };
  }

  private officeAction(id: string): void {
    const [cmd, arg] = id.split(':');
    if (cmd === 'pick') {
      this.officeSel = arg;
      this.sfx.click();
      return;
    }
    if (cmd === 'redo') {
      const run = this.jobs.get(arg);
      if (run) {
        this.jobs.set(arg, { spec: run.spec, status: 'nova' });
        this.persist();
      }
      this.sfx.click();
      return;
    }
    if (cmd === 'endDay') return this.endDay();
    if (cmd === 'repair') return this.sendToRepair(arg as EquipId);
    if (cmd === 'process') return this.openProcessing(arg);
    if (cmd === 'insure') {
      if (this.career.insured) return;
      if (this.career.money < INSURANCE) return void this.bus.emit('toast', { text: `Pojištění stojí ${kc(INSURANCE)}.`, tone: 'warn' });
      this.career.money -= INSURANCE;
      this.career.insured = true;
      this.persist();
      this.sfx.success();
      this.bus.emit('toast', { text: 'Vybavení pojištěno: každá oprava tě stojí nejvýš 2 000 Kč spoluúčasti.' });
      return;
    }
    if (cmd === 'buy') {
      const u = UPGRADES.find((x) => x.id === arg);
      if (!u || this.hasUpgrade(u.id) || this.career.money < u.price) return;
      this.career.money -= u.price;
      this.career.upgrades = [...(this.career.upgrades ?? []), u.id];
      this.applyUpgrades();
      this.persist();
      this.sfx.success();
      this.bus.emit('toast', { text: `Koupeno: ${u.name}. ${u.desc}` });
      return;
    }
    this.tabletAction(id); // accept / open sdílí logiku s tabletem
    this.persist();
  }

  private openCargo(): void {
    const spec = this.activeJobId ? this.jobs.get(this.activeJobId)?.spec : undefined;
    this.sfx.click();
    if (this.input.pointerLocked) document.exitPointerLock();
    this.cargoSheet.show({
      items: this.items.filter((i) => i.state === 'stored').map((i) => ({ id: i.id, name: this.itemName(i) })),
      kit: spec ? this.kitRows(spec) : [],
      jobTitle: spec?.title ?? null,
    });
  }

  /** Konec směny v kanceláři: souhrn dne, další den ráno. */
  private endDay(): void {
    if (this.world.location !== 'kancelar') return;
    const earned = this.dayEarned;
    const day = this.career.day;
    this.career.day++;
    this.weather = weatherForDay(this.career.day);
    this.syncRepairs();
    this.chargeOvernight();
    this.refreshOrders();
    this.dayEarned = 0;
    this.clockMin = 7 * 60 + 30;
    this.persist();
    this.officeScreen.hide();
    this.sfx.success();
    this.bus.emit('toast', { text: `Konec směny ${day}: vyděláno ${kc(earned)}, účet ${kc(this.career.money)}. Den ${this.career.day}: ${weatherText(this.weather)}.` });
    this.weatherTip();
  }

  // ================================================================ tablet

  private openTablet(): void {
    if (!this.started || this.tablet.isOpen || this.traveling) return;
    this.hud.closeInspect();
    this.sfx.click();
    if (this.input.pointerLocked) document.exitPointerLock();
    this.hud.setLockHint(false);
    this.showBoard = !this.activeJobId;
    this.tablet.showTab('job');
    this.tablet.show();
  }

  private tabletAction(id: string): void {
    const [cmd, arg] = id.split(':');
    this.sfx.click();
    switch (cmd) {
      case 'accept': {
        const run = this.jobs.get(arg);
        if (!run || !this.jobUnlocked(run.spec)) return;
        this.startJob(run);
        this.activeJobId = arg;
        this.showBoard = false;
        this.persist();
        const here = run.spec.location === this.world.location;
        this.bus.emit('toast', { text: here ? `Zakázka převzata: ${run.spec.title}` : `Zakázka je v lokalitě ${LOCATIONS[run.spec.location].short}. Naložte věci a jeďte.` });
        break;
      }
      case 'open':
        this.activeJobId = arg;
        this.showBoard = false;
        break;
      case 'board':
        this.showBoard = true;
        break;
      case 'select':
        this.selectedTarget = arg;
        break;
      case 'report': {
        const run = this.activeRun();
        const mark = this.world.marks.find((m) => m.id === arg);
        if (run?.recon && mark && this.distanceTo(mark) <= REPORT_RADIUS && run.recon.reportMissing(arg)) {
          this.bus.emit('toast', { text: `Bod ${mark.number} nahlášen jako nenalezený`, tone: 'warn' });
        }
        break;
      }
      case 'submit':
        this.submitJob();
        break;
      case 'depart':
        this.depart(arg as LocationId, false);
        break;
      case 'departForce':
        this.depart(arg as LocationId, true);
        break;
      case 'showmap': {
        const t = this.goalTarget();
        if (t) this.tablet.focus(t.x, t.z);
        break;
      }
      case 'lv-reset': {
        const run = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
        if (run?.level) run.level = new LevelLine(run.level.startId, run.level.startLabel, run.level.startH);
        break;
      }
      case 'fs-toggle':
      case 'fs-accept':
      case 'fs-reset':
      case 'st-reorient':
        this.stationAction(cmd, arg);
        break;
    }
  }

  private startJob(run: JobRun): void {
    if (run.status !== 'nova') return;
    run.status = 'aktivni';
    run.firstPoint = this.log.points.length;
    const w = this.worldOf(run.spec.location);
    if (run.spec.type === 'rekognoskace') run.recon = new ReconTask(run.spec.reconMarks ?? []);
    if (run.spec.type === 'vytyceni') run.stake = new StakeoutTask(designTargets(run.spec, w), run.spec.tolerance.xy);
    if (run.spec.type === 'nivelace') {
      const nz = w.marks.find((m) => m.id === run.spec.levelFrom);
      if (nz) run.level = new LevelLine(nz.id, nz.number, nz.catalog.H);
    }
    if (run.spec.type === 'polohopis') {
      const ids = run.spec.featureIds;
      run.mapping = new MappingTask(w.features.filter((f) => (ids ? ids.includes(f.id) : run.spec.featureCodes?.includes(f.code))));
    }
  }

  private jobComplete(run: JobRun): boolean {
    if (run.level) return run.level.closure !== null && run.level.heights.points.has(run.spec.levelTo ?? '');
    return !!(run.recon?.complete || run.stake?.complete || run.mapping?.complete);
  }

  /** Protokol po odevzdání: hlavička, tabulka bodů, verdikt, odměna. */
  private buildProtocol(run: JobRun, ok: boolean, text: string, pay: number): ProtocolView {
    const spec = run.spec;
    const w = this.worldOf(spec.location);
    const cm = (m: number): string => (m * 100).toFixed(1).replace('.', ',');
    const f4 = (v: number): string => v.toFixed(4).replace('.', ',');
    const tolTxt = spec.type === 'nivelace' ? 'uzávěr 20 mm·√L' : spec.type === 'vytyceni' ? `${cm(spec.tolerance.xy)} cm` : spec.type === 'polohopis' ? 'identifikace prvku 15 cm' : '—';
    const meta = [
      `Objednatel: ${spec.client}`,
      `Lokalita: ${LOCATIONS[spec.location].name}`,
      `Den ${this.career.day}, ${clockText(this.clockMin)}`,
      `Počasí: ${weatherText(this.weather)}`,
      `Metoda: ${JOB_TYPE_NAME[spec.type]}`,
      `Tolerance: ${tolTxt}`,
    ];
    let headers: string[] = [];
    let rows: ProtocolView['rows'] = [];
    if (run.recon) {
      headers = ['Bod', 'Typ', 'Stav', 'Hodnocení'];
      rows = run.recon.entries.map((e) => {
        const m = w.marks.find((x) => x.id === e.markId);
        const wrong = e.status === 'reportedMissing' && m?.condition !== 'missing';
        return {
          cells: [m?.number ?? e.markId, m ? MARK_TYPE_SHORT[m.type] : '', e.status === 'found' ? 'nalezen' : e.status === 'reportedMissing' ? 'nenalezen' : '—', wrong ? '✗ v terénu je' : '✓'],
          ok: !wrong,
        };
      });
    } else if (run.stake) {
      headers = ['Bod', 'Stabilizace', 'Odchylka [cm]', 'Mez [cm]', 'Výsledek'];
      rows = run.stake.evaluate().rows.map((r) => ({
        cells: [r.id, run.stake?.status(r.id) === 'verified' ? 'dochovaný znak' : 'dřevěný kolík', Number.isFinite(r.dev) ? cm(r.dev) : '—', cm(run.stake?.tolerance ?? 0), r.ok ? '✓' : '✗'],
        ok: r.ok,
      }));
    } else if (run.mapping) {
      headers = ['Prvek', 'Kód', 'Číslo bodu', 'Výsledek'];
      rows = run.mapping.required.map((f) => {
        const pid = run.mapping?.found.get(f.id);
        return { cells: [f.label, CODES.find((c) => c.code === f.code)?.label ?? f.code, pid ?? '—', pid ? '✓' : '✗'], ok: !!pid };
      });
    } else if (run.level) {
      headers = ['Sestava', 'Zadní', 'Přední', 'Δh [m]', 'Záměry [m]'];
      rows = run.level.sets.map((s, i) => ({
        cells: [
          String(i + 1),
          `${s.back?.pointLabel ?? '?'} ${s.back ? f4(s.back.reading) : ''}`,
          `${s.fore?.pointLabel ?? '?'} ${s.fore ? f4(s.fore.reading) : ''}`,
          s.back && s.fore ? f4(s.back.reading - s.fore.reading) : '—',
          s.back && s.fore ? `${s.back.dist.toFixed(0)} / ${s.fore.dist.toFixed(0)}` : '—',
        ],
        ok: s.back && s.fore ? Math.abs(s.back.dist - s.fore.dist) <= 5 : null,
      }));
    }
    return {
      title: spec.title,
      meta,
      headers,
      rows,
      verdict: run.stake
        ? ok
          ? 'Vyhovuje: všechny body jsou v toleranci.'
          : (() => {
              const bad = rows.filter((r) => r.ok === false).length;
              return `Nevyhovuje: ${bad} ${bad === 1 ? 'bod je' : bad <= 4 ? 'body jsou' : 'bodů je'} mimo toleranci. Objednatel chce opravu.`;
            })()
        : `${ok ? 'Vyhovuje.' : 'Nevyhovuje, objednatel chce opravu.'} ${text}`,
      ok,
      pay: kc(pay),
      bonus:
        [
          this.lastBonus ? `Bonus za přesnost: +${kc(this.lastBonus)} (práce výrazně lepší než tolerance)` : '',
          this.lastExtra.urgent ? `Spěšná zakázka odevzdaná týž den: +${kc(this.lastExtra.urgent)}` : '',
          this.lastExtra.rank ? `Příplatek za stupeň ${this.lastExtra.rankName}: +${kc(this.lastExtra.rank)}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    };
  }

  private submitJob(office?: { badIncluded: number; missing: string[]; wrongOutput: boolean; outputLabel: string }): void {
    const run = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
    if (!run || !this.jobComplete(run)) return;
    const w = this.worldOf(run.spec.location);
    let ok = true;
    let text = '';
    if (run.recon) {
      const r = run.recon.takeResult(w.marks);
      ok = !!r && r.falseMissing.length === 0;
      text = r ? `Nalezeno ${r.found}, nenalezeno ${r.reportedMissing}.${r.falseMissing.length ? ` Chyba: ${r.falseMissing.join(', ')} v terénu je.` : ' Bez chyb.'}` : '';
    } else if (run.stake) {
      const e = run.stake.evaluate();
      ok = e.allOk;
      text = `Kontrolní zaměření: ${e.rows.map((r) => `${r.id} ${(r.dev * 100).toFixed(1).replace('.', ',')} cm`).join(', ')}.${ok ? ' Vše v toleranci.' : ' Některé body jsou mimo toleranci.'}`;
    } else if (run.level) {
      const cl = run.level.closure ?? 0;
      const lim = closureLimit(run.level.heights.length);
      const target = w.features.find((f) => f.id === run.spec.levelTo);
      const h = run.level.heights.points.get(run.spec.levelTo ?? '')?.H ?? 0;
      const err = target ? h - w.frame.toSjtsk(target.pos).H : 0;
      const cont = run.level.continuityError === null;
      ok = Math.abs(cl) <= lim && Math.abs(err) <= run.spec.tolerance.xy && cont;
      const f = mmTxt;
      text = `${(run.spec.levelTo ?? '').toUpperCase()} ${h.toFixed(3).replace('.', ',')} m (kontrola ${f(err)} mm), uzávěr ${f(cl)} mm při mezi ${f(lim)} mm.${cont ? '' : ' Pořad nenavazuje: lať se mezi záměrami přesunula.'}${ok ? ' V pořádku.' : ' Nevyhovuje.'}`;
    } else if (run.mapping) {
      ok = run.mapping.wrongCode === 0;
      text = `Zaměřeno ${run.mapping.found.size} ${run.mapping.found.size === 1 ? "prvek" : run.mapping.found.size <= 4 && run.mapping.found.size > 0 ? "prvky" : "prvků"}.${run.mapping.wrongCode ? ` Chybně kódovaná měření: ${run.mapping.wrongCode}.` : ' Kódy v pořádku.'}`;
    }
    // Měření GNSS musí být ověřené připojením na bod bodového pole.
    if (run.spec.kit.includes('gnssRover') && run.spec.type !== 'rekognoskace') {
      const c = run.check;
      if (!c) {
        ok = false;
        text += ' Chybí kontrolní měření na bodu bodového pole: připojení do S-JTSK není ověřené.';
      } else if (c.dPos > CHECK_TOL.xy * 2 || Math.abs(c.dH) > CHECK_TOL.h * 2) {
        ok = false;
        text += ` Kontrolní měření na bodu ${c.mark} nesedí (poloha ${(c.dPos * 100).toFixed(1).replace('.', ',')} cm, výška ${(c.dH * 100).toFixed(1).replace('.', ',')} cm): chyba v nastavení kontroleru.`;
      } else text += ` Kontrola na bodu ${c.mark}: ${(c.dPos * 100).toFixed(1).replace('.', ',')} cm.`;
    }
    // Kancelářské zpracování: co objednatel dostal.
    if (office) {
      if (office.missing.length) {
        ok = false;
        text += ` Chybí prvky (měření vyřazeno): ${office.missing.join(', ')}.`;
      }
      if (office.badIncluded) {
        ok = false;
        text += ` Ve výsledku ${office.badIncluded === 1 ? 'je 1 nespolehlivé měření' : `je ${office.badIncluded} nespolehlivých měření`} (FLOAT nebo mimo toleranci) – objednatel reklamuje.`;
      }
      if (office.wrongOutput) {
        ok = false;
        text += ` Objednatel dostal „${office.outputLabel}“, ale čekal jiný výstup.`;
      }
    }
    run.status = 'odevzdana';
    run.result = { ok, text };
    const pay = payFor(run.spec.pay, ok);
    // Bonus za přesnost: výrazně lepší než tolerance.
    let bonus = 0;
    if (ok && run.stake) {
      const e = run.stake.evaluate();
      if (e.rows.every((r) => r.dev <= run.spec.tolerance.xy / 2)) bonus = Math.round((run.spec.pay * 0.2) / 100) * 100;
    } else if (ok && run.level) {
      const cl = Math.abs(run.level.closure ?? 1);
      if (cl <= closureLimit(run.level.heights.length) / 3) bonus = Math.round((run.spec.pay * 0.2) / 100) * 100;
    } else if (ok && run.mapping && run.mapping.wrongCode === 0) bonus = Math.round((run.spec.pay * 0.1) / 100) * 100;
    this.lastBonus = bonus;
    // Opotřebení použitého vybavení (v dešti bez deštníku víc).
    const wet = this.weather.rain > 0.5 && !this.hasUpgrade('destnik');
    for (const k of run.spec.kit) {
      const id = equipOf(k);
      if (id) this.damage(id, WEAR_PER_JOB * (wet && (id === 'ts' || id === 'level') ? 2.5 : 1), false);
    }
    const rankBefore = rankIndex(this.career);
    const extra = extraPay(run.spec.pay, ok, RANKS[rankBefore], run.spec.id === this.urgentToday());
    this.lastExtra = { ...extra, rankName: RANKS[rankBefore].name };
    if (extra.urgent) this.career.urgentDone = this.career.day;
    this.career.money += pay + bonus + extra.rank + extra.urgent;
    this.dayEarned += pay + bonus + extra.rank + extra.urgent;
    this.career.stats.okJobs = okJobs(this.career) + (ok ? 1 : 0);
    this.career.stats.jobsDone++;
    const rankAfter = rankIndex(this.career);
    if (rankAfter > rankBefore) {
      const r = RANKS[rankAfter];
      const unlocked = this.allJobs().filter((j) => j.difficulty <= r.maxDifficulty && j.difficulty > RANKS[rankBefore].maxDifficulty).length;
      setTimeout(
        () =>
          this.bus.emit('toast', {
            text: `Povýšení: ${r.name}!${unlocked ? ` Dispečink ti teď svěří ${unlocked} ${unlocked === 1 ? 'těžší zakázku' : unlocked <= 4 ? 'těžší zakázky' : 'těžších zakázek'}.` : ''}${r.payBonus ? ` Příplatek ${Math.round(r.payBonus * 100)} % ke každé zakázce.` : ''}`,
          }),
        1800,
      );
    }
    this.career.jobs[run.spec.id] = { status: 'odevzdana', result: { ok, text, pay } };
    this.activeJobId = null;
    this.showBoard = true;
    this.sfx.success();
    this.bus.emit('toast', {
      text: `Odevzdáno: ${run.spec.title}. ${ok ? 'Objednatel je spokojený.' : 'Objednatel chce opravu.'} +${kc(pay)}`,
      tone: ok ? 'info' : 'warn',
    });
    this.persist();
    this.protocolScreen.show(this.buildProtocol(run, ok, text, pay));
  }

  private jobPanel(): JobPanel {
    const here = this.world.location;
    const departActions = (): JobPanel['actions'] => {
      if (!this.driving || Math.abs(this.world.vehicle.speed) > 0.5) return [];
      return (Object.keys(LOCATIONS) as LocationId[])
        .filter((l) => l !== here)
        .map((l) =>
          this.departConfirm === l
            ? { id: `departForce:${l}`, label: `Odjet i bez nich: ${LOCATIONS[l].short}` }
            : { id: `depart:${l}`, label: `Odjet: ${LOCATIONS[l].short} (${travelMinutes(here, l)} min)`, primary: true },
        );
    };
    const run = this.activeJobId ? this.jobs.get(this.activeJobId) : undefined;
    if (this.showBoard || !run) {
      return {
        title: 'Zakázky',
        brief: this.driving ? 'Jsi v dodávce. Odjet můžeš tlačítkem dole.' : 'Převezmi zakázku. Do jiné lokality dojedeš dodávkou.',
        rows: [...this.allJobs()].sort((a, b) => Number(!this.jobUnlocked(a)) - Number(!this.jobUnlocked(b))).map((spec) => {
          const r = this.jobs.get(spec.id) as JobRun;
          const far = spec.location !== here ? `, jízda ${travelMinutes(here, spec.location)} min` : ', tady';
          const locked = !this.jobUnlocked(spec) && r.status !== 'aktivni';
          const status = locked ? 'Zamčeno' : r.status === 'nova' ? (spec.id === this.urgentToday() ? 'Spěchá' : 'Nová') : r.status === 'aktivni' ? 'Rozpracovaná' : r.result?.ok ? 'Odevzdaná' : 'K opravě';
          const tone: PanelRow['tone'] = r.status === 'odevzdana' ? (r.result?.ok ? 'ok' : 'bad') : r.status === 'aktivni' ? 'active' : 'pending';
          return {
            key: spec.id,
            title: spec.title,
            subtitle: locked ? `Od stupně ${rankFor(spec.difficulty).name}` : `${JOB_TYPE_NAME[spec.type]}, ${LOCATIONS[spec.location].short}${far}`,
            status,
            tone,
            button: locked ? undefined : r.status === 'nova' ? { id: `accept:${spec.id}`, label: 'Převzít' } : r.status === 'aktivni' ? { id: `open:${spec.id}`, label: 'Otevřít' } : undefined,
          };
        }),
        footer: [...this.jobs.values()]
          .filter((r) => r.result)
          .map((r) => `${r.spec.title}: ${r.result?.text}`)
          .join(' '),
        actions: departActions(),
      };
    }

    const spec = run.spec;
    const elsewhere = spec.location !== here;
    const rows: PanelRow[] = [];
    let footer = '';
    const w = this.worldOf(spec.location);
    if (run.recon) {
      const byId = new Map(w.marks.map((m) => [m.id, m]));
      for (const e of run.recon.entries) {
        const m = byId.get(e.markId);
        const d = m && !elsewhere ? this.distanceTo(m) : NaN;
        rows.push({
          key: e.markId,
          title: m?.number ?? e.markId,
          subtitle: `${m ? MARK_TYPE_SHORT[m.type] : ''}${Number.isFinite(d) ? `, ${Math.round(d)} m` : ''}`,
          status: e.status === 'pending' ? 'Čeká' : e.status === 'found' ? 'Nalezen' : 'Nenalezen',
          tone: e.status === 'pending' ? 'pending' : e.status === 'found' ? 'ok' : 'bad',
          button: e.status === 'pending' && Number.isFinite(d) && d <= REPORT_RADIUS ? { id: `report:${e.markId}`, label: 'Nahlásit jako nenalezený' } : undefined,
        });
      }
      footer = `Vyřízeno ${run.recon.resolvedCount} z ${run.recon.entries.length}. Bod ověříš prohlídkou nebo měřením roverem.`;
    }
    if (run.stake) {
      const cur = this.currentTarget();
      for (const t of run.stake.targets) {
        const s = run.stake.status(t.id);
        const d = elsewhere ? NaN : Math.hypot(t.world.x - this.player.pos.x, t.world.z - this.player.pos.z);
        rows.push({
          key: t.id,
          title: t.id,
          subtitle: `${t.existingMarkId ? 'dochovaný znak, ověřit' : 'vytyčit kolíkem'}${Number.isFinite(d) ? `, ${Math.round(d)} m` : ''}`,
          status: s === 'pending' ? (cur?.id === t.id ? 'Naviguji' : 'Čeká') : s === 'staked' ? 'Kolík' : 'Ověřeno',
          tone: s !== 'pending' ? 'ok' : cur?.id === t.id ? 'active' : 'pending',
          button: s === 'pending' && cur?.id !== t.id && !elsewhere ? { id: `select:${t.id}`, label: 'Navigovat sem' } : undefined,
        });
      }
      footer = `Hotovo ${run.stake.doneCount} z ${run.stake.targets.length}. S GNSS roverem v ruce tě kontroler navede na bod.`;
    }
    if (run.mapping) {
      const groups = new Map<string, { label: string; total: number; found: number }>();
      for (const f of run.mapping.required) {
        const label = f.code === 'VPUST' ? 'Uliční vpusti' : f.code === 'ROH_BUDOVY' ? 'Rohy trafostanice' : f.code;
        const g = groups.get(f.code) ?? { label, total: 0, found: 0 };
        g.total++;
        if (run.mapping.found.has(f.id)) g.found++;
        groups.set(f.code, g);
      }
      for (const [code, g] of groups) {
        rows.push({ key: code, title: g.label, subtitle: `kód ${CODES.find((c) => c.code === code)?.label ?? code}`, status: `${g.found} z ${g.total}`, tone: g.found === g.total ? 'ok' : 'pending' });
      }
      footer = `${spec.requireStation ? 'Měř totální stanicí: orientace na hranol, rohy bez hranolu, kód Roh budovy.' : 'Kód měněj růžovým tlačítkem v panelu GNSS.'}${run.mapping.wrongCode ? ` Chybně kódováno: ${run.mapping.wrongCode}.` : ''}`;
    }
    if (run.level) {
      const hs = run.level.heights;
      const f4 = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(4).replace('.', ','));
      run.level.sets.forEach((st, i) => {
        rows.push({
          key: `s${i}`,
          title: `Sestava ${i + 1}`,
          subtitle: `Z ${st.back?.pointLabel ?? '?'} ${f4(st.back?.reading)}, P ${st.fore?.pointLabel ?? '…'} ${f4(st.fore?.reading)}`,
          status: st.back && st.fore ? `${st.back.reading - st.fore.reading >= 0 ? '+' : ''}${f4(st.back.reading - st.fore.reading).replace('-', '−')}` : 'rozměřeno',
          tone: st.back && st.fore ? (Math.abs(st.back.dist - st.fore.dist) > 5 ? 'bad' : 'ok') : 'active',
        });
      });
      const vb = hs.points.get(spec.levelTo ?? '');
      const cl = run.level.closure;
      const toL = (spec.levelTo ?? '').toUpperCase();
      footer = `${vb ? `${toL} ${vb.H.toFixed(4).replace('.', ',')} m. ` : ''}${cl !== null ? `Uzávěr ${mmTxt(cl)} mm, mez ${(closureLimit(hs.length) * 1000).toFixed(1).replace('.', ',')} mm. ` : ''}Postup: lať na ${run.level.startLabel}, nivelák doprostřed, zadní záměra, lať na ${toL}, přední. Pak nivelák jinam a zpět.`;
    }
    if (elsewhere) footer = `Zakázka je v lokalitě ${LOCATIONS[spec.location].name}. Naložte vybavení do dodávky a jeďte. ${footer}`;
    const actions: JobPanel['actions'] = [];
    if (this.jobComplete(run) && !elsewhere) footer = `Hotovo v terénu! Sbal vybavení, jeď do kanceláře a data zpracuj na počítači (dispečink → Zpracovat data). ${footer}`;
    if (run.level && run.level.sets.length) actions.push({ id: 'lv-reset', label: 'Začít pořad znovu' });
    actions.push({ id: 'board', label: 'Všechny zakázky' });
    actions.push(...departActions());
    if (!elsewhere && this.goalTarget()) actions.unshift({ id: 'showmap', label: 'Ukázat cíl na mapě' });
    return { title: spec.title, subtitle: `${spec.client} · ${LOCATIONS[spec.location].name}`, steps: this.jobSteps(run), brief: spec.brief, rows, footer, actions };
  }

  private pointRow(p: MeasuredPoint): PointRow {
    const cm = (v: number): string => (v * 100).toFixed(1).replace('.', ',');
    const place = p.location !== this.world.location ? ` (${LOCATIONS[p.location as LocationId]?.short ?? ''})` : '';
    if (p.dev) {
      const dxy = Math.hypot(p.dev.dY, p.dev.dX);
      const good = dxy <= CHECK_TOL.xy && Math.abs(p.dev.dH) <= CHECK_TOL.h;
      return {
        id: p.id,
        solution: p.solution,
        main: `Kontrola na bodě ${p.markNumber}${place}: ${good ? 'v toleranci' : 'mimo toleranci'}`,
        detail: `ΔY ${mm(p.dev.dY)}, ΔX ${mm(p.dev.dX)}, ΔH ${mm(p.dev.dH)} mm`,
        good,
      };
    }
    const code = CODES.find((c) => c.code === p.code)?.label ?? p.code;
    return {
      id: p.id,
      solution: p.solution,
      main: `${code}${place}: Y ${p.Y.toFixed(2)}, X ${p.X.toFixed(2)}, H ${p.Z.toFixed(2)}`,
      detail: `σ poloha ${cm(p.sigmaXY)} cm, výška ${cm(p.sigmaZ)} cm`,
      good: null,
    };
  }

  private tabletState(): TabletState {
    const run = this.activeRun();
    const st = run?.stake;
    const cur = this.currentTarget();
    const v = this.world.vehicle;
    const c = this.connected();
    return {
      place: LOCATIONS[this.world.location].name,
      clock: clockText(this.clockMin),
      bar: {
        day: `Den ${this.career.day}, ${this.weather.label} ${this.weather.temp} °C`,
        money: kc(this.career.money),
        gnss: this.gnss.on ? `${SOLUTION_LABEL[this.gnss.solution]} ${this.gnss.sats}` : null,
        radio: c ? `${{ off: 'vyp.', search: 'hledá', locked: 'zámek', lost: 'ztráta' }[c.link.state]} · stanice ▮${Math.round(this.bat.ts.main)} %` : null,
        battery: clamp(100 - (this.clockMin - (7 * 60 + 30)) / 6.5, 3, 100), // tablet vydrží zhruba celou směnu
      },
      job: this.jobPanel(),
      station: this.stationPanel(),
      showStation: !!this.connected(),
      points: this.log.points.map((p) => this.pointRow(p)),
      overlay: {
        player: this.driving ? { x: v.x, z: v.z, yaw: v.yaw } : { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw },
        status: (id) => run?.recon?.status(id) ?? null,
        points: this.log.points
          .filter((p) => p.location === this.world.location)
          .map((p) => {
            const w = this.world.frame.toWorld({ Y: p.Y, X: p.X, H: p.Z });
            return { id: p.id, x: w.x, z: w.z };
          }),
        design: st ? st.targets.map((t) => ({ id: t.id, x: t.world.x, z: t.world.z, done: st.status(t.id) !== 'pending', selected: cur?.id === t.id })) : [],
        stakes: this.stakes.filter((s) => s.location === this.world.location).map((s) => ({ x: s.pos.x, z: s.pos.z })),
        vehicle: { x: v.x, z: v.z, yaw: v.yaw },
        station: (() => {
          const c = this.connected();
          if (!c) return null;
          const p = c.link.state === 'locked' ? this.prismPosition() : null;
          return { x: c.ts.center.x, z: c.ts.center.z, locked: !!p, px: p?.x ?? 0, pz: p?.z ?? 0 };
        })(),
      },
    };
  }

  // ================================================================ ruce

  private selectHand(hand: Hand): void {
    if (!this.started) return;
    this.hands.setActive(hand);
    this.sfx.click();
    this.refreshHands();
  }

  private pickUp(item: WorldItem): void {
    if (item.kind === 'tripod' && item.mounted) {
      this.bus.emit('toast', { text: 'Stanici na stativu nepřenášej – spadne a rozbije se. Nejdřív ji sundej do kufru.', tone: 'warn' });
      return;
    }
    item.secured = false;
    const hand = this.hands.put(item.id);
    if (!hand) return;
    if (this.helper?.carryId === item.id) {
      this.helper.carryId = null;
      if (this.helper.state === 'hold') this.helper.wait();
    }
    if (item.kind === 'tripod') {
      item.mounted = false;
      this.setups.delete(item.id);
      this.dropStation(item.id);
    }
    item.state = 'held';
    item.hand = hand;
    if ((item.kind === 'gnssRover' || item.kind === 'prismPole') && !this.poleHintShown) {
      this.poleHintShown = true;
      setTimeout(
        () =>
          this.bus.emit('toast', {
            text: 'Výtyčka se v ruce kývá. Bublinu libely vpravo táhni prstem do kroužku (klepnutí ji zhruba srovná). Když je mimo, měříš vedle.',
          }),
        1600,
      );
    }
    if (item.kind === 'gnssCase' && !this.gnssCaseHintShown) {
      this.gnssCaseHintShown = true;
      setTimeout(
        () =>
          this.bus.emit('toast', {
            text: 'V kufru je přijímač GNSS a kontroler. Výtyčku nes zvlášť. Na místě kufr polož, vezmi výtyčku, zamiř na kufr a sestav rover.',
          }),
        1600,
      );
    }
    item.overMarkId = undefined;
    navigator.vibrate?.(15);
    this.sfx.pickup();
    this.bus.emit('toast', { text: `${this.itemName(item)} v ${hand === 'right' ? 'pravé' : 'levé'} ruce` });
    this.refreshHands();
  }

  private drop(): void {
    const id = this.hands.release(this.hands.active);
    const item = id ? this.items.find((i) => i.id === id) : undefined;
    if (!item) {
      this.bus.emit('toast', { text: 'V aktivní ruce nic není.', tone: 'warn' });
      return;
    }
    const f = lookDirection(this.player.yaw, 0);
    const p = { x: this.player.pos.x + f.x * 1.0, z: this.player.pos.z + f.z * 1.0 };
    const y = this.world.heightmap.heightAt(p.x, p.z);
    this.world.resolveCircle(p, 0.35, y - 1, y + 2);
    item.pos = { x: p.x, y: this.world.heightmap.heightAt(p.x, p.z), z: p.z };
    item.yaw = this.player.yaw;
    item.state = 'ground';
    item.location = this.world.location;
    item.hand = null;
    this.sfx.drop();
    // Upuštěno za chůze = pád na zem. Kufr s přístrojem i sestavený rover to odnesou.
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
    const eq = equipOf(item.kind);
    const full = (item.kind === 'tsCase' || item.kind === 'gnssCase') && !item.empty;
    const fragile = full || (item.kind === 'gnssRover' && !!item.rig?.receiver) || item.kind === 'level' || item.kind === 'tripod';
    if (eq && fragile && speed > 1.2) {
      const hard = speed > 3;
      this.damage(eq, full ? dropDamage(eq, hard) * 0.4 : dropDamage(eq, hard), true);
      setTimeout(
        () =>
          this.bus.emit('toast', {
            text: `Upustil jsi ${ITEM_DEFS[item.kind].nameAcc} za ${hard ? 'běhu' : 'chůze'}! ${EQUIP_NAME[eq]}: ${stateLabel(this.cond(eq))} (${Math.round(this.cond(eq) * 100)} %). Věci pokládej vestoje.`,
            tone: 'warn',
          }),
        400,
      );
    }
    this.bus.emit('toast', { text: `${this.itemName(item)} položen${item.kind === 'prismPole' ? 'a' : ''}` });
    this.refreshHands();
  }

  private itemName(item: WorldItem): string {
    if (item.kind === 'gnssRover' && item.rig?.receiver) return 'GNSS rover';
    return (item.kind === 'tsCase' || item.kind === 'gnssCase') && item.empty ? 'Prázdný kufr' : ITEM_DEFS[item.kind].name;
  }

  private refreshHands(): void {
    const byId = (id: string | null): WorldItem | undefined => (id ? this.items.find((i) => i.id === id) : undefined);
    const name = (id: string | null): string | null => {
      const it = byId(id);
      if (!it) return null;
      if (it.kind === 'gnssRover' && it.rig?.receiver) return 'Rover';
      return (it.kind === 'tsCase' || it.kind === 'gnssCase') && it.empty ? 'Prázdný kufr' : ITEM_DEFS[it.kind].short;
    };
    const massOf = (it: WorldItem): number => {
      if (it.kind === 'tsCase' && it.empty) return 3;
      if (it.kind === 'gnssCase' && it.empty) return 2.3;
      if (it.kind === 'gnssRover') return ITEM_DEFS.gnssRover.massKg + (it.rig?.receiver ? 1.2 : 0) + (it.rig?.controller ? 0.7 : 0);
      return ITEM_DEFS[it.kind].massKg;
    };
    const mass = this.hands.heldIds().reduce((s, id) => {
      const it = byId(id);
      return it ? s + massOf(it) : s;
    }, 0);
    const P = CONFIG.player;
    this.player.loadFactor = clamp(1 - mass * P.massSlowdownPerKg, P.minLoadFactor, 1);
    this.hud.setHands({ left: name(this.hands.get('left')), right: name(this.hands.get('right')), active: this.hands.active, massKg: mass });
    // Přijímač běží, dokud je zapnutý a není zavřený v autě.
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    if (rover?.rig?.receiverOn && rover.state !== 'stored') this.gnss.powerOn();
    else this.gnss.powerOff();
    this.hud.setControllerButton(!!rover && rover.state === 'held' && !!rover.rig?.controller && rover.rig.controllerOn);
  }

  // ================================================================ smyčka

  private setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    this.hud.setTouchMode(on);
    this.hud.setLockHint(false);
    if (this.started) this.touch.setVisible(on);
  }

  private async enterFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o.lock?.('landscape');
    } catch {
      /* nepodporováno – nevadí */
    }
  }

  private beforeSteps(dt: number): void {
    const f = this.input.consume();
    this.updateGnss(dt);
    if (!this.started || this.traveling) return;
    const a = f.actions;
    if (a.has('debug')) this.hud.toggleFps();
    if (a.has('controller')) {
      if (this.ctrlScreen.isOpen) this.ctrlScreen.hide();
      else if (!this.modalOpen) this.openController();
    }
    if (a.has('map')) {
      if (this.tablet.isOpen) this.tablet.close();
      else if (!this.setupScreen.isOpen) this.openTablet();
    }
    if (this.scopeScreen.isOpen && this.scope) {
      if (a.has('use')) this.scopeMeasure(); // na klávesnici E měří, otáčí se tažením myší
    }
    if (this.modalOpen) {
      if (a.has('use') && this.hud.inspectOpen) this.hud.closeInspect();
      this.intent = { forward: 0, right: 0, sprint: false, jump: false };
      this.plan = null;
      return;
    }

    if (this.driving) {
      this.driveLook.yaw = clamp(this.driveLook.yaw - f.lookX, -2.4, 2.4);
      this.driveLook.pitch = clamp(this.driveLook.pitch - f.lookY, -0.9, 0.6);
      this.intent = { forward: f.forward, right: f.right, sprint: false, jump: false };
      this.plan = this.planAction();
      if (a.has('use') && this.plan?.available) this.plan.run?.();
      return;
    }

    this.player.look(f.lookX, f.lookY);
    if (a.has('crouch')) this.player.toggleCrouch();
    if (a.has('light')) this.bus.emit('toast', { text: this.flashlight.toggle() ? 'Baterka zapnutá' : 'Baterka vypnutá' });
    if (a.has('switch')) this.selectHand(this.hands.active === 'right' ? 'left' : 'right');
    if (a.has('drop')) this.drop();
    if (a.has('jump')) this.jumpQueued = true;
    let slow = 1;
    const pk = this.activeItem()?.kind;
    if (pk === 'gnssRover' || pk === 'prismPole') {
      // U cíle jemný krok: čím blíž bodu, tím pomaleji (přesné dostavení na centimetry).
      const t = this.currentTarget();
      let d = Infinity;
      if (t && this.navReading) d = Math.hypot(t.world.x - this.navReading.x, t.world.z - this.navReading.z);
      if (this.aim) {
        for (const m of this.world.marks) if (m.condition === 'ok') d = Math.min(d, Math.hypot(m.pos.x - this.aim.x, m.pos.z - this.aim.z) + 0.3);
        for (const fe of this.world.features) d = Math.min(d, Math.hypot(fe.pos.x - this.aim.x, fe.pos.z - this.aim.z) + 0.3);
      }
      slow = clamp((d / 1.5) ** 1.3, 0.012, 1);
      const moving = Math.hypot(f.forward, f.right) > 0.05;
      if (this.bipodTip && moving) {
        this.bipodTip = null;
        this.bus.emit('toast', { text: 'Dvojnožka složena, jdeš dál.' });
      }
    } else this.bipodTip = null;
    this.intent = { forward: f.forward * slow, right: f.right * slow, sprint: f.sprint && slow > 0.9, jump: false };
    this.precise = slow < 0.35; // u bodu bez setrvačnosti: pustíš joystick = stojíš

    const p = this.player.pos;
    const eye = { x: p.x, y: p.y + this.player.eyeHeight, z: p.z };
    const dir = lookDirection(this.player.yaw, this.player.pitch);
    this.interaction.update(eye, dir, this.world);
    this.aim = this.computeAim(eye, dir);
    const poleKind = this.activeItem()?.kind;
    if (this.bipodTip) {
      this.pole.tilt.x *= 0.85; // dvojnožka ji srovná a drží
      this.pole.tilt.z *= 0.85;
    } else if ((poleKind === 'gnssRover' || poleKind === 'prismPole') && !this.opts.steadyPole)
      this.pole.update(dt, Math.hypot(this.player.vel.x, this.player.vel.z), poleTremor(this.weather) * (this.precise ? 0.4 : 1));
    else this.pole.tilt = { x: 0, z: 0 };
    this.updateRobot(dt);
    this.updateNav(dt);
    this.plan = this.planAction();
    if (a.has('use') && this.plan?.available) {
      this.plan.run?.();
      this.plan = this.planAction();
    }
    this.touch.setToggles(this.flashlight.on, this.player.crouched, !!this.activeItem());
  }

  /** Čtení kontroleru při vytyčování: poloha hrotu s šumem podle aktuální přesnosti, 4× za sekundu. */
  private updateNav(dt: number): void {
    this.navTimer -= dt;
    const kind = this.activeItem()?.kind;
    const c = this.connected();
    const robot = kind === 'prismPole' && c?.link.state === 'locked' && c.ts.orientation !== null;
    const rover = kind === 'gnssRover' && this.gnss.solution !== 'none' && !this.roverBlocked();
    if ((!robot && !rover) || !this.aim || !this.currentTarget()) {
      this.navReading = null;
      return;
    }
    if (this.navTimer <= 0 || !this.navReading) {
      this.navTimer = 0.25;
      if (rover) {
        const off = this.hasUpgrade('imu') ? { x: 0, z: 0 } : this.pole.offset();
        const r = this.gnss.measure({ x: this.aim.x + off.x, y: this.aim.y, z: this.aim.z + off.z });
        // Kontroler porovnává zobrazené souřadnice s projektem – chybný systém = navigace jinam.
        const w = this.reportedWorld(r.pos);
        this.navReading = this.smoothNav({ x: w.x, z: w.z });
      } else if (c) {
        // Sledovací režim: stanice měří hranol (výtyčka se v ruce kývá ~3 mm) a počítá polohu hrotu.
        const off = this.pole.offset();
        const a = this.aim;
        const prism: Prism = { id: 'held', center: { x: a.x + off.x, y: a.y + 2, z: a.z + off.z }, foot: { ...a }, height: 2 };
        const d = { x: prism.center.x - c.ts.center.x, y: prism.center.y - c.ts.center.y, z: prism.center.z - c.ts.center.z };
        const l = Math.hypot(d.x, d.y, d.z);
        const r = c.ts.shoot({ x: d.x / l, y: d.y / l, z: d.z / l }, this.world, [prism], 'prism');
        const sj = r.ok ? c.ts.compute(r.shot) : null;
        if (sj) {
          const w = this.world.frame.toWorld(sj);
          this.navReading = this.smoothNav({ x: w.x, z: w.z });
        }
      }
    }
  }

  private updateGnss(dt: number): void {
    const rover = this.items.find((i) => i.kind === 'gnssRover');
    if (!rover || !this.gnss.on) {
      this.ctrl.correctionAge = 99;
      return;
    }
    if (rover.location !== this.world.location && rover.state !== 'held') return;
    this.ctrl.updateCorrections(dt, this.world.location, () => this.rng.next());
    const gc = this.cond('gnss');
    this.gnss.degrade = noiseFactor(gc);
    // Rozbitá anténa po pádu: RTK nevyřeší ambiguity.
    this.gnss.corrections = this.ctrl.correctionsOk && gc >= BROKEN ? { baseKm: this.ctrl.baseKm(this.world.location) } : null;
    const h = rover.rig?.height ?? 2;
    const base = rover.state === 'held' ? this.player.pos : rover.pos;
    const lift = rover.state === 'ground' ? 0.15 : h; // položená výtyčka: anténa u země
    this.gnss.update(dt, { x: base.x, y: base.y + lift, z: base.z }, this.world);
    this.updateObservation(dt);
  }

  private step(dt: number): void {
    if (!this.traveling) this.clockMin += dt * GAME_MIN_PER_SEC;
    if (this.started && !this.traveling) this.batteryTick(dt * GAME_MIN_PER_SEC);
    if (this.started && !this.traveling) this.windCheck(dt);
    if (this.started && !this.traveling && !this.helper.inVan) {
      const ev = this.helper.update(dt, this.world, this.player.pos);
      if (ev?.kind === 'arrived') this.helperArrived(ev.purpose);
    }
    this.syncHelperCarry();
    if (this.driving) {
      this.vehicle.step(dt, { throttle: this.intent.forward, steer: this.intent.right }, this.world);
      return;
    }
    this.intent.jump = this.jumpQueued;
    this.jumpQueued = false;
    this.player.step(dt, this.intent, this.world);
    if (this.precise && this.intent.forward === 0 && this.intent.right === 0) {
      this.player.vel.x = 0;
      this.player.vel.z = 0;
    }
    this.intent.jump = false;
  }

  private render(alpha: number, dt: number): void {
    const cam = this.gfx.camera;
    const v = this.world.vehicle;
    syncVehicle(this.vanMesh, v);
    const lv = this.scope?.kind === 'level' ? this.items.find((i) => i.id === this.scope?.itemId) : undefined;
    const ts = lv ? { center: this.levelInstrument(lv).center } : this.scope ? this.stations.get(this.scope.itemId) : undefined;
    if (lv && this.scope) lv.stationYaw = this.scope.yaw;
    if (this.scope && ts) {
      cam.position.set(ts.center.x, ts.center.y, ts.center.z);
      cam.rotation.set(this.scope.pitch, this.scope.yaw, 0);
      const fov = this.scopeFov();
      if (cam.fov !== fov) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
      this.eye.x = ts.center.x;
      this.eye.y = ts.center.y;
      this.eye.z = ts.center.z;
      const vm = this.scopeViewModel();
      if (vm) this.scopeScreen.update(vm);
    } else if (this.driving) {
      const e = vanLocal(v, DRIVER_EYE.x, DRIVER_EYE.y, DRIVER_EYE.z);
      cam.position.set(e.x, e.y + Math.sin(this.clockMin * 40) * 0.004 * Math.min(1, Math.abs(v.speed) / 5), e.z);
      cam.rotation.set(this.driveLook.pitch + v.pitch, v.yaw + this.driveLook.yaw, 0);
      this.eye.x = e.x;
      this.eye.y = e.y;
      this.eye.z = e.z;
      this.sfx.setEngine(v.speed);
      this.hud.setDrive(v.speed * 3.6);
    } else {
      this.player.eyePosition(alpha, this.eye);
      cam.position.set(this.eye.x, this.eye.y, this.eye.z);
      cam.rotation.set(this.player.pitch, this.player.yaw, 0);
    }
    this.sky.follow(this.eye);
    this.daylightT -= dt;
    if (this.daylightT <= 0) {
      this.daylightT = 1;
      const d = weatherize(daylight(this.clockMin), this.weather);
      this.gfx.setDaylight(d, 1);
      this.sky.setDaylight(d);
      this.clouds.setCover(this.weather.cloud, this.weather.rain);
      this.horizon.setHorizon(d.horizon);
      this.night = d.night;
    }
    if (this.started && !this.traveling) this.sfx.ambience(dt, this.world.location, this.night, this.driving || this.modalOpen, this.weather);
    this.rain.update(dt, this.eye, this.weather.rain);
    if (this.goalPoint && !this.scope && this.settings.guide) this.beacon.show(this.goalPoint.x, this.goalPoint.y, this.goalPoint.z, dt);
    else this.beacon.hide();
    this.horizon.follow(this.eye);
    this.birds.update(dt, this.eye, this.night < 0.5 && this.weather.rain === 0 && !this.scope);
    this.clouds.update(dt, this.eye, this.gfx.quality.drawDistance * 0.9);
    const hp = this.helper.pos;
    this.helperView.sync(hp, this.helper.body.yaw, this.helper.walkPhase, !this.helper.inVan, this.world.location === 'stavba', !!this.helper.carryId);
    this.grass.update(this.eye.x, this.eye.z);
    this.gfx.followSun(this.eye);
    this.itemsView.sync(this.items, this.world.location);
    this.stakesView.sync(this.stakes.filter((s) => s.location === this.world.location));

    const active = this.activeItem();
    const focus = this.interaction.focused;
    const focusIsItem = !!focus && (this.itemIds.has(focus.id) || focus.id.startsWith('van-'));
    const placing = !this.driving && active && active.kind !== 'tsCase' && !focusIsItem && !this.modalOpen && this.started;
    if (placing && this.aim) this.marker.show(this.aim.x, this.aim.y, this.aim.z, this.aim.valid || active.kind !== 'tripod', !!(this.aim.mark || this.aim.feature));
    else this.marker.hide();

    this.gfx.adapt(dt);
    this.autoQuality(dt);
    this.gfx.render();

    if (!this.driving && this.player.stepCount !== this.lastStep) {
      this.lastStep = this.player.stepCount;
      this.sfx.step(this.world.surfaceAt(this.player.pos.x, this.player.pos.z));
    }

    const plan = this.started && !this.modalOpen ? this.plan : null;
    this.hud.setPrompt(plan);
    if (this.hud.inspectOpen) this.touch.setAction('Zavřít', true);
    else this.touch.setAction(plan?.verb ?? null, plan?.available ?? false);
    if (this.tablet.isOpen) this.tablet.update(this.tabletState());
    if (this.officeScreen.isOpen) this.officeScreen.update(this.officeView());
    if (this.ctrlScreen.isOpen) this.ctrlScreen.update(this.controllerView());
    this.bench.update(dt);
    this.setupScreen.render();

    this.updateBubble(); // libela každý snímek – jinak by se nedala plynule srovnávat
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.updatePositionPanel();
      this.updateNavPanel();
      const tgt = this.settings.guide ? this.goalTarget() : null;
      let pointer: { angle: number; dist: number } | null = null;
      if (tgt) {
        const dx = tgt.x - this.player.pos.x;
        const dz = tgt.z - this.player.pos.z;
        const y = this.player.yaw;
        const fwd = dx * -Math.sin(y) + dz * -Math.cos(y);
        const rt = dx * Math.cos(y) + dz * -Math.sin(y);
        pointer = { angle: Math.atan2(rt, fwd), dist: Math.hypot(dx, dz) };
      }
      this.goalPoint = tgt && pointer && pointer.dist > 2.5 ? tgt : null;
      this.hud.setGoal(this.started && !this.modalOpen && this.settings.guide ? this.goalText() : null, pointer);
      this.hud.setFps(this.gfx.fps, this.gfx.currentPixelRatio);
    }
  }

  private updateBubble(): void {
    const kind = this.activeItem()?.kind;
    const imu = kind === 'gnssRover' && this.hasUpgrade('imu');
    if (this.driving || this.modalOpen || !this.started || (kind !== 'gnssRover' && kind !== 'prismPole') || imu) {
      this.hud.setBubble(null);
      this.hud.setBipod(null);
      return;
    }
    this.hud.setBipod(!!this.bipodTip);
    const y = this.player.yaw;
    const t = this.pole.tilt;
    const sx = t.x * Math.cos(y) - t.z * Math.sin(y);
    const sy = t.x * Math.sin(y) + t.z * Math.cos(y); // = −(t·f)
    const k = MAX_TILT;
    this.itemsView.setPoleTilt(sx, sy);
    let bx = -sx / k;
    let by = -sy / k;
    const l = Math.hypot(bx, by);
    if (l > 1) {
      bx /= l;
      by /= l;
    }
    this.hud.setBubble({ x: bx, y: by, inCircle: this.pole.inCircle });
  }

  private updateNavPanel(): void {
    const t = this.currentTarget();
    const r = this.navReading;
    if (this.driving || !t || !r) {
      this.hud.setNav(null);
      return;
    }
    const dx = t.world.x - r.x;
    const dz = t.world.z - r.z;
    const f = lookDirection(this.player.yaw, 0);
    const rt = { x: Math.cos(this.player.yaw), z: -Math.sin(this.player.yaw) };
    const tol = this.activeRun()?.stake?.tolerance ?? 0.02;
    const nav: NavView = {
      title: t.existingMarkId ? `Znak ${t.id}` : `Vytyčuji ${t.id}`,
      forward: dx * f.x + dz * f.z,
      right: dx * rt.x + dz * rt.z,
      dist: Math.hypot(dx, dz),
      close: Math.hypot(dx, dz) <= tol,
    };
    this.hud.setNav(nav);
  }

  /** Tablet na výtyčce: stav spojení se stanicí, živé Hz a Hd, poloha hrotu. */
  private updateTabletPanel(bearing: number): void {
    const c = this.connected();
    const label = { off: 'Odpojeno', search: 'Hledá', locked: 'Zamčeno', lost: 'Ztráta zámku' } as const;
    const oriented = !!c && c.ts.orientation !== null;
    let detail: string;
    if (!c) detail = 'Ustav stanici a potvrď Hotovo';
    else if (!c.ts.station && c.link.state === 'locked')
      detail = `Volné st.: ${this.resections.get(c.tripod.id)?.length ?? 0} bodů · hrot na známý bod`;
    else if (c.link.state === 'locked' && this.robotLive)
      detail = `Hz ${radToGon(this.robotLive.hz).toFixed(4).replace('.', ',')} · Hd ${this.robotLive.hd.toFixed(2).replace('.', ',')} m${oriented ? '' : ' · orientuj'}`;
    else if (c.link.state === 'search') detail = 'Stanice se otáčí…';
    else detail = 'Klepni na Hledat hranol';
    this.hud.setGnss({
      title: 'Totálka',
      solution: !c ? 'Bez stanice' : this.robotMeasure ? 'Měřím' : label[c.link.state],
      tone: c?.link.state === 'locked' ? 'fix' : c?.link.state === 'search' ? 'float' : 'bad',
      detail,
      last: this.lastMeasure,
    });
    this.hud.setCode(c ? CODES[this.codeIdx].label : null);
    const tip = this.aim ?? this.player.pos;
    const tracked = c?.link.state === 'locked' && oriented;
    this.hud.setPosition(this.world.frame.toSjtsk(tracked ? tip : this.player.pos), bearing, tracked ? 2 : 0);
  }

  private updatePositionPanel(): void {
    if (this.driving) {
      this.hud.setGnss(null);
      this.hud.setCode(null);
      this.hud.setPosition(this.world.frame.toSjtsk({ x: this.world.vehicle.x, y: this.world.vehicle.groundY, z: this.world.vehicle.z }), radToGon(this.world.frame.bearingOfDirection(lookDirection(this.world.vehicle.yaw, 0))));
      return;
    }
    const bearing = radToGon(this.world.frame.bearingOfDirection(lookDirection(this.player.yaw, 0)));
    const active = this.activeItem();
    if (active?.kind === 'prismPole') {
      this.updateTabletPanel(bearing);
      return;
    }
    const rig = active?.kind === 'gnssRover' ? active.rig : undefined;
    // Údaje z přijímače ukazuje jen kontroler, který je s ním spojený.
    if (active?.kind !== 'gnssRover' || !rig?.controllerOn || this.ctrl.bt !== RECEIVER_SERIAL || !this.ctrl.job) {
      this.hud.setGnss(null);
      this.hud.setCode(null);
      this.hud.setPosition(this.world.frame.toSjtsk(this.player.pos), bearing);
      return;
    }
    const g = this.gnss;
    const tip = this.aim ? { x: this.aim.x, y: this.aim.y, z: this.aim.z } : this.player.pos;
    const decimals = g.solution === 'fix' ? 2 : g.solution === 'float' ? 1 : 0;
    this.hud.setPosition(this.reportedSjtsk(tip), bearing, decimals);
    this.hud.setCode(CODES[this.codeIdx].label);
    const c = this.ctrl;
    const corr = !c.ntripOn ? 'bez korekcí' : c.correctionsOk ? `korekce ${Math.round(c.correctionAge)} s` : 'výpadek korekcí';
    const view: GnssView = {
      solution: this.obs ? `Měřím ${Math.floor(this.obs.t)}/${this.obs.need} s` : SOLUTION_LABEL[g.solution],
      tone: g.solution === 'fix' ? 'fix' : g.solution === 'float' ? 'float' : 'bad',
      detail:
        g.solution === 'none'
          ? `Hledám satelity (${g.sats})`
          : `Satelity ${g.sats}, PDOP ${g.pdop.toFixed(1).replace('.', ',')}, σ ${g.sigmaH < 0.1 ? `${Math.round(g.sigmaH * 1000)} mm` : `${g.sigmaH.toFixed(2).replace('.', ',')} m`}, ${corr}`,
      last: this.lastMeasure,
    };
    this.hud.setGnss(view);
  }
}

/** „1 bod“, „3 body“, „7 bodů“. */
function pointsCount(n: number): string {
  return `${n} ${n === 1 ? 'bod' : n >= 2 && n <= 4 ? 'body' : 'bodů'}`;
}
