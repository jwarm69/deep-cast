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
  private velocity = new THREE.Vector3();
  private wakeMaterials: THREE.MeshBasicMaterial[] = [];
  private wakeTime = 0;

  // Motion feel
  private prevSpeed = 0;
  private pitchAccel = 0; // bow rise/dip from acceleration
  private bankAngle = 0;  // smoothed lean into turns
  private idlePhase = 0;

  // World-space foam wake trail — persists across boat/biome swaps, so it is
  // owned separately from the per-boat mesh/material pools.
  private trailGeo: THREE.CircleGeometry | null = null;
  private trailPatches: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  private trailIndex = 0;
  private trailEmitTimer = 0;
  private readonly TRAIL_LIFE = 2.4;

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

  init(): void {
    this.buildWakeTrail();
  }

  /** Pool of flat foam patches dropped behind the boat as it moves. */
  private buildWakeTrail(): void {
    this.trailGeo = new THREE.CircleGeometry(0.6, 16);
    this.trailGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xeaffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.trailGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.trailPatches.push({ mesh, mat, life: 0 });
    }
  }

  private trailBaseScale(): number {
    return 0.5 + this.boatLengthScale() * 0.25;
  }

  /** Emit from the stern while moving; age + grow + fade every patch. */
  private updateWakeTrail(dt: number, pos: THREE.Vector3, speedRatio: number): void {
    if (this.sailing && speedRatio > 0.16) {
      this.trailEmitTimer -= dt;
      if (this.trailEmitTimer <= 0) {
        this.trailEmitTimer = 0.11 + (1 - speedRatio) * 0.16;
        const yRot = this.group.rotation.y;
        const back = new THREE.Vector3(-Math.sin(yRot), 0, -Math.cos(yRot));
        const right = new THREE.Vector3(back.z, 0, -back.x);
        const sternDist = 1.6 + this.boatLengthScale() * 1.1;
        const jitter = (Math.random() - 0.5) * 0.5;

        const p = this.trailPatches[this.trailIndex];
        this.trailIndex = (this.trailIndex + 1) % this.trailPatches.length;
        p.life = this.TRAIL_LIFE;
        p.mesh.visible = true;
        p.mesh.rotation.y = Math.random() * Math.PI;
        p.mesh.position.set(
          pos.x + back.x * sternDist + right.x * jitter,
          0,
          pos.z + back.z * sternDist + right.z * jitter,
        );
        p.mesh.scale.setScalar(this.trailBaseScale());
      }
    }

    const base = this.trailBaseScale();
    for (const p of this.trailPatches) {
      if (p.life <= 0) {
        if (p.mesh.visible) p.mesh.visible = false;
        continue;
      }
      p.life -= dt;
      const u = 1 - p.life / this.TRAIL_LIFE; // 0 = fresh, 1 = gone
      p.mat.opacity = Math.max(0, 1 - u) * 0.5;
      p.mesh.scale.setScalar(base * (1 + u * 2.2));
      // Ride the water surface as the wake drifts.
      p.mesh.position.y = this.water.getWaveHeight(p.mesh.position.x, p.mesh.position.z) + 0.02;
    }
  }

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
    this.buildAngler();
    this.applyMeshShadows();
    this.buildWake();
  }

  /**
   * Seat the player's angler in the boat. When the player boards, the shore
   * Character is hidden (main.ts), so without this the boat looks unmanned.
   * Added to the boat group, so it bobs/tilts/banks with the hull, and tracked
   * for disposal on the next boat swap.
   */
  private buildAngler(): void {
    if (!this.boatData) return;

    const bodyMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }));
    const skinMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.6 }));
    const hatMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.7 }));
    const legMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 }));

    const angler = new THREE.Group();
    // Sit higher/further forward on the big deck boat than in a small rowboat.
    const seatY = this.boatData.id === 'research_vessel' ? 0.7 : 0.3;
    const seatZ = this.boatData.id === 'rowboat' ? -0.1 : -0.25;
    angler.position.set(-0.05, seatY, seatZ);

    // Torso + head
    const torso = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.3, 0.62, 6, 12)), bodyMat);
    torso.position.y = 0.55;
    angler.add(torso);

    const head = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.22, 12, 8)), skinMat);
    head.position.y = 1.2;
    angler.add(head);

    // Straw hat
    const brim = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14)), hatMat);
    brim.position.y = 1.33;
    angler.add(brim);
    const crown = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.19, 0.22, 0.22, 14)), hatMat);
    crown.position.y = 1.46;
    angler.add(crown);

    // Seated legs — thighs forward, shins down
    const thighGeo = this.trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8));
    const shinGeo = this.trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8));
    for (const sx of [-0.15, 0.15]) {
      const thigh = new THREE.Mesh(thighGeo, legMat);
      thigh.position.set(sx, 0.18, 0.28);
      thigh.rotation.x = Math.PI / 2;
      angler.add(thigh);
      const shin = new THREE.Mesh(shinGeo, legMat);
      shin.position.set(sx, -0.05, 0.5);
      angler.add(shin);
    }

    // Arms reaching toward the rod
    const armGeo = this.trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.55, 8));
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(-0.32, 0.7, 0.2);
    rightArm.rotation.set(-0.5, 0, 0.25);
    angler.add(rightArm);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(0.3, 0.62, 0.18);
    leftArm.rotation.set(-0.35, 0, -0.25);
    angler.add(leftArm);

    this.group.add(angler);
  }

  private clearMesh(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
    this.wakeMaterials = [];
  }

  private trackGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat(mat: THREE.Material): THREE.Material {
    this.materials.push(mat);
    return mat;
  }

  private applyMeshShadows(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  private buildWake(): void {
    const wakeGroup = new THREE.Group();
    const wakeGeo = this.trackGeo(new THREE.PlaneGeometry(0.45, 3.6));

    for (const side of [-1, 1]) {
      const mat = this.trackMat(new THREE.MeshBasicMaterial({
        color: 0xdaf7ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })) as THREE.MeshBasicMaterial;
      this.wakeMaterials.push(mat);

      const streak = new THREE.Mesh(wakeGeo, mat);
      streak.position.set(side * 0.42, -0.28, -2.25);
      streak.rotation.x = -Math.PI / 2;
      streak.rotation.z = side * 0.16;
      streak.scale.set(1.0, 1.0 + this.boatLengthScale() * 0.16, 1);
      wakeGroup.add(streak);
    }

    const washMat = this.trackMat(new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })) as THREE.MeshBasicMaterial;
    this.wakeMaterials.push(washMat);

    const wash = new THREE.Mesh(this.trackGeo(new THREE.CircleGeometry(0.55, 18)), washMat);
    wash.position.set(0, -0.27, -1.55);
    wash.rotation.x = -Math.PI / 2;
    wash.scale.set(1.0, 0.55, 1);
    wakeGroup.add(wash);

    this.group.add(wakeGroup);
  }

  private boatLengthScale(): number {
    if (!this.boatData) return 1;
    switch (this.boatData.id) {
      case 'rowboat': return 0.8;
      case 'skiff': return 0.9;
      case 'sailboat': return 1.1;
      case 'speedboat': return 1.2;
      case 'research_vessel': return 1.45;
      default: return 1;
    }
  }

  // --- Builder methods ---

  private buildRowboat(): void {
    const wood = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 }));
    const darkWood = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x5c3a16, roughness: 0.9 }));

    const hullGeo = this.trackGeo(new THREE.BoxGeometry(1.8, 0.5, 3.5));
    const hull = new THREE.Mesh(hullGeo, wood);
    hull.position.y = -0.1;
    this.group.add(hull);

    const bowGeo = this.trackGeo(new THREE.ConeGeometry(0.9, 0.8, 4));
    const bow = new THREE.Mesh(bowGeo, wood);
    bow.position.set(0, -0.1, 2.15);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    const sternGeo = this.trackGeo(new THREE.BoxGeometry(1.55, 0.5, 0.35));
    const stern = new THREE.Mesh(sternGeo, darkWood);
    stern.position.set(0, -0.08, -1.9);
    this.group.add(stern);

    // Inner floor
    const floorGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.08, 3.0));
    const floor = new THREE.Mesh(floorGeo, wood);
    floor.position.y = 0.1;
    this.group.add(floor);

    const railGeo = this.trackGeo(new THREE.BoxGeometry(0.12, 0.16, 3.4));
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, darkWood);
      rail.position.set(side * 0.95, 0.23, 0);
      this.group.add(rail);
    }

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
      blade.position.set(side * 2.0, 0.0, side * 0.12);
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
    bow.position.set(0, -0.05, 2.5);
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
    motor.position.set(0, 0.2, -1.75);
    this.group.add(motor);

    const shaftGeo = this.trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6));
    const shaft = new THREE.Mesh(shaftGeo, metalMat);
    shaft.position.set(0, -0.3, -1.75);
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
    bow.position.set(0, -0.1, 3.0);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Cabin box
    const cabinGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.8, 1.5));
    const cabin = new THREE.Mesh(cabinGeo, woodMat);
    cabin.position.set(0, 0.6, -0.8);
    this.group.add(cabin);

    // Mast
    const mastGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 5.0, 8));
    const mast = new THREE.Mesh(mastGeo, woodMat);
    mast.position.set(0, 2.7, 0.35);
    this.group.add(mast);

    // Triangular sail (plane rotated)
    const sailGeo = this.trackGeo(new THREE.BufferGeometry());
    const verts = new Float32Array([
      0, 0.3, 1.25,
      0, 5.0, 0.35,
      0, 0.3, -1.25,
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
    bow.position.set(0, -0.05, 3.4);
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
    shield.position.set(0, 0.6, 0.65);
    shield.rotation.x = -0.3;
    this.group.add(shield);

    // Engine cowling
    const engineGeo = this.trackGeo(new THREE.BoxGeometry(1.0, 0.4, 1.2));
    const engine = new THREE.Mesh(engineGeo, metalMat);
    engine.position.set(0, 0.3, -1.8);
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
    bow.position.set(0, -0.15, 4.0);
    bow.rotation.x = Math.PI / 2;
    this.group.add(bow);

    // Bridge cabin
    const bridgeGeo = this.trackGeo(new THREE.BoxGeometry(2.2, 1.2, 2.0));
    const bridge = new THREE.Mesh(bridgeGeo, deckMat);
    bridge.position.set(0, 0.8, -0.5);
    this.group.add(bridge);

    // Observation deck (on top of bridge)
    const obsDeckGeo = this.trackGeo(new THREE.BoxGeometry(2.4, 0.1, 2.2));
    const obsDeck = new THREE.Mesh(obsDeckGeo, metalMat);
    obsDeck.position.set(0, 1.45, -0.5);
    this.group.add(obsDeck);

    // Observation deck railing posts
    const railGeo = this.trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6));
    for (const side of [-1.1, 1.1]) {
      for (const z of [-1.5, -0.5, 0.5]) {
        const post = new THREE.Mesh(railGeo, metalMat);
        post.position.set(side, 1.75, z);
        this.group.add(post);
      }
    }

    // Crane arm
    const craneBaseGeo = this.trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 2.0, 8));
    const craneBase = new THREE.Mesh(craneBaseGeo, metalMat);
    craneBase.position.set(-0.8, 1.2, 1.5);
    this.group.add(craneBase);

    const craneArmGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6));
    const craneArm = new THREE.Mesh(craneArmGeo, metalMat);
    craneArm.position.set(-0.8, 2.3, 2.2);
    craneArm.rotation.z = 0.8;
    this.group.add(craneArm);
  }

  // --- Public control methods ---

  /** Show the boat docked at the dock end */
  showAtDock(): void {
    this.group.position.set(0, 0, 4);
    this.group.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
    this.sailing = false;
    this.velocity.set(0, 0, 0);
    // Clear any live wake patches so foam doesn't freeze on the water when the
    // boat update() loop early-returns while hidden.
    for (const p of this.trailPatches) {
      p.life = 0;
      p.mat.opacity = 0;
      p.mesh.visible = false;
    }
  }

  startSailing(): void {
    this.sailing = true;
  }

  stopSailing(): void {
    this.sailing = false;
    this.velocity.multiplyScalar(0.35);
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

  /** 0..1 fraction of top speed — drives camera feel and effects. */
  get speedRatio(): number {
    if (!this.boatData) return 0;
    return THREE.MathUtils.clamp(this.velocity.length() / Math.max(this.boatData.speed, 0.001), 0, 1);
  }

  // --- Update ---

  update(dt: number): void {
    if (!this.group.visible || !this.boatData) return;

    const pos = this.group.position;
    this.wakeTime += dt;

    if (this.sailing) {
      const { x: inputX, z: inputZ } = this.input.getMovementInput();
      const hasInput = inputX !== 0 || inputZ !== 0;
      const desiredVelocity = new THREE.Vector3();

      if (hasInput) {
        const forward = new THREE.Vector3(
          -Math.sin(this.cameraTheta),
          0,
          -Math.cos(this.cameraTheta),
        );
        const right = new THREE.Vector3(forward.z, 0, -forward.x);

        desiredVelocity
          .addScaledVector(forward, inputZ)
          .addScaledVector(right, inputX)
          .normalize()
          .multiplyScalar(this.boatData.speed);
      }

      const response = hasInput ? 3.4 : 1.8;
      this.velocity.lerp(desiredVelocity, 1 - Math.exp(-response * dt));
    } else {
      this.velocity.multiplyScalar(Math.pow(0.03, dt));
    }

    const moving = this.velocity.lengthSq() > 0.0004;
    let steeringLean = 0;
    if (moving) {
      pos.addScaledVector(this.velocity, dt);

      const clampedX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
      const clampedZ = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));
      if (clampedX !== pos.x) this.velocity.x = 0;
      if (clampedZ !== pos.z) this.velocity.z = 0;
      pos.x = clampedX;
      pos.z = clampedZ;

      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let angleDiff = targetAngle - this.group.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const turnSpeed = 2.2 + this.boatData.speed * 0.12;
      this.group.rotation.y += angleDiff * Math.min(dt * turnSpeed, 1);
      steeringLean = THREE.MathUtils.clamp(-angleDiff * 0.12, -0.12, 0.12);
    }

    // Wave floating
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

    const speed = this.velocity.length();
    const speedRatio = THREE.MathUtils.clamp(speed / Math.max(this.boatData.speed, 0.001), 0, 1);

    // Bow rises under acceleration, dips when braking — eased for weight.
    const accel = (speed - this.prevSpeed) / Math.max(dt, 1e-4);
    this.prevSpeed = speed;
    const targetPitch = THREE.MathUtils.clamp(accel * 0.05, -0.16, 0.16);
    this.pitchAccel += (targetPitch - this.pitchAccel) * Math.min(1, dt * 6);

    // Smooth the lean so turns bank in and settle out.
    this.bankAngle += (steeringLean - this.bankAngle) * Math.min(1, dt * 5);

    // Gentle idle sway when sitting at the throttle but barely moving.
    this.idlePhase += dt;
    const idle = this.sailing ? Math.sin(this.idlePhase * 1.3) * 0.015 * (1 - speedRatio) : 0;

    // Preserve Y rotation (facing); layer wave tilt, planing pitch, bank, idle.
    const yRot = this.group.rotation.y;
    this.group.rotation.set(
      tiltX - speedRatio * 0.05 - this.pitchAccel + idle * 0.5,
      yRot,
      tiltZ + this.bankAngle * (0.6 + speedRatio) + idle,
    );

    this.updateWakeTrail(dt, pos, speedRatio);

    const wakeOpacity = this.sailing ? speedRatio * 0.36 : 0;
    this.wakeMaterials.forEach((mat, index) => {
      const flicker = 0.84 + Math.sin(this.wakeTime * 8 + index * 1.7) * 0.16;
      mat.opacity = wakeOpacity * flicker * (index === this.wakeMaterials.length - 1 ? 0.65 : 1);
    });

    // Update rod attach point (world-space)
    this.group.updateMatrixWorld(true);
    const attachY = this.boatData.id === 'research_vessel' ? 1.55 : 1.15;
    const attachZ = this.boatData.id === 'rowboat' ? 0.75 : 1.05;
    const localAttach = new THREE.Vector3(-0.45, attachY, attachZ);
    this.rodAttachPoint.copy(localAttach).applyMatrix4(this.group.matrixWorld);
  }

  destroy(): void {
    this.clearMesh();
    this.scene.remove(this.group);
    for (const p of this.trailPatches) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    this.trailPatches = [];
    this.trailGeo?.dispose();
    this.trailGeo = null;
  }
}
