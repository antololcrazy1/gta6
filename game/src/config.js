// Vice Coast — tuning numbers and colours in one place.
// The world is a 3600x2600 coastal city; the camera shows a 1280x720 window of it.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3600, height: 2600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'vice-coast.best-money';
export const MISSIONS_KEY = 'vice-coast.missions-done';

export const PLAYER = { radius: 13, walk: 230, sprint: 350, health: 100 };
export const CAR = { length: 54, width: 28, accel: 420, brake: 620, maxSpeed: 560, reverse: 200, turn: 2.6, grip: 0.92 };
export const WANTED_DECAY = 18; // seconds hidden with no crime before a star drops
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Police helicopter: circles the player once the heat hits 4 stars.
export const HELI = { radius: 260, orbitSpeed: 0.55, rotorSpeed: 42, spotlight: 190 };

// Hidden packages: 10 golden parcels tucked beside landmarks across the city.
// Finding one pays $50 and +2 respect; the HUD tracks n/10.
export const HIDDEN_PACKAGES = [
  { x: 210, y: 1180, label: 'Pier crates' },
  { x: 704, y: 640, label: 'Palm Row bench' },
  { x: 1088, y: 1920, label: 'Arcade alley' },
  { x: 1472, y: 960, label: 'Hotel gardens' },
  { x: 1856, y: 1600, label: 'Bank steps' },
  { x: 2240, y: 640, label: 'Rooftop cafe' },
  { x: 2624, y: 2240, label: 'Docks container' },
  { x: 3008, y: 1280, label: 'East market' },
  { x: 3392, y: 1920, label: 'Beach hut' },
  { x: 704, y: 2240, label: 'Hideout stash' },
];

// Night drops (mission 6, Vice Nights): one per city corner, collected in order.
export const NIGHT_DROPS = [
  { x: 320, y: 320 },
  { x: 3280, y: 320 },
  { x: 3280, y: 2280 },
  { x: 320, y: 2280 },
];

export const PALETTE = {
  sea: '#1b6f8e', seaDeep: '#145a76', sand: '#e8c98f', sandDark: '#d9b878',
  grass: '#4f9e57', grassDark: '#3f8a49', road: '#33363d', roadEdge: '#4a4e57',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d9a441', '#7a6fae', '#5b8fb0', '#b05b7a', '#6fae7a', '#c9c9c9', '#e07a5f'],
  roof: ['#8a4a32', '#a67c2e', '#5a4f8a', '#40657d', '#8a4060', '#4f7d58'],
  text: '#fff7e8', muted: '#ffd9a0', panel: 'rgba(20,16,32,0.92)', gold: '#ffc93c',
  hudBg: 'rgba(12,10,24,0.62)', cop: '#2f6fd0', copLight: '#ff3b30',
};

