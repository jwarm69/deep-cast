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
import { AmbientFish } from './entities/AmbientFish';
import { FishShadow } from './entities/FishShadow';
import { FishingStateMachine } from './fishing/FishingStateMachine';
import { PlayerState } from './state/PlayerState';
import { SoundSystem } from './audio/SoundSystem';
import { ParticleSystem, FX } from './effects/ParticleSystem';
import { RippleSystem } from './effects/RippleSystem';
import { BiteIndicator } from './effects/BiteIndicator';
import { GameUI } from './ui/GameUI';
import { ShopUI } from './ui/ShopUI';
import { JournalUI } from './ui/JournalUI';
import { MobileControls } from './ui/MobileControls';
import { MultiplayerUI } from './ui/MultiplayerUI';
import { BIOME_CONFIGS, TerrainType } from './data/biome-config';
import { FISH_BY_TERRAIN, DEEP_FISH_BY_TERRAIN } from './data/fish-species';
import { FogEventSystem } from './world/FogEventSystem';
import { createBackendClient } from './backend/createBackendClient';
import { MultiplayerBridge } from './multiplayer/MultiplayerBridge';
import { RemotePlayerRenderer } from './multiplayer/RemotePlayerRenderer';
import { findFishingSpot } from './multiplayer/fishing-spots';
import { PresenceActivity, PresenceCatch } from './multiplayer/types';

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

  // Water surface ripples (bobber, bites, fish movement)
  const ripples = new RippleSystem(scene, water);
  ripples.init();
  engine.addComponent(ripples);

  const ambientFish = new AmbientFish(scene, water);
  ambientFish.init();
  ambientFish.setRipples(ripples);
  engine.addComponent(ambientFish);

  // Approaching fish silhouette + bite "!" indicator
  const fishShadow = new FishShadow(scene, water, ripples);
  fishShadow.init();
  engine.addComponent(fishShadow);

  const biteIndicator = new BiteIndicator(scene);
  biteIndicator.init();
  engine.addComponent(biteIndicator);

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
      rod.group.rotation.y = boat.group.rotation.y;
    } else {
      rod.setBasePosition(character.rodAttachPoint);
      rod.group.rotation.y = character.group.rotation.y;
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
      engine.camera.setFovBoost(boat.speedRatio * 4);
    } else {
      const charPos = character.group.position;
      engine.camera.setTarget(charPos.clone().setY(charPos.y + 2.0));
      character.setCameraTheta(engine.camera.theta);
      engine.camera.setFovBoost(0);
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
  fsm.setCastAimProvider(() => {
    const activeGroup = playerMode === PlayerMode.BOAT ? boat.group : character.group;
    const facing = new THREE.Vector3(
      Math.sin(activeGroup.rotation.y),
      0,
      Math.cos(activeGroup.rotation.y),
    );

    if (playerMode === PlayerMode.SHORE) {
      facing.x *= 0.6;
      facing.z = Math.max(0.65, facing.z);
      facing.normalize();
    }

    return {
      direction: { x: facing.x, z: facing.z },
      minLandingX: -90,
      maxLandingX: 90,
      minLandingZ: playerMode === PlayerMode.SHORE ? 5.5 : 3.5,
      maxLandingZ: 112,
    };
  });
  engine.addComponent(fsm);

  // Fog events (Mistfall Reservoir mechanic)
  const fogEvents = new FogEventSystem(engine.events, engine.renderer, fsm);
  fogEvents.init();
  engine.addComponent(fogEvents);

  // --- Multiplayer presence: activity + last catch shared with other anglers ---
  let sharedLastCatch: PresenceCatch | null = null;

  engine.events.on(Events.FISH_CAUGHT, (e) => {
    const data = e.data;
    sharedLastCatch = {
      fishName: data.isTrophy ? `Trophy ${data.species.name}` : data.species.name,
      rarity: data.species.rarity,
      weight: data.weight,
      isTrophy: data.isTrophy ?? false,
      at: Date.now(),
    };
  });

  function currentActivity(): PresenceActivity {
    switch (fsm.state) {
      case FishingState.CASTING:
      case FishingState.FLIGHT:
        return 'casting';
      case FishingState.WAITING:
      case FishingState.BITING:
        return 'waiting';
      case FishingState.REELING:
        return 'reeling';
      case FishingState.CAUGHT:
        return 'caught';
      default:
        return playerMode === PlayerMode.BOAT ? 'sailing' : 'walking';
    }
  }

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
      activity: currentActivity(),
      lastCatch: sharedLastCatch,
    };
  });
  await multiplayer.init();
  engine.addComponent(multiplayer);

  // Remote player avatars (renders other anglers in the scene)
  const remotePlayers = new RemotePlayerRenderer(scene, engine.events);
  remotePlayers.init();
  engine.addComponent(remotePlayers);

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

    // Fog events (only active where the biome calls for them)
    fogEvents.setBiome(config);

    // Clear any in-flight fish presentation
    fishShadow.hide();
    biteIndicator.hide();

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
    ripples.burst(bobber.position.x, bobber.position.z, 3, { scale: 1.6, opacity: 0.55 });
  });

  // The rolled fish swims in as a silhouette while you wait
  engine.events.on(Events.FISH_APPROACH, (e) => {
    fishShadow.beginApproach(
      e.data.x, e.data.z, e.data.arriveIn,
      e.data.weight, e.data.maxWeight, e.data.rarity, e.data.isTrophy,
    );
  });

  engine.events.on(Events.LURE_TWITCH, (e) => {
    const effect = e.data.effect ?? 0;
    ripples.spawn(e.data.x, e.data.z, {
      scale: 0.9 + Math.max(0, effect) * 2.2,
      life: effect < 0 ? 0.55 : 0.8,
      opacity: effect < 0 ? 0.28 : 0.45,
      color: effect < 0 ? 0xfca5a5 : 0xe8f6ff,
    });
  });

  engine.events.on(Events.FISH_INSPECT, (e) => {
    fishShadow.inspect();
    ripples.spawn(e.data.x, e.data.z, { scale: 1.0, life: 1.4, opacity: 0.32 });
  });

  engine.events.on(Events.FISH_CHASE, (e) => {
    fishShadow.chase();
    ripples.burst(e.data.x, e.data.z, 2, { scale: 1.25, life: 0.85, opacity: 0.5 });
  });

  engine.events.on(Events.FISH_REJECT, () => {
    fishShadow.flee();
    biteIndicator.hide();
    ripples.burst(bobber.position.x, bobber.position.z, 1, { scale: 0.9, life: 0.55, opacity: 0.35, color: 0xfca5a5 });
  });

  engine.events.on(Events.SURFACE_CLUE, (e) => {
    const x = e.data.x;
    const z = e.data.z;
    const strength = e.data.strength ?? 0.5;
    const pos = new THREE.Vector3(x, 0.45, z);
    switch (e.data.kind) {
      case 'bubbles':
        FX.biteBubbles(pos, particles);
        ripples.spawn(x, z, { scale: 0.8 + strength * 0.7, life: 1.0, opacity: 0.24 });
        break;
      case 'splash':
        FX.splash(pos, particles);
        ripples.burst(x, z, 2, { scale: 1.0 + strength * 0.8, life: 0.8, opacity: 0.42 });
        break;
      case 'glow':
        ripples.burst(x, z, 2, { scale: 1.1 + strength, life: 1.35, opacity: 0.5, color: 0xfbbf24 });
        FX.catchSparkle(pos, particles, new THREE.Color(0xfbbf24));
        break;
      default:
        ripples.spawn(x, z, { scale: 0.8 + strength * 0.8, life: 1.35, opacity: 0.28 });
        break;
    }
  });

  engine.events.on(Events.FISH_BITE, () => {
    const bitePos = new THREE.Vector3(bobber.position.x, 0.5, bobber.position.z);
    FX.biteBubbles(bitePos, particles);
    ripples.burst(bobber.position.x, bobber.position.z, 2, { scale: 1.2, life: 0.8, opacity: 0.6 });
    biteIndicator.show(bobber.position.x, bobber.mesh.position.y, bobber.position.z);
    engine.camera.shake(0.15, 0.3); // Light shake on bite
  });

  engine.events.on(Events.REEL_START, () => {
    biteIndicator.hide();
    fishShadow.startFight(() => ({ x: bobber.position.x, z: bobber.position.z }));
  });

  engine.events.on(Events.FISH_CAUGHT, (e) => {
    const pos = new THREE.Vector3(bobber.position.x, 0.5, bobber.position.z);
    const speciesColor = new THREE.Color(e.data.species.color);
    FX.catchSparkle(pos, particles, speciesColor);
    ripples.burst(pos.x, pos.z, 3, { scale: 2.0, opacity: 0.6 });
    engine.camera.shake(0.4, 0.5); // Strong shake on catch
    catchFish.setBobberPos(pos.x, pos.z);
    fishShadow.hide();
    biteIndicator.hide();
  });

  engine.events.on(Events.FISH_ESCAPED, () => {
    fishShadow.flee();
    biteIndicator.hide();
  });

  engine.events.on(Events.LINE_SNAPPED, () => {
    fishShadow.flee();
    biteIndicator.hide();
    ripples.burst(bobber.position.x, bobber.position.z, 2, { scale: 1.4, life: 0.7, opacity: 0.5 });
    engine.camera.shake(0.5, 0.45); // Hard jolt — the line just broke
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
  let waitRippleTimer = 0;
  const originalFsmUpdate = fsm.update.bind(fsm);
  fsm.update = (dt: number) => {
    originalFsmUpdate(dt);
    if (fsm.state === 'reeling') {
      sound.updateReelPitch(fsm.currentReelProgress);
      sound.updateTensionCreak(fsm.currentTension);
    }

    // Gentle bobber ripples while waiting for a bite
    if (fsm.state === FishingState.WAITING) {
      waitRippleTimer -= dt;
      if (waitRippleTimer <= 0) {
        waitRippleTimer = 2.2 + Math.random() * 1.5;
        ripples.spawn(bobber.position.x, bobber.position.z, { scale: 0.7, life: 1.6, opacity: 0.3 });
      }
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

  const multiplayerUI = new MultiplayerUI(engine.events);
  multiplayerUI.init();
  engine.addComponent(multiplayerUI);

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
