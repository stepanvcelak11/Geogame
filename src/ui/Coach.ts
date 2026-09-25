/**
 * Úvod do ovládání: postupně zvýrazní části obrazovky (tlačítka, oblasti) a vysvětlí je.
 * Ukáže se při prvním spuštění a znovu z příručky.
 */
interface Mark {
  sel?: string; // prvek k zvýraznění
  area?: 'left' | 'right'; // nebo polovina obrazovky
  title: string;
  text: string;
}

const KEY = 'geodet-uvod-v1';

export function coachSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* nevadí */
  }
}

export function showCoach(root: HTMLElement, touch: boolean, onDone?: () => void): void {
  const marks: Mark[] = touch
    ? [
        { area: 'left', title: 'Chůze', text: 'Levým palcem táhni kdekoli v levé polovině – chodíš. V autě je to plyn, brzda a volant.' },
        { area: 'right', title: 'Rozhlížení', text: 'Pravým palcem táhni v pravé polovině – rozhlížíš se.' },
        { sel: '.tb-action', title: 'Akční tlačítko', text: 'Dělá to, co je zrovna potřeba: Zvednout, Otevřít, Sestavit, Změřit… Nápis nad ním říká co.' },
        { sel: '.goal', title: 'Co dál?', text: 'Vždy radí další krok. Šipka a vzdálenost ukazují, kam jít. Nad cílem svítí žlutý sloup.' },
        { sel: '.map-btn', title: 'Tablet', text: 'Zakázky, mapa, zaměřené body a odjezd dodávkou.' },
        { sel: '.help-btn', title: 'Příručka', text: 'Když nevíš, jak na to: postup krok za krokem a proč se to tak dělá.' },
        { sel: '.hands', title: 'Ruce', text: 'Co držíš v levé a pravé ruce. Ťuknutím přepneš aktivní ruku, Položit ji vyprázdní.' },
      ]
    : [
        { area: 'left', title: 'Chůze a rozhlížení', text: 'WASD chůze, myš rozhlížení (klikni do scény), mezerník skok, C přikrčit.' },
        { sel: '.prompt', title: 'Akce (E)', text: 'Když se díváš na věc nebo bod, dole se ukáže, co s ním jde udělat. Klávesa E.' },
        { sel: '.goal', title: 'Co dál?', text: 'Vždy radí další krok. Šipka a vzdálenost ukazují, kam jít.' },
        { sel: '.map-btn', title: 'Tablet (M)', text: 'Zakázky, mapa, zaměřené body a odjezd dodávkou.' },
        { sel: '.help-btn', title: 'Příručka (?)', text: 'Postup krok za krokem a proč se to tak dělá.' },
        { sel: '.hands', title: 'Ruce (Q, G)', text: 'Co držíš. Q přepne ruku, G položí věc z aktivní ruky.' },
      ];
  let i = 0;
  const el = document.createElement('div');
  el.className = 'coach';
  root.appendChild(el);
  const finish = (): void => {
    markSeen();
    el.remove();
    removeEventListener('resize', draw);
    onDone?.();
  };
  const visible = (m: Mark): boolean => {
    if (!m.sel) return true;
    const t = root.querySelector(m.sel) as HTMLElement | null;
    return !!t && !t.hidden && t.getBoundingClientRect().width > 0;
  };
  function draw(): void {
    while (i < marks.length && !visible(marks[i])) i++;
    if (i >= marks.length) return finish();
    const m = marks[i];
    const vw = innerWidth;
    const vh = innerHeight;
    let r = { x: vw * 0.3, y: vh * 0.4, w: vw * 0.4, h: vh * 0.2 };
    if (m.area) r = m.area === 'left' ? { x: 8, y: vh * 0.25, w: vw / 2 - 16, h: vh * 0.7 } : { x: vw / 2 + 8, y: vh * 0.25, w: vw / 2 - 16, h: vh * 0.7 };
    else if (m.sel) {
      const t = root.querySelector(m.sel) as HTMLElement | null;
      const b = t && !t.hidden ? t.getBoundingClientRect() : null;
      if (b && b.width > 0) r = { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 };
    }
    // Karta s textem na opačnou stranu, než je zvýraznění.
    const below = r.y + r.h / 2 < vh / 2;
    const left = Math.min(Math.max(12, r.x + r.w / 2 - 170), vw - 352);
    el.innerHTML = `
      <div class="coach-hole" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>
      <div class="coach-card" style="left:${left}px;top:${below ? Math.min(vh - 170, r.y + r.h + 12) : Math.max(8, r.y - 182)}px">
        <p class="coach-n">${i + 1} / ${marks.length}</p>
        <h3>${m.title}</h3>
        <p>${m.text}</p>
        <div class="coach-actions"><button class="coach-skip">Přeskočit</button><button class="coach-next">${i + 1 < marks.length ? 'Další' : 'Rozumím, jdeme na to'}</button></div>
      </div>`;
  }
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.coach-skip')) return finish();
    if (t.closest('.coach-next')) {
      i++;
      if (i >= marks.length) return finish();
      draw();
    }
  });
  addEventListener('resize', draw);
  draw();
}
