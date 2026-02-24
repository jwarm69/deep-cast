import * as THREE from 'three';
import { Component } from './types';
import { InputManager } from './InputManager';

/**
 * Third-person follow camera using spherical coordinates.
 * Left-click drag to orbit, scroll to zoom, smooth lerp follow.
 */
export class Camera implements Component {
  public camera: THREE.PerspectiveCamera;
  private input: InputManager;

  // Spherical coordinates around target
  public theta = Math.PI * 0.25; // horizontal angle (public so character can read facing)
  private phi = Math.PI * 0.3;    // vertical angle (from top)
  private radius = 18;

  // Limits
  private readonly minPhi = 0.1;
  private readonly maxPhi = Math.PI * 0.48;
  private readonly minRadius = 8;
  private readonly maxRadius = 40;

  // Follow target (updated externally each frame)
  private target = new THREE.Vector3(0, 1, 0);
  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  private handleResize: () => void;

  constructor(input: InputManager) {
    this.input = input;
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );

    this.handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };

    // Compute initial position
    this.updatePosition();
    this.currentPosition.copy(this.camera.position);
    this.currentLookAt.copy(this.target);
  }

  init(): void {
    window.addEventListener('resize', this.handleResize);
  }

  setTarget(pos: THREE.Vector3): void {
    this.target.copy(pos);
  }

  private updatePosition(): void {
    const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z,
    );
  }

  update(dt: number): void {
    // Orbit with left-click drag
    if (this.input.mouseDown) {
      const { dx, dy } = this.input.consumeMouseDelta();
      this.theta += dx * 0.005;
      this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi - dy * 0.005));
    } else {
      this.input.consumeMouseDelta(); // drain
    }

    // Zoom with scroll
    const scroll = this.input.consumeScrollDelta();
    if (scroll !== 0) {
      this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + scroll * 0.01));
    }

    // Compute desired position
    this.updatePosition();

    // Smooth lerp
    const lerpFactor = 1 - Math.pow(0.01, dt);
    this.currentPosition.lerp(this.camera.position, lerpFactor);
    this.currentLookAt.lerp(this.target, lerpFactor);

    this.camera.position.copy(this.currentPosition);

    // Apply screen shake offset
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const decay = Math.max(0, this.shakeTimer / this.shakeDuration);
      const intensity = this.shakeIntensity * decay;
      this.camera.position.x += (Math.random() - 0.5) * intensity;
      this.camera.position.y += (Math.random() - 0.5) * intensity;
      this.camera.position.z += (Math.random() - 0.5) * intensity * 0.5;
    }

    this.camera.lookAt(this.currentLookAt);
  }

  /** Trigger a screen shake effect */
  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
  }
}
