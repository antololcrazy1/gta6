// The phone: side jobs the player picks up with the number keys while the
// phone is open (P). Four jobs: Courier, Food delivery, Taxi dispatch and
// Repo. Each job has a target, a timer and a payout; reaching the target
// pays out and clears the job. The phone pauses the game while it is open.
import { LANDMARKS } from './config.js';
import { makeRng } from './random.js';

const JOB_DEFS = [
  { key: '1', type: 'courier', name: 'Courier', pay: 80, timer: 150, desc: 'Deliver the package' },
  { key: '2', type: 'food', name: 'Food Delivery', pay: 60, timer: 120, desc: 'Hot food, fast driver' },
  { key: '3', type: 'dispatch', name: 'Taxi Dispatch', pay: 50, timer: 120, desc: 'Pick up a fare' },
  { key: '4', type: 'repo', name: 'Repo', pay: 120, timer: 180, desc: 'Bring back the marked car' },
];

const JOB_SPOTS = [
  LANDMARKS.neonHotel,
  LANDMARKS.coralDocks,
  LANDMARKS.pixelArcade,
  LANDMARKS.sunsetPier,
  LANDMARKS.coralBank,
  LANDMARKS.hideout,
  LANDMARKS.palmRow,
];

export function createPhone() {
  const rng = makeRng(4242);
  const phone = {
    open: false,
    job: null,
    jobsDone: 0,
    earned: 0,
    defs: JOB_DEFS,
    // Open or close the phone. Opening pauses the game (the main loop
    // reads phone.open and switches to the paused screen).
    toggle() {
      phone.open = !phone.open;
      return phone.open;
    },
    // Start a job by its number key ('1'..'4'). Returns the job or null.
    startJob(state, key) {
      const def = JOB_DEFS.find((d) => d.key === key);
      if (!def) return null;
      if (phone.job) return phone.job;
      let target = null;
      let carId = -1;
      if (def.type === 'repo') {
        // A repo job marks one parked car; the player must reach it.
        const parked = state.cars.filter((c) => c.parked);
        const car = parked.length ? parked[Math.floor(rng.f() * parked.length)] : null;
        if (!car) return null;
        car.repo = true;
        carId = car.id;
        target = { x: car.x, y: car.y, name: 'Marked car' };
      } else {
        // Other jobs send the player to a landmark away from them.
        let spot = JOB_SPOTS[Math.floor(rng.f() * JOB_SPOTS.length)];
        let guard = 0;
        while (Math.hypot(spot.x - state.player.x, spot.y - state.player.y) < 1200 && guard < 10) {
          spot = JOB_SPOTS[Math.floor(rng.f() * JOB_SPOTS.length)];
          guard += 1;
        }
        target = { x: spot.x, y: spot.y, name: spot.name };
      }
      phone.job = {
        type: def.type,
        name: def.name,
        pay: def.pay,
        timer: def.timer,
        target,
        carId,
        desc: def.desc,
      };
      return phone.job;
    },
    // Tick the active job: the timer runs down and arrival pays out.
    // Returns { paid } when the job completes, { failed: true } on
    // timeout, and null while the job is still running.
    update(state, dt) {
      if (!phone.job) return null;
      const job = phone.job;
      job.timer -= dt;
      const d = Math.hypot(state.player.x - job.target.x, state.player.y - job.target.y);
      if (d < 130) {
        const paid = job.pay;
        if (job.type === 'repo' && job.carId >= 0) {
          const car = state.cars.find((c) => c.id === job.carId);
          if (car) {
            car.repo = false;
            car.parked = false;
          }
        }
        phone.job = null;
        phone.jobsDone += 1;
        phone.earned += paid;
        state.money += paid;
        state.earnedTotal += paid;
        return { paid, job: job.type };
      }
      if (job.timer <= 0) {
        if (job.type === 'repo' && job.carId >= 0) {
          const car = state.cars.find((c) => c.id === job.carId);
          if (car) car.repo = false;
        }
        phone.job = null;
        return { failed: true, job: job.type };
      }
      return null;
    },
    // Abandon the current job without pay.
    cancel(state) {
      if (phone.job && phone.job.type === 'repo' && phone.job.carId >= 0) {
        const car = state.cars.find((c) => c.id === phone.job.carId);
        if (car) car.repo = false;
      }
      phone.job = null;
    },
  };
  return phone;
}
