import * as THREE from 'three';
import { Component } from '../core/types';
import { WaterSystem } from '../world/WaterSystem';

const POOL_SIZE = 32;

interface Ripple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  z: number;
  startScale: number;
  endScale: number;
}

export interface RippleConfig {
  scale?: number;     // final ring radius multiplier
  life?: number;      // seconds
  color?: number;
  opacity?: number;
}

/**
 * RippleSystem — pooled expanding rings on the water surface.
 * Used for bobber landings, bites, lure twitches, and fish movement.
 */
export class RippleSystem implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  private ripples: Ripple[] = [];
  private geometry!: THREE.RingGeometry;

  constructor(scene: THREE.Scene, water: WaterSystem) {
    this.scene = scene;
    this.water = water;
  }

  init(): void {
    this.geometry = new THREE.RingGeometry(0.82, 1.0, 32);
    this.geometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xe8f6ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.ripples.push({
        mesh,
        material,
        active: false,
        life: 0,
        maxLife: 1,
        x: 0,
        z: 0,
        startScale: 0.2,
        endScale: 1,
      });
    }
  }

  spawn(x: number, z: number, config: RippleConfig = {}): void {
    const ripple = this.ripples.find((r) => !r.active);
    if (!ripple) return;

    ripple.active = true;
    ripple.x = x;
    ripple.z = z;
    ripple.maxLife = config.life ?? 1.1;
    ripple.life = ripple.maxLife;
    ripple.startScale = 0.15;
    ripple.endScale = config.scale ?? 1.4;
    ripple.material.color.set(config.color ?? 0xe8f6ff);
    ripple.material.opacity = config.opacity ?? 0.55;
    ripple.mesh.visible = true;
  }

  /** Spawn several staggered rings for a bigger splash */
  burst(x: number, z: number, count: number, config: RippleConfig = {}): void {
    for (let i = 0; i < count; i++) {
      // Stagger by shrinking the life of later rings slightly and offsetting scale
      this.spawn(x, z, {
        ...config,
        scale: (config.scale ?? 1.4) * (1 + i * 0.45),
        life: (config.life ?? 1.1) * (1 + i * 0.3),
        opacity: (config.opacity ?? 0.55) * (1 - i * 0.22),
      });
    }
  }

  update(dt: number): void {
    for (const r of this.ripples) {
      if (!r.active) continue;

      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }

      const t = 1 - r.life / r.maxLife; // 0 → 1
      const scale = r.startScale + (r.endScale - r.startScale) * t;
      const baseOpacity = r.material.opacity;
      r.mesh.scale.set(scale, 1, scale);
      // Ease-out fade
      r.material.opacity = Math.min(baseOpacity, (1 - t) * 0.6);
      r.mesh.position.set(r.x, this.water.getWaveHeight(r.x, r.z) + 0.03, r.z);
    }
  }

  destroy(): void {
    for (const r of this.ripples) {
      this.scene.remove(r.mesh);
      r.material.dispose();
    }
    this.geometry.dispose();
    this.ripples = [];
  }
}
