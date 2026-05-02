import type { BurgerOrderSnapshot } from '../../../app/models/burger-game.model';
import { Order } from './order';

export class Customer {
  readonly order: Order;
  patience: number;
  readonly maxPatience: number;
  readonly displayName: string;

  constructor(order: Order, maxPatience: number, displayName: string) {
    this.order = order;
    this.maxPatience = maxPatience;
    this.patience = maxPatience;
    this.displayName = displayName;
  }

  toSnapshot(): BurgerOrderSnapshot {
    return {
      id: this.order.id,
      customerName: this.displayName,
      ingredients: [...this.order.ingredients],
      patience: this.patience,
      maxPatience: this.maxPatience,
    };
  }
}

const NAMES = ['阿明', '小莉', '杰克', '美玲', '老周', '艾米'];

export function randomCustomerName(rng: () => number): string {
  return NAMES[Math.floor(rng() * NAMES.length)] ?? '顾客';
}
