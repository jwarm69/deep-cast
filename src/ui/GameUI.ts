import { Component, FishingState, Events, Rarity, CatchData, PlayerMode } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { FishingStateMachine } from '../fishing/FishingStateMachine';
import { PlayerState } from '../state/PlayerState';
import { BIOME_CONFIGS } from '../data/biome-config';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const BEHAVIOR_HINTS: Record<string, string> = {
  runner: 'A runner — brace for long pulls!',
  diver: 'A diver — it dives hard, watch the tension!',
  darting: 'A darter — quick erratic bursts!',
  heavy: 'A heavy one — slow and stubborn...',
  trickster: "A trickster — don't trust the calm!",
};

const RARITY_FLASH: Record<string, string> = {
  common: 'rgba(163, 163, 163, 0.7)',
  uncommon: '#4ade80',
  rare: '#38bdf8',
  epic: '#a78bfa',
  legendary: '#fbbf24',
};

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
  private tensionBar: HTMLElement;
  private staminaBar: HTMLElement;
  private reelBehavior: HTMLElement;
  private reelFishName: HTMLElement;
  private reelLabel: HTMLElement;
  private screenFlash: HTMLElement;
  private eventBanner: HTMLElement;
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
    this.tensionBar = document.getElementById('tension-bar')!;
    this.staminaBar = document.getElementById('stamina-bar')!;
    this.reelBehavior = document.getElementById('reel-behavior')!;
    this.reelFishName = document.getElementById('reel-fish-name')!;
    this.reelLabel = document.getElementById('reel-label')!;
    this.screenFlash = document.getElementById('screen-flash')!;
    this.eventBanner = document.getElementById('event-banner')!;
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
    this.deepWaterBadge.textContent = '';
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
      this.flash(this.rarityFlashColor(data));
    });
    this.events.on(Events.LINE_SNAPPED, () => {
      this.escapedUI.textContent = '💥 LINE SNAPPED!';
      this.flash('#ef4444');
    });
    this.events.on(Events.FISH_ESCAPED, () => {
      this.escapedUI.textContent = 'The fish escaped!';
    });
    this.events.on(Events.REEL_START, (e) => {
      this.reelBehavior.textContent = BEHAVIOR_HINTS[e.data.behavior as string] ?? '';
    });
    this.events.on(Events.FOG_EVENT_START, () => {
      this.eventBanner.textContent = '🌫 Heavy fog rolls in... the fish stir below';
      this.eventBanner.classList.add('visible');
    });
    this.events.on(Events.FOG_EVENT_END, () => {
      this.eventBanner.classList.remove('visible');
    });
    this.events.on(Events.LEVEL_UP, (e) => {
      this.showLevelUp(e.data.newLevel);
    });
    this.events.on(Events.BIOME_CHANGE, () => {
      this.syncHUD();
    });
    this.events.on(Events.BOARD_BOAT, () => {
      this.playerMode = PlayerMode.BOAT;
      this.updateBoatBadge();
    });
    this.events.on(Events.DISEMBARK_BOAT, () => {
      this.playerMode = PlayerMode.SHORE;
      this.isDeepWater = false;
      this.updateBoatBadge();
    });
    this.events.on(Events.ENTER_DEEP_WATER, () => {
      this.isDeepWater = true;
      this.updateBoatBadge();
    });
    this.events.on(Events.LEAVE_DEEP_WATER, () => {
      this.isDeepWater = false;
      this.updateBoatBadge();
    });
    this.events.on(Events.BOAT_EQUIPPED, () => {
      this.updateBoatBadge();
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
    const name = data.isTrophy ? `Trophy ${data.species.name}` : data.species.name;
    this.catchFishName.textContent = name;
    this.catchFishName.style.color = data.isTrophy
      ? '#fbbf24'
      : `#${data.species.color.toString(16).padStart(6, '0')}`;

    const rarityLabel = data.isTrophy
      ? `TROPHY ${data.species.rarity.toUpperCase()}`
      : data.species.rarity.toUpperCase();
    this.catchRarity.textContent = rarityLabel;
    this.catchRarity.className = `rarity-${data.species.rarity}`;

    this.catchWeight.textContent = `${data.weight} lbs | +${data.xp} XP | +${data.coins} coins`;

    // Trophy popup styling
    if (data.isTrophy) {
      this.catchPopup.classList.add('trophy');
    } else {
      this.catchPopup.classList.remove('trophy');
    }

    this.catchDisplayed = true;
    this.syncHUD();
  }

  private rarityFlashColor(data: CatchData): string {
    if (data.isTrophy) return '#fbbf24';
    return RARITY_FLASH[data.species.rarity] ?? '#ffffff';
  }

  /** Brief rarity-colored vignette flash */
  private flash(color: string): void {
    this.screenFlash.style.setProperty('--flash-color', color);
    this.screenFlash.classList.add('flash');
    // Force the transition to restart, then fade out
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.screenFlash.classList.remove('flash');
      });
    });
  }

  private showLevelUp(newLevel: number): void {
    this.levelUpBanner.textContent = `LEVEL UP! You are now level ${newLevel}`;
    this.levelUpBanner.classList.add('visible');
    this.levelUpTimer = 3.0;
  }

  private updateBoatBadge(): void {
    if (this.playerMode !== PlayerMode.BOAT) {
      this.deepWaterBadge.style.display = 'none';
      return;
    }

    const boatName = this.player.activeBoat?.name ?? 'Boat';
    const zone = this.isDeepWater ? 'DEEP WATER' : 'SHALLOWS';
    this.deepWaterBadge.textContent = `${boatName} | ${zone}`;
    this.deepWaterBadge.style.display = 'block';
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
      this.reelUI.classList.remove('danger');
      this.reelUI.classList.remove('burst');
      this.reelUI.classList.remove('pump-ready');
      this.reelUI.classList.remove('pump-hit');
      this.escapedUI.classList.remove('visible');

      if (!this.catchDisplayed) {
        this.catchPopup.classList.remove('visible');
      }

      this.prevState = state;
    }

    switch (state) {
      case FishingState.IDLE:
        if (isMobile) {
          // Prompt hidden on mobile via CSS; action button handles context
        } else if (this.playerMode === PlayerMode.BOAT) {
          this.prompt.textContent = `WASD to sail ${this.player.activeBoat?.name ?? 'boat'} | Hold SPACE to cast | E to disembark | TAB shop | J journal`;
        } else {
          this.prompt.textContent = 'WASD to move | Hold SPACE to cast | E to board at dock | TAB shop | J journal';
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
        this.tensionBar.style.width = `${this.fsm.currentTension * 100}%`;
        this.staminaBar.style.width = `${this.fsm.currentStamina * 100}%`;
        this.reelUI.classList.toggle('danger', this.fsm.inDanger);
        this.reelUI.classList.toggle('burst', this.fsm.fishIsBursting);
        this.reelUI.classList.toggle('pump-ready', this.fsm.pumpReady);
        this.reelUI.classList.toggle('pump-hit', this.fsm.pumpFlash > 0);
        this.reelFishName.textContent = this.fsm.currentReelFishName;
        this.reelLabel.textContent = this.fsm.currentFightHint;
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
