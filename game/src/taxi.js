// Taxi fares: a side activity on top of the story missions. A random
// pedestrian waves for a cab; pick them up in a car, drive them to one of 8
// road intersections across the city within 45 seconds, and get paid $40–$80
// plus respect. Pure rules, no drawing — the renderer marks the waiting fare.
import { pick } from './random.js';

// 8 fixed road intersections spread across the city (ROADS_V x ROADS_H).
const DESTINATIONS = [
  { x: 320, y: 320, label: 'Northwest corner' },
  { x: 3280, y: 320, label: 'Northeast corner' },
  { x: 320, y: 2280, label: 'Southwest corner' },
  { x: 3280, y: 2280, label: 'Southeast corner' },
  { x: 1472, y: 960, label: 'Palm Row' },
  { x: 2240, y: 1600, label: 'Midtown' },
  { x: 1088, y: 1920, label: 'Arcade district' },
  { x: 2624, y: 640, label: 'Neon Hotel' },
];
const PAYS = [40, 50, 60, 80];
const PICKUP_DIST = 70;
const DELIVERY_DIST = 90;
const FARE_TIME = 45;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createTaxi(random) {
  const rnd = random || Math.random;
  function reset(state) {
    state.taxi = { waiting: null, active: null, cooldown: 12 };
  }
  function update(dt, state) {
    const taxi = state.taxi;
    if (!taxi) return;
    if (taxi.cooldown > 0) taxi.cooldown -= dt;
    const player = state.player;

    if (taxi.waiting) {
      const ped = taxi.waiting;
      if (!ped.alive) {
        // The waiting fare got run over before pickup.
        ped.fare = false; taxi.waiting = null; taxi.cooldown = 10;
        state.message = 'Your fare got run over. Ouch.'; state.messageTimer = 3;
        return;
      }
      if (player.inCar) {
        const car = state.cars.find((c) => c.id === player.carId);
        if (car && dist(car.x, car.y, ped.x, ped.y) < PICKUP_DIST) {
          const idx = state.peds.indexOf(ped);
          if (idx >= 0) state.peds.splice(idx, 1);
          ped.fare = false;
          const dest = pick(rnd, DESTINATIONS);
          taxi.active = { dest, timer: FARE_TIME, pay: pick(rnd, PAYS) };
          taxi.waiting = null;
          state.message = `Fare picked up! Deliver to ${dest.label} — $${taxi.active.pay} in ${FARE_TIME}s.`;
          state.messageTimer = 3;
        }
      }
      return;
    }

    if (taxi.active) {
      const fare = taxi.active;
      fare.timer -= dt;
      if (fare.timer <= 0) {
        taxi.active = null; taxi.cooldown = 15;
        state.message = 'Too slow — the fare got out and walked away.'; state.messageTimer = 3;
        return;
      }
      if (player.inCar) {
        const car = state.cars.find((c) => c.id === player.carId);
        if (car && dist(car.x, car.y, fare.dest.x, fare.dest.y) < DELIVERY_DIST) {
          state.money += fare.pay; state.respect += 2;
          state.message = `Fare delivered! +$${fare.pay} • Respect +2`; state.messageTimer = 3;
          taxi.active = null; taxi.cooldown = 20;
        }
      }
      return;
    }

    // No fare yet: once the cooldown is over, a random living ped waves.
    if (taxi.cooldown > 0) return;
    const living = state.peds.filter((p) => p.alive && !p.fare);
    if (living.length === 0) return;
    const ped = pick(rnd, living);
    ped.fare = true;
    taxi.waiting = ped;
    state.message = 'A customer is waving for a taxi!'; state.messageTimer = 3;
  }
  return { reset, update };
}
