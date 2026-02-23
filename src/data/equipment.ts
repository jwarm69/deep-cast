/** Equipment data — placeholder for Phase 3 progression system */

export interface RodData {
  id: string;
  name: string;
  tier: number;
  castPowerMultiplier: number;
  reelSpeedMultiplier: number;
  cost: number;
  levelRequired: number;
}

export interface LureData {
  id: string;
  name: string;
  tier: number;
  rareBonusChance: number;
  biteSpeedMultiplier: number;
  cost: number;
  levelRequired: number;
}

export interface LineData {
  id: string;
  name: string;
  tier: number;
  maxFishWeight: number;
  cost: number;
  levelRequired: number;
}

export const RODS: RodData[] = [
  { id: 'basic_rod', name: 'Basic Rod', tier: 1, castPowerMultiplier: 1.0, reelSpeedMultiplier: 1.0, cost: 0, levelRequired: 1 },
  { id: 'fiberglass', name: 'Fiberglass Rod', tier: 2, castPowerMultiplier: 1.3, reelSpeedMultiplier: 1.2, cost: 200, levelRequired: 5 },
  { id: 'carbon', name: 'Carbon Rod', tier: 3, castPowerMultiplier: 1.6, reelSpeedMultiplier: 1.4, cost: 600, levelRequired: 10 },
  { id: 'titanium', name: 'Titanium Rod', tier: 4, castPowerMultiplier: 2.0, reelSpeedMultiplier: 1.7, cost: 1200, levelRequired: 15 },
  { id: 'master', name: 'Master Rod', tier: 5, castPowerMultiplier: 2.5, reelSpeedMultiplier: 2.0, cost: 2000, levelRequired: 20 },
];

export const LURES: LureData[] = [
  { id: 'standard', name: 'Standard Lure', tier: 1, rareBonusChance: 0, biteSpeedMultiplier: 1.0, cost: 0, levelRequired: 1 },
  { id: 'shiny', name: 'Shiny Lure', tier: 2, rareBonusChance: 0.05, biteSpeedMultiplier: 1.15, cost: 150, levelRequired: 4 },
  { id: 'glowing', name: 'Glowing Lure', tier: 3, rareBonusChance: 0.15, biteSpeedMultiplier: 1.3, cost: 400, levelRequired: 8 },
  { id: 'rainbow', name: 'Rainbow Lure', tier: 4, rareBonusChance: 0.25, biteSpeedMultiplier: 1.5, cost: 800, levelRequired: 14 },
  { id: 'golden', name: 'Golden Lure', tier: 5, rareBonusChance: 0.35, biteSpeedMultiplier: 1.8, cost: 1200, levelRequired: 18 },
];

export const LINES: LineData[] = [
  { id: 'basic_line', name: 'Basic Line', tier: 1, maxFishWeight: 10, cost: 0, levelRequired: 1 },
  { id: 'braided', name: 'Braided Line', tier: 2, maxFishWeight: 20, cost: 100, levelRequired: 3 },
  { id: 'fluorocarbon', name: 'Fluorocarbon Line', tier: 3, maxFishWeight: 35, cost: 350, levelRequired: 7 },
  { id: 'steel_leader', name: 'Steel Leader', tier: 4, maxFishWeight: 50, cost: 700, levelRequired: 12 },
  { id: 'titan_weave', name: 'Titan Weave', tier: 5, maxFishWeight: 100, cost: 1500, levelRequired: 18 },
];

export interface BoatData {
  id: string;
  name: string;
  tier: number;
  speed: number;
  rarityBoost: number; // 0-1, passive rarity bonus
  cost: number;
  levelRequired: number;
}

export const BOATS: BoatData[] = [
  { id: 'rowboat', name: 'Rowboat', tier: 1, speed: 3, rarityBoost: 0, cost: 0, levelRequired: 5 },
  { id: 'skiff', name: 'Skiff', tier: 2, speed: 5, rarityBoost: 0.03, cost: 400, levelRequired: 8 },
  { id: 'sailboat', name: 'Sailboat', tier: 3, speed: 7, rarityBoost: 0.07, cost: 1000, levelRequired: 12 },
  { id: 'speedboat', name: 'Speedboat', tier: 4, speed: 12, rarityBoost: 0.11, cost: 2500, levelRequired: 18 },
  { id: 'research_vessel', name: 'Research Vessel', tier: 5, speed: 8, rarityBoost: 0.15, cost: 6000, levelRequired: 25 },
];
