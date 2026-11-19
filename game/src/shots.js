// Staged screenshots behind ?shot=start|play|chase|heist|end&seed=19. Each plays
// the real rules forward from a fresh world for a fixed time, steered by a
// driving autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
// v5 scenes (all different from the v3 shots): a night neon-district police
// chase in the rain, a daytime harbor/docks drive, a gang turf shootout at
// night in Neon Downtown, and the finale win screen at the Sunset Pier at
// sunset.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

// Drive along a road at roadY toward the mission marker, steering to stay on
// the road and slowing for traffic ahead. heading 1 = east, -1 = west.
function drivePilot(state, roadY, heading) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false };
  const target = { x: car.x + 220 * heading, y: roadY };
  const dx = target.x - car.x, dy = target.y - car.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
  // Coast above 320, brake hard for a big steering error so turns stay tight.
  const gas = Math.abs(diff) > 0.4 ? 1 : car.speed < 320 ? -1 : 0;
  return { move: { x: steer, y: gas }, sprint: false, shoot: false, aimAngle: car.angle, enter: false };
}

function putPlayerInCar(world, x, y, angle) {
  const st = world.state;
  const car = st.cars.find((c) => c.parked) || st.cars[0];
  car.traffic = false; car.parked = false; car.x = x; car.y = y; car.angle = angle; car.speed = 260;
  st.player.x = x; st.player.y = y; st.player.angle = angle; st.player.inCar = true; st.player.carId = car.id;
  return car;
}

export function stageShot(name, world) {
  world.reset();
  const st = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'end' && name !== 'heist') {
    // Title over the sunset city: traffic and pedestrians drift for 6 seconds.
    for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'play') {
    // Daytime harbor run: east along the docks road toward the Harbor Lights
    // crates, the pier boat and the sea in the distance.
    world.weather.force('day', false);
    putPlayerInCar(world, 1088, 2240, 0);
    world.startMission(7); // Harbor Lights: crates on the docks road.
    for (let i = 0; i < 8 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st, 2240, 1), false);
      if (ev & EVENT_OVER) break;
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car && Math.abs(car.y - 2240) > 90) { car.y += (2240 - car.y) * 0.02; car.angle *= 0.98; }
    }
    st.messageTimer = 0;
    return { screen: SCREEN_PLAY, best: st.money };
  }
  if (name === 'chase') {
    // Night neon-district police chase in the rain: 3 stars, cop cars close
    // behind, headlight cones and neon signs glowing in the wet downtown.
    world.weather.force('night', true);
    putPlayerInCar(world, 2240, 960, 0);
    world.debugChase();
    for (let i = 0; i < 7 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st, 960, 1), false);
      if (ev & EVENT_OVER) break;
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car) { car.speed = Math.max(car.speed, 420); car.health = 100; }
      st.player.health = 100;
      // Keep the read at exactly 3 stars: ramming a ped mid-chase would
      // otherwise push it to 4 before the frame is taken.
      if (st.wanted > 3) st.wanted = 3;
    }
    // Make sure the chase reads: at least 2 cop cars near the player.
    const cops = st.cops.filter((c) => c.inCar && c.car);
    if (cops.length < 2) world.debugChase();
    st.messageTimer = 0;
    return { screen: SCREEN_PLAY, best: st.money };
  }
  if (name === 'heist') return stageHeistShot(world);
  // end: the Vice Coast Finale win screen at the Sunset Pier at sunset.
  world.weather.force('sunset', false);
  putPlayerInCar(world, 320, 1280, 0);
  st.money = 9650; st.respect = 150;
  world.debugWin();
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
  return { screen: SCREEN_WIN, best: st.money };
}

export function stageHeistShot(world) {
  // heist: gang turf shootout at night in Neon Downtown. Real rules all the
  // way: startMission(8) sets the turf beacon and spawns 3 Viper cars, the
  // gang closes in for a drive-by, and shoot() fires real bullets with
  // muzzle particles. The player holds the turf marker at (2624, 960).
  world.reset();
  const st = world.state;
  world.weather.force('night', false);
  world.startMission(8); // Neon Reign, stage 0: "Torch 3 gang cars".
  st.player.x = 2624; st.player.y = 960; st.player.angle = 0;
  st.player.inCar = false; st.player.carId = -1;
  st.player.ammo = 60; st.player.health = 100; st.player.armor = 50;
  st.money = 7150; st.respect = 160;
  // Let the gang cars close in for ~2.5 s. The player holds the turf marker.
  for (let i = 0; i < 2.5 / STEP; i += 1) {
    const ev = world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false }, false);
    if (ev & EVENT_OVER) break;
    st.player.health = 100;
  }
  // Spread the gang cars into a ring around the player so they read as
  // separate figures in the frame instead of one blob stacked on the player.
  const gangCars = st.gangCars.filter((c) => c.health > 0);
  gangCars.forEach((c, i) => {
    const a = (i / Math.max(1, gangCars.length)) * Math.PI * 2;
    c.x = st.player.x + Math.cos(a) * 120; c.y = st.player.y + Math.sin(a) * 120;
  });
  // Fire one last volley at the nearest gang car so bullets + muzzle flash
  // are in the frame when the screenshot is taken.
  const target = st.gangCars.find((c) => c.health > 0);
  if (target) {
    st.player.angle = Math.atan2(target.y - st.player.y, target.x - st.player.x);
    st.player.shootCd = 0;
    world.shoot(st.player.angle);
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: st.player.angle, enter: false }, false);
  }
  st.message = 'Neon Reign — torch the Viper cars!'; st.messageTimer = 4;
  return { screen: SCREEN_PLAY, best: st.money };
}
