// Tuning for Neon Harbor — Meridian Bay. Every number that shapes how
// the game feels lives here so a balance pass touches one file only.
export const CONFIG = {
  // World
  worldSize: 3168,
  roadPitch: 288,
  roadWidth: 64,
  roadCount: 11,
  defaultSeed: 7,

  // Player on foot
  walkSpeed: 170,
  sprintSpeed: 290,
  playerRadius: 13,
  playerHealth: 100,
  punchDamage: 12,
  punchRange: 46,
  punchArc: 1.1,
  shotDamage: 34,
  shotRange: 420,
  shotCooldown: 0.28,

  // Cars
  carAccel: 520,
  carReverseAccel: 320,
  carBrake: 900,
  carMaxSpeed: 620,
  carMaxReverse: 180,
  carTurnRate: 2.6,
  carDrag: 0.55,
  carLength: 52,
  carWidth: 26,
  trafficSpeed: 150,
  trafficCount: 26,
  parkedCount: 30,

  // Pedestrians
  pedCount: 42,
  pedWalkSpeed: 55,
  pedFleeSpeed: 150,

  // Police and wanted
  maxWanted: 5,
  policeRamDamage: 9,
  policeTopSpeed: 640,
  policeTurnRate: 2.8,
  wantedDecaySeconds: 9,
  copSpawnDistance: 520,
  maxCops: 8,

  // Missions
  missionMarkerRadius: 34,
  missionRewardBase: 350,

  // Camera and view
  cameraZoom: 1.0,
  cameraLerp: 6.0,

  // Economy
  startCash: 120,
  respawnCashPenalty: 0.25,
  carStealHeat: 1,
  shootHeat: 1,
};

// Neon palette for the bay at dusk.
export const PALETTE = {
  ground: "#1d2b33",
  groundAlt: "#22343c",
  water: "#0e4a6b",
  waterDeep: "#0a3550",
  sand: "#c9a86a",
  road: "#2b2f38",
  roadLine: "#d8c25a",
  sidewalk: "#3d4450",
  buildingRoof: "#4a5468",
  buildingEdge: "#2c3340",
  neonPink: "#ff4d8d",
  neonCyan: "#37e6ff",
  neonAmber: "#ffb347",
  neonLime: "#9dff57",
  hudBg: "rgba(8, 12, 24, 0.72)",
  hudText: "#eef3ff",
  hudDim: "#9aa7c7",
  starOn: "#ffd23e",
  starOff: "rgba(255, 255, 255, 0.25)",
};

// District names for the minimap and mission text.
export const DISTRICTS = [
  "Coral Row", "Vela Point", "Kite District",
  "Anchor Quarter", "Meridian Docks", "Palma Heights",
  "Gull Market", "Beacon Hill", "Saltworks",
];

// Street names, one per road index, reused for flavour text.
export const STREET_NAMES = [
  "Harborlight Ave", "Neon Quay", "Tidewater Blvd", "Coral St",
  "Lantern Row", "Salt Air Dr", "Meridian Way", "Gull Wing Rd",
  "Beacon St", "Palma Ave", "North Pier Rd",
];

// Car paint jobs the city spawns with.
export const CAR_COLORS = [
  "#e63946", "#f4a261", "#2a9d8f", "#4361ee", "#7209b7",
  "#f7ede2", "#8d99ae", "#06d6a0", "#ffbe0b", "#3a0ca3",
];

// Pedestrian shirt colours.
export const PED_COLORS = [
  "#e07a5f", "#81b29a", "#f2cc8f", "#6d9dc5", "#b5838d",
  "#e5989b", "#a3b18a", "#f4d35e", "#90be6d", "#f28482",
];
