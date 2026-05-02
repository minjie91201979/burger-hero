import type { IngredientId } from '../../../app/models/burger-game.model';

const OPTIONAL_TOPPINGS: IngredientId[] = ['lettuce', 'cheese'];

function shufflePick<T>(arr: T[], count: number): T[] {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, Math.min(count, copy.length));
}

export class Order {
  readonly id: string;
  readonly ingredients: IngredientId[];

  constructor(id: string, ingredients: IngredientId[]) {
    this.id = id;
    this.ingredients = ingredients;
  }

  static randomOrder(rng: () => number): Order {
    const id = `ord_${Math.floor(rng() * 1e9)}`;
    const toppingCount = Math.floor(rng() * 3);
    const toppings = shufflePick(OPTIONAL_TOPPINGS, toppingCount);
    const ingredients: IngredientId[] = ['bun_bottom', ...toppings, 'patty_cooked', 'bun_top'];
    return new Order(id, ingredients);
  }

  matchesStack(stack: IngredientId[]): boolean {
    if (stack.length !== this.ingredients.length) return false;
    return stack.every((s, i) => s === this.ingredients[i]);
  }
}
