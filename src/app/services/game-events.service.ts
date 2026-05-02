import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import type { BurgerOrderSnapshot, GameSaveData } from '../models/burger-game.model';

@Injectable({ providedIn: 'root' })
export class GameEventsService {
  /** 在创建 Phaser 游戏前由应用写入，供厨房场景读取 */
  initialSave: GameSaveData | null = null;

  public money$ = new Subject<number>();
  public combo$ = new Subject<number>();
  public score$ = new Subject<number>();
  public ordersChanged$ = new Subject<BurgerOrderSnapshot[]>();
  public customerLeave$ = new Subject<void>();
  public toast$ = new Subject<string>();
  public upgradePurchased$ = new Subject<string>();
  public purchasedUpgrades$ = new Subject<string[]>();
  public newDayStarted$ = new Subject<void>();

  private snapshotReader: (() => GameSaveData | null) | null = null;

  constructor(private readonly zone: NgZone) {}

  registerSnapshotReader(fn: () => GameSaveData | null): void {
    this.snapshotReader = fn;
  }

  clearSnapshotReader(): void {
    this.snapshotReader = null;
  }

  readSnapshot(): GameSaveData | null {
    return this.snapshotReader?.() ?? null;
  }

  emitMoney(value: number): void {
    this.zone.run(() => this.money$.next(value));
  }

  emitCombo(value: number): void {
    this.zone.run(() => this.combo$.next(value));
  }

  emitScore(value: number): void {
    this.zone.run(() => this.score$.next(value));
  }

  emitOrdersChanged(orders: BurgerOrderSnapshot[]): void {
    this.zone.run(() => this.ordersChanged$.next(orders));
  }

  emitCustomerLeave(): void {
    this.zone.run(() => this.customerLeave$.next());
  }

  emitToast(message: string): void {
    this.zone.run(() => this.toast$.next(message));
  }

  emitUpgradePurchased(upgradeId: string): void {
    this.zone.run(() => this.upgradePurchased$.next(upgradeId));
  }

  emitNewDay(): void {
    this.zone.run(() => this.newDayStarted$.next());
  }

  emitPurchasedUpgrades(ids: string[]): void {
    this.zone.run(() => this.purchasedUpgrades$.next(ids));
  }
}
