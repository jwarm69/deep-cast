import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { BackendClient, BackendSession } from '../types';
import { LocalPresenceState, RemotePresenceState } from '../../multiplayer/types';
import { generateFishName } from '../generateFishName';

export interface SupabaseBackendConfig {
  url: string;
  anonKey: string;
}

interface PresencePayload {
  playerId: string;
  displayName: string;
  mode: string;
  px: number;
  py: number;
  pz: number;
  isDeepWater: boolean;
  spotId: string | null;
  timestamp: number;
}

export class SupabaseBackendClient implements BackendClient {
  readonly provider = 'supabase' as const;
  private config: SupabaseBackendConfig;
  private supabase: SupabaseClient | null = null;
  private session: BackendSession | null = null;
  private channel: RealtimeChannel | null = null;
  private channelReady: Promise<void> | null = null;
  private currentTerrain: string | null = null;
  private remotePresences: RemotePresenceState[] = [];

  constructor(config: SupabaseBackendConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.supabase = createClient(this.config.url, this.config.anonKey);
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);

    // Use a per-tab ID so multiple tabs on the same browser each appear as
    // separate players (Supabase auth session is shared via localStorage).
    const tabId = crypto.randomUUID();
    const displayName = generateFishName();
    this.session = {
      playerId: tabId,
      displayName,
      isAnonymous: true,
    };
    console.log(`[multiplayer] Connected as ${displayName} (${tabId.slice(0, 8)})`);
  }

  async disconnect(): Promise<void> {
    if (this.channel && this.supabase) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.channelReady = null;
    this.currentTerrain = null;
    this.remotePresences = [];
  }

  async getSession(): Promise<BackendSession> {
    if (this.session) return this.session;
    throw new Error('Not connected. Call connect() first.');
  }

  async syncPresence(state: LocalPresenceState): Promise<RemotePresenceState[]> {
    if (!this.supabase || !this.session) return [];

    // Switch channels when terrain changes
    if (state.terrain !== this.currentTerrain || !this.channel) {
      await this.switchChannel(state.terrain);
    }

    if (this.channel && this.channelReady) {
      await this.channelReady;
      const payload: PresencePayload = {
        playerId: this.session.playerId,
        displayName: this.session.displayName,
        mode: state.mode,
        px: state.position.x,
        py: state.position.y,
        pz: state.position.z,
        isDeepWater: state.isDeepWater,
        spotId: state.spotId,
        timestamp: Date.now(),
      };
      const response = await this.channel.track(payload);
      if (response !== 'ok') {
        throw new Error(`Presence track failed: ${String(response)}`);
      }
    }

    return this.remotePresences;
  }

  private async switchChannel(terrain: string): Promise<void> {
    if (!this.supabase) return;

    // Leave old channel
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
      this.remotePresences = [];
    }

    this.currentTerrain = null;
    const channelName = `presence:terrain:${terrain}`;

    const nextChannel = this.supabase.channel(channelName, {
      config: { presence: { key: this.session!.playerId } },
    });
    this.channel = nextChannel;

    this.channel.on('presence', { event: 'sync' }, () => {
      this.rebuildRemoteList();
    });

    this.channelReady = new Promise<void>((resolve, reject) => {
      let settled = false;
      nextChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          if (!settled) {
            settled = true;
            console.log(`[multiplayer] Joined channel ${channelName}`);
            resolve();
          }
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!settled) {
            settled = true;
            reject(new Error(`Channel ${channelName} failed with status ${status}`));
          }
        }
      });
    });

    try {
      await this.channelReady;
      this.currentTerrain = terrain;
    } catch (error) {
      this.channelReady = null;
      this.currentTerrain = null;

      if (this.channel && this.supabase) {
        await this.supabase.removeChannel(this.channel);
      }
      this.channel = null;
      this.remotePresences = [];
      throw error;
    }
  }

  private rebuildRemoteList(): void {
    if (!this.channel || !this.session) return;

    const presenceState = this.channel.presenceState<PresencePayload>();
    const remotes: RemotePresenceState[] = [];
    const allKeys = Object.keys(presenceState);

    for (const [_key, entries] of Object.entries(presenceState)) {
      const entry = entries[entries.length - 1];
      if (!entry || entry.playerId === this.session.playerId) continue;

      remotes.push({
        playerId: entry.playerId,
        displayName: entry.displayName,
        terrain: this.currentTerrain as LocalPresenceState['terrain'],
        mode: entry.mode as LocalPresenceState['mode'],
        position: { x: entry.px, y: entry.py, z: entry.pz },
        isDeepWater: entry.isDeepWater,
        spotId: entry.spotId,
        timestamp: entry.timestamp,
        updatedAt: Date.now(),
      });
    }

    if (allKeys.length > 0) {
      console.log(`[multiplayer] Presence sync: ${allKeys.length} total, ${remotes.length} remote`);
    }
    this.remotePresences = remotes;
  }
}
