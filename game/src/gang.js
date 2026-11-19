// Rival gang: the Vipers hold three turf districts across Vice Coast. Gang
// cars (purple paint, gold trim) patrol their turf and do drive-bys on the
// player while the heat is low; torching one raises respect +5 and drops
// cash. Pure rules — the renderer draws the turf tint, the markers and the
// cars from state.gangCars. The world passes a ctx with the helpers it owns
// (burst, collide, hurtPlayer, onDriveby, onGangKill).
import { pick, range } from './random.js';

// Three turf districts: Neon Downtown (mission 9's turf), the Coral Docks
// and Southside. Each holds at least one gang car at all times.
export const GANG_TURF = [
  { x: 2624, y: 960, r: 340, name: 'Neon Downtown' },
  { x: 3200, y: 2240, r: 300, name: 'Coral Docks' },
  { x: 1472, y: 2240, r: 300, name: 'Southside' },
];
const GANG_PAINTS = ['#7b2fbe', '#8e44ad', '#6c3483', '#9b59b6'];
const GANG_HEALTH = 60;
const DRIVEBY_RANGE = 340;
const DRIVEBY_CD = 2.5;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function createGang(random) {
  const rnd = random || Math.random;
  let nextId = 500;
  function reset(state) {
    state.gangCars.length = 0;
    state.gang = { kills: 0, respawn: 0 };
    for (let i = 0; i < GANG_TURF.length; i += 1) spawnCar(state, i);
  }
  function spawnCar(state, turfIdx) {
    const turf = GANG_TURF[turfIdx];
    const a = rnd() * Math.PI * 2;
    const id = nextId; nextId += 1;
    const car = {
      id,
      x: clamp(turf.x + Math.cos(a) * turf.r * 0.5, 320, 3560),
      y: clamp(turf.y + Math.sin(a) * turf.r * 0.5, 100, 2560),
      angle: rnd() * Math.PI * 2, speed: 0, health: GANG_HEALTH,
      color: pick(rnd, GANG_PAINTS), gang: true, turf: turfIdx,
      patrolX: turf.x, patrolY: turf.y, shootCd: range(rnd, 1, 2.5),
      retarget: 0, fleeing: false,
    };
    state.gangCars.push(car);
    return car;
  }
  // Make sure a turf holds at least n gang cars (mission 9 wants 3 in Neon
  // Downtown before the turf war starts).
  function ensureTurfCars(state, turfIdx, n) {
    let count = state.gangCars.filter((c) => c.turf === turfIdx).length;
    while (count < n) { spawnCar(state, turfIdx); count += 1; }
  }
  function destroyCar(state, car, ctx) {
    const idx = state.gangCars.indexOf(car);
    if (idx < 0) return;
    state.gangCars.splice(idx, 1);
    const cash = 40 + Math.floor(rnd() * 40);
    state.money += cash; state.respect += 5; state.gang.kills += 1;
    if (state.missionIndex === 8 && state.missionStage === 0) state.gangMissionKills += 1;
    state.message = `Rival car torched! +$${cash} • Respect +5`; state.messageTimer = 3;
    if (ctx && ctx.burst) ctx.burst(car.x, car.y, '#ff5722', 22, 300);
    if (ctx && ctx.onGangKill) ctx.onGangKill();
  }
  function update(dt, state, ctx) {
    const player = state.player;
    // Keep one car per turf: a torched car is replaced after a short delay.
    state.gang.respawn -= dt;
    for (let i = 0; i < GANG_TURF.length; i += 1) {
      if (!state.gangCars.some((c) => c.turf === i) && state.gang.respawn <= 0) {
        spawnCar(state, i);
        state.gang.respawn = 18;
      }
    }
    // During the turf hold (mission 9, stage 1) the survivors flee instead of
    // fighting — the player already won the turf.
    const holding = state.missionIndex === 8 && state.missionStage === 1;
    for (const car of state.gangCars) {
      car.shootCd -= dt; car.retarget -= dt;
      const turf = GANG_TURF[car.turf];
      const playerNearTurf = dist(player.x, player.y, turf.x, turf.y) < turf.r + 220;
      let targetX = car.patrolX, targetY = car.patrolY, wantSpeed = 150;
      if (holding) {
        car.fleeing = true;
        const away = angleTo(player.x, player.y, car.x, car.y);
        targetX = car.x + Math.cos(away) * 300; targetY = car.y + Math.sin(away) * 300;
        wantSpeed = 320;
      } else if (playerNearTurf && state.wanted <= 1) {
        // Drive-by: close in on the player and shoot from the window.
        targetX = player.x; targetY = player.y; wantSpeed = 380;
        const d = dist(car.x, car.y, player.x, player.y);
        if (d < DRIVEBY_RANGE && car.shootCd <= 0) {
          car.shootCd = DRIVEBY_CD;
          const a = angleTo(car.x, car.y, player.x, player.y);
          state.bullets.push({
            x: car.x + Math.cos(a) * 26, y: car.y + Math.sin(a) * 26,
            vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, life: 0.9, gang: true,
          });
          if (ctx && ctx.onDriveby) ctx.onDriveby();
        }
      } else if (car.retarget <= 0 || dist(car.x, car.y, car.patrolX, car.patrolY) < 60) {
        const a = rnd() * Math.PI * 2, r = rnd() * turf.r * 0.7;
        car.patrolX = clamp(turf.x + Math.cos(a) * r, 320, 3560);
        car.patrolY = clamp(turf.y + Math.sin(a) * r, 100, 2560);
        car.retarget = range(rnd, 4, 9);
      }
      const want = angleTo(car.x, car.y, targetX, targetY);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
      car.speed = clamp(car.speed + (wantSpeed - car.speed) * dt * 0.8, 0, wantSpeed);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (ctx && ctx.collide && ctx.collide(nx, ny, 26).hit) { car.angle += 0.9; car.speed *= 0.6; }
      else { car.x = clamp(nx, 150, 3580); car.y = clamp(ny, 60, 2580); }
    }
  }
  function debug(state) {
    return {
      cars: state.gangCars.length,
      kills: state.gang.kills,
      turf: GANG_TURF.map((t, i) => ({ name: t.name, cars: state.gangCars.filter((c) => c.turf === i).length })),
    };
  }
  return { reset, update, spawnCar, ensureTurfCars, destroyCar, debug };
}
