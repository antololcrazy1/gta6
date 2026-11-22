// The Viper gang and their turf in Neon Downtown. Gang cars cruise the
// turf in a slow loop; torching one raises respect and counts toward the
// Neon Reign mission. The turf marker is the hold point for mission 9.
import { LANDMARKS } from './config.js';

export const TURF = {
  x: LANDMARKS.turf.x,
  y: LANDMARKS.turf.y,
  r: 900,
  name: 'Viper Turf',
};

// Gang car paint and names, for the HUD and the mission panel.
const GANG_COLORS = [0x6a1a6a, 0x3a1a5a, 0x8a2a8a, 0x5a1a3a];
const GANG_NAMES = ['Viper 1', 'Viper 2', 'Viper 3', 'Viper 4', 'Viper 5', 'Viper 6'];

// Six gang cars, patrolling a loop around the turf centre. Their routes
// are circles of different radii so they spread across the neighbourhood
// instead of bunching on one street.
export function createGangCars(rng) {
  const cars = [];
  for (let i = 0; i < 6; i += 1) {
    const radius = 180 + (i % 3) * 160;
    const angle = (i / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    cars.push({
      id: 1000 + i,
      name: GANG_NAMES[i],
      x: TURF.x + Math.cos(angle) * radius,
      y: TURF.y + Math.sin(angle) * radius,
      angle,
      orbitRadius: radius,
      orbitAngle: angle,
      orbitSpeed: 0.12 + rng.range(0, 0.08),
      speed: 0,
      health: 100,
      maxHealth: 100,
      color: GANG_COLORS[i % GANG_COLORS.length],
      alive: true,
      // A wrecked car smokes for a while before it is towed.
      wreckTimer: 0,
    });
  }
  return cars;
}

// True when a point is inside the turf.
export function inTurf(x, y) {
  return Math.hypot(x - TURF.x, y - TURF.y) < TURF.r;
}

// The gang's turf data for the HUD: how many cars are up, how many the
// player has torched, and the turf centre for the minimap marker.
export function gangStatus(state) {
  const up = state.gangCars.filter((c) => c.alive).length;
  return {
    up,
    total: state.gangCars.length,
    kills: state.gang.kills,
    turf: { x: TURF.x, y: TURF.y },
  };
}
