import { BackendClient, BackendSession } from '../types';
import { LocalPresenceState, RemotePresenceState } from '../../multiplayer/types';
import { generateFishName } from '../generateFishName';

const PLAYER_ID_KEY = 'deep-cast-player-id';
export class LocalBackendClient implements BackendClient {
  readonly provider = 'local' as const;
  private session: BackendSession | null = null;
  private remotes: RemotePresenceState[] = [];

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async getSession(): Promise<BackendSession> {
    if (this.session) return this.session;

    const playerId = this.getOrCreatePlayerId();
    this.session = {
      playerId,
      displayName: generateFishName(),
      isAnonymous: true,
    };
    return this.session;
  }

  async syncPresence(_state: LocalPresenceState): Promise<RemotePresenceState[]> {
    // Local adapter has no remote peers; this keeps multiplayer code path alive
    // until Supabase is connected.
    return this.remotes;
  }

  private getOrCreatePlayerId(): string {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  }

}
