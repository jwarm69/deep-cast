import * as THREE from 'three';
import { Component } from '../core/types';
import { WaterSystem } from '../world/WaterSystem';

/**
 * Bobber — small sphere that floats on the water surface.
 * Bobs with the waves and can sink when a fish bites.
 */
export class Bobber implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  public mesh!: THREE.Group;
  public position = new THREE.Vector3();
  private bobTime = 0;
  private sinking = false;
  private sinkAmount = 0;

  constructor(scene: THREE.Scene, water: WaterSystem) {
    this.scene = scene;
    this.water = water;
  }

  init(): void {
    this.mesh = new THREE.Group();

    // Main bobber body — red/white sphere
    const topMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    const topGeo = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const top = new THREE.Mesh(topGeo, topMat);
    this.mesh.add(top);

    const botGeo = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bot = new THREE.Mesh(botGeo, botMat);
    this.mesh.add(bot);

    // Small stick on top
    const stickGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 0.18;
    this.mesh.add(stick);

    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  show(x: number, z: number): void {
    this.position.set(x, 0, z);
    this.mesh.visible = true;
    this.sinking = false;
    this.sinkAmount = 0;
    this.bobTime = Math.random() * Math.PI * 2;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  setSinking(sinking: boolean): void {
    this.sinking = sinking;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;

    this.bobTime += dt;

    // Float on water surface
    const waveY = this.water.getWaveHeight(this.position.x, this.position.z);

    // Extra natural bobbing
    const bob = Math.sin(this.bobTime * 2.0) * 0.03;

    // Sink when fish bites
    if (this.sinking) {
      this.sinkAmount = Math.min(this.sinkAmount + dt * 2.5, 0.4);
    } else {
      this.sinkAmount = Math.max(this.sinkAmount - dt * 3.0, 0);
    }

    this.mesh.position.set(
      this.position.x,
      waveY + bob - this.sinkAmount,
      this.position.z,
    );

    // Slight tilt with waves
    this.mesh.rotation.x = Math.sin(this.bobTime * 1.5) * 0.05;
    this.mesh.rotation.z = Math.cos(this.bobTime * 1.8) * 0.05;
  }

  destroy(): void {
    this.scene.remove(this.mesh);
  }
}
