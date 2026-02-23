import { Component, Events } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { InputManager } from '../core/InputManager';
import { PlayerState } from '../state/PlayerState';
import { RODS, LURES, LINES, RodData, LureData, LineData } from '../data/equipment';

export class ShopUI implements Component {
  private events: EventSystem;
  private input: InputManager;
  private player: PlayerState;
  private overlay: HTMLElement;
  private isOpen = false;
  private wasTabDown = false;

  constructor(events: EventSystem, input: InputManager, player: PlayerState) {
    this.events = events;
    this.input = input;
    this.player = player;
    this.overlay = this.createOverlay();
    document.getElementById('game-ui')!.appendChild(this.overlay);
  }

  init(): void {
    this.events.on(Events.EQUIPMENT_PURCHASED, () => this.rebuild());
    this.events.on(Events.EQUIPMENT_EQUIPPED, () => this.rebuild());
    this.events.on(Events.COINS_CHANGED, () => this.rebuild());
    this.events.on(Events.LEVEL_UP, () => this.rebuild());
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
    header.style.cssText = 'text-align:center; margin-bottom:24px;';
    header.innerHTML = `
      <div style="font-size:28px; font-weight:800; letter-spacing:2px; margin-bottom:8px;">TACKLE SHOP</div>
      <div style="font-size:16px; opacity:0.6;">Level ${this.player.level} | ${this.player.coins} coins</div>
      <div style="font-size:13px; opacity:0.4; margin-top:8px;">Press TAB to close</div>
    `;
    this.overlay.appendChild(header);

    // Columns container
    const cols = document.createElement('div');
    cols.style.cssText = `
      display: flex; gap: 24px; width: 100%; max-width: 960px;
      justify-content: center; flex-wrap: wrap;
    `;

    cols.appendChild(this.buildColumn('Rods', RODS, 'rod'));
    cols.appendChild(this.buildColumn('Lures', LURES, 'lure'));
    cols.appendChild(this.buildColumn('Lines', LINES, 'line'));
    this.overlay.appendChild(cols);
  }

  private buildColumn(title: string, items: (RodData | LureData | LineData)[], type: string): HTMLElement {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1; min-width:260px; max-width:300px;';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:18px; font-weight:700; margin-bottom:12px; text-align:center; text-transform:uppercase; letter-spacing:2px; opacity:0.7;';
    heading.textContent = title;
    col.appendChild(heading);

    for (const item of items) {
      col.appendChild(this.buildCard(item, type));
    }
    return col;
  }

  private buildCard(item: RodData | LureData | LineData, type: string): HTMLElement {
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

    // Name + tier
    const tierStars = '\u2605'.repeat(item.tier);
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
    nameRow.innerHTML = `
      <span style="font-weight:600; font-size:14px;">${item.name}</span>
      <span style="color:#facc15; font-size:12px;">${tierStars}</span>
    `;
    card.appendChild(nameRow);

    // Stats
    const stats = document.createElement('div');
    stats.style.cssText = 'font-size:12px; opacity:0.6; margin-bottom:8px;';
    stats.textContent = this.getStatLine(item, type);
    card.appendChild(stats);

    // Action row
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

    // Click handler
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
