export type TerrainType = 'lake' | 'tropical' | 'arctic';

export interface BiomeConfig {
  name: string;
  terrain: TerrainType;
  travelCost: number;
  levelRequired: number;

  // Sky & atmosphere
  skyColor: number;
  fogColor: number;
  fogDensity: number;

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
    travelCost: 50,
    levelRequired: 8,

    skyColor: 0x64b5f6,
    fogColor: 0x90caf9,
    fogDensity: 0.005,

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
    travelCost: 100,
    levelRequired: 15,

    skyColor: 0xb0bec5,
    fogColor: 0xcfd8dc,
    fogDensity: 0.012,

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
};
