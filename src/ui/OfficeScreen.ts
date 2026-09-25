export interface OfficeCard {
  id: string;
  title: string;
  place: string;
  pay: string;
  difficulty: number;
  status: string;
  tone: 'new' | 'active' | 'done' | 'bad';
}

export interface KitRow {
  name: string;
  where: string;
  ok: boolean;
}

export interface OfficeView {
  day: string;
  clock: string;
  money: string;
  cards: OfficeCard[];
  selected: string | null;
  detail: {
    title: string;
    client: string;
    place: string;
    brief: string;
    steps: string[];
    pay: string;
    kit: KitRow[];
    actions: { id: string; label: string; primary?: boolean }[];
  } | null;
  note: string;
  shop: { id: string; name: string; desc: string; price: string; owned: boolean; canBuy: boolean }[];
}

/**
 * Dispečink v kanceláři: nástěnka zakázek s odměnou, obtížností a kontrolou vybavení.
 */
export class OfficeScreen {
  private readonly el: HTMLElement;
  private key = '';
  onAction: ((id: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'office';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="office-body">
        <header class="office-head">
          <h2>Dispečink zakázek</h2>
          <span class="office-meta"></span>
          <button class="office-close" aria-label="Zavřít">Zavřít</button>
        </header>
        <div class="office-main">
          <ul class="office-cards"></ul>
          <section class="office-detail"></section>
        </div>
        <footer class="office-foot"><span class="office-note"></span><button class="office-end" data-act="endDay">Ukončit směnu</button></footer>
      </div>`;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.office-close')) return this.hide();
      const b = t.closest<HTMLElement>('[data-act]');
      if (b) this.onAction?.(b.dataset.act ?? '');
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  show(): void {
    this.el.hidden = false;
    this.key = '';
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  update(v: OfficeView): void {
    if (this.el.hidden) return;
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    const q = (s: string): HTMLElement => this.el.querySelector(s) as HTMLElement;
    q('.office-meta').textContent = `${v.day} · ${v.clock} · účet ${v.money}`;
    q('.office-note').textContent = v.note;
    const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    q('.office-cards').innerHTML = v.cards
      .map(
        (c) => `<li><button class="office-card is-${c.tone}${c.id === v.selected ? ' is-sel' : ''}" data-act="pick:${c.id}">
          <span class="oc-title">${esc(c.title)}</span>
          <span class="oc-place">${esc(c.place)}</span>
          <span class="oc-row"><span class="oc-pay">${esc(c.pay)}</span><span class="oc-diff">${'●'.repeat(c.difficulty)}${'○'.repeat(3 - c.difficulty)}</span><span class="oc-status">${esc(c.status)}</span></span>
        </button></li>`,
      )
      .join('') +
      `<li class="office-shop-h">Vybavení k zakoupení</li>` +
      v.shop
        .map(
          (u) => `<li><button class="office-card is-shop${u.owned ? ' is-owned' : ''}" data-act="buy:${u.id}" ${u.owned || !u.canBuy ? 'disabled' : ''}>
          <span class="oc-title">${esc(u.name)}</span>
          <span class="oc-place">${esc(u.desc)}</span>
          <span class="oc-row"><span class="oc-pay">${u.owned ? 'Koupeno' : esc(u.price)}</span><span class="oc-status">${u.owned ? '✓' : u.canBuy ? 'Koupit' : 'Málo peněz'}</span></span>
        </button></li>`,
        )
        .join('');
    const d = v.detail;
    q('.office-detail').innerHTML = d
      ? `<h3>${esc(d.title)}</h3>
         <p class="od-client">${esc(d.client)} · ${esc(d.place)}</p>
         <p class="od-brief">${esc(d.brief)}</p>
         <p class="od-pay">Odměna <strong>${esc(d.pay)}</strong></p>
         <h4>Postup</h4>
         <ol class="od-steps">${d.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
         <h4>Vybavení do dodávky</h4>
         <ul class="od-kit">${d.kit.map((k) => `<li class="${k.ok ? 'is-ok' : 'is-miss'}"><span>${k.ok ? '✓' : '✗'} ${esc(k.name)}</span><span>${esc(k.where)}</span></li>`).join('')}</ul>
         <div class="od-actions">${d.actions.map((a) => `<button data-act="${a.id}" class="${a.primary ? 'is-primary' : ''}">${esc(a.label)}</button>`).join('')}</div>`
      : '<p class="od-empty">Vyber zakázku vlevo.</p>';
  }
}
