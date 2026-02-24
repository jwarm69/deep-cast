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
    this.createFisherHuts();
    this.createShantyProps();
    this.createBeachedBoat();
    this.createMarketStall();
    this.createBoardwalks();
    this.createTrees();
    this.createRocks();
    this.createHills();
    this.createMountains();
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
    const groundGeo = this.trackGeo(new THREE.PlaneGeometry(200, 120));
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.groundColor,
      roughness: 0.9,
    }));
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, 0.3, -60);
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

  private createBoardingSign(): void {
    const postMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 }));
    const signMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 }));

    // Post
    const postGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6));
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(2.5, 1.8, 2.5);
    post.castShadow = true;
    this.add(post);

    // Sign board
    const boardGeo = this.trackGeo(new THREE.BoxGeometry(0.8, 0.4, 0.06));
    const board = new THREE.Mesh(boardGeo, signMat);
    board.position.set(2.5, 2.5, 2.5);
    board.castShadow = true;
    this.add(board);
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
    this.createBoardingSign();
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
    this.createBoardingSign();
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
    this.createBoardingSign();
  }

  // --- Fisher huts ---

  private createFisherHuts(): void {
    const wallMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.85,
    }));
    const roofMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.rockColor,
      roughness: 0.75,
    }));
    const frameMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.9,
    }));

    for (const hut of this.config.layout.huts) {
      this.buildHut(hut.x, hut.z, hut.w, hut.h, hut.d, hut.rotY, wallMat, roofMat, frameMat, hut.isMain);
    }
  }

  private buildHut(
    x: number, z: number,
    w: number, h: number, d: number,
    rotY: number,
    wallMat: THREE.Material, roofMat: THREE.Material, frameMat: THREE.Material,
    isMain: boolean,
  ): void {
    const baseY = 0.3;
    const group = new THREE.Group();
    group.position.set(x, baseY, z);
    group.rotation.y = rotY;

    // Walls
    const wallGeo = this.trackGeo(new THREE.BoxGeometry(w, h, d));
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Peaked roof — triangular prism via extruded shape
    const roofOverhang = 0.4;
    const roofW = w + roofOverhang;
    const roofD = d + roofOverhang;
    const roofPeak = isMain ? 1.6 : 1.1;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-roofW / 2, 0);
    roofShape.lineTo(0, roofPeak);
    roofShape.lineTo(roofW / 2, 0);
    roofShape.lineTo(-roofW / 2, 0);

    const roofGeo = this.trackGeo(new THREE.ExtrudeGeometry(roofShape, {
      depth: roofD,
      bevelEnabled: false,
    }));
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, h, -roofD / 2);
    roof.castShadow = true;
    group.add(roof);

    // Door frame (front face)
    const doorH = isMain ? 1.8 : 1.3;
    const doorW = isMain ? 0.9 : 0.6;
    const doorGeo = this.trackGeo(new THREE.BoxGeometry(doorW, doorH, 0.08));
    const door = new THREE.Mesh(doorGeo, frameMat);
    door.position.set(0, doorH / 2, d / 2 + 0.04);
    group.add(door);

    // Window on side wall (main hut only)
    if (isMain) {
      const winGeo = this.trackGeo(new THREE.BoxGeometry(0.08, 0.6, 0.6));
      const winMat = this.trackMat(new THREE.MeshStandardMaterial({
        color: 0x81d4fa,
        roughness: 0.3,
        transparent: true,
        opacity: 0.6,
      }));
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(w / 2 + 0.04, h * 0.55, 0);
      group.add(win);

      // Window frame
      const wfGeo = this.trackGeo(new THREE.BoxGeometry(0.1, 0.7, 0.7));
      const wf = new THREE.Mesh(wfGeo, frameMat);
      wf.position.set(w / 2 + 0.04, h * 0.55, 0);
      group.add(wf);

      // Signpost outside door
      const postGeo = this.trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6));
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(1.2, 0.8, d / 2 + 0.5);
      post.castShadow = true;
      group.add(post);

      const signGeo = this.trackGeo(new THREE.BoxGeometry(0.8, 0.35, 0.06));
      const sign = new THREE.Mesh(signGeo, wallMat);
      sign.position.set(1.2, 1.5, d / 2 + 0.5);
      sign.castShadow = true;
      group.add(sign);
    }

    this.add(group);
  }

  // --- Shanty town props ---

  private createShantyProps(): void {
    const woodMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.85,
    })) as THREE.MeshStandardMaterial;
    const barrelMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x6d4c2a,
      roughness: 0.8,
    })) as THREE.MeshStandardMaterial;
    const ropeMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xa08060,
      roughness: 0.9,
    })) as THREE.MeshStandardMaterial;
    const netMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xc8b89a,
      roughness: 0.9,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    })) as THREE.MeshStandardMaterial;
    const lanternMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xffb74d,
      emissive: 0xffb74d,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    })) as THREE.MeshStandardMaterial;

    // --- Barrel clusters ---
    const barrelGeo = this.trackGeo(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8));
    for (const [bx, bz] of this.config.layout.props.barrels) {
      for (let i = 0; i < 3; i++) {
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        const ox = (i - 1) * 0.55;
        const oz = (i % 2) * 0.3;
        barrel.position.set(bx + ox, 0.3 + 0.4, bz + oz);
        barrel.rotation.y = i * 0.8;
        barrel.castShadow = true;
        this.add(barrel);
      }
    }

    // --- Crate stacks ---
    const crateGeo = this.trackGeo(new THREE.BoxGeometry(0.6, 0.6, 0.6));
    for (const [cx, cz, count] of this.config.layout.props.crates) {
      for (let i = 0; i < count; i++) {
        const crate = new THREE.Mesh(crateGeo, woodMat);
        crate.position.set(cx + (i % 2) * 0.5, 0.3 + 0.3 + i * 0.55, cz);
        crate.rotation.y = i * 0.4;
        crate.castShadow = true;
        this.add(crate);
      }
    }

    // --- Net-drying racks ---
    const postGeo = this.trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 6));
    const barGeo = this.trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6));
    const netGeo = this.trackGeo(new THREE.PlaneGeometry(2.3, 1.2));
    for (const [nx, nz] of this.config.layout.props.netRacks) {
      for (const side of [-1.2, 1.2]) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(nx + side, 0.3 + 1.0, nz);
        post.castShadow = true;
        this.add(post);
      }
      const bar = new THREE.Mesh(barGeo, woodMat);
      bar.position.set(nx, 0.3 + 1.9, nz);
      bar.rotation.z = Math.PI / 2;
      this.add(bar);
      const net = new THREE.Mesh(netGeo, netMat);
      net.position.set(nx, 0.3 + 1.2, nz + 0.02);
      this.add(net);
    }

    // --- Rope coils ---
    const ropeGeo = this.trackGeo(new THREE.TorusGeometry(0.25, 0.06, 8, 16));
    for (const [rx, rz] of this.config.layout.props.ropeCoils) {
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set(rx, 0.35, rz);
      rope.rotation.x = -Math.PI / 2;
      this.add(rope);
    }

    // --- Lantern posts ---
    const lanternPostGeo = this.trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 2.5, 6));
    const lanternHeadGeo = this.trackGeo(new THREE.BoxGeometry(0.2, 0.25, 0.2));
    for (const [lx, lz] of this.config.layout.props.lanterns) {
      const post = new THREE.Mesh(lanternPostGeo, woodMat);
      post.position.set(lx, 0.3 + 1.25, lz);
      post.castShadow = true;
      this.add(post);
      const head = new THREE.Mesh(lanternHeadGeo, lanternMat);
      head.position.set(lx, 0.3 + 2.6, lz);
      this.add(head);
    }
  }

  private createBeachedBoat(): void {
    const boatLayout = this.config.layout.beachedBoat;
    if (!boatLayout) return;

    const woodMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.9,
    }));
    const darkWoodMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.85,
    }));

    const group = new THREE.Group();
    group.position.set(boatLayout.x, 0.3, boatLayout.z);
    group.rotation.z = boatLayout.rotZ;
    group.rotation.y = boatLayout.rotY;

    // Hull — elongated box
    const hullGeo = this.trackGeo(new THREE.BoxGeometry(1.4, 0.8, 4.0));
    const hull = new THREE.Mesh(hullGeo, woodMat);
    hull.position.y = 0.4;
    hull.castShadow = true;
    group.add(hull);

    // Keel strip
    const keelGeo = this.trackGeo(new THREE.BoxGeometry(0.15, 0.15, 4.2));
    const keel = new THREE.Mesh(keelGeo, darkWoodMat);
    keel.position.y = 0;
    group.add(keel);

    // Bow (front taper)
    const bowGeo = this.trackGeo(new THREE.ConeGeometry(0.6, 1.2, 4));
    const bow = new THREE.Mesh(bowGeo, woodMat);
    bow.position.set(0, 0.4, 2.4);
    bow.rotation.x = Math.PI / 2;
    bow.castShadow = true;
    group.add(bow);

    // Ribs (cross-planks)
    const ribGeo = this.trackGeo(new THREE.BoxGeometry(1.5, 0.08, 0.12));
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(ribGeo, darkWoodMat);
      rib.position.set(0, 0.82, -1.2 + i * 0.9);
      group.add(rib);
    }

    this.add(group);
  }

  private createMarketStall(): void {
    const stallLayout = this.config.layout.marketStall;
    if (!stallLayout) return;

    const postMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.85,
    }));
    const canopyMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xc62828,
      roughness: 0.6,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }));
    const tableMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.rockColor,
      roughness: 0.8,
    }));

    const group = new THREE.Group();
    group.position.set(stallLayout.x, 0.3, stallLayout.z);
    group.rotation.y = stallLayout.rotY;

    // 4 corner posts
    const postGeo = this.trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 2.8, 6));
    const postPositions = [
      [-1.4, 0, -1.0], [1.4, 0, -1.0],
      [-1.4, 0, 1.0], [1.4, 0, 1.0],
    ];
    for (const [px, , pz] of postPositions) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 1.4, pz);
      post.castShadow = true;
      group.add(post);
    }

    // Canopy
    const canopyGeo = this.trackGeo(new THREE.BoxGeometry(3.2, 0.08, 2.4));
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 2.8, 0);
    canopy.castShadow = true;
    group.add(canopy);

    // Table/counter
    const tableGeo = this.trackGeo(new THREE.BoxGeometry(2.6, 0.12, 1.2));
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 1.0, 0);
    table.castShadow = true;
    group.add(table);

    // Table legs
    const legGeo = this.trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6));
    for (const lx of [-1.1, 1.1]) {
      for (const lz of [-0.4, 0.4]) {
        const leg = new THREE.Mesh(legGeo, postMat);
        leg.position.set(lx, 0.5, lz);
        group.add(leg);
      }
    }

    this.add(group);
  }

  private createBoardwalks(): void {
    if (this.config.layout.boardwalks.length === 0) return;

    const plankMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.dockColor,
      roughness: 0.85,
    }));

    for (const bw of this.config.layout.boardwalks) {
      const geo = this.trackGeo(new THREE.BoxGeometry(bw.w, 0.1, bw.d));
      const walk = new THREE.Mesh(geo, plankMat);
      walk.position.set(bw.x, 0.35, bw.z);
      walk.rotation.y = bw.rotY;
      walk.receiveShadow = true;
      this.add(walk);
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

    for (const [x, z] of this.config.layout.treePositions) {
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
    for (const [x, z] of this.config.layout.shoreRockPositions) {
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
    for (const [x, z] of this.config.layout.waterRockPositions) {
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

  private createMountains(): void {
    const mountainMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.mountainColor,
      roughness: 0.9,
    }));

    for (let i = 0; i < this.config.mountainCount; i++) {
      const segments = i % 2 === 0 ? 4 : 8; // Alternating pyramid/cone variety
      const baseRadius = 5 + Math.random() * 10;
      const height = 8 + Math.random() * 15;
      const mtnGeo = this.trackGeo(new THREE.ConeGeometry(baseRadius, height, segments));
      const mtn = new THREE.Mesh(mtnGeo, mountainMat);

      const x = (Math.random() - 0.5) * 180;
      const z = -50 - Math.random() * 40;
      mtn.position.set(x, 0.3 + height / 2, z);
      mtn.castShadow = true;
      mtn.receiveShadow = true;
      this.add(mtn);
    }
  }

  private createLakeBottom(): void {
    const bedGeo = this.trackGeo(new THREE.PlaneGeometry(200, 120));
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: this.config.lakeBottomColor,
      roughness: 0.95,
    }));
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -3, 60);
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
