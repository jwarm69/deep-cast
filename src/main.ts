import { Engine } from './core/Engine';
import { WaterSystem } from './world/WaterSystem';
import { TerrainSystem } from './world/TerrainSystem';
import { LightingSystem } from './world/LightingSystem';
import { Character } from './entities/Character';
import { FishingRod } from './entities/FishingRod';
import { FishingLine } from './entities/FishingLine';
import { Bobber } from './entities/Bobber';
import { FishingStateMachine } from './fishing/FishingStateMachine';
import { GameUI } from './ui/GameUI';

async function main() {
  const container = document.getElementById('game-container')!;
  const engine = new Engine(container);
  await engine.init();

  const scene = engine.scene;

  // World systems
  const lighting = new LightingSystem(scene);
  lighting.init();
  engine.addComponent(lighting);

  const terrain = new TerrainSystem(scene);
  terrain.init();
  engine.addComponent(terrain);

  const water = new WaterSystem(scene);
  water.init();
  engine.addComponent(water);

  // Entities
  const character = new Character(scene, terrain.characterPosition, engine.input);
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
    // Update camera follow target to character position
    const charPos = character.group.position;
    engine.camera.setTarget(charPos.clone().setY(charPos.y + 2.0));

    // Pass camera angle to character for relative movement
    character.setCameraTheta(engine.camera.theta);

    originalCameraUpdate(dt);
  };

  // Fishing state machine
  const fsm = new FishingStateMachine(
    engine.events,
    engine.input,
    bobber,
    line,
    rod,
  );
  engine.addComponent(fsm);

  // UI
  const ui = new GameUI(engine.events, fsm);
  ui.init();
  engine.addComponent(ui);

  // Start the game loop
  engine.start();
}

main().catch(console.error);
