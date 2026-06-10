import * as THREE from 'three';
import { Component } from '../core/types';

/**
 * BiteIndicator — a bold "!" billboard that pops above the bobber when a fish bites.
 */
export class BiteIndicator implements Component {
  private scene: THREE.Scene;
  private sprite!: THREE.Sprite;
  private material!: THREE.SpriteMaterial;
  private texture!: THREE.CanvasTexture;
  private visible = false;
  private age = 0;
  private baseY = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Yellow circle badge with a dark "!"
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();

    ctx.fillStyle = '#1c1917';
    ctx.font = '900 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 64, 70);

    this.texture = new THREE.CanvasTexture(canvas);
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.visible = false;
    this.sprite.renderOrder = 10;
    this.scene.add(this.sprite);
  }

  show(x: number, y: number, z: number): void {
    this.visible = true;
    this.age = 0;
    this.baseY = y + 1.0;
    this.sprite.position.set(x, this.baseY, z);
    this.sprite.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.sprite.visible = false;
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.age += dt;

    // Pop in, then pulse urgently
    const popIn = Math.min(1, this.age * 6);
    const overshoot = 1 + Math.sin(Math.min(1, this.age * 6) * Math.PI) * 0.35;
    const pulse = 1 + Math.sin(this.age * 10) * 0.08;
    const s = 1.1 * popIn * overshoot * pulse;
    this.sprite.scale.set(s, s, 1);
    this.sprite.position.y = this.baseY + Math.sin(this.age * 5) * 0.08;
  }

  destroy(): void {
    this.scene.remove(this.sprite);
    this.material.dispose();
    this.texture.dispose();
  }
}
