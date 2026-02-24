import { Component, Events, Rarity, FishSpecies } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { PlayerState } from '../state/PlayerState';
import { ALL_FISH, FISH_BY_TERRAIN, DEEP_FISH_BY_TERRAIN } from '../data/fish-species';
import { BIOME_CONFIGS, TerrainType } from '../data/biome-config';

const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]: '#a3a3a3',
  [Rarity.UNCOMMON]: '#4ade80',
  [Rarity.RARE]: '#38bdf8',
  [Rarity.EPIC]: '#a78bfa',
  [Rarity.LEGENDARY]: '#fbbf24',
};

const RARITY_BG: Record<Rarity, string> = {
  [Rarity.COMMON]: 'rgba(82,82,82,0.2)',
  [Rarity.UNCOMMON]: 'rgba(22,163,74,0.15)',
  [Rarity.RARE]: 'rgba(2,132,199,0.15)',
  [Rarity.EPIC]: 'rgba(124,58,237,0.15)',
  [Rarity.LEGENDARY]: 'rgba(217,119,6,0.15)',
};

export class JournalUI implements Component {
  private events: EventSystem;
  private input: InputManager;
  private player: PlayerState;
  private overlay: HTMLElement;
  private isOpen = false;
  private wasJDown = false;

  constructor(events: EventSystem, input: InputManager, player: PlayerState) {
    this.events = events;
    this.input = input;
    this.player = player;
    this.overlay = this.createOverlay();
    document.getElementById('game-ui')!.appendChild(this.overlay);
  }

  init(): void {
    this.events.on(Events.FISH_CAUGHT, () => {
      if (this.isOpen) this.rebuild();
    });
  }

  private createOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'journal-overlay';
    el.style.cssText = `
      position: absolute; inset: 0;
      display: none;
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(12px);
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      overflow-y: auto;
      z-index: 100;
    `;
    return el;
  }

  private rebuild(): void {
    if (!this.isOpen) return;
    this.overlay.innerHTML = '';

    const caught = this.player.journal.size;
    const total = ALL_FISH.length;
    const pct = total > 0 ? Math.round((caught / total) * 100) : 0;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'text-align:center; margin-bottom:24px;';
    header.innerHTML = `
      <div style="font-size:28px; font-weight:800; letter-spacing:2px; margin-bottom:8px;">FISH JOURNAL</div>
      <div style="font-size:16px; opacity:0.6;">${caught} / ${total} species discovered (${pct}%)</div>
      <div style="font-size:13px; opacity:0.4; margin-top:8px;">Press J to close</div>
    `;
    this.overlay.appendChild(header);

    // Completion bar
    const barBg = document.createElement('div');
    barBg.style.cssText = 'width:300px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; margin-bottom:28px; overflow:hidden;';
    const barFill = document.createElement('div');
    barFill.style.cssText = `width:${pct}%; height:100%; background:linear-gradient(90deg,#38bdf8,#818cf8); border-radius:4px; transition:width 0.3s;`;
    barBg.appendChild(barFill);
    this.overlay.appendChild(barBg);

    // Biome sections
    const biomes: TerrainType[] = ['lake', 'tropical', 'arctic'];
    for (const terrain of biomes) {
      this.overlay.appendChild(this.buildBiomeSection(terrain));
    }
  }

  private buildBiomeSection(terrain: TerrainType): HTMLElement {
    const config = BIOME_CONFIGS[terrain];
    const fish = [...FISH_BY_TERRAIN[terrain], ...DEEP_FISH_BY_TERRAIN[terrain]];
    const biomeCaught = fish.filter((f) => this.player.journal.has(f.id)).length;
    const accentColor = `#${config.skyColor.toString(16).padStart(6, '0')}`;

    const section = document.createElement('div');
    section.style.cssText = 'width:100%; max-width:860px; margin-bottom:32px;';

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
      display:flex; align-items:center; gap:12px; margin-bottom:14px;
      padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);
    `;
    sectionHeader.innerHTML = `
      <div style="width:12px; height:12px; border-radius:3px; background:${accentColor};"></div>
      <span style="font-size:18px; font-weight:700;">${config.name}</span>
      <span style="font-size:14px; opacity:0.5; margin-left:auto;">${biomeCaught} / ${fish.length}</span>
    `;
    section.appendChild(sectionHeader);

    // Fish grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    `;

    for (const f of fish) {
      const entry = this.player.journal.get(f.id);
      grid.appendChild(this.buildCard(f, entry));
    }

    section.appendChild(grid);
    return section;
  }

  private buildCard(fish: FishSpecies, entry: { timesCaught: number; bestWeight: number } | undefined): HTMLElement {
    const discovered = !!entry;
    const color = RARITY_COLORS[fish.rarity];
    const bg = discovered ? RARITY_BG[fish.rarity] : 'rgba(255,255,255,0.03)';
    const borderColor = discovered ? color : 'rgba(255,255,255,0.08)';

    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid ${borderColor};
      background: ${bg};
      border-radius: 10px;
      padding: 14px 16px;
      opacity: ${discovered ? '1' : '0.35'};
    `;

    if (discovered) {
      const hexColor = `#${fish.color.toString(16).padStart(6, '0')}`;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; font-size:14px; color:${hexColor};">${fish.name}</span>
          <span style="font-size:11px; color:${color}; text-transform:uppercase; font-weight:600; padding:2px 8px; border:1px solid ${color}; border-radius:8px;">${fish.rarity}</span>
        </div>
        <div style="font-size:12px; opacity:0.6; margin-bottom:4px;">${fish.description}</div>
        <div style="font-size:12px; opacity:0.5; display:flex; justify-content:space-between; margin-top:8px;">
          <span>Best: ${entry!.bestWeight} lbs</span>
          <span>Caught: ${entry!.timesCaught}x</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; font-size:14px; color:#525252;">???</span>
          <span style="font-size:11px; color:${color}; text-transform:uppercase; font-weight:600; padding:2px 8px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; opacity:0.5;">${fish.rarity}</span>
        </div>
        <div style="font-size:12px; opacity:0.3; font-style:italic;">Not yet discovered</div>
      `;
    }

    return card;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.rebuild();
      this.overlay.style.display = 'flex';
    } else {
      this.overlay.style.display = 'none';
    }
    this.events.emit(Events.JOURNAL_TOGGLE, { open: this.isOpen });
  }

  get open(): boolean { return this.isOpen; }

  update(_dt: number): void {
    const jDown = this.input.isKeyDown('j');
    if (jDown && !this.wasJDown) {
      this.toggle();
    }
    this.wasJDown = jDown;
  }

  destroy(): void {
    this.overlay.remove();
  }
}
