import { Component, Events } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { BackendClient, BackendSession } from '../backend/types';
import { LocalPresenceState, PresenceSnapshot, RemotePresenceState } from './types';

type PresenceReader = () => PresenceSnapshot;

export class MultiplayerBridge implements Component {
  private events: EventSystem;
  private backend: BackendClient;
  private readSnapshot: PresenceReader;
  private session: BackendSession | null = null;
  private remotePlayers: RemotePresenceState[] = [];

  private syncTimer = 0;
  private syncIntervalSeconds = 1.0;
  private syncInFlight = false;
  private lastSpotId: string | null = null;

  constructor(events: EventSystem, backend: BackendClient, readSnapshot: PresenceReader) {
    this.events = events;
    this.backend = backend;
    this.readSnapshot = readSnapshot;
  }

  async init(): Promise<void> {
    try {
      await this.backend.connect();
      this.session = await this.backend.getSession();
      this.events.emit(Events.PRESENCE_CONNECTED, {
        provider: this.backend.provider,
        playerId: this.session.playerId,
        displayName: this.session.displayName,
      });
    } catch (error) {
      this.events.emit(Events.PRESENCE_ERROR, {
        stage: 'init',
        message: this.toErrorMessage(error),
      });
    }
  }

  update(dt: number): void {
    if (!this.session) return;

    this.syncTimer += dt;
    if (this.syncTimer < this.syncIntervalSeconds) return;
    if (this.syncInFlight) return;
    this.syncTimer = 0;

    const snapshot = this.readSnapshot();
    if (snapshot.spotId !== this.lastSpotId) {
      this.lastSpotId = snapshot.spotId;
      this.events.emit(Events.SPOT_CHANGED, { spotId: snapshot.spotId });
    }

    const payload: LocalPresenceState = {
      playerId: this.session.playerId,
      displayName: this.session.displayName,
      terrain: snapshot.terrain,
      mode: snapshot.mode,
      position: snapshot.position,
      isDeepWater: snapshot.isDeepWater,
      spotId: snapshot.spotId,
      timestamp: Date.now(),
    };

    this.syncInFlight = true;
    void this.backend.syncPresence(payload)
      .then((remotes) => {
        this.remotePlayers = remotes;
        this.events.emit(Events.PRESENCE_UPDATED, { players: remotes });
      })
      .catch((error) => {
        this.events.emit(Events.PRESENCE_ERROR, {
          stage: 'sync',
          message: this.toErrorMessage(error),
        });
      })
      .finally(() => {
        this.syncInFlight = false;
      });
  }

  get remotes(): RemotePresenceState[] {
    return this.remotePlayers;
  }

  async destroy(): Promise<void> {
    try {
      await this.backend.disconnect();
    } catch (error) {
      this.events.emit(Events.PRESENCE_ERROR, {
        stage: 'destroy',
        message: this.toErrorMessage(error),
      });
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
