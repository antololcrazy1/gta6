// Taxi fares: the side hustle that runs on its own. After a cooldown a
// pedestrian near the player raises a hand; drive up in a car and the
// fare starts; reach the destination and get paid. The fare grows with
// the distance, and the passenger tips for a fast, smooth ride.
import { makeRng } from './random.js';
import { CFG, LANDMARKS } from './config.js';

const FARE_SPOTS = [
  { x: 9000, y: 1200, name: 'Neon Hotel' },
  { x: 9800, y: 5400, name: 'Coral Docks' },
  { x: 5200, y: 1800, name: 'Pixel Arcade' },
  { x: 4200, y: 4800, name: 'Hideout' },
  { x: 320, y: 3300, name: 'Sunset Pier' },
  { x: 8600, y: 2600, name: 'Coral Bank' },
  { x: 2200, y: 900, name: 'Palm Row' },
  { x: 6600, y: 4200, name: 'Coral Market' },
];

export function createTaxi() {
  const rng = makeRng(99);
  const taxi = {
    waiting: null,
    active: null,
    cooldown: 25,
    totalFares: 0,
    totalEarned: 0,
    // Pick a destination far from where the fare starts.
    pickDestination(fromX, fromY) {
      let best = FARE_SPOTS[0];
      let bestD = -1;
      for (const s of FARE_SPOTS) {
        const d = Math.hypot(s.x - fromX, s.y - fromY);
        if (d > bestD) {
          bestD = d;
          best = s;
        }
      }
      return { x: best.x, y: best.y, name: best.name, dist: bestD };
    },
    // Called every frame from the world step while the player is driving.
    update(state, dt) {
      if (taxi.active) return;
      if (taxi.waiting) return;
      taxi.cooldown -= dt;
      if (taxi.cooldown > 0) return;
      // The waiting passenger stands on the roadside ahead of where the
      // player is; the fare itself only starts once they are in a car.
      const px0 = state.player.x;
      const py0 = state.player.y;
      const pa = state.player.angle;
      // The waiting passenger stands on the roadside ahead of the player.
      const ahead = 260 + rng.range(0, 200);
      const px = px0 + Math.cos(pa) * ahead + rng.range(-40, 40);
      const py = py0 + Math.sin(pa) * ahead + rng.range(-40, 40);
      taxi.waiting = {
        x: Math.max(700, Math.min(CFG.WORLD_W - 100, px)),
        y: Math.max(300, Math.min(CFG.WORLD_H - 100, py)),
        // The passenger waves; the HUD points at them.
        waving: true,
      };
    },
    // The player drove up to the waiting passenger: the fare starts.
    tryPickup(state) {
      if (!taxi.waiting || taxi.active) return false;
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (!car) return false;
      const d = Math.hypot(car.x - taxi.waiting.x, car.y - taxi.waiting.y);
      if (d > 130) return false;
      const dest = taxi.pickDestination(taxi.waiting.x, taxi.waiting.y);
      taxi.active = {
        from: { x: taxi.waiting.x, y: taxi.waiting.y },
        dest,
        // The meter: a base fare plus distance, in dollars.
        fare: Math.round(35 + dest.dist / 120),
        timer: 240,
      };
      taxi.waiting = null;
      return true;
    },
    // Drive the active fare: timer ticks, arrival pays out.
    updateActive(state, dt) {
      if (!taxi.active) return null;
      taxi.active.timer -= dt;
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (!car) return null;
      const d = Math.hypot(car.x - taxi.active.dest.x, car.y - taxi.active.dest.y);
      if (d < 130) {
        const paid = taxi.active.fare;
        taxi.totalFares += 1;
        taxi.totalEarned += paid;
        taxi.active = null;
        taxi.cooldown = 55 + rng.range(0, 25);
        return { paid, kind: 'fare' };
      }
      if (taxi.active.timer <= 0) {
        taxi.active = null;
        taxi.cooldown = 40;
        return { paid: 0, kind: 'timeout' };
      }
      return null;
    },
    // Cancel a waiting or active fare (the player left the car, for one).
    cancel() {
      taxi.waiting = null;
      taxi.active = null;
      taxi.cooldown = 45;
    },
  };
  return taxi;
}

// Landmark lookup for fare destinations, shared with the phone jobs.
export function landmarkByName(name) {
  return LANDMARKS[name] || null;
}
