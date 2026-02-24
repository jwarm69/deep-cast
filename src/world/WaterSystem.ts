import * as THREE from 'three';
import { Component } from '../core/types';
import { BiomeConfig } from '../data/biome-config';

const waterVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Layered sine waves for water displacement
    float wave1 = sin(pos.x * 0.8 + uTime * 0.6) * 0.15;
    float wave2 = sin(pos.z * 1.2 + uTime * 0.8) * 0.1;
    float wave3 = sin((pos.x + pos.z) * 0.5 + uTime * 0.4) * 0.08;
    float wave4 = sin(pos.x * 2.0 + pos.z * 1.5 + uTime * 1.2) * 0.04;

    pos.y += wave1 + wave2 + wave3 + wave4;

    // Compute displaced normal for lighting
    float dx = 0.8 * cos(pos.x * 0.8 + uTime * 0.6) * 0.15
             + 0.5 * cos((pos.x + pos.z) * 0.5 + uTime * 0.4) * 0.08
             + 2.0 * cos(pos.x * 2.0 + pos.z * 1.5 + uTime * 1.2) * 0.04;
    float dz = 1.2 * cos(pos.z * 1.2 + uTime * 0.8) * 0.1
             + 0.5 * cos((pos.x + pos.z) * 0.5 + uTime * 0.4) * 0.08
             + 1.5 * cos(pos.x * 2.0 + pos.z * 1.5 + uTime * 1.2) * 0.04;

    vNormal = normalize(vec3(-dx, 1.0, -dz));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 normal = normalize(vNormal);

    // Fresnel — more reflection at grazing angles
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

    // Depth-based color blend
    float depthFactor = smoothstep(-8.0, 2.0, vWorldPos.y);
    vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor);

    // Sun specular
    vec3 halfDir = normalize(viewDir + uSunDirection);
    float spec = pow(max(dot(normal, halfDir), 0.0), 256.0);

    // Caustic-like shimmer
    float caustic = sin(vWorldPos.x * 3.0 + uTime) * sin(vWorldPos.z * 3.0 + uTime * 0.7) * 0.5 + 0.5;
    caustic = pow(caustic, 3.0) * 0.15;

    vec3 skyColor = vec3(0.53, 0.81, 0.92);
    vec3 color = mix(waterColor + caustic, skyColor, fresnel * 0.4);
    color += spec * vec3(1.0, 0.95, 0.8) * 0.8;

    // Slight transparency near edges
    float alpha = mix(0.85, 0.95, fresnel);

    gl_FragColor = vec4(color, alpha);
  }
`;

export class WaterSystem implements Component {
  private scene: THREE.Scene;
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    // Water plane — expanded to match terrain so edges are never visible
    const geometry = new THREE.PlaneGeometry(200, 120, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x0a3d5c) },
        uShallowColor: { value: new THREE.Color(0x1a7a8a) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(0, -0.2, 60);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  /** Get the approximate wave height at (x, z) world position */
  getWaveHeight(x: number, z: number): number {
    const t = this.time;
    return (
      -0.2 +
      Math.sin(x * 0.8 + t * 0.6) * 0.15 +
      Math.sin(z * 1.2 + t * 0.8) * 0.1 +
      Math.sin((x + z) * 0.5 + t * 0.4) * 0.08 +
      Math.sin(x * 2.0 + z * 1.5 + t * 1.2) * 0.04
    );
  }

  /** Update water colors/sun for biome transitions */
  setConfig(config: BiomeConfig): void {
    this.material.uniforms.uDeepColor.value.set(config.waterDeepColor);
    this.material.uniforms.uShallowColor.value.set(config.waterShallowColor);
    this.material.uniforms.uSunDirection.value
      .set(...config.waterSunDirection)
      .normalize();
  }

  update(dt: number): void {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }

  destroy(): void {
    this.scene.remove(this.mesh);
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}
