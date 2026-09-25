import type { MeasuredPoint } from './PointLog';

/** Formáty exportu zápisníku. */
export type ExportFormat = 'csv' | 'txt' | 'dxf';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; mime: string }[] = [
  { id: 'csv', label: 'CSV', mime: 'text/csv' },
  { id: 'txt', label: 'TXT', mime: 'text/plain' },
  { id: 'dxf', label: 'DXF', mime: 'application/dxf' },
];

/** CSV se středníky (Excel v češtině): číslo;Y;X;H;kód;metoda;řešení;lokalita. */
export function pointsCsv(points: MeasuredPoint[]): string {
  const rows = ['cislo;Y;X;H;kod;metoda;reseni;lokalita'];
  for (const p of points) rows.push([p.id, p.Y.toFixed(3), p.X.toFixed(3), p.Z.toFixed(3), p.code, p.method, p.solution, p.location].join(';'));
  return rows.join('\r\n') + '\r\n';
}

/** Seznam souřadnic s pevnou šířkou sloupců, jak ho čtou měřické programy. */
export function pointsTxt(points: MeasuredPoint[]): string {
  const rows = points.map(
    (p) => `${p.id.padEnd(10)}${p.Y.toFixed(3).padStart(14)}${p.X.toFixed(3).padStart(14)}${p.Z.toFixed(3).padStart(10)}  ${p.code}`,
  );
  return ['# Seznam souradnic S-JTSK / Bpv', '# cislo            Y             X         H  kod', ...rows].join('\r\n') + '\r\n';
}

/**
 * DXF R12: každý bod jako POINT s číslem a kódem vedle.
 * S-JTSK míří osami na západ a jih, v CAD se proto kreslí x = −Y, y = −X.
 */
export function pointsDxf(points: MeasuredPoint[]): string {
  const out: (string | number)[] = [0, 'SECTION', 2, 'ENTITIES'];
  for (const p of points) {
    const x = (-p.Y).toFixed(3);
    const y = (-p.X).toFixed(3);
    const z = p.Z.toFixed(3);
    out.push(0, 'POINT', 8, p.code, 10, x, 20, y, 30, z);
    out.push(0, 'TEXT', 8, 'CISLA', 10, (-p.Y + 0.3).toFixed(3), 20, (-p.X + 0.3).toFixed(3), 30, z, 40, '0.5', 1, p.id);
  }
  out.push(0, 'ENDSEC', 0, 'EOF');
  return out.join('\r\n') + '\r\n';
}

export function exportPoints(points: MeasuredPoint[], format: ExportFormat): string {
  return format === 'csv' ? pointsCsv(points) : format === 'txt' ? pointsTxt(points) : pointsDxf(points);
}
