// Staged screenshots for the v6 rebuild, behind ?shot=chase|play|heist|end
// &seed=19. Each plays the real rules forward from a fresh world for a
// fixed time, steered by a driving autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
// Hero first: a golden-hour sunset five-star chase down the beach boulevard
// with cop cars, the police helicopter and dense traffic in frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './hud.js';

function drivePilot(state, roadY, heading) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false };
  const target = { x: car.x + 400 * heading, y: roadY };
  const dx = target.x - car.x, dy = target.y - car.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
  const gas = Math.abs(diff) > 0.5 ? 1 : car.speed < 340 ? -1 : 0;
  return { move: { x: steer, y: gas }, sprint: false, shoot: false, aimAngle: car.angle, enter: false };
}

function putPlayerInCar(world, x, y, angle) {
  const st = world.state;
  const car = st.cars.find((c) => c.parked) || st.cars[0];
  car.traffic = false; car.parked = false; car.x = x; car.y = y; car.angle = angle; car.speed = 300;
  st.player.x = x; st.player.y = y; st.player.angle = angle; st.player.inCar = true; st.player.carId = car.id;
  return car;
}

export function stageShot(name, world) {
  world.reset();
  const st = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'end' && name !== 'heist') {
    for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'chase') {
    world.weather.force('sunset', false);
    putPlayerInCar(world, 3400, 3050, Math.PI);
    world.addWanted(5, true);
    for (let i = 0; i < 7 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st, 3050, -1), false);
      if (ev & EVENT_OVER) break;
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car) { car.speed = Math.max(car.speed, 380); car.health = 100; }
      st.player.health = 100;
      if (st.wanted < 5) st.wanted = 5;
    }
    // Pull two pursuit cars into the frame flanking the road ahead so the
    // chase reads, without sitting between the camera and the player car.
    const pursuits = st.cops.filter((c) => c.inCar && c.car).slice(0, 2);
    pursuits.forEach((cop, i) => {
      const ahead = 260 + i * 90;
      const side = i === 0 ? -120 : 120;
      cop.car.x = st.player.x + Math.cos(st.player.angle) * ahead + Math.cos(st.player.angle + Math.PI / 2) * side;
      cop.car.y = st.player.y + Math.sin(st.player.angle) * ahead + Math.sin(st.player.angle + Math.PI / 2) * side;
      cop.car.angle = st.player.angle;
      cop.car.speed = 320;
      cop.x = cop.car.x; cop.y = cop.car.y;
    });
    st.message = '5 stars — lose the Vice Coast PD!';
    st.messageTimer = 4;
    return { screen: SCREEN_PLAY, best: st.money };
  }
  if (name === 'play') {
    world.weather.force('day', false);
    putPlayerInCar(world, 2400, 2550, 0);
    world.startMission(1); // Package Run: collect around Palm Row.
    world.addWanted(2, true);
    for (let i = 0; i < 8 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st, 2550, 1), false);
      if (ev & EVENT_OVER) break;
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car) { car.speed = Math.max(car.speed, 320); car.health = 100; }
      st.player.health = 100;
      if (st.wanted < 2) st.wanted = 2;
    }
    st.message = 'Package Run — 2 stars on you!';
    st.messageTimer = 4;
    return { screen: SCREEN_PLAY, best: st.money };
  }
  if (name === 'heist') return stageHeistShot(world);
  world.weather.force('sunset', false);
  putPlayerInCar(world, 800, 3300, Math.PI);
  st.money = 9650; st.respect = 380;
  world.debugWin();
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
  return { screen: SCREEN_WIN, best: st.money };
}

export function stageHeistShot(world) {
  world.reset();
  const st = world.state;
  world.weather.force('sunset', false);
  world.startMission(8); // Neon Reign, stage 0: "Torch 3 gang cars".
  st.player.x = 8490; st.player.y = 2400; st.player.angle = -Math.PI / 2;
  st.player.inCar = false; st.player.carId = -1;
  st.player.ammo = 60; st.player.health = 100; st.player.armor = 50;
  st.money = 7150; st.respect = 160;
  for (let i = 0; i < 2.5 / STEP; i += 1) {
    const ev = world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false }, false);
    if (ev & EVENT_OVER) break;
    st.player.health = 100;
  }
  const gangCars = st.gangCars.filter((c) => c.health > 0);
  gangCars.forEach((c, i) => {
    const a = (i / Math.max(1, gangCars.length)) * Math.PI * 2;
    c.x = st.player.x + Math.cos(a) * 260; c.y = st.player.y + Math.sin(a) * 260;
  });
  const target = st.gangCars.find((c) => c.health > 0);
  if (target) {
    st.player.angle = Math.atan2(target.y - st.player.y, target.x - st.player.x);
    st.player.shootCd = 0;
    world.shoot(st.player.angle);
    for (let i = 0; i < 10; i += 1) {
      world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: st.player.angle, enter: false }, false);
      st.player.health = 100;
      if (st.hitMarker > 0) break;
    }
    if (st.hitMarker <= 0) {
      st.player.angle = Math.atan2(target.y - st.player.y, target.x - st.player.x);
      st.player.shootCd = 0;
      world.shoot(st.player.angle);
      for (let i = 0; i < 12; i += 1) {
        world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: st.player.angle, enter: false }, false);
        st.player.health = 100;
        if (st.hitMarker > 0) break;
      }
    }
  }
  st.message = 'Neon Reign — torch the Viper cars!';
  st.messageTimer = 4;
  st.missionFlash = 0;
  // One last fresh volley so a bullet and muzzle flash are in the frame.
  const last = st.gangCars.find((c) => c.health > 0);
  if (last) {
    st.player.angle = Math.atan2(last.y - st.player.y, last.x - st.player.x);
    st.player.shootCd = 0;
    world.shoot(st.player.angle);
  }
  // Face back north down the road so the turf marker is off to the side
  // instead of sitting between the camera and the player.
  st.player.angle = -Math.PI / 2;
  return { screen: SCREEN_PLAY, best: st.money };
}
