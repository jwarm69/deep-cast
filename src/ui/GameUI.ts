import { Component, FishingState, Events, Rarity, CatchData, PlayerMode } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { FishingStateMachine } from '../fishing/FishingStateMachine';
import { PlayerState } from '../state/PlayerState';
import { BIOME_CONFIGS } from '../data/biome-config';

/**
 * GameUI — manages all DOM overlay UI elements.
 * Reads state from the fishing state machine each frame.
 */
export class GameUI implements Component {
  private events: EventSystem;
  private fsm: FishingStateMachine;
  private player: PlayerState;

  // DOM refs
  private hud: { level: HTMLElement; fish: HTMLElement; coins: HTMLElement; xpBar: HTMLElement; biome: HTMLElement };
  private castUI: HTMLElement;
  private powerBar: HTMLElement;
  private biteUI: HTMLElement;
  private reelUI: HTMLElement;
  private reelBar: HTMLElement;
  private reelFishName: HTMLElement;
  private catchPopup: HTMLElement;
  private catchFishName: HTMLElement;
  private catchRarity: HTMLElement;
  private catchWeight: HTMLElement;
  private escapedUI: HTMLElement;
  private prompt: HTMLElement;
  private levelUpBanner: HTMLElement;
  private deepWaterBadge: HTMLElement;

  private prevState = FishingState.IDLE;
  private catchDisplayed = false;
  private levelUpTimer = 0;
  private playerMode = PlayerMode.SHORE;
  private isDeepWater = false;

  constructor(events: EventSystem, fsm: FishingStateMachine, player: PlayerState) {
    this.events = events;
    this.fsm = fsm;
    this.player = player;

    this.hud = {
      level: document.getElementById('hud-level')!,
      fish: document.getElementById('hud-fish')!,
      coins: document.getElementById('hud-coins')!,
      xpBar: document.getElementById('hud-xp-bar')!,
      biome: document.getElementById('hud-biome')!,
    };
    this.castUI = document.getElementById('cast-ui')!;
    this.powerBar = document.getElementById('power-bar')!;
    this.biteUI = document.getElementById('bite-ui')!;
    this.reelUI = document.getElementById('reel-ui')!;
    this.reelBar = document.getElementById('reel-bar')!;
    this.reelFishName = document.getElementById('reel-fish-name')!;
    this.catchPopup = document.getElementById('catch-popup')!;
    this.catchFishName = document.getElementById('catch-fish-name')!;
    this.catchRarity = document.getElementById('catch-rarity')!;
    this.catchWeight = document.getElementById('catch-weight')!;
    this.escapedUI = document.getElementById('escaped-ui')!;
    this.prompt = document.getElementById('prompt')!;
    this.levelUpBanner = document.getElementById('level-up-banner')!;

    // Create deep water badge dynamically
    this.deepWaterBadge = document.createElement('div');
    this.deepWaterBadge.id = 'deep-water-badge';
    this.deepWaterBadge.textContent = 'DEEP WATER';
    this.deepWaterBadge.style.cssText = `
      position: absolute; top: 16px; right: 16px;
      padding: 6px 14px; border-radius: 6px;
      background: rgba(0, 20, 60, 0.8); border: 1px solid rgba(56, 189, 248, 0.6);
      color: #38bdf8; font-size: 13px; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase;
      text-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
      display: none;
    `;
    document.getElementById('game-ui')!.appendChild(this.deepWaterBadge);
  }

  init(): void {
    this.events.on(Events.FISH_CAUGHT, (e) => {
      const data = e.data as CatchData;
      this.showCatch(data);
    });
    this.events.on(Events.LEVEL_UP, (e) => {
      this.showLevelUp(e.data.newLevel);
    });
    this.events.on(Events.BIOME_CHANGE, () => {
      this.syncHUD();
    });
    this.events.on(Events.BOARD_BOAT, () => {
      this.playerMode = PlayerMode.BOAT;
    });
    this.events.on(Events.DISEMBARK_BOAT, () => {
      this.playerMode = PlayerMode.SHORE;
      this.isDeepWater = false;
      this.deepWaterBadge.style.display = 'none';
    });
    this.events.on(Events.ENTER_DEEP_WATER, () => {
      this.isDeepWater = true;
      this.deepWaterBadge.style.display = 'block';
    });
    this.events.on(Events.LEAVE_DEEP_WATER, () => {
      this.isDeepWater = false;
      this.deepWaterBadge.style.display = 'none';
    });
    // Sync HUD from loaded save
    this.syncHUD();
  }

  private syncHUD(): void {
    this.hud.level.textContent = `Level ${this.player.level}`;
    this.hud.fish.textContent = `Fish: ${this.player.totalFishCaught}`;
    this.hud.coins.textContent = `${this.player.coins} coins`;
    this.hud.xpBar.style.width = `${this.player.levelProgress * 100}%`;
    this.hud.biome.textContent = BIOME_CONFIGS[this.player.currentTerrain].name;
  }

  private showCatch(data: CatchData): void {
    this.catchFishName.textContent = data.species.name;
    this.catchFishName.style.color = `#${data.species.color.toString(16).padStart(6, '0')}`;

    this.catchRarity.textContent = data.species.rarity.toUpperCase();
    this.catchRarity.className = `rarity-${data.species.rarity}`;

    this.catchWeight.textContent = `${data.weight} lbs | +${data.xp} XP | +${data.coins} coins`;

    this.catchDisplayed = true;
    this.syncHUD();
  }

  private showLevelUp(newLevel: number): void {
    this.levelUpBanner.textContent = `LEVEL UP! You are now level ${newLevel}`;
    this.levelUpBanner.classList.add('visible');
    this.levelUpTimer = 3.0;
  }

  update(dt: number): void {
    const state = this.fsm.state;

    // Level-up banner countdown
    if (this.levelUpTimer > 0) {
      this.levelUpTimer -= dt;
      if (this.levelUpTimer <= 0) {
        this.levelUpBanner.classList.remove('visible');
      }
    }

    // Hide all overlays then show the active one
    if (state !== this.prevState) {
      this.castUI.classList.remove('visible');
      this.biteUI.classList.remove('visible');
      this.reelUI.classList.remove('visible');
      this.escapedUI.classList.remove('visible');

      if (!this.catchDisplayed) {
        this.catchPopup.classList.remove('visible');
      }

      this.prevState = state;
    }

    switch (state) {
      case FishingState.IDLE:
        if (this.playerMode === PlayerMode.BOAT) {
          this.prompt.textContent = 'WASD to sail | Hold SPACE to cast | E to disembark | TAB shop | J journal';
        } else {
          this.prompt.textContent = 'WASD to move | Hold SPACE to cast | E to board boat | TAB shop | J journal';
        }
        this.prompt.style.display = 'block';
        if (this.catchDisplayed) {
          // Still showing catch popup
        }
        break;

      case FishingState.CASTING:
        this.prompt.style.display = 'none';
        this.catchPopup.classList.remove('visible');
        this.catchDisplayed = false;
        this.castUI.classList.add('visible');
        this.powerBar.style.width = `${this.fsm.currentCastPower}%`;
        break;

      case FishingState.FLIGHT:
        this.castUI.classList.remove('visible');
        this.prompt.style.display = 'none';
        break;

      case FishingState.WAITING:
        this.prompt.textContent = 'Waiting for a bite...';
        this.prompt.style.display = 'block';
        break;

      case FishingState.BITING:
        this.prompt.style.display = 'none';
        this.biteUI.classList.add('visible');
        break;

      case FishingState.REELING:
        this.biteUI.classList.remove('visible');
        this.reelUI.classList.add('visible');
        this.reelBar.style.width = `${this.fsm.currentReelProgress * 100}%`;
        this.reelFishName.textContent = this.fsm.currentReelFishName;
        this.prompt.style.display = 'none';
        break;

      case FishingState.CAUGHT:
        this.reelUI.classList.remove('visible');
        this.catchPopup.classList.add('visible');
        this.prompt.style.display = 'none';
        break;

      case FishingState.ESCAPED:
        this.escapedUI.classList.add('visible');
        this.prompt.style.display = 'none';
        break;
    }
  }

  destroy(): void {}
}
