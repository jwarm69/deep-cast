import { Component, Events, GameEvent, CatchData } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { RemotePresenceState, PresenceActivity } from '../multiplayer/types';
import { FISHING_SPOTS } from '../multiplayer/fishing-spots';

const ACTIVITY_LABELS: Record<PresenceActivity, string> = {
  walking: 'on shore',
  sailing: 'sailing',
  casting: 'casting',
  waiting: 'waiting for a bite',
  reeling: 'fighting a fish',
  caught: 'just caught one!',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#a3a3a3',
  uncommon: '#4ade80',
  rare: '#38bdf8',
  epic: '#a78bfa',
  legendary: '#fbbf24',
};

interface FeedEntry {
  el: HTMLElement;
  age: number;
}

const FEED_LIFETIME = 9;
const MAX_FEED = 5;
const MAX_ANGLER_ROWS = 5;

/**
 * MultiplayerUI — online anglers pill, nearby anglers list, and live catch feed.
 * Driven entirely by presence updates; works (quietly) in local single-player mode too.
 */
export class MultiplayerUI implements Component {
  private events: EventSystem;
  private panel!: HTMLElement;
  private onlinePill!: HTMLElement;
  private anglersList!: HTMLElement;
  private feedContainer!: HTMLElement;

  private feed: FeedEntry[] = [];
  private seenCatches = new Set<string>();
  private connected = false;
  private firstSync = true;

  private onConnected: (e: GameEvent) => void;
  private onPresence: (e: GameEvent) => void;
  private onOwnCatch: (e: GameEvent) => void;

  constructor(events: EventSystem) {
    this.events = events;
    this.onConnected = () => {
      this.connected = true;
      this.panel.style.display = 'flex';
    };
    this.onPresence = (e) => this.handlePresence(e.data.players as RemotePresenceState[]);
    this.onOwnCatch = (e) => {
      const data = e.data as CatchData;
      const name = data.isTrophy ? `Trophy ${data.species.name}` : data.species.name;
      this.pushFeedEntry('You', name, data.species.rarity, data.weight, data.isTrophy ?? false);
    };
  }

  init(): void {
    this.injectStyles();
    this.buildDom();
    this.events.on(Events.PRESENCE_CONNECTED, this.onConnected);
    this.events.on(Events.PRESENCE_UPDATED, this.onPresence);
    this.events.on(Events.FISH_CAUGHT, this.onOwnCatch);
    this.renderOnlineCount(0);
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.id = 'mp-ui-styles';
    style.textContent = `
      #mp-panel {
        position: absolute;
        top: 52px;
        right: 16px;
        display: none;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        pointer-events: none !important;
        max-width: 280px;
      }
      #mp-panel * { pointer-events: none !important; }
      #mp-online-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 14px;
        background: rgba(8, 25, 45, 0.72);
        border: 1px solid rgba(56, 189, 248, 0.35);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #bae6fd;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      #mp-online-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 6px rgba(74, 222, 128, 0.9);
      }
      #mp-anglers {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
      }
      .mp-angler-row {
        font-size: 11px;
        color: rgba(255,255,255,0.85);
        text-shadow: 0 1px 2px rgba(0,0,0,0.85);
        background: rgba(0, 10, 25, 0.45);
        padding: 2px 9px;
        border-radius: 9px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 270px;
      }
      .mp-angler-name { font-weight: 700; }
      .mp-angler-doing { opacity: 0.65; }
      #mp-feed {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        margin-top: 4px;
      }
      .mp-feed-entry {
        font-size: 12px;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.85);
        background: rgba(0, 12, 28, 0.66);
        border-left: 3px solid rgba(255,255,255,0.4);
        padding: 4px 10px;
        border-radius: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 270px;
        animation: mp-feed-in 0.3s ease-out;
        transition: opacity 0.6s;
      }
      .mp-feed-entry.fading { opacity: 0; }
      @keyframes mp-feed-in {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @media (max-width: 768px), (pointer: coarse) {
        #mp-panel { top: 44px; right: 8px; max-width: 200px; }
        #mp-anglers { display: none; }
        .mp-feed-entry { font-size: 10px; max-width: 190px; }
        #mp-online-pill { font-size: 10px; padding: 4px 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  private buildDom(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'mp-panel';

    this.onlinePill = document.createElement('div');
    this.onlinePill.id = 'mp-online-pill';
    this.panel.appendChild(this.onlinePill);

    this.anglersList = document.createElement('div');
    this.anglersList.id = 'mp-anglers';
    this.panel.appendChild(this.anglersList);

    this.feedContainer = document.createElement('div');
    this.feedContainer.id = 'mp-feed';
    this.panel.appendChild(this.feedContainer);

    document.getElementById('game-ui')!.appendChild(this.panel);
  }

  private renderOnlineCount(remoteCount: number): void {
    const total = remoteCount + 1;
    this.onlinePill.innerHTML = `
      <span id="mp-online-dot"></span>
      <span>${total} angler${total === 1 ? '' : 's'} here</span>
    `;
  }

  private handlePresence(players: RemotePresenceState[]): void {
    this.renderOnlineCount(players.length);

    // Nearby anglers list
    this.anglersList.innerHTML = '';
    for (const p of players.slice(0, MAX_ANGLER_ROWS)) {
      const row = document.createElement('div');
      row.className = 'mp-angler-row';
      const spotName = p.spotId
        ? FISHING_SPOTS.find((s) => s.id === p.spotId)?.name ?? null
        : null;
      const doing = ACTIVITY_LABELS[p.activity] ?? 'fishing';
      row.innerHTML = `
        <span class="mp-angler-name">${escapeHtml(p.displayName)}</span>
        <span class="mp-angler-doing"> · ${doing}${spotName ? ` @ ${escapeHtml(spotName)}` : ''}</span>
      `;
      this.anglersList.appendChild(row);
    }

    // Catch feed from remote lastCatch payloads
    const now = Date.now();
    for (const p of players) {
      if (!p.lastCatch) continue;
      const key = `${p.playerId}:${p.lastCatch.at}`;
      if (this.seenCatches.has(key)) continue;
      this.seenCatches.add(key);
      // On first sync, swallow history — only announce catches from here on
      if (this.firstSync || now - p.lastCatch.at > 20000) continue;
      this.pushFeedEntry(
        p.displayName,
        p.lastCatch.fishName,
        p.lastCatch.rarity,
        p.lastCatch.weight,
        p.lastCatch.isTrophy,
      );
    }
    this.firstSync = false;

    // Keep the seen-set from growing forever
    if (this.seenCatches.size > 200) {
      this.seenCatches = new Set([...this.seenCatches].slice(-100));
    }
  }

  private pushFeedEntry(who: string, fishName: string, rarity: string, weight: number, isTrophy: boolean): void {
    if (!this.connected) return;
    const color = RARITY_COLORS[rarity] ?? '#fff';
    const el = document.createElement('div');
    el.className = 'mp-feed-entry';
    el.style.borderLeftColor = color;
    el.innerHTML = `
      ${isTrophy ? '🏆 ' : '🎣 '}<b>${escapeHtml(who)}</b> caught a
      <span style="color:${color}; font-weight:700;">${escapeHtml(fishName)}</span>
      <span style="opacity:0.6;">(${weight} lbs)</span>
    `;
    this.feedContainer.prepend(el);
    this.feed.unshift({ el, age: 0 });

    while (this.feed.length > MAX_FEED) {
      const removed = this.feed.pop()!;
      removed.el.remove();
    }
  }

  update(dt: number): void {
    for (let i = this.feed.length - 1; i >= 0; i--) {
      const entry = this.feed[i];
      entry.age += dt;
      if (entry.age > FEED_LIFETIME) {
        entry.el.remove();
        this.feed.splice(i, 1);
      } else if (entry.age > FEED_LIFETIME - 0.8) {
        entry.el.classList.add('fading');
      }
    }
  }

  destroy(): void {
    this.events.off(Events.PRESENCE_CONNECTED, this.onConnected);
    this.events.off(Events.PRESENCE_UPDATED, this.onPresence);
    this.events.off(Events.FISH_CAUGHT, this.onOwnCatch);
    this.panel.remove();
    document.getElementById('mp-ui-styles')?.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
