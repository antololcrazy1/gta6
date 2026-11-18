// Vice Coast taxi fares — a side activity beside the story missions, the
// kind of thing that makes the city feel alive between jobs. A pedestrian
// waves for a cab: stop beside them in a car and they get in; a gold marker
// points at their destination; deliver in time for cash and respect.
// Pure rules, no drawing: the live fare state lives on the world state
// (state.taxi) so the renderer and tests can read it.
const WAIT_TIME = 45; // seconds to reach the destination once picked up
const PICKUP_RANGE = 70; // car must be this close to the waving ped
const DELIVER_RANGE = 90; // car must be this close to the destination
const FARE_PAY = [40, 50, 60, 80]; // pay scales with the trip, picked at random

// Destinations are road intersections spread across the whole city, so a
// fare always sends the player somewhere new.
const DESTS = [
  { x: 320, y: 320, label: 'North Pier' },
  { x: 3392, y: 320, label: 'East Beach' },
  { x: 320, y: 2240, label: 'West Marina' },
  { x: 3392, y: 2240, label: 'South Docks' },
  { x: 1856, y: 640, label: 'Palm Row' },
  { x: 2624, y: 1920, label: 'Hotel District' },
  { x: 1088, y: 1600, label: 'Old Town' },
  { x: 2240, y: 960, label: 'Market Square' },
];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createTaxi() {
  function playerCar(state) {
    if (!state.player.inCar) return null;
    return state.cars.find((c) => c.id === state.player.carId) || null;
  }

  return {
    // Fresh fare state for a new run. Called from world.reset().
    reset(state) {
      state.taxi = { waiting: null, active: null, cooldown: 12 };
    },

    // One fixed step. Spawns a waving ped, picks them up, pays on delivery,
    // or drops the fare when the timer runs out.
    update(dt, state) {
      const t = state.taxi;
      if (!t) return;
      if (t.cooldown > 0) t.cooldown -= dt;

      // No fare on: after a short cooldown, a random living ped starts waving.
      if (!t.waiting && !t.active && t.cooldown <= 0) {
        const cands = state.peds.filter((p) => p.alive && !p.fare);
        if (cands.length > 0) {
          const p = cands[Math.floor(Math.random() * cands.length)];
          p.fare = true; // the world stops wandering this ped; the renderer waves them
          t.waiting = p;
        }
      }

      // Pickup: the player must be in a car, close to the waving ped.
      if (t.waiting) {
        const p = t.waiting;
        if (!p.alive) {
          // Run over while waiting: the fare is gone, try again later.
          p.fare = false;
          t.waiting = null;
          t.cooldown = 10;
        } else {
          const car = playerCar(state);
          if (car && dist(car.x, car.y, p.x, p.y) < PICKUP_RANGE) {
            const i = state.peds.indexOf(p);
            if (i >= 0) state.peds.splice(i, 1); // they are in the car now
            const dest = DESTS[Math.floor(Math.random() * DESTS.length)];
            const pay = FARE_PAY[Math.floor(Math.random() * FARE_PAY.length)];
            t.active = { dest, timer: WAIT_TIME, pay };
            t.waiting = null;
            state.message = `Fare picked up! Take them to ${dest.label} — $${pay} in ${WAIT_TIME}s.`;
            state.messageTimer = 3;
          }
        }
      }

      // Delivery: close to the destination in the car, in time.
      if (t.active) {
        const f = t.active;
        f.timer -= dt;
        const car = playerCar(state);
        if (car && dist(car.x, car.y, f.dest.x, f.dest.y) < DELIVER_RANGE) {
          state.money += f.pay;
          state.respect += 2;
          state.message = `Fare delivered! +$${f.pay}  •  Respect +2`;
          state.messageTimer = 3;
          t.active = null;
          t.cooldown = 20;
        } else if (f.timer <= 0) {
          state.message = 'Too slow — the fare got out and walked away.';
          state.messageTimer = 3;
          t.active = null;
          t.cooldown = 15;
        }
      }
    },
  };
}
