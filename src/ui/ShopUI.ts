import { Component, Events, FishingState } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { PlayerState } from '../state/PlayerState';
import { RODS, LURES, LINES, BOATS, RodData, LureData, LineData, BoatData } from '../data/equipment';
import { BIOME_CONFIGS, TerrainType } from '../data/biome-config';
import { FishingStateMachine } from '../fishing/FishingStateMachine';

type ShopTab = 'equipment' | 'boats' | 'locations';

export class ShopUI implements Component {
  private events: EventSystem;
  private input: InputManager;
  private player: PlayerState;
  private fsm: FishingStateMachine;
  private overlay: HTMLElement;
  private isOpen = false;
  private wasTabDown = false;
  private activeTab: ShopTab = 'equipment';

  constructor(events: EventSystem, input: InputManager, player: PlayerState, fsm: FishingStateMachine) {
    this.events = events;
    this.input = input;
    this.player = player;
    this.fsm = fsm;
    this.overlay = this.createOverlay();
    document.getElementById('game-ui')!.appendChild(this.overlay);
  }

  init(): void {
    this.events.on(Events.EQUIPMENT_PURCHASED, () => this.rebuild());
    this.events.on(Events.EQUIPMENT_EQUIPPED, () => this.rebuild());
    this.events.on(Events.BOAT_PURCHASED, () => this.rebuild());
    this.events.on(Events.BOAT_EQUIPPED, () => this.rebuild());
    this.events.on(Events.COINS_CHANGED, () => this.rebuild());
    this.events.on(Events.LEVEL_UP, () => this.rebuild());
    this.events.on(Events.BIOME_CHANGE, () => this.rebuild());
  }

  private createOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'shop-overlay';
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

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'text-align:center; margin-bottom:16px;';
    header.innerHTML = `
      <div style="font-size:28px; font-weight:800; letter-spacing:2px; margin-bottom:8px;">TACKLE SHOP</div>
      <div style="font-size:16px; opacity:0.6;">Level ${this.player.level} | ${this.player.coins} coins</div>
      <div style="font-size:13px; opacity:0.4; margin-top:8px;">Press TAB to close</div>
    `;
    this.overlay.appendChild(header);

    // Tab bar
    this.overlay.appendChild(this.buildTabBar());

    // Tab content
    switch (this.activeTab) {
      case 'equipment':
        this.overlay.appendChild(this.buildEquipmentTab());
        break;
      case 'boats':
        this.overlay.appendChild(this.buildBoatsTab());
        break;
      case 'locations':
        this.overlay.appendChild(this.buildLocationsTab());
        break;
    }
  }

  private buildTabBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex; gap: 4px; margin-bottom: 24px;
      background: rgba(255,255,255,0.06); border-radius: 12px; padding: 4px;
    `;

    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'equipment', label: 'Equipment' },
      { id: 'boats', label: 'Boats' },
      { id: 'locations', label: 'Locations' },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      const active = this.activeTab === tab.id;
      btn.style.cssText = `
        padding: 8px 24px; border: none; border-radius: 8px; cursor: pointer;
        font-size: 14px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
        color: ${active ? '#000' : 'rgba(255,255,255,0.6)'};
        background: ${active ? 'rgba(255,255,255,0.9)' : 'transparent'};
        transition: all 0.15s;
        font-family: inherit;
      `;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.rebuild();
      });
      btn.addEventListener('mouseenter', () => {
        if (!active) btn.style.background = 'rgba(255,255,255,0.1)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!active) btn.style.background = 'transparent';
      });
      bar.appendChild(btn);
    }

    return bar;
  }

  private buildEquipmentTab(): HTMLElement {
    const cols = document.createElement('div');
    cols.style.cssText = `
      display: flex; gap: 24px; width: 100%; max-width: 960px;
      justify-content: center; flex-wrap: wrap;
    `;
    cols.appendChild(this.buildColumn('Rods', RODS, 'rod'));
    cols.appendChild(this.buildColumn('Lures', LURES, 'lure'));
    cols.appendChild(this.buildColumn('Lines', LINES, 'line'));
    return cols;
  }

  private buildColumn(title: string, items: (RodData | LureData | LineData)[], type: string): HTMLElement {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1; min-width:260px; max-width:300px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:18px; font-weight:700; margin-bottom:12px; text-align:center; text-transform:uppercase; letter-spacing:2px; opacity:0.7;';
    heading.textContent = title;
    col.appendChild(heading);

    for (const item of items) {
      col.appendChild(this.buildEquipmentCard(item, type));
    }
    return col;
  }

  private buildEquipmentCard(item: RodData | LureData | LineData, type: string): HTMLElement {
    const owned = type === 'rod' ? this.player.ownedRods.has(item.id)
      : type === 'lure' ? this.player.ownedLures.has(item.id)
      : this.player.ownedLines.has(item.id);

    const equipped = type === 'rod' ? this.player.activeRodId === item.id
      : type === 'lure' ? this.player.activeLureId === item.id
      : this.player.activeLineId === item.id;

    const canAfford = this.player.coins >= item.cost;
    const levelMet = this.player.level >= item.levelRequired;

    const card = document.createElement('div');
    const borderColor = equipped ? '#facc15' : owned ? '#4ade80' : 'rgba(255,255,255,0.15)';
    const bg = equipped ? 'rgba(250,204,21,0.08)' : owned ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)';
    card.style.cssText = `
      border: 1px solid ${borderColor};
      background: ${bg};
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 8px;
      cursor: ${owned || (canAfford && levelMet) ? 'pointer' : 'default'};
      transition: background 0.15s;
      opacity: ${!owned && !levelMet ? '0.4' : '1'};
    `;

    const tierStars = '\u2605'.repeat(item.tier);
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
    nameRow.innerHTML = `
      <span style="font-weight:600; font-size:14px;">${item.name}</span>
      <span style="color:#facc15; font-size:12px;">${tierStars}</span>
    `;
    card.appendChild(nameRow);

    const stats = document.createElement('div');
    stats.style.cssText = 'font-size:12px; opacity:0.6; margin-bottom:8px;';
    stats.textContent = this.getStatLine(item, type);
    card.appendChild(stats);

    const action = document.createElement('div');
    action.style.cssText = 'font-size:12px; display:flex; justify-content:space-between; align-items:center;';

    if (equipped) {
      action.innerHTML = '<span style="color:#facc15; font-weight:600;">EQUIPPED</span>';
    } else if (owned) {
      action.innerHTML = '<span style="color:#4ade80;">OWNED</span><span style="opacity:0.5;">Click to equip</span>';
    } else if (!levelMet) {
      action.innerHTML = `<span style="color:#ef4444;">Requires Lv.${item.levelRequired}</span><span style="opacity:0.5;">${item.cost} coins</span>`;
    } else if (!canAfford) {
      action.innerHTML = `<span style="color:#ef4444;">${item.cost} coins</span><span style="opacity:0.3;">Can't afford</span>`;
    } else {
      action.innerHTML = `<span style="color:#38bdf8;">${item.cost} coins</span><span style="opacity:0.6;">Click to buy</span>`;
    }
    card.appendChild(action);

    card.addEventListener('click', () => {
      if (equipped) return;
      if (owned) {
        if (type === 'rod') this.player.equipRod(item.id);
        else if (type === 'lure') this.player.equipLure(item.id);
        else this.player.equipLine(item.id);
      } else if (canAfford && levelMet) {
        if (type === 'rod') this.player.purchaseRod(item.id);
        else if (type === 'lure') this.player.purchaseLure(item.id);
        else this.player.purchaseLine(item.id);
      }
    });

    card.addEventListener('mouseenter', () => {
      if (owned || (canAfford && levelMet)) card.style.background = 'rgba(255,255,255,0.08)';
    });
    card.addEventListener('mouseleave', () => { card.style.background = bg; });

    return card;
  }

  private getStatLine(item: RodData | LureData | LineData, type: string): string {
    if (type === 'rod') {
      const rod = item as RodData;
      return `Cast: ${rod.castPowerMultiplier}x | Reel: ${rod.reelSpeedMultiplier}x`;
    } else if (type === 'lure') {
      const lure = item as LureData;
      return `Bite Speed: ${lure.biteSpeedMultiplier}x | Rare Bonus: +${Math.round(lure.rareBonusChance * 100)}%`;
    } else {
      const line = item as LineData;
      return `Max Fish Weight: ${line.maxFishWeight} lbs`;
    }
  }

  // --- Boats tab ---

  private buildBoatsTab(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px; width: 100%; max-width: 860px;
    `;

    for (const boat of BOATS) {
      container.appendChild(this.buildBoatCard(boat));
    }
    return container;
  }

  private buildBoatCard(boat: BoatData): HTMLElement {
    const owned = this.player.ownedBoats.has(boat.id);
    const equipped = this.player.activeBoatId === boat.id;
    const canAfford = this.player.coins >= boat.cost;
    const levelMet = this.player.level >= boat.levelRequired;

    const borderColor = equipped ? '#facc15' : owned ? '#4ade80' : 'rgba(255,255,255,0.15)';
    const bg = equipped ? 'rgba(250,204,21,0.08)' : owned ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)';

    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid ${borderColor};
      background: ${bg};
      border-radius: 12px;
      padding: 16px 20px;
      cursor: ${owned || (canAfford && levelMet) ? 'pointer' : 'default'};
      transition: background 0.15s;
      opacity: ${!owned && !levelMet ? '0.4' : '1'};
    `;

    const tierStars = '\u2605'.repeat(boat.tier);
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-weight:700; font-size:16px;">${boat.name}</span>
        <span style="color:#facc15; font-size:13px;">${tierStars}</span>
      </div>
      <div style="font-size:12px; opacity:0.6; margin-bottom:4px;">
        Speed: ${boat.speed} | Rarity Bonus: +${Math.round(boat.rarityBoost * 100)}%
      </div>
    `;

    const action = document.createElement('div');
    action.style.cssText = 'font-size:12px; display:flex; justify-content:space-between; align-items:center; margin-top:10px;';

    if (equipped) {
      action.innerHTML = '<span style="color:#facc15; font-weight:600;">EQUIPPED</span>';
    } else if (owned) {
      action.innerHTML = '<span style="color:#4ade80;">OWNED</span><span style="opacity:0.5;">Click to equip</span>';
    } else if (!levelMet) {
      action.innerHTML = `<span style="color:#ef4444;">Requires Lv.${boat.levelRequired}</span><span style="opacity:0.5;">${boat.cost} coins</span>`;
    } else if (!canAfford) {
      action.innerHTML = `<span style="color:#ef4444;">${boat.cost} coins</span><span style="opacity:0.3;">Can't afford</span>`;
    } else {
      action.innerHTML = `<span style="color:#38bdf8;">${boat.cost === 0 ? 'Free' : boat.cost + ' coins'}</span><span style="opacity:0.6;">Click to buy</span>`;
    }
    card.appendChild(action);

    card.addEventListener('click', () => {
      if (equipped) return;
      if (owned) {
        this.player.equipBoat(boat.id);
      } else if (canAfford && levelMet) {
        this.player.purchaseBoat(boat.id);
      }
    });

    card.addEventListener('mouseenter', () => {
      if (owned || (canAfford && levelMet)) card.style.background = 'rgba(255,255,255,0.08)';
    });
    card.addEventListener('mouseleave', () => { card.style.background = bg; });

    return card;
  }

  // --- Locations tab ---

  private buildLocationsTab(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex; gap: 20px; width: 100%; max-width: 860px;
      justify-content: center; flex-wrap: wrap;
    `;

    const biomes: TerrainType[] = ['lake', 'tropical', 'arctic', 'swamp', 'mountain', 'volcano'];
    for (const terrain of biomes) {
      container.appendChild(this.buildLocationCard(terrain));
    }
    return container;
  }

  private buildLocationCard(terrain: TerrainType): HTMLElement {
    const config = BIOME_CONFIGS[terrain];
    const isCurrent = this.player.currentTerrain === terrain;
    const levelMet = this.player.level >= config.levelRequired;
    const canAfford = this.player.coins >= config.travelCost;
    const canTravel = !isCurrent && levelMet && canAfford && this.fsm.state === FishingState.IDLE;

    const borderColor = isCurrent ? '#facc15' : levelMet ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)';
    const bg = isCurrent ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.03)';

    // Biome color accent
    const accentColor = `#${config.skyColor.toString(16).padStart(6, '0')}`;

    const card = document.createElement('div');
    card.style.cssText = `
      border: 2px solid ${borderColor};
      background: ${bg};
      border-radius: 14px;
      padding: 24px;
      min-width: 220px;
      flex: 1;
      max-width: 260px;
      cursor: ${canTravel ? 'pointer' : 'default'};
      transition: background 0.15s, transform 0.15s;
      opacity: ${!levelMet ? '0.4' : '1'};
    `;

    card.innerHTML = `
      <div style="width:100%; height:8px; border-radius:4px; background:${accentColor}; margin-bottom:16px;"></div>
      <div style="font-size:20px; font-weight:800; margin-bottom:8px;">${config.name}</div>
      <div style="font-size:13px; opacity:0.5; margin-bottom:4px;">Level ${config.levelRequired} required</div>
      <div style="font-size:13px; opacity:0.5; margin-bottom:16px;">Travel cost: ${config.travelCost === 0 ? 'Free' : config.travelCost + ' coins'}</div>
    `;

    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'font-size:13px; font-weight:600;';

    if (isCurrent) {
      actionRow.innerHTML = '<span style="color:#facc15;">YOU ARE HERE</span>';
    } else if (!levelMet) {
      actionRow.innerHTML = `<span style="color:#ef4444;">Locked (Lv.${config.levelRequired})</span>`;
    } else if (!canAfford) {
      actionRow.innerHTML = '<span style="color:#ef4444;">Not enough coins</span>';
    } else {
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 8px 20px; border: 1px solid #38bdf8; border-radius: 8px;
        background: rgba(56,189,248,0.15); color: #38bdf8; cursor: pointer;
        font-size: 13px; font-weight: 700; font-family: inherit;
        letter-spacing: 1px; text-transform: uppercase;
        transition: all 0.15s;
      `;
      btn.textContent = 'Travel';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.player.travelTo(terrain, this.fsm.state);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(56,189,248,0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(56,189,248,0.15)';
      });
      actionRow.appendChild(btn);
    }
    card.appendChild(actionRow);

    if (canTravel) {
      card.addEventListener('mouseenter', () => {
        card.style.background = 'rgba(255,255,255,0.06)';
        card.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = bg;
        card.style.transform = 'translateY(0)';
      });
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
    this.events.emit(Events.SHOP_TOGGLE, { open: this.isOpen });
  }

  get open(): boolean { return this.isOpen; }

  update(_dt: number): void {
    const tabDown = this.input.isKeyDown('tab');
    if (tabDown && !this.wasTabDown) {
      this.toggle();
    }
    this.wasTabDown = tabDown;
  }

  destroy(): void {
    this.overlay.remove();
  }
}
