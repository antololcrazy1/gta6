// Staged screenshot driver for Vice Coast.
//
// When the game boots with ?shot=<kind>&seed=<n>, this module stages one
// deterministic scene, lets the simulation settle so the chase, the
// traffic and the helicopter fall into place, then tells the driver the
// frame is ready by setting window.__shotReady. Four kinds:
//
//   chase — the hero: golden-hour sunset, five wanted stars, the police
//           helicopter overhead, cop cars and a roadblock ahead on the road.
//   play  — a daytime drive through Neon Downtown with two stars on the tail.
//   heist — mission 9 on foot among the Viper gang cars, a shot fired.
//   end   — the finale win screen at sunset, all ten missions done.
//
// Staging only moves the player, picks a car, sets the wanted level and
// the time of day, then lets the normal simulation run. It never edits
// the game itself.
import { LANDMARKS } from './config.js';
import { roadXs, roadYs } from './director.js';
import { makeRng } from './random.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The nearest road line to a point, so a staged car always sits on asphalt.
function nearestLine(lines, value) {
  let best = lines[0];
  for (const line of lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

// Jump the clock to the middle of a named phase and mirror it onto the
// state the HUD and the renderer read.
function setPhase(game, name) {
  game.world.weather.setPhase(name);
  game.state.weather.phase = name;
  game.state.weather.t = game.world.weather.t;
  game.state.weather.raining = false;
}

// Seat the player in a staged car. The car stops being traffic and stops
// being parked: it is the player's ride now.
function seatPlayerInCar(game, car) {
  const s = game.state;
  car.traffic = false;
  car.parked = false;
  car.speed = 0;
  s.player.inCar = true;
  s.player.carId = car.id;
  s.player.x = car.x;
  s.player.y = car.y;
  s.player.angle = car.angle;
  s.player.health = Math.max(s.player.health, 100);
}

// The fix that keeps a staged chase alive through the capture window:
// the hero car is made effectively unwreckable and the player effectively
// unkillable, and the player is re-seated in the car in case a ram knocked
// them out while the scene was settling. Without this, cop rams wreck the
// hero car (ejecting the player) and foot cops shoot the player dead
// before the screenshot lands.
function reinforce(game, car) {
  const s = game.state;
  if (car) {
    car.health = 10000;
    if (!s.player.inCar || s.player.carId !== car.id) {
      s.player.inCar = true;
      s.player.carId = car.id;
      s.player.x = car.x;
      s.player.y = car.y;
      s.player.angle = car.angle;
    }
  }
  s.player.health = 10000;
  s.player.armor = 100;
}

// Let the simulation run for ms while the scene settles, topping the hero
// up on a slow tick so rams and bumps cannot wreck it mid-settle.
async function settle(game, car, ms) {
  const s = game.state;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(1000, end - Date.now()));
    if (car) car.health = Math.max(car.health, 1000);
    s.player.health = Math.max(s.player.health, 100);
  }
}

// ---------------------------------------------------------------------------
// The four stages
// ---------------------------------------------------------------------------
async function stageChase(game, rng) {
  const s = game.state;
  setPhase(game, 'sunset');
  const parked = s.cars.filter((c) => c.parked);
  const hero = parked[Math.floor(rng.f() * parked.length)] || s.cars[0];
  seatPlayerInCar(game, hero);
  game.world.addWanted(5);
  // Nine seconds for the director to stage cop cars and the roadblock
  // ahead, the helicopter to circle in and the traffic to close around
  // the player.
  await settle(game, hero, 9000);
  if (s.wanted < 5) game.world.addWanted(5 - s.wanted);
  reinforce(game, hero);
  window.__shotReady = true;
}

async function stagePlay(game, rng) {
  const s = game.state;
  setPhase(game, 'day');
  // Neon Downtown, on the roads by the hotel.
  const x = nearestLine(roadXs(), LANDMARKS.neonHotel.x);
  const y = nearestLine(roadYs(), LANDMARKS.neonHotel.y);
  const parked = s.cars.filter((c) => c.parked);
  const car = parked[Math.floor(rng.f() * parked.length)] || s.cars[0];
  car.x = x;
  car.y = y;
  car.angle = 0;
  seatPlayerInCar(game, car);
  game.world.addWanted(2);
  await settle(game, car, 7000);
  if (s.wanted < 2) game.world.addWanted(2 - s.wanted);
  reinforce(game, car);
  window.__shotReady = true;
}

async function stageHeist(game) {
  const s = game.state;
  setPhase(game, 'sunset');
  game.world.startMission(8);
  // On foot among the Viper gang cars at the turf marker.
  s.player.inCar = false;
  s.player.carId = -1;
  s.player.health = 100;
  s.player.armor = 100;
  // A bullet moves 950 units a second, so a single frame's step can
  // carry it clean past a car. Shoot the way the playtest does: stand
  // next to a healthy gang car, fire, then step the world in 1/60s
  // slices so the bullet cannot tunnel past. Stop as soon as one car
  // is hurt — the frame needs at least two gang cars alive.
  const IDLE = { move: { x: 0, y: 0 }, nitro: false, handbrake: false, shoot: false };
  const hurt = () => s.gangCars.some((c) => c.health < 60);
  const healthiest = () => s.gangCars
    .filter((c) => c.health > 40)
    .sort((a, b) => b.health - a.health)[0] || null;
  const aimAt = (target) => Math.atan2(target.y - s.player.y, target.x - s.player.x);
  for (let attempt = 0; attempt < 8 && !hurt(); attempt += 1) {
    const target = healthiest() || s.gangCars.find((c) => c.health > 0);
    if (!target) break;
    s.player.x = target.x - 40;
    s.player.y = target.y;
    s.player.angle = aimAt(target);
    s.player.health = 100;
    game.world.shoot(s.player.angle);
    for (let i = 0; i < 30; i += 1) game.world.step(1 / 60, IDLE, false);
    await sleep(50);
  }
  // One last shot as the capture opens, so a bullet is in flight. If
  // every gang car is already hurt, fire past the turf instead of
  // finishing one off.
  const fresh = healthiest();
  if (fresh) {
    s.player.x = fresh.x - 40;
    s.player.y = fresh.y;
    s.player.angle = aimAt(fresh);
  } else {
    s.player.angle = aimAt(LANDMARKS.turf);
  }
  game.world.shoot(s.player.angle);
  s.player.health = 100;
  window.__shotReady = true;
}

async function stageEnd(game) {
  setPhase(game, 'sunset');
  game.world.debugWin();
  // Give the loop a moment to flip to the win screen, which shows the
  // real dynamic total, before the capture.
  await sleep(2000);
  window.__shotReady = true;
}

const STAGES = {
  chase: stageChase,
  play: stagePlay,
  heist: stageHeist,
  end: stageEnd,
};

// Stage one shot by kind. The seed steadies the driver's own picks; the
// world itself is seeded at boot.
export async function stageShot(game, kind, seed) {
  const stage = STAGES[kind];
  if (!stage) throw new Error(`unknown shot kind: ${kind}`);
  const rng = makeRng(seed || 31);
  await stage(game, rng);
}
