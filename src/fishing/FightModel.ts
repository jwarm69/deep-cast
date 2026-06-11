import { FishSpecies, Rarity } from '../core/types';

export type FightBehavior = 'runner' | 'diver' | 'darting' | 'heavy' | 'trickster';

export type FightOutcome = 'fighting' | 'caught' | 'snapped' | 'escaped';

export interface FightGear {
  reelMultiplier: number;   // from rod
  lineMaxWeight: number;    // from line — fish heavier than this strain the line
  tensionForgiveness?: number; // from rod tier — higher = tension builds slower
  pumpStrength?: number;       // from rod tier — higher = stronger pump bonuses
  lineForgiveness?: number;    // from line tier — higher = longer snap grace
  lureAggression?: number;     // from lure tier/rarity — higher = livelier fish
}

export interface FightInput {
  holding: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * FightModel — skill-based fish fight simulation.
 *
 * Three coupled meters:
 * - progress: 0→1, fill it to land the fish. Holding reels in; releasing lets the fish run.
 * - tension:  0→1, builds while holding against a pulling fish. Sustained max tension snaps the line.
 * - stamina:  1→0, the fish tires as you hold against its pulls. Tired fish pull weaker and run less.
 *
 * Fish pull in behavior-specific bursts. The core decision loop: hold through calm water,
 * release (or feather) through bursts, pump when the fish is tired.
 */
export class FightModel {
  progress = 0.15; // small head start so the bar reads immediately
  tension = 0;
  stamina = 1;
  outcome: FightOutcome = 'fighting';

  /** Current fish pull strength 0..~1.6 (burst spikes above 1) */
  pull = 0;
  /** Lateral drag direction for bobber juice, radians */
  dragAngle = Math.random() * Math.PI * 2;
  burstActive = false;
  pumpCharge = 0;
  pumpFlash = 0;

  private behavior: FightBehavior;
  private difficulty: number;      // 0-1
  private overweight: number;      // 1 = within line rating, >1 = stressing the line
  private gear: Required<FightGear>;

  private fightTime = 0;
  private burstTimer = 0;
  private nextBurstIn = 0;
  private burstDuration = 0;
  private burstElapsed = 0;
  private snapTimer = 0;
  private fakeResting = false;
  private holding = false;
  private releaseTimer = 0;
  private holdTimer = 0;
  private lineStress = 1;

  constructor(species: FishSpecies, weight: number, gear: FightGear) {
    this.difficulty = Math.max(0.05, Math.min(1, species.reelDifficulty));
    this.gear = {
      reelMultiplier: gear.reelMultiplier,
      lineMaxWeight: gear.lineMaxWeight,
      tensionForgiveness: gear.tensionForgiveness ?? 1,
      pumpStrength: gear.pumpStrength ?? 1,
      lineForgiveness: gear.lineForgiveness ?? 1,
      lureAggression: gear.lureAggression ?? 1,
    };
    this.overweight = Math.max(1, weight / Math.max(1, gear.lineMaxWeight));
    this.lineStress = this.overweight > 1 ? 1 + (this.overweight - 1) * 1.4 : 1;
    this.behavior = FightModel.pickBehavior(species, weight);
    this.scheduleNextBurst(true);
  }

  /** Deterministic behavior from species traits, so each fish has a consistent personality */
  static pickBehavior(species: FishSpecies, weight: number): FightBehavior {
    if (species.maxWeight >= 40 || weight >= 25) return 'heavy';
    if (species.deepWater) return 'diver';
    if (species.rarity === Rarity.EPIC || species.rarity === Rarity.LEGENDARY) {
      return FightModel.hash(species.id) % 2 === 0 ? 'trickster' : 'runner';
    }
    const roll = FightModel.hash(species.id) % 3;
    return roll === 0 ? 'runner' : roll === 1 ? 'darting' : 'diver';
  }

  private static hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  get inDanger(): boolean {
    return this.tension >= 0.72;
  }

  get behaviorName(): FightBehavior {
    return this.behavior;
  }

  get pumpReady(): boolean {
    return this.pumpCharge >= 0.55 && this.tension < 0.88;
  }

  get lineRisk(): number {
    const overweightRisk = Math.max(0, Math.min(1, (this.overweight - 1) / 1.5));
    return Math.max(this.tension, overweightRisk * 0.55);
  }

  get fightHint(): string {
    if (this.inDanger) return 'Ease off - tension is near the snap point';
    if (this.pumpFlash > 0) return 'Rod pump landed - keep pressure under control';
    if (this.pumpReady) return 'Pump now - re-engage before the fish gains distance';
    if (this.fakeResting) return 'It went quiet - be ready for a hard run';
    if (this.burstActive) return this.burstHint();
    if (this.stamina < 0.25) return 'Fish is tired - steady pressure will finish it';
    return 'Hold to reel, release to bleed tension, pump after easing off';
  }

  update(dt: number, input: FightInput): void {
    if (this.outcome !== 'fighting') return;
    this.fightTime += dt;
    this.pumpFlash = Math.max(0, this.pumpFlash - dt);

    const releaseDuration = this.releaseTimer;
    this.holding = input.holding;

    this.updateBursts(dt);
    this.updatePumpWindow(dt, input, releaseDuration);

    // --- Fish pull: baseline scales with difficulty and remaining stamina ---
    const basePull = this.basePullFor() * (0.25 + 0.75 * this.stamina) * this.gear.lureAggression;
    let targetPull = basePull;
    if (this.burstActive && !this.fakeResting) {
      const burstStrength = this.burstStrengthFor();
      // Envelope: ramp in/out over the burst
      const t = this.burstElapsed / this.burstDuration;
      const envelope = Math.sin(Math.min(1, t) * Math.PI);
      targetPull = basePull + burstStrength * envelope * (0.4 + 0.6 * this.stamina);
    }
    if (this.fakeResting) targetPull = basePull * 0.15;
    // Smooth pull toward target so meters read well
    this.pull += (targetPull - this.pull) * Math.min(1, dt * 8);

    // --- Reel progress ---
    const reelRate = (0.13 + (1 - this.difficulty) * 0.18) * this.gear.reelMultiplier;
    const runRate = (0.035 + this.pull * 0.16) * this.escapePressureFor();
    if (input.holding) {
      // Pulling fish resists the reel
      const tiredBonus = 1 + (1 - this.stamina) * 0.5;
      const heavyPenalty = this.behavior === 'heavy' ? 0.82 : 1;
      this.progress += reelRate * tiredBonus * heavyPenalty * Math.max(0.12, 1 - this.pull * 0.62) * dt;
    } else {
      this.progress -= runRate * dt;
    }

    // --- Tension ---
    if (input.holding) {
      this.tension += (0.13 + this.pull * 0.82 + this.difficulty * 0.08)
        * this.lineStress
        / this.gear.tensionForgiveness
        * dt;
    } else {
      const releaseBonus = this.inDanger ? 0.28 : 0;
      this.tension -= (0.62 + releaseBonus + this.gear.lineForgiveness * 0.08) * dt;
    }
    this.tension = Math.max(0, Math.min(1, this.tension));

    // --- Stamina: fish tires fastest when you hold through its pulls ---
    const tireRate = input.holding ? 0.035 + this.pull * 0.07 : 0.006;
    // Easy fish gas out fast; hard fish have deep reserves
    this.stamina -= tireRate * (1.35 - this.difficulty * 0.9) * dt;
    if (!input.holding && this.fakeResting) this.stamina += 0.012 * dt;
    this.stamina = Math.max(0, this.stamina);

    // --- Outcomes ---
    if (this.tension >= 0.995) {
      this.snapTimer += dt;
      // Commons get a long grace window; legendaries snap fast
      const grace = Math.max(0.2, (1.0 - this.difficulty * 0.65) * this.gear.lineForgiveness / Math.min(this.lineStress, 2.5));
      if (this.snapTimer >= grace) {
        this.outcome = 'snapped';
        return;
      }
    } else {
      this.snapTimer = 0;
    }

    if (this.progress >= 1) {
      this.progress = 1;
      this.outcome = 'caught';
      return;
    }

    if (this.progress <= 0 && this.fightTime > 2.5) {
      this.progress = 0;
      this.outcome = 'escaped';
    }
  }

  private updatePumpWindow(dt: number, input: FightInput, releaseDuration: number): void {
    if (input.justReleased) {
      this.pumpCharge = Math.max(this.pumpCharge, this.tension > 0.2 ? 0.18 : 0.08);
    }

    if (!input.holding) {
      this.releaseTimer += dt;
      this.holdTimer = 0;
      const calmPenalty = this.pull > 1.15 ? 0.45 : 1;
      this.pumpCharge += (0.58 + this.tension * 0.55) * calmPenalty * dt;
      this.pumpCharge = Math.min(1, this.pumpCharge);
      return;
    }

    this.holdTimer += dt;
    this.releaseTimer = 0;

    if (input.justPressed && releaseDuration >= 0.14 && releaseDuration <= 1.35 && this.pumpCharge >= 0.35 && this.tension < 0.94) {
      const timing = 1 - Math.abs(releaseDuration - 0.55) / 0.85;
      const timingBonus = Math.max(0.35, timing);
      this.applyPump(this.pumpCharge * timingBonus);
    } else {
      this.pumpCharge = Math.max(0, this.pumpCharge - dt * 1.8);
    }
  }

  private applyPump(power: number): void {
    const clamped = Math.max(0.2, Math.min(1, power));
    const tiredBonus = 1 + (1 - this.stamina) * 0.45;
    const pump = clamped * this.gear.pumpStrength;

    this.progress += (0.028 + (1 - this.difficulty) * 0.015) * pump * tiredBonus;
    this.stamina -= (0.035 + this.pull * 0.016) * pump * (1.15 - this.difficulty * 0.35);
    this.tension += (0.075 + this.pull * 0.12) * pump * this.lineStress / this.gear.tensionForgiveness;

    this.progress = Math.max(0, Math.min(1, this.progress));
    this.stamina = Math.max(0, Math.min(1, this.stamina));
    this.tension = Math.max(0, Math.min(1, this.tension));
    this.pumpCharge = 0;
    this.pumpFlash = 0.32;
  }

  private updateBursts(dt: number): void {
    if (this.burstActive) {
      this.burstElapsed += dt;
      if (this.burstElapsed >= this.burstDuration) {
        if (this.fakeResting) {
          this.fakeResting = false;
          this.burstElapsed = 0;
          this.burstDuration = 1.0 + Math.random() * 0.8;
          this.dragAngle = Math.random() * Math.PI * 2;
          return;
        }
        this.burstActive = false;
        this.scheduleNextBurst(false);
      }
      if (this.behavior === 'darting' && !this.fakeResting) {
        this.dragAngle += Math.sin(this.fightTime * 18) * dt * 3.4;
      }
      return;
    }

    this.burstTimer += dt;
    if (this.burstTimer >= this.nextBurstIn) {
      this.burstActive = true;
      this.burstElapsed = 0;
      this.burstDuration = this.burstDurationFor();
      this.dragAngle = Math.random() * Math.PI * 2;
      // Trickster: some "bursts" are fake rests followed by a hard run
      this.fakeResting = this.behavior === 'trickster' && Math.random() < 0.4;
      if (this.fakeResting) {
        // Rest reads calm, then the real burst hits right after
        this.burstDuration = 0.8 + Math.random() * 0.6;
      }
    }
  }

  private scheduleNextBurst(first: boolean): void {
    this.burstTimer = 0;
    const base = first ? 0.8 : 0;
    const fatigueDelay = this.stamina < 0.3 ? 1.35 : 1;
    const difficultyPace = 0.95 + this.difficulty * 0.18;
    switch (this.behavior) {
      case 'runner':    this.nextBurstIn = (base + 1.6 + Math.random() * 2.2) * fatigueDelay / difficultyPace; break;
      case 'diver':     this.nextBurstIn = (base + 1.4 + Math.random() * 1.8) * fatigueDelay / difficultyPace; break;
      case 'darting':   this.nextBurstIn = (base + 0.7 + Math.random() * 1.1) * fatigueDelay / difficultyPace; break;
      case 'heavy':     this.nextBurstIn = (base + 2.6 + Math.random() * 2.6) * fatigueDelay / difficultyPace; break;
      case 'trickster': this.nextBurstIn = (base + 1.2 + Math.random() * 1.8) * fatigueDelay / difficultyPace; break;
    }
  }

  private basePullFor(): number {
    switch (this.behavior) {
      case 'runner': return this.difficulty * 0.95;
      case 'diver': return this.difficulty * 1.02;
      case 'darting': return this.difficulty * 0.86;
      case 'heavy': return this.difficulty * 0.78 + 0.12;
      case 'trickster': return this.difficulty * 0.9;
    }
  }

  private escapePressureFor(): number {
    switch (this.behavior) {
      case 'runner': return 1.25;
      case 'diver': return 1.1;
      case 'darting': return 1.05;
      case 'heavy': return 0.72;
      case 'trickster': return this.fakeResting ? 0.35 : 1.15;
    }
  }

  private burstHint(): string {
    switch (this.behavior) {
      case 'runner': return 'Long run - feather the line before it snaps';
      case 'diver': return 'Hard dive - tension will climb fast';
      case 'darting': return 'Quick darts - tap pressure, do not hold blindly';
      case 'heavy': return 'Heavy pull - slow pressure wins';
      case 'trickster': return 'Hard run - the calm was a fake';
    }
  }

  private burstDurationFor(): number {
    switch (this.behavior) {
      case 'runner':    return 1.4 + Math.random() * 1.2; // long pulls
      case 'diver':     return 1.0 + Math.random() * 0.8;
      case 'darting':   return 0.35 + Math.random() * 0.35; // quick flicks
      case 'heavy':     return 1.8 + Math.random() * 1.0; // slow grinding pulls
      case 'trickster': return 1.0 + Math.random() * 0.9;
    }
  }

  private burstStrengthFor(): number {
    switch (this.behavior) {
      case 'runner':    return 0.75 + this.difficulty * 0.5;
      case 'diver':     return 0.85 + this.difficulty * 0.55;
      case 'darting':   return 0.6 + this.difficulty * 0.45;
      case 'heavy':     return 0.5 + this.difficulty * 0.4;
      case 'trickster': return 0.95 + this.difficulty * 0.6; // hard runs after the rest
    }
  }
}
