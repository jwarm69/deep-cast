/** Progression tables — placeholder for Phase 3 */

/** XP required to reach a given level: level * 100 + level^2 * 10 */
export function xpForLevel(level: number): number {
  return level * 100 + level * level * 10;
}

/** Cumulative XP needed from level 1 to reach target level */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/** Terrain unlock levels */
export const TERRAIN_UNLOCKS = {
  lake: 1,
  tropical: 8,
  arctic: 15,
} as const;

/** Boat unlock data — Phase 6 */
export const BOAT_UNLOCKS = [
  { id: 'rowboat', name: 'Rowboat', cost: 0, levelRequired: 5, speed: 3 },
  { id: 'skiff', name: 'Skiff', cost: 400, levelRequired: 8, speed: 5 },
  { id: 'sailboat', name: 'Sailboat', cost: 1000, levelRequired: 12, speed: 7 },
  { id: 'speedboat', name: 'Speedboat', cost: 2500, levelRequired: 18, speed: 12 },
  { id: 'research_vessel', name: 'Research Vessel', cost: 6000, levelRequired: 25, speed: 8 },
];
