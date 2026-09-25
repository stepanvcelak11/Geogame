import type { Vec3 } from '../core/math';
import type { InspectPayload } from '../events';
import { MARK_TYPE_NAME, type ControlMark } from '../world/World';

/** Místopis bodu pro panel. Souřadnice jako v seznamu souřadnic: bez oddělovačů tisíců, na cm. */
export function describeMark(mark: ControlMark, observer: Vec3): InspectPayload {
  const d = Math.hypot(mark.pos.x - observer.x, mark.pos.z - observer.z);
  const c = mark.catalog;
  const rows: [string, string][] =
    mark.type === 'NZ'
      ? [
          ['H (Bpv)', c.H.toFixed(3)],
          ['Y, X', `${c.Y.toFixed(0)}, ${c.X.toFixed(0)} (jen orientačně)`],
        ]
      : [
          ['Y', c.Y.toFixed(2)],
          ['X', c.X.toFixed(2)],
          ['H (Bpv)', c.H.toFixed(2)],
        ];
  rows.push(['Stabilizace', mark.stabilization]);
  if (mark.conditionNote) rows.push(['Stav', mark.conditionNote]);
  rows.push(['Od tebe', `${d.toFixed(1)} m`]);
  return { title: mark.number, subtitle: MARK_TYPE_NAME[mark.type], rows, description: mark.description };
}
