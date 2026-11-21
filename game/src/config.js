// Vice Coast v6 — shared tuning for the 3D rebuild.
// A big coastal city, 11400 by 6600, beach and sunset on the west edge.
// All speeds are world units per second; the day cycle is 240 seconds.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 11400, height: 6600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'vice-coast.best-money';
export const MISSIONS_KEY = 'vice-coast.missions-done';
export const SAVE_KEY = 'vice-coast.save-v6';

export const PLAYER = { radius: 14, walk: 230, sprint: 350, health: 100, armorMax: 100 };
export const CAR = { length: 96, width: 46, accel: 336, brake: 496, maxSpeed: 448, reverse: 160, turn: 2.4, grip: 0.94 };
export const COP_SPEED = { base: 360, perStar: 20 };
export const WANTED_DECAY = 14; // hidden seconds before one star drops
export const HIDE_RADIUS = 380; // no cop inside this radius counts as hidden
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const HELI = { radius: 420, orbitSpeed: 0.5, rotorSpeed: 38, spotlight: 320 };

// Round 7 — the four revised systems share their tuning here so the
// renderer, the rules and the playtest all read the same numbers.
export const CAMERA = { wallClearance: 26, pullInRate: 900, pullOutRate: 260, minBoom: 50, eyeHeight: 110 };
export const SHADOWS = { mapSize: 2048, frustumHalf: 900, near: 100, far: 6000, bias: -0.0004, sunDistance: 2600 };
// Sun direction per phase, as the unit vector FROM the sun toward the
// scene (x east, y up, z south in world space). Sunset is low and from
// the west so shadows stretch long to the east; day is higher.
export const SUN_DIRECTION = {
  day: { x: -0.45, y: 0.8, z: 0.4 },
  sunset: { x: -0.85, y: 0.22, z: 0.3 },
  night: { x: -0.3, y: 0.6, z: 0.5 },
};
export function sunDirectionFor(phase) { return SUN_DIRECTION[phase] || SUN_DIRECTION.day; }
// Pedestrian variety: how many steps a second a walking pedestrian
// takes, and the height/build spread the rig reads.
export const PED_WALK = { stepsPerSecond: 4, swingWalk: 0.62, swingHurry: 0.85 };
// Facade texture budget: one 256x256 canvas per distinct facade key.
export const FACADE = { textureSize: 256, maxCache: 96 };

export const NITRO = { cap: 100, drain: 30, refill: 8, speedBonus: 0.35, accelBonus: 0.5 };
export const HANDBRAKE = { turnMult: 2, bleed: 600 };
export const DRIFT = { minSpeed: 220, minYaw: 1.1, pay: 50, maxMult: 5 };
export const NEAR_MISS = { near: 52, far: 78, minSpeed: 250, pay: 100, cooldown: 5 };

export const CREW = [
  { id: 'mira', name: 'Mira', role: 'Swap Plates', key: '1', cooldown: 45, desc: 'Removes 1 wanted star' },
  { id: 'lio', name: 'Lio', role: 'Quick Fix', key: '2', cooldown: 30, desc: 'Repairs the car to full' },
  { id: 'kiki', name: 'Kiki', role: 'Eyes Out', key: '3', cooldown: 60, desc: 'Marks foot cops on the map for 20s' },
];

export const RANKS = [
  { at: 0, name: 'Dock Hand', weapon: null },
  { at: 60, name: 'Wheelman', weapon: 'smg' },
  { at: 140, name: 'Fixer', weapon: 'shotgun' },
  { at: 240, name: 'Shot Caller', weapon: 'mako' },
  { at: 380, name: 'Kingpin', weapon: null },
];
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.22, spread: 0, pellets: 1, ammo: 30 },
  smg: { name: 'SMG', damage: 22, rate: 0.1, spread: 0.05, pellets: 1, ammo: 60 },
  shotgun: { name: '12G', damage: 18, rate: 0.7, spread: 0.12, pellets: 3, ammo: 24 },
  mako: { name: 'MAKO', damage: 55, rate: 0.16, spread: 0.01, pellets: 1, ammo: 40 },
};
export const GOLD_PAINT = '#ffd700';

export const HIDDEN_PACKAGES = [
  { x: 700, y: 2900, label: 'Pier crates' },
  { x: 2400, y: 1600, label: 'Palm Row bench' },
  { x: 3600, y: 4700, label: 'Arcade alley' },
  { x: 4900, y: 2400, label: 'Hotel gardens' },
  { x: 5900, y: 3400, label: 'Bank steps' },
  { x: 7300, y: 1600, label: 'Rooftop cafe' },
  { x: 8800, y: 5600, label: 'Docks container' },
  { x: 10100, y: 3200, label: 'East market' },
  { x: 900, y: 4800, label: 'Beach hut' },
  { x: 2400, y: 5700, label: 'Hideout stash' },
];

export const NIGHT_DROPS = [
  { x: 900, y: 700 },
  { x: 10500, y: 700 },
  { x: 10500, y: 5900 },
  { x: 900, y: 5900 },
];

export const DISTRICTS = [
  { name: 'Beach', x0: 0, y0: 0, x1: 900, y1: 6600, ground: 0xc2ad7d, accent: '#1b6f8e' },
  { name: 'Neon Downtown', x0: 7100, y0: 0, x1: 11400, y1: 4000, ground: 0x6f6a72, accent: '#ff2fb3' },
  { name: 'Coral Docks', x0: 8300, y0: 4000, x1: 11400, y1: 6600, ground: 0x7d7468, accent: '#f1c40f' },
  { name: 'Suburbs', x0: 900, y0: 0, x1: 11400, y1: 6600, ground: 0x7a7f6a, accent: '#2ecc71' },
];

export function districtAt(x, y) {
  if (x < 900) return DISTRICTS[0];
  if (x >= 7100 && y < 4000) return DISTRICTS[1];
  if (x >= 8300 && y >= 4000) return DISTRICTS[2];
  return DISTRICTS[3];
}

export const DAY_LENGTH = 240;
export const DAY_PHASES = [
  { name: 'day', from: 0, to: 120 },
  { name: 'sunset', from: 120, to: 170 },
  { name: 'night', from: 170, to: 240 },
];

export const SHOP_POS = { x: 8300, y: 1800, label: 'Sunset Arms & Paint' };
export const PAINTS = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ff6b9d'];

export const PALETTE = {
  sea: '#1b6f8e', seaDeep: '#145a76', sand: '#e8c98f', sandDark: '#d9b878',
  grass: '#4f9e57', road: '#33363d', roadEdge: '#4a4e57', sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d9a441', '#7a6fae', '#5b8fb0', '#b05b7a', '#6fae7a', '#c9c9c9', '#e07a5f'],
  roof: ['#8a4a32', '#a67c2e', '#5a4f8a', '#40657d', '#8a4060', '#4f7d58'],
  text: '#fff7e8', muted: '#ffd9a0', panel: 'rgba(20,16,32,0.92)', gold: '#ffc93c',
  hudBg: 'rgba(12,10,24,0.62)', cop: '#2f6fd0', copLight: '#ff3b30',
  gang: '#8e44ad', gangGold: '#f1c40f',
};
