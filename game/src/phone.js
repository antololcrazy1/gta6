// In-game phone side jobs for the v6 rebuild: press P to open the phone
// (the game pauses while it is open) and pick a repeatable job with keys
// 1-4. Courier ($80, deliver in 150 s), Vigilante ($120, take out 2 wanted
// cars in 120 s), Racer ($150, hit 3 checkpoints in 150 s) and Repo ($200,
// steal a marked parked car and deliver it to the docks in 180 s).
// Completing one pays out and adds +5 respect. The active job target gets
// a cyan diamond on the minimap. Pure rules — the HUD draws the panel.
import { pick, range } from './random.js';

export const PHONE_JOBS = [
  { id: 'courier', name: 'Courier', pay: 80, desc: 'Deliver a package in 150s', time: 150 },
  { id: 'vigilante', name: 'Vigilante', pay: 120, desc: 'Take out 2 wanted cars in 120s', time: 120 },
  { id: 'racer', name: 'Racer', pay: 150, desc: 'Hit 3 checkpoints in 150s', time: 150 },
  { id: 'repo', name: 'Repo', pay: 200, desc: 'Steal the marked car, deliver to the docks in 180s', time: 180 },
];

const COURIER_DESTS = [
  { x: 1050, y: 800, label: 'Northwest corner' },
  { x: 10350, y: 800, label: 'Northeast corner' },
  { x: 1050, y: 5800, label: 'Southwest corner' },
  { x: 10350, y: 5800, label: 'Southeast corner' },
  { x: 4350, y: 2300, label: 'Palm Row' },
  { x: 7100, y: 3800, label: 'Midtown' },
];
const RACER_POINTS = [
  { x: 1050, y: 800 },
  { x: 10350, y: 3200 },
  { x: 2400, y: 5800 },
];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createPhone(random) {
  const rnd = random || Math.random;
  const data = { open: false, job: null };
  function start(state, jobId) {
    if (data.job) return { ok: false, msg: 'Finish the current job first.' };
    const def = PHONE_JOBS.find((j) => j.id === jobId);
    if (!def) return { ok: false, msg: 'No such job.' };
    let job = null;
    if (jobId === 'courier') {
      let dest = pick(rnd, COURIER_DESTS);
      let guard = 0;
      while (dist(state.player.x, state.player.y, dest.x, dest.y) < 400 && guard < 8) {
        dest = pick(rnd, COURIER_DESTS);
        guard += 1;
      }
      job = { type: 'courier', pay: 80, timer: 150, target: { ...dest }, label: `Courier — deliver to ${dest.label}` };
    } else if (jobId === 'vigilante') {
      job = { type: 'vigilante', pay: 120, timer: 120, need: 2, done: 0, target: null, label: 'Vigilante — take out 2 wanted cars' };
    } else if (jobId === 'racer') {
      job = { type: 'racer', pay: 150, timer: 150, stage: 0, target: { ...RACER_POINTS[0] }, label: 'Racer — checkpoint 1/3' };
    } else if (jobId === 'repo') {
      const parked = state.cars.filter((c) => c.parked && !c.cop);
      const pickCar = parked.length ? parked[Math.floor(rnd() * parked.length)] : null;
      if (!pickCar) return { ok: false, msg: 'No car to repo right now.' };
      pickCar.repo = true;
      job = { type: 'repo', pay: 200, timer: 180, carId: pickCar.id, target: { x: 10500, y: 5600, label: 'Docks buyer' }, label: 'Repo — steal the marked car' };
    }
    data.job = job;
    data.open = false;
    state.message = `Side job started: ${def.name} — ${def.desc}.`;
    state.messageTimer = 3;
    return { ok: true, job };
  }
  function complete(state, job) {
    state.money += job.pay;
    state.earnedTotal += job.pay;
    state.respect += 5;
    state.message = `Side job done! +$${job.pay} • Respect +5`;
    state.messageTimer = 3;
    data.job = null;
  }
  function fail(state, why) {
    if (data.job && data.job.type === 'repo') {
      const car = state.cars.find((c) => c.id === data.job.carId);
      if (car) car.repo = false;
    }
    state.message = `Side job failed — ${why}.`;
    state.messageTimer = 3;
    data.job = null;
  }
  function update(dt, state) {
    const job = data.job;
    if (!job) return;
    if (job.timer > 0) {
      job.timer -= dt;
      if (job.timer <= 0) { fail(state, 'out of time'); return; }
    }
    const p = state.player;
    if (job.type === 'courier' && job.target && dist(p.x, p.y, job.target.x, job.target.y) < 140) {
      complete(state, job);
    } else if (job.type === 'racer' && job.target && dist(p.x, p.y, job.target.x, job.target.y) < 140) {
      job.stage += 1;
      if (job.stage >= 3) complete(state, job);
      else {
        job.target = { ...RACER_POINTS[job.stage] };
        job.label = `Racer — checkpoint ${job.stage + 1}/3`;
        state.message = `Checkpoint ${job.stage}/3!`;
        state.messageTimer = 2;
      }
    } else if (job.type === 'repo') {
      const car = state.cars.find((c) => c.id === job.carId);
      if (!car || car.health <= 0) { fail(state, 'the repo car was destroyed'); return; }
      if (p.inCar && p.carId === job.carId) {
        job.target = { x: 10500, y: 5600, label: 'Docks buyer' };
        job.label = 'Repo — deliver the car to the docks';
        if (dist(p.x, p.y, 10500, 5600) < 160) complete(state, job);
      } else if (p.inCar || dist(p.x, p.y, car.x, car.y) > 900) {
      }
    }
  }
  function onCarDestroyed(state) {
    const job = data.job;
    if (!job || job.type !== 'vigilante') return;
    job.done += 1;
    if (job.done >= job.need) complete(state, job);
    else { state.message = `Vigilante: ${job.done}/2 cars down.`; state.messageTimer = 2; }
  }
  function toggle() { data.open = !data.open; return data.open; }
  function reset() { data.open = false; data.job = null; }
  function debug() {
    return { open: data.open, job: data.job ? { type: data.job.type, timer: Math.round(data.job.timer || 0) } : null };
  }
  return { data, start, update, toggle, reset, onCarDestroyed, debug, jobs: PHONE_JOBS };
}
