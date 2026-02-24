import * as THREE from 'three';
import { Component } from '../core/types';
import { InputManager } from '../core/InputManager';

/**
 * Character — capsule figure on the dock/shore.
 * Moves with WASD / arrow keys within bounds.
 * Faces the direction of movement (or the camera-relative forward).
 */
export class Character implements Component {
  private scene: THREE.Scene;
  private input: InputManager;
  public group: THREE.Group;
  public rodAttachPoint: THREE.Vector3;

  // Movement
  private readonly moveSpeed = 5;
  private cameraTheta = 0; // set by main loop from camera

  // Bounds — rectangular area around the dock and shore
  private readonly bounds = {
    minX: -14, maxX: 14,
    minZ: -20, maxZ: 3,  // can walk to edge of dock over water
  };

  constructor(scene: THREE.Scene, position: THREE.Vector3, input: InputManager) {
    this.scene = scene;
    this.input = input;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.rodAttachPoint = new THREE.Vector3();
  }

  init(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.6 });

    // Torso
    const torsoGeo = new THREE.CapsuleGeometry(0.35, 0.8, 8, 16);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    this.group.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 12, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.8;
    head.castShadow = true;
    this.group.add(head);

    // Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 });
    const brimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16);
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.y = 1.95;
    this.group.add(brim);
    const crownGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.25, 16);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.y = 2.1;
    this.group.add(crown);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
    for (const offsetX of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offsetX, 0.35, 0);
      leg.castShadow = true;
      this.group.add(leg);
    }

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.45, 1.15, -0.15);
    leftArm.rotation.x = -0.4;
    leftArm.rotation.z = 0.3;
    this.group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.45, 1.1, 0);
    rightArm.rotation.z = -0.2;
    this.group.add(rightArm);

    this.scene.add(this.group);
    this.updateRodAttachPoint();
  }

  /** Called from main.ts to sync camera angle for relative movement */
  setCameraTheta(theta: number): void {
    this.cameraTheta = theta;
  }

  private updateRodAttachPoint(): void {
    const local = new THREE.Vector3(-0.38, 0.89, -0.03);
    this.rodAttachPoint.copy(local).applyMatrix4(this.group.matrixWorld);
  }

  private getGroundHeight(x: number, z: number): number {
    // On dock: x between -2 and 2, z between -8 and 4
    const onDock = x > -2 && x < 2 && z > -8 && z < 4;
    if (onDock) return 1.25;

    // Near water edge (shoreline): z between -3 and 0
    if (z > -3 && z <= 0) return 0.1;

    // On land
    return 0.3;
  }

  update(dt: number): void {
    // Read WASD input
    const { x: inputX, z: inputZ } = this.input.getMovementInput();

    if (inputX !== 0 || inputZ !== 0) {
      // Movement relative to camera facing direction
      const forward = new THREE.Vector3(
        -Math.sin(this.cameraTheta),
        0,
        -Math.cos(this.cameraTheta),
      );
      const right = new THREE.Vector3(forward.z, 0, -forward.x);

      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, inputZ)
        .addScaledVector(right, inputX)
        .normalize();

      // Apply movement
      const pos = this.group.position;
      pos.x += moveDir.x * this.moveSpeed * dt;
      pos.z += moveDir.z * this.moveSpeed * dt;

      // Clamp to bounds
      pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
      pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));

      // Set ground height based on position
      pos.y = this.getGroundHeight(pos.x, pos.z);

      // Face movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      // Smooth rotation
      let angleDiff = targetAngle - this.group.rotation.y;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.group.rotation.y += angleDiff * Math.min(dt * 10, 1);
    }

    this.group.updateMatrixWorld(true);
    this.updateRodAttachPoint();
  }

  destroy(): void {
    this.scene.remove(this.group);
  }
}
