import { BackendClient, BackendSession } from '../types';
import { LocalPresenceState, RemotePresenceState } from '../../multiplayer/types';

const PLAYER_ID_KEY = 'deep-cast-player-id';
const PLAYER_NAME_KEY = 'deep-cast-player-name';

export class LocalBackendClient implements BackendClient {
  readonly provider = 'local' as const;
  private session: BackendSession | null = null;
  private remotes: RemotePresenceState[] = [];

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async getSession(): Promise<BackendSession> {
    if (this.session) return this.session;

    const playerId = this.getOrCreatePlayerId();
    const displayName = this.getOrCreateDisplayName(playerId);
    this.session = {
      playerId,
      displayName,
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

  private getOrCreateDisplayName(playerId: string): string {
    const existing = localStorage.getItem(PLAYER_NAME_KEY);
    if (existing) return existing;

    const suffix = playerId.slice(0, 5).toUpperCase();
    const generated = `Angler-${suffix}`;
    localStorage.setItem(PLAYER_NAME_KEY, generated);
    return generated;
  }
}
