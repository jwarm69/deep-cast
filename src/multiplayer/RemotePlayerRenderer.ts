import * as THREE from 'three';
import { Component, Events, GameEvent } from '../core/types';
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
}

function makeNameTexture(name: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.font = 'bold 28px sans-serif';
  const radius = 8;
  const pad = 12;
  const measured = ctx.measureText(name).width + pad * 2;
  const boxW = Math.min(measured, 256);
  const boxX = (256 - boxW) / 2;
  ctx.beginPath();
  ctx.roundRect(boxX, 8, boxW, 48, radius);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);

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
      if (!entry) {
        entry = this.createPlayer(p);
        this.players.set(p.playerId, entry);
      }

      entry.targetPos.set(p.position.x, p.position.y, p.position.z);
      entry.lastSeen = Date.now();
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

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.6 });

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.8, 8, 16),
      bodyMat,
    );
    torso.position.y = 1.0;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      skinMat,
    );
    head.position.y = 1.8;
    head.castShadow = true;
    group.add(head);

    // Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 });
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16),
      hatMat,
    );
    brim.position.y = 1.95;
    group.add(brim);

    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.25, 16),
      hatMat,
    );
    crown.position.y = 2.1;
    group.add(crown);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
    for (const offsetX of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offsetX, 0.35, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // Name label (billboard sprite above head)
    const labelMat = new THREE.SpriteMaterial({
      map: makeNameTexture(p.displayName),
      transparent: true,
      depthTest: false,
    });
    const label = new THREE.Sprite(labelMat);
    label.position.y = 2.7;
    label.scale.set(2.5, 0.625, 1);
    group.add(label);

    group.position.set(p.position.x, p.position.y, p.position.z);
    this.scene.add(group);

    return {
      group,
      label,
      targetPos: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
      lastSeen: Date.now(),
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
