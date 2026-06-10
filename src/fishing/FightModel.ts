import { FishSpecies, Rarity } from '../core/types';

export type FightBehavior = 'runner' | 'diver' | 'darting' | 'heavy' | 'trickster';

export type FightOutcome = 'fighting' | 'caught' | 'snapped' | 'escaped';

export interface FightGear {
  reelMultiplier: number;   // from rod
  lineMaxWeight: number;    // from line — fish heavier than this strain the line
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

  private behavior: FightBehavior;
  private difficulty: number;      // 0-1
  private overweight: number;      // 1 = within line rating, >1 = stressing the line
  private gear: FightGear;

  private fightTime = 0;
  private burstTimer = 0;
  private nextBurstIn = 0;
  private burstDuration = 0;
  private burstElapsed = 0;
  private snapTimer = 0;
  private fakeResting = false;

  constructor(species: FishSpecies, weight: number, gear: FightGear) {
    this.difficulty = species.reelDifficulty;
    this.gear = gear;
    this.overweight = Math.max(1, weight / Math.max(1, gear.lineMaxWeight));
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
    return this.tension >= 0.75;
  }

  get behaviorName(): FightBehavior {
    return this.behavior;
  }

  update(dt: number, holding: boolean): void {
    if (this.outcome !== 'fighting') return;
    this.fightTime += dt;

    this.updateBursts(dt);

    // --- Fish pull: baseline scales with difficulty and remaining stamina ---
    const basePull = this.difficulty * (0.25 + 0.75 * this.stamina);
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
    const reelRate = (0.16 + (1 - this.difficulty) * 0.14) * this.gear.reelMultiplier;
    const runRate = 0.05 + this.pull * 0.16;
    if (holding) {
      // Pulling fish resists the reel
      this.progress += reelRate * Math.max(0.15, 1 - this.pull * 0.65) * dt;
    } else {
      this.progress -= runRate * dt;
    }

    // --- Tension ---
    const lineStress = this.overweight > 1 ? 1 + (this.overweight - 1) * 1.4 : 1;
    if (holding) {
      this.tension += (0.16 + this.pull * 0.85) * lineStress * dt;
    } else {
      this.tension -= 0.75 * dt;
    }
    this.tension = Math.max(0, Math.min(1, this.tension));

    // --- Stamina: fish tires fastest when you hold through its pulls ---
    const tireRate = holding ? 0.045 + this.pull * 0.075 : 0.012;
    // Easy fish gas out fast; hard fish have deep reserves
    this.stamina -= tireRate * (1.35 - this.difficulty * 0.9) * dt;
    this.stamina = Math.max(0, this.stamina);

    // --- Outcomes ---
    if (this.tension >= 0.995) {
      this.snapTimer += dt;
      // Commons get a long grace window; legendaries snap fast
      const grace = 0.9 - this.difficulty * 0.65;
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

  private updateBursts(dt: number): void {
    if (this.burstActive) {
      this.burstElapsed += dt;
      if (this.burstElapsed >= this.burstDuration) {
        this.burstActive = false;
        this.fakeResting = false;
        this.scheduleNextBurst(false);
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
    switch (this.behavior) {
      case 'runner':    this.nextBurstIn = base + 1.6 + Math.random() * 2.2; break;
      case 'diver':     this.nextBurstIn = base + 1.4 + Math.random() * 1.8; break;
      case 'darting':   this.nextBurstIn = base + 0.7 + Math.random() * 1.1; break;
      case 'heavy':     this.nextBurstIn = base + 2.6 + Math.random() * 2.6; break;
      case 'trickster': this.nextBurstIn = base + 1.2 + Math.random() * 1.8; break;
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
