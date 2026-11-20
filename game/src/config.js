// Vice Coast v5 — tuning numbers, colours and districts in one place.
// The world is an 11400x6600 coastal city (v6.5: 10x the v6.4 map —
// 3600x2080 was 7,488,000 sq units, this is 75,240,000, ~10.05x; scale
// ~3.167x per side, beach + sunset kept on the west edge); the camera
// shows a 1280x720 window of it. v5 splits the city into four districts
// with their own ground palettes, adds a day/night weather cycle, gang
// turf, a shop and phone jobs.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 11400, height: 6600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'vice-coast.best-money';
export const MISSIONS_KEY = 'vice-coast.missions-done';
export const SAVE_KEY = 'vice-coast.save-v5';

export const PLAYER = { radius: 13, walk: 230, sprint: 350, health: 100, armorMax: 100 };
// v6.4: the player car is ~20% slower (Hanz: "kecepatan mobil turunin") —
// top speed 560 -> 448 (179 -> 143 km/h on the speedo), accel 420 -> 336.
export const CAR = { length: 54, width: 28, accel: 336, brake: 496, maxSpeed: 448, reverse: 160, turn: 2.6, grip: 0.92 };
export const WANTED_DECAY = 14; // seconds hidden with no crime before a star drops (was 18: mission 4 was near-impossible)
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Police helicopter: circles the player once the heat hits 4 stars.
export const HELI = { radius: 180, orbitSpeed: 0.55, rotorSpeed: 42, spotlight: 190 };

// Hidden packages: 10 golden parcels tucked beside landmarks across the city.
// Finding one pays $50 and +2 respect; the HUD tracks n/10.
// v6.5: v6.4 positions x3.1667 / y3.1731 for the 10x map.
export const HIDDEN_PACKAGES = [
  { x: 665, y: 2995, label: 'Pier crates' },
  { x: 2229, y: 1625, label: 'Palm Row bench' },
  { x: 3445, y: 4874, label: 'Arcade alley' },
  { x: 4661, y: 2437, label: 'Hotel gardens' },
  { x: 5877, y: 4062, label: 'Bank steps' },
  { x: 7093, y: 1625, label: 'Rooftop cafe' },
  { x: 8309, y: 5687, label: 'Docks container' },
  { x: 9525, y: 3250, label: 'East market' },
  { x: 10741, y: 4874, label: 'Beach hut' },
  { x: 2229, y: 5687, label: 'Hideout stash' },
];

// Night drops (mission 6, Vice Nights): one per city corner, collected in order.
export const NIGHT_DROPS = [
  { x: 1013, y: 812 },
  { x: 10387, y: 812 },
  { x: 10387, y: 5788 },
  { x: 1013, y: 5788 },
];

// Four districts: the west beach strip, the neon downtown in the north-east,
// the container docks in the south-east, and the suburbs everywhere else.
// districtAt() checks them in this order so the strips win over the suburbs.
export const DISTRICTS = [
  { name: 'Beach', x0: 0, y0: 0, x1: 950, y1: 6600, ground: '#c2ad7d', accent: '#1b6f8e' },
  { name: 'Neon Downtown', x0: 7093, y0: 0, x1: 11400, y1: 4062, ground: '#6f6a72', accent: '#ff2fb3' },
  { name: 'Coral Docks', x0: 8309, y0: 4062, x1: 11400, y1: 6600, ground: '#7d7468', accent: '#f1c40f' },
  { name: 'Suburbs', x0: 950, y0: 0, x1: 11400, y1: 6600, ground: '#7a7f6a', accent: '#2ecc71' },
];

export function districtAt(x, y) {
  if (x < 950) return DISTRICTS[0];
  if (x >= 7093 && y < 4062) return DISTRICTS[1];
  if (x >= 8309 && y >= 4062) return DISTRICTS[2];
  return DISTRICTS[3];
}

// Day/night cycle: one full day is 240 s of play — day 0-120 s, sunset
// 120-170 s, night 170-240 s — then it rolls over to the next morning.
export const DAY_LENGTH = 240;
export const DAY_PHASES = [
  { name: 'day', from: 0, to: 120 },
  { name: 'sunset', from: 120, to: 170 },
  { name: 'night', from: 170, to: 240 },
];

// Sunset Arms & Paint: the shop sits on the road beside the Neon Hotel.
export const SHOP_POS = { x: 8309, y: 1828, label: 'Sunset Arms & Paint' };
// Six paint colours the shop cycles through for the player's current car.
export const PAINTS = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#ff6b9d'];

export const PALETTE = {
  sea: '#1b6f8e', seaDeep: '#145a76', sand: '#e8c98f', sandDark: '#d9b878',
  grass: '#4f9e57', grassDark: '#3f8a49', road: '#33363d', roadEdge: '#4a4e57',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d9a441', '#7a6fae', '#5b8fb0', '#b05b7a', '#6fae7a', '#c9c9c9', '#e07a5f'],
  roof: ['#8a4a32', '#a67c2e', '#5a4f8a', '#40657d', '#8a4060', '#4f7d58'],
  text: '#fff7e8', muted: '#ffd9a0', panel: 'rgba(20,16,32,0.92)', gold: '#ffc93c',
  hudBg: 'rgba(12,10,24,0.62)', cop: '#2f6fd0', copLight: '#ff3b30',
  // District tints used for the ground wash and the turf overlay.
  beach: '#e8c98f', downtown: '#3a3345', docks: '#6e6250', suburbs: '#7a7f6a',
  gang: '#8e44ad', gangGold: '#f1c40f',
};
