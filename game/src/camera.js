// The chase camera for Vice Coast. Third-person, low and close, the car
// large in the lower centre of the frame, the field of view widening
// slightly with speed, a little lag and sway on turns. The boom sweeps
// against building walls so the camera never sits inside one — and the
// round-8 roof-lift fix: when the boom is blocked on all sides, the camera
// slides sideways along the street and lowers, instead of lifting over the
// roof. The low chase feel survives even in a tight alley.
import { CFG } from './config.js';

// True when a point is inside a building's footprint (with a margin).
function insideBuilding(buildings, x, y, margin) {
  for (const b of buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) {
      return true;
    }
  }
  return false;
}

// The longest clear boom from an anchor toward a direction: walk out from
// the anchor in steps and stop at the first building wall.
function clearBoom(buildings, ax, ay, dx, dy, maxBoom) {
  const step = 12;
  let boom = maxBoom;
  for (let d = step; d <= maxBoom; d += step) {
    const x = ax + dx * d;
    const y = ay + dy * d;
    if (insideBuilding(buildings, x, y, 6)) {
      boom = Math.max(40, d - step);
      return { boom, blocked: true };
    }
  }
  return { boom, blocked: false };
}

export function createCamera(THREE) {
  const cam = {
    // The three.js camera this module drives.
    threeCam: null,
    // Current boom (distance behind the car) and height.
    boom: 220,
    height: 70,
    blocked: false,
    insideBuilding: false,
    // Smoothed position and look target, for the lag and sway.
    pos: { x: 0, y: 0, z: 80 },
    look: { x: 0, y: 0, z: 20 },
    fov: 62,
    // Attach the real three.js camera.
    attach(threeCam) {
      cam.threeCam = threeCam;
    },
    // The camera's current world position, for the pedestrian keep-out.
    getPos() {
      return { x: cam.pos.x, y: cam.pos.y, z: cam.pos.z };
    },
    // One frame of camera work. state holds the player, the car and the
    // buildings; mode is 'car', 'foot' or 'aim'.
    update(state, dt, mode) {
      const p = state.player;
      const inCar = p.inCar && state.player.carId >= 0;
      const car = inCar ? state.cars.find((c) => c.id === state.player.carId) : null;
      const anchorX = inCar && car ? car.x : p.x;
      const anchorY = inCar && car ? car.y : p.y;
      const heading = inCar && car ? car.angle : p.angle;
      const speed = inCar && car ? Math.abs(car.speed) : Math.abs(p.speed || 0);

      // The boom and height for this mode.
      let wantBoom = mode === 'car' || inCar ? 220 : 130;
      let wantHeight = mode === 'car' || inCar ? 72 : 58;
      if (mode === 'aim') {
        wantBoom = 95;
        wantHeight = 62;
      }
      // The camera sits behind the heading, on the opposite side.
      let bx = -Math.cos(heading);
      let by = -Math.sin(heading);

      // Collision: sweep the boom against the building walls.
      const sweep = clearBoom(state.buildings, anchorX, anchorY, bx, by, wantBoom);
      let boom = sweep.boom;
      let blocked = sweep.blocked;
      let lateral = 0;

      // Roof-lift fix: when the boom is badly blocked, do not lift the
      // camera over the roof. Slide sideways along the street instead:
      // try both lateral offsets and keep the one with the longest clear
      // boom, then lower the camera toward the car.
      if (blocked && boom < 90) {
        const px = -by;
        const py = bx;
        let best = { boom, lateral: 0, blocked: true };
        for (const side of [1, -1]) {
          const off = 70 * side;
          const ax = anchorX + px * off;
          const ay = anchorY + py * off;
          if (insideBuilding(state.buildings, ax, ay, 10)) continue;
          const s2 = clearBoom(state.buildings, ax, ay, bx, by, wantBoom);
          if (s2.boom > best.boom) best = { boom: s2.boom, lateral: off, blocked: s2.blocked };
        }
        if (best.lateral !== 0) {
          lateral = best.lateral;
          boom = best.boom;
          blocked = best.blocked;
        }
        // Lower, never lift: the camera stays near the car's roofline.
        wantHeight = Math.min(wantHeight, 58);
      }

      // Ease the boom and height toward their targets.
      const ease = 1 - Math.pow(0.001, dt);
      cam.boom += (boom - cam.boom) * ease;
      cam.height += (wantHeight - cam.height) * ease;
      cam.blocked = blocked;

      // The desired camera position, with the lateral slide applied.
      const px = -by;
      const py = bx;
      const tx = anchorX + bx * cam.boom + px * lateral;
      const ty = anchorY + by * cam.boom + py * lateral;
      const tz = cam.height;
      // Lag and sway: the camera trails the car and swings a little on turns.
      const lag = 1 - Math.pow(0.0001, dt);
      cam.pos.x += (tx - cam.pos.x) * lag;
      cam.pos.y += (ty - cam.pos.y) * lag;
      cam.pos.z += (tz - cam.pos.z) * lag;
      // Never let the smoothed position end up inside a building: if it
      // did, pull it back toward the anchor until it is clear.
      if (insideBuilding(state.buildings, cam.pos.x, cam.pos.y, 4)) {
        cam.insideBuilding = true;
        let pull = 0.85;
        for (let i = 0; i < 8; i += 1) {
          const cx = anchorX + (cam.pos.x - anchorX) * pull;
          const cy = anchorY + (cam.pos.y - anchorY) * pull;
          if (!insideBuilding(state.buildings, cx, cy, 4)) {
            cam.pos.x = cx;
            cam.pos.y = cy;
            break;
          }
          pull *= 0.8;
        }
      } else {
        cam.insideBuilding = false;
      }
      // Look ahead of the car, slightly above it.
      const lookX = anchorX + Math.cos(heading) * 90;
      const lookY = anchorY + Math.sin(heading) * 90;
      cam.look.x += (lookX - cam.look.x) * lag;
      cam.look.y += (lookY - cam.look.y) * lag;
      cam.look.z += (26 - cam.look.z) * lag;

      // The field of view widens slightly with speed.
      const wantFov = 60 + Math.min(16, speed / CFG.CAR_TOP_SPEED * 16);
      cam.fov += (wantFov - cam.fov) * ease;

      if (cam.threeCam) {
        cam.threeCam.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
        cam.threeCam.lookAt(cam.look.x, cam.look.y, cam.look.z);
        if (Math.abs(cam.threeCam.fov - cam.fov) > 0.05) {
          cam.threeCam.fov = cam.fov;
          cam.threeCam.updateProjectionMatrix();
        }
      }
    },
    // A debug snapshot for the playtest harness.
    debug() {
      return {
        boom: Math.round(cam.boom),
        blocked: cam.blocked,
        height: Math.round(cam.pos.z),
        inside: cam.insideBuilding,
      };
    },
  };
  return cam;
}
