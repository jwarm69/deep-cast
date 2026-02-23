import * as THREE from 'three';

// Component interface - all game systems implement this
export interface Component {
  init?(): void | Promise<void>;
  update(deltaTime: number): void;
  destroy?(): void;
}

// Event system types
export interface GameEvent {
  type: string;
  data?: any;
  timestamp: number;
}

export type EventCallback = (event: GameEvent) => void;

// Fishing states
export enum FishingState {
  IDLE = 'idle',
  CASTING = 'casting',
  FLIGHT = 'flight',
  WAITING = 'waiting',
  BITING = 'biting',
  REELING = 'reeling',
  CAUGHT = 'caught',
  ESCAPED = 'escaped',
}

// Fish rarity
export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

// Fish species definition
export interface FishSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  terrain: string;
  minWeight: number;
  maxWeight: number;
  reelDifficulty: number; // 0-1, how hard to reel in
  description: string;
  xpReward: number;
  coinReward: [number, number]; // [min, max]
  color: number; // hex color for catch popup accent
}

// Catch result
export interface CatchData {
  species: FishSpecies;
  weight: number;
  coins: number;
  xp: number;
}

// Game events
export const Events = {
  // Fishing
  CAST_START: 'fishing:cast_start',
  CAST_RELEASE: 'fishing:cast_release',
  BOBBER_LAND: 'fishing:bobber_land',
  FISH_BITE: 'fishing:fish_bite',
  REEL_START: 'fishing:reel_start',
  REEL_PROGRESS: 'fishing:reel_progress',
  FISH_CAUGHT: 'fishing:fish_caught',
  FISH_ESCAPED: 'fishing:fish_escaped',
  STATE_CHANGE: 'fishing:state_change',

  // Input
  MOUSE_DOWN: 'input:mouse_down',
  MOUSE_UP: 'input:mouse_up',
  MOUSE_MOVE: 'input:mouse_move',
  SCROLL: 'input:scroll',
  KEY_DOWN: 'input:key_down',

  // UI
  CATCH_DISMISSED: 'ui:catch_dismissed',

  // Progression
  LEVEL_UP: 'player:level_up',
  COINS_CHANGED: 'player:coins_changed',
  XP_CHANGED: 'player:xp_changed',
  EQUIPMENT_PURCHASED: 'player:equipment_purchased',
  EQUIPMENT_EQUIPPED: 'player:equipment_equipped',

  // Biome & boats
  BIOME_CHANGE: 'world:biome_change',
  BOAT_PURCHASED: 'player:boat_purchased',
  BOAT_EQUIPPED: 'player:boat_equipped',

  // Overlays
  SHOP_TOGGLE: 'ui:shop_toggle',
  JOURNAL_TOGGLE: 'ui:journal_toggle',
} as const;
