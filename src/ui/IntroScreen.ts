/**
 * Úvodní obrazovka: animované vrstevnice na pozadí, název, nová směna / pokračování, ovládání.
 */
export function showIntro(
  root: HTMLElement,
  opts: { touch: boolean; save: { day: number; money: string } | null; onSettings?: () => void },
  onStart: (mode: 'new' | 'continue') => void,
): void {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `
    <canvas class="intro-bg" aria-hidden="true"></canvas>
    <div class="intro-card">
      <p class="intro-kicker">Terénní simulátor zeměměřiče</p>
      <h1 class="intro-title">GEODET</h1>
      <p class="intro-lead">Ráno v kanceláři vybereš zakázky, sbalíš vybavení do dodávky a vyrazíš na stavbu nebo na louku. GNSS, totální stanice, nivelace. Měří se na milimetry.</p>
      <div class="intro-actions">
        ${opts.save ? `<button class="start-continue">Pokračovat<small>Den ${opts.save.day} · ${opts.save.money}</small></button>` : ''}
        <button class="start-go">${opts.save ? 'Nová kariéra' : 'Začít první směnu'}</button>
      </div>
      <button class="intro-settings">Nastavení grafiky a ovládání</button>
      <details class="intro-help">
        <summary>Ovládání</summary>
        ${
          opts.touch
            ? '<p>Levý palec chůze nebo v autě plyn a volant. Pravá polovina rozhlížení. Žluté tlačítko dělá akci podle situace. Sloty rukou nahoře vpravo přepínají ruku. Bublinu libely na výtyčce táhni do kroužku.</p>'
            : '<p>WASD chůze / jízda, myš rozhlížení, E akce, Q přepnout ruku, G položit, M tablet, F baterka, C přikrčit. Bublinu libely na výtyčce táhni myší do kroužku.</p>'
        }
      </details>
    </div>`;
  root.appendChild(el);

  // Pozadí: pomalu plující vrstevnice a měřické body.
  const c = el.querySelector('canvas') as HTMLCanvasElement;
  const g = c.getContext('2d');
  let raf = 0;
  const t0 = performance.now();
  const draw = (now: number): void => {
    if (!g) return;
    const w = (c.width = Math.round(c.clientWidth * Math.min(devicePixelRatio, 2)));
    const h = (c.height = Math.round(c.clientHeight * Math.min(devicePixelRatio, 2)));
    const t = (now - t0) / 1000;
    g.fillStyle = '#1b2023';
    g.fillRect(0, 0, w, h);
    const s = Math.min(w, h);
    for (let k = 0; k < 16; k++) {
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const r = s * (0.08 + k * 0.045) * (1 + 0.12 * Math.sin(a * 3 + t * 0.2 + k * 0.4) + 0.06 * Math.sin(a * 5 - t * 0.15));
        const x = w * 0.68 + Math.cos(a) * r * 1.3;
        const y = h * 0.52 + Math.sin(a) * r;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.strokeStyle = k % 5 === 0 ? 'rgba(193, 120, 70, 0.55)' : 'rgba(193, 120, 70, 0.22)';
      g.lineWidth = (k % 5 === 0 ? 2 : 1) * Math.min(devicePixelRatio, 2);
      g.stroke();
    }
    const pts = [
      [0.55, 0.3],
      [0.83, 0.7],
      [0.7, 0.2],
      [0.92, 0.38],
    ];
    pts.forEach(([px, py], i) => {
      const x = w * px;
      const y = h * py;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
      g.strokeStyle = `rgba(242, 183, 5, ${0.4 + pulse * 0.5})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y - 10);
      g.lineTo(x + 9, y + 6);
      g.lineTo(x - 9, y + 6);
      g.closePath();
      g.stroke();
      g.setLineDash([6, 6]);
      g.beginPath();
      g.moveTo(x, y);
      const n = pts[(i + 1) % pts.length];
      g.lineTo(w * n[0], h * n[1]);
      g.strokeStyle = 'rgba(242, 183, 5, 0.25)';
      g.stroke();
      g.setLineDash([]);
    });
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const go = (mode: 'new' | 'continue'): void => {
    cancelAnimationFrame(raf);
    el.remove();
    onStart(mode);
  };
  el.querySelector('.intro-settings')?.addEventListener('click', () => opts.onSettings?.());
  el.querySelector('.start-go')?.addEventListener('click', () => go('new'));
  el.querySelector('.start-continue')?.addEventListener('click', () => go('continue'));
}
