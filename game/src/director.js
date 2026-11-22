// The traffic director: the system that keeps the chase dense around the
// player. It watches the wanted level and the player's speed, keeps cop
// cars and traffic cars visible ahead of the player on the road they are
// driving, stages roadblocks ahead at three stars and up, and keeps at
// least eight traffic cars within 450 units and ten pedestrians within 200,
// recycling the ones that drift far away and never spawning one too close
// to the player. At four stars and up the police helicopter circles with a
// searchlight — dimmed and narrowed, so the pool of light on the ground
// never washes out the traffic underneath it.
import { CFG } from './config.js';
import { makeRng } from './random.js';

// The vertical and horizontal road lines, shared with the world builder.
export function roadXs() {
  const xs = [];
  for (let i = 0; i < CFG.V_ROADS; i += 1) xs.push(CFG.V_ROAD_X0 + i * CFG.V_ROAD_DX);
  return xs;
}
export function roadYs() {
  const ys = [];
  for (let j = 0; j < CFG.H_ROADS; j += 1) ys.push(CFG.H_ROAD_Y0 + j * CFG.H_ROAD_DY);
  return ys;
}

function nearestRoadX(x) {
  const xs = roadXs();
  let best = xs[0];
  let bestD = Infinity;
  for (const rx of xs) {
    const d = Math.abs(rx - x);
    if (d < bestD) {
      bestD = d;
      best = rx;
    }
  }
  return best;
}
function nearestRoadY(y) {
  const ys = roadYs();
  let best = ys[0];
  let bestD = Infinity;
  for (const ry of ys) {
    const d = Math.abs(ry - y);
    if (d < bestD) {
      bestD = d;
      best = ry;
    }
  }
  return best;
}

export function createDirector(state) {
  const rng = makeRng(777);
  const dir = {
    // How many cop cars are staged ahead of the player right now.
    stagedAhead: 0,
    // The spotlight's dimmed settings (round-8 fix: it used to wash out
    // the traffic under the helicopter).
    spotlight: { intensity: 0.55, angle: 0.32, poolRadius: 90, groundLux: 0.42 },
    // A point on the player's road, some distance ahead of them.
    aheadPoint(dist, lateral) {
      const p = state.player;
      const inCar = p.inCar && state.player.carId >= 0;
      const car = inCar ? state.cars.find((c) => c.id === state.player.carId) : null;
      const heading = car ? car.angle : p.angle;
      const fx = Math.cos(heading);
      const fy = Math.sin(heading);
      // Stay on the road: snap the ahead point to the nearest road line
      // in the direction of travel.
      let x = p.x + fx * dist;
      let y = p.y + fy * dist;
      if (Math.abs(fx) >= Math.abs(fy)) {
        y = nearestRoadY(y);
      } else {
        x = nearestRoadX(x);
      }
      // A lateral offset puts the car in a lane, not dead centre.
      const px = -fy;
      const py = fx;
      x += px * (lateral || 0);
      y += py * (lateral || 0);
      x = Math.max(650, Math.min(CFG.WORLD_W - 60, x));
      y = Math.max(260, Math.min(CFG.WORLD_H - 60, y));
      return { x, y };
    },
    // Keep the density targets: cars near the player, peds near the
    // player. Far-away traffic and peds are recycled to spots ahead of
    // the player, never closer than 140 units.
    keepDensity() {
      const p = state.player;
      const traffic = state.cars.filter((c) => c.traffic);
      let nearCars = 0;
      for (const c of traffic) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < CFG.DENSITY_CAR_RADIUS) nearCars += 1;
      }
      if (nearCars < CFG.DENSITY_CAR_MIN) {
        // Recycle the farthest cars first.
        const far = traffic
          .map((c) => ({ c, d: Math.hypot(c.x - p.x, c.y - p.y) }))
          .sort((a, b) => b.d - a.d);
        let need = CFG.DENSITY_CAR_MIN - nearCars;
        for (const { c } of far) {
          if (need <= 0) break;
          const spot = dir.aheadPoint(220 + rng.range(0, 260), rng.range(-30, 30));
          c.x = spot.x;
          c.y = spot.y;
          c.angle = Math.atan2(p.y - spot.y, p.x - spot.x) + (rng.chance(0.5) ? 0 : Math.PI);
          c.speed = rng.range(120, 220);
          need -= 1;
        }
      }
      const peds = state.peds.filter((pd) => pd.alive);
      let nearPeds = 0;
      for (const pd of peds) {
        if (Math.hypot(pd.x - p.x, pd.y - p.y) < CFG.DENSITY_PED_RADIUS) nearPeds += 1;
      }
      if (nearPeds < CFG.DENSITY_PED_MIN) {
        const far = peds
          .map((pd) => ({ pd, d: Math.hypot(pd.x - p.x, pd.y - p.y) }))
          .sort((a, b) => b.d - a.d);
        let need = CFG.DENSITY_PED_MIN - nearPeds;
        for (const { pd } of far) {
          if (need <= 0) break;
          // Peds walk on the sidewalk beside the road ahead.
          const spot = dir.aheadPoint(120 + rng.range(0, 120), rng.pick([-70, 70]));
          pd.x = spot.x;
          pd.y = spot.y;
          pd.angle = rng.range(0, Math.PI * 2);
          need -= 1;
        }
      }
    },
    // Stage the chase: cop cars ahead of the player, on the road they
    // are driving, facing them. The more stars, the denser the chase.
    stageChase(dt) {
      const wanted = state.wanted;
      if (wanted <= 0) {
        dir.stagedAhead = 0;
        return;
      }
      const p = state.player;
      const copCars = state.cops.filter((c) => c.inCar);
      // How many cop cars the chase wants ahead of the player.
      const want = Math.min(2 + wanted, 6);
      let ahead = 0;
      for (const cop of copCars) {
        if (Math.hypot(cop.x - p.x, cop.y - p.y) < 520) ahead += 1;
      }
      dir.stagedAhead = ahead;
      if (ahead < want) {
        // Move the farthest cop cars to spots ahead of the player.
        const far = copCars
          .map((c) => ({ c, d: Math.hypot(c.x - p.x, c.y - p.y) }))
          .sort((a, b) => b.d - a.d);
        let need = want - ahead;
        for (const { c } of far) {
          if (need <= 0) break;
          const spot = dir.aheadPoint(260 + rng.range(0, 240), rng.pick([-26, 26]));
          c.x = spot.x;
          c.y = spot.y;
          c.angle = Math.atan2(p.y - spot.y, p.x - spot.x);
          c.speed = Math.min(c.speed, 200);
          need -= 1;
        }
      }
      // Roadblocks at three stars and up: barriers across the road
      // ahead, with two cop cars flanking them.
      if (wanted >= 3) {
        if (!state.roadblock) {
          const spot = dir.aheadPoint(420, 0);
          state.roadblock = { x: spot.x, y: spot.y, angle: Math.atan2(p.y - spot.y, p.x - spot.x) };
        }
      } else if (state.roadblock) {
        state.roadblock = null;
      }
    },
    // The helicopter: a slow circle at 420 units, with a dimmed,
    // narrowed searchlight. The pool of light on the ground is small
    // and soft, so the traffic underneath stays readable.
    updateHeli(dt) {
      const heli = state.heli;
      if (!heli) return;
      heli.orbitAngle += dt * 0.45;
      const p = state.player;
      heli.x = p.x + Math.cos(heli.orbitAngle) * CFG.HELI_ORBIT;
      heli.y = p.y + Math.sin(heli.orbitAngle) * CFG.HELI_ORBIT;
      heli.z = CFG.HELI_HEIGHT;
      // The light tracks the player with a soft edge.
      heli.lightX = p.x;
      heli.lightY = p.y;
      heli.spotIntensity = dir.spotlight.intensity;
      heli.spotAngle = dir.spotlight.angle;
      heli.groundLux = dir.spotlight.groundLux;
    },
    // Pedestrian camera keep-out: any pedestrian that would walk within
    // a few dozen units of the camera is steered around it instead of
    // through it. The camera position is fed in by the main loop.
    keepOut(cameraPos) {
      if (!cameraPos) return;
      for (const pd of state.peds) {
        if (!pd.alive) continue;
        const dx = pd.x - cameraPos.x;
        const dy = pd.y - cameraPos.y;
        const d = Math.hypot(dx, dy);
        if (d < CFG.PED_CAMERA_KEEPOUT && d > 0.01) {
          // Steer around the camera: push the pedestrian sideways, out
          // of the bubble, and turn them away from the lens.
          const push = (CFG.PED_CAMERA_KEEPOUT - d) + 6;
          const nx = dx / d;
          const ny = dy / d;
          pd.x += nx * push;
          pd.y += ny * push;
          pd.angle = Math.atan2(ny, nx);
        }
      }
    },
    // One update for the whole director, called every frame.
    update(dt, cameraPos) {
      dir.keepDensity();
      dir.stageChase(dt);
      dir.updateHeli(dt);
      dir.keepOut(cameraPos);
    },
  };
  return dir;
}
