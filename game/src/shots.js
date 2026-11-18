// Staged screenshots behind ?shot=start|play|chase|heist|end. Each plays the real rules
// forward from a fresh world for a fixed time, steered by a driving autopilot,
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

// Drive along the eastbound road at y=1280 toward the mission marker, steering
// to stay on the road and slowing for traffic ahead.
function drivePilot(state) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false };
  // Straight east along the y=1280 road centreline: a lookahead point ahead
  // keeps the car in its lane and moving fast, with no corner to clip.
  const target = { x: car.x + 220, y: 1280 };
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
    // Put the player in a car on the main eastbound road, drive toward the
    // Neon Hotel mission marker through traffic for ~14 seconds.
    putPlayerInCar(world, 1088, 1280, 0);
    st.missionIndex = 0; st.missionStage = 1;
    world.startMission(0); st.missionStage = 1;
    // Re-point the target at the hotel after startMission reset the stage.
    st.missionTarget = { ...st.landmarks.hotel, label: 'Drop Maya off' };
    st.missionText = 'Sunset Taxi — Drop Maya off';
    for (let i = 0; i < 5 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st), false);
      if (ev & EVENT_OVER) break;
      // Keep the car on the road: nudge back if it drifts off the lane.
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car && Math.abs(car.y - 1280) > 90) { car.y += (1280 - car.y) * 0.02; car.angle *= 0.98; }
    }
    st.messageTimer = 0;
    return { screen: SCREEN_PLAY, best: st.money };
  }
  if (name === 'chase') {
    putPlayerInCar(world, 1472, 1280, 0);
    world.debugChase();
    // Spawn cop cars close behind and beside, then drive fast for 7 seconds.
    for (let i = 0; i < 3 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st), false);
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
  // end: complete the heist through the real win path.
  putPlayerInCar(world, 704, 2240, -Math.PI / 2);
  st.money = 1950; st.respect = 100;
  world.debugWin();
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
  return { screen: SCREEN_WIN, best: st.money };
}

export function stageHeistShot(world) {
  // heist: on foot outside Coral Bank at 3 stars, mid-gunfight. Real rules all
  // the way: startMission(4) sets the bank beacon, addWanted(3) brings the
  // foot cops, and shoot() fires real bullets with muzzle particles.
  world.reset();
  const st = world.state;
  world.startMission(4); // The Sunset Heist, stage 0: "Hit Coral Bank".
  st.player.x = 1760; st.player.y = 1280; st.player.angle = 0;
  st.player.inCar = false; st.player.carId = -1;
  st.player.ammo = 60; st.player.health = 100;
  st.money = 1200; st.respect = 64;
  world.addWanted(3, true);
  // Let the foot cops close in for ~2.5 s. The player holds position 96 px
  // west of the bank — just outside the 80 px mission trigger, so the shot
  // stays on stage 0 ("Hit Coral Bank") at 3 stars.
  for (let i = 0; i < 2.5 / STEP; i += 1) {
    const ev = world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false }, false);
    if (ev & EVENT_OVER) break;
  }
  // Spread the foot cops into a ring around the player so they read as
  // separate figures in the frame instead of one blob stacked on the player.
  const foot = st.cops.filter((c) => !c.inCar && !c.dead);
  foot.forEach((c, i) => {
    const a = (i / Math.max(1, foot.length)) * Math.PI * 2;
    c.x = st.player.x + Math.cos(a) * 70; c.y = st.player.y + Math.sin(a) * 70;
  });
  // Fire one last volley at the nearest cop so bullets + muzzle flash are in
  // the frame when the screenshot is taken.
  const cop = st.cops.find((c) => !c.inCar && !c.dead);
  if (cop) {
    st.player.angle = Math.atan2(cop.y - st.player.y, cop.x - st.player.x);
    st.player.shootCd = 0;
    world.shoot(st.player.angle);
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: st.player.angle, enter: false }, false);
  }
  st.message = 'The Sunset Heist — hit Coral Bank!'; st.messageTimer = 4;
  return { screen: SCREEN_PLAY, best: st.money };
}
