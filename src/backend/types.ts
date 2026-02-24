import { LocalPresenceState, RemotePresenceState } from '../multiplayer/types';

export type BackendProvider = 'local' | 'supabase';

export interface BackendSession {
  playerId: string;
  displayName: string;
  isAnonymous: boolean;
}

export interface BackendClient {
  readonly provider: BackendProvider;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSession(): Promise<BackendSession>;
  syncPresence(state: LocalPresenceState): Promise<RemotePresenceState[]>;
}
