import * as THREE from 'three';
import { Component } from '../core/types';

const MAX_PARTICLES = 400;

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number; a: number;
  size: number;
  gravity: number;
}

export interface EmitConfig {
  count: number;
  color: THREE.Color;
  spread: number;       // velocity spread
  upward: number;       // upward velocity bias
  life: number;         // base life in seconds
  lifeVar: number;      // life variance
  size: number;         // particle size
  gravity: number;      // gravity pull (positive = down)
}

export class ParticleSystem implements Component {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private points!: THREE.Points;
  private positions!: Float32Array;
  private sizes!: Float32Array;
  private alphas!: Float32Array;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.ShaderMaterial;

  // We use a single color uniform — for multi-color bursts we update between draws
  // Simpler: store per-particle color and use vertex colors
  private colors!: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    // Initialize particle pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false, life: 0, maxLife: 1,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        r: 1, g: 1, b: 1, a: 1, size: 1, gravity: 0,
      });
    }

    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.colors = new Float32Array(MAX_PARTICLES * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 color;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float alpha = vAlpha * (1.0 - d * d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /** Emit a burst of particles at a world position */
  emit(origin: THREE.Vector3, config: EmitConfig): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= config.count) break;
      if (p.active) continue;

      p.active = true;
      p.x = origin.x;
      p.y = origin.y;
      p.z = origin.z;

      // Random velocity in sphere + upward bias
      const angle = Math.random() * Math.PI * 2;
      const elevation = Math.random() * Math.PI - Math.PI * 0.3;
      const speed = config.spread * (0.5 + Math.random() * 0.5);
      p.vx = Math.cos(angle) * Math.cos(elevation) * speed;
      p.vy = Math.sin(elevation) * speed + config.upward;
      p.vz = Math.sin(angle) * Math.cos(elevation) * speed;

      p.life = config.life + (Math.random() - 0.5) * config.lifeVar;
      p.maxLife = p.life;
      p.size = config.size * (0.7 + Math.random() * 0.6);
      p.gravity = config.gravity;

      p.r = config.color.r;
      p.g = config.color.g;
      p.b = config.color.b;
      p.a = 1;

      spawned++;
    }
  }

  update(dt: number): void {
    let activeCount = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        // Park inactive particles off-screen
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -100;
        this.positions[i * 3 + 2] = 0;
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        continue;
      }

      // Physics
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = p.life / p.maxLife; // 1 at birth → 0 at death
      p.a = t;

      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.alphas[i] = p.a;
      this.sizes[i] = p.size * (0.5 + t * 0.5); // shrink as they die
      this.colors[i * 3] = p.r;
      this.colors[i * 3 + 1] = p.g;
      this.colors[i * 3 + 2] = p.b;

      activeCount++;
    }

    // Update GPU buffers
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sizeAttr = this.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alphaAttr = this.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const colorAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  destroy(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}

// --- Pre-configured effect presets ---

export const FX = {
  splash: (pos: THREE.Vector3, particles: ParticleSystem) => {
    particles.emit(pos, {
      count: 30,
      color: new THREE.Color(0.6, 0.85, 1.0),
      spread: 3.0,
      upward: 4.0,
      life: 0.6,
      lifeVar: 0.3,
      size: 3.0,
      gravity: 8.0,
    });
    // Secondary mist ring
    particles.emit(pos, {
      count: 15,
      color: new THREE.Color(0.8, 0.9, 1.0),
      spread: 2.0,
      upward: 1.0,
      life: 0.8,
      lifeVar: 0.2,
      size: 4.0,
      gravity: 1.0,
    });
  },

  catchSparkle: (pos: THREE.Vector3, particles: ParticleSystem, color: THREE.Color) => {
    particles.emit(pos, {
      count: 40,
      color,
      spread: 2.5,
      upward: 5.0,
      life: 1.0,
      lifeVar: 0.4,
      size: 3.5,
      gravity: 2.0,
    });
    // Gold shimmer
    particles.emit(pos, {
      count: 20,
      color: new THREE.Color(1.0, 0.85, 0.3),
      spread: 1.5,
      upward: 6.0,
      life: 1.2,
      lifeVar: 0.3,
      size: 2.5,
      gravity: 1.5,
    });
  },

  biteBubbles: (pos: THREE.Vector3, particles: ParticleSystem) => {
    particles.emit(pos, {
      count: 12,
      color: new THREE.Color(0.7, 0.9, 1.0),
      spread: 0.8,
      upward: 2.0,
      life: 0.8,
      lifeVar: 0.3,
      size: 2.0,
      gravity: -1.0, // float up
    });
  },

  levelUpBurst: (pos: THREE.Vector3, particles: ParticleSystem) => {
    particles.emit(pos, {
      count: 60,
      color: new THREE.Color(1.0, 0.85, 0.2),
      spread: 4.0,
      upward: 7.0,
      life: 1.5,
      lifeVar: 0.5,
      size: 4.0,
      gravity: 2.0,
    });
    particles.emit(pos, {
      count: 30,
      color: new THREE.Color(1.0, 1.0, 1.0),
      spread: 2.0,
      upward: 8.0,
      life: 1.2,
      lifeVar: 0.3,
      size: 2.5,
      gravity: 1.0,
    });
  },
};
