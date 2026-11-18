// Neon Harbor — every tuning number and colour in one place. The city is a fixed
// 2560x1920 world; the camera shows a 1280x720 window of it, so no rule below
// depends on the screen size. Palette: a neon dusk harbour city — deep blue night,
// hot pink and cyan neon, warm amber streetlight. Nothing here is borrowed from
// any other game: Meridian Bay, its streets and its people are invented.

export const CITY = { width: 2560, height: 1920 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The camera's logical window. */
export const VIEW = { width: 1280, height: 720 };

/** Roads: a grid every 320 px, road half-width 48. */
export const ROAD = { spacing: 320, half: 48, first: 160 };

/** The harbour water starts at this y; the pier and yacht sit just above it. */
export const WATER_Y = 1840;

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  accel: 2100,
  health: 100,
  fireInterval: 0.26,
  bulletSpeed: 760,
  bulletDamage: 1,
  invulnerable: 0.8,
};

export const CAR = {
  radius: 17,
  accel: 340,
  brake: 620,
  maxSpeed: 560,
  maxReverse: 170,
  drag: 0.55,
  steer: 3.4,
  trafficSpeedMin: 95,
  trafficSpeedMax: 165,
  policeSpeed: 620,
  policeAccel: 430,
};

export const THUG = { radius: 15, health: 3, fireInterval: 1.35, bulletSpeed: 430, damage: 9, sight: 460 };

export const BULLET = { radius: 4, life: 1.1 };

export const PED = { radius: 9, speedMin: 28, speedMax: 62 };

export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  heatAfterCrime: 18,
  decayAfterCalm: 12,
  policeContactDamage: 10, // health per second while a police car touches the player
};

export const MISSION_REWARDS = [200, 350, 500, 800, 1500];

export const PALETTE = {
  ground: '#10182b',
  sidewalk: '#1b2740',
  road: '#0a0e18',
  roadEdge: '#2a3550',
  lane: '#e8c95a',
  park: '#12351f',
  parkTree: '#1d5c33',
  water: '#0a2e4d',
  waterLine: '#1d6fa8',
  buildingA: '#232c44',
  buildingB: '#2c3550',
  buildingC: '#1d2438',
  roof: '#31405f',
  windowLit: '#ffd76a',
  windowDark: '#0e1424',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonAmber: '#ffb347',
  player: '#22e6ff',
  playerCore: '#eafcff',
  police: '#2b6cff',
  policeLightR: '#ff2e2e',
  policeLightB: '#2b6cff',
  thug: '#ff5a4e',
  ped: '#c9d4e8',
  bullet: '#ffe9a8',
  marker: '#ffd76a',
  text: '#f4f1ff',
  muted: '#9d94c4',
  gold: '#ffcf5c',
  danger: '#ff5a4e',
  panel: 'rgba(8, 10, 26, 0.86)',
  panelEdge: 'rgba(255, 46, 136, 0.45)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the save and the best cash are kept between visits (this browser only). */
export const SAVE_KEY = 'neonharbor.save.v1';
export const BEST_KEY = 'neonharbor.best';
