import * as THREE from 'three';
import { Component, Rarity } from '../core/types';
import { WaterSystem } from '../world/WaterSystem';
import { RippleSystem } from '../effects/RippleSystem';

type ShadowState = 'hidden' | 'approaching' | 'circling' | 'fighting' | 'fleeing';

const RARITY_TINT: Record<Rarity, number> = {
  [Rarity.COMMON]: 0x0c1a26,
  [Rarity.UNCOMMON]: 0x0c2620,
  [Rarity.RARE]: 0x0c1f33,
  [Rarity.EPIC]: 0x1d1133,
  [Rarity.LEGENDARY]: 0x33260c,
};

/**
 * FishShadow — a dark silhouette under the surface that approaches the bobber
 * before the bite. Size and tint telegraph the fish's weight and rarity.
 * Rare+ fish get a faint glow ring so sharp-eyed anglers know to focus.
 */
export class FishShadow implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  private ripples: RippleSystem;

  private group!: THREE.Group;
  private bodyMat!: THREE.MeshBasicMaterial;
  private glowMat!: THREE.MeshBasicMaterial;
  private glow!: THREE.Mesh;
  private geometries: THREE.BufferGeometry[] = [];

  private state: ShadowState = 'hidden';
  private time = 0;

  // Approach
  private startPos = new THREE.Vector2();
  private targetPos = new THREE.Vector2();
  private approachDuration = 4;
  private approachElapsed = 0;
  private wobblePhase = 0;

  // Circling / fighting
  private circleAngle = 0;
  private circleRadius = 1.6;
  private fightTargetProvider: (() => { x: number; z: number }) | null = null;

  // Fleeing
  private fleeDir = new THREE.Vector2(1, 0);
  private fleeElapsed = 0;

  private rippleTimer = 0;
  private sizeScale = 1;

  constructor(scene: THREE.Scene, water: WaterSystem, ripples: RippleSystem) {
    this.scene = scene;
    this.water = water;
    this.ripples = ripples;
  }

  init(): void {
    this.group = new THREE.Group();

    // Body: flattened dark ellipse just below the surface
    const bodyGeo = new THREE.SphereGeometry(0.5, 20, 12);
    this.geometries.push(bodyGeo);
    this.bodyMat = new THREE.MeshBasicMaterial({
      color: 0x0c1a26,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.scale.set(0.6, 0.12, 1.4);
    this.group.add(body);

    // Tail hint
    const tailGeo = new THREE.ConeGeometry(0.22, 0.6, 8);
    this.geometries.push(tailGeo);
    const tail = new THREE.Mesh(tailGeo, this.bodyMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -0.95;
    tail.scale.y = 0.3;
    this.group.add(tail);

    // Faint glow ring for rare+ fish
    const glowGeo = new THREE.RingGeometry(0.9, 1.25, 24);
    glowGeo.rotateX(-Math.PI / 2);
    this.geometries.push(glowGeo);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.glow.position.y = 0.05;
    this.group.add(this.glow);

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /** Fish swims in from a random direction, arriving at the bobber as the bite lands */
  beginApproach(targetX: number, targetZ: number, arriveIn: number, weight: number, maxWeight: number, rarity: Rarity, isTrophy: boolean): void {
    // Size: normalized within species, boosted by trophy status. Range ~0.7..2.2
    const norm = Math.min(1, weight / Math.max(0.1, maxWeight));
    this.sizeScale = 0.7 + norm * 0.9 + (isTrophy ? 0.6 : 0);

    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 8;
    this.startPos.set(targetX + Math.cos(angle) * dist, targetZ + Math.sin(angle) * dist);
    this.targetPos.set(targetX, targetZ);
    // Arrive slightly before the bite so it can circle once
    this.approachDuration = Math.max(1.2, arriveIn - 0.8);
    this.approachElapsed = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;

    this.bodyMat.color.set(RARITY_TINT[rarity]);
    const showGlow = rarity === Rarity.RARE || rarity === Rarity.EPIC || rarity === Rarity.LEGENDARY || isTrophy;
    this.glowMat.opacity = showGlow ? 0.18 : 0;
    this.glowMat.color.set(rarity === Rarity.LEGENDARY || isTrophy ? 0xfbbf24 : rarity === Rarity.EPIC ? 0xa78bfa : 0x38bdf8);

    this.group.scale.setScalar(this.sizeScale);
    this.group.visible = true;
    this.state = 'approaching';
  }

  /** During the fight, the shadow darts around the (dragged) bobber */
  startFight(targetProvider: () => { x: number; z: number }): void {
    if (this.state === 'hidden') return;
    this.fightTargetProvider = targetProvider;
    this.state = 'fighting';
  }

  flee(): void {
    if (this.state === 'hidden') return;
    this.fleeDir.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.fleeElapsed = 0;
    this.state = 'fleeing';
  }

  hide(): void {
    this.state = 'hidden';
    this.group.visible = false;
    this.fightTargetProvider = null;
  }

  update(dt: number): void {
    if (this.state === 'hidden') return;
    this.time += dt;

    let x = this.group.position.x;
    let z = this.group.position.z;

    switch (this.state) {
      case 'approaching': {
        this.approachElapsed += dt;
        const t = Math.min(1, this.approachElapsed / this.approachDuration);
        // Ease-in-out with a serpentine wobble perpendicular to travel
        const ease = t * t * (3 - 2 * t);
        const dir = new THREE.Vector2().subVectors(this.targetPos, this.startPos);
        const perp = new THREE.Vector2(-dir.y, dir.x).normalize();
        const wobble = Math.sin(this.time * 2.2 + this.wobblePhase) * 1.6 * (1 - ease);
        x = this.startPos.x + dir.x * ease + perp.x * wobble;
        z = this.startPos.y + dir.y * ease + perp.y * wobble;
        this.group.rotation.y = Math.atan2(dir.x, dir.y);
        if (t >= 1) {
          this.state = 'circling';
          this.circleAngle = Math.random() * Math.PI * 2;
        }
        break;
      }

      case 'circling': {
        this.circleAngle += dt * 1.4;
        x = this.targetPos.x + Math.cos(this.circleAngle) * this.circleRadius;
        z = this.targetPos.y + Math.sin(this.circleAngle) * this.circleRadius;
        this.group.rotation.y = Math.atan2(
          -Math.sin(this.circleAngle), Math.cos(this.circleAngle),
        );
        break;
      }

      case 'fighting': {
        const target = this.fightTargetProvider?.() ?? { x: this.targetPos.x, z: this.targetPos.y };
        this.circleAngle += dt * 3.2;
        const r = 0.9;
        const tx = target.x + Math.cos(this.circleAngle) * r;
        const tz = target.z + Math.sin(this.circleAngle) * r;
        x += (tx - x) * Math.min(1, dt * 6);
        z += (tz - z) * Math.min(1, dt * 6);
        this.group.rotation.y = Math.atan2(tx - x + 0.001, tz - z + 0.001);
        break;
      }

      case 'fleeing': {
        this.fleeElapsed += dt;
        const speed = 9;
        x += this.fleeDir.x * speed * dt;
        z += this.fleeDir.y * speed * dt;
        this.group.rotation.y = Math.atan2(this.fleeDir.x, this.fleeDir.y);
        this.bodyMat.opacity = Math.max(0, 0.4 - this.fleeElapsed * 0.5);
        if (this.fleeElapsed > 1.2) {
          this.hide();
          this.bodyMat.opacity = 0.4;
          return;
        }
        break;
      }
    }

    const y = this.water.getWaveHeight(x, z) - 0.22;
    this.group.position.set(x, y, z);

    // Subtle swimming ripples
    this.rippleTimer -= dt;
    if (this.rippleTimer <= 0 && this.state !== 'fleeing') {
      this.rippleTimer = 0.8 + Math.random() * 0.6;
      this.ripples.spawn(x, z, { scale: 0.8 * this.sizeScale, life: 1.0, opacity: 0.22 });
    }

    // Glow pulse
    if (this.glowMat.opacity > 0) {
      this.glowMat.opacity = 0.14 + Math.sin(this.time * 3) * 0.06;
    }
  }

  destroy(): void {
    this.scene.remove(this.group);
    this.bodyMat.dispose();
    this.glowMat.dispose();
    for (const geo of this.geometries) geo.dispose();
  }
}
