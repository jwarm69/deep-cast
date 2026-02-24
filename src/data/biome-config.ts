export type TerrainType = 'lake' | 'tropical' | 'arctic' | 'swamp' | 'mountain' | 'volcano';

export interface HutDef {
  x: number; z: number;
  w: number; h: number; d: number;
  rotY: number; isMain: boolean;
}

export interface BoardwalkDef {
  x: number; z: number;
  w: number; d: number;
  rotY: number;
}

export interface PropPositions {
  barrels: [number, number][];
  crates: [number, number, number][];
  netRacks: [number, number][];
  ropeCoils: [number, number][];
  lanterns: [number, number][];
}

export interface BiomeLayout {
  huts: HutDef[];
  treePositions: [number, number][];
  shoreRockPositions: [number, number][];
  waterRockPositions: [number, number][];
  beachedBoat: { x: number; z: number; rotY: number; rotZ: number } | null;
  marketStall: { x: number; z: number; rotY: number } | null;
  boardwalks: BoardwalkDef[];
  props: PropPositions;
}

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

  // Map layout
  layout: BiomeLayout;
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

    layout: {
      huts: [
        { x: 8, z: -5, w: 3.2, h: 2.8, d: 3.6, rotY: 0.15, isMain: true },
        { x: -10, z: -8, w: 2.0, h: 2.0, d: 2.2, rotY: -0.3, isMain: false },
        { x: 15, z: -12, w: 1.8, h: 1.8, d: 2.0, rotY: 0.4, isMain: false },
        { x: -6, z: -16, w: 2.0, h: 1.8, d: 2.4, rotY: -0.1, isMain: false },
        { x: -4, z: -7, w: 2.4, h: 2.2, d: 2.8, rotY: 0.2, isMain: false },
        { x: 13, z: -7, w: 1.6, h: 1.6, d: 1.8, rotY: -0.25, isMain: false },
        { x: -14, z: -14, w: 2.2, h: 2.0, d: 2.6, rotY: 0.35, isMain: false },
        { x: 5, z: -14, w: 1.8, h: 1.8, d: 2.0, rotY: -0.15, isMain: false },
        { x: 10, z: -18, w: 2.0, h: 2.0, d: 2.2, rotY: 0.1, isMain: false },
      ],
      treePositions: [
        [-8, -8], [-12, -15], [7, -10], [11, -18], [-15, -12],
        [14, -14], [-6, -20], [4, -22], [-18, -18], [18, -16],
        [-10, -25], [9, -28], [-20, -22], [15, -25], [0, -30],
      ],
      shoreRockPositions: [
        [-5, -3], [6, -2], [-8, -5], [9, -4], [-3, -1.5],
        [4, -2.5], [-11, -6], [12, -3],
      ],
      waterRockPositions: [
        [-7, 0.5], [8, 0.3], [-12, 0.8], [14, 0.2], [-3, 0.6],
      ],
      beachedBoat: { x: -12, z: -2, rotY: 0.6, rotZ: 0.3 },
      marketStall: { x: 12, z: -4, rotY: -0.2 },
      boardwalks: [
        { x: 4, z: -4, w: 4.5, d: 1.5, rotY: 0 },
        { x: -3, z: -5, w: 3.0, d: 1.5, rotY: 0.4 },
        { x: -7, z: -7, w: 2.5, d: 1.2, rotY: -0.2 },
      ],
      props: {
        barrels: [[5, -3], [-7, -4], [12, -6], [-3, -10]],
        crates: [[3, -4, 2], [-5, -6, 3], [10, -8, 1], [-8, -12, 2]],
        netRacks: [[-6, -2], [10, -3]],
        ropeCoils: [[1.5, -6], [-1.5, -6], [6, -4]],
        lanterns: [[0, -8], [4, -10], [-4, -10], [8, -14], [-8, -14]],
      },
    },
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
    waterRockCount: 8,
    hillCount: 4,

    layout: {
      huts: [
        { x: -12, z: -5, w: 3.5, h: 2.6, d: 4.0, rotY: -0.2, isMain: true },
        { x: 6, z: -6, w: 2.0, h: 2.0, d: 2.2, rotY: 0.3, isMain: false },
        { x: 14, z: -8, w: 1.8, h: 1.8, d: 2.0, rotY: -0.1, isMain: false },
        { x: -6, z: -10, w: 2.2, h: 2.0, d: 2.4, rotY: 0.15, isMain: false },
        { x: 10, z: -14, w: 2.0, h: 1.8, d: 2.2, rotY: -0.25, isMain: false },
      ],
      treePositions: [
        [-14, -16], [-16, -18], [-12, -20], [-18, -14], [-10, -18],
        [12, -18], [14, -20], [16, -16], [10, -22], [18, -18],
        [-8, -4], [4, -3],
      ],
      shoreRockPositions: [
        [-3, -2], [5, -1.5], [-8, -3], [10, -2], [15, -3], [-12, -4],
      ],
      waterRockPositions: [
        [-5, 0.5], [3, 0.3], [-9, 0.7], [8, 0.4],
        [12, 0.6], [-14, 0.8], [6, 1.0], [-2, 0.5],
      ],
      beachedBoat: { x: 14, z: -3, rotY: -0.4, rotZ: 0.25 },
      marketStall: { x: -10, z: -8, rotY: 0.3 },
      boardwalks: [
        { x: -6, z: -3, w: 5.0, d: 1.5, rotY: 0 },
        { x: 4, z: -3, w: 5.0, d: 1.5, rotY: 0 },
      ],
      props: {
        barrels: [[8, -5], [-4, -6], [14, -4]],
        crates: [[5, -5, 2], [-8, -7, 1], [12, -6, 2]],
        netRacks: [[-5, -3], [8, -4]],
        ropeCoils: [[2, -5], [-2, -4], [10, -5]],
        lanterns: [[-6, -6], [6, -8], [0, -5], [12, -10], [-10, -10]],
      },
    },
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

    layout: {
      huts: [
        { x: 0, z: -10, w: 3.0, h: 2.8, d: 3.4, rotY: 0, isMain: true },
        { x: -4, z: -9, w: 2.0, h: 2.0, d: 2.2, rotY: 0.2, isMain: false },
        { x: 4, z: -9, w: 2.0, h: 2.0, d: 2.2, rotY: -0.15, isMain: false },
        { x: -3, z: -13, w: 1.8, h: 1.8, d: 2.0, rotY: 0.1, isMain: false },
        { x: 3, z: -13, w: 2.0, h: 1.8, d: 2.2, rotY: -0.2, isMain: false },
        { x: 6, z: -12, w: 1.6, h: 1.6, d: 1.8, rotY: 0.3, isMain: false },
      ],
      treePositions: [
        [-14, -22], [10, -25], [-8, -28], [16, -20],
        [0, -30], [-18, -24], [6, -26], [-12, -30],
        [14, -28], [18, -26],
      ],
      shoreRockPositions: [
        [-8, -3], [-10, -4], [-12, -5], [-14, -3], [-6, -2],
        [-4, -1.5], [-11, -6], [-16, -4], [-9, -5.5], [-13, -6],
      ],
      waterRockPositions: [
        [-7, 0.5], [-10, 0.8], [-4, 0.3], [8, 0.4], [-12, 0.6], [3, 0.5],
      ],
      beachedBoat: null,
      marketStall: null,
      boardwalks: [],
      props: {
        barrels: [[1, -8], [-2, -11], [5, -10]],
        crates: [[-1, -9, 3], [4, -11, 2], [-3, -12, 1]],
        netRacks: [[2, -7]],
        ropeCoils: [[0, -7], [3, -8]],
        lanterns: [[0, -9], [-3, -10], [3, -10], [-1, -13], [5, -11], [1, -12]],
      },
    },
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
    waterRockCount: 6,
    hillCount: 4,

    layout: {
      huts: [
        { x: 10, z: -12, w: 3.0, h: 2.6, d: 3.2, rotY: 0.3, isMain: true },
        { x: -8, z: -6, w: 2.0, h: 2.0, d: 2.2, rotY: -0.2, isMain: false },
        { x: -14, z: -14, w: 1.8, h: 1.8, d: 2.0, rotY: 0.15, isMain: false },
        { x: 6, z: -7, w: 2.2, h: 2.0, d: 2.4, rotY: -0.1, isMain: false },
        { x: -10, z: -20, w: 2.0, h: 1.8, d: 2.2, rotY: 0.25, isMain: false },
        { x: 14, z: -18, w: 1.8, h: 1.8, d: 2.0, rotY: -0.3, isMain: false },
        { x: -4, z: -16, w: 2.0, h: 2.0, d: 2.2, rotY: 0.1, isMain: false },
      ],
      treePositions: [
        [-6, -5], [4, -4], [-12, -8], [8, -9], [-3, -10],
        [12, -6], [-16, -12], [16, -14], [-8, -18], [6, -16],
        [-10, -22], [10, -20], [-14, -26], [14, -24], [0, -14],
        [-18, -16], [18, -10], [-5, -24],
      ],
      shoreRockPositions: [
        [-4, -2], [3, -1.5], [-9, -3], [7, -2.5], [-13, -4], [11, -3],
      ],
      waterRockPositions: [
        [-6, 0.5], [5, 0.3], [-10, 0.7], [8, 0.4], [12, 0.6], [-3, 0.8],
      ],
      beachedBoat: { x: 15, z: -3, rotY: 0.4, rotZ: 0.5 },
      marketStall: null,
      boardwalks: [
        { x: -2, z: -6, w: 4.0, d: 1.2, rotY: -0.15 },
        { x: 3, z: -10, w: 3.5, d: 1.0, rotY: 0.3 },
        { x: -6, z: -14, w: 3.0, d: 1.0, rotY: -0.1 },
        { x: 8, z: -15, w: 3.5, d: 1.0, rotY: 0.2 },
      ],
      props: {
        barrels: [[-5, -5], [2, -6], [-7, -8]],
        crates: [[-3, -5, 2], [4, -7, 1], [-6, -9, 3]],
        netRacks: [[-4, -3]],
        ropeCoils: [[-2, -4], [1, -5]],
        lanterns: [[-6, -7], [6, -8], [-10, -14], [10, -13], [-4, -17]],
      },
    },
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

    layout: {
      huts: [
        { x: 0, z: -12, w: 4.0, h: 3.2, d: 4.5, rotY: 0, isMain: true },
        { x: -8, z: -16, w: 2.0, h: 2.0, d: 2.2, rotY: 0.3, isMain: false },
        { x: -4, z: -20, w: 1.8, h: 1.8, d: 2.0, rotY: 0.15, isMain: false },
        { x: 4, z: -20, w: 1.8, h: 1.8, d: 2.0, rotY: -0.15, isMain: false },
        { x: 8, z: -16, w: 2.0, h: 2.0, d: 2.2, rotY: -0.3, isMain: false },
      ],
      treePositions: [
        [-12, -22], [-8, -24], [-4, -22], [0, -24], [4, -22],
        [8, -24], [12, -22], [-16, -20], [16, -20], [-14, -26],
        [14, -26], [-10, -28], [10, -28], [0, -28],
      ],
      shoreRockPositions: [
        [-6, -3], [5, -2], [-10, -5], [9, -4], [-3, -2],
        [3, -1.5], [-13, -6], [12, -3], [-8, -4], [8, -5],
        [14, -6], [-15, -4],
      ],
      waterRockPositions: [
        [-7, 0.5], [8, 0.3], [-12, 0.8], [14, 0.2], [-3, 0.6], [10, 0.7],
      ],
      beachedBoat: { x: -15, z: -4, rotY: 0.8, rotZ: 0.2 },
      marketStall: { x: 3, z: -24, rotY: -0.1 },
      boardwalks: [
        { x: 0, z: -7, w: 8.0, d: 2.0, rotY: 0 },
      ],
      props: {
        barrels: [[3, -10], [-3, -10], [6, -14]],
        crates: [[2, -11, 2], [-2, -11, 2], [5, -15, 1]],
        netRacks: [[4, -6]],
        ropeCoils: [[1, -8], [-1, -8]],
        lanterns: [[-3, -6], [3, -6], [0, -4], [-6, -8], [6, -8], [0, -10]],
      },
    },
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

    layout: {
      huts: [
        { x: -10, z: -8, w: 3.5, h: 3.0, d: 4.0, rotY: 0.2, isMain: true },
        { x: -6, z: -12, w: 2.0, h: 2.0, d: 2.2, rotY: -0.15, isMain: false },
        { x: -12, z: -14, w: 1.8, h: 1.8, d: 2.0, rotY: 0.3, isMain: false },
      ],
      treePositions: [
        [-18, -16], [18, -14], [-16, -22], [16, -20],
        [-20, -18], [20, -16], [-14, -26], [14, -24],
      ],
      shoreRockPositions: [
        [-5, -3], [6, -2], [-8, -5], [9, -4], [-3, -1.5],
        [4, -2.5], [-11, -6], [12, -3], [-14, -4], [16, -5],
        [7, -3.5], [-6, -4.5], [14, -6], [-10, -2],
      ],
      waterRockPositions: [
        [-7, 0.5], [8, 0.3], [-12, 0.8], [14, 0.2],
        [-3, 0.6], [10, 0.7], [5, 0.4], [-9, 0.9],
      ],
      beachedBoat: null,
      marketStall: { x: 10, z: -8, rotY: -0.3 },
      boardwalks: [],
      props: {
        barrels: [[-8, -6], [-4, -9], [-10, -10], [-6, -5], [8, -6]],
        crates: [[-7, -7, 3], [-3, -10, 2], [9, -7, 2]],
        netRacks: [],
        ropeCoils: [[-5, -7]],
        lanterns: [[-8, -9], [-5, -11], [10, -9]],
      },
    },
  },
};
