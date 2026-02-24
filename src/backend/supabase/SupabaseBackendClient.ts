import { BackendClient, BackendSession } from '../types';
import { LocalPresenceState, RemotePresenceState } from '../../multiplayer/types';

export interface SupabaseBackendConfig {
  url: string;
  anonKey: string;
}

export class SupabaseBackendClient implements BackendClient {
  readonly provider = 'supabase' as const;
  private config: SupabaseBackendConfig;
  private session: BackendSession | null = null;

  constructor(config: SupabaseBackendConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Integration placeholder:
    // 1) Install @supabase/supabase-js
    // 2) createClient(this.config.url, this.config.anonKey)
    // 3) anonymous sign-in + channel joins for presence
    void this.config;
  }

  async disconnect(): Promise<void> {}

  async getSession(): Promise<BackendSession> {
    if (this.session) return this.session;

    // Placeholder anonymous session until Supabase auth wiring is added.
    const playerId = crypto.randomUUID();
    this.session = {
      playerId,
      displayName: `Angler-${playerId.slice(0, 5).toUpperCase()}`,
      isAnonymous: true,
    };
    return this.session;
  }

  async syncPresence(_state: LocalPresenceState): Promise<RemotePresenceState[]> {
    // Placeholder: return empty remote set until realtime presence is wired.
    return [];
  }
}
