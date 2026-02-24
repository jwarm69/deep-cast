export type TerrainType = 'lake' | 'tropical' | 'arctic' | 'swamp' | 'mountain' | 'volcano';

export interface BiomeConfig {
  name: string;
  terrain: TerrainType;
  travelCost: number;
  levelRequired: number;

  // Sky & atmosphere
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  skyTopColor: number;
  skyHorizonColor: number;
  sunDiscColor: number;
  sunDiscSize: number;
  cloudColor: number;
  cloudOpacity: number;
  cloudCount: number;
  cloudAltitude: number;
  cloudDriftSpeed: number;
  mountainColor: number;
  mountainCount: number;

  // Lighting
  ambientColor: number;
  ambientIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];

  // Water
  waterDeepColor: number;
  waterShallowColor: number;
  waterSunDirection: [number, number, number];

  // Terrain materials
  groundColor: number;
  shoreColor: number;
  dockColor: number;
  rockColor: number;
  trunkColor: number;
  leafColor: number;
  hillColor: number;
  lakeBottomColor: number;

  // Style variants
  treeStyle: 'deciduous' | 'palm' | 'pine';
  dockStyle: 'wooden_dock' | 'wooden_pier' | 'ice_shelf';

  // Object counts
  treeCount: number;
  shoreRockCount: number;
  waterRockCount: number;
  hillCount: number;
}

export const BIOME_CONFIGS: Record<TerrainType, BiomeConfig> = {
  lake: {
    name: 'Peaceful Lake',
    terrain: 'lake',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0x87ceeb,
    fogColor: 0x87ceeb,
    fogDensity: 0.008,
    skyTopColor: 0x1a6eb5,
    skyHorizonColor: 0xb3d9f2,
    sunDiscColor: 0xfff9c4,
    sunDiscSize: 3.0,
    cloudColor: 0xffffff,
    cloudOpacity: 0.7,
    cloudCount: 15,
    cloudAltitude: 60,
    cloudDriftSpeed: 1.5,
    mountainColor: 0x37474f,
    mountainCount: 8,

    ambientColor: 0x8ec7e8,
    ambientIntensity: 0.5,
    hemiSkyColor: 0x87ceeb,
    hemiGroundColor: 0x3a5f0b,
    hemiIntensity: 0.4,
    sunColor: 0xfff4e6,
    sunIntensity: 1.4,
    sunPosition: [30, 40, 20],

    waterDeepColor: 0x0a3d5c,
    waterShallowColor: 0x1a7a8a,
    waterSunDirection: [0.5, 0.8, 0.3],

    groundColor: 0x4a7c3f,
    shoreColor: 0xc2a66b,
    dockColor: 0x8b6914,
    rockColor: 0x6b6b6b,
    trunkColor: 0x5c3a1e,
    leafColor: 0x2d5a1e,
    hillColor: 0x4a7c3f,
    lakeBottomColor: 0x2a4a3a,

    treeStyle: 'deciduous',
    dockStyle: 'wooden_dock',

    treeCount: 15,
    shoreRockCount: 8,
    waterRockCount: 5,
    hillCount: 6,
  },

  tropical: {
    name: 'Tropical Lagoon',
    terrain: 'tropical',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0x64b5f6,
    fogColor: 0x90caf9,
    fogDensity: 0.005,
    skyTopColor: 0x1565c0,
    skyHorizonColor: 0xbbdefb,
    sunDiscColor: 0xfff176,
    sunDiscSize: 4.0,
    cloudColor: 0xffffff,
    cloudOpacity: 0.6,
    cloudCount: 12,
    cloudAltitude: 70,
    cloudDriftSpeed: 2.0,
    mountainColor: 0x33691e,
    mountainCount: 6,

    ambientColor: 0xffe0b2,
    ambientIntensity: 0.6,
    hemiSkyColor: 0x64b5f6,
    hemiGroundColor: 0x558b2f,
    hemiIntensity: 0.5,
    sunColor: 0xfff8e1,
    sunIntensity: 1.8,
    sunPosition: [25, 50, 15],

    waterDeepColor: 0x006064,
    waterShallowColor: 0x00bcd4,
    waterSunDirection: [0.4, 0.9, 0.2],

    groundColor: 0x7cb342,
    shoreColor: 0xf5deb3,
    dockColor: 0x6d4c41,
    rockColor: 0x8d6e63,
    trunkColor: 0x795548,
    leafColor: 0x33691e,
    hillColor: 0x689f38,
    lakeBottomColor: 0x004d40,

    treeStyle: 'palm',
    dockStyle: 'wooden_pier',

    treeCount: 12,
    shoreRockCount: 6,
    waterRockCount: 4,
    hillCount: 4,
  },

  arctic: {
    name: 'Frozen Tundra',
    terrain: 'arctic',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0xb0bec5,
    fogColor: 0xcfd8dc,
    fogDensity: 0.012,
    skyTopColor: 0x607d8b,
    skyHorizonColor: 0xcfd8dc,
    sunDiscColor: 0xeceff1,
    sunDiscSize: 2.5,
    cloudColor: 0xb0bec5,
    cloudOpacity: 0.5,
    cloudCount: 18,
    cloudAltitude: 40,
    cloudDriftSpeed: 1.0,
    mountainColor: 0x78909c,
    mountainCount: 10,

    ambientColor: 0xb0bec5,
    ambientIntensity: 0.4,
    hemiSkyColor: 0xb0bec5,
    hemiGroundColor: 0x546e7a,
    hemiIntensity: 0.3,
    sunColor: 0xe0e0e0,
    sunIntensity: 1.0,
    sunPosition: [20, 25, 30],

    waterDeepColor: 0x1a237e,
    waterShallowColor: 0x42a5f5,
    waterSunDirection: [0.3, 0.5, 0.4],

    groundColor: 0xeceff1,
    shoreColor: 0xcfd8dc,
    dockColor: 0x90a4ae,
    rockColor: 0x455a64,
    trunkColor: 0x37474f,
    leafColor: 0x1b5e20,
    hillColor: 0xe0e0e0,
    lakeBottomColor: 0x0d47a1,

    treeStyle: 'pine',
    dockStyle: 'ice_shelf',

    treeCount: 10,
    shoreRockCount: 10,
    waterRockCount: 6,
    hillCount: 8,
  },

  swamp: {
    name: 'Murky Swamp',
    terrain: 'swamp',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0x556b2f,
    fogColor: 0x3b4a2a,
    fogDensity: 0.015,
    skyTopColor: 0x2e3b1f,
    skyHorizonColor: 0x6b7c3f,
    sunDiscColor: 0xc8b560,
    sunDiscSize: 2.0,
    cloudColor: 0x6b6b4f,
    cloudOpacity: 0.8,
    cloudCount: 20,
    cloudAltitude: 35,
    cloudDriftSpeed: 0.8,
    mountainColor: 0x3b4a2a,
    mountainCount: 5,

    ambientColor: 0x5a6b3a,
    ambientIntensity: 0.3,
    hemiSkyColor: 0x556b2f,
    hemiGroundColor: 0x2e3b1f,
    hemiIntensity: 0.3,
    sunColor: 0xc8b560,
    sunIntensity: 0.8,
    sunPosition: [15, 20, 18],

    waterDeepColor: 0x1a2e0a,
    waterShallowColor: 0x3b5a1e,
    waterSunDirection: [0.3, 0.4, 0.3],

    groundColor: 0x3b4a2a,
    shoreColor: 0x5a4a2a,
    dockColor: 0x6b5a32,
    rockColor: 0x4a4a3a,
    trunkColor: 0x3b2e1a,
    leafColor: 0x4a6b2a,
    hillColor: 0x3b4a2a,
    lakeBottomColor: 0x1a2e0a,

    treeStyle: 'deciduous',
    dockStyle: 'wooden_dock',

    treeCount: 18,
    shoreRockCount: 6,
    waterRockCount: 4,
    hillCount: 4,
  },

  mountain: {
    name: 'Alpine Summit',
    terrain: 'mountain',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0x5b9bd5,
    fogColor: 0x87aed0,
    fogDensity: 0.006,
    skyTopColor: 0x1a5276,
    skyHorizonColor: 0xaed6f1,
    sunDiscColor: 0xfff9c4,
    sunDiscSize: 3.5,
    cloudColor: 0xffffff,
    cloudOpacity: 0.8,
    cloudCount: 12,
    cloudAltitude: 80,
    cloudDriftSpeed: 2.5,
    mountainColor: 0x5d6d7e,
    mountainCount: 12,

    ambientColor: 0x85c1e9,
    ambientIntensity: 0.5,
    hemiSkyColor: 0x5b9bd5,
    hemiGroundColor: 0x6b8e6b,
    hemiIntensity: 0.5,
    sunColor: 0xfff8e1,
    sunIntensity: 1.6,
    sunPosition: [35, 50, 25],

    waterDeepColor: 0x0a3d6b,
    waterShallowColor: 0x2e86c1,
    waterSunDirection: [0.5, 0.9, 0.3],

    groundColor: 0x6b8e6b,
    shoreColor: 0x9e9e9e,
    dockColor: 0x795548,
    rockColor: 0x5d6d7e,
    trunkColor: 0x4a3728,
    leafColor: 0x1b5e20,
    hillColor: 0x7d8e7d,
    lakeBottomColor: 0x154360,

    treeStyle: 'pine',
    dockStyle: 'wooden_pier',

    treeCount: 14,
    shoreRockCount: 12,
    waterRockCount: 6,
    hillCount: 8,
  },

  volcano: {
    name: 'Volcanic Caldera',
    terrain: 'volcano',
    travelCost: 0,
    levelRequired: 1,

    skyColor: 0x8b3a3a,
    fogColor: 0x6b2a2a,
    fogDensity: 0.014,
    skyTopColor: 0x4a1a1a,
    skyHorizonColor: 0xc45a2a,
    sunDiscColor: 0xff6b2a,
    sunDiscSize: 5.0,
    cloudColor: 0x5a4a4a,
    cloudOpacity: 0.6,
    cloudCount: 10,
    cloudAltitude: 45,
    cloudDriftSpeed: 1.2,
    mountainColor: 0x2a1a1a,
    mountainCount: 8,

    ambientColor: 0xc45a2a,
    ambientIntensity: 0.4,
    hemiSkyColor: 0x8b3a3a,
    hemiGroundColor: 0x4a2a1a,
    hemiIntensity: 0.4,
    sunColor: 0xff8c42,
    sunIntensity: 1.8,
    sunPosition: [20, 30, 15],

    waterDeepColor: 0x3a0a0a,
    waterShallowColor: 0x8b2a0a,
    waterSunDirection: [0.4, 0.6, 0.2],

    groundColor: 0x2a1a1a,
    shoreColor: 0x4a3a2a,
    dockColor: 0x5a4a3a,
    rockColor: 0x1a1a1a,
    trunkColor: 0x6b4a2a,
    leafColor: 0x33691e,
    hillColor: 0x3a2a1a,
    lakeBottomColor: 0x2a0a0a,

    treeStyle: 'palm',
    dockStyle: 'ice_shelf',

    treeCount: 8,
    shoreRockCount: 14,
    waterRockCount: 8,
    hillCount: 6,
  },
};
