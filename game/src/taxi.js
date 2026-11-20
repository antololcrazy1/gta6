// Taxi fares: a side activity on top of the story missions. A random
// pedestrian waves for a cab; pick them up in a car, drive them to one of 9
// road intersections across the city within 45 seconds, and get paid $40–$80
// plus respect. Pure rules, no drawing — the renderer marks the waiting fare.
// v5 adds a ninth destination on Palm Row west.
import { pick } from './random.js';

// 9 fixed road intersections spread across the city (ROADS_V x ROADS_H).
// v6.5: destinations scaled x3.1667 / y3.1731 for the 10x map.
const DESTINATIONS = [
  { x: 1013, y: 812, label: 'Northwest corner' },
  { x: 10387, y: 812, label: 'Northeast corner' },
  { x: 1013, y: 5788, label: 'Southwest corner' },
  { x: 10387, y: 5788, label: 'Southeast corner' },
  { x: 4661, y: 2437, label: 'Palm Row' },
  { x: 7093, y: 4062, label: 'Midtown' },
  { x: 3445, y: 4874, label: 'Arcade district' },
  { x: 8309, y: 1625, label: 'Neon Hotel' },
  { x: 2229, y: 2437, label: 'Palm Row west' },
];
const PAYS = [40, 50, 60, 80];
const PICKUP_DIST = 70;
const DELIVERY_DIST = 90;
const FARE_TIME = 150; // v6.5: cross-map fares need the longer clock

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createTaxi(random) {
  const rnd = random || Math.random;
  function reset(state) {
    state.taxi = { waiting: null, active: null, cooldown: 12, waitTimer: 0 };
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
      // A waiting fare gives up after 30 s — the old code left them waving
      // forever and blocked every new fare (B8).
      taxi.waitTimer -= dt;
      if (taxi.waitTimer <= 0) {
        ped.fare = false; taxi.waiting = null; taxi.cooldown = 8;
        state.message = 'The customer gave up waiting for a cab.'; state.messageTimer = 3;
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
    taxi.waitTimer = 30;
    state.message = 'A customer is waving for a taxi!'; state.messageTimer = 3;
  }
  return { reset, update };
}
