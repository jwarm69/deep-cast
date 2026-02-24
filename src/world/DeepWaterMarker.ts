import * as THREE from 'three';
import { Component } from '../core/types';
import { WaterSystem } from './WaterSystem';

/**
 * DeepWaterMarker — buoy line at z = 30 plus dark overlay plane.
 * Buoys bob on waves. Dark overlay marks the deep water zone.
 */
export class DeepWaterMarker implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  private buoys: THREE.Mesh[] = [];
  private overlay!: THREE.Mesh;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private readonly DEEP_Z = 30;
  private readonly BUOY_COUNT = 9;
  private readonly BUOY_SPACING = 10;

  constructor(scene: THREE.Scene, water: WaterSystem) {
    this.scene = scene;
    this.water = water;
  }

  init(): void {
    this.createBuoys();
    this.createOverlay();
  }

  private createBuoys(): void {
    const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff6d00, roughness: 0.5 });
    this.materials.push(buoyMat);

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.materials.push(whiteMat);

    const startX = -((this.BUOY_COUNT - 1) / 2) * this.BUOY_SPACING;

    for (let i = 0; i < this.BUOY_COUNT; i++) {
      const buoyGroup = new THREE.Group() as unknown as THREE.Mesh;
      // We need individual meshes but track as group - use Group
      const group = new THREE.Group();

      // Buoy body (orange cylinder)
      const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8);
      this.geometries.push(bodyGeo);
      const body = new THREE.Mesh(bodyGeo, buoyMat);
      body.position.y = 0.3;
      group.add(body);

      // White stripe
      const stripeGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.15, 8);
      this.geometries.push(stripeGeo);
      const stripe = new THREE.Mesh(stripeGeo, whiteMat);
      stripe.position.y = 0.5;
      group.add(stripe);

      // Top cone
      const topGeo = new THREE.ConeGeometry(0.12, 0.3, 6);
      this.geometries.push(topGeo);
      const top = new THREE.Mesh(topGeo, buoyMat);
      top.position.y = 0.85;
      group.add(top);

      const x = startX + i * this.BUOY_SPACING;
      group.position.set(x, 0, this.DEEP_Z);

      this.scene.add(group);
      this.buoys.push(group as unknown as THREE.Mesh);
    }
  }

  private createOverlay(): void {
    // Dark semi-transparent plane over deep water zone (z = 30 to 60)
    const overlayGeo = new THREE.PlaneGeometry(100, 30);
    overlayGeo.rotateX(-Math.PI / 2);
    this.geometries.push(overlayGeo);

    const overlayMat = new THREE.MeshBasicMaterial({
      color: 0x000020,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    this.materials.push(overlayMat);

    this.overlay = new THREE.Mesh(overlayGeo, overlayMat);
    this.overlay.position.set(0, -0.1, 45); // centered between z=30 and z=60
    this.scene.add(this.overlay);
  }

  update(_dt: number): void {
    // Bob buoys on waves
    for (const buoy of this.buoys) {
      const group = buoy as unknown as THREE.Group;
      const x = group.position.x;
      const z = group.position.z;
      const waveY = this.water.getWaveHeight(x, z);
      group.position.y = waveY + 0.1;

      // Slight tilt
      group.rotation.x = Math.sin(x * 0.5 + z) * 0.08;
      group.rotation.z = Math.cos(x * 0.3 + z * 0.7) * 0.08;
    }
  }

  destroy(): void {
    for (const buoy of this.buoys) {
      this.scene.remove(buoy as unknown as THREE.Object3D);
    }
    if (this.overlay) {
      this.scene.remove(this.overlay);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.buoys = [];
    this.geometries = [];
    this.materials = [];
  }
}
