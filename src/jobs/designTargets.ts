import { DEG } from '../core/math';
import type { World } from '../world/World';
import { LAYOUT, MEADOW, rectCorners } from '../world/WorldGen';
import type { JobSpec } from './JobCatalog';
import type { StakeTarget } from './StakeoutTask';

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Projektové souřadnice vytyčovaných bodů (S-JTSK na cm) a jejich poloha v herním rámci. */
export function designTargets(spec: JobSpec, world: World): StakeTarget[] {
  const f = world.frame;
  const make = (id: string, label: string, x: number, z: number, existingMarkId?: string): StakeTarget => {
    const c = f.toSjtsk({ x, y: 0, z });
    const design = { Y: round2(c.Y), X: round2(c.X) };
    const w = f.toWorld({ ...design, H: f.originH });
    return { id, label, design, world: { x: w.x, z: w.z }, existingMarkId };
  };
  if (spec.stake === 'dum') {
    // Dům 11 × 8,5 m rovnoběžně s parcelou, 2 m od severní hrany středu.
    const P = LAYOUT.parcel;
    const rot = P.rotDeg * DEG;
    const cx = P.x + Math.sin(rot) * 2;
    const cz = P.z - Math.cos(rot) * 2;
    return rectCorners({ x: cx, z: cz, halfU: 5.5, halfV: 4.25, rotDeg: P.rotDeg }).map((p, i) =>
      make(String(201 + i), `Roh domu ${201 + i}`, p.x, p.z),
    );
  }
  if (spec.stake === 'parcela') {
    // Hranice parcely 1254/3: lomy 101–104, ověřují se jen mezníky, které jsou v pořádku.
    return rectCorners(LAYOUT.parcel).map((p, i) => {
      const id = String(101 + i);
      const mark = world.marks.find((m) => m.id === `HZ-${id}` && m.condition === 'ok');
      return make(id, `Lom hranice ${id}`, p.x, p.z, mark?.id);
    });
  }
  const corners = rectCorners(MEADOW.parcel);
  return corners.map((p, i) => {
    const id = String(301 + i);
    const mark = world.marks.find((m) => m.id === `HZ-${id}`);
    return make(id, `Lom hranice ${id}`, p.x, p.z, mark?.id);
  });
}
