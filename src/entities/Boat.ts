import * as THREE from 'three';
import { Component } from '../core/types';
import { BoatData } from '../data/equipment';
import { WaterSystem } from '../world/WaterSystem';
import { InputManager } from '../core/InputManager';

/**
 * Boat — procedural 3D boat entity.
 * Builds different meshes per tier, floats on waves, handles sailing movement.
 */
export class Boat implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  private input: InputManager;

  public group: THREE.Group;
  public rodAttachPoint = new THREE.Vector3();

  private boatData: BoatData | null = null;
  private sailing = false;
  private cameraTheta = 0;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  // Boat bounds on water
  private readonly bounds = {
    minX: -45, maxX: 45,
    minZ: 2, maxZ: 58,
  };

  // Deep water threshold
  private readonly DEEP_Z = 30;

  constructor(scene: THREE.Scene, water: WaterSystem, input: InputManager) {
    this.scene = scene;
    this.water = water;
    this.input = input;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  init(): void {}

  /** Set the active boat model — clears old mesh and rebuilds */
  setBoatData(data: BoatData | null): void {
    this.clearMesh();
    this.boatData = data;
    if (!data) return;

    switch (data.id) {
      case 'rowboat': this.buildRowboat(); break;
      case 'skiff': this.buildSkiff(); break;
      case 'sailboat': this.buildSailboat(); break;
      case 'speedboat': this.buildSpeedboat(); break;
      case 'research_vessel': this.buildResearchVessel(); break;
      default: this.buildRowboat(); break;
    }
  }

  private clearMesh(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
  }

  private trackGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat(mat: THREE.Material): THREE.Material {
    this.materials.push(mat);
    return mat;
  }

  // --- Builder methods ---

  private buildRowboat(): void {
    const wood = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 }));

    // Hull — box, slightly tapered via scaling
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(1.8, 0.5, 3.5));
    const hull = new THREE.Mesh(hullGeo, wood);
    hull.position.y = -0.1;
    this.group.add(hull);

    // Inner floor
    const floorGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.08, 3.0));
    const floor = new THREE.Mesh(floorGeo, wood);
    floor.position.y = 0.1;
    this.group.add(floor);

    // Bench planks
    const benchGeo = this.trackGeo(new THREE.BoxGeometry(1.3, 0.08, 0.3));
    for (const z of [-0.5, 0.6]) {
      const bench = new THREE.Mesh(benchGeo, wood);
      bench.position.set(0, 0.35, z);
      this.group.add(bench);
    }

    // Oars
    const oarMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 }));
    const oarGeo = this.trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6));
    for (const side of [-1, 1]) {
      const oar = new THREE.Mesh(oarGeo, oarMat);
      oar.position.set(side * 1.2, 0.3, 0);
      oar.rotation.z = side * 0.4;
      oar.rotation.x = 0.2;
      this.group.add(oar);

      // Paddle blade
      const bladeGeo = this.trackGeo(new THREE.BoxGeometry(0.2, 0.02, 0.4));
      const blade = new THREE.Mesh(bladeGeo, oarMat);
      blade.position.set(side * 2.0, 0.0, 0);
      this.group.add(blade);
    }
  }

  private buildSkiff(): void {
    const hullMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.6 }));
    const metalMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.5, roughness: 0.3 }));

    // Tapered hull
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(1.6, 0.4, 3.8));
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = -0.05;
    hull.scale.set(1, 1, 1);
    this.group.add(hull);

    // Bow taper
    const bowGeo = this.trackGeo(new THREE.ConeGeometry(0.8, 1.2, 4));
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, -0.05, -2.5);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Small bench
    const benchGeo = this.trackGeo(new THREE.BoxGeometry(1.2, 0.08, 0.3));
    const benchMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 }));
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 0.35, 0.3);
    this.group.add(bench);

    // Outboard motor
    const motorGeo = this.trackGeo(new THREE.BoxGeometry(0.3, 0.5, 0.4));
    const motor = new THREE.Mesh(motorGeo, metalMat);
    motor.position.set(0, 0.2, 1.7);
    this.group.add(motor);

    const shaftGeo = this.trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6));
    const shaft = new THREE.Mesh(shaftGeo, metalMat);
    shaft.position.set(0, -0.3, 1.7);
    this.group.add(shaft);
  }

  private buildSailboat(): void {
    const hullMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }));
    const woodMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 }));
    const sailMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xfafafa, roughness: 0.9, side: THREE.DoubleSide,
    }));

    // Wider hull
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(2.2, 0.6, 4.5));
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = -0.1;
    this.group.add(hull);

    // Bow
    const bowGeo = this.trackGeo(new THREE.ConeGeometry(1.1, 1.5, 4));
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, -0.1, -3.0);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Cabin box
    const cabinGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.8, 1.5));
    const cabin = new THREE.Mesh(cabinGeo, woodMat);
    cabin.position.set(0, 0.6, 0.8);
    this.group.add(cabin);

    // Mast
    const mastGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 5.0, 8));
    const mast = new THREE.Mesh(mastGeo, woodMat);
    mast.position.set(0, 2.7, -0.5);
    this.group.add(mast);

    // Triangular sail (plane rotated)
    const sailGeo = this.trackGeo(new THREE.BufferGeometry());
    const verts = new Float32Array([
      0, 0.3, -0.5,   // bottom-front
      0, 5.0, -0.5,   // top
      0, 0.3, 1.5,    // bottom-back
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0.05, 0, 0);
    this.group.add(sail);
  }

  private buildSpeedboat(): void {
    const hullMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.3, metalness: 0.2 }));
    const metalMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.6, roughness: 0.2 }));
    const glassMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x90caf9, roughness: 0.1, transparent: true, opacity: 0.6,
    }));

    // Sleek hull
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(1.8, 0.45, 4.8));
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = -0.05;
    this.group.add(hull);

    // Sharp bow
    const bowGeo = this.trackGeo(new THREE.ConeGeometry(0.9, 2.0, 4));
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, -0.05, -3.4);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Racing stripe (white)
    const stripeMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    const stripeGeo = this.trackGeo(new THREE.BoxGeometry(1.82, 0.1, 4.82));
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.1;
    this.group.add(stripe);

    // Windshield
    const shieldGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.6, 0.08));
    const shield = new THREE.Mesh(shieldGeo, glassMat);
    shield.position.set(0, 0.6, -0.3);
    shield.rotation.x = -0.3;
    this.group.add(shield);

    // Engine cowling
    const engineGeo = this.trackGeo(new THREE.BoxGeometry(1.0, 0.4, 1.2));
    const engine = new THREE.Mesh(engineGeo, metalMat);
    engine.position.set(0, 0.3, 1.8);
    this.group.add(engine);
  }

  private buildResearchVessel(): void {
    const hullMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.5 }));
    const deckMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.6 }));
    const metalMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.5, roughness: 0.3 }));

    // Large hull
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(3.0, 0.7, 6.0));
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = -0.15;
    this.group.add(hull);

    // Bow
    const bowGeo = this.trackGeo(new THREE.ConeGeometry(1.5, 2.0, 4));
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0, -0.15, -4.0);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Bridge cabin
    const bridgeGeo = this.trackGeo(new THREE.BoxGeometry(2.2, 1.2, 2.0));
    const bridge = new THREE.Mesh(bridgeGeo, deckMat);
    bridge.position.set(0, 0.8, 0.5);
    this.group.add(bridge);

    // Observation deck (on top of bridge)
    const obsDeckGeo = this.trackGeo(new THREE.BoxGeometry(2.4, 0.1, 2.2));
    const obsDeck = new THREE.Mesh(obsDeckGeo, metalMat);
    obsDeck.position.set(0, 1.45, 0.5);
    this.group.add(obsDeck);

    // Observation deck railing posts
    const railGeo = this.trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6));
    for (const side of [-1.1, 1.1]) {
      for (const z of [-0.5, 0.5, 1.5]) {
        const post = new THREE.Mesh(railGeo, metalMat);
        post.position.set(side, 1.75, z);
        this.group.add(post);
      }
    }

    // Crane arm
    const craneBaseGeo = this.trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 8));
    const craneBase = new THREE.Mesh(craneBaseGeo, metalMat);
    craneBase.position.set(-0.8, 1.2, -1.5);
    this.group.add(craneBase);

    const craneArmGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6));
    const craneArm = new THREE.Mesh(craneArmGeo, metalMat);
    craneArm.position.set(-0.8, 2.3, -2.2);
    craneArm.rotation.z = 0.8;
    this.group.add(craneArm);
  }

  // --- Public control methods ---

  /** Show the boat docked at the dock end */
  showAtDock(): void {
    this.group.position.set(0, 0, 4);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
    this.sailing = false;
  }

  startSailing(): void {
    this.sailing = true;
  }

  stopSailing(): void {
    this.sailing = false;
  }

  setCameraTheta(theta: number): void {
    this.cameraTheta = theta;
  }

  get isInDeepWater(): boolean {
    return this.group.position.z > this.DEEP_Z;
  }

  get worldPosition(): THREE.Vector3 {
    return this.group.position;
  }

  // --- Update ---

  update(dt: number): void {
    if (!this.group.visible || !this.boatData) return;

    // Wave floating
    const pos = this.group.position;
    const waveY = this.water.getWaveHeight(pos.x, pos.z);
    pos.y = waveY + 0.3; // sit slightly above water surface

    // Tilt from wave slope (sample nearby points)
    const sampleDist = 1.0;
    const hFront = this.water.getWaveHeight(pos.x, pos.z - sampleDist);
    const hBack = this.water.getWaveHeight(pos.x, pos.z + sampleDist);
    const hLeft = this.water.getWaveHeight(pos.x - sampleDist, pos.z);
    const hRight = this.water.getWaveHeight(pos.x + sampleDist, pos.z);

    const tiltX = Math.atan2(hBack - hFront, sampleDist * 2) * 0.5;
    const tiltZ = Math.atan2(hRight - hLeft, sampleDist * 2) * 0.5;

    // Preserve Y rotation (facing), apply tilt
    const yRot = this.group.rotation.y;
    this.group.rotation.set(tiltX, yRot, tiltZ);

    // Sailing movement
    if (this.sailing) {
      const { x: inputX, z: inputZ } = this.input.getMovementInput();

      if (inputX !== 0 || inputZ !== 0) {
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

        const speed = this.boatData.speed;
        pos.x += moveDir.x * speed * dt;
        pos.z += moveDir.z * speed * dt;

        // Clamp to water bounds
        pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
        pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));

        // Face movement direction (smooth)
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        let angleDiff = targetAngle - this.group.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.group.rotation.y += angleDiff * Math.min(dt * 5, 1);
      }
    }

    // Update rod attach point (world-space)
    this.group.updateMatrixWorld(true);
    const localAttach = new THREE.Vector3(0, 1.2, -0.8);
    this.rodAttachPoint.copy(localAttach).applyMatrix4(this.group.matrixWorld);
  }

  destroy(): void {
    this.clearMesh();
    this.scene.remove(this.group);
  }
}
