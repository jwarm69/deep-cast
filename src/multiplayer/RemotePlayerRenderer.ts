import * as THREE from 'three';
import { Component, Events, GameEvent, PlayerMode } from '../core/types';
import { EventSystem } from '../core/EventSystem';
import { RemotePresenceState } from './types';

const REMOTE_COLORS = [
  0xe74c3c, 0x2ecc71, 0x9b59b6, 0xf39c12, 0x1abc9c,
  0xe67e22, 0x3498db, 0xd35400, 0x16a085, 0x8e44ad,
];

interface RemotePlayerEntry {
  group: THREE.Group;
  label: THREE.Sprite;
  targetPos: THREE.Vector3;
  lastSeen: number;
  activity: string;
  mode: PlayerMode;
}

const ACTIVITY_ICONS: Record<string, string> = {
  casting: '🎣',
  waiting: '🎣',
  reeling: '💪',
  caught: '🏆',
};

function makeNameTexture(name: string, activity: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const icon = ACTIVITY_ICONS[activity];
  const text = icon ? `${name} ${icon}` : name;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.font = 'bold 28px sans-serif';
  const radius = 8;
  const pad = 12;
  const measured = ctx.measureText(text).width + pad * 2;
  const boxW = Math.min(measured, 256);
  const boxX = (256 - boxW) / 2;
  ctx.beginPath();
  ctx.roundRect(boxX, 8, boxW, 48, radius);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function colorForId(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return REMOTE_COLORS[Math.abs(hash) % REMOTE_COLORS.length];
}

export class RemotePlayerRenderer implements Component {
  private scene: THREE.Scene;
  private events: EventSystem;
  private players = new Map<string, RemotePlayerEntry>();
  private onPresenceUpdated: (e: GameEvent) => void;
  private staleTimeoutMs = 5000;

  constructor(scene: THREE.Scene, events: EventSystem) {
    this.scene = scene;
    this.events = events;
    this.onPresenceUpdated = (e: GameEvent) => {
      this.handlePresenceUpdate(e.data.players as RemotePresenceState[]);
    };
  }

  init(): void {
    this.events.on(Events.PRESENCE_UPDATED, this.onPresenceUpdated);
  }

  update(dt: number): void {
    const now = Date.now();
    const lerpSpeed = 5 * dt;

    for (const [id, entry] of this.players) {
      // Remove stale players
      if (now - entry.lastSeen > this.staleTimeoutMs) {
        this.removePlayer(id);
        continue;
      }

      // Smooth position interpolation
      entry.group.position.lerp(entry.targetPos, Math.min(lerpSpeed, 1));

      const dx = entry.targetPos.x - entry.group.position.x;
      const dz = entry.targetPos.z - entry.group.position.z;
      if (dx * dx + dz * dz > 0.0001) {
        const targetAngle = Math.atan2(dx, dz);
        let angleDiff = targetAngle - entry.group.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        entry.group.rotation.y += angleDiff * Math.min(dt * 5, 1);
      }
    }
  }

  destroy(): void {
    this.events.off(Events.PRESENCE_UPDATED, this.onPresenceUpdated);
    for (const id of this.players.keys()) {
      this.removePlayer(id);
    }
  }

  private handlePresenceUpdate(players: RemotePresenceState[]): void {
    const activeIds = new Set<string>();

    for (const p of players) {
      activeIds.add(p.playerId);

      let entry = this.players.get(p.playerId);
      if (entry && entry.mode !== p.mode) {
        this.removePlayer(p.playerId);
        entry = undefined;
      }

      if (!entry) {
        entry = this.createPlayer(p);
        this.players.set(p.playerId, entry);
      }

      entry.targetPos.set(p.position.x, p.position.y, p.position.z);
      entry.lastSeen = Date.now();

      // Refresh nameplate when activity changes (shows 🎣/💪/🏆)
      if (p.activity !== entry.activity) {
        entry.activity = p.activity;
        const oldMap = entry.label.material.map;
        entry.label.material.map = makeNameTexture(p.displayName, p.activity);
        oldMap?.dispose();
      }
    }

    // Remove players no longer in the list
    for (const id of this.players.keys()) {
      if (!activeIds.has(id)) {
        this.removePlayer(id);
      }
    }
  }

  private createPlayer(p: RemotePresenceState): RemotePlayerEntry {
    const group = new THREE.Group();
    const color = colorForId(p.playerId);
    const isBoat = p.mode === PlayerMode.BOAT;

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.6 });

    if (isBoat) {
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
      const trimMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });

      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.32, 2.6),
        hullMat,
      );
      hull.position.set(0, 0.16, 0);
      hull.castShadow = true;
      hull.receiveShadow = true;
      group.add(hull);

      const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.72, 0.8, 4),
        hullMat,
      );
      bow.position.set(0, 0.16, 1.7);
      bow.rotation.x = Math.PI / 2;
      bow.castShadow = true;
      bow.receiveShadow = true;
      group.add(bow);

      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.12, 0.32),
        trimMat,
      );
      seat.position.set(0, 0.46, -0.2);
      seat.castShadow = true;
      group.add(seat);
    }

    const bodyLift = isBoat ? 0.25 : 0;

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.8, 8, 16),
      bodyMat,
    );
    torso.position.y = 1.0 + bodyLift;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      skinMat,
    );
    head.position.y = 1.8 + bodyLift;
    head.castShadow = true;
    group.add(head);

    // Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 });
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16),
      hatMat,
    );
    brim.position.y = 1.95 + bodyLift;
    group.add(brim);

    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.25, 16),
      hatMat,
    );
    crown.position.y = 2.1 + bodyLift;
    group.add(crown);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
    for (const offsetX of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offsetX, isBoat ? 0.66 : 0.35, isBoat ? -0.12 : 0);
      if (isBoat) leg.rotation.x = Math.PI / 2;
      leg.castShadow = true;
      group.add(leg);
    }

    // Name label (billboard sprite above head)
    const labelMat = new THREE.SpriteMaterial({
      map: makeNameTexture(p.displayName, p.activity),
      transparent: true,
      depthTest: false,
    });
    const label = new THREE.Sprite(labelMat);
    label.position.y = isBoat ? 2.95 : 2.7;
    label.scale.set(2.5, 0.625, 1);
    group.add(label);

    group.position.set(p.position.x, p.position.y, p.position.z);
    this.scene.add(group);

    return {
      group,
      label,
      targetPos: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
      lastSeen: Date.now(),
      activity: p.activity,
      mode: p.mode,
    };
  }

  private removePlayer(id: string): void {
    const entry = this.players.get(id);
    if (!entry) return;

    this.scene.remove(entry.group);
    // Dispose geometries and materials
    entry.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
    this.players.delete(id);
  }
}
