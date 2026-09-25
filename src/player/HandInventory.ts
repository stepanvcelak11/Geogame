import type { Hand } from '../items/items';

/**
 * Dvě ruce, v každé jeden předmět. Jedna ruka je aktivní: s její věcí se pracuje
 * a ta se pokládá. Nově zvednutá věc se stane aktivní.
 */
export class HandInventory {
  private readonly slots: Record<Hand, string | null> = { right: null, left: null };
  active: Hand = 'right';

  get(hand: Hand): string | null {
    return this.slots[hand];
  }

  activeItem(): string | null {
    return this.slots[this.active];
  }

  freeHand(): Hand | null {
    if (!this.slots[this.active]) return this.active;
    const other: Hand = this.active === 'right' ? 'left' : 'right';
    return this.slots[other] ? null : other;
  }

  put(itemId: string): Hand | null {
    const hand = this.freeHand();
    if (!hand) return null;
    this.slots[hand] = itemId;
    this.active = hand;
    return hand;
  }

  release(hand: Hand): string | null {
    const id = this.slots[hand];
    this.slots[hand] = null;
    return id;
  }

  setActive(hand: Hand): void {
    this.active = hand;
  }

  switchActive(): Hand {
    this.active = this.active === 'right' ? 'left' : 'right';
    return this.active;
  }

  heldIds(): string[] {
    return [this.slots.right, this.slots.left].filter((x): x is string => x !== null);
  }
}
