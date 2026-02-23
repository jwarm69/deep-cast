import { FishSpecies, Rarity } from '../core/types';
import { LAKE_FISH } from '../data/fish-species';

/** Rarity weight table: common 60%, uncommon 25%, rare 10%, epic 4%, legendary 1% */
const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 60,
  [Rarity.UNCOMMON]: 25,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 4,
  [Rarity.LEGENDARY]: 1,
};

export class FishRaritySystem {
  private speciesByRarity: Map<Rarity, FishSpecies[]>;

  constructor(species: FishSpecies[] = LAKE_FISH) {
    this.speciesByRarity = new Map();
    this.setSpecies(species);
  }

  /** Swap the active fish pool (for biome transitions) */
  setSpecies(species: FishSpecies[]): void {
    this.speciesByRarity = new Map();
    for (const rarity of Object.values(Rarity)) {
      this.speciesByRarity.set(rarity, species.filter((s) => s.rarity === rarity));
    }
  }

  /** Pick a random fish weighted by rarity. rarityBonus shifts weight toward rarer tiers. */
  rollFish(rarityBonus = 0): FishSpecies {
    // Build adjusted weights: bonus shifts common weight to rarer tiers
    const adjusted = { ...RARITY_WEIGHTS };
    if (rarityBonus > 0) {
      const shift = adjusted[Rarity.COMMON] * rarityBonus;
      adjusted[Rarity.COMMON] -= shift;
      adjusted[Rarity.UNCOMMON] += shift * 0.4;
      adjusted[Rarity.RARE] += shift * 0.3;
      adjusted[Rarity.EPIC] += shift * 0.2;
      adjusted[Rarity.LEGENDARY] += shift * 0.1;
    }

    const totalWeight = Object.values(adjusted).reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;

    let selectedRarity = Rarity.COMMON;
    for (const [rarity, weight] of Object.entries(adjusted)) {
      roll -= weight;
      if (roll <= 0) {
        selectedRarity = rarity as Rarity;
        break;
      }
    }

    // Pick random species from that rarity
    const candidates = this.speciesByRarity.get(selectedRarity)!;
    if (candidates.length === 0) {
      // Fallback to common
      return this.speciesByRarity.get(Rarity.COMMON)![0];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Generate a random weight for a species */
  rollWeight(species: FishSpecies): number {
    const range = species.maxWeight - species.minWeight;
    // Bias toward lower weights (more realistic distribution)
    const t = Math.pow(Math.random(), 1.5);
    return Number((species.minWeight + range * t).toFixed(2));
  }

  /** Calculate coin reward */
  rollCoins(species: FishSpecies): number {
    const [min, max] = species.coinReward;
    return Math.floor(min + Math.random() * (max - min));
  }
}
