// Real shadow mapping for Vice Coast round 7.
//
// The old lighting faked shadows with dark blobs. This module replaces
// the fakery with real shadow maps: the renderer enables PCF soft
// shadows, the sun becomes a shadow-casting directional light, and its
// shadow camera is a tight box that follows the player instead of
// covering the whole 11400x6600 map at once — a small frustum keeps the
// shadows crisp and the frame rate sane. At night the sun stops casting
// and the player's headlights take over: two spotlights throw cones of
// light on the road ahead, and the police helicopter's searchlight gets
// a real spotlight too.
//
// The module owns the shadow rig (lights + their per-frame updates) and
// nothing else: the renderer still builds the meshes, and this file just
// tells the lights where to point each frame.
import * as THREE from 'three';

export const SHADOW_TUNING = {
  // Shadow map resolution: 2048 is crisp enough for a street scene
  // without costing a frame on a phone GPU.
  mapSize: 2048,
  // Half-extent of the shadow camera box around the player, in world
  // units. Tight enough for sharp shadows, wide enough that a nearby
  // building's shadow still falls across the street.
  frustumHalf: 900,
  // How far the shadow camera reaches along the sun's direction.
  near: 100,
  far: 6000,
  // A small bias so flat roofs and roads do not shimmer.
  bias: -0.0004,
  // The sun sits this far from the player along its direction.
  sunDistance: 2600,
};

// Build the shadow rig: a sun light that casts shadows, two headlight
// spotlights mounted on the player's car, and a helicopter searchlight.
// Returns the lights plus an update() that re-aims them every frame.
export function createShadowRig(scene, tuning) {
  const t = { ...SHADOW_TUNING, ...(tuning || {}) };

  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(t.mapSize, t.mapSize);
  sun.shadow.camera.left = -t.frustumHalf;
  sun.shadow.camera.right = t.frustumHalf;
  sun.shadow.camera.top = t.frustumHalf;
  sun.shadow.camera.bottom = -t.frustumHalf;
  sun.shadow.camera.near = t.near;
  sun.shadow.camera.far = t.far;
  sun.shadow.bias = t.bias;
  scene.add(sun);
  scene.add(sun.target);

  // Headlights: a warm spotlight per lamp, aimed down the road. They
  // only cast shadows at night — by day they are plain lights so the
  // sun's shadow map does the work alone.
  function headlight() {
    const spot = new THREE.SpotLight(0xfff3c4, 0, 900, 0.55, 0.45, 1.2);
    spot.castShadow = false;
    scene.add(spot);
    scene.add(spot.target);
    return spot;
  }
  const headLeft = headlight();
  const headRight = headlight();

  // The helicopter's searchlight: a cool white cone that follows the
  // player from above and pools on the ground.
  const heliSpot = new THREE.SpotLight(0xfff3c4, 0, 1400, 0.35, 0.5, 1.0);
  heliSpot.castShadow = false;
  scene.add(heliSpot);
  scene.add(heliSpot.target);

  // Re-aim the rig for one frame. sunDir is the direction FROM the sun
  // toward the scene (a unit vector); the sun light is placed up that
  // direction from the player and its shadow camera follows. intensity
  // fades the sun out at night; isNight flips the headlights on.
  function update(state) {
    const p = state.player;
    const sunDir = state.sunDirection || { x: -0.55, y: 0.35, z: 0.36 };
    const len = Math.hypot(sunDir.x, sunDir.y, sunDir.z) || 1;
    const dx = sunDir.x / len;
    const dy = sunDir.y / len;
    const dz = sunDir.z / len;
    sun.position.set(p.x - dx * t.sunDistance, 40 - dy * t.sunDistance, p.y - dz * t.sunDistance);
    sun.target.position.set(p.x, 0, p.y);
    const phase = state.weather ? state.weather.phase : 'day';
    const night = phase === 'night';
    const sunset = phase === 'sunset';
    sun.intensity = night ? 0.12 : sunset ? 1.15 : 1.55;
    sun.color.setHex(night ? 0x8fa8d8 : sunset ? 0xff8a4a : 0xfff3c4);
    sun.castShadow = !night;

    // Headlights: on at night and at sunset, aimed from the car's nose
    // down the road ahead. When the player is on foot they stay dark.
    const car = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
    const lampsOn = !!car && (night || sunset);
    const lampPower = night ? 260 : 120;
    for (const [spot, side] of [[headLeft, -1], [headRight, 1]]) {
      if (!lampsOn) { spot.intensity = 0; continue; }
      const a = car.angle;
      const sideX = Math.cos(a + Math.PI / 2) * side * 18;
      const sideY = Math.sin(a + Math.PI / 2) * side * 18;
      spot.position.set(car.x + Math.cos(a) * 48 + sideX, 26, car.y + Math.sin(a) * 48 + sideY);
      spot.target.position.set(car.x + Math.cos(a) * 620 + sideX, 0, car.y + Math.sin(a) * 620 + sideY);
      spot.intensity = lampPower;
    }

    // Heli searchlight: on while the helicopter is up, aimed from the
    // helicopter straight down at the player.
    const heli = state.heli;
    if (heli) {
      heliSpot.position.set(heli.x, 320, heli.y);
      heliSpot.target.position.set(p.x, 0, p.y);
      heliSpot.intensity = night ? 500 : 260;
    } else {
      heliSpot.intensity = 0;
    }
  }

  return {
    sun, headLeft, headRight, heliSpot, update,
    debug() {
      return {
        mapSize: t.mapSize,
        frustumHalf: t.frustumHalf,
        sunCasting: sun.castShadow,
        headlights: headLeft.intensity > 0,
      };
    },
  };
}

// Mark a mesh so it takes part in the shadow pass. Buildings and cars
// both cast and receive; the ground only receives; small props cast.
export function shadowFlags(mesh, mode) {
  if (mode === 'ground') {
    mesh.receiveShadow = true;
    mesh.castShadow = false;
  } else if (mode === 'prop') {
    mesh.castShadow = true;
    mesh.receiveShadow = false;
  } else {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}
