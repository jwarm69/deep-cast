import { Component, FishingState, Events, CatchData } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { FishRaritySystem } from '../fish/FishRaritySystem';
import { Bobber } from '../entities/Bobber';
import { FishingLine } from '../entities/FishingLine';
import { FishingRod } from '../entities/FishingRod';
import { PlayerState } from '../state/PlayerState';

export class FishingStateMachine implements Component {
  private events: EventSystem;
  private input: InputManager;
  private raritySystem: FishRaritySystem;
  private bobber: Bobber;
  private line: FishingLine;
  private rod: FishingRod;
  private player: PlayerState | null = null;

  public state = FishingState.IDLE;

  // Casting
  private castPower = 0;

  // Flight
  private flightProgress = 0;
  private flightStart = { x: 0, z: 0 };
  private flightTarget = { x: 0, z: 0 };

  // Waiting
  private waitTimer = 0;
  private waitDuration = 0;

  // Biting
  private biteTimer = 0;
  private biteDuration = 3.0;

  // Reeling
  private reelProgress = 0;
  private reelDifficulty = 0.5;
  private reelFishName = '';

  // Catch
  private pendingCatch: CatchData | null = null;

  // Escaped
  private escapedTimer = 0;

  // Debounce: prevent immediate re-trigger after dismiss
  private justDismissed = false;

  constructor(
    events: EventSystem,
    input: InputManager,
    bobber: Bobber,
    line: FishingLine,
    rod: FishingRod,
  ) {
    this.events = events;
    this.input = input;
    this.raritySystem = new FishRaritySystem();
    this.bobber = bobber;
    this.line = line;
    this.rod = rod;
  }

  setPlayerState(player: PlayerState): void {
    this.player = player;
  }

  /** True if space or left-click is active (for fishing actions) */
  private get actionDown(): boolean {
    return this.input.spaceDown || this.input.mouseDown;
  }

  private setState(newState: FishingState): void {
    this.state = newState;
    this.events.emit(Events.STATE_CHANGE, { state: newState });
  }

  update(dt: number): void {
    switch (this.state) {
      case FishingState.IDLE:
        this.updateIdle();
        break;
      case FishingState.CASTING:
        this.updateCasting(dt);
        break;
      case FishingState.FLIGHT:
        this.updateFlight(dt);
        break;
      case FishingState.WAITING:
        this.updateWaiting(dt);
        break;
      case FishingState.BITING:
        this.updateBiting(dt);
        break;
      case FishingState.REELING:
        this.updateReeling(dt);
        break;
      case FishingState.CAUGHT:
        this.updateCaught();
        break;
      case FishingState.ESCAPED:
        this.updateEscaped(dt);
        break;
    }

    this.updateLine();
  }

  // --- IDLE ---
  private updateIdle(): void {
    // Debounce: wait for space release after dismissing catch
    if (this.justDismissed) {
      if (!this.input.spaceDown) this.justDismissed = false;
      return;
    }
    if (this.input.spaceDown) {
      this.castPower = 0;
      this.setState(FishingState.CASTING);
      this.events.emit(Events.CAST_START);
    }
  }

  // --- CASTING ---
  private updateCasting(dt: number): void {
    if (this.input.spaceDown) {
      this.castPower += dt * 65;
      if (this.castPower > 100) this.castPower = 100;
    } else {
      this.launchBobber();
    }
  }

  private launchBobber(): void {
    const power = Math.max(this.castPower, 10);
    const castMult = this.player?.activeRod.castPowerMultiplier ?? 1;
    const maxDist = 25 * castMult;
    const dist = (power / 100) * maxDist;

    const tip = this.rod.tipPosition;
    this.flightStart.x = tip.x;
    this.flightStart.z = tip.z;

    const spread = (Math.random() - 0.5) * 3;
    this.flightTarget.x = tip.x + spread;
    this.flightTarget.z = tip.z + dist;

    this.flightProgress = 0;
    this.setState(FishingState.FLIGHT);
    this.events.emit(Events.CAST_RELEASE, { power, distance: dist });
    this.line.show();
  }

  // --- FLIGHT ---
  private updateFlight(dt: number): void {
    this.flightProgress += dt * 2.5;

    if (this.flightProgress >= 1) {
      this.flightProgress = 1;
      this.bobber.show(this.flightTarget.x, this.flightTarget.z);
      const biteMult = this.player?.activeLure.biteSpeedMultiplier ?? 1;
      this.waitDuration = (2 + Math.random() * 6) / biteMult;
      this.waitTimer = 0;
      this.setState(FishingState.WAITING);
      this.events.emit(Events.BOBBER_LAND);
    } else {
      const t = this.flightProgress;
      const x = this.flightStart.x + (this.flightTarget.x - this.flightStart.x) * t;
      const z = this.flightStart.z + (this.flightTarget.z - this.flightStart.z) * t;
      const arcY = Math.sin(t * Math.PI) * 4;
      this.bobber.position.set(x, arcY, z);
      this.bobber.mesh.position.set(x, arcY, z);
      this.bobber.mesh.visible = true;
    }
  }

  // --- WAITING ---
  private updateWaiting(dt: number): void {
    this.waitTimer += dt;
    if (this.waitTimer >= this.waitDuration) {
      this.bobber.setSinking(true);
      this.biteTimer = 0;
      this.biteDuration = 2.0 + Math.random() * 1.5;
      this.setState(FishingState.BITING);
      this.events.emit(Events.FISH_BITE);
    }
  }

  // --- BITING ---
  private updateBiting(dt: number): void {
    this.biteTimer += dt;

    if (this.actionDown) {
      this.bobber.setSinking(false);
      const rarityBonus = this.player?.activeLure.rareBonusChance ?? 0;
      const fish = this.raritySystem.rollFish(rarityBonus);
      this.reelDifficulty = fish.reelDifficulty;
      this.reelFishName = fish.name;
      this.reelProgress = 0;

      const weight = this.raritySystem.rollWeight(fish);
      const coins = this.raritySystem.rollCoins(fish);
      this.pendingCatch = { species: fish, weight, coins, xp: fish.xpReward };

      this.setState(FishingState.REELING);
      this.events.emit(Events.REEL_START, { fishName: fish.name, rarity: fish.rarity });
      return;
    }

    if (this.biteTimer >= this.biteDuration) {
      this.resetFishing();
      this.setState(FishingState.ESCAPED);
      this.escapedTimer = 0;
      this.events.emit(Events.FISH_ESCAPED);
    }
  }

  // --- REELING ---
  private updateReeling(dt: number): void {
    const reelMult = this.player?.activeRod.reelSpeedMultiplier ?? 1;
    const fillRate = ((1 - this.reelDifficulty) * 0.6 + 0.15) * reelMult;
    const drainRate = 0.12 + this.reelDifficulty * 0.15;

    if (this.actionDown) {
      this.reelProgress += fillRate * dt;
    } else {
      this.reelProgress -= drainRate * dt;
    }
    this.reelProgress = Math.max(0, Math.min(1, this.reelProgress));

    this.events.emit(Events.REEL_PROGRESS, {
      progress: this.reelProgress,
      fishName: this.reelFishName,
    });

    this.bobber.setSinking(this.actionDown);

    if (this.reelProgress >= 1) {
      this.setState(FishingState.CAUGHT);
      this.events.emit(Events.FISH_CAUGHT, this.pendingCatch);
      this.resetFishing();
    }
  }

  // --- CAUGHT ---
  private updateCaught(): void {
    if (this.actionDown) {
      this.events.emit(Events.CATCH_DISMISSED);
      this.justDismissed = true;
      this.setState(FishingState.IDLE);
    }
  }

  // --- ESCAPED ---
  private updateEscaped(dt: number): void {
    this.escapedTimer += dt;
    if (this.escapedTimer >= 2.0) {
      this.setState(FishingState.IDLE);
    }
  }

  private resetFishing(): void {
    this.bobber.hide();
    this.line.hide();
    this.castPower = 0;
  }

  private updateLine(): void {
    if (this.state === FishingState.IDLE || this.state === FishingState.CAUGHT) return;

    this.line.startPoint.copy(this.rod.tipPosition);
    if (this.bobber.mesh.visible) {
      this.line.endPoint.copy(this.bobber.mesh.position);
    } else {
      this.line.endPoint.copy(this.rod.tipPosition);
    }
  }

  get currentCastPower(): number { return this.castPower; }
  get currentReelProgress(): number { return this.reelProgress; }
  get currentReelFishName(): string { return this.reelFishName; }
  get lastCatch(): CatchData | null { return this.pendingCatch; }

  destroy(): void {}
}
