import * as THREE from 'three';
import { Component } from '../core/types';
import { WaterSystem } from '../world/WaterSystem';
import { RippleSystem } from '../effects/RippleSystem';

interface FishEntry {
  group: THREE.Group;
  tail: THREE.Mesh;
  baseX: number;
  baseZ: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  depth: number;
}

export class AmbientFish implements Component {
  private scene: THREE.Scene;
  private water: WaterSystem;
  private fish: FishEntry[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private time = 0;
  private ripples: RippleSystem | null = null;
  private clueTimer = 0;

  constructor(scene: THREE.Scene, water: WaterSystem) {
    this.scene = scene;
    this.water = water;
  }

  init(): void {
    const colors = [0x7dd3fc, 0xa7f3d0, 0xfca5a5, 0xfef08a, 0xc4b5fd, 0xf9a8d4];
    for (let i = 0; i < 30; i++) {
      this.createFish(colors[i % colors.length], i);
    }
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private createFish(colorValue: number, index: number): void {
    const color = new THREE.Color(colorValue);
    const bodyMat = this.trackMat(new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }));
    const finMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.72),
      roughness: 0.5,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    const eyeMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.3,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }));

    const scale = 0.55 + Math.random() * 0.75;
    const group = new THREE.Group();

    const body = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.24, 16, 10)), bodyMat);
    body.scale.set(0.75 * scale, 0.38 * scale, 1.45 * scale);
    group.add(body);

    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.26 * scale, 0.24 * scale);
    tailShape.lineTo(0.24 * scale, 0);
    tailShape.lineTo(-0.26 * scale, -0.24 * scale);
    tailShape.lineTo(0, 0);
    const tail = new THREE.Mesh(this.trackGeo(new THREE.ShapeGeometry(tailShape)), finMat);
    tail.position.z = -0.36 * scale;
    group.add(tail);

    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-0.16 * scale, 0.24 * scale);
    dorsalShape.lineTo(0.2 * scale, 0.08 * scale);
    dorsalShape.lineTo(0, 0);
    const dorsal = new THREE.Mesh(this.trackGeo(new THREE.ShapeGeometry(dorsalShape)), finMat);
    dorsal.position.set(0, 0.18 * scale, -0.05 * scale);
    dorsal.rotation.x = Math.PI * 0.5;
    group.add(dorsal);

    const eyeGeo = this.trackGeo(new THREE.SphereGeometry(0.025 * scale, 6, 6));
    for (const x of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x * scale, 0.06 * scale, 0.36 * scale);
      group.add(eye);
    }

    const baseZ = 9 + Math.random() * 86;
    const entry: FishEntry = {
      group,
      tail,
      baseX: -32 + Math.random() * 64,
      baseZ,
      radiusX: 3 + Math.random() * 10,
      radiusZ: 2 + Math.random() * 7,
      speed: 0.18 + Math.random() * 0.34,
      phase: index * 0.77 + Math.random() * Math.PI * 2,
      depth: 0.65 + Math.random() * 1.9,
    };

    this.fish.push(entry);
    this.scene.add(group);
  }

  /** Wire the ripple system so shallow schools leave surface clues */
  setRipples(ripples: RippleSystem): void {
    this.ripples = ripples;
  }

  update(dt: number): void {
    this.time += dt;

    // Surface clue: a shallow fish occasionally disturbs the water
    if (this.ripples) {
      this.clueTimer -= dt;
      if (this.clueTimer <= 0) {
        this.clueTimer = 2.5 + Math.random() * 3;
        const shallow = this.fish.filter((f) => f.depth < 1.2);
        if (shallow.length > 0) {
          const f = shallow[Math.floor(Math.random() * shallow.length)];
          this.ripples.spawn(f.group.position.x, f.group.position.z, {
            scale: 1.0, life: 1.4, opacity: 0.3,
          });
        }
      }
    }

    for (const entry of this.fish) {
      const t = this.time * entry.speed + entry.phase;
      const x = entry.baseX + Math.cos(t) * entry.radiusX;
      const z = entry.baseZ + Math.sin(t * 0.82) * entry.radiusZ;
      const y = this.water.getWaveHeight(x, z) - entry.depth;

      const dx = -Math.sin(t) * entry.radiusX;
      const dz = Math.cos(t * 0.82) * entry.radiusZ * 0.82;

      entry.group.position.set(x, y, z);
      entry.group.rotation.y = Math.atan2(dx, dz);
      entry.group.rotation.z = Math.sin(t * 1.7) * 0.08;
      entry.tail.rotation.y = Math.sin(t * 8.0) * 0.48;
    }
  }

  destroy(): void {
    for (const entry of this.fish) {
      this.scene.remove(entry.group);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.fish = [];
    this.geometries = [];
    this.materials = [];
  }
}
