import * as THREE from 'three';
import { Component, Events, CatchData, FishSpecies } from '../core/types';
import { EventSystem } from '../core/EventSystem';

/**
 * Procedural 3D fish that jumps from the water on catch.
 * Builds a simple fish mesh (ellipsoid body + tail + fins) colored by species.
 */
export class CatchFish implements Component {
  private scene: THREE.Scene;
  private events: EventSystem;
  private group: THREE.Group;
  private isAnimating = false;

  // Animation state
  private animTime = 0;
  private animDuration = 2.0;
  private startPos = new THREE.Vector3();
  private peakHeight = 4.0;

  constructor(scene: THREE.Scene, events: EventSystem) {
    this.scene = scene;
    this.events = events;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  init(): void {
    this.events.on(Events.FISH_CAUGHT, (e) => {
      const data = e.data as CatchData;
      this.show(data);
    });
  }

  private buildFish(species: FishSpecies, weight: number): void {
    // Clear previous mesh
    while (this.group.children.length) {
      const child = this.group.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
      this.group.remove(child);
    }

    const color = new THREE.Color(species.color);
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1,
    });
    const finMat = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.7),
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Scale fish by weight — min 0.4, max 2.5
    const scale = 0.4 + Math.min(weight / 20, 1) * 2.1;

    // Body — scaled sphere (wider than tall/deep)
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      bodyMat,
    );
    body.scale.set(1.6 * scale, 0.7 * scale, 0.5 * scale);
    this.group.add(body);

    // Eye (right side)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), eyeMat);
    eye.position.set(0.55 * scale, 0.12 * scale, 0.22 * scale);
    this.group.add(eye);

    // Eye (left side)
    const eye2 = eye.clone();
    eye2.position.z = -0.22 * scale;
    this.group.add(eye2);

    // Tail — triangle shape
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.5 * scale, 0.4 * scale);
    tailShape.lineTo(-0.5 * scale, -0.4 * scale);
    tailShape.lineTo(0, 0);
    const tailGeo = new THREE.ShapeGeometry(tailShape);
    const tail = new THREE.Mesh(tailGeo, finMat);
    tail.position.x = -0.8 * scale;
    tail.rotation.y = Math.PI * 0.5;
    this.group.add(tail);

    // Dorsal fin (top)
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-0.2 * scale, 0.35 * scale);
    dorsalShape.lineTo(0.3 * scale, 0.15 * scale);
    dorsalShape.lineTo(0, 0);
    const dorsalGeo = new THREE.ShapeGeometry(dorsalShape);
    const dorsal = new THREE.Mesh(dorsalGeo, finMat);
    dorsal.position.set(0, 0.3 * scale, 0);
    dorsal.rotation.x = -Math.PI * 0.5;
    this.group.add(dorsal);

    // Pectoral fins (sides)
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.lineTo(0.2 * scale, -0.15 * scale);
    pectoralShape.lineTo(-0.1 * scale, -0.1 * scale);
    pectoralShape.lineTo(0, 0);
    const pGeo = new THREE.ShapeGeometry(pectoralShape);

    const finR = new THREE.Mesh(pGeo, finMat);
    finR.position.set(0.15 * scale, -0.1 * scale, 0.25 * scale);
    finR.rotation.x = -0.3;
    this.group.add(finR);

    const finL = new THREE.Mesh(pGeo.clone(), finMat);
    finL.position.set(0.15 * scale, -0.1 * scale, -0.25 * scale);
    finL.rotation.x = 0.3;
    this.group.add(finL);

    // Mouth — slight indent
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 * scale, 6, 6),
      mouthMat,
    );
    mouth.position.set(0.78 * scale, 0, 0);
    this.group.add(mouth);
  }

  show(data: CatchData): void {
    this.buildFish(data.species, data.weight);
    this.isAnimating = true;
    this.animTime = 0;
    this.group.visible = true;

    // Start at bobber position (we'll read from last known catch location)
    // Use a position slightly in front of the dock
    this.startPos.set(
      (Math.random() - 0.5) * 4,
      0.5,
      8 + Math.random() * 4,
    );
    this.group.position.copy(this.startPos);

    // Scale peak height by weight
    this.peakHeight = 3.0 + Math.min(data.weight / 10, 1) * 4.0;
  }

  /** Set the bobber position so fish jumps from right spot */
  setBobberPos(x: number, z: number): void {
    this.startPos.x = x;
    this.startPos.z = z;
  }

  update(dt: number): void {
    if (!this.isAnimating) return;

    this.animTime += dt;
    const t = Math.min(this.animTime / this.animDuration, 1);

    // Parabolic arc: y = 4*h*t*(1-t) where h = peak height
    const y = 4 * this.peakHeight * t * (1 - t);
    this.group.position.set(
      this.startPos.x,
      this.startPos.y + y,
      this.startPos.z,
    );

    // Rotate: flip forward
    this.group.rotation.z = t * Math.PI * 2;
    // Slight wobble
    this.group.rotation.y = Math.sin(t * Math.PI * 6) * 0.3;

    // Fade out in last 30%
    if (t > 0.7) {
      const fadeT = (t - 0.7) / 0.3;
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 1 - fadeT;
        }
      });
    }

    if (t >= 1) {
      this.isAnimating = false;
      this.group.visible = false;
      // Reset opacity
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.opacity = 1;
          mat.transparent = false;
        }
      });
    }
  }

  destroy(): void {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        (child.material as THREE.Material)?.dispose();
      }
    });
  }
}
