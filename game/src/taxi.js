// Taxi fares for the v6 rebuild: a side activity on top of the story.
// A random pedestrian waves for a cab; pick them up in a car, drive them
// to one of nine road intersections across the big city within 150 seconds,
// and get paid $40–$80 plus respect. Retimed for the 11400x6600 map: the
// pickup wait is 30 seconds and the delivery clock is 150. Pure rules —
// the renderer marks the waiting fare and the destination.
import { pick } from './random.js';

const DESTINATIONS = [
  { x: 1050, y: 800, label: 'Northwest corner' },
  { x: 10350, y: 800, label: 'Northeast corner' },
  { x: 1050, y: 5800, label: 'Southwest corner' },
  { x: 10350, y: 5800, label: 'Southeast corner' },
  { x: 4350, y: 2300, label: 'Palm Row' },
  { x: 7100, y: 3800, label: 'Midtown' },
  { x: 3600, y: 4800, label: 'Arcade district' },
  { x: 8300, y: 1300, label: 'Neon Hotel' },
  { x: 2400, y: 2300, label: 'Palm Row west' },
];
const PAYS = [40, 50, 60, 80];
const PICKUP_DIST = 110;
const DELIVERY_DIST = 140;
const FARE_TIME = 150;
const WAIT_TIME = 30;

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
      taxi.waitTimer -= dt;
      if (!ped.alive || taxi.waitTimer <= 0) {
        ped.fare = false;
        taxi.waiting = null;
        taxi.cooldown = 10;
        if (ped.alive) { state.message = 'The fare got tired of waiting.'; state.messageTimer = 3; }
        else { state.message = 'Your fare got run over. Ouch.'; state.messageTimer = 3; }
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
        taxi.active = null;
        taxi.cooldown = 15;
        state.message = 'Too slow — the fare got out and walked away.';
        state.messageTimer = 3;
        return;
      }
      if (player.inCar) {
        const car = state.cars.find((c) => c.id === player.carId);
        if (car && dist(car.x, car.y, fare.dest.x, fare.dest.y) < DELIVERY_DIST) {
          state.money += fare.pay;
          state.earnedTotal += fare.pay;
          state.respect += 2;
          state.message = `Fare delivered! +$${fare.pay} • Respect +2`;
          state.messageTimer = 3;
          taxi.active = null;
          taxi.cooldown = 20;
        }
      }
      return;
    }

    if (taxi.cooldown > 0) return;
    const living = state.peds.filter((p) => p.alive && !p.fare);
    if (living.length === 0) return;
    const ped = pick(rnd, living);
    ped.fare = true;
    taxi.waiting = ped;
    taxi.waitTimer = WAIT_TIME;
    state.message = 'A customer is waving for a taxi!';
    state.messageTimer = 3;
  }
  // Round 7: a one-line summary of the fare state for the HUD and the
  // playtest — waiting, active with its destination and timer, or idle.
  function fareSummary(state) {
    const taxi = state.taxi;
    if (!taxi) return { status: 'idle' };
    if (taxi.waiting) return { status: 'waiting', waitTimer: Math.ceil(taxi.waitTimer) };
    if (taxi.active) {
      return {
        status: 'active',
        dest: taxi.active.dest.label,
        timer: Math.ceil(taxi.active.timer),
        pay: taxi.active.pay,
      };
    }
    return { status: 'idle', cooldown: Math.ceil(taxi.cooldown) };
  }
  return { reset, update, fareSummary };
}
