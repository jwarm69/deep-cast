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

    // Layered wind waves plus a slow lake swell.
    float swell = sin(pos.z * 0.18 + uTime * 0.55) * 0.18;
    float wave1 = sin(pos.x * 0.8 + uTime * 0.6) * 0.13;
    float wave2 = sin(pos.z * 1.2 + uTime * 0.8) * 0.1;
    float wave3 = sin((pos.x + pos.z) * 0.5 + uTime * 0.4) * 0.08;
    float wave4 = sin(pos.x * 2.0 + pos.z * 1.5 + uTime * 1.2) * 0.04;

    pos.y += swell + wave1 + wave2 + wave3 + wave4;

    // Compute displaced normal for lighting
    float dx = 0.8 * cos(pos.x * 0.8 + uTime * 0.6) * 0.13
             + 0.5 * cos((pos.x + pos.z) * 0.5 + uTime * 0.4) * 0.08
             + 2.0 * cos(pos.x * 2.0 + pos.z * 1.5 + uTime * 1.2) * 0.04;
    float dz = 0.18 * cos(pos.z * 0.18 + uTime * 0.55) * 0.18
             + 1.2 * cos(pos.z * 1.2 + uTime * 0.8) * 0.1
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
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunColor;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // Cheap hash for the sparkle field.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 normal = normalize(vNormal);

    // Fresnel — more reflection at grazing angles
    float fresnel = clamp(pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0), 0.02, 1.0);

    // Fake depth by distance from shore: shallow near the dock, darker offshore.
    float offshore = smoothstep(5.0, 48.0, vWorldPos.z);
    vec3 waterColor = mix(uShallowColor, uDeepColor, offshore);

    // Reflected sky — uses the real sky gradient so water matches the dome.
    vec3 reflDir = reflect(-viewDir, normal);
    float skyT = clamp(reflDir.y * 1.2, 0.0, 1.0);
    vec3 skyRefl = mix(uSkyHorizon, uSkyTop, skyT);

    // Sun specular (sharp core)
    vec3 halfDir = normalize(viewDir + uSunDirection);
    float ndh = max(dot(normal, halfDir), 0.0);
    float spec = pow(ndh, 320.0);

    // Animated sun glitter — twinkling micro-highlights near the sun reflection.
    float glintMask = pow(ndh, 12.0);
    float tw = hash(floor(vWorldPos.xz * 3.0));
    float twinkle = pow(0.5 + 0.5 * sin(uTime * 3.0 + tw * 6.2831), 8.0);
    float glitter = glintMask * twinkle;

    // Crossed ripples, caustic shimmer, and shoreline/crest foam.
    float ripple = sin(vWorldPos.x * 1.7 + uTime * 1.4) * 0.5
                 + sin((vWorldPos.x + vWorldPos.z) * 0.9 - uTime * 1.1) * 0.5;
    float caustic = sin(vWorldPos.x * 3.0 + uTime) * sin(vWorldPos.z * 3.0 + uTime * 0.7) * 0.5 + 0.5;
    caustic = pow(caustic, 3.0) * mix(0.18, 0.05, offshore);
    float shoreMask = 1.0 - smoothstep(4.0, 12.0, vWorldPos.z);
    float foamBand = smoothstep(0.45, 0.95, abs(sin(vWorldPos.x * 1.35 + uTime * 1.8)));
    float crestFoam = smoothstep(0.03, 0.10, 1.0 - normal.y);
    float foam = max(shoreMask * foamBand * 0.5, crestFoam * 0.3);

    // Compose: body + caustic, sky reflection, sun, glitter, foam.
    vec3 color = waterColor + caustic;
    color = mix(color, skyRefl, fresnel * 0.6);
    color += ripple * 0.025;
    color += spec * uSunColor * 1.1;
    color += glitter * uSunColor * 0.9;
    color = mix(color, vec3(0.9, 0.97, 1.0), foam);

    // Atmosphere: distant water melts into the horizon sky colour.
    float dist = length(cameraPosition - vWorldPos);
    float horizonFade = smoothstep(70.0, 150.0, dist);
    color = mix(color, uSkyHorizon, horizonFade * 0.6);

    float alpha = mix(0.78, 0.95, offshore) + fresnel * 0.04;
    alpha = clamp(alpha + foam * 0.3 + horizonFade * 0.2, 0.0, 1.0);

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
        uSkyTop: { value: new THREE.Color(0x1a6eb5) },
        uSkyHorizon: { value: new THREE.Color(0xb3d9f2) },
        uSunColor: { value: new THREE.Color(0xfff9c4) },
      },
      transparent: true,
      depthWrite: false,
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
      Math.sin(z * 0.18 + t * 0.55) * 0.18 +
      Math.sin(x * 0.8 + t * 0.6) * 0.13 +
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
    this.material.uniforms.uSkyTop.value.set(config.skyTopColor);
    this.material.uniforms.uSkyHorizon.value.set(config.skyHorizonColor);
    this.material.uniforms.uSunColor.value.set(config.sunDiscColor);
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
