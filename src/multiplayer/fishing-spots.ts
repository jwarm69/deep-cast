import { PlayerMode } from '../core/types';
import { TerrainType } from '../data/biome-config';

export interface FishingSpot {
  id: string;
  name: string;
  terrain: TerrainType;
  x: number;
  z: number;
  radius: number;
  requiresBoat?: boolean;
  requiresDeepWater?: boolean;
}

export const FISHING_SPOTS: FishingSpot[] = [
  { id: 'lake-dock', name: 'Lake Dock', terrain: 'lake', x: 0, z: -2, radius: 6 },
  { id: 'lake-west-bank', name: 'West Bank', terrain: 'lake', x: -12, z: -8, radius: 8 },
  { id: 'lake-deep-channel', name: 'Deep Channel', terrain: 'lake', x: 0, z: 42, radius: 12, requiresBoat: true, requiresDeepWater: true },
  { id: 'tropical-pier', name: 'Tropical Pier', terrain: 'tropical', x: 0, z: -1, radius: 6 },
  { id: 'tropical-reef-edge', name: 'Reef Edge', terrain: 'tropical', x: 16, z: 18, radius: 9, requiresBoat: true },
  { id: 'tropical-blue-hole', name: 'Blue Hole', terrain: 'tropical', x: -8, z: 45, radius: 11, requiresBoat: true, requiresDeepWater: true },
  { id: 'arctic-ice-shelf', name: 'Ice Shelf', terrain: 'arctic', x: 0, z: -1, radius: 6 },
  { id: 'arctic-pack-ice', name: 'Pack Ice', terrain: 'arctic', x: 14, z: 22, radius: 9, requiresBoat: true },
  { id: 'arctic-trench', name: 'Arctic Trench', terrain: 'arctic', x: -6, z: 46, radius: 12, requiresBoat: true, requiresDeepWater: true },
];

export function findFishingSpot(
  terrain: TerrainType,
  x: number,
  z: number,
  mode: PlayerMode,
  inDeepWater: boolean,
): FishingSpot | null {
  let best: FishingSpot | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const spot of FISHING_SPOTS) {
    if (spot.terrain !== terrain) continue;
    if (spot.requiresBoat && mode !== PlayerMode.BOAT) continue;
    if (spot.requiresDeepWater && !inDeepWater) continue;

    const dx = x - spot.x;
    const dz = z - spot.z;
    const distSq = dx * dx + dz * dz;
    const radiusSq = spot.radius * spot.radius;
    if (distSq <= radiusSq && distSq < bestDistSq) {
      best = spot;
      bestDistSq = distSq;
    }
  }

  return best;
}
