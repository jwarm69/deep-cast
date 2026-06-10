import { Component, Events } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { Renderer } from '../core/Renderer';
import { FishingStateMachine } from '../fishing/FishingStateMachine';
import { BiomeConfig } from '../data/biome-config';

type FogPhase = 'clear' | 'thickening' | 'heavy' | 'clearing';

/**
 * FogEventSystem — Mistfall Reservoir's signature mechanic.
 * Every so often, heavy fog rolls in: visibility drops, fish bite faster,
 * and rare fish (the Sturgeon, the Bellmouth) stir. Fog-readers prosper.
 */
export class FogEventSystem implements Component {
  private events: EventSystem;
  private renderer: Renderer;
  private fsm: FishingStateMachine;

  private enabled = false;
  private baseFogDensity = 0.008;
  private fogColor = 0x9fb2ba;

  private phase: FogPhase = 'clear';
  private timer = 0;
  private phaseDuration = 0;
  private fogMix = 0; // 0 = clear, 1 = heavy

  private static readonly HEAVY_DENSITY_MULT = 2.1;
  private static readonly BITE_BOOST = 1.35;
  private static readonly RARE_BONUS = 0.12;

  constructor(events: EventSystem, renderer: Renderer, fsm: FishingStateMachine) {
    this.events = events;
    this.renderer = renderer;
    this.fsm = fsm;
  }

  init(): void {}

  /** Called on biome apply — fog events only run where the biome calls for them */
  setBiome(config: BiomeConfig): void {
    this.baseFogDensity = config.fogDensity;
    this.fogColor = config.fogColor;
    const wasEnabled = this.enabled;
    this.enabled = config.terrain === 'reservoir';

    if (!this.enabled && wasEnabled) {
      this.events.emit(Events.FOG_EVENT_END);
    }
    // Reset state for the new biome
    this.phase = 'clear';
    this.fogMix = 0;
    this.timer = 0;
    this.phaseDuration = this.rollClearDuration();
    this.fsm.setEnvironmentModifiers({});
  }

  private rollClearDuration(): number {
    return 45 + Math.random() * 45;
  }

  private rollHeavyDuration(): number {
    return 20 + Math.random() * 12;
  }

  update(dt: number): void {
    if (!this.enabled) return;

    this.timer += dt;

    switch (this.phase) {
      case 'clear':
        if (this.timer >= this.phaseDuration) {
          this.phase = 'thickening';
          this.timer = 0;
          this.events.emit(Events.FOG_EVENT_START);
          this.fsm.setEnvironmentModifiers({
            biteSpeedMultiplier: FogEventSystem.BITE_BOOST,
            rareBonus: FogEventSystem.RARE_BONUS,
          });
        }
        break;

      case 'thickening':
        this.fogMix = Math.min(1, this.fogMix + dt / 5);
        if (this.fogMix >= 1) {
          this.phase = 'heavy';
          this.timer = 0;
          this.phaseDuration = this.rollHeavyDuration();
        }
        break;

      case 'heavy':
        if (this.timer >= this.phaseDuration) {
          this.phase = 'clearing';
          this.timer = 0;
          this.events.emit(Events.FOG_EVENT_END);
          this.fsm.setEnvironmentModifiers({});
        }
        break;

      case 'clearing':
        this.fogMix = Math.max(0, this.fogMix - dt / 7);
        if (this.fogMix <= 0) {
          this.phase = 'clear';
          this.timer = 0;
          this.phaseDuration = this.rollClearDuration();
        }
        break;
    }

    if (this.fogMix > 0 || this.phase !== 'clear') {
      const density = this.baseFogDensity * (1 + (FogEventSystem.HEAVY_DENSITY_MULT - 1) * this.fogMix);
      this.renderer.setBiomeAtmosphere(this.fogColor, this.fogColor, density);
    }
  }

  destroy(): void {}
}
