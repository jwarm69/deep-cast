import * as THREE from 'three';
import { Component } from '../core/types';

/**
 * Fishing line — a curved line from the rod tip to the bobber.
 * Uses quadratic bezier (catenary approximation) with a sag control point.
 */
export class FishingLine implements Component {
  private scene: THREE.Scene;
  private line!: THREE.Line;
  private material!: THREE.LineBasicMaterial;
  private geometry!: THREE.BufferGeometry;
  private visible = false;

  public startPoint = new THREE.Vector3();
  public endPoint = new THREE.Vector3();

  private readonly segments = 24;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    this.material = new THREE.LineBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.7,
    });

    const positions = new Float32Array((this.segments + 1) * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.visible = false;
    this.line.frustumCulled = false;
    this.scene.add(this.line);
  }

  show(): void {
    this.visible = true;
    this.line.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.line.visible = false;
  }

  update(_dt: number): void {
    if (!this.visible) return;

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;

    // Catenary approximation: quadratic bezier with sag
    const mid = new THREE.Vector3().lerpVectors(this.startPoint, this.endPoint, 0.5);
    const dist = this.startPoint.distanceTo(this.endPoint);
    const sag = Math.min(dist * 0.15, 2.0);
    mid.y -= sag;

    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const invT = 1 - t;

      // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const x = invT * invT * this.startPoint.x + 2 * invT * t * mid.x + t * t * this.endPoint.x;
      const y = invT * invT * this.startPoint.y + 2 * invT * t * mid.y + t * t * this.endPoint.y;
      const z = invT * invT * this.startPoint.z + 2 * invT * t * mid.z + t * t * this.endPoint.z;

      posAttr.setXYZ(i, x, y, z);
    }

    posAttr.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  destroy(): void {
    this.scene.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
  }
}
