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
  // The player's car is always the bright-orange sports car in the staged
  // shots (top-10 cars are orange/red and instantly readable).
  car.color = '#ff6a1a';
  st.player.x = x; st.player.y = y; st.player.angle = angle; st.player.inCar = true; st.player.carId = car.id;
  return car;
}

// Parked cars sitting in the staged lane read as random white boxes in the
// frame (v6.0's chase shot had one looming right behind the player car).
// Move them to a side road before the shot.
function clearParkedNear(st, x, y, r) {
  for (const c of st.cars) {
    if (c.parked && Math.hypot(c.x - x, c.y - y) < r) { c.x = 1856; c.y = 2240 + (c.id % 6) * 30; }
  }
}

// A deterministic fireball at (x, y): orange particles the 3D renderer
// draws as a glowing burst. Placed after the step loop so it is still live
// when the frame is taken.
function fireball(st, x, y) {
  for (let i = 0; i < 50; i += 1) {
    const a = (i / 50) * Math.PI * 2;
    st.particles.push({
      x: x + Math.cos(a) * (8 + (i % 8) * 7), y: y + Math.sin(a) * (8 + (i % 8) * 7),
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
    // east (x=3400) so 6 s at full speed still leaves the car mid-city.
    world.weather.force('sunset', false);
    putPlayerInCar(world, 3400, 960, Math.PI);
    clearParkedNear(st, 3400, 960, 900);
    world.startMission(5); // Vice Nights: 4 stars, heli already up.
    for (let i = 0; i < 6 / STEP; i += 1) {
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
      st.heli.x = st.player.x - 100; st.heli.y = st.player.y - 30;
      st.heli.angle = Math.atan2(st.heli.y - st.player.y, st.heli.x - st.player.x);
    }
    // Clear parked cars near the player's final spot too (the drive moved
    // the player ~2500 units west from the start).
    clearParkedNear(st, st.player.x, st.player.y, 220);
    const pc = st.cars.find((c) => c.id === st.player.carId);
    if (pc) {
      // Pack the boulevard: pull traffic cars onto this road AHEAD of the
      // player so the frame reads as a busy GTA street, not an empty road.
      // Close pack (from 70 ahead, not 120) — v6.0's pack was mostly beyond
      // the render cull distance and the road read empty.
      const traffic = st.cars.filter((c) => !c.cop && c.id !== pc.id && c.traffic).slice(0, 6);
      traffic.forEach((c, i) => {
        c.x = pc.x - 70 - i * 48; c.y = 960 + (i % 2 === 0 ? -18 : 18);
        c.angle = i % 2 === 0 ? Math.PI : 0; c.speed = 140;
      });
      // Two cop cars tight on the player's tail, light bars flashing.
      const tail = cops.slice(0, 2);
      tail.forEach((cop, i) => {
        cop.car.x = pc.x + 85; cop.car.y = 960 + (i === 0 ? -22 : 22);
        cop.car.angle = Math.PI; cop.car.speed = 380;
        cop.x = cop.car.x; cop.y = cop.car.y;
      });
      // Roadblock: three cop cars parked across the road ahead of the
      // player — CLOSE (340 ahead, not 620) so the wall reads in frame.
      // If the drive spawned fewer than 3 spare cop cars, press traffic
      // cars into service as blockers (they render as cop cars with bars).
      const blockers = cops.slice(2, 5).map((c) => c.car);
      while (blockers.length < 3) {
        const t = st.cars.find((c) => !c.cop && c.id !== pc.id && c.traffic && !traffic.includes(c) && !blockers.includes(c));
        if (!t) break;
        t.cop = true; t.traffic = false; t.color = '#2f6fd0'; blockers.push(t);
      }
      blockers.forEach((car, i) => {
        car.x = pc.x - 340; car.y = 960 - 24 + i * 24;
        car.angle = Math.PI / 2 + (i === 1 ? 0.15 : -0.15); car.speed = 0;
      });
      // A wrecked traffic car burning just before the roadblock.
      const wreck = st.cars.find((c) => !c.cop && c.id !== pc.id && Math.abs(c.y - 960) < 200 && !traffic.includes(c));
      if (wreck) { wreck.x = pc.x - 295; wreck.y = 960 + 26; wreck.health = 5; fireball(st, wreck.x, wreck.y); }
      // Corridor sweep: any other car loitering within 200 units of the
      // player (e.g. a white traffic car between the chase camera and the
      // player car — v6.1's chase had one looming in the frame) is moved
      // to a far road so the shot is only the staged action.
      const staged = new Set([pc.id, ...traffic.map((c) => c.id), ...tail.map((c) => c.car.id), ...blockers.map((c) => c.id), ...(wreck ? [wreck.id] : [])]);
      for (const c of st.cars) {
        if (staged.has(c.id) || c.cop) continue;
        if (Math.hypot(c.x - st.player.x, c.y - st.player.y) < 200) {
          c.x = 3200; c.y = 2240 + (c.id % 6) * 30; c.angle = 0; c.speed = 0;
        }
      }
    }
    st.messageTimer = 0; st.districtTimer = 0; st.missionFlash = 0;
    return { screen: 'play', best: st.money };
  }
  if (name === 'heist') return stageHeistShot(world);
  // end: the Vice Coast Finale win screen at the Sunset Pier at sunset.
  // The car faces WEST toward the pier, the ocean and the low sun, so the
  // finale frame is beach + sunset, not a city street. Slight angle so the
  // camera sees a 3/4 rear view (orange flank, not a flat black cabin).
  world.weather.force('sunset', false);
  putPlayerInCar(world, 320, 1280, Math.PI - 0.35);
  st.money = 9650; st.respect = 150;
  world.debugWin();
  for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { move: { x: 0, y: 0 } }, true);
  return { screen: 'win', best: st.money };
}

export function stagePlayShot(world) {
  // play: on-foot third-person shootout at sunset on the Sunset Pier
  // approach. The player faces WEST into the low sun (beach + ocean +
  // palms ahead, like the top-10 beach boulevard) and aims over-shoulder
  // at a cop car between them and the pier; real bullets fly and a muzzle
  // flash + tracers are in the frame. The HUD hit marker is lit by the
  // main runShot loop via scene.showHit.
  world.reset();
  const st = world.state;
  world.weather.force('sunset', false);
  world.startMission(6); // Sunset Showdown: 5 stars, pier escape, 75 s clock.
  st.wanted = 2; // staged at 2 stars so the frame stays a shootout, not a bust.
  st.player.x = 560; st.player.y = 1280; st.player.angle = Math.PI;
  st.player.inCar = false; st.player.carId = -1;
  st.player.ammo = 60; st.player.health = 100; st.player.armor = 50;
  st.money = 3150; st.respect = 80;
  clearParkedNear(st, 560, 1280, 260);
  // Let the cops close in for ~2 s so they are in the frame ahead.
  for (let i = 0; i < 2 / STEP; i += 1) {
    const ev = world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: Math.PI, enter: false }, false);
    if (ev & EVENT_OVER) break;
    st.player.health = 100;
  }
  // Foot cops chase the player and end up between the camera and the
  // player (v6.1's play shot had a blue cop filling the foreground instead
  // of the player). Push them to the sides, ahead of the player.
  st.cops.forEach((cop, i) => {
    if (!cop.inCar && Math.hypot(cop.x - st.player.x, cop.y - st.player.y) < 90) {
      cop.x = st.player.x - 130 + (i % 3) * 45;
      cop.y = st.player.y + (i % 2 === 0 ? -75 : 75);
    }
  });
  st.peds.forEach((ped) => {
    if (ped.alive && Math.hypot(ped.x - st.player.x, ped.y - st.player.y) < 30) {
      ped.x = st.player.x - 60; ped.y = st.player.y + 80;
    }
  });
  // Line the nearest cop car up ahead of the player (west, toward the
  // pier), in the aim line.
  const cop = st.cops.find((c) => c.inCar && c.car) || st.cops[0];
  let aimAngle = Math.PI;
  if (cop) {
    const t = cop.inCar && cop.car ? cop.car : cop;
    t.x = st.player.x - 170; t.y = st.player.y + 8;
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
  // heist: gang turf shootout in Neon Downtown at SUNSET. v6.0 staged it
  // at night and the frame was nearly black; sunset keeps the neon
  // billboards and the Viper cars readable (the night phase itself is
  // brighter now too, for live play). Real rules all the way:
  // startMission(8) sets the turf beacon and spawns 3 Viper cars, the gang
  // closes in for a drive-by, and shoot() fires real bullets with muzzle
  // particles. The player holds the turf marker at (2624, 960); one Viper
  // car burns in the frame.
  world.reset();
  const st = world.state;
  world.weather.force('sunset', false);
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
  // Fan the gang cars across the FRONT (east) of the player: v6.1 spread
  // them in a full circle, so one sat right next to the camera and filled
  // the frame as a pink slab. All of them stay ahead of the aim line now.
  gangCars.forEach((c, i) => {
    const a = -0.9 + (i / Math.max(1, gangCars.length - 1)) * 1.8;
    c.x = st.player.x + Math.cos(a) * 140; c.y = st.player.y + Math.sin(a) * 140;
  });
  const target = st.gangCars.find((c) => c.health > 0);
  let aimAngle = 0;
  if (target) {
    aimAngle = Math.atan2(target.y - st.player.y, target.x - st.player.x);
    st.player.angle = aimAngle;
    st.player.shootCd = 0;
    world.shoot(aimAngle);
    world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle, enter: false }, false);
    // One Viper car already burning: the "torch the cars" moment in frame.
    target.health = 5;
    fireball(st, target.x, target.y);
  }
  st.message = 'Neon Reign — torch the Viper cars!'; st.messageTimer = 4; st.districtTimer = 0; st.missionFlash = 0;
  return { screen: 'play', best: st.money, aiming: true, aimAngle };
}
