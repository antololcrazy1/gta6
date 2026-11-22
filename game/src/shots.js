// The staged screenshot driver. The game reads ?shot=chase|play|heist|end
// (and &seed=) from the URL and sets up a deterministic scene for that
// shot, then tells the page it is ready. The four shots are the hero
// sunset chase, a daytime play shot, the heist, and the win screen —
// newest first, hero first, seed 31.
import { makeRng } from './random.js';

// Put the player in a car on a road, heading east, ready to drive.
function putPlayerInCar(game, x, y, angle) {
  const { state, world } = game;
  const car = state.cars.find((c) => c.parked) || state.cars[0];
  car.traffic = false;
  car.parked = false;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.health = 100;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.inCar = true;
  state.player.carId = car.id;
  state.player.health = 100;
  state.player.armor = 100;
}

// Run the world a few frames so traffic, cops and the helicopter settle
// into their staged positions before the shot is taken.
function settle(game, frames) {
  const { world } = game;
  for (let i = 0; i < frames; i += 1) {
    world.step(1 / 60, { move: { x: 0, y: 0 } }, false);
  }
}

// Sync the state's weather snapshot from the controller. The live loop
// does this every step, but the end shot finishes the run before any
// step runs again, so staging syncs it by hand.
function syncWeather(game) {
  const { state, world } = game;
  state.weather.phase = world.weather.phase();
  state.weather.t = world.weather.t;
  state.weather.raining = world.weather.raining;
  state.sunDirection = world.weather.sunDirection();
}

export function stageShot(game, kind, seed) {
  const { state, world } = game;
  const rng = makeRng(seed || 31);
  state.player.health = 100;
  state.player.armor = 100;

  if (kind === 'chase') {
    // The hero frame: golden-hour sunset, five stars, the helicopter
    // overhead, cop cars and a roadblock ahead on the road.
    world.weather.setPhase('sunset');
    syncWeather(game);
    putPlayerInCar(game, 5000, 3300, 0);
    // The hero car sits still while half a dozen cop cars ram it, and
    // the screenshot capture itself takes seconds on a slow renderer —
    // a stock car is wrecked and the player thrown out before the
    // frame is taken. Reinforce the staged car so the chase holds
    // together for the whole capture window, then heat it up.
    const heroCar = state.cars.find((c) => c.id === state.player.carId);
    if (heroCar) heroCar.health = 10000;
    world.addWanted(5);
    settle(game, 40);
    // Belt and braces: the player must still be seated in the hero
    // car when the frame is taken, whatever the settle did. Foot cops
    // also chip the player through the car while it sits still, and
    // a dead player flips the game to the game-over screen mid
    // capture — so the staged player is reinforced as well.
    if (heroCar) {
      state.player.inCar = true;
      state.player.carId = heroCar.id;
      state.player.x = heroCar.x;
      state.player.y = heroCar.y;
      state.player.angle = heroCar.angle;
      state.player.health = 10000;
      state.player.armor = 10000;
    }
  } else if (kind === 'play') {
    // Daytime driving through town with two stars on the tail.
    world.weather.setPhase('day');
    syncWeather(game);
    putPlayerInCar(game, 4000, 2800, 0);
    world.addWanted(2);
    settle(game, 30);
  } else if (kind === 'heist') {
    // Mission nine at sunset: on foot among the gang cars, a shot
    // fired, one rival car already burning.
    world.weather.setPhase('sunset');
    syncWeather(game);
    world.startMission(8);
    state.player.inCar = false;
    state.player.carId = -1;
    state.player.x = 8300;
    state.player.y = 2400;
    state.player.ammo = 240;
    state.player.health = 100;
    state.player.armor = 100;
    const hurt = state.gangCars.find((c) => c.alive);
    if (hurt) hurt.health = 40;
    const target = state.gangCars.find((c) => c.alive && c !== hurt) || hurt;
    if (target) {
      const a = Math.atan2(target.y - state.player.y, target.x - state.player.x);
      state.player.angle = a;
      world.shoot(a);
    }
    settle(game, 6);
    // Fire once more so a fresh bullet is in the air for the frame.
    if (target) {
      const a = Math.atan2(target.y - state.player.y, target.x - state.player.x);
      state.player.fireCd = 0;
      world.shoot(a);
    }
  } else if (kind === 'end') {
    // The finale win: ten missions done, the real dynamic total.
    world.weather.setPhase('sunset');
    syncWeather(game);
    for (let i = 0; i < 10; i += 1) world.completeMission();
    syncWeather(game);
    settle(game, 10);
  }
  // The caller (main.js) sets window.__shotReady after a couple of
  // rendered frames; the state is already staged here.
  return true;
}

// The four shots, in manifest order: hero first.
export const SHOT_KINDS = ['chase', 'play', 'heist', 'end'];
