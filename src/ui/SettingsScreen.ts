import { preset, type Settings, type Tier } from '../settings/Settings';

type Opt<T> = { v: T; label: string };

/** Nastavení: grafika, ovládání, zvuk, hra. Změny se projeví hned. */
export class SettingsScreen {
  private readonly el: HTMLElement;
  private s: Settings | null = null;
  private resetArmed = false;
  onChange: ((s: Settings) => void) | null = null;
  /** Zjištěná třída zařízení (pro popisek a doporučení). */
  tier: Tier = 'mid';
  onResetCareer: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'settings';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (!this.s) return;
      if (t.closest('.set-close') || t === this.el) return this.hide();
      if (t.closest('.set-reset')) {
        if (!this.resetArmed) {
          this.resetArmed = true;
          (t.closest('.set-reset') as HTMLElement).textContent = 'Opravdu smazat? Klepni znovu';
          return;
        }
        this.onResetCareer?.();
        this.resetArmed = false;
        return this.render();
      }
      const pb = t.closest<HTMLButtonElement>('[data-preset]');
      if (pb) {
        this.s = { ...this.s, ...preset(pb.dataset.preset as Tier) };
        this.onChange?.(this.s);
        return this.render();
      }
      const b = t.closest<HTMLButtonElement>('[data-k]');
      if (!b) return;
      const k = b.dataset.k as keyof Settings;
      const raw = b.dataset.v ?? '';
      const v: unknown = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
      this.s = { ...this.s, [k]: v } as Settings;
      this.onChange?.(this.s);
      this.render();
    });
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (!this.s || !t.dataset.range) return;
      this.s = { ...this.s, [t.dataset.range]: Number(t.value) } as Settings;
      this.onChange?.(this.s);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(s: Settings): void {
    this.s = { ...s };
    this.resetArmed = false;
    this.render();
    this.el.hidden = false;
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  private render(): void {
    const s = this.s;
    if (!s) return;
    const seg = <T extends string | number | boolean>(key: keyof Settings, label: string, opts: Opt<T>[]): string =>
      `<div class="set-row"><span>${label}</span><div class="set-seg">${opts
        .map((o) => `<button data-k="${key}" data-v="${o.v}" aria-pressed="${s[key] === o.v}">${o.label}</button>`)
        .join('')}</div></div>`;
    const onoff = (key: keyof Settings, label: string): string =>
      seg(key, label, [
        { v: true, label: 'Zap' },
        { v: false, label: 'Vyp' },
      ]);
    const range = (key: 'lookSens' | 'volume', label: string, min: number, max: number, step: number): string =>
      `<div class="set-row"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></div>`;
    this.el.innerHTML = `<div class="set-body">
      <h2>Nastavení</h2>
      <h3>Grafika</h3>
      <div class="set-row"><span>Předvolba</span><div class="set-seg">${(
        [
          ['low', 'Slabý telefon'],
          ['mid', 'Běžný'],
          ['high', 'Výkonný'],
        ] as const
      )
        .map(([k, l]) => `<button data-preset="${k}">${l}${this.tier === k ? ' ✓' : ''}</button>`)
        .join('')}</div></div>
      <p class="set-note">Zjištěno: ${{ low: 'slabší telefon – doporučená úsporná grafika', mid: 'běžný telefon', high: 'počítač nebo výkonné zařízení' }[this.tier]}. Předvolba nastaví všechno níže najednou.</p>
      ${seg('gfx', 'Kvalita', [
        { v: 0, label: 'Úsporná' },
        { v: 1, label: 'Realistická' },
        { v: 2, label: 'Vysoká' },
      ])}
      <p class="set-note">Realistická: lesklé kovy a odrazy oblohy. Vysoká: navíc zastínění v koutech (AO), jen pro silnější zařízení. Materiály se plně změní po znovuotevření hry.</p>
      ${onoff('shadows', 'Stíny')}
      ${seg('grass', 'Tráva a kvítí', [
        { v: 0, label: 'Vyp' },
        { v: 1, label: 'Řídká' },
        { v: 2, label: 'Plná' },
      ])}
      ${seg('draw', 'Dohled', [
        { v: 0, label: 'Krátký' },
        { v: 1, label: 'Střední' },
        { v: 2, label: 'Dlouhý' },
      ])}
      ${onoff('saver', 'Úsporné rozlišení')}
      ${onoff('fps30', 'Úspora baterie (30 FPS)')}
      <p class="set-note">Když se hra seká: vypni stíny, zřeď trávu a zkrať dohled.</p>
      <h3>Ovládání</h3>
      ${range('lookSens', 'Citlivost rozhlížení', 0.4, 2, 0.1)}
      ${onoff('invertY', 'Obrátit osu Y')}
      <h3>Zvuk</h3>
      ${range('volume', 'Hlasitost', 0, 1, 0.05)}
      ${onoff('ambience', 'Zvuky okolí')}
      <h3>Hra</h3>
      ${onoff('guide', 'Průvodce „Co dál?“')}
      ${onoff('fps', 'Ukazatel FPS')}
      <button class="set-reset">Smazat uloženou kariéru</button>
      <button class="set-close">Hotovo</button>
    </div>`;
  }
}
