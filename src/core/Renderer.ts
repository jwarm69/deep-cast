import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Component } from './types';

/**
 * Filmic grade applied in linear HDR, BEFORE the terminal OutputPass (which
 * owns tone mapping + sRGB). Gentle saturation lift plus a vignette that reads
 * as a soft exposure falloff toward the corners. No clamping here — clipping
 * would crush HDR highlights before they reach tone mapping.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.26 },
    uSaturation: { value: 1.07 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Saturation around perceptual luma
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      // Vignette as an exposure falloff: 1 at centre, dimmer at the corners
      float vig = smoothstep(0.85, 0.32, length(vUv - 0.5));
      c.rgb *= mix(1.0, vig, uVignette);
      gl_FragColor = c;
    }
  `,
};

export class Renderer implements Component {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  private container: HTMLElement;
  private handleResize: () => void;

  // Post-processing
  private composer: EffectComposer | null = null;
  private renderPass!: RenderPass;
  private bloomPass!: UnrealBloomPass;
  private usePost = false;

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
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.handleResize);

    this.setupPostProcessing();
  }

  /** Lower DPR on touch devices where the fill cost of bloom hurts most. */
  private targetPixelRatio(): number {
    const coarse =
      typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return Math.min(window.devicePixelRatio, coarse ? 1.5 : 2);
  }

  /**
   * Build the composer. Guarded: if anything fails (driver/float-target
   * limits) we silently fall back to a direct render so the game never goes
   * black over a cosmetic feature.
   */
  private setupPostProcessing(): void {
    try {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      // Keep MSAA edges through the offscreen target.
      this.composer.renderTarget1.samples = 4;
      this.composer.renderTarget2.samples = 4;

      // RenderPass camera is assigned per-frame in render().
      this.renderPass = new RenderPass(this.scene, new THREE.PerspectiveCamera());
      this.composer.addPass(this.renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        0.5, // strength — gentle dreamy glow on highlights only
        0.5, // radius
        0.85, // threshold — only sun/specular/foam highlights bloom
      );
      this.composer.addPass(this.bloomPass);

      // Grade runs in linear HDR, before the terminal pass.
      this.composer.addPass(new ShaderPass(GradeShader));

      // OutputPass is terminal: tone mapping (reads renderer.toneMapping) +
      // sRGB encoding, rendered to screen. Keeps colour management correct.
      this.composer.addPass(new OutputPass());

      this.usePost = true;
    } catch (err) {
      console.warn('[Renderer] post-processing unavailable, using direct render', err);
      this.composer = null;
      this.usePost = false;
    }
  }

  render(camera: THREE.Camera): void {
    if (this.usePost && this.composer) {
      this.renderPass.camera = camera;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, camera);
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.targetPixelRatio());
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      this.bloomPass.setSize(w, h);
    }
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
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
