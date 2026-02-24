import { PlayerMode } from '../core/types';
import { TerrainType } from '../data/biome-config';

export interface PresenceVector3 {
  x: number;
  y: number;
  z: number;
}

export interface LocalPresenceState {
  playerId: string;
  displayName: string;
  terrain: TerrainType;
  mode: PlayerMode;
  position: PresenceVector3;
  isDeepWater: boolean;
  spotId: string | null;
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
}
