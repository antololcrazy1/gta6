// Human rigs for pedestrians and the player. A person is built from
// thigh + calf + shoe segments on each leg, with the shoe bottom exactly at
// ground level, arms that swing opposite to the legs, a torso that bobs and
// a head. The walk is a real walk: about four steps a second, the knee
// bending on the forward swing, the hips swinging wider when running, a
// slight forward lean at a sprint, gentle breathing when standing still.
import { CFG } from './config.js';

const SKIN = [0xe8b88a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0x6e4426];
const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8c84a, 0x9a4ad8, 0xe8e8e8, 0x222222, 0xe87a4a, 0x4ad8d8, 0xd84a9a];
const TROUSERS = [0x2a3a5a, 0x3a3a3a, 0x5a3a2a, 0x2a5a3a, 0x6a6a6a, 0x1a1a2a];
const HAIR_COLORS = [0x1a1a1a, 0x4a2a1a, 0x8a6a3a, 0xaaaaaa, 0x6a1a1a];

// Build one human as a THREE.Group. opts: height (units), build
// ('slim' | 'average' | 'heavy'), shirt, trousers, skin, hair, hat.
// The group origin is at the ground, under the feet.
export function buildHumanRig(THREE, opts) {
  const o = opts || {};
  const height = o.height || 96;
  const build = o.build || 'average';
  const widthScale = build === 'slim' ? 0.85 : build === 'heavy' ? 1.25 : 1;
  const legLen = height * 0.48;
  const thighLen = legLen * 0.52;
  const calfLen = legLen * 0.48;
  const torsoLen = height * 0.3;
  const headR = height * 0.075;

  const skin = new THREE.MeshLambertMaterial({ color: o.skin ?? SKIN[0] });
  const shirtMat = new THREE.MeshLambertMaterial({ color: o.shirt ?? SHIRTS[0] });
  const trouserMat = new THREE.MeshLambertMaterial({ color: o.trousers ?? TROUSERS[0] });
  const hairMat = new THREE.MeshLambertMaterial({ color: o.hair ?? HAIR_COLORS[0] });

  const group = new THREE.Group();

  // Legs. Each leg is a pivot at the hip: thigh mesh hangs down from it,
  // then a knee pivot holds the calf, then the shoe at the bottom. The
  // shoe bottom sits exactly at y = 0 when the leg is straight.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(7 * widthScale * side, legLen, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(9 * widthScale, thighLen, 10 * widthScale), trouserMat);
    thigh.position.y = -thighLen / 2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -thighLen;
    hip.add(knee);
    const calf = new THREE.Mesh(new THREE.BoxGeometry(8 * widthScale, calfLen, 9 * widthScale), trouserMat);
    calf.position.y = -calfLen / 2;
    knee.add(calf);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(9 * widthScale, 6, 20 * widthScale), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
    shoe.position.set(0, -calfLen - 3, 4);
    knee.add(shoe);
    group.add(hip);
    return { hip, knee, shoe };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Torso, from the hips up.
  const torso = new THREE.Group();
  torso.position.y = legLen;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(30 * widthScale, torsoLen, 16 * widthScale), shirtMat);
  chest.position.y = torsoLen / 2;
  torso.add(chest);
  group.add(torso);

  // Arms hang from the shoulders and swing opposite to the legs.
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(19 * widthScale * side, torsoLen - 4, 0);
    torso.add(shoulder);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(8 * widthScale, torsoLen * 0.85, 9 * widthScale), shirtMat);
    arm.position.y = -torsoLen * 0.42;
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(7 * widthScale, 7, 8 * widthScale), skin);
    hand.position.y = -torsoLen * 0.85;
    shoulder.add(hand);
    return { shoulder };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Head with hair or a hat.
  const head = new THREE.Group();
  head.position.y = torsoLen + headR * 0.8;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.7, headR * 1.8, headR * 1.6), skin);
  head.add(skull);
  if (o.hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.9, headR * 0.6, headR * 1.8), new THREE.MeshLambertMaterial({ color: o.hatColor ?? 0xd84a4a }));
    cap.position.y = headR * 0.9;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.8, headR * 0.25, headR * 0.9), cap.material);
    brim.position.set(0, headR * 0.7, headR * 1.1);
    head.add(brim);
  } else if (o.hat === 'beanie') {
    const beanie = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.8, headR * 0.8, headR * 1.7), new THREE.MeshLambertMaterial({ color: o.hatColor ?? 0x4a7ad8 }));
    beanie.position.y = headR * 0.85;
    head.add(beanie);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.75, headR * 0.9, headR * 1.65), hairMat);
    hair.position.y = headR * 0.75;
    head.add(hair);
  }

  const rig = {
    group,
    parts: { legL, legR, armL, armR, torso, head },
    height,
    build,
    // The walk phase, in radians. Advances with distance walked.
    phase: 0,
  };
  return rig;
}

// Animate one rig for a frame. speed is units per second; dt is seconds.
// When speed is near zero the person breathes gently instead of walking.
export function animateHumanRig(rig, speed, dt, running) {
  const parts = rig.parts;
  const stepRate = CFG.WALK_STEPS_PER_SEC * Math.PI * (running ? 1.5 : 1);
  if (speed > 12) {
    // Four steps a second at a walk: the phase advances with the stride.
    rig.phase += dt * stepRate * (0.6 + speed / CFG.WALK_SPEED);
    const s = Math.sin(rig.phase);
    const c = Math.cos(rig.phase);
    // Legs swing forward and back.
    parts.legL.hip.rotation.x = s * (running ? 0.95 : 0.65);
    parts.legR.hip.rotation.x = -s * (running ? 0.95 : 0.65);
    // The knee bends on the forward swing: the front leg's knee lifts.
    parts.legL.knee.rotation.x = Math.max(0, -c) * (running ? 1.3 : 0.9);
    parts.legR.knee.rotation.x = Math.max(0, c) * (running ? 1.3 : 0.9);
    // Arms swing opposite to the legs.
    parts.armL.shoulder.rotation.x = -s * 0.55;
    parts.armR.shoulder.rotation.x = s * 0.55;
    // The body bobs twice per stride and leans forward at a sprint.
    const bob = Math.abs(Math.cos(rig.phase)) * (running ? 5 : 3);
    parts.torso.position.y = rig.height * 0.48 - bob * 0.4 + (running ? 2 : 0);
    parts.torso.rotation.x = running ? 0.14 : 0.05;
    // Hips swing wider when running.
    parts.torso.rotation.z = s * (running ? 0.1 : 0.05);
    parts.torso.rotation.y = -s * 0.08;
  } else {
    // Standing idle: ease the limbs back to neutral and breathe.
    const t = performance.now() / 1000;
    parts.legL.hip.rotation.x *= 0.8;
    parts.legR.hip.rotation.x *= 0.8;
    parts.legL.knee.rotation.x *= 0.8;
    parts.legR.knee.rotation.x *= 0.8;
    parts.armL.shoulder.rotation.x = Math.sin(t * 1.4) * 0.04;
    parts.armR.shoulder.rotation.x = -Math.sin(t * 1.4) * 0.04;
    parts.torso.position.y = rig.height * 0.48 + Math.sin(t * 1.4) * 1.2;
    parts.torso.rotation.x = 0;
    parts.torso.rotation.z = 0;
    parts.torso.rotation.y = 0;
  }
}

// Deterministic look data for one pedestrian, from an rng.
export function randomPedLook(rng, beach) {
  const hatRoll = rng.f();
  return {
    height: beach ? rng.range(88, 104) : rng.range(84, 108),
    build: rng.pick(['slim', 'average', 'average', 'heavy']),
    shirt: rng.pick(SHIRTS),
    trousers: beach ? rng.pick([0xe84a6a, 0x4ad8d8, 0xe8c84a, 0xd84a4a]) : rng.pick(TROUSERS),
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR_COLORS),
    hat: hatRoll < 0.16 ? 'cap' : hatRoll < 0.26 ? 'beanie' : null,
    hatColor: rng.pick([0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x222222]),
  };
}
