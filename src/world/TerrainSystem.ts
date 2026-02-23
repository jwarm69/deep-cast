import * as THREE from 'three';
import { Component } from '../core/types';
import { BiomeConfig, BIOME_CONFIGS } from '../data/biome-config';

export class TerrainSystem implements Component {
  private scene: THREE.Scene;
  private objects: THREE.Object3D[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private config: BiomeConfig;

  constructor(scene: THREE.Scene, config?: BiomeConfig) {
    this.scene = scene;
    this.config = config ?? BIOME_CONFIGS.lake;
  }

  init(): void {
    this.createGround();
    this.createShoreline();
    this.createDock();
    this.createTrees();
    this.createRocks();
    this.createHills();
    this.createLakeBottom();
  }

  /** Position where the character stands on the dock */
  get characterPosition(): THREE.Vector3 {
    return new THREE.Vector3(0, 1.25, -4);
  }

  private trackGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat(mat: THREE.Material): THREE.Material {
    this.materials.push(mat);
    return mat;
  }

  private add(obj: THREE.Object3D): void {
    this.scene.add(obj);
    this.objects.push(obj);
  }

  private createGround(): void {
    const groundGeo = this.trackGeo(new THREE.PlaneGeometry(100, 60));
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.groundColor,
      roughness: 0.9,
    }));
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, 0.3, -30);
    ground.receiveShadow = true;
    this.add(ground);
  }

  private createShoreline(): void {
    const shoreMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.shoreColor,
      roughness: 0.85,
    }));
    const shoreGeo = this.trackGeo(new THREE.PlaneGeometry(80, 5));
    shoreGeo.rotateX(-Math.PI / 2);
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.position.set(0, 0.1, -1);
    shore.receiveShadow = true;
    this.add(shore);
  }

  private createDock(): void {
    switch (this.config.dockStyle) {
      case 'wooden_pier':
        this.createWoodenPier();
        break;
      case 'ice_shelf':
        this.createIceShelf();
        break;
      default:
        this.createWoodenDock();
        break;
    }
  }

  private createWoodenDock(): void {
    const woodMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.8,
    }));

    const platformGeo = this.trackGeo(new THREE.BoxGeometry(4, 0.25, 12));
    const platform = new THREE.Mesh(platformGeo, woodMat);
    platform.position.set(0, 1.0, -2);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.add(platform);

    const pillarGeo = this.trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8));
    const pillarPositions = [
      [-1.5, -0.25, -7], [1.5, -0.25, -7],
      [-1.5, -0.25, -4], [1.5, -0.25, -4],
      [-1.5, -0.25, -1], [1.5, -0.25, -1],
      [-1.5, -0.75, 2],  [1.5, -0.75, 2],
      [-1.5, -0.75, 3.5],[1.5, -0.75, 3.5],
    ];
    for (const [x, y, z] of pillarPositions) {
      const pillar = new THREE.Mesh(pillarGeo, woodMat);
      pillar.position.set(x, y, z);
      pillar.castShadow = true;
      this.add(pillar);
    }

    const railMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x7a5c12, roughness: 0.8 }));
    const railPostGeo = this.trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6));
    for (const side of [-1.8, 1.8]) {
      for (let z = -7; z <= 3; z += 2) {
        const post = new THREE.Mesh(railPostGeo, railMat);
        post.position.set(side, 1.6, z);
        post.castShadow = true;
        this.add(post);
      }
      const barGeo = this.trackGeo(new THREE.BoxGeometry(0.08, 0.08, 11));
      const bar = new THREE.Mesh(barGeo, railMat);
      bar.position.set(side, 2.0, -2);
      this.add(bar);
    }
  }

  private createWoodenPier(): void {
    const woodMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.75,
    }));

    // Longer, narrower pier
    const platformGeo = this.trackGeo(new THREE.BoxGeometry(3, 0.2, 16));
    const platform = new THREE.Mesh(platformGeo, woodMat);
    platform.position.set(0, 1.0, -1);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.add(platform);

    const pillarGeo = this.trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 3.5, 8));
    const positions = [
      [-1.2, -0.5, -8], [1.2, -0.5, -8],
      [-1.2, -0.5, -4], [1.2, -0.5, -4],
      [-1.2, -0.75, 0], [1.2, -0.75, 0],
      [-1.2, -0.75, 4], [1.2, -0.75, 4],
      [-1.2, -0.75, 6], [1.2, -0.75, 6],
    ];
    for (const [x, y, z] of positions) {
      const pillar = new THREE.Mesh(pillarGeo, woodMat);
      pillar.position.set(x, y, z);
      pillar.castShadow = true;
      this.add(pillar);
    }

    // Simple rope railing
    const railMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 }));
    const postGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6));
    for (const side of [-1.3, 1.3]) {
      for (let z = -8; z <= 6; z += 3) {
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(side, 1.5, z);
        this.add(post);
      }
      const ropeGeo = this.trackGeo(new THREE.BoxGeometry(0.04, 0.04, 15));
      const rope = new THREE.Mesh(ropeGeo, railMat);
      rope.position.set(side, 1.8, -1);
      this.add(rope);
    }
  }

  private createIceShelf(): void {
    const iceMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.3,
      metalness: 0.1,
    }));

    // Flat ice platform
    const shelfGeo = this.trackGeo(new THREE.BoxGeometry(6, 0.5, 14));
    const shelf = new THREE.Mesh(shelfGeo, iceMat);
    shelf.position.set(0, 0.85, -1);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.add(shelf);

    // Ice chunks around edges
    const chunkMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xb3e5fc,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
    }));
    const chunkPositions = [
      [-2.5, 0.9, -7], [2.8, 0.8, -5], [-2.8, 0.7, 2],
      [2.5, 0.85, 5], [-1, 0.75, 6], [1.5, 0.7, -8],
    ];
    for (const [x, y, z] of chunkPositions) {
      const size = 0.3 + Math.random() * 0.6;
      const chunkGeo = this.trackGeo(new THREE.DodecahedronGeometry(size, 0));
      const chunk = new THREE.Mesh(chunkGeo, chunkMat);
      chunk.position.set(x, y, z);
      chunk.rotation.set(Math.random(), Math.random(), Math.random());
      chunk.scale.y = 0.4 + Math.random() * 0.3;
      this.add(chunk);
    }
  }

  private createTrees(): void {
    const trunkMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.trunkColor,
      roughness: 0.9,
    })) as THREE.MeshStandardMaterial;
    const leafMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.leafColor,
      roughness: 0.7,
    })) as THREE.MeshStandardMaterial;

    // Generate positions — use fixed seed pattern for consistency
    const basePositions = [
      [-8, -8], [-12, -15], [7, -10], [11, -18], [-15, -12],
      [14, -14], [-6, -20], [4, -22], [-18, -18], [18, -16],
      [-10, -25], [9, -28], [-20, -22], [15, -25], [0, -30],
    ];
    const treePositions = basePositions.slice(0, this.config.treeCount);

    for (const [x, z] of treePositions) {
      switch (this.config.treeStyle) {
        case 'palm':
          this.createPalmTree(x, z, trunkMat, leafMat);
          break;
        case 'pine':
          this.createPineTree(x, z, trunkMat, leafMat);
          break;
        default:
          this.createDeciduousTree(x, z, trunkMat, leafMat);
          break;
      }
    }
  }

  private createDeciduousTree(x: number, z: number, trunkMat: THREE.Material, leafMat: THREE.Material): void {
    const trunkHeight = 2 + Math.random() * 2;
    const trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.2, 0.35, trunkHeight, 8));
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.3 + trunkHeight / 2, z);
    trunk.castShadow = true;
    this.add(trunk);

    for (let i = 0; i < 3; i++) {
      const coneRadius = 2.2 - i * 0.5;
      const coneHeight = 2.5 - i * 0.3;
      const coneGeo = this.trackGeo(new THREE.ConeGeometry(coneRadius, coneHeight, 8));
      const cone = new THREE.Mesh(coneGeo, leafMat);
      cone.position.set(x, 0.3 + trunkHeight + 0.5 + i * 1.2, z);
      cone.castShadow = true;
      this.add(cone);
    }
  }

  private createPalmTree(x: number, z: number, trunkMat: THREE.Material, leafMat: THREE.Material): void {
    const trunkHeight = 4 + Math.random() * 3;
    // Slightly curved trunk using tapered cylinder
    const trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.15, 0.3, trunkHeight, 8));
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.3 + trunkHeight / 2, z);
    // Slight lean
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    trunk.castShadow = true;
    this.add(trunk);

    // Frond cluster — sphere top + radiating cones
    const topY = 0.3 + trunkHeight + 0.5;
    const crownGeo = this.trackGeo(new THREE.SphereGeometry(1.2, 8, 6));
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.position.set(x, topY, z);
    crown.scale.y = 0.5;
    crown.castShadow = true;
    this.add(crown);

    // Drooping fronds
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const frondGeo = this.trackGeo(new THREE.ConeGeometry(0.4, 2.5, 4));
      const frond = new THREE.Mesh(frondGeo, leafMat);
      frond.position.set(
        x + Math.cos(angle) * 1.0,
        topY - 0.3,
        z + Math.sin(angle) * 1.0,
      );
      frond.rotation.set(0, 0, Math.PI * 0.65);
      frond.rotation.y = angle;
      frond.castShadow = true;
      this.add(frond);
    }
  }

  private createPineTree(x: number, z: number, trunkMat: THREE.Material, leafMat: THREE.Material): void {
    const trunkHeight = 3 + Math.random() * 2;
    const trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.12, 0.25, trunkHeight, 8));
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.3 + trunkHeight / 2, z);
    trunk.castShadow = true;
    this.add(trunk);

    // Narrow, tall cone layers (pine shape)
    for (let i = 0; i < 4; i++) {
      const coneRadius = 1.4 - i * 0.3;
      const coneHeight = 2.0 - i * 0.2;
      const coneGeo = this.trackGeo(new THREE.ConeGeometry(coneRadius, coneHeight, 8));
      const cone = new THREE.Mesh(coneGeo, leafMat);
      cone.position.set(x, 0.3 + trunkHeight + i * 0.9, z);
      cone.castShadow = true;
      this.add(cone);
    }
  }

  private createRocks(): void {
    const rockMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.rockColor,
      roughness: 0.85,
    }));

    // Shore rocks
    const shoreRockPositions = [
      [-5, -3], [6, -2], [-8, -5], [9, -4], [-3, -1.5],
      [4, -2.5], [-11, -6], [12, -3], [-14, -4], [16, -5],
    ];
    for (const [x, z] of shoreRockPositions.slice(0, this.config.shoreRockCount)) {
      const size = 0.3 + Math.random() * 0.8;
      const rockGeo = this.trackGeo(new THREE.DodecahedronGeometry(size, 1));
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, 0.1 + size * 0.3, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.5 + Math.random() * 0.3;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.add(rock);
    }

    // Waterline rocks
    const waterlineRockPositions = [
      [-7, 0.5], [8, 0.3], [-12, 0.8], [14, 0.2], [-3, 0.6], [10, 0.7],
    ];
    for (const [x, z] of waterlineRockPositions.slice(0, this.config.waterRockCount)) {
      const size = 0.5 + Math.random() * 1.0;
      const rockGeo = this.trackGeo(new THREE.DodecahedronGeometry(size, 1));
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, -0.1 + size * 0.2, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.4 + Math.random() * 0.3;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.add(rock);
    }
  }

  private createHills(): void {
    const groundMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.hillColor,
      roughness: 0.9,
    }));

    for (let i = 0; i < this.config.hillCount; i++) {
      const hillRadius = 3 + Math.random() * 5;
      const hillGeo = this.trackGeo(
        new THREE.SphereGeometry(hillRadius, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      );
      const hill = new THREE.Mesh(hillGeo, groundMat.clone());
      const x = (Math.random() - 0.5) * 60;
      const z = -15 - Math.random() * 25;
      hill.position.set(x, 0.3, z);
      hill.scale.y = 0.3 + Math.random() * 0.3;
      hill.receiveShadow = true;
      hill.castShadow = true;
      this.add(hill);
    }
  }

  private createLakeBottom(): void {
    const bedGeo = this.trackGeo(new THREE.PlaneGeometry(100, 65));
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.lakeBottomColor,
      roughness: 0.95,
    }));
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -3, 30);
    bed.receiveShadow = true;
    this.add(bed);
  }

  /** Destroy and rebuild terrain with a new config */
  rebuild(config: BiomeConfig): void {
    this.destroy();
    this.config = config;
    this.init();
  }

  update(_dt: number): void {}

  destroy(): void {
    for (const obj of this.objects) {
      this.scene.remove(obj);
    }
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.objects = [];
    this.geometries = [];
    this.materials = [];
  }
}
