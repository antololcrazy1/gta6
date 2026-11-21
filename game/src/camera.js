// Chase-camera collision for Vice Coast round 7.
//
// The chase camera sits on a boom behind the player. When the player drives
// tight against a building, the boom's ideal spot can end up inside the
// wall, so the camera would clip through brick. This module keeps the
// camera out of every building: it sweeps the boom segment from the
// player's head toward the ideal camera spot, finds the first building
// wall the segment would cross, and shortens the boom to just short of
// that wall. The boom eases back out when the way clears, so the camera
// never snaps. Buildings are axis-aligned boxes, so the sweep is a
// slab test against each box — cheap enough to run every frame.
//
// The module knows nothing about Three.js or the game loop: it works in
// plain world coordinates (x, y on the ground plane, z up) and the
// renderer turns its output into a camera position.
export const CAMERA_TUNING = {
  // How far in front of a wall the camera stops, in world units.
  wallClearance: 26,
  // The boom shortens no faster than this (units per second) and grows
  // back no faster than this — the asymmetry keeps pull-ins snappy and
  // pull-outs gentle, so the frame never jumps.
  pullInRate: 900,
  pullOutRate: 260,
  // The shortest boom allowed: just behind the car's rear bumper (the
  // car is 96 long, so 50 keeps the camera out of the car itself) and
  // short enough that a car parked at its 48-unit collision distance
  // from a wall still leaves the camera outside the wall.
  minBoom: 50,
  // How far above the ground the boom's eye sits when it sweeps.
  eyeHeight: 110,
};

// A segment from (ax, ay) to (bx, by) against one axis-aligned box.
// Returns the fraction t along the segment where it first enters the
// box, or null when the segment never touches it. The box is given by
// its ground-plane footprint plus its height; the sweep is 2D because
// the camera eye flies above the street and only walls block it, and a
// wall blocks the whole height of the box.
function segmentBoxT(ax, ay, bx, by, box) {
  const dx = bx - ax;
  const dy = by - ay;
  let tEnter = 0;
  let tExit = 1;
  // X slab.
  if (dx === 0) {
    if (ax < box.x || ax > box.x + box.w) return null;
  } else {
    let t0 = (box.x - ax) / dx;
    let t1 = (box.x + box.w - ax) / dx;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tEnter) tEnter = t0;
    if (t1 < tExit) tExit = t1;
    if (tEnter > tExit) return null;
  }
  // Y slab.
  if (dy === 0) {
    if (ay < box.y || ay > box.y + box.h) return null;
  } else {
    let t0 = (box.y - ay) / dy;
    let t1 = (box.y + box.h - ay) / dy;
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    if (t0 > tEnter) tEnter = t0;
    if (t1 < tExit) tExit = t1;
    if (tEnter > tExit) return null;
  }
  if (tEnter < 0 || tEnter > 1) return null;
  return tEnter;
}

// The fraction of the boom that stays clear of every building: 1 means
// the full boom is free, 0 means a wall is right at the player's head.
// Only buildings tall enough to reach the eye height can block the view;
// low sheds and gas canopies let the camera fly over them.
export function clearBoomFraction(fromX, fromY, toX, toY, eyeHeight, buildings) {
  let best = 1;
  for (const b of buildings) {
    if (b.ht < eyeHeight * 0.55) continue;
    // Skip boxes far from the segment's bounding box — a cheap reject
    // that keeps the sweep fast across a 405-building city.
    const minX = fromX < toX ? fromX : toX;
    const maxX = fromX > toX ? fromX : toX;
    const minY = fromY < toY ? fromY : toY;
    const maxY = fromY > toY ? fromY : toY;
    if (b.x > maxX || b.x + b.w < minX || b.y > maxY || b.y + b.h < minY) continue;
    const t = segmentBoxT(fromX, fromY, toX, toY, b);
    if (t !== null && t < best) best = t;
  }
  return best;
}

// Is a ground-plane point inside any building footprint? Used by the
// playtest to prove the camera never sits inside a wall.
export function pointInsideBuilding(x, y, buildings) {
  for (const b of buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// The 3D version: the camera is only "inside" a building when it sits
// below the roof. A camera flying above a low roof is not inside it,
// however the footprint reads from above.
export function cameraInside3D(x, y, height, buildings) {
  for (const b of buildings) {
    if (height >= b.ht) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// The chase camera's boom state. One instance lives in the renderer and
// is ticked every frame with the player's position and heading.
export function createChaseCamera(tuning) {
  const t = { ...CAMERA_TUNING, ...(tuning || {}) };
  let boom = 260; // current boom length, eased toward the allowed one
  let lastClear = 1;
  let side = 0; // current lateral slide, eased toward its target
  let lastSideTarget = 0;
  let lift = 0; // extra camera height, eased toward its target
  let lastLiftTarget = 0;

  function update(dt, playerX, playerY, heading, wantBoom, eyeHeight, buildings) {
    const fx = Math.cos(heading);
    const fy = Math.sin(heading);
    const wantX = playerX - fx * wantBoom;
    const wantY = playerY - fy * wantBoom;
    const clear = clearBoomFraction(playerX, playerY, wantX, wantY, eyeHeight, buildings);
    lastClear = clear;
    // Leave a clearance gap in front of the wall, then convert the
    // fraction into a boom length.
    const wallGap = t.wallClearance / Math.max(1, wantBoom);
    const allowed = Math.max(t.minBoom, wantBoom * Math.max(0, clear - wallGap));
    // Ease: pull in fast when a wall appears, drift back out slowly.
    // When the wall is right there (the allowed boom is under half the
    // current one) snap straight to it — a one-frame cut beats a camera
    // sitting inside a wall while the boom catches up.
    if (allowed < boom * 0.5) {
      boom = allowed;
    } else {
      const rate = allowed < boom ? t.pullInRate : t.pullOutRate;
      const step = rate * dt;
      if (boom < allowed) boom = Math.min(allowed, boom + step);
      else if (boom > allowed) boom = Math.max(allowed, boom - step);
    }
    // The boom has a floor (it must stay behind the car's rear bumper),
    // so when the car is closer to a wall than the floor allows, the
    // camera can still end up inside the wall. Then slide it sideways:
    // try lateral offsets until the camera sits outside every building
    // with a clear line back to the player, and ease back to centre
    // when the way is clear again.
    let baseX = playerX - fx * boom;
    let baseY = playerY - fy * boom;
    let sideTarget = 0;
    if (pointInsideBuilding(baseX, baseY, buildings)) {
      const px = -fy;
      const py = fx;
      for (const off of [70, -70, 140, -140, 210, -210]) {
        const cx = baseX + px * off;
        const cy = baseY + py * off;
        if (pointInsideBuilding(cx, cy, buildings)) continue;
        if (clearBoomFraction(playerX, playerY, cx, cy, eyeHeight, buildings) < 0.8) continue;
        sideTarget = off;
        break;
      }
    }
    lastSideTarget = sideTarget;
    const sideStep = 600 * dt;
    if (side < sideTarget) side = Math.min(sideTarget, side + sideStep);
    else if (side > sideTarget) side = Math.max(sideTarget, side - sideStep);
    const px = -fy;
    const py = fx;
    const finalX = baseX + px * side;
    const finalY = baseY + py * side;
    // Last resort when no slide escapes: rise above the roof. The
    // camera looks down at the player from over the building instead
    // of sitting inside it — a high angle beats a wall in the lens.
    // The lift eases like the rest, and falls back to zero in the open.
    let liftTarget = 0;
    const trapped = cameraInside3D(finalX, finalY, eyeHeight + lift, buildings);
    if (trapped) liftTarget = Math.max(0, trapped.ht + 60 - eyeHeight);
    lastLiftTarget = liftTarget;
    const liftStep = 500 * dt;
    if (lift < liftTarget) lift = Math.min(liftTarget, lift + liftStep);
    else if (lift > liftTarget) lift = Math.max(liftTarget, lift - liftStep);
    return {
      x: finalX,
      y: finalY,
      boom,
      clear,
      blocked: clear < 0.999,
      side,
      lift,
    };
  }

  function reset() { boom = 260; lastClear = 1; side = 0; lastSideTarget = 0; lift = 0; lastLiftTarget = 0; }

  return {
    update,
    reset,
    get boom() { return boom; },
    get lastClear() { return lastClear; },
    debug() { return { boom: Math.round(boom), clear: Math.round(lastClear * 100) / 100, blocked: lastClear < 0.999, side: Math.round(side), lift: Math.round(lift) }; },
  };
}
