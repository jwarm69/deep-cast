import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Events, PlayerMode, FishingState } from './core/types';
import { WaterSystem } from './world/WaterSystem';
import { TerrainSystem } from './world/TerrainSystem';
import { SkySystem } from './world/SkySystem';
import { LightingSystem } from './world/LightingSystem';
import { DeepWaterMarker } from './world/DeepWaterMarker';
import { Character } from './entities/Character';
import { FishingRod } from './entities/FishingRod';
import { FishingLine } from './entities/FishingLine';
import { Bobber } from './entities/Bobber';
import { Boat } from './entities/Boat';
import { CatchFish } from './entities/CatchFish';
import { FishingStateMachine } from './fishing/FishingStateMachine';
import { PlayerState } from './state/PlayerState';
import { SoundSystem } from './audio/SoundSystem';
import { ParticleSystem, FX } from './effects/ParticleSystem';
import { GameUI } from './ui/GameUI';
import { ShopUI } from './ui/ShopUI';
import { JournalUI } from './ui/JournalUI';
import { MobileControls } from './ui/MobileControls';
import { BIOME_CONFIGS, TerrainType } from './data/biome-config';
import { FISH_BY_TERRAIN, DEEP_FISH_BY_TERRAIN } from './data/fish-species';
import { createBackendClient } from './backend/createBackendClient';
import { MultiplayerBridge } from './multiplayer/MultiplayerBridge';
import { findFishingSpot } from './multiplayer/fishing-spots';

async function main() {
  const container = document.getElementById('game-container')!;
  const engine = new Engine(container);
  await engine.init();

  const scene = engine.scene;

  // World systems
  const lighting = new LightingSystem(scene);
  lighting.init();
  engine.addComponent(lighting);

  const sky = new SkySystem(scene);
  sky.init();
  engine.addComponent(sky);

  const terrainSystem = new TerrainSystem(scene);
  terrainSystem.init();
  engine.addComponent(terrainSystem);

  const water = new WaterSystem(scene);
  water.init();
  engine.addComponent(water);

  // Deep water marker (buoy line + overlay)
  let deepMarker = new DeepWaterMarker(scene, water);
  deepMarker.init();
  engine.addComponent(deepMarker);

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

  // Boat entity
  const boat = new Boat(scene, water, engine.input);
  boat.init();
  engine.addComponent(boat);

  // --- Player mode state ---
  let playerMode = PlayerMode.SHORE;
  let wasEDown = false;
  let wasInDeepWater = false;

  // Position rod on character OR boat + sync camera each frame
  const originalRodUpdate = rod.update.bind(rod);
  rod.update = (dt: number) => {
    if (playerMode === PlayerMode.BOAT) {
      rod.setBasePosition(boat.rodAttachPoint);
    } else {
      rod.setBasePosition(character.rodAttachPoint);
    }
    originalRodUpdate(dt);
  };

  // Camera follows character (shore) or boat (boat mode)
  const originalCameraUpdate = engine.camera.update.bind(engine.camera);
  engine.camera.update = (dt: number) => {
    if (playerMode === PlayerMode.BOAT) {
      const boatPos = boat.worldPosition;
      engine.camera.setTarget(boatPos.clone().setY(boatPos.y + 2.0));
      boat.setCameraTheta(engine.camera.theta);
    } else {
      const charPos = character.group.position;
      engine.camera.setTarget(charPos.clone().setY(charPos.y + 2.0));
      character.setCameraTheta(engine.camera.theta);
    }
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

  // Multiplayer bridge (local by default; switch to Supabase with env vars)
  const backend = createBackendClient();
  const multiplayer = new MultiplayerBridge(engine.events, backend, () => {
    const worldPos = playerMode === PlayerMode.BOAT ? boat.worldPosition : character.group.position;
    const spot = findFishingSpot(
      player.currentTerrain,
      worldPos.x,
      worldPos.z,
      playerMode,
      wasInDeepWater,
    );

    return {
      terrain: player.currentTerrain,
      mode: playerMode,
      position: {
        x: worldPos.x,
        y: worldPos.y,
        z: worldPos.z,
      },
      isDeepWater: wasInDeepWater,
      spotId: spot?.id ?? null,
    };
  });
  await multiplayer.init();
  engine.addComponent(multiplayer);

  // --- Biome system ---

  function applyBiome(terrain: TerrainType): void {
    const config = BIOME_CONFIGS[terrain];

    // Atmosphere (sky + fog)
    engine.renderer.setBiomeAtmosphere(config.skyColor, config.fogColor, config.fogDensity);

    // Lighting
    lighting.setConfig(config);

    // Water
    water.setConfig(config);

    // Sky dome — rebuild for new biome colors/clouds
    sky.rebuild(config);

    // Terrain — full destroy/rebuild
    terrainSystem.rebuild(config);

    // Deep water marker — destroy and recreate
    deepMarker.destroy();
    deepMarker = new DeepWaterMarker(scene, water);
    deepMarker.init();

    // Fish pools
    fsm.setFishPool(FISH_BY_TERRAIN[terrain]);
    fsm.setDeepFishPool(DEEP_FISH_BY_TERRAIN[terrain]);

    // If currently on boat, keep boat mode; otherwise reset to shore
    if (playerMode === PlayerMode.BOAT) {
      // Boat stays at current position, deep marker rebuilt
    } else {
      // Reposition character on dock
      character.group.position.copy(terrainSystem.characterPosition);
    }

    // Update boat model if equipped
    if (player.activeBoat) {
      boat.setBoatData(player.activeBoat);
    }
  }

  // When a boat is equipped, update the boat entity model
  engine.events.on(Events.BOAT_EQUIPPED, () => {
    if (player.activeBoat) {
      boat.setBoatData(player.activeBoat);
    }
  });

  // Apply saved biome on startup
  applyBiome(player.currentTerrain);

  // Set initial boat model
  if (player.activeBoat) {
    boat.setBoatData(player.activeBoat);
  }

  // Listen for biome changes (from shop travel)
  engine.events.on(Events.BIOME_CHANGE, (e) => {
    // If on boat, disembark first
    if (playerMode === PlayerMode.BOAT) {
      playerMode = PlayerMode.SHORE;
      boat.hide();
      character.group.visible = true;
      wasInDeepWater = false;
      fsm.setDeepWater(false);
      engine.events.emit(Events.DISEMBARK_BOAT);
    }
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
    const effectPos = playerMode === PlayerMode.BOAT
      ? boat.worldPosition.clone()
      : character.group.position.clone();
    effectPos.y += 2;
    FX.levelUpBurst(effectPos, particles);
    engine.camera.shake(0.3, 0.6);
  });

  // --- Board / Disembark helper (shared by keyboard E + mobile button) ---
  function toggleBoard(): void {
    if (playerMode === PlayerMode.SHORE) {
      const charPos = character.group.position;
      const nearDockEnd = Math.abs(charPos.x) < 3 && charPos.z >= 1 && charPos.z <= 5;
      if (nearDockEnd && player.activeBoat) {
        playerMode = PlayerMode.BOAT;
        character.group.visible = false;
        boat.setBoatData(player.activeBoat);
        boat.showAtDock();
        boat.startSailing();
        engine.events.emit(Events.BOARD_BOAT);
      }
    } else {
      playerMode = PlayerMode.SHORE;
      boat.stopSailing();
      boat.hide();
      character.group.position.copy(terrainSystem.characterPosition);
      character.group.visible = true;
      wasInDeepWater = false;
      fsm.setDeepWater(false);
      engine.events.emit(Events.DISEMBARK_BOAT);
    }
  }

  // Update reel sound pitch each frame while reeling
  // Also handle board/disembark and deep water detection
  const originalFsmUpdate = fsm.update.bind(fsm);
  fsm.update = (dt: number) => {
    originalFsmUpdate(dt);
    if (fsm.currentReelProgress > 0 && fsm.state === 'reeling') {
      sound.updateReelPitch(fsm.currentReelProgress);
    }

    // --- Board / Disembark controller ---
    const eDown = engine.input.isKeyDown('e');
    const ePressed = eDown && !wasEDown;
    wasEDown = eDown;

    if (ePressed && fsm.state === FishingState.IDLE) {
      toggleBoard();
    }

    // --- Deep water detection ---
    if (playerMode === PlayerMode.BOAT) {
      const inDeep = boat.isInDeepWater;
      if (inDeep && !wasInDeepWater) {
        wasInDeepWater = true;
        fsm.setDeepWater(true);
        engine.events.emit(Events.ENTER_DEEP_WATER);
      } else if (!inDeep && wasInDeepWater) {
        wasInDeepWater = false;
        fsm.setDeepWater(false);
        engine.events.emit(Events.LEAVE_DEEP_WATER);
      }
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

  // Mobile controls (only active on touch devices)
  if (engine.input.isMobile) {
    const mobile = new MobileControls(engine.input);
    mobile.init();
    mobile.onBoardPress = () => {
      if (fsm.state === FishingState.IDLE) toggleBoard();
    };
    mobile.onShopPress = () => shop.toggle();
    mobile.onJournalPress = () => journal.toggle();

    // Update action button label each frame
    const originalMobileUpdate = mobile.update.bind(mobile);
    mobile.update = (dt: number) => {
      originalMobileUpdate(dt);
      mobile.setFishingState(fsm.state);
    };
    engine.addComponent(mobile);
  }

  // Start the game loop
  engine.start();
}

main().catch(console.error);
