import { Component, FishSpecies, FishingState, Events, CatchData } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { FishRaritySystem } from '../fish/FishRaritySystem';
import { Bobber } from '../entities/Bobber';
import { FishingLine } from '../entities/FishingLine';
import { FishingRod } from '../entities/FishingRod';
import { PlayerState } from '../state/PlayerState';
import { FightModel } from './FightModel';

export interface CastAim {
  direction: { x: number; z: number };
  minLandingX: number;
  maxLandingX: number;
  minLandingZ: number;
  maxLandingZ: number;
}

/** Environment modifiers (e.g. heavy fog events) */
export interface EnvironmentModifiers {
  biteSpeedMultiplier: number;
  rareBonus: number;
}

export class FishingStateMachine implements Component {
  private events: EventSystem;
  private input: InputManager;
  private raritySystem: FishRaritySystem;
  private bobber: Bobber;
  private line: FishingLine;
  private rod: FishingRod;
  private player: PlayerState | null = null;
  private castAimProvider: (() => CastAim) | null = null;

  public state = FishingState.IDLE;

  // Fish pools
  private currentShorePool: FishSpecies[] = [];
  private deepWaterFishPool: FishSpecies[] = [];
  private inDeepWater = false;

  // Environment modifiers (fog events etc.)
  private env: EnvironmentModifiers = { biteSpeedMultiplier: 1, rareBonus: 0 };

  // Casting
  private castPower = 0;

  // Flight
  private flightProgress = 0;
  private flightStart = { x: 0, z: 0 };
  private flightTarget = { x: 0, z: 0 };

  // Waiting
  private waitTimer = 0;
  private waitDuration = 0;

  // Lure twitch
  private spaceWasDown = false;
  private spaceHeldTime = 0;
  private twitchCooldown = 0;

  // Biting
  private biteTimer = 0;
  private biteDuration = 3.0;

  // Fish is rolled when the bobber lands so the approaching shadow can telegraph it
  private pendingCatch: CatchData | null = null;
  private reelFishName = '';

  // Fight
  private fight: FightModel | null = null;
  private fightAnchor = { x: 0, z: 0 };
  private fightActionWasDown = false;

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

  setCastAimProvider(provider: () => CastAim): void {
    this.castAimProvider = provider;
  }

  /** Swap the shore fish pool (for biome transitions) */
  setFishPool(species: FishSpecies[]): void {
    this.currentShorePool = species;
    this.applyFishPool();
  }

  /** Set the deep-water exclusive fish for current biome */
  setDeepFishPool(species: FishSpecies[]): void {
    this.deepWaterFishPool = species;
    this.applyFishPool();
  }

  /** Toggle deep water mode — merges deep fish into pool when true */
  setDeepWater(deep: boolean): void {
    this.inDeepWater = deep;
    this.applyFishPool();
  }

  /** Apply environment modifiers from world events (heavy fog, etc.) */
  setEnvironmentModifiers(env: Partial<EnvironmentModifiers>): void {
    this.env = {
      biteSpeedMultiplier: env.biteSpeedMultiplier ?? 1,
      rareBonus: env.rareBonus ?? 0,
    };
  }

  private applyFishPool(): void {
    if (this.inDeepWater && this.deepWaterFishPool.length > 0) {
      this.raritySystem.setSpecies([...this.currentShorePool, ...this.deepWaterFishPool]);
    } else {
      this.raritySystem.setSpecies(this.currentShorePool);
    }
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

    const aim = this.castAimProvider?.() ?? {
      direction: { x: 0, z: 1 },
      minLandingX: -45,
      maxLandingX: 45,
      minLandingZ: 4.5,
      maxLandingZ: 58,
    };
    const dirLen = Math.hypot(aim.direction.x, aim.direction.z) || 1;
    const dirX = aim.direction.x / dirLen;
    const dirZ = aim.direction.z / dirLen;
    const rightX = dirZ;
    const rightZ = -dirX;
    const spread = (Math.random() - 0.5) * (1.2 + dist * 0.08);

    this.flightTarget.x = tip.x + dirX * dist + rightX * spread;
    this.flightTarget.z = tip.z + dirZ * dist + rightZ * spread;
    this.flightTarget.x = Math.max(aim.minLandingX, Math.min(aim.maxLandingX, this.flightTarget.x));
    this.flightTarget.z = Math.max(aim.minLandingZ, Math.min(aim.maxLandingZ, this.flightTarget.z));

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
      const biteMult = (this.player?.activeLure.biteSpeedMultiplier ?? 1) * this.env.biteSpeedMultiplier;
      this.waitDuration = (2 + Math.random() * 6) / biteMult;
      this.waitTimer = 0;
      this.twitchCooldown = 0;
      this.spaceWasDown = this.input.spaceDown;
      this.spaceHeldTime = 0;

      // Roll the fish now so the approaching shadow can telegraph size and rarity
      this.rollPendingFish();

      this.setState(FishingState.WAITING);
      this.events.emit(Events.BOBBER_LAND, {
        x: this.flightTarget.x,
        z: this.flightTarget.z,
        waitDuration: this.waitDuration,
      });
      this.events.emit(Events.FISH_APPROACH, {
        x: this.flightTarget.x,
        z: this.flightTarget.z,
        arriveIn: this.waitDuration,
        rarity: this.pendingCatch!.species.rarity,
        weight: this.pendingCatch!.weight,
        maxWeight: this.pendingCatch!.species.maxWeight,
        isTrophy: this.pendingCatch!.isTrophy ?? false,
      });
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

  private rollPendingFish(): void {
    const lureBonus = this.player?.activeLure.rareBonusChance ?? 0;
    const boatBonus = this.player?.activeBoat?.rarityBoost ?? 0;
    const fish = this.raritySystem.rollFish(lureBonus + boatBonus + this.env.rareBonus);

    let weight = this.raritySystem.rollWeight(fish);
    let coins = this.raritySystem.rollCoins(fish);
    let xp = fish.xpReward;
    let isTrophy = false;

    // 4% chance for a Trophy variant
    const TROPHY_CHANCE = 0.04;
    if (Math.random() < TROPHY_CHANCE) {
      isTrophy = true;
      weight = +(weight * (1.5 + Math.random() * 1.5)).toFixed(2);
      coins = Math.round(coins * 1.75);
      xp = Math.round(xp * 1.5);
    }

    this.reelFishName = isTrophy ? `Trophy ${fish.name}` : fish.name;
    this.pendingCatch = { species: fish, weight, coins, xp, isTrophy };
  }

  // --- WAITING ---
  private updateWaiting(dt: number): void {
    this.waitTimer += dt;
    this.twitchCooldown = Math.max(0, this.twitchCooldown - dt);

    // Lure twitch: a quick space tap entices the fish, shortening the wait
    const spaceDown = this.input.spaceDown;
    if (spaceDown) {
      this.spaceHeldTime += dt;
    } else {
      if (this.spaceWasDown && this.spaceHeldTime < 0.3 && this.twitchCooldown <= 0) {
        this.twitchCooldown = 1.5;
        this.waitTimer += this.waitDuration * 0.12;
        this.bobber.twitch();
        this.events.emit(Events.LURE_TWITCH, {
          x: this.bobber.position.x,
          z: this.bobber.position.z,
        });
      }
      this.spaceHeldTime = 0;
    }
    this.spaceWasDown = spaceDown;

    if (this.waitTimer >= this.waitDuration) {
      this.bobber.setSinking(true);
      this.biteTimer = 0;
      this.biteDuration = 2.0 + Math.random() * 1.5;
      this.setState(FishingState.BITING);
      this.events.emit(Events.FISH_BITE, {
        x: this.bobber.position.x,
        z: this.bobber.position.z,
        rarity: this.pendingCatch?.species.rarity,
      });
    }
  }

  // --- BITING ---
  private updateBiting(dt: number): void {
    this.biteTimer += dt;

    if (this.actionDown) {
      this.bobber.setSinking(false);
      const fish = this.pendingCatch!;
      const rod = this.player?.activeRod;
      const lineData = this.player?.activeLine;
      const lure = this.player?.activeLure;

      this.fight = new FightModel(fish.species, fish.weight, {
        reelMultiplier: rod?.reelSpeedMultiplier ?? 1,
        lineMaxWeight: lineData?.maxFishWeight ?? 10,
        tensionForgiveness: 1 + ((rod?.tier ?? 1) - 1) * 0.09,
        pumpStrength: 1 + ((rod?.tier ?? 1) - 1) * 0.12,
        lineForgiveness: 1 + ((lineData?.tier ?? 1) - 1) * 0.1,
        lureAggression: 1 + (lure?.rareBonusChance ?? 0) * 0.35,
      });
      this.fightAnchor.x = this.bobber.position.x;
      this.fightAnchor.z = this.bobber.position.z;
      this.fightActionWasDown = this.actionDown;

      this.setState(FishingState.REELING);
      this.events.emit(Events.REEL_START, {
        fishName: this.reelFishName,
        rarity: fish.species.rarity,
        behavior: this.fight.behaviorName,
      });
      return;
    }

    if (this.biteTimer >= this.biteDuration) {
      this.resetFishing();
      this.setState(FishingState.ESCAPED);
      this.escapedTimer = 0;
      this.events.emit(Events.FISH_ESCAPED);
    }
  }

  // --- REELING (fight model) ---
  private updateReeling(dt: number): void {
    const fight = this.fight;
    if (!fight) {
      this.setState(FishingState.IDLE);
      return;
    }

    const holding = this.actionDown;
    const justPressed = holding && !this.fightActionWasDown;
    const justReleased = !holding && this.fightActionWasDown;
    this.fightActionWasDown = holding;

    fight.update(dt, { holding, justPressed, justReleased });

    // The fish drags the bobber around its anchor point
    const dragDist = fight.pull * 1.4;
    const targetX = this.fightAnchor.x + Math.cos(fight.dragAngle) * dragDist;
    const targetZ = this.fightAnchor.z + Math.sin(fight.dragAngle) * dragDist;
    this.bobber.position.x += (targetX - this.bobber.position.x) * Math.min(1, dt * 3);
    this.bobber.position.z += (targetZ - this.bobber.position.z) * Math.min(1, dt * 3);

    this.events.emit(Events.REEL_PROGRESS, {
      progress: fight.progress,
      tension: fight.tension,
      stamina: fight.stamina,
      danger: fight.inDanger,
      burst: fight.burstActive,
      pumpReady: fight.pumpReady,
      pumpFlash: fight.pumpFlash,
      lineRisk: fight.lineRisk,
      hint: fight.fightHint,
      fishName: this.reelFishName,
    });

    // Bobber dunks while the player is winching
    this.bobber.setSinking(this.actionDown);

    switch (fight.outcome) {
      case 'caught':
        this.setState(FishingState.CAUGHT);
        this.events.emit(Events.FISH_CAUGHT, this.pendingCatch);
        this.resetFishing();
        this.fight = null;
        break;
      case 'snapped':
        this.resetFishing();
        this.fight = null;
        this.setState(FishingState.ESCAPED);
        this.escapedTimer = 0;
        this.events.emit(Events.LINE_SNAPPED, { fishName: this.reelFishName });
        break;
      case 'escaped':
        this.resetFishing();
        this.fight = null;
        this.setState(FishingState.ESCAPED);
        this.escapedTimer = 0;
        this.events.emit(Events.FISH_ESCAPED, { fishName: this.reelFishName });
        break;
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
    this.fightActionWasDown = false;
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
  get currentReelProgress(): number { return this.fight?.progress ?? 0; }
  get currentTension(): number { return this.fight?.tension ?? 0; }
  get currentStamina(): number { return this.fight?.stamina ?? 1; }
  get inDanger(): boolean { return this.fight?.inDanger ?? false; }
  get fishIsBursting(): boolean { return this.fight?.burstActive ?? false; }
  get pumpReady(): boolean { return this.fight?.pumpReady ?? false; }
  get pumpFlash(): number { return this.fight?.pumpFlash ?? 0; }
  get currentFightHint(): string { return this.fight?.fightHint ?? ''; }
  get currentReelFishName(): string { return this.reelFishName; }
  get lastCatch(): CatchData | null { return this.pendingCatch; }

  destroy(): void {}
}
