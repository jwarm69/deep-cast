import { PlayerMode } from '../core/types';
import { TerrainType } from '../data/biome-config';

export interface PresenceVector3 {
  x: number;
  y: number;
  z: number;
}

/** What the player is doing right now — drives nameplates and the anglers list */
export type PresenceActivity =
  | 'walking'
  | 'sailing'
  | 'casting'
  | 'waiting'
  | 'reeling'
  | 'caught';

/** A recent catch, shared via presence so others see a live catch feed */
export interface PresenceCatch {
  fishName: string;
  rarity: string;
  weight: number;
  isTrophy: boolean;
  at: number; // epoch ms
}

export interface LocalPresenceState {
  playerId: string;
  displayName: string;
  terrain: TerrainType;
  mode: PlayerMode;
  position: PresenceVector3;
  isDeepWater: boolean;
  spotId: string | null;
  activity: PresenceActivity;
  lastCatch: PresenceCatch | null;
  timestamp: number;
}

export interface RemotePresenceState extends LocalPresenceState {
  updatedAt: number;
}

export interface PresenceSnapshot {
  terrain: TerrainType;
  mode: PlayerMode;
  position: PresenceVector3;
  isDeepWater: boolean;
  spotId: string | null;
  activity: PresenceActivity;
  lastCatch: PresenceCatch | null;
}
