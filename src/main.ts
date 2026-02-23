import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Events } from './core/types';
import { WaterSystem } from './world/WaterSystem';
import { TerrainSystem } from './world/TerrainSystem';
import { LightingSystem } from './world/LightingSystem';
import { Character } from './entities/Character';
import { FishingRod } from './entities/FishingRod';
import { FishingLine } from './entities/FishingLine';
import { Bobber } from './entities/Bobber';
import { CatchFish } from './entities/CatchFish';
import { FishingStateMachine } from './fishing/FishingStateMachine';
import { PlayerState } from './state/PlayerState';
import { SoundSystem } from './audio/SoundSystem';
import { ParticleSystem, FX } from './effects/ParticleSystem';
import { GameUI } from './ui/GameUI';
import { ShopUI } from './ui/ShopUI';
import { JournalUI } from './ui/JournalUI';
import { BIOME_CONFIGS, TerrainType } from './data/biome-config';
import { FISH_BY_TERRAIN } from './data/fish-species';

async function main() {
  const container = document.getElementById('game-container')!;
  const engine = new Engine(container);
  await engine.init();

  const scene = engine.scene;

  // World systems
  const lighting = new LightingSystem(scene);
  lighting.init();
  engine.addComponent(lighting);

  const terrainSystem = new TerrainSystem(scene);
  terrainSystem.init();
  engine.addComponent(terrainSystem);

  const water = new WaterSystem(scene);
  water.init();
  engine.addComponent(water);

  // Entities
  const character = new Character(scene, terrainSystem.characterPosition, engine.input);
  character.init();
  engine.addComponent(character);

  const rod = new FishingRod(scene);
  rod.init();
  engine.addComponent(rod);

  const line = new FishingLine(scene);
  line.init();
  engine.addComponent(line);

  const bobber = new Bobber(scene, water);
  bobber.init();
  engine.addComponent(bobber);

  // Position rod on character + sync camera -> character each frame
  const originalRodUpdate = rod.update.bind(rod);
  rod.update = (dt: number) => {
    rod.setBasePosition(character.rodAttachPoint);
    originalRodUpdate(dt);
  };

  // Camera follows character
  const originalCameraUpdate = engine.camera.update.bind(engine.camera);
  engine.camera.update = (dt: number) => {
    const charPos = character.group.position;
    engine.camera.setTarget(charPos.clone().setY(charPos.y + 2.0));
    character.setCameraTheta(engine.camera.theta);
    originalCameraUpdate(dt);
  };

  // Effects
  const particles = new ParticleSystem(scene);
  particles.init();
  engine.addComponent(particles);

  const catchFish = new CatchFish(scene, engine.events);
  catchFish.init();
  engine.addComponent(catchFish);

  const sound = new SoundSystem(engine.events);
  sound.init();
  engine.addComponent(sound);

  // Player state (progression, equipment, journal, persistence)
  const player = new PlayerState(engine.events);
  player.init();
  engine.addComponent(player);

  // Fishing state machine
  const fsm = new FishingStateMachine(
    engine.events,
    engine.input,
    bobber,
    line,
    rod,
  );
  fsm.setPlayerState(player);
  engine.addComponent(fsm);

  // --- Biome system ---

  function applyBiome(terrain: TerrainType): void {
    const config = BIOME_CONFIGS[terrain];

    // Atmosphere (sky + fog)
    engine.renderer.setBiomeAtmosphere(config.skyColor, config.fogColor, config.fogDensity);

    // Lighting
    lighting.setConfig(config);

    // Water
    water.setConfig(config);

    // Terrain — full destroy/rebuild
    terrainSystem.rebuild(config);

    // Fish pool
    fsm.setFishPool(FISH_BY_TERRAIN[terrain]);

    // Reposition character on dock
    character.group.position.copy(terrainSystem.characterPosition);
  }

  // Apply saved biome on startup
  applyBiome(player.currentTerrain);

  // Listen for biome changes (from shop travel)
  engine.events.on(Events.BIOME_CHANGE, (e) => {
    applyBiome(e.data.terrain as TerrainType);
  });

  // --- Wire particle/shake effects to events ---

  // Track bobber position for effects
  let lastBobberPos = new THREE.Vector3(0, 0.5, 10);

  engine.events.on(Events.BOBBER_LAND, () => {
    lastBobberPos.set(bobber.position.x, 0.3, bobber.position.z);
    FX.splash(lastBobberPos, particles);
  });

  engine.events.on(Events.FISH_BITE, () => {
    const bitePos = new THREE.Vector3(bobber.position.x, 0.5, bobber.position.z);
    FX.biteBubbles(bitePos, particles);
    engine.camera.shake(0.15, 0.3); // Light shake on bite
  });

  engine.events.on(Events.FISH_CAUGHT, (e) => {
    const pos = new THREE.Vector3(bobber.position.x, 0.5, bobber.position.z);
    const speciesColor = new THREE.Color(e.data.species.color);
    FX.catchSparkle(pos, particles, speciesColor);
    engine.camera.shake(0.4, 0.5); // Strong shake on catch
    catchFish.setBobberPos(pos.x, pos.z);
  });

  engine.events.on(Events.LEVEL_UP, () => {
    const charPos = character.group.position.clone();
    charPos.y += 2;
    FX.levelUpBurst(charPos, particles);
    engine.camera.shake(0.3, 0.6);
  });

  // Update reel sound pitch each frame while reeling
  const originalFsmUpdate = fsm.update.bind(fsm);
  fsm.update = (dt: number) => {
    originalFsmUpdate(dt);
    if (fsm.currentReelProgress > 0 && fsm.state === 'reeling') {
      sound.updateReelPitch(fsm.currentReelProgress);
    }
  };

  // UI
  const ui = new GameUI(engine.events, fsm, player);
  ui.init();
  engine.addComponent(ui);

  const shop = new ShopUI(engine.events, engine.input, player, fsm);
  shop.init();
  engine.addComponent(shop);

  const journal = new JournalUI(engine.events, engine.input, player);
  journal.init();
  engine.addComponent(journal);

  // Start the game loop
  engine.start();
}

main().catch(console.error);
