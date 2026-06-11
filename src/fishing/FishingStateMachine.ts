import { Component, FishSpecies, FishingState, Events, CatchData, Rarity } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { FishRaritySystem } from '../fish/FishRaritySystem';
import { Bobber } from '../entities/Bobber';
import { FishingLine } from '../entities/FishingLine';
import { FishingRod } from '../entities/FishingRod';
import { PlayerState } from '../state/PlayerState';
import { FightModel } from './FightModel';
import { LureData } from '../data/equipment';

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

type FishFeedingStyle = 'general' | 'fast' | 'bottom' | 'rare' | 'deep' | 'heavy';
type SurfaceClueKind = 'ripples' | 'bubbles' | 'splash' | 'glow';

interface LureResponse {
  style: FishFeedingStyle;
  interest: number;
  compatibility: number;
  twitchEffect: number;
  rejectChance: number;
  clue: SurfaceClueKind;
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
  private lureResponse: LureResponse | null = null;
  private inspectedCurrentFish = false;
  private chasedCurrentFish = false;
  private twitchCount = 0;

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
      this.inspectedCurrentFish = false;
      this.chasedCurrentFish = false;
      this.twitchCount = 0;

      // Roll the fish now so the approaching shadow can telegraph size and rarity
      this.rollPendingFish();
      this.configureLureResponse();

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
    const response = this.lureResponse;

    // Lure twitch: a quick space tap entices the fish, shortening the wait
    const spaceDown = this.input.spaceDown;
    if (spaceDown) {
      this.spaceHeldTime += dt;
    } else {
      if (this.spaceWasDown && this.spaceHeldTime < 0.3 && this.twitchCooldown <= 0) {
        this.twitchCooldown = 1.5;
        this.twitchCount++;
        const twitchEffect = this.applyLureTwitch();
        this.waitTimer += this.waitDuration * (0.06 + Math.max(0, twitchEffect) * 0.24);
        this.bobber.twitch();
        this.events.emit(Events.LURE_TWITCH, {
          x: this.bobber.position.x,
          z: this.bobber.position.z,
          effect: twitchEffect,
          category: this.player?.activeLure.category ?? 'worm',
        });
        if (this.shouldSpookFromTwitch(twitchEffect)) {
          this.rejectPendingFish('spooked');
          return;
        }
      }
      this.spaceHeldTime = 0;
    }
    this.spaceWasDown = spaceDown;

    const waitProgress = this.waitDuration > 0 ? this.waitTimer / this.waitDuration : 1;
    if (response && !this.inspectedCurrentFish && waitProgress >= 0.32) {
      this.inspectedCurrentFish = true;
      this.events.emit(Events.FISH_INSPECT, {
        x: this.bobber.position.x,
        z: this.bobber.position.z,
        style: response.style,
        interest: response.interest,
        clue: response.clue,
      });
      this.events.emit(Events.SURFACE_CLUE, {
        x: this.bobber.position.x,
        z: this.bobber.position.z,
        kind: response.clue,
        strength: 0.65,
        rarity: this.pendingCatch?.species.rarity,
      });
    }

    if (response && !this.chasedCurrentFish && waitProgress >= 0.66) {
      this.chasedCurrentFish = true;
      if (Math.random() < response.rejectChance) {
        this.rejectPendingFish('rejected');
        return;
      }

      this.waitTimer += this.waitDuration * (0.08 + response.interest * 0.1);
      this.events.emit(Events.FISH_CHASE, {
        x: this.bobber.position.x,
        z: this.bobber.position.z,
        style: response.style,
        interest: response.interest,
        clue: response.clue,
      });
      this.events.emit(Events.SURFACE_CLUE, {
        x: this.bobber.position.x,
        z: this.bobber.position.z,
        kind: response.style === 'fast' ? 'splash' : response.clue,
        strength: 0.9,
        rarity: this.pendingCatch?.species.rarity,
      });
    }

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

  private configureLureResponse(): void {
    const fish = this.pendingCatch?.species;
    if (!fish) return;

    const lure = this.player?.activeLure;
    const style = this.classifyFishStyle(fish);
    const compatibility = this.lureCompatibility(lure?.category ?? 'worm', style, fish);
    const rarityCaution = fish.rarity === Rarity.EPIC ? 0.04 : fish.rarity === Rarity.LEGENDARY ? 0.08 : 0;
    const interest = clamp01(0.56 + compatibility - fish.reelDifficulty * 0.12 - rarityCaution);
    const mismatch = Math.max(0, -compatibility);

    this.lureResponse = {
      style,
      interest,
      compatibility,
      twitchEffect: this.twitchEffectFor(lure?.category ?? 'worm', style, fish),
      rejectChance: clamp(0.12 - interest * 0.08 + mismatch * 0.45 + rarityCaution, 0.015, 0.22),
      clue: this.surfaceClueFor(style, fish),
    };

    this.waitDuration *= clamp(1.18 - interest * 0.46, 0.68, 1.28);
    this.events.emit(Events.SURFACE_CLUE, {
      x: this.flightTarget.x,
      z: this.flightTarget.z,
      kind: this.lureResponse.clue,
      strength: 0.45,
      rarity: fish.rarity,
    });
  }

  private applyLureTwitch(): number {
    const response = this.lureResponse;
    if (!response) return 0;

    const repeatedPenalty = Math.max(0, this.twitchCount - 2) * 0.05;
    const effect = response.twitchEffect - repeatedPenalty;
    response.interest = clamp01(response.interest + effect);
    response.rejectChance = clamp(response.rejectChance - effect * 0.2 + repeatedPenalty * 0.35, 0.01, 0.3);
    return effect;
  }

  private shouldSpookFromTwitch(effect: number): boolean {
    const response = this.lureResponse;
    if (!response) return false;
    if (this.twitchCount < 2) return false;
    const spookChance = clamp(-effect * 1.2 + Math.max(0, this.twitchCount - 3) * 0.08, 0, 0.35);
    return Math.random() < spookChance;
  }

  private rejectPendingFish(reason: 'rejected' | 'spooked'): void {
    const fish = this.pendingCatch;
    this.resetFishing();
    this.setState(FishingState.ESCAPED);
    this.escapedTimer = 0;
    this.events.emit(Events.FISH_REJECT, {
      reason,
      fishName: fish ? this.reelFishName : null,
      category: this.player?.activeLure.category ?? 'worm',
    });
  }

  private classifyFishStyle(fish: FishSpecies): FishFeedingStyle {
    const id = fish.id.toLowerCase();
    const description = fish.description.toLowerCase();
    if (fish.deepWater) return 'deep';
    if (fish.maxWeight >= 30 || id.includes('sturgeon') || id.includes('marlin')) return 'heavy';
    if (
      description.includes('bottom') ||
      id.includes('carp') ||
      id.includes('catfish') ||
      id.includes('eel') ||
      id.includes('cod') ||
      id.includes('halibut') ||
      id.includes('ray')
    ) return 'bottom';
    if (fish.rarity === Rarity.RARE || fish.rarity === Rarity.EPIC || fish.rarity === Rarity.LEGENDARY) return 'rare';
    if (fish.reelDifficulty >= 0.38 || id.includes('trout') || id.includes('bass') || id.includes('pike')) return 'fast';
    return 'general';
  }

  private lureCompatibility(category: LureData['category'], style: FishFeedingStyle, fish: FishSpecies): number {
    switch (category) {
      case 'spinner':
        return style === 'fast' ? 0.23 : style === 'rare' ? 0.12 : style === 'bottom' || style === 'heavy' ? -0.08 : 0.06;
      case 'worm':
        return style === 'bottom' ? 0.22 : style === 'general' ? 0.16 : style === 'fast' ? -0.02 : style === 'deep' ? -0.06 : 0.02;
      case 'glow':
        return style === 'deep' ? 0.25 : style === 'rare' ? 0.23 : fish.rarity === Rarity.LEGENDARY ? 0.28 : style === 'general' ? -0.08 : 0.04;
      case 'jig':
        return style === 'heavy' ? 0.25 : style === 'deep' || style === 'bottom' ? 0.2 : style === 'fast' ? -0.1 : 0.02;
    }
  }

  private twitchEffectFor(category: LureData['category'], style: FishFeedingStyle, fish: FishSpecies): number {
    switch (category) {
      case 'spinner':
        return style === 'fast' || style === 'rare' ? 0.13 : style === 'bottom' ? -0.08 : 0.05;
      case 'worm':
        return style === 'bottom' || style === 'general' ? 0.08 : style === 'fast' ? 0.02 : -0.04;
      case 'glow':
        return style === 'deep' || style === 'rare' || fish.rarity === Rarity.LEGENDARY ? 0.1 : -0.05;
      case 'jig':
        return style === 'heavy' || style === 'deep' || style === 'bottom' ? 0.11 : -0.07;
    }
  }

  private surfaceClueFor(style: FishFeedingStyle, fish: FishSpecies): SurfaceClueKind {
    if (fish.rarity === Rarity.LEGENDARY || fish.rarity === Rarity.EPIC || fish.deepWater) return 'glow';
    if (style === 'bottom' || style === 'heavy') return 'bubbles';
    if (style === 'fast' || style === 'rare') return 'splash';
    return 'ripples';
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
    this.lureResponse = null;
    this.inspectedCurrentFish = false;
    this.chasedCurrentFish = false;
    this.twitchCount = 0;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
