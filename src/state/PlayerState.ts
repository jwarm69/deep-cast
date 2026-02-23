import { Component, Events, CatchData } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { xpForLevel, totalXpForLevel } from '../data/progression-tables';
import { RODS, LURES, LINES, RodData, LureData, LineData } from '../data/equipment';

const SAVE_KEY = 'deep-cast-save';
const SAVE_VERSION = 1;

export interface FishJournalEntry {
  speciesId: string;
  timesCaught: number;
  bestWeight: number;
  firstCaughtAt: number;
}

interface SaveData {
  version: number;
  level: number;
  totalXP: number;
  coins: number;
  ownedRods: string[];
  ownedLures: string[];
  ownedLines: string[];
  activeRodId: string;
  activeLureId: string;
  activeLineId: string;
  journal: Record<string, FishJournalEntry>;
  totalFishCaught: number;
}

export class PlayerState implements Component {
  private events: EventSystem;

  level = 1;
  totalXP = 0;
  coins = 0;
  totalFishCaught = 0;

  ownedRods: Set<string> = new Set(['basic_rod']);
  ownedLures: Set<string> = new Set(['standard']);
  ownedLines: Set<string> = new Set(['basic_line']);

  activeRodId = 'basic_rod';
  activeLureId = 'standard';
  activeLineId = 'basic_line';

  journal: Map<string, FishJournalEntry> = new Map();

  constructor(events: EventSystem) {
    this.events = events;
  }

  init(): void {
    this.load();
    this.events.on(Events.FISH_CAUGHT, (e) => {
      const data = e.data as CatchData;
      this.onFishCaught(data);
    });
  }

  private onFishCaught(data: CatchData): void {
    this.totalFishCaught++;

    // Add coins
    this.coins += data.coins;
    this.events.emit(Events.COINS_CHANGED, { coins: this.coins });

    // Add XP and check for level up
    this.totalXP += data.xp;
    const oldLevel = this.level;
    this.recalculateLevel();
    this.events.emit(Events.XP_CHANGED, {
      totalXP: this.totalXP,
      level: this.level,
      xpForCurrent: this.xpIntoCurrentLevel,
      xpNeeded: xpForLevel(this.level + 1),
    });

    if (this.level > oldLevel) {
      this.events.emit(Events.LEVEL_UP, {
        oldLevel,
        newLevel: this.level,
      });
    }

    // Update journal
    const entry = this.journal.get(data.species.id);
    if (entry) {
      entry.timesCaught++;
      if (data.weight > entry.bestWeight) entry.bestWeight = data.weight;
    } else {
      this.journal.set(data.species.id, {
        speciesId: data.species.id,
        timesCaught: 1,
        bestWeight: data.weight,
        firstCaughtAt: Date.now(),
      });
    }

    this.save();
  }

  private recalculateLevel(): void {
    let level = 1;
    while (totalXpForLevel(level + 1) <= this.totalXP) {
      level++;
      if (level >= 50) break;
    }
    this.level = level;
  }

  /** XP earned within the current level */
  get xpIntoCurrentLevel(): number {
    return this.totalXP - totalXpForLevel(this.level);
  }

  /** XP needed to reach next level (from current level start) */
  get xpForNextLevel(): number {
    return xpForLevel(this.level + 1);
  }

  /** 0-1 progress toward next level */
  get levelProgress(): number {
    const needed = this.xpForNextLevel;
    if (needed <= 0) return 1;
    return Math.min(1, this.xpIntoCurrentLevel / needed);
  }

  // --- Equipment getters ---

  get activeRod(): RodData {
    return RODS.find((r) => r.id === this.activeRodId) ?? RODS[0];
  }

  get activeLure(): LureData {
    return LURES.find((l) => l.id === this.activeLureId) ?? LURES[0];
  }

  get activeLine(): LineData {
    return LINES.find((l) => l.id === this.activeLineId) ?? LINES[0];
  }

  // --- Equipment actions ---

  canPurchase(cost: number, levelRequired: number): boolean {
    return this.coins >= cost && this.level >= levelRequired;
  }

  purchaseRod(id: string): boolean {
    const rod = RODS.find((r) => r.id === id);
    if (!rod || this.ownedRods.has(id)) return false;
    if (!this.canPurchase(rod.cost, rod.levelRequired)) return false;
    this.coins -= rod.cost;
    this.ownedRods.add(id);
    this.activeRodId = id;
    this.events.emit(Events.EQUIPMENT_PURCHASED, { type: 'rod', item: rod });
    this.events.emit(Events.COINS_CHANGED, { coins: this.coins });
    this.save();
    return true;
  }

  purchaseLure(id: string): boolean {
    const lure = LURES.find((l) => l.id === id);
    if (!lure || this.ownedLures.has(id)) return false;
    if (!this.canPurchase(lure.cost, lure.levelRequired)) return false;
    this.coins -= lure.cost;
    this.ownedLures.add(id);
    this.activeLureId = id;
    this.events.emit(Events.EQUIPMENT_PURCHASED, { type: 'lure', item: lure });
    this.events.emit(Events.COINS_CHANGED, { coins: this.coins });
    this.save();
    return true;
  }

  purchaseLine(id: string): boolean {
    const line = LINES.find((l) => l.id === id);
    if (!line || this.ownedLines.has(id)) return false;
    if (!this.canPurchase(line.cost, line.levelRequired)) return false;
    this.coins -= line.cost;
    this.ownedLines.add(id);
    this.activeLineId = id;
    this.events.emit(Events.EQUIPMENT_PURCHASED, { type: 'line', item: line });
    this.events.emit(Events.COINS_CHANGED, { coins: this.coins });
    this.save();
    return true;
  }

  equipRod(id: string): void {
    if (this.ownedRods.has(id)) {
      this.activeRodId = id;
      this.events.emit(Events.EQUIPMENT_EQUIPPED, { type: 'rod', id });
      this.save();
    }
  }

  equipLure(id: string): void {
    if (this.ownedLures.has(id)) {
      this.activeLureId = id;
      this.events.emit(Events.EQUIPMENT_EQUIPPED, { type: 'lure', id });
      this.save();
    }
  }

  equipLine(id: string): void {
    if (this.ownedLines.has(id)) {
      this.activeLineId = id;
      this.events.emit(Events.EQUIPMENT_EQUIPPED, { type: 'line', id });
      this.save();
    }
  }

  // --- Persistence ---

  private save(): void {
    const data: SaveData = {
      version: SAVE_VERSION,
      level: this.level,
      totalXP: this.totalXP,
      coins: this.coins,
      ownedRods: [...this.ownedRods],
      ownedLures: [...this.ownedLures],
      ownedLines: [...this.ownedLines],
      activeRodId: this.activeRodId,
      activeLureId: this.activeLureId,
      activeLineId: this.activeLineId,
      journal: Object.fromEntries(this.journal),
      totalFishCaught: this.totalFishCaught,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data: SaveData = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) return;

      this.level = data.level;
      this.totalXP = data.totalXP;
      this.coins = data.coins;
      this.totalFishCaught = data.totalFishCaught;
      this.ownedRods = new Set(data.ownedRods);
      this.ownedLures = new Set(data.ownedLures);
      this.ownedLines = new Set(data.ownedLines);
      this.activeRodId = data.activeRodId;
      this.activeLureId = data.activeLureId;
      this.activeLineId = data.activeLineId;
      this.journal = new Map(Object.entries(data.journal));
    } catch {
      // Corrupt save — start fresh
    }
  }

  update(_dt: number): void {}

  destroy(): void {
    this.save();
  }
}
