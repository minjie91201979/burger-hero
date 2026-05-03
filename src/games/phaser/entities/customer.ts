import type { BurgerOrderSnapshot } from '../../../app/models/burger-game.model';
import {
  randomCustomerName as randomCustomerNameFromPool,
  randomCustomerNameExcluding,
} from '../../../app/data/customer-portraits';
import { Order } from './order';

export { randomCustomerNameFromPool as randomCustomerName, randomCustomerNameExcluding };

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
