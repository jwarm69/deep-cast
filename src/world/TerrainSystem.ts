import * as THREE from 'three';
import { Component } from '../core/types';

export class TerrainSystem implements Component {
  private scene: THREE.Scene;
  private objects: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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

  private add(obj: THREE.Object3D): void {
    this.scene.add(obj);
    this.objects.push(obj);
  }

  private createGround(): void {
    // Main ground plane — covers land side only (z = -60 to z = 0)
    const groundGeo = new THREE.PlaneGeometry(100, 60);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, 0.3, -30);
    ground.receiveShadow = true;
    this.add(ground);
  }

  private createShoreline(): void {
    // Sandy shoreline strip along water edge (z = -3 to z = 2)
    const shoreMat = new THREE.MeshStandardMaterial({
      color: 0xc2a66b,
      roughness: 0.85,
    });
    const shoreGeo = new THREE.PlaneGeometry(80, 5);
    shoreGeo.rotateX(-Math.PI / 2);
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.position.set(0, 0.1, -1);
    shore.receiveShadow = true;
    this.add(shore);
  }

  private createDock(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.8,
    });

    // Dock platform — spans from land (z=-8) over water (z=4)
    const platformGeo = new THREE.BoxGeometry(4, 0.25, 12);
    const platform = new THREE.Mesh(platformGeo, woodMat);
    platform.position.set(0, 1.0, -2);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.add(platform);

    // Dock support pillars — extend into water below
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.0, 8);
    const pillarPositions = [
      [-1.5, -0.25, -7], [1.5, -0.25, -7],
      [-1.5, -0.25, -4], [1.5, -0.25, -4],
      [-1.5, -0.25, -1], [1.5, -0.25, -1],
      [-1.5, -0.75, 2],  [1.5, -0.75, 2],   // over water — pillars go deeper
      [-1.5, -0.75, 3.5],[1.5, -0.75, 3.5],
    ];
    for (const [x, y, z] of pillarPositions) {
      const pillar = new THREE.Mesh(pillarGeo, woodMat);
      pillar.position.set(x, y, z);
      pillar.castShadow = true;
      this.add(pillar);
    }

    // Dock railing posts
    const railMat = new THREE.MeshStandardMaterial({ color: 0x7a5c12, roughness: 0.8 });
    const railPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
    for (const side of [-1.8, 1.8]) {
      for (let z = -7; z <= 3; z += 2) {
        const post = new THREE.Mesh(railPostGeo, railMat);
        post.position.set(side, 1.6, z);
        post.castShadow = true;
        this.add(post);
      }
      // Rail top bar
      const barGeo = new THREE.BoxGeometry(0.08, 0.08, 11);
      const bar = new THREE.Mesh(barGeo, railMat);
      bar.position.set(side, 2.0, -2);
      this.add(bar);
    }
  }

  private createTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.7 });

    // All trees on land side (z < -5)
    const treePositions = [
      [-8, -8], [-12, -15], [7, -10], [11, -18], [-15, -12],
      [14, -14], [-6, -20], [4, -22], [-18, -18], [18, -16],
      [-10, -25], [9, -28], [-20, -22], [15, -25], [0, -30],
    ];

    for (const [x, z] of treePositions) {
      const trunkHeight = 2 + Math.random() * 2;
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, trunkHeight, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 0.3 + trunkHeight / 2, z);
      trunk.castShadow = true;
      this.add(trunk);

      // Canopy — stacked cones
      for (let i = 0; i < 3; i++) {
        const coneRadius = 2.2 - i * 0.5;
        const coneHeight = 2.5 - i * 0.3;
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        const cone = new THREE.Mesh(coneGeo, leafMat);
        cone.position.set(x, 0.3 + trunkHeight + 0.5 + i * 1.2, z);
        cone.castShadow = true;
        this.add(cone);
      }
    }
  }

  private createRocks(): void {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.85 });

    // Shore rocks (z < 0, on land)
    const shoreRockPositions = [
      [-5, -3], [6, -2], [-8, -5], [9, -4], [-3, -1.5],
      [4, -2.5], [-11, -6], [12, -3],
    ];
    for (const [x, z] of shoreRockPositions) {
      const size = 0.3 + Math.random() * 0.8;
      const rockGeo = new THREE.DodecahedronGeometry(size, 1);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, 0.1 + size * 0.3, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.5 + Math.random() * 0.3;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.add(rock);
    }

    // Waterline rocks (z around 0, partially in water)
    const waterlineRockPositions = [
      [-7, 0.5], [8, 0.3], [-12, 0.8], [14, 0.2], [-3, 0.6],
    ];
    for (const [x, z] of waterlineRockPositions) {
      const size = 0.5 + Math.random() * 1.0;
      const rockGeo = new THREE.DodecahedronGeometry(size, 1);
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
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.9,
    });

    // Hills only behind the shore (z < -10)
    for (let i = 0; i < 6; i++) {
      const hillRadius = 3 + Math.random() * 5;
      const hillGeo = new THREE.SphereGeometry(hillRadius, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
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
    // Underwater lakebed — only under the lake area (z > -2)
    const bedGeo = new THREE.PlaneGeometry(100, 65);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a3a,
      roughness: 0.95,
    });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -3, 30);
    bed.receiveShadow = true;
    this.add(bed);
  }

  update(_dt: number): void {}

  destroy(): void {
    for (const obj of this.objects) {
      this.scene.remove(obj);
    }
    this.objects = [];
  }
}
