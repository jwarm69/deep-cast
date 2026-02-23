import * as THREE from 'three';
import { Component } from '../core/types';

/**
 * Fishing rod — thin tapered cylinder extending from character's hand.
 */
export class FishingRod implements Component {
  private scene: THREE.Scene;
  public group: THREE.Group;
  public tipPosition = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
  }

  init(): void {
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.6 });

    // Rod shaft — tapered cylinder
    const rodGeo = new THREE.CylinderGeometry(0.015, 0.04, 3.5, 8);
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.y = 1.75;
    rod.rotation.x = -0.6; // angled forward over water
    rod.castShadow = true;
    this.group.add(rod);

    // Handle grip
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const gripGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = 0;
    rod.add(grip);

    // Reel
    const reelMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.3 });
    const reelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
    const reel = new THREE.Mesh(reelGeo, reelMat);
    reel.position.set(0.08, -0.6, 0);
    reel.rotation.z = Math.PI / 2;
    rod.add(reel);

    // Guide rings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.2 });
    for (const yFrac of [0.2, 0.5, 0.8]) {
      const ringGeo = new THREE.TorusGeometry(0.025, 0.005, 6, 12);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = -1.75 + yFrac * 3.5;
      ring.rotation.x = Math.PI / 2;
      rod.add(ring);
    }

    this.scene.add(this.group);
  }

  /** Attach the rod base to the character's rod attach point */
  setBasePosition(pos: THREE.Vector3): void {
    this.group.position.copy(pos);
  }

  update(_dt: number): void {
    this.group.updateMatrixWorld(true);

    // Compute tip position in world space
    // Tip is at the end of the angled rod shaft
    const tipLocal = new THREE.Vector3(0, 3.2, -2.0);
    this.tipPosition.copy(tipLocal).add(this.group.position);
  }

  destroy(): void {
    this.scene.remove(this.group);
  }
}
