// Human pedestrian rigs for Vice Coast round 7.
//
// The old pedestrians were a box and a ball. This module builds a proper
// human figure from the same low-poly language as the player character:
// thigh + calf + shoe on each leg with the shoe bottom exactly at ground
// level, arms that swing opposite to the legs, a head with hair or a hat,
// and a body whose height and width vary per pedestrian so a crowd never
// looks cloned. A walk cycle drives the joints: about four steps a second,
// the knee bends on the forward swing, the body bobs, and the hips swing
// wider when the pedestrian hurries.
//
// A rig is a THREE.Group built once per pedestrian and then posed every
// frame by poseRig(). The rig reads its variation from the pedestrian's
// own data (height, build, shirt, trousers, hair, hat), so the rules
// layer owns the variety and this module owns the shape.
import * as THREE from 'three';

// Skin tones, hair colours and hat colours the rig picks from by seed.
export const SKIN_TONES = [0xe8b88a, 0xc98d64, 0x8d5a3b, 0xf0c8a0, 0x6b4423];
export const HAIR_COLORS = [0x1a1a1a, 0x4a2c14, 0x8a8a8a, 0xd9a441, 0x6b2d1a];
export const HAT_COLORS = [0xe74c3c, 0xf1c40f, 0x3498db, 0xecf0f1, 0x2ecc71];

function shade(color, f) {
  const c = new THREE.Color(color);
  c.multiplyScalar(f);
  return c.getHex();
}

// Pick a deterministic value from a list by a pedestrian's seed.
function pickBySeed(list, seed, salt) {
  const n = Math.abs(Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453);
  return list[Math.floor(n % 1 * list.length) % list.length];
}

// The variation a pedestrian carries: height in world units (a 1.0
// figure is about 96 tall), body width, shirt and trouser colours, a
// skin tone, and either hair or a hat. Beachgoers get shorts, a bare
// torso or a bright top, and sandals instead of shoes.
export function pedVariation(ped) {
  const seed = ped.seed ?? (ped.x * 0.013 + ped.y * 0.007);
  // The rules layer (world.js) already rolled each pedestrian's look;
  // use it when present so the rig matches the saved state, and fall
  // back to a seed-derived look for any pedestrian built without one.
  const height = ped.height ?? (0.88 + ((Math.abs(Math.sin(seed * 91.7)) * 0.24)));
  const build = ped.build ?? (0.85 + (Math.abs(Math.sin(seed * 57.3)) * 0.35));
  const skin = pickBySeed(SKIN_TONES, seed, 1);
  const hair = ped.hair ?? pickBySeed(HAIR_COLORS, seed, 2);
  const hat = ped.hat !== undefined ? ped.hat : (ped.beach ? null : (Math.abs(Math.sin(seed * 33.9)) < 0.3 ? pickBySeed(HAT_COLORS, seed, 3) : null));
  return {
    height,
    build,
    skin,
    hair,
    hat,
    shirt: ped.beach ? pickBySeed([0xff6b9d, 0x2ecc71, 0xf1c40f, 0x48dbfb, 0xecf0f1], seed, 4) : ped.color,
    trousers: ped.trousers ?? (ped.beach ? 0xe8c98f : pickBySeed([0x2c3e50, 0x34495e, 0x5d4037, 0x1c2733, 0x6b7c93], seed, 5)),
    shoe: ped.beach ? 0x8a6a42 : 0x1a1a1a,
  };
}

function boxMesh(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.castShadow = true;
  return m;
}

// Build one pedestrian rig. The joints are returned so poseRig() can
// drive them; the group is positioned by the renderer each frame.
export function buildPedRig(ped, variation) {
  const v = variation || pedVariation(ped);
  const g = new THREE.Group();
  const s = v.height; // overall scale
  const w = v.build; // body-width scale

  // Legs: hip pivots at the body's base, thigh down to the knee, calf
  // down to the ankle, shoe forward from the ankle. The numbers are
  // chosen so the shoe's bottom lands exactly at y = 0 when the leg
  // hangs straight: hip 52, thigh 26, calf 22, shoe 6 tall, all scaled.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0, 52 * s, side * 8 * w);
    const thigh = boxMesh(11 * w, 26 * s, 11 * w, v.trousers);
    thigh.position.y = -13 * s;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -26 * s;
    hip.add(knee);
    const calf = boxMesh(9 * w, 22 * s, 9 * w, shade(v.trousers, 0.85));
    calf.position.y = -11 * s;
    knee.add(calf);
    const shoe = boxMesh(10 * w, 6 * s, 20 * w, v.shoe);
    shoe.position.set(3, -25 * s, 0);
    knee.add(shoe);
    g.add(hip);
    return { hip, knee };
  }

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 92 * s, side * 20 * w);
    const upper = boxMesh(9 * w, 30 * s, 9 * w, v.shirt);
    upper.position.y = -15 * s;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -30 * s;
    shoulder.add(elbow);
    const forearm = boxMesh(8 * w, 26 * s, 8 * w, v.skin);
    forearm.position.y = -13 * s;
    elbow.add(forearm);
    g.add(shoulder);
    return { shoulder, elbow };
  }

  const torso = boxMesh(30 * w, 42 * s, 17 * w, v.shirt);
  torso.position.y = 73 * s;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(11 * s, 12, 10),
    new THREE.MeshLambertMaterial({ color: v.skin }),
  );
  head.position.y = 104 * s;
  head.castShadow = true;
  g.add(torso, head);
  if (v.hat) {
    const hat = boxMesh(24 * w, 7 * s, 24 * w, v.hat);
    hat.position.y = 112 * s;
    g.add(hat);
    const brim = boxMesh(28 * w, 3 * s, 28 * w, v.hat);
    brim.position.y = 109 * s;
    g.add(brim);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(11.5 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshLambertMaterial({ color: v.hair }),
    );
    hair.position.y = 106 * s;
    hair.castShadow = true;
    g.add(hair);
  }

  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  const armL = makeArm(-1);
  const armR = makeArm(1);
  g.userData = {
    torso, head,
    legL, legR, armL, armR,
    height: v.height,
    walkPhase: ped.walkPhase || 0,
  };
  return g;
}

// Pose a rig for one frame. phase advances about 4 steps a second while
// the pedestrian walks; swing is 0 when standing still. The knee bends
// on the forward swing, the arms counter-swing, the body bobs twice per
// stride and the hips sway a little wider when hurrying.
export function poseRig(rig, phase, moving, hurrying, time) {
  const u = rig.userData;
  const swing = moving ? (hurrying ? 0.85 : 0.62) : 0;
  const left = Math.sin(phase);
  const right = Math.sin(phase + Math.PI);
  u.legL.hip.rotation.x = left * swing;
  u.legR.hip.rotation.x = right * swing;
  // The knee only bends while its leg swings forward, never backward.
  u.legL.knee.rotation.x = Math.max(0, -right) * 1.05 * swing;
  u.legR.knee.rotation.x = Math.max(0, -left) * 1.05 * swing;
  // Arms swing opposite to the legs on the same side.
  u.armL.shoulder.rotation.x = right * swing * 0.75;
  u.armR.shoulder.rotation.x = left * swing * 0.75;
  u.armL.elbow.rotation.x = -0.25 - Math.max(0, right) * 0.35 * swing;
  u.armR.elbow.rotation.x = -0.25 - Math.max(0, left) * 0.35 * swing;
  // Body bob: two bobs per full stride, plus a gentle breathing sway
  // when the pedestrian stands still.
  const bob = moving ? Math.abs(Math.cos(phase)) * 3.5 : Math.sin(time * 1.6) * 1.2;
  u.torso.position.y = 73 * u.height + bob;
  u.head.position.y = 104 * u.height + bob;
  // A slight forward lean and hip sway while hurrying.
  u.torso.rotation.x = hurrying ? 0.08 : 0;
  u.torso.rotation.z = moving ? Math.sin(phase) * 0.05 : 0;
}
