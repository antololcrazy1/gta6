// In-game phone side jobs: press P to open the phone (the game pauses while
// it is open) and pick one of three repeatable jobs with keys 1-3. Courier
// ($80, deliver in 60 s), Vigilante ($120, take out 2 wanted cars) and Racer
// ($150, hit 3 checkpoints in 45 s). Completing one pays out and adds +5
// respect. Pure rules — the renderer draws the phone panel and the job
// target marker from state.phone.
import { pick } from './random.js';

export const PHONE_JOBS = [
  { id: 'courier', name: 'Courier', pay: 80, desc: 'Deliver a package in 150s', time: 150 },
  { id: 'vigilante', name: 'Vigilante', pay: 120, desc: 'Take out 2 wanted cars', time: 0 },
  { id: 'racer', name: 'Racer', pay: 150, desc: 'Hit 3 checkpoints in 150s', time: 150 },
];

// v6.5: destinations scaled x3.1667 / y3.1731 for the 10x map.
const COURIER_DESTS = [
  { x: 1013, y: 812, label: 'Northwest corner' },
  { x: 10387, y: 812, label: 'Northeast corner' },
  { x: 1013, y: 5788, label: 'Southwest corner' },
  { x: 10387, y: 5788, label: 'Southeast corner' },
  { x: 4661, y: 2437, label: 'Palm Row' },
  { x: 7093, y: 4062, label: 'Midtown' },
];
const RACER_POINTS = [
  { x: 1013, y: 812 },
  { x: 10387, y: 3250 },
  { x: 2229, y: 5687 },
];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createPhone(random) {
  const rnd = random || Math.random;
  const data = { open: false, job: null };
  function start(state, jobId) {
    if (data.job) return { ok: false, msg: 'Finish the current job first.' };
    const def = PHONE_JOBS.find((j) => j.id === jobId);
    if (!def) return { ok: false, msg: 'No such job.' };
    let job;
    if (jobId === 'courier') {
      // Never hand the player a destination they are already standing on
      // (the old code paid $80 for standing still — B7).
      const far = COURIER_DESTS.filter((d) => dist(state.player.x, state.player.y, d.x, d.y) >= 400);
      const dest = pick(rnd, far.length > 0 ? far : COURIER_DESTS);
      job = { type: 'courier', pay: 80, timer: 150, target: { ...dest }, label: `Courier — deliver to ${dest.label}` };
    } else if (jobId === 'vigilante') {
      // v6.4: a 120 s clock — the old timer:0 meant the job could never fail
      // and blocked the phone forever if the player avoided all cops (B6).
      job = { type: 'vigilante', pay: 120, timer: 120, need: 2, done: 0, target: null, label: 'Vigilante — take out 2 wanted cars' };
    } else {
      job = { type: 'racer', pay: 150, timer: 150, stage: 0, target: { ...RACER_POINTS[0] }, label: 'Racer — checkpoint 1/3' };
    }
    data.job = job; data.open = false;
    state.message = `Side job started: ${def.name} — ${def.desc}.`; state.messageTimer = 3;
    return { ok: true, job };
  }
  function complete(state, job) {
    state.money += job.pay; state.respect += 5;
    state.message = `Side job done! +$${job.pay} • Respect +5`; state.messageTimer = 3;
    data.job = null;
  }
  function fail(state, why) {
    state.message = `Side job failed — ${why}.`; state.messageTimer = 3;
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
    if (job.type === 'courier' && job.target && dist(p.x, p.y, job.target.x, job.target.y) < 90) {
      complete(state, job);
    } else if (job.type === 'racer' && job.target && dist(p.x, p.y, job.target.x, job.target.y) < 90) {
      job.stage += 1;
      if (job.stage >= 3) complete(state, job);
      else {
        job.target = { ...RACER_POINTS[job.stage] };
        job.label = `Racer — checkpoint ${job.stage + 1}/3`;
        state.message = `Checkpoint ${job.stage}/3!`; state.messageTimer = 2;
      }
    }
  }
  // Called by the world whenever a cop car or a gang car is destroyed.
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
