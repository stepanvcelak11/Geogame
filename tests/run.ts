/** Testy čisté logiky: npm test (běží v Node, bez prohlížeče a bez three.js). */
import { CONFIG } from '../src/config';
import { DEG, lookDirection } from '../src/core/math';
import { bearing, radToGon, SjtskFrame } from '../src/geodesy/CoordinateSystem';
import { HandInventory } from '../src/player/HandInventory';
import { PlayerController } from '../src/player/PlayerController';
import { ColliderSet } from '../src/world/Colliders';
import { Heightmap } from '../src/world/Heightmap';
import { generateWorld } from '../src/world/WorldGen';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'OK  ' : 'CHYBA'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}
const near = (a: number, b: number, eps: number): boolean => Math.abs(a - b) <= eps;

const frame = new SjtskFrame(CONFIG.sjtsk.originY, CONFIG.sjtsk.originX, CONFIG.sjtsk.originH);

// --- Souřadnicový systém
{
  const p = { x: 12.34, y: 5.6, z: -78.9 };
  const back = frame.toWorld(frame.toSjtsk(p));
  check('S-JTSK tam a zpět', near(back.x, p.x, 1e-9) && near(back.y, p.y, 1e-9) && near(back.z, p.z, 1e-9));
  const g = (yaw: number): number => radToGon(frame.bearingOfDirection(lookDirection(yaw, 0)));
  check('pohled na sever = 200 gon', near(g(0), 200, 1e-9), g(0).toFixed(4));
  check('pohled na západ = 100 gon', near(g(Math.PI / 2), 100, 1e-9), g(Math.PI / 2).toFixed(4));
  check('pohled na jih = 0 gon', near(g(Math.PI) % 400, 0, 1e-9) || near(g(Math.PI), 400, 1e-9));
  const s = radToGon(bearing({ Y: 1000, X: 1000 }, { Y: 1100, X: 1100 }));
  check('směrník k JZ (+Y, +X) = 50 gon', near(s, 50, 1e-9), s.toFixed(4));
}

// --- Heightmapa: interpolace přesně podle triangulace meshe
{
  const hm = Heightmap.generate(8, 2, (x, z) => Math.sin(x * 0.7) * 3 + z * z * 0.1);
  let okV = true;
  for (let iz = 0; iz < hm.n; iz++)
    for (let ix = 0; ix < hm.n; ix++) okV &&= near(hm.heightAt(hm.vertexCoord(ix), hm.vertexCoord(iz)), hm.vertexHeight(ix, iz), 1e-5);
  check('heightAt ve vrcholech mříže', okV);
  const a = hm.heightAt(-4 + 1 - 1e-7, -4 + 1);
  const b = hm.heightAt(-4 + 1 + 1e-7, -4 + 1);
  check('spojitost přes úhlopříčku', near(a, b, 1e-4));
  const t = hm.raycast({ x: 0.3, y: 50, z: -0.7 }, { x: 0, y: -1, z: 0 }, 100);
  check('svislý paprsek trefí terén', t !== null && near(50 - t, hm.heightAt(0.3, -0.7), 0.001), `t=${t}`);
}

// --- Kolize
{
  const cs = new ColliderSet(8);
  cs.add({ kind: 'circle', x: 0, z: 0, r: 0.3, yMin: -1, yMax: 20, tag: 'trunk' });
  cs.add({ kind: 'box', minX: 5, maxX: 7, minZ: -1, maxZ: 1, yMin: 0, yMax: 2, tag: 'vehicle' });
  const p = { x: 0.2, z: 0 };
  cs.resolveCircle(p, 0.35, 0, 1.8);
  check('vytlačení z kmene', near(Math.hypot(p.x, p.z), 0.65, 1e-9));
  const q = { x: 6, z: 0.8 };
  cs.resolveCircle(q, 0.35, 0, 1.8);
  check('vytlačení z auta', near(q.z, 1.35, 1e-9), `z=${q.z}`);
  const hit = cs.raycast({ x: -5, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 50);
  check('paprsek trefí kmen', hit !== null && near(hit.t, 4.7, 1e-9), `t=${hit?.t}`);
  const miss = cs.raycast({ x: -5, y: 25, z: 0 }, { x: 1, y: 0, z: 0 }, 50);
  check('paprsek nad stromem mine', miss === null);
}

// --- Svět
const world = generateWorld('stavba');
{
  const again = generateWorld('stavba');
  check('stejný seed = stejný svět', world.trees.length === again.trees.length && world.trees[5]?.x === again.trees[5]?.x);
  check('počet stromů', world.trees.length > 300, String(world.trees.length));
  check('počet bodů', world.marks.length === 9);
  check('chybějící a poškozený bod', world.marks.filter((m) => m.condition === 'missing').length === 1 && world.marks.filter((m) => m.condition === 'damaged').length === 1);
  const nz = world.marks.find((m) => m.type === 'NZ');
  check('nivelační značka má výšku na mm', !!nz && Math.abs(nz.catalog.H * 1000 - Math.round(nz.catalog.H * 1000)) < 1e-6, nz?.catalog.H.toFixed(3));
  const r = world.road;
  check('ulice je v terénu rovná napříč', Math.abs(world.heightmap.heightAt(0, r.z - r.halfWidth) - world.heightmap.heightAt(0, r.z + r.halfWidth)) < 0.02);
  check('povrch: ulice / staveniště / tráva', world.surfaceAt(0, r.z) === 'road' && world.surfaceAt(0, 0) === 'site' && world.surfaceAt(0, -150) === 'grass');
  check('na silnici nerostou stromy', !world.trees.some((t) => Math.abs(t.z - r.z) < r.halfWidth + 1 && Math.abs(t.x) < r.xMax));
  let okCat = true;
  for (const m of world.marks) {
    const c = frame.toSjtsk(m.pos);
    okCat &&= near(c.Y, m.catalog.Y, 1e-6) && near(c.X, m.catalog.X, 1e-6) && near(c.H, m.catalog.H, 1e-6);
  }
  check('katalog bodů souhlasí se světem', okCat);
  const tb = world.marks.find((m) => m.type === 'TB');
  check('TB leží na kopci nad staveništěm', !!tb && tb.pos.y > world.heightmap.heightAt(0, 0), tb?.catalog.H.toFixed(2));
}

// --- Hráč
{
  const pl = new PlayerController(world.spawn, world);
  const idle = { forward: 0, right: 0, sprint: false, jump: false };
  for (let i = 0; i < 300; i++) pl.step(1 / 60, idle, world);
  check('stojící hráč zůstane na zemi', pl.grounded && near(pl.pos.y, world.heightmap.heightAt(pl.pos.x, pl.pos.z), 1e-6));

  pl.yaw = 0; // otočit na sever, na volnou plochu staveniště
  const start = { ...pl.pos };
  for (let i = 0; i < 120; i++) pl.step(1 / 60, { forward: 1, right: 0, sprint: false, jump: false }, world);
  const moved = Math.hypot(pl.pos.x - start.x, pl.pos.z - start.z);
  check('chůze vpřed ~3 m/s na sever', moved > 5 && moved < 6.5 && pl.pos.z < start.z, `${moved.toFixed(2)} m za 2 s`);

  // Skok
  pl.step(1 / 60, { forward: 0, right: 0, sprint: false, jump: true }, world);
  let maxUp = 0;
  const g0 = world.heightmap.heightAt(pl.pos.x, pl.pos.z);
  for (let i = 0; i < 90; i++) {
    pl.step(1 / 60, idle, world);
    maxUp = Math.max(maxUp, pl.pos.y - world.heightmap.heightAt(pl.pos.x, pl.pos.z));
  }
  check('skok ~0,9 m a dopad', maxUp > 0.7 && maxUp < 1.1 && pl.grounded, `max ${maxUp.toFixed(2)} m, g0 ${g0.toFixed(1)}`);

  // Náraz do auta: hráč jde z jihu na sever přímo na bok dodávky.
  const v = world.vehicle;
  const pv = new PlayerController({ x: v.x, z: v.z + 4, yaw: 0 }, world);
  for (let i = 0; i < 240; i++) pv.step(1 / 60, { forward: 1, right: 0, sprint: true, jump: false }, world);
  check('auto zastaví hráče', pv.pos.z >= v.z + v.width / 2 + CONFIG.player.radius - 1e-6, `z=${pv.pos.z.toFixed(3)}`);

  // Kmen: hráč nesmí projít stromem.
  const tree = world.trees.find((t) => world.heightmap.slopeAt(t.x, t.z) < 15 * DEG)!;
  const pt = new PlayerController({ x: tree.x, z: tree.z + 3, yaw: 0 }, world);
  let minD = Infinity;
  for (let i = 0; i < 240; i++) {
    pt.step(1 / 60, { forward: 1, right: 0, sprint: false, jump: false }, world);
    minD = Math.min(minD, Math.hypot(pt.pos.x - tree.x, pt.pos.z - tree.z));
  }
  // Trafostanice
  const b = world.building!;
  const pb = new PlayerController({ x: b.x + b.sizeX / 2 + 3, z: b.z, yaw: Math.PI / 2 }, world); // kladný yaw = doleva, tj. na západ ke zdi
  for (let i = 0; i < 180; i++) pb.step(1 / 60, { forward: 1, right: 0, sprint: false, jump: false }, world);
  check('budova zastaví hráče', pb.pos.x < b.x + b.sizeX / 2 + 1 && pb.pos.x >= b.x + b.sizeX / 2 + CONFIG.player.radius - 1e-6, `x=${pb.pos.x.toFixed(3)}`);
  check('kmen nejde projít', minD >= tree.trunkR + CONFIG.player.radius - 1e-6, `min ${minD.toFixed(3)} m`);
}

// --- Ruce
{
  const h = new HandInventory();
  check('první do aktivní (pravé)', h.put('a') === 'right' && h.activeItem() === 'a');
  check('druhý do volné levé a ta je aktivní', h.put('b') === 'left' && h.active === 'left');
  check('třetí se nevejde', h.put('c') === null);
  h.setActive('right');
  check('přepnutí aktivní ruky', h.activeItem() === 'a');
  check('položení z aktivní ruky', h.release(h.active) === 'a' && h.freeHand() === 'right');
}

// --- Rekognoskace
{
  const { ReconTask } = await import('../src/jobs/ReconTask');
  const t = new ReconTask(['PBPP-4001', 'PBPP-4002', 'ZhB-4021']);
  t.markFound('PBPP-4001');
  t.reportMissing('PBPP-4002');
  check('nedokončená rekognoskace nevrací výsledek', t.takeResult(world.marks) === null);
  t.reportMissing('ZhB-4021'); // chyba: bod existuje
  const res = t.takeResult(world.marks);
  check('vyhodnocení rekognoskace', !!res && res.found === 1 && res.reportedMissing === 2 && res.falseMissing.join() === '4021', JSON.stringify(res));
  check('výsledek jen jednou', t.takeResult(world.marks) === null);
}

// --- GNSS
{
  const { GnssReceiver } = await import('../src/gnss/GnssReceiver');
  const { Rng } = await import('../src/core/Rng');
  const ant = (x: number, z: number) => ({ x, y: world.heightmap.heightAt(x, z) + 2, z });
  const run = (x: number, z: number, secs: number) => {
    const g = new GnssReceiver(new Rng(7));
    g.powerOn();
    for (let t = 0; t < secs; t += 1 / 30) g.update(1 / 30, ant(x, z), world);
    return g;
  };
  const open = run(0, 0, 12);
  check('otevřené staveniště: FIX do 12 s', open.solution === 'fix' && open.sigmaH < 0.02, `${open.solution}, ${(open.sigmaH * 1000).toFixed(0)} mm`);
  const early = run(0, 0, 3);
  check('po 3 s ještě není FIX', early.solution !== 'fix', early.solution);
  let dense = world.trees[0];
  let bestN = 0;
  for (const t of world.trees) {
    const n = world.trees.filter((u) => (u.x - t.x) ** 2 + (u.z - t.z) ** 2 < 100).length;
    if (n > bestN) { bestN = n; dense = t; }
  }
  const forest = run(dense.x + 1.2, dense.z + 1.2, 12);
  check('hustý les: bez FIXu', forest.solution !== 'fix', `${forest.solution}, obloha ${(forest.openness * 100).toFixed(0)} %`);
  const b = world.building!;
  const wall = run(b.x + b.sizeX / 2 + 0.8, b.z, 12);
  check('u zdi trafostanice ubyde oblohy a roste PDOP', wall.openness < open.openness - 0.15 && wall.pdop > open.pdop, `obloha ${(wall.openness * 100).toFixed(0)} % vs ${(open.openness * 100).toFixed(0)} %`);
  // Statistika chyby měření ve FIXu
  let sum = 0;
  for (let i = 0; i < 400; i++) {
    const m = open.measure({ x: 0, y: 0, z: 0 });
    sum += m.pos.x ** 2 + m.pos.z ** 2;
  }
  const rms = Math.sqrt(sum / 400);
  check('FIX: polohová RMS odpovídá σ', Math.abs(rms - open.sigmaH) < open.sigmaH * 0.2, `${(rms * 1000).toFixed(1)} mm vs σ ${(open.sigmaH * 1000).toFixed(1)} mm`);
}

// --- Ustavení přístroje
{
  const { InstrumentSetup, SETUP_TOL } = await import('../src/survey/InstrumentSetup');
  const { Rng } = await import('../src/core/Rng');
  const mark = { x: 0, y: 0.1, z: 0 };
  const mk = () => new InstrumentSetup({ x: 0.05, z: -0.03 }, 0, 0.4, { x: 0.02, z: -0.015 }, mark, new Rng(3));
  const s = mk();
  const p0 = s.plummet;
  s.adjustLeg(0, 0.01);
  const p1 = s.plummet;
  const shiftLeg = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const tiltDelta = 0.01 / 0.73;
  check('noha nakloní, ale laser skoro stojí', shiftLeg < 0.1 * s.headHeight * tiltDelta, `${(shiftLeg * 1000).toFixed(2)} mm`);
  const s2 = mk();
  const q0 = s2.plummet;
  s2.turnScrew(0, 0.0005);
  const q1 = s2.plummet;
  const shiftScrew = Math.hypot(q1.x - q0.x, q1.z - q0.z);
  check('šroub posune laser o H·Δt', Math.abs(shiftScrew - s2.headHeight * (0.0005 / 0.082)) < 1e-4, `${(shiftScrew * 1000).toFixed(2)} mm`);
  const s3 = mk();
  const lim = s3.shiftTribrach(0.05, 0);
  check('trojnožka jen ±15 mm', lim && Math.abs(Math.hypot(s3.shift.x, s3.shift.z) - 0.015) < 1e-12);
  // Bublina jde k vyšší straně: prodloužení nohy i nakloní osu od nohy i.
  const s4 = new InstrumentSetup({ x: 0, z: 0 }, 0, 0, { x: 0, z: 0 }, mark, new Rng(1));
  s4.adjustLeg(0, 0.01);
  const u = s4.legDirs[0];
  check('delší noha nakloní osu od sebe', s4.tilt.x * u.x + s4.tilt.z * u.z < 0);

  // Postup geodeta: hrubě stativ → nohy → šrouby → posun trojnožky. Musí jít dokonvergovat.
  const w = mk();
  const toMark = () => ({ x: mark.x - w.plummet.x, z: mark.z - w.plummet.z });
  let d = toMark();
  w.moveTripod(d.x, d.z);
  const solveTilt = (apply: (i: number, v: number) => void, dirs: { x: number; z: number }[], arm: number) => {
    for (let it = 0; it < 30; it++) {
      const t = w.tilt;
      // Zvednout stranu, na kterou osa „padá“ dolů (−t), úměrně průmětu.
      for (let i = 0; i < 3; i++) apply(i, ((t.x * dirs[i].x + t.z * dirs[i].z) * arm * 2) / 3);
    }
  };
  solveTilt((i, v) => w.adjustLeg(i, v), w.legDirs, 0.73);
  check('po nohách je krabicová libela v kroužku', w.status.coarse, `${((w.tiltAngle * 180) / Math.PI * 60).toFixed(2)}′`);
  for (let round = 0; round < 4; round++) {
    solveTilt((i, v) => w.turnScrew(i, v), w.screwDirs, 0.082);
    d = toMark();
    w.shiftTribrach(d.x, d.z);
  }
  check('ustaveno: centrace ≤ 1 mm a sklon ≤ 0,01 gon', w.ready, `centrace ${(w.centeringError! * 1000).toFixed(2)} mm, sklon ${((w.tiltAngle * 200) / Math.PI).toFixed(4)} gon`);
  check('výška přístroje je rozumná', w.instrumentHeight > 1.3 && w.instrumentHeight < 1.7, w.instrumentHeight.toFixed(3));
  void SETUP_TOL;
}

// --- Louka, jízda, zakázky
{
  const meadow = generateWorld('louka');
  check('louka: polní cesta, bez budovy, 2 dochované HZ', meadow.road.surface === 'dirt' && !meadow.building && meadow.marks.filter((m) => m.type === 'HZ').length === 2);
  check('louka: jiné S-JTSK než stavba', Math.abs(meadow.frame.originY - world.frame.originY) > 5000);
  check('louka: povrch cesty je polní', meadow.surfaceAt(0, meadow.road.z) === 'dirt');

  const { VehicleController } = await import('../src/vehicle/VehicleController');
  const road = generateWorld('stavba');
  const vc = new VehicleController(road.vehicle);
  const x0 = road.vehicle.x;
  for (let i = 0; i < 60 * 8; i++) vc.step(1 / 60, { throttle: 1, steer: 0 }, road);
  const kmh = road.vehicle.speed * 3.6;
  check('dodávka zrychlí na asfaltu k 50 km/h', kmh > 44 && kmh <= 50.1, `${kmh.toFixed(1)} km/h`);
  check('jede na západ podél ulice', road.vehicle.x < x0 - 40 && Math.abs(road.vehicle.z - (road.road.z - 1.4)) < 0.3, `x ${road.vehicle.x.toFixed(1)}`);
  for (let i = 0; i < 60 * 4; i++) vc.step(1 / 60, { throttle: -1, steer: 0 }, road);
  check('brzda zastaví', Math.abs(road.vehicle.speed) < 3.1, `${(road.vehicle.speed * 3.6).toFixed(1)} km/h`);

  const grass = generateWorld('louka');
  const gv = grass.vehicle;
  gv.x = -40; gv.z = -100; gv.yaw = 0;
  const vg = new VehicleController(gv);
  for (let i = 0; i < 60 * 8; i++) vg.step(1 / 60, { throttle: 1, steer: 0 }, grass);
  check('po trávě pomaleji (max 20 km/h)', gv.speed * 3.6 <= 20.2, `${(gv.speed * 3.6).toFixed(1)} km/h`);

  // Náraz do stromu
  const w2 = generateWorld('stavba');
  const tree = w2.trees.find((t) => w2.heightmap.slopeAt(t.x, t.z) < 8 * DEG && Math.abs(t.z - w2.road.z) > 20)!;
  Object.assign(w2.vehicle, { x: tree.x, z: tree.z + 12, yaw: 0, speed: 0 });
  const vt = new VehicleController(w2.vehicle);
  let minD = Infinity;
  for (let i = 0; i < 60 * 6; i++) {
    vt.step(1 / 60, { throttle: 1, steer: 0 }, w2);
    const v = w2.vehicle;
    for (const off of [1.45, -1.45]) minD = Math.min(minD, Math.hypot(v.x - Math.sin(v.yaw) * off - tree.x, v.z - Math.cos(v.yaw) * off - tree.z));
  }
  check('strom dodávku zastaví', minD >= 1.0 + tree.trunkR - 0.02, `min ${minD.toFixed(2)} m`);

  // Hráč nevleze do dodávky
  const w3 = generateWorld('stavba');
  const pv = new PlayerController({ x: w3.vehicle.x, z: w3.vehicle.z + 3, yaw: 0 }, w3);
  for (let i = 0; i < 120; i++) pv.step(1 / 60, { forward: 1, right: 0, sprint: false, jump: false }, w3);
  check('dodávka je pevná i po přesunu', pv.pos.z >= w3.vehicle.z + 1.0 + CONFIG.player.radius - 1e-6, `z ${pv.pos.z.toFixed(3)}`);

  const { JOBS } = await import('../src/jobs/JobCatalog');
  const { designTargets } = await import('../src/jobs/designTargets');
  const { StakeoutTask } = await import('../src/jobs/StakeoutTask');
  const house = designTargets(JOBS.find((j) => j.id === 'stavba-rd')!, world);
  check('projekt domu: 4 rohy uvnitř parcely', house.length === 4 && house.every((t) => Math.hypot(t.world.x - 4, t.world.z + 8) < 16));
  const side = Math.hypot(house[1].world.x - house[0].world.x, house[1].world.z - house[0].world.z);
  check('strana domu 11 m', Math.abs(side - 11) < 0.02, side.toFixed(3));
  const st = new StakeoutTask(house, 0.02);
  st.stake('201', { x: house[0].world.x + 0.012, y: 0, z: house[0].world.z }, 0.01);
  st.stake('202', { x: house[1].world.x, y: 0, z: house[1].world.z + 0.035 }, 0.01);
  const ev = st.evaluate();
  check('kontrola vytyčení odhalí kolík mimo toleranci', ev.rows[0].ok && !ev.rows[1].ok && !ev.allOk);
  const fence = designTargets(JOBS.find((j) => j.id === 'louka-hranice')!, meadow);
  check('hranice louky: 301 a 302 dochované, 303 a 304 chybí', fence.filter((t) => t.existingMarkId).map((t) => t.id).join() === '301,302');
  const parcel = designTargets(JOBS.find((j) => j.id === 'stavba-hranice')!, world);
  check('hranice 1254/3: ověřit 101, 102, 104, vyvrácený 103 vytyčit', parcel.filter((t) => t.existingMarkId).map((t) => t.id).join() === '101,102,104' && parcel.length === 4);
  const hz = world.marks.find((m) => m.id === 'HZ-101')!;
  check('hranice 1254/3: projekt sedí na katalog mezníku', Math.hypot(parcel[0].design.Y - hz.catalog.Y, parcel[0].design.X - hz.catalog.X) < 0.015);
  const shedCorners = meadow.features.filter((f) => f.id.startsWith('kulna-'));
  check('kůlna na louce: 4 rohy s kódem roh budovy', shedCorners.length === 4 && shedCorners.every((f) => f.code === 'ROH_BUDOVY'));
  const kulnaJob = JOBS.find((j) => j.id === 'louka-kulna')!;
  check('zakázka kůlny míří na existující prvky', kulnaJob.featureIds!.every((id) => meadow.features.some((f) => f.id === id)));
  {
    const { GnssReceiver } = await import('../src/gnss/GnssReceiver');
    const { Rng } = await import('../src/core/Rng');
    const sc = meadow.scenery.find((q) => q.kind === 'shed')!;
    const sols = shedCorners.map((f) => {
      const ox = Math.sign(f.pos.x - sc.x) * 0.1;
      const oz = Math.sign(f.pos.z - sc.z) * 0.1;
      const g = new GnssReceiver(new Rng(3));
      g.powerOn();
      const a = { x: f.pos.x + ox, y: meadow.heightmap.heightAt(f.pos.x, f.pos.z) + 2, z: f.pos.z + oz };
      for (let t = 0; t < 15; t += 1 / 30) g.update(1 / 30, a, meadow);
      return g.solution;
    });
    check('rohy kůlny jdou změřit GNSS s FIXem', sols.every((x) => x === 'fix'), sols.join(','));
  }
  {
    const { GnssReceiver } = await import('../src/gnss/GnssReceiver');
    const { Rng } = await import('../src/core/Rng');
    const stones = meadow.features.filter((f) => f.id.startsWith('mez-'));
    check('mez na louce: 3 kameny s kódem Hranice', stones.length === 3 && stones.every((f) => f.code === 'HRANICE'));
    const mezJob = JOBS.find((j) => j.id === 'louka-mez')!;
    check('zakázka meze míří na existující prvky a body', mezJob.featureIds!.every((id) => meadow.features.some((f) => f.id === id)) && [mezJob.stationAt, mezJob.orientOn].every((id) => meadow.marks.some((m) => m.id === id)));
    const sols = stones.map((f) => {
      const g = new GnssReceiver(new Rng(5));
      g.powerOn();
      const a = { x: f.pos.x, y: f.pos.y + 2, z: f.pos.z };
      for (let t = 0; t < 20; t += 1 / 30) g.update(1 / 30, a, meadow);
      return g.solution;
    });
    check('pod stromořadím GNSS FIX nedá', sols.every((x) => x !== 'fix'), sols.join(','));
    const st = meadow.marks.find((m) => m.id === mezJob.stationAt)!;
    const eye = { x: st.pos.x, y: st.pos.y + 1.55, z: st.pos.z };
    const clear = stones.map((f) => {
      const p = { x: f.pos.x, y: f.pos.y + 2, z: f.pos.z };
      const d = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      const h = meadow.raycast(eye, { x: (p.x - eye.x) / d, y: (p.y - eye.y) / d, z: (p.z - eye.z) / d }, d);
      return !h || h.t > d - 0.05;
    });
    const or = meadow.marks.find((m) => m.id === mezJob.orientOn)!;
    {
      const p = { x: or.pos.x, y: or.pos.y + 2, z: or.pos.z };
      const d = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
      const h = meadow.raycast(eye, { x: (p.x - eye.x) / d, y: (p.y - eye.y) / d, z: (p.z - eye.z) / d }, d);
      clear.push(!h || h.t > d - 0.05);
    }
    check('ze stanoviska 5102 je na kameny i na orientaci vidět', clear.every(Boolean), clear.join(','));
  }

  const { MappingTask } = await import('../src/jobs/MappingTask');
  const mt = new MappingTask([...world.features]);
  const v1 = world.features.find((f) => f.code === 'VPUST')!;
  check('špatný kód se nezapočítá', mt.onMeasured('1', 'ROH_BUDOVY', v1.pos) === null && mt.wrongCode === 1);
  check('správný kód na vpusti se započítá', mt.onMeasured('2', 'VPUST', { ...v1.pos, x: v1.pos.x + 0.05 })?.id === v1.id);
  check('bod mimo prvek se nezapočítá', mt.onMeasured('3', 'VPUST', { ...v1.pos, x: v1.pos.x + 0.5 }) === null);
}

// --- Totální stanice (M3)
{
  const { TotalStation, bearingOf } = await import('../src/survey/TotalStation');
  const { Rng } = await import('../src/core/Rng');
  const w = generateWorld('stavba');
  const st = w.marks.find((m) => m.id === 'PBPP-4001')!;
  const bs = w.marks.find((m) => m.id === 'ZhB-4021')!;
  const hz = w.marks.find((m) => m.id === 'HZ-101')!;
  const vp = 1.52;
  const center = { x: st.pos.x + 0.0007, y: st.pos.y + vp, z: st.pos.z - 0.0004 }; // centrace 0,8 mm
  const ts = new TotalStation(center, st.catalog, vp, new Rng(42));
  const prism = (m: typeof st, id: string) => ({ id, center: { x: m.pos.x, y: m.pos.y + 2, z: m.pos.z }, foot: { ...m.pos }, height: 2, markId: m.id });
  const aimAt = (p: { x: number; y: number; z: number }) => {
    const d = { x: p.x - center.x, y: p.y - center.y, z: p.z - center.z };
    const l = Math.hypot(d.x, d.y, d.z);
    return { x: d.x / l, y: d.y / l, z: d.z / l };
  };
  const pB = prism(bs, 'p1');
  const shotB = ts.shoot(aimAt(pB.center), w, [pB], 'prism');
  check('4001 → 4021: hranol je vidět', shotB.ok, shotB.ok ? `${shotB.shot.sd.toFixed(3)} m` : (shotB as { reason: string }).reason);
  if (shotB.ok) {
    const o = ts.orient(shotB.shot, bs.catalog, bs.id)!;
    check('orientace: kontrola délky do 3 mm', Math.abs(o.dDist) < 0.003, `${(o.dDist * 1000).toFixed(1)} mm`);
    const pH = prism(hz, 'p2');
    const shotH = ts.shoot(aimAt(pH.center), w, [pH], 'prism');
    check('měření na HZ 101', shotH.ok);
    if (shotH.ok) {
      const c = ts.compute(shotH.shot)!;
      const e = Math.hypot(c.Y - hz.catalog.Y, c.X - hz.catalog.X);
      check('polární metoda: poloha HZ 101 do 5 mm', e < 0.005, `${(e * 1000).toFixed(1)} mm`);
      check('polární metoda: výška do 5 mm', Math.abs(c.H - hz.catalog.H) < 0.005, `${((c.H - hz.catalog.H) * 1000).toFixed(1)} mm`);
    }
    // Mimo střed hranolu
    const off = aimAt({ ...pH.center, y: pH.center.y + 0.06 });
    check('mimo hranol: žádné měření', !ts.shoot(off, w, [pH], 'prism').ok);
    // Bez hranolu na jižní stěnu trafostanice u JV rohu
    const b = w.building!;
    const wallPt = { x: b.x + b.sizeX / 2 - 0.08, y: b.groundY + 1.2, z: b.z + b.sizeZ / 2 };
    const r = ts.shoot(aimAt(wallPt), w, [], 'reflectorless');
    check('bez hranolu: zásah zdi trafostanice', r.ok && r.shot.hitKind === 'prop', r.ok ? r.shot.hitKind : (r as { reason: string }).reason);
    if (r.ok) {
      const c = ts.compute(r.shot)!;
      const wp = w.frame.toSjtsk(wallPt);
      check('bez hranolu: souřadnice zdi do 1 cm', Math.hypot(c.Y - wp.Y, c.X - wp.X) < 0.01);
    }
    // Rohy viditelné ze 4001
    const vis = w.features.filter((f) => f.code === 'ROH_BUDOVY').map((f) => {
      const ix = f.pos.x < b.x ? 0.05 : -0.05;
      const iz = f.pos.z < b.z ? 0.05 : -0.05;
      // Zámeřný bod na jedné ze dvou stěn u rohu (5 cm od hrany).
      const seen = [{ x: f.pos.x, z: f.pos.z + iz }, { x: f.pos.x + ix, z: f.pos.z }].some((q) => {
        const pt = { x: q.x, y: b.groundY + 1.2, z: q.z };
        const h = w.raycast(center, aimAt(pt), 300);
        return h && Math.abs(h.t - Math.hypot(pt.x - center.x, pt.y - center.y, pt.z - center.z)) < 0.05;
      });
      return seen ? f.id : null;
    }).filter(Boolean);
    check('ze 4001 vidět rohy JZ, JV, SV (SZ ne)', vis.sort().join() === 'roh-JV,roh-JZ,roh-SV', vis.join());
  }
  check('směrník: na jih (+X) je 0', Math.abs(bearingOf({ x: 0, z: 1 })) < 1e-12);
}

// --- Robotická stanice: zámek na hranol
{
  const { RoboticLink, lineBlocker } = await import('../src/survey/RoboticLink');
  const w = generateWorld('stavba');
  const st = w.marks.find((m) => m.id === 'PBPP-4001')!;
  const bs = w.marks.find((m) => m.id === 'ZhB-4021')!;
  const c = { x: st.pos.x, y: st.pos.y + 1.46, z: st.pos.z };
  const prismAt = (x: number, z: number) => ({ x, y: w.heightmap.heightAt(x, z) + 2, z });
  const link = new RoboticLink(0);
  link.startSearch();
  let ev = null;
  for (let i = 0; i < 200 && !ev; i++) ev = link.update(1 / 60, c, prismAt(bs.pos.x, bs.pos.z), w);
  check('hledání najde hranol na 4021', ev?.kind === 'locked' && link.state === 'locked');
  // Hranol za trafostanicí (severně od ní) – zakrytý budovou
  const b = w.building!;
  check('hranol za budovou: zakrytý', lineBlocker(c, prismAt(b.x - 0.5, b.z - 6), w) === 'budova nebo plot', String(lineBlocker(c, prismAt(b.x - 0.5, b.z - 6), w)));
  // Dodávka vjede do záměry → ztráta zámku
  const target = prismAt(st.pos.x, w.road.z + 4); // hranol za ulicí
  link.startSearch();
  ev = null;
  for (let i = 0; i < 200 && !ev; i++) ev = link.update(1 / 60, c, target, w);
  const locked = ev?.kind === 'locked';
  Object.assign(w.vehicle, { x: st.pos.x, z: w.road.z - 1.4, yaw: Math.PI / 2 });
  ev = null;
  for (let i = 0; i < 30 && !ev; i++) ev = link.update(1 / 60, c, target, w);
  check('dodávka v záměře: ztráta zámku', locked && ev?.kind === 'lost' && (ev as { reason: string }).reason === 'dodávka', JSON.stringify(ev));
}

// --- Volné stanovisko
{
  const { TotalStation } = await import('../src/survey/TotalStation');
  const { solveResection } = await import('../src/survey/FreeStation');
  const { lineBlocker } = await import('../src/survey/RoboticLink');
  const { Rng } = await import('../src/core/Rng');
  const w = generateWorld('stavba');
  const b = w.building!;
  const nw = w.features.find((f) => f.id === 'roh-SZ')!;
  const known = w.marks.filter((m) => m.condition === 'ok' && m.type !== 'NZ');
  // Najdi místo severozápadně od trafostanice, odkud je vidět SZ roh a aspoň 2 známé body.
  let best: { x: number; z: number; vis: typeof known } | null = null;
  for (let z = b.z - 16; z <= b.z + 4 && !best; z += 2)
    for (let x = b.x - 16; x <= b.x - 4 && !best; x += 2) {
      const c = { x, y: w.heightmap.heightAt(x, z) + 1.5, z };
      const prism = { x: nw.pos.x, y: nw.pos.y + 2, z: nw.pos.z };
      if (w.heightmap.slopeAt(x, z) > 0.3 || lineBlocker(c, prism, w)) continue;
      const vis = known.filter((m) => !lineBlocker(c, { x: m.pos.x, y: m.pos.y + 2, z: m.pos.z }, w));
      if (vis.length >= 2) best = { x, z, vis };
    }
  check('SZ od trafostanice existuje volné stanovisko', !!best, best ? `${best.vis.map((m) => m.number).join(', ')}` : '');
  if (best) {
    const center = { x: best.x, y: w.heightmap.heightAt(best.x, best.z) + 1.5, z: best.z };
    const ts = new TotalStation(center, null, 0, new Rng(7));
    const obs = best.vis.map((m) => {
      const pc = { x: m.pos.x, y: m.pos.y + 2, z: m.pos.z };
      const d = { x: pc.x - center.x, y: pc.y - center.y, z: pc.z - center.z };
      const l = Math.hypot(d.x, d.y, d.z);
      const r = ts.shoot({ x: d.x / l, y: d.y / l, z: d.z / l }, w, [{ id: m.id, center: pc, foot: m.pos, height: 2 }], 'prism');
      if (!r.ok) throw new Error('hranol');
      return { markId: m.id, number: m.number, known: m.catalog, hz: r.shot.hz, zen: r.shot.zen, sd: r.shot.sd, vc: 2, use: true };
    });
    const res = solveResection(obs)!;
    const truth = w.frame.toSjtsk(center);
    const e = Math.hypot(res.station.Y - truth.Y, res.station.X - truth.X);
    check('volné stanovisko: poloha do 5 mm', e < 0.005, `${(e * 1000).toFixed(1)} mm, σ0 ${(res.sigma0 * 1000).toFixed(1)} mm`);
    check('volné stanovisko: výška osy do 5 mm', Math.abs(res.station.H - truth.H) < 0.005, `${((res.station.H - truth.H) * 1000).toFixed(1)} mm`);
    check('opravy malé', res.residuals.every((r) => Math.hypot(r.dY, r.dX) < 0.006));
    // Chybný bod (katalog o 8 cm vedle) má velkou opravu
    const bad = obs.map((o, i) => (i === 0 ? { ...o, known: { ...o.known, Y: o.known.Y + 0.08 } } : o));
    if (bad.length >= 3) {
      const rb = solveResection(bad)!;
      check('chybný bod vyčnívá v opravách', Math.hypot(rb.residuals[0].dY, rb.residuals[0].dX) > 0.03);
      const rx = solveResection(bad.map((o, i) => (i === 0 ? { ...o, use: false } : o)))!;
      check('po vyřazení chybného bodu sedí', Math.hypot(rx.station.Y - truth.Y, rx.station.X - truth.X) < 0.005);
    }
    ts.acceptFreeStation(res.station, res.orientation);
    const pc = { x: nw.pos.x, y: nw.pos.y + 2, z: nw.pos.z };
    const d = { x: pc.x - center.x, y: pc.y - center.y, z: pc.z - center.z };
    const l = Math.hypot(d.x, d.y, d.z);
    const r = ts.shoot({ x: d.x / l, y: d.y / l, z: d.z / l }, w, [{ id: 'p', center: pc, foot: nw.pos, height: 2 }], 'prism');
    const cc = r.ok ? ts.compute(r.shot) : null;
    const tn = w.frame.toSjtsk(nw.pos);
    check('SZ roh z volného stanoviska do 1 cm', !!cc && Math.hypot(cc.Y - tn.Y, cc.X - tn.X) < 0.01);
  }
}

// --- Nivelace
{
  const { readRod, LevelLine, closureLimit } = await import('../src/survey/Leveling');
  const { Rng } = await import('../src/core/Rng');
  const w = generateWorld('stavba');
  const nz = w.marks.find((m) => m.type === 'NZ')!;
  const vb = w.features.find((f) => f.id === 'vb1');
  check('výškový bod VB1 v obrubníku existuje', !!vb);
  if (vb) {
    const rng = new Rng(3);
    const mid = { x: (nz.pos.x + vb.pos.x) / 2 + 3, z: (nz.pos.z + vb.pos.z) / 2 };
    const inst = { center: { x: mid.x, y: w.heightmap.heightAt(mid.x, mid.z) + 1.5, z: mid.z }, collimation: 5e-5 };
    const a = readRod(inst, nz.pos, w, rng);
    const b = readRod(inst, vb.pos, w, rng);
    check('čtení latě na NZ a VB1 z jednoho postavení', a.ok && b.ok, JSON.stringify([a, b]).slice(0, 120));
    if (a.ok && b.ok) {
      const line = new LevelLine(nz.id, nz.number, nz.catalog.H);
      line.addBack(1, { reading: a.reading, dist: a.dist, pointId: nz.id, pointLabel: nz.number });
      line.addFore(1, { reading: b.reading, dist: b.dist, pointId: 'vb1', pointLabel: 'VB1' });
      const trueH = w.frame.toSjtsk(vb.pos).H;
      const hVb = line.heights.points.get('vb1')!.H;
      check('výška VB1 do 2 mm (vyrovnané záměry)', Math.abs(hVb - trueH) < 0.002, `${((hVb - trueH) * 1000).toFixed(2)} mm`);
      // zpět z jiného postavení
      const mid2 = { x: mid.x - 6, z: mid.z + 2 };
      const inst2 = { center: { x: mid2.x, y: w.heightmap.heightAt(mid2.x, mid2.z) + 1.45, z: mid2.z }, collimation: 5e-5 };
      const c = readRod(inst2, vb.pos, w, rng);
      const d = readRod(inst2, nz.pos, w, rng);
      if (c.ok && d.ok) {
        line.addBack(2, { reading: c.reading, dist: c.dist, pointId: 'vb1', pointLabel: 'VB1' });
        line.addFore(2, { reading: d.reading, dist: d.dist, pointId: nz.id, pointLabel: nz.number });
        const cl = line.closure!;
        check('uzávěr pořadu tam a zpět do 2 mm', Math.abs(cl) < 0.002, `${(cl * 1000).toFixed(2)} mm, mez ${(closureLimit(line.heights.length) * 1000).toFixed(1)} mm`);
        check('návaznost pořadu v pořádku', line.continuityError === null);
      }
    }
    // Nevyrovnané záměry + chyba horizontu → chyba
    const near = { x: nz.pos.x + 4, z: nz.pos.z + 3 };
    const bad = { center: { x: near.x, y: w.heightmap.heightAt(near.x, near.z) + 1.5, z: near.z }, collimation: 5e-5 };
    const e1 = readRod(bad, nz.pos, w, rng);
    const far = { x: nz.pos.x + 4, y: w.heightmap.heightAt(nz.pos.x + 4, nz.pos.z + 45), z: nz.pos.z + 45 };
    const e2 = readRod(bad, far, w, rng);
    if (e1.ok && e2.ok) {
      const exact = bad.center.y - nz.pos.y - (bad.center.y - far.y);
      const meas = e1.reading - e2.reading;
      check('nevyrovnané záměry: chyba z horizontu přes 1,5 mm', Math.abs(meas - exact) > 0.0015, `${((meas - exact) * 1000).toFixed(2)} mm`);
    }
    check('příliš dlouhá záměra se nepřečte', !readRod(inst, { x: inst.center.x + 70, y: inst.center.y - 1, z: inst.center.z }, w, rng).ok);
  }
}

// --- Výtyčka v ruce
{
  const { PoleBalance, BUBBLE_LIMIT } = await import('../src/player/PoleBalance');
  const { Rng } = await import('../src/core/Rng');
  const pb = new PoleBalance(new Rng(5));
  let left = -1;
  for (let i = 0; i < 60 * 8 && left < 0; i++) {
    pb.update(1 / 60, 0);
    if (!pb.inCircle) left = i / 60;
  }
  check('bez korekce výtyčka do pár sekund uteče z kroužku', left > 0 && left < 8, `${left.toFixed(1)} s`);
  // Hráč pravidelně srovnává → drží se v kroužku
  const ok = new PoleBalance(new Rng(6));
  let inside = 0;
  for (let i = 0; i < 60 * 8; i++) {
    ok.update(1 / 60, 0);
    if (i % 20 === 0) ok.nudge(-ok.tilt.x * 0.8, -ok.tilt.z * 0.8);
    if (ok.inCircle) inside++;
  }
  check('se srovnáváním zůstává v kroužku', inside / (60 * 8) > 0.95, `${Math.round((inside / 480) * 100)} %`);
  const o = { x: BUBBLE_LIMIT, z: 0 };
  ok.tilt = o;
  check('bublina na okraji = asi 12 mm ve 2 m', Math.abs(ok.offset().x - 0.0116) < 0.0005, `${(ok.offset().x * 1000).toFixed(1)} mm`);
}

// --- Kancelář
{
  const w = generateWorld('kancelar');
  const probe = (x: number, z: number, r: number) => {
    const p = { x, z };
    const gy = w.heightmap.heightAt(x, z);
    w.resolveCircle(p, r, gy + 0.1, gy + 1.7);
    return Math.hypot(p.x - x, p.z - z) < 1e-6;
  };
  check('kancelář: start u nástěnky je volný', probe(w.spawn.x, w.spawn.z, CONFIG.player.radius));
  check('kancelář: vybavení ve skladu neleží ve zdi', w.itemSpawns.every((i) => probe(i.x, i.z, 0.2)));
  check('kancelář: 7 kusů vybavení ve skladu (i kufr GNSS)', w.itemSpawns.length === 7 && w.itemSpawns.some((s) => s.kind === 'gnssCase'));
  const { VehicleController } = await import('../src/vehicle/VehicleController');
  const vc = new VehicleController(w.vehicle);
  const x0 = w.vehicle.x;
  for (let i = 0; i < 60 * 4; i++) vc.step(1 / 60, { throttle: 0.6, steer: 0 }, w);
  check('kancelář: dodávka vyjede z parkoviště', w.vehicle.x > x0 + 10 && w.vehicle.speed > 1, `x ${w.vehicle.x.toFixed(1)}`);
  const { travelMinutes } = await import('../src/world/locations');
  check('dojezdy: kancelář–stavba 14 min, kancelář–louka 26 min', travelMinutes('kancelar', 'stavba') === 14 && travelMinutes('louka', 'kancelar') === 26);
}

// --- Pomocník
{
  const { Helper } = await import('../src/npc/Helper');
  const w = generateWorld('stavba');
  const h = new Helper(-10, 30, w);
  const player = { x: 10, z: 10 };
  for (let i = 0; i < 60 * 20; i++) h.update(1 / 60, w, player);
  check('pomocník dojde za hráčem', Math.hypot(h.pos.x - player.x, h.pos.z - player.z) < 3, `${Math.hypot(h.pos.x - player.x, h.pos.z - player.z).toFixed(1)} m`);
  const bs = w.marks.find((m) => m.id === 'ZhB-4021')!;
  h.goTo(bs.pos.x, bs.pos.z, 'hold');
  let arrived = false;
  for (let i = 0; i < 60 * 60 && !arrived; i++) arrived = h.update(1 / 60, w, player)?.kind === 'arrived';
  check('pomocník dojde s výtyčkou na 4021', arrived && h.state === 'hold', `${Math.hypot(h.pos.x - bs.pos.x, h.pos.z - bs.pos.z).toFixed(2)} m`);
  // Cíl za trafostanicí: musí obejít budovu
  const b = w.building!;
  const h2 = new Helper(b.x, b.z + 6, w);
  h2.goTo(b.x, b.z - 6, 'hold');
  let ok2 = false;
  for (let i = 0; i < 60 * 40 && !ok2; i++) ok2 = h2.update(1 / 60, w, player)?.kind === 'arrived';
  check('pomocník obejde trafostanici', ok2);
}

{
  const { LevelLine } = await import('../src/survey/Leveling');
  const l = new LevelLine('A', 'A', 100);
  l.addBack(1, { reading: 1.5, dist: 30, pointId: 'A', pointLabel: 'A' });
  l.addFore(1, { reading: 1.0, dist: 30, pointId: 'B', pointLabel: 'B' });
  check('hotová sestava se ze stejného postavení nepřepíše', !l.addBack(1, { reading: 1.2, dist: 30, pointId: 'B', pointLabel: 'B' }) && l.sets.length === 1 && l.sets[0].fore?.pointId === 'B');
  check('nové postavení = nová sestava', l.addBack(2, { reading: 1.2, dist: 30, pointId: 'B', pointLabel: 'B' }) && l.sets.length === 2);
}

// --- Denní světlo
{
  const { daylight } = await import('../src/render/DayCycle');
  const morning = daylight(7 * 60 + 30);
  const noon = daylight(13 * 60 + 15);
  const evening = daylight(19 * 60);
  check('ráno svítí slunce z východu, nízko', morning.sunDir.x > 0.5 && morning.sunDir.y < 0.5, JSON.stringify(morning.sunDir));
  check('v poledne je slunce na jihu a vysoko', noon.sunDir.z > 0.4 && noon.sunDir.y > 0.75, JSON.stringify(noon.sunDir));
  check('večer ze západu a teplejší', evening.sunDir.x < -0.5 && ((evening.sunColor >> 8) & 255) < ((noon.sunColor >> 8) & 255));
  check('v noci tma', daylight(22 * 60).night === 1 && daylight(12 * 60).night === 0);
}

// --- Počasí
{
  const { weatherForDay, poleTremor, levelNoise, stationRanges } = await import('../src/world/Weather');
  check('první den polojasno', weatherForDay(1).kind === 'polojasno');
  check('počasí je stejné pro stejný den', weatherForDay(7).kind === weatherForDay(7).kind);
  const kinds = new Set(Array.from({ length: 40 }, (_, i) => weatherForDay(i + 2).kind));
  check('za 40 dní se vystřídá aspoň 5 druhů počasí', kinds.size >= 5, [...kinds].join(', '));
  const windy = { ...weatherForDay(1), kind: 'vitr' as const, wind: 1 };
  check('vítr víc rozkývá výtyčku', poleTremor(windy) > 2.5);
  const hot = { ...weatherForDay(1), kind: 'jasno' as const, wind: 0.1 };
  check('tetelení: dlouhá záměra v poledne je horší', levelNoise(hot, 13 * 60, 50) > 2 * levelNoise(hot, 8 * 60, 50));
  const fog = { ...weatherForDay(1), kind: 'mlha' as const, fog: 1 };
  check('v mlze kratší dosah dálkoměru', stationRanges(fog).reflectorless < 100 && stationRanges(fog).prism < 300);
}

// --- Louka: nivelace na hráz
{
  const { readRod } = await import('../src/survey/Leveling');
  const { Rng } = await import('../src/core/Rng');
  const w = generateWorld('louka');
  const nz = w.marks.find((m) => m.id === 'NZ-Kn-15');
  const vb = w.features.find((f) => f.id === 'vb2');
  check('louka: značka Kn-15 a patník VB2', !!nz && !!vb);
  if (nz && vb) {
    const rng = new Rng(9);
    // Hledá pořad jako hráč: přestavové body po přímce, nivelák mezi nimi (případně bokem).
    const P = (k: number) => {
      const x = nz.pos.x + (vb.pos.x - nz.pos.x) * k;
      const z = nz.pos.z + (vb.pos.z - nz.pos.z) * k;
      return { x, y: w.heightmap.heightAt(x, z), z };
    };
    let from = { k: 0, pos: nz.pos };
    let setups = 0;
    while (from.k < 1 && setups < 8) {
      let best: { k: number; pos: { x: number; y: number; z: number } } | null = null;
      for (let k = Math.min(1, from.k + 0.55); k > from.k + 0.02; k -= 0.02) {
        const to = k >= 0.999 ? { k: 1, pos: vb.pos } : { k, pos: P(k) };
        for (const off of [0, 3, -3, 6, -6]) {
          const mx = (from.pos.x + to.pos.x) / 2 + off;
          const mz = (from.pos.z + to.pos.z) / 2;
          const inst = { center: { x: mx, y: w.heightmap.heightAt(mx, mz) + 1.45, z: mz }, collimation: 0 };
          if (readRod(inst, from.pos, w, rng).ok && readRod(inst, to.pos, w, rng).ok) {
            best = to;
            break;
          }
        }
        if (best) break;
      }
      if (!best) break;
      from = best;
      setups++;
    }
    const one = false;
    const two = from.k >= 1;
    const n = setups;
    check('louka: pořad Kn-15 → VB2 jde změřit s přestavovými body', one || two, `${n} postavení tam`);
  }
}

// --- Export zápisníku
{
  const { exportPoints } = await import('../src/survey/PointExport');
  const pts = [
    { id: '1001', Y: 742400.1234, X: 1046300.5678, Z: 285.0004, code: 'VPUST' as const, sigmaXY: 0.01, sigmaZ: 0.02, method: 'gnss_rtk' as const, timestamp: 0, solution: 'FIX', location: 'Stavba' },
  ];
  const csv = exportPoints(pts, 'csv').split('\r\n');
  check('CSV: hlavička a bod na 3 desetinná místa', csv[0].startsWith('cislo;Y;X;H') && csv[1] === '1001;742400.123;1046300.568;285.000;VPUST;gnss_rtk;FIX;Stavba');
  const txt = exportPoints(pts, 'txt');
  check('TXT: pevné sloupce se souřadnicemi', /1001\s+742400\.123\s+1046300\.568\s+285\.000\s+VPUST/.test(txt));
  const dxf = exportPoints(pts, 'dxf').split('\r\n');
  const i = dxf.indexOf('POINT');
  check('DXF: bod v CAD osách (x = −Y, y = −X), vrstva podle kódu', i > 0 && dxf[i + 2] === 'VPUST' && dxf[i + 4] === '-742400.123' && dxf[i + 6] === '-1046300.568' && dxf[dxf.length - 2] === 'EOF');
}

// --- Kariéra: stupně a spěšné zakázky
{
  const { newCareer, rankOf, rankFor, okJobs, urgentJob, extraPay, RANKS } = await import('../src/jobs/Career');
  const c = newCareer();
  check('nováček je pomocník a smí jen lehké zakázky', rankOf(c).name === RANKS[0].name && rankOf(c).maxDifficulty === 1);
  c.stats.okJobs = 2;
  check('po 2 zakázkách bez vady je měřič', rankOf(c).name === 'Měřič' && rankOf(c).maxDifficulty === 2);
  c.stats.okJobs = 9;
  check('po 9 zakázkách ÚOZI s příplatkem', rankOf(c).payBonus === 0.1);
  const old = newCareer();
  old.stats.jobsDone = 6;
  check('starší uložení: stupeň z počtu odevzdaných', okJobs(old) === 6 && rankOf(old).maxDifficulty === 3);
  check('obtížnost 3 odemyká samostatný geodet', rankFor(3).name === 'Samostatný geodet');
  const ids = ['a', 'b', 'c', 'd'];
  const days = new Set(Array.from({ length: 20 }, (_, i) => urgentJob(i + 1, ids)));
  check('spěšná zakázka je stejná pro stejný den a střídá se', urgentJob(5, ids) === urgentJob(5, ids) && days.size >= 3, [...days].join());
  check('příplatky jen za zakázku v pořádku', extraPay(5000, false, RANKS[3], true).urgent === 0 && extraPay(5000, true, RANKS[3], true).urgent === 1500 && extraPay(5000, true, RANKS[3], false).rank === 500);
}

// --- Kontroler GNSS
{
  const { FieldController, reportCoords, HEIGHT_ANOMALY, RECEIVER_SERIAL } = await import('../src/gnss/FieldController');
  const c = new FieldController();
  check('nový kontroler: chybí zakázka, Bluetooth, anténa i korekce', c.missing().join() === 'job,bluetooth,antenna,ntrip');
  c.createJob('Test', 'sjtsk', 'stavba');
  c.bt = RECEIVER_SERIAL;
  c.antennaType = 'r7-int';
  c.antennaHeight = 2.0;
  c.mountpoint = 'VRS3-GG';
  c.ntripOn = true;
  check('po nastavení nic nechybí', c.missing().length === 0);
  const p = { Y: 742400.123, X: 1046300.456, H: 285.2 };
  check('S-JTSK/Bpv: souřadnice beze změny', JSON.stringify(reportCoords(p, 'sjtsk', 0)) === JSON.stringify(p));
  const en = reportCoords(p, 'sjtskEN', 0);
  check('EPSG 5514: záporné souřadnice', en.Y === -p.Y && en.X === -p.X);
  check('bez kvazigeoidu: výška o ~45 m výš', Math.abs(reportCoords(p, 'sjtskElips', 0).H - p.H - HEIGHT_ANOMALY) < 1e-9);
  c.antennaHeight = 2.0;
  check('výtyčka 1,80 m, zadáno 2,000 m → body o 20 cm níž', Math.abs(c.heightError(1.8) + 0.2) < 1e-9);
  c.antennaType = 'r5-int';
  check('špatný typ antény posune výšku o fázové centrum', Math.abs(c.heightError(2.0) + 0.023) < 1e-9);
  // Korekce: na stavbě chodí, bez připojení ne.
  let t = 0;
  let ok = 0;
  const rnd = (() => { let x = 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  for (; t < 300; t += 0.5) {
    c.updateCorrections(0.5, 'stavba', rnd);
    if (c.correctionsOk) ok++;
  }
  check('stavba: korekce skoro pořád čerstvé', ok / 600 > 0.85, `${Math.round((ok / 600) * 100)} %`);
  let lokOk = 0;
  for (t = 0; t < 1200; t += 0.5) {
    c.updateCorrections(0.5, 'louka', rnd);
    if (c.correctionsOk) lokOk++;
  }
  check('louka: slabý signál, korekce občas vypadnou', lokOk / 2400 < 0.99 && lokOk / 2400 > 0.6, `${Math.round((lokOk / 2400) * 100)} %`);
  c.ntripOn = false;
  c.updateCorrections(0.5, 'stavba', rnd);
  check('bez NTRIP žádné korekce', !c.correctionsOk);
  const { GnssReceiver } = await import('../src/gnss/GnssReceiver');
  const { Rng } = await import('../src/core/Rng');
  const g = new GnssReceiver(new Rng(5));
  g.corrections = null;
  g.powerOn();
  for (let i = 0; i < 600; i++) g.update(1 / 30, { x: 0, y: world.heightmap.heightAt(0, 0) + 2, z: 0 }, world);
  check('bez korekcí jen autonomní řešení (metry)', g.solution === 'autonomous' && g.sigmaH > 1, `${g.solution} σ ${g.sigmaH.toFixed(1)} m`);
  g.corrections = { baseKm: 38 };
  for (let i = 0; i < 600; i++) g.update(1 / 30, { x: 0, y: world.heightmap.heightAt(0, 0) + 2, z: 0 }, world);
  const far = g.sigmaH;
  g.corrections = { baseKm: 3 };
  for (let i = 0; i < 30; i++) g.update(1 / 30, { x: 0, y: world.heightmap.heightAt(0, 0) + 2, z: 0 }, world);
  check('vzdálená báze = horší přesnost FIXu (1 ppm)', g.solution === 'fix' && far - g.sigmaH > 0.03, `${(far * 1000).toFixed(0)} vs ${(g.sigmaH * 1000).toFixed(0)} mm`);
}

// --- Montáž: závit
{
  const { Thread, dragAngle } = await import('../src/bench/Thread');
  const t = new Thread(4);
  t.rotate(Math.PI * 2, false);
  check('bez přidržení se závit jen protočí', t.turns === 0 && t.slipped > 6);
  for (let i = 0; i < 10; i++) t.rotate(Math.PI, true);
  check('4 otáčky po směru = dotaženo, dál nejde', t.tight && t.turns === 4);
  t.rotate(-Math.PI * 8, true);
  check('proti směru povolí až na nulu', t.loose);
  check('krouživý tah po směru hodinových ručiček = kladný úhel', dragAngle(0, 0, 10, 0, 0, 10) > 0);
}

// --- Stav vybavení
{
  const { noiseFactor, repairCost, dropDamage, stateLabel, equipOf, BROKEN } = await import('../src/jobs/Equipment');
  check('nový přístroj měří podle výrobce', noiseFactor(1) === 1 && noiseFactor(0.6) > 1.9);
  check('pojištění: oprava nejvýš 2 000 Kč', repairCost('ts', 0.2, true) === 2000 && repairCost('ts', 0.2, false) > 20000);
  check('pád za běhu rozbije stanici', 1 - dropDamage('ts', true) < BROKEN + 0.2 && stateLabel(0.3) === 'porucha');
  check('kufr i rover nesou stav GNSS', equipOf('gnssCase') === 'gnss' && equipOf('gnssRover') === 'gnss' && equipOf('rod') === null);
}

// --- Generované objednávky
{
  const { ordersForDay } = await import('../src/jobs/Generator');
  const { designTargets } = await import('../src/jobs/designTargets');
  const { inPolygon, rectCorners, LAYOUT } = await import('../src/world/WorldGen');
  const a = ordersForDay(5);
  check('každý den dvě objednávky, stejné pro stejný den', a.length === 2 && JSON.stringify(a) === JSON.stringify(ordersForDay(5)));
  const titles = new Set(Array.from({ length: 12 }, (_, i) => ordersForDay(i + 1).map((o) => o.title).join('|')));
  check('objednávky se den ode dne liší', titles.size >= 10, `${titles.size} různých`);
  const sw = generateWorld('stavba');
  const lw = generateWorld('louka');
  let okAll = true;
  for (let d = 1; d <= 40; d++)
    for (const o of ordersForDay(d)) {
      const w = o.location === 'stavba' ? sw : lw;
      if (o.featureIds && !o.featureIds.every((id) => w.features.some((f) => f.id === id))) okAll = false;
      if (o.reconMarks && !o.reconMarks.every((id) => w.marks.some((m) => m.id === id))) okAll = false;
      if (o.stake === 'dum') {
        const parcel = rectCorners(LAYOUT.parcel);
        if (!designTargets(o, w).every((t) => inPolygon(t.world.x, t.world.z, parcel))) okAll = false;
      }
    }
  check('40 dní objednávek: prvky i body existují, dům je na parcele', okAll);
}

if (failed) throw new Error(`Selhalo testů: ${failed}`);
console.log('\nVšechny testy prošly.');
