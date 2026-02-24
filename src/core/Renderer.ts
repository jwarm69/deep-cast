import * as THREE from 'three';
import { Component } from './types';

export class Renderer implements Component {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  private container: HTMLElement;
  private handleResize: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.handleResize = () => this.onResize();
  }

  init(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.handleResize);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /** Update sky background and fog for biome transitions */
  setBiomeAtmosphere(_skyColor: number, fogColor: number, fogDensity: number): void {
    // Use fogColor as background fallback — matches sky dome horizon for seamless blending
    (this.scene.background as THREE.Color).set(fogColor);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(fogColor);
    fog.density = fogDensity;
  }

  update(_dt: number): void {}

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
