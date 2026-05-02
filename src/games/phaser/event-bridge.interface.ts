import type { BurgerOrderSnapshot } from '../../app/models/burger-game.model';

/** Phaser 侧只依赖此接口，避免从场景文件直接引用 Angular 服务类型。 */
export interface GameEventBridge {
  emitMoney(value: number): void;
  emitCombo(value: number): void;
  emitScore(value: number): void;
  emitOrdersChanged(orders: BurgerOrderSnapshot[]): void;
  emitCustomerLeave(): void;
  emitToast(message: string): void;
  emitUpgradePurchased(upgradeId: string): void;
  emitNewDay(): void;
  emitPurchasedUpgrades(ids: string[]): void;
  upgradePurchased$: { subscribe: (fn: (id: string) => void) => { unsubscribe: () => void } };
}
