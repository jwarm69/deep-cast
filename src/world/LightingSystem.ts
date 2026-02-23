import * as THREE from 'three';
import { Component } from '../core/types';
import { BiomeConfig } from '../data/biome-config';

export class LightingSystem implements Component {
  private scene: THREE.Scene;
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    // Ambient fill
    this.ambient = new THREE.AmbientLight(0x8ec7e8, 0.5);
    this.scene.add(this.ambient);

    // Hemisphere light for sky/ground color variation
    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5f0b, 0.4);
    this.scene.add(this.hemi);

    // Sun — directional light with shadows
    this.sun = new THREE.DirectionalLight(0xfff4e6, 1.4);
    this.sun.position.set(30, 40, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun);
  }

  /** Update all light params to match a biome config */
  setConfig(config: BiomeConfig): void {
    this.ambient.color.set(config.ambientColor);
    this.ambient.intensity = config.ambientIntensity;

    this.hemi.color.set(config.hemiSkyColor);
    this.hemi.groundColor.set(config.hemiGroundColor);
    this.hemi.intensity = config.hemiIntensity;

    this.sun.color.set(config.sunColor);
    this.sun.intensity = config.sunIntensity;
    this.sun.position.set(...config.sunPosition);
  }

  update(_dt: number): void {}

  destroy(): void {
    // Lights are removed when scene is cleared
  }
}
