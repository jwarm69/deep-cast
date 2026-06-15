import * as THREE from 'three';
import { Component } from '../core/types';
import { BiomeConfig, BIOME_CONFIGS } from '../data/biome-config';

export class SkySystem implements Component {
  private scene: THREE.Scene;
  private objects: THREE.Object3D[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private cloudGroups: THREE.Group[] = [];
  private config: BiomeConfig;

  constructor(scene: THREE.Scene, config?: BiomeConfig) {
    this.scene = scene;
    this.config = config ?? BIOME_CONFIGS.lake;
  }

  init(): void {
    this.createSkyDome();
    this.createSunGlow();
    this.createSunDisc();
    this.createClouds();
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

  private createSkyDome(): void {
    const geo = this.trackGeo(new THREE.SphereGeometry(200, 32, 16));
    geo.scale(-1, 1, -1); // Invert normals to render inside

    // Vertex-color gradient: horizon color at y=0, top color at zenith
    const topColor = new THREE.Color(this.config.skyTopColor);
    const horizonColor = new THREE.Color(this.config.skyHorizonColor);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = Math.max(0, y / 200); // 0 at equator, 1 at top
      const color = new THREE.Color().copy(horizonColor).lerp(topColor, t);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = this.trackMat(new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: false,
      depthWrite: false,
      side: THREE.BackSide,
    }));

    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -1;
    this.add(dome);
  }

  /** Radial gradient used for the soft sun halo. */
  private makeGlowTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Soft additive halo around the sun — gives the sky a glowing light source. */
  private createSunGlow(): void {
    const tex = this.makeGlowTexture();
    this.textures.push(tex);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: this.config.sunDiscColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(mat);

    const sprite = new THREE.Sprite(mat);
    const dir = new THREE.Vector3(...this.config.sunPosition).normalize();
    sprite.position.copy(dir.multiplyScalar(178));
    const glowSize = this.config.sunDiscSize * 11;
    sprite.scale.set(glowSize, glowSize, 1);
    this.add(sprite);
  }

  private createSunDisc(): void {
    const geo = this.trackGeo(new THREE.SphereGeometry(this.config.sunDiscSize, 16, 12));
    const mat = this.trackMat(new THREE.MeshBasicMaterial({
      color: this.config.sunDiscColor,
      fog: false,
    }));

    const sun = new THREE.Mesh(geo, mat);
    // Position sun along the sunPosition direction, scaled to dome radius
    const dir = new THREE.Vector3(...this.config.sunPosition).normalize();
    sun.position.copy(dir.multiplyScalar(180));
    this.add(sun);
  }

  private createClouds(): void {
    const mat = this.trackMat(new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.config.cloudOpacity,
      fog: false,
      depthWrite: false,
    }));

    // Two-tone shading derived from each biome's own cloud colour: lit crowns,
    // darker undersides. Stays correct for bright and overcast/dark skies alike.
    const base = new THREE.Color(this.config.cloudColor);
    const litTop = base.clone().multiplyScalar(1.18);
    const shadeBottom = base.clone().multiplyScalar(0.72);

    for (let i = 0; i < this.config.cloudCount; i++) {
      const cluster = new THREE.Group();
      const puffCount = 3 + Math.floor(Math.random() * 3); // 3-5 puffs

      for (let p = 0; p < puffCount; p++) {
        const radius = 3 + Math.random() * 3;
        const puffGeo = this.trackGeo(new THREE.SphereGeometry(radius, 8, 6));

        // Bake a vertical gradient: bright at the top, shaded underneath.
        const posAttr = puffGeo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        for (let v = 0; v < posAttr.count; v++) {
          const t = THREE.MathUtils.clamp(posAttr.getY(v) / radius * 0.5 + 0.5, 0, 1);
          const c = shadeBottom.clone().lerp(litTop, t);
          colors[v * 3] = c.r;
          colors[v * 3 + 1] = c.g;
          colors[v * 3 + 2] = c.b;
        }
        puffGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const puff = new THREE.Mesh(puffGeo, mat);
        puff.position.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 4,
        );
        puff.scale.y = 0.35 + Math.random() * 0.2;
        cluster.add(puff);
      }

      cluster.position.set(
        (Math.random() - 0.5) * 300,
        this.config.cloudAltitude + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 200,
      );

      this.cloudGroups.push(cluster);
      this.add(cluster);
    }
  }

  update(dt: number): void {
    const speed = this.config.cloudDriftSpeed;
    for (const cloud of this.cloudGroups) {
      cloud.position.x += speed * dt;
      if (cloud.position.x > 180) {
        cloud.position.x = -180;
      }
    }
  }

  rebuild(config: BiomeConfig): void {
    this.destroy();
    this.config = config;
    this.init();
  }

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
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.objects = [];
    this.geometries = [];
    this.materials = [];
    this.textures = [];
    this.cloudGroups = [];
  }
}
