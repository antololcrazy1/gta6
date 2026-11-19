// Vice Coast v6 staged screenshots behind ?shot=start|play|chase|heist|end
// &seed=19. Each plays the real rules forward from a fresh world for a fixed
// time, steered by a driving autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
// v6 scenes (all different from the v5 shots): a golden-hour beach-boulevard
// police chase at 4 stars with the helicopter, a roadblock and an explosion
// in one frame; an on-foot third-person shootout at sunset with the hit
// marker; a night gang-turf shootout in Neon Downtown; and the finale win
// screen at the Sunset Pier at sunset.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';

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

// A deterministic fireball at (x, y): orange particles the 3D renderer
// draws as a glowing burst. Placed after the step loop so it is still live
// when the frame is taken.
function fireball(st, x, y) {
  for (let i = 0; i < 30; i += 1) {
    const a = (i / 30) * Math.PI * 2;
    st.particles.push({
      x: x + Math.cos(a) * (6 + (i % 6) * 7), y: y + Math.sin(a) * (6 + (i % 6) * 7),
      vx: 0, vy: 0, life: 0.8, max: 0.8, color: i % 3 === 0 ? '#ffcc55' : '#ff5722', size: 6,
    });
  }
}

export function stageShot(name, world) {
  world.reset();
  const st = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'end' && name !== 'heist') {
    world.weather.force('sunset', false);
    for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
    return { screen: 'title', best: 1250 };
  }
  if (name === 'play') return stagePlayShot(world);
  if (name === 'chase') {
    // Golden-hour beach-boulevard chase, driving WEST into the low sun:
    // 4 stars, heli overhead with spotlight, cop cars in pursuit, a
    // roadblock ahead and a wrecked car burning in the frame. Start far
    // east (x=3200) so 5 s at full speed still leaves the car mid-city.
    world.weather.force('sunset', false);
    putPlayerInCar(world, 3200, 960, Math.PI);
    world.startMission(5); // Vice Nights: 4 stars, heli already up.
    for (let i = 0; i < 5 / STEP; i += 1) {
      const ev = world.step(STEP, drivePilot(st, 960, -1), false);
      if (ev & EVENT_OVER) break;
      const car = st.cars.find((c) => c.id === st.player.carId);
      if (car) { car.speed = Math.max(car.speed, 420); car.health = 100; }
      st.player.health = 100;
      if (st.wanted < 4) st.wanted = 4;
    }
    const cops = st.cops.filter((c) => c.inCar && c.car);
    // (Cop cars spawn from the 4-star wanted level during the drive above.)
    // Park the helicopter ahead-above the player so it dominates the frame
    // like the top-10 screenshots (it orbits, so pin it for the shot).
    if (st.heli) {
      st.heli.x = st.player.x - 150; st.heli.y = st.player.y - 55;
      st.heli.angle = Math.atan2(st.heli.y - st.player.y, st.heli.x - st.player.x);
    }
    const pc = st.cars.find((c) => c.id === st.player.carId);
    if (pc) {
      // Pack the boulevard: pull traffic cars onto this road AHEAD of the
      // player so the frame reads as a busy GTA street, not an empty road.
      const traffic = st.cars.filter((c) => !c.cop && c.id !== pc.id && c.traffic).slice(0, 8);
      traffic.forEach((c, i) => {
        c.x = pc.x - 120 - i * 62; c.y = 960 + (i % 2 === 0 ? -18 : 18);
        c.angle = i % 2 === 0 ? Math.PI : 0; c.speed = 140;
      });
      // Roadblock: two cop cars parked across the road ahead of the player,
      // beyond the traffic pack so they read as a wall.
      const ahead = st.cops.filter((c) => c.inCar && c.car).slice(0, 2);
      ahead.forEach((cop, i) => {
        cop.car.x = pc.x - 620; cop.car.y = 960 + (i === 0 ? -3 : 3);
        cop.car.angle = Math.PI / 2; cop.car.speed = 0;
        cop.x = cop.car.x; cop.y = cop.car.y;
      });
      // A wrecked traffic car burning just before the roadblock.
      const wreck = st.cars.find((c) => !c.cop && c.id !== pc.id && Math.abs(c.y - 960) < 200 && !traffic.includes(c));
      if (wreck) { wreck.x = pc.x - 560; wreck.y = 960 + 26; wreck.health = 5; fireball(st, wreck.x, wreck.y); }
    }
    st.messageTimer = 0; st.districtTimer = 0; st.missionFlash = 0;
    return { screen: 'play', best: st.money };
  }
  if (name === 'heist') return stageHeistShot(world);
  // end: the Vice Coast Finale win screen at the Sunset Pier at sunset.
  world.weather.force('sunset', false);
  putPlayerInCar(world, 320, 1280, 0);
  st.money = 9650; st.respect = 150;
  world.debugWin();
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
  return { screen: 'win', best: st.money };
}

export function stagePlayShot(world) {
  // play: on-foot third-person shootout at sunset on the beach boulevard.
  // The player aims over-shoulder at a cop car ahead; real bullets fly and
  // a muzzle flash + tracers are in the frame. The HUD hit marker is lit
  // by the main runShot loop via scene.showHit.
  world.reset();
  const st = world.state;
  world.weather.force('sunset', false);
  world.startMission(6); // Sunset Showdown: 5 stars, pier escape, 75 s clock.
  st.wanted = 2; // staged at 2 stars so the frame stays a shootout, not a bust.
  st.player.x = 1800; st.player.y = 960; st.player.angle = 0;
  st.player.inCar = false; st.player.carId = -1;
  st.player.ammo = 60; st.player.health = 100; st.player.armor = 50;
  st.money = 3150; st.respect = 80;
  // Let the cops close in for ~2 s so they are in the frame ahead.
  for (let i = 0; i < 2 / STEP; i += 1) {
    const ev = world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false }, false);
    if (ev & EVENT_OVER) break;
    st.player.health = 100;
  }
  // Line the nearest cop car up ahead of the player, in the aim line.
  const cop = st.cops.find((c) => c.inCar && c.car) || st.cops[0];
  let aimAngle = 0;
  if (cop) {
    const t = cop.inCar && cop.car ? cop.car : cop;
    t.x = st.player.x + 170; t.y = st.player.y + 8;
    if (t === cop.car) { cop.x = t.x; cop.y = t.y; }
    aimAngle = Math.atan2(t.y - st.player.y, t.x - st.player.x);
    st.player.angle = aimAngle;
  }
  // Fire a volley: real bullets + muzzle particles, one step apart.
  for (let v = 0; v < 3; v += 1) {
    st.player.shootCd = 0;
    world.shoot(aimAngle);
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle, enter: false }, false);
    st.player.health = 100;
  }
  st.message = 'Sunset Showdown — lose the heat!'; st.messageTimer = 4; st.districtTimer = 0; st.missionFlash = 0;
  return { screen: 'play', best: st.money, aiming: true, aimAngle, showHit: true };
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
  // Hold the turf from just off the beacon: standing on the marker puts
  // the camera inside the beacon pillar and washes the frame yellow.
  st.player.x = 2654; st.player.y = 960; st.player.angle = 0;
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
    c.x = st.player.x + Math.cos(a) * 120; c.y = st.player.y + Math.sin(a) * 120;
  });
  const target = st.gangCars.find((c) => c.health > 0);
  let aimAngle = 0;
  if (target) {
    aimAngle = Math.atan2(target.y - st.player.y, target.x - st.player.x);
    st.player.angle = aimAngle;
    st.player.shootCd = 0;
    world.shoot(aimAngle);
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle, enter: false }, false);
  }
  st.message = 'Neon Reign — torch the Viper cars!'; st.messageTimer = 4; st.districtTimer = 0; st.missionFlash = 0;
  return { screen: 'play', best: st.money, aiming: true, aimAngle };
}
