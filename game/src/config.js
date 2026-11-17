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

export const PALETTE = {
  sea: '#1b6f8e', seaDeep: '#145a76', sand: '#e8c98f', sandDark: '#d9b878',
  grass: '#4f9e57', grassDark: '#3f8a49', road: '#33363d', roadEdge: '#4a4e57',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d9a441', '#7a6fae', '#5b8fb0', '#b05b7a', '#6fae7a', '#c9c9c9', '#e07a5f'],
  roof: ['#8a4a32', '#a67c2e', '#5a4f8a', '#40657d', '#8a4060', '#4f7d58'],
  text: '#fff7e8', muted: '#ffd9a0', panel: 'rgba(20,16,32,0.92)', gold: '#ffc93c',
  hudBg: 'rgba(12,10,24,0.62)', cop: '#2f6fd0', copLight: '#ff3b30',
};

export const MISSIONS = [
  { id: 1, name: 'Sunset Taxi', brief: 'Pick up Maya at the pier, then drop her at the Neon Hotel. Drive smooth — she tips for speed.', reward: 150 },
  { id: 2, name: 'Package Run', brief: 'Collect 3 packages around Palm Row and deliver them to the docks. Watch the clock.', reward: 250 },
  { id: 3, name: 'Getaway', brief: 'Grab the bag from the arcade and reach the hideout in 75 seconds. The cops will not wait.', reward: 350 },
  { id: 4, name: 'Lose the Heat', brief: 'You are at 3 stars. Break line of sight and stay hidden until the heat dies down.', reward: 400 },
  { id: 5, name: 'The Sunset Heist', brief: 'Hit the Coral Bank vault, grab the loot, and escape to the hideout. Finish this and Vice Coast is yours.', reward: 800 },
];
