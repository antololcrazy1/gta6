// Vice Coast v6 — Three.js low-poly 3D renderer.
// The simulation stays in world.js (2D top-down rules, 3600x2600 city); this
// file is only presentation: it turns that state into a GTA-style third-
// person 3D scene — low chase cam, golden-hour sunset, busy streets, police
// helicopter with a searchlight, and an animated on-foot character.
// Scale: 1 world unit = 0.12 scene units, city centred on the origin.
// Map (x, y) -> (x*S - W/2, 0, y*S - H/2); world angle a -> rotation.y = -a.
import * as THREE from '../vendor/three.module.js';
import { WORLD, PALETTE } from './config.js';
import { ROADS_V, ROADS_H } from './world.js';

const S = 0.12;
const CX = (WORLD.width * S) / 2;
const CZ = (WORLD.height * S) / 2;
export function to3(x, y, h = 0) { return new THREE.Vector3(x * S - CX, h, y * S - CZ); }
function rotY(a) { return -a; }

// Golden-hour-first lighting per weather phase.
const PHASES = {
  day:    { sky: 0x87b5d6, fog: 0x9fc3dd, sun: 0xfff2cf, sunI: 2.4, hemi: 0xbfd9ee, hemiI: 0.9, amb: 0.25, sunPos: [60, 90, 20], sunSprite: null },
  sunset: { sky: 0xff7e3d, fog: 0xe86a4a, sun: 0xff9a3c, sunI: 3.2, hemi: 0x8a5a8a, hemiI: 1.3, amb: 0.2, sunPos: [-140, 16, 10], sunSprite: 0xffb347 },
  night:  { sky: 0x0d1026, fog: 0x141832, sun: 0x8fa8ff, sunI: 0.9, hemi: 0x2a2f55, hemiI: 0.75, amb: 0.12, sunPos: [40, 80, -30], sunSprite: 0xdfe8ff },
  rain:   { sky: 0x5a5f6e, fog: 0x6a6f7d, sun: 0xcfd6e2, sunI: 1.1, hemi: 0x777d8c, hemiI: 0.7, amb: 0.2, sunPos: [30, 70, 10], sunSprite: null },
};

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Building facade: lit windows on a coloured wall, so towers read as a city
// even as flat low-poly boxes.
function facadeTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 12; y += 22) {
      for (let x = 10; x < w - 12; x += 18) {
        const on = ((x * 7 + y * 13) % 5) < 3;
        g.fillStyle = on ? lit : '#20242e';
        g.fillRect(x, y, 11, 13);
      }
    }
  });
}

function billboardTexture(lines, bg, fg) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 64px system-ui, sans-serif';
    g.fillText(lines[0], w / 2, lines.length > 1 ? h / 2 - 34 : h / 2);
    if (lines.length > 1) {
      g.font = '700 34px system-ui, sans-serif';
      g.fillText(lines[1], w / 2, h / 2 + 42);
    }
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  });
}

function sunTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.35, 'rgba(255,170,70,0.9)');
    grad.addColorStop(1, 'rgba(255,110,40,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

const CAR_COLORS_3D = { red: 0xe74c3c, orange: 0xe67e22, yellow: 0xf1c40f, blue: 0x3498db, white: 0xecf0f1, green: 0x2ecc71, purple: 0x9b59b6, pink: 0xff6b9d, teal: 0x1abc9c, grey: 0x7f8c8d };
function hexColor(css) {
  const m = /^#([0-9a-f]{6})$/i.exec(css || '');
  return m ? parseInt(m[1], 16) : 0xcccccc;
}

// ---- low-poly person: torso, head, two legs + two arms on pivots, a gun in
// the right hand. Limbs swing from a walk phase; aim pose raises the gun.
// Deterministic walk phases: a counter, not Math.random, so the same staged
// scene renders byte-identical every time (screenshots must be reproducible).
let personSeq = 0;
export function makePerson(shirt, pants, skin = 0xc68863) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(shirt));
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), mat(skin));
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), mat(0x1c1410));
  hair.position.y = 1.82; g.add(hair);
  const legL = new THREE.Group(); legL.position.set(-0.16, 0.72, 0);
  const legR = new THREE.Group(); legR.position.set(0.16, 0.72, 0);
  for (const leg of [legL, legR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), mat(pants));
    m.position.y = -0.36; m.castShadow = true; leg.add(m); g.add(leg);
  }
  const armL = new THREE.Group(); armL.position.set(-0.42, 1.36, 0);
  const armR = new THREE.Group(); armR.position.set(0.42, 1.36, 0);
  for (const arm of [armL, armR]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), mat(shirt));
    m.position.y = -0.31; m.castShadow = true; arm.add(m); g.add(arm);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), mat(0x222222));
  gun.position.set(0, -0.62, 0.18); gun.visible = false; armR.add(gun);
  g.userData = { legL, legR, armL, armR, gun, phase: ((personSeq += 1) * 1.7) % 6, torso, head };
  return g;
}

export function animatePerson(g, speed, dt, aiming, shooting) {
  const u = g.userData;
  const moving = speed > 20;
  if (moving) u.phase += dt * speed * 0.045;
  const swing = moving ? Math.sin(u.phase) * (speed > 300 ? 0.85 : 0.6) : 0;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  if (aiming || shooting) {
    u.armR.rotation.x = -Math.PI / 2 + 0.08;
    u.armL.rotation.x = -Math.PI / 2 + 0.25;
    u.armL.rotation.z = 0.5;
    u.legL.rotation.x *= 0.4; u.legR.rotation.x *= 0.4;
    u.gun.visible = true;
  } else {
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    u.armL.rotation.z = 0; u.armR.rotation.x = -swing * 0.8;
    u.gun.visible = false;
  }
  // Idle breathing so standing figures are not statues.
  u.torso.position.y = 1.05 + (moving ? 0 : Math.sin(u.phase * 0.5) * 0.015);
}

// ---- low-poly car: body + cabin + wheels + lights. Cop cars get a flashing
// light bar; gang cars get gold trim. Player car gets headlight cones.
export function makeCar(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: hexColor(color) });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.62, 1.7), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 1.6), bodyMat);
  nose.position.set(1.85, 0.48, 0); nose.castShadow = true; g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.5), darkMat);
  cabin.position.set(-0.15, 1.08, 0); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.45), bodyMat);
  roof.position.set(-0.15, 1.38, 0); g.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[1.15, 0.82], [1.15, -0.82], [-1.15, 0.82], [-1.15, -0.82]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 0.36, wz); w.castShadow = true; g.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const z of [0.55, -0.55]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), headMat);
    h.position.set(2.21, 0.55, z); g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const z of [0.55, -0.55]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), tailMat);
    t.position.set(-1.75, 0.55, z); g.add(t);
  }
  let barR = null, barB = null;
  if (opts.cop) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.1), darkMat);
    bar.position.set(-0.15, 1.46, 0); g.add(bar);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barR.position.set(-0.15, 1.48, 0.28); g.add(barR);
    barB = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barB.position.set(-0.15, 1.48, -0.28); g.add(barB);
  }
  if (opts.gang) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.1, 1.72), new THREE.MeshBasicMaterial({ color: 0xf1c40f }));
    trim.position.y = 0.88; g.add(trim);
  }
  if (opts.player) {
    // Spoiler, so the player's car reads as a sports car from the chase cam.
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.7), darkMat);
    spoiler.position.set(-1.7, 1.05, 0); g.add(spoiler);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.12), darkMat);
    strut.position.set(-1.7, 0.85, 0.5); g.add(strut);
    const strut2 = strut.clone(); strut2.position.z = -0.5; g.add(strut2);
    // Headlight cones: translucent, only visible at sunset/night.
    const coneGeo = new THREE.ConeGeometry(0.9, 6, 12, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
    for (const z of [0.5, -0.5]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.z = -Math.PI / 2; cone.rotation.y = 0;
      cone.position.set(5.1, 0.5, z); g.add(cone);
    }
    g.userData.headlightCones = true;
  }
  g.userData.barR = barR; g.userData.barB = barB;
  return g;
}

function makePalm(h = 7) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  trunk.position.y = h / 2; trunk.rotation.z = 0.08; trunk.castShadow = true; g.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 4), frondMat);
    frond.position.set(Math.cos(a) * 1.1, h + 0.2, Math.sin(a) * 1.1);
    frond.rotation.z = Math.PI / 2.4 * Math.cos(a);
    frond.rotation.x = -Math.PI / 2.4 * Math.sin(a);
    frond.castShadow = true; g.add(frond);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
  nut.position.y = h + 0.1; g.add(nut);
  return g;
}

function makeHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2f6fd0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.6), bodyMat);
  body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.4), new THREE.MeshLambertMaterial({ color: 0x9fd8ef }));
  glass.position.set(1.4, 0.1, 0); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 0.4), bodyMat);
  tail.position.set(-2.8, 0.35, 0); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.1), bodyMat);
  fin.position.set(-4.3, 0.7, 0); g.add(fin);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const z of [0.7, -0.7]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.12), skidMat);
    skid.position.set(0, -0.75, z); g.add(skid);
  }
  const rotor = new THREE.Group(); rotor.position.y = 0.75;
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.06, 0.35), bladeMat);
    blade.rotation.y = a; rotor.add(blade);
  }
  g.add(rotor);
  // Searchlight: a translucent cone + a bright pool on the ground.
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.ConeGeometry(4, 14, 16, 1, true);
  const beam = new THREE.Mesh(cone, coneMat);
  beam.position.y = -7; beam.rotation.x = Math.PI; g.add(beam);
  g.userData.rotor = rotor; g.userData.beam = beam;
  return g;
}

// ---- the renderer: builds the static city once, then syncs it from state ----
export function createRenderer3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PHASES.sunset.sky);
  scene.fog = new THREE.Fog(PHASES.sunset.fog, 90, 320);

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 900);
  camera.position.set(0, 20, 40);

  const sun = new THREE.DirectionalLight(0xff9a3c, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 400;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x8a5a8a, 0x3a2a1a, 0.75);
  scene.add(hemi);
  const headSpot = new THREE.SpotLight(0xfff2b0, 0, 60, 0.5, 0.5, 1.2);
  scene.add(headSpot); scene.add(headSpot.target);

  // Sun disc sprite, low on the horizon at golden hour.
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.set(130, 130, 1);
  scene.add(sunSprite);

  // ---- static city ----
  const city = new THREE.Group();
  scene.add(city);
  const groundMat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width * S + 120, WORLD.height * S + 120), groundMat(0x7a7f6a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; city.add(ground);
  // Ocean west of the beach + sand strip.
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(140, WORLD.height * S + 140), new THREE.MeshLambertMaterial({ color: 0x1b6f8e }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-CX - 70 + 18, -0.05, 0); ocean.receiveShadow = true; city.add(ocean);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(300 * S + 6, WORLD.height * S), groundMat(0xe8c98f));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-CX + 150 * S, 0.02, 0); sand.receiveShadow = true; city.add(sand);
  // District ground washes.
  const districtWash = [
    { x0: 2240, y0: 0, x1: 3600, y1: 1600, c: 0x4a4356 },
    { x0: 2624, y0: 1600, x1: 3600, y1: 2600, c: 0x6e6250 },
  ];
  for (const d of districtWash) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry((d.x1 - d.x0) * S, (d.y1 - d.y0) * S), groundMat(d.c));
    m.rotation.x = -Math.PI / 2;
    m.position.set(((d.x0 + d.x1) / 2) * S - CX, 0.03, ((d.y0 + d.y1) / 2) * S - CZ);
    m.receiveShadow = true; city.add(m);
  }
  // Roads: dark strips + dashed centre lines.
  const roadMat = groundMat(0x454850);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const rx of ROADS_V) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(9, WORLD.height * S), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(rx * S - CX, 0.05, 0); r.receiveShadow = true; city.add(r);
  }
  for (const ry of ROADS_H) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width * S, 9), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, ry * S - CZ); r.receiveShadow = true; city.add(r);
  }
  const dashGeo = new THREE.BoxGeometry(0.35, 0.06, 2.2);
  for (const rx of ROADS_V) {
    for (let y = 40; y < WORLD.height; y += 90) {
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(rx * S - CX, 0.08, y * S - CZ); city.add(d);
    }
  }
  for (const ry of ROADS_H) {
    for (let x = 340; x < WORLD.width; x += 90) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.35), dashMat);
      d.position.set(x * S - CX, 0.08, ry * S - CZ); city.add(d);
    }
  }

  // Buildings, parks, palms, streetlights, billboards — from the live state
  // the first time render() runs (world is built before the renderer boots).
  let staticBuilt = false;
  let buildingMeshes = [];
  function buildStatic(st) {
    if (staticBuilt) return;
    staticBuilt = true;
    const facadeCache = new Map();
    for (const b of st.buildings) {
      const key = b.color;
      if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(b.color, '#ffd76a'));
      const h = 8 + ((b.seed * 997) % 10);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w * S, h, b.h * S),
        new THREE.MeshLambertMaterial({ map: facadeCache.get(key) }));
      mesh.position.set((b.x + b.w / 2) * S - CX, h / 2, (b.y + b.h / 2) * S - CZ);
      mesh.castShadow = true; mesh.receiveShadow = true; city.add(mesh);
      buildingMeshes.push(mesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w * S * 0.94, 0.5, b.h * S * 0.94), groundMat(hexColor(b.roof)));
      roof.position.set(mesh.position.x, h + 0.25, mesh.position.z); city.add(roof);
      // A few towers get a rooftop beacon light.
      if (h > 15) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
        beacon.position.set(mesh.position.x, h + 0.8, mesh.position.z); city.add(beacon);
      }
    }
    for (const p of st.parks) {
      const park = new THREE.Mesh(new THREE.PlaneGeometry(p.w * S, p.h * S), groundMat(0x4f9e57));
      park.rotation.x = -Math.PI / 2;
      park.position.set((p.x + p.w / 2) * S - CX, 0.04, (p.y + p.h / 2) * S - CZ);
      park.receiveShadow = true; city.add(park);
    }
    // Palms: beach row + scattered along the boulevards.
    const palmSpots = [];
    for (let y = 100; y < WORLD.height; y += 260) palmSpots.push([180, y]);
    for (let y = 200; y < WORLD.height; y += 520) palmSpots.push([330, y]);
    for (const t of st.trees) palmSpots.push([t.x, t.y]);
    for (const [x, y] of palmSpots) {
      const palm = makePalm(6 + ((x * 13 + y * 7) % 3));
      palm.position.set(x * S - CX, 0, y * S - CZ);
      city.add(palm);
    }
    // Streetlights along the vertical roads.
    const poleMat = groundMat(0x2a2d33);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const rx of ROADS_V) {
      for (let y = 320; y < WORLD.height; y += 640) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
        pole.position.set(rx * S - CX + 6.5, 3, y * S - CZ + 6.5); city.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
        lamp.position.set(rx * S - CX + 6.5, 6.1, y * S - CZ + 6.5); city.add(lamp);
      }
    }
    // Billboards with the city's own names.
    const boards = [
      { x: 1088, y: 300, lines: ['VICE COAST', 'Kumala Strand • Est. 1986'], bg: '#ff5a3c', fg: '#fff7e8' },
      { x: 2624, y: 300, lines: ['NEON HOTEL', 'Rooms • Casino • Pool'], bg: '#ff2fb3', fg: '#ffffff' },
      { x: 1856, y: 300, lines: ['CORAL BANK', 'Your money, our vault'], bg: '#1b6f8e', fg: '#ffd76a' },
      { x: 3200, y: 300, lines: ['SUNSET 99 FM', 'All hits, all dusk'], bg: '#7b2fbe', fg: '#ffffff' },
      { x: 704, y: 2280, lines: ['PIER ARCADE', 'Play • Win • Repeat'], bg: '#2ecc71', fg: '#0d1026' },
    ];
    for (const b of boards) {
      const tex = billboardTexture(b.lines, b.bg, b.fg);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(b.x * S - CX, 11, b.y * S - CZ);
      board.rotation.y = Math.PI / 2; city.add(board);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), poleMat);
      post.position.set(b.x * S - CX, 3, b.y * S - CZ); city.add(post);
    }
    // Sunset Pier: wooden deck reaching into the ocean + posts.
    const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 5), groundMat(0x9a7a52));
    pier.position.set(to3(210, 1280, 0.3).x - 8, 0.3, to3(210, 1280).z); city.add(pier);
    for (let i = 0; i < 6; i += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.4, 6), poleMat);
      post.position.set(to3(210, 1280).x - 18 + i * 4.4, 0, to3(210, 1280).z + 2.4); city.add(post);
    }
    // Docks containers.
    const contColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe67e22];
    for (let i = 0; i < 10; i += 1) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 2.2), groundMat(contColors[i % contColors.length]));
      c.position.set(to3(3200 + (i % 5) * 6, 2380 + Math.floor(i / 5) * 5).x, 1.1, to3(3200, 2380).z + (Math.floor(i / 5) * 5 - 2.5) * S);
      c.castShadow = true; city.add(c);
    }
  }

  // ---- dynamic pools ----
  const carPool = new Map(); // car id -> group
  const pedPool = new Map(); // ped index -> group
  const playerMesh = makePerson(0xff5a3c, 0x2c3e50);
  playerMesh.visible = false; scene.add(playerMesh);
  const heliMesh = makeHeli(); heliMesh.visible = false; scene.add(heliMesh);
  const heliPool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0.22, depthWrite: false }));
  heliPool.rotation.x = -Math.PI / 2; heliPool.visible = false; scene.add(heliPool);

  // Mission beacon: gold light pillar + floating diamond.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30; beacon.add(pillar);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshBasicMaterial({ color: 0xffc93c }));
  diamond.position.y = 6; beacon.add(diamond);
  beacon.visible = false; scene.add(beacon);

  // Pickups: small glowing diamonds, gold for hidden packages.
  const pickupPool = [];
  const pickupGeo = new THREE.OctahedronGeometry(0.9);
  for (let i = 0; i < 30; i += 1) {
    const m = new THREE.Mesh(pickupGeo, new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    m.visible = false; scene.add(m); pickupPool.push(m);
  }

  // Particles as points + bullets as stretched boxes.
  const MAXP = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.95 }));
  points.frustumCulled = false; scene.add(points);
  const bulletPool = [];
  const bulletGeo = new THREE.BoxGeometry(1.6, 0.08, 0.08);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  for (let i = 0; i < 24; i += 1) {
    const b = new THREE.Mesh(bulletGeo, bulletMat);
    b.visible = false; scene.add(b); bulletPool.push(b);
  }
  // Rain: points in a box around the camera, recycled.
  const RAIN_N = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ size: 0.35, color: 0xbfd4e6, transparent: true, opacity: 0.6 }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  // Deterministic rain offsets (same formula every run, no Math.random).
  const rainSeed = Array.from({ length: RAIN_N }, (_, i) => {
    const f = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    return [f(i + 1) * 120 - 60, f(i + 101) * 40, f(i + 201) * 120 - 60];
  });

  // Explosion flash light (reused, cheap).
  const boomLight = new THREE.PointLight(0xff7722, 0, 40, 1.5);
  scene.add(boomLight);

  let camPos = new THREE.Vector3(0, 24, 46);
  let camLook = new THREE.Vector3(0, 0, 0);
  let fov = 64;
  let lastPhase = '';

  function applyPhase(phase, raining, px, pz) {
    const p = PHASES[raining ? 'rain' : phase] || PHASES.sunset;
    scene.background.set(p.sky);
    scene.fog.color.set(p.fog);
    sun.color.set(p.sun); sun.intensity = p.sunI;
    sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    hemi.color.set(p.hemi); hemi.intensity = p.hemiI;
    if (p.sunSprite) {
      sunSprite.visible = true;
      sunSprite.material.color.set(0xfff6d8);
      // Park the disc low on the horizon west of the player, so it reads
      // in the chase cam instead of hiding off-frame.
      sunSprite.position.set(px - 260, 7, pz + 12);
    } else sunSprite.visible = false;
    rain.visible = !!raining;
    lastPhase = phase + (raining ? '+rain' : '');
  }

  function carMeshFor(car, isPlayer) {
    let g = carPool.get(car.id);
    if (!g) {
      g = makeCar(car.color, { cop: !!car.cop, gang: !!car.gang, player: isPlayer });
      carPool.set(car.id, g); scene.add(g);
    }
    return g;
  }

  function render(st, screen, time, opts = {}) {
    buildStatic(st);
    const p = st.player;
    const pp = to3(p.x, p.y, 0);
    const phase = st.weather.phase;
    const raining = st.weather.raining;
    if (phase + (raining ? '+rain' : '') !== lastPhase) applyPhase(phase, raining, pp.x, pp.z);
    // The sun disc must track the player (it hangs west of them).
    if (sunSprite.visible) sunSprite.position.set(pp.x - 260, 7, pp.z + 12);
    const inCar = p.inCar;
    const car = inCar ? st.cars.find((c) => c.id === p.carId) : null;
    const speedKmh = Math.abs(p.speed || 0) * 0.32;
    const aiming = !!opts.aiming;
    const dt = opts.dt || 1 / 60;

    // ---- sync cars (cull far ones) ----
    const seenCars = new Set();
    const allCars = [...st.cars, ...st.gangCars];
    for (const c of allCars) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > 260 && !c.cop) continue;
      seenCars.add(c.id);
      const g = carMeshFor(c, car === c);
      const pos = to3(c.x, c.y, 0);
      g.position.copy(pos);
      g.rotation.y = rotY(c.angle);
      g.visible = true;
      if (c.cop && g.userData.barR) {
        const on = Math.floor(time * 6) % 2 === 0;
        g.userData.barR.visible = on; g.userData.barB.visible = !on;
      }
      // Wrecked cars smoke: tilt + darken is enough at this scale; the
      // explosion particles carry the rest.
      g.position.y = c.health <= 0 ? -0.2 : 0;
    }
    for (const [id, g] of carPool) if (!seenCars.has(id)) g.visible = false;

    // ---- sync peds / foot cops ----
    st.peds.forEach((ped, i) => {
      if (!ped.alive) { const old = pedPool.get(i); if (old) old.visible = false; return; }
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d > 180) { const old = pedPool.get(i); if (old) old.visible = false; return; }
      let g = pedPool.get(i);
      if (!g) { g = makePerson(hexColor(ped.color), 0x333a44); pedPool.set(i, g); scene.add(g); }
      g.position.copy(to3(ped.x, ped.y, 0));
      g.rotation.y = rotY(ped.angle);
      g.visible = true;
      animatePerson(g, ped.flee > 0 ? 150 : ped.speed, dt, false, false);
    });
    // Foot cops: reuse the first ped slots after the peds (separate pool).
    st.cops.forEach((cop, i) => {
      const key = 1000 + i;
      if (cop.dead || cop.inCar) { const old = pedPool.get(key); if (old) old.visible = false; return; }
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d > 180) { const old = pedPool.get(key); if (old) old.visible = false; return; }
      let g = pedPool.get(key);
      if (!g) { g = makePerson(0x2f6fd0, 0x1a2436); pedPool.set(key, g); scene.add(g); }
      g.position.copy(to3(cop.x, cop.y, 0));
      g.rotation.y = rotY(Math.atan2(p.y - cop.y, p.x - cop.x));
      g.visible = true;
      animatePerson(g, 200, dt, false, false);
    });

    // ---- player character (hidden while driving) ----
    playerMesh.visible = !inCar && screen !== 'title';
    if (playerMesh.visible) {
      playerMesh.position.copy(pp);
      const face = aiming && opts.aimAngle != null ? opts.aimAngle : p.angle;
      playerMesh.rotation.y = rotY(face);
      animatePerson(playerMesh, Math.abs(p.speed || 0), dt, aiming, !!opts.shooting);
    }

    // ---- helicopter ----
    const heli = st.heli;
    heliMesh.visible = !!heli;
    heliPool.visible = !!heli;
    if (heli) {
      heliMesh.scale.setScalar(2.2);
      const hp = to3(heli.x, heli.y, 16);
      heliMesh.position.copy(hp);
      heliMesh.rotation.y = rotY(Math.atan2(p.y - heli.y, p.x - heli.x));
      heliMesh.userData.rotor.rotation.y = (heli.rotor || 0);
      heliPool.position.set(pp.x, 0.1, pp.z);
      heliPool.material.opacity = 0.24 + 0.08 * Math.sin(time * 5);
    }

    // ---- mission beacon + pickups ----
    if (st.missionTarget && screen === 'play') {
      beacon.visible = true;
      const bp = to3(st.missionTarget.x, st.missionTarget.y, 0);
      beacon.position.copy(bp);
      diamond.position.y = 6 + Math.sin(time * 2.4) * 0.9;
      diamond.rotation.y = time * 1.5;
    } else beacon.visible = false;
    let pi = 0;
    for (const pk of st.pickups) {
      if (!pk.active || pi >= pickupPool.length) continue;
      const m = pickupPool[pi++];
      m.visible = true;
      const pos = to3(pk.x, pk.y, 1.2 + Math.sin((pk.bob || 0) * 2) * 0.3);
      m.position.copy(pos);
      m.rotation.y = time * 2;
      m.material.color.set(pk.kind === 'hidden' ? 0xffc93c : pk.kind === 'health' ? 0x2ecc71 : pk.kind === 'ammo' ? 0x3498db : 0xffffff);
    }
    for (; pi < pickupPool.length; pi += 1) pickupPool[pi].visible = false;

    // ---- particles + bullets ----
    let n = 0;
    for (const pt of st.particles) {
      if (n >= MAXP) break;
      const pos = to3(pt.x, pt.y, 0.6);
      pPos[n * 3] = pos.x; pPos[n * 3 + 1] = pos.y; pPos[n * 3 + 2] = pos.z;
      const c = new THREE.Color(pt.color || '#ffcc55');
      pCol[n * 3] = c.r; pCol[n * 3 + 1] = c.g; pCol[n * 3 + 2] = c.b;
      n += 1;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    // Explosion flash when a big orange burst is live.
    const big = st.particles.some((pt) => (pt.color === '#ff5722' || pt.color === '#ff7722') && pt.life > 0.5);
    boomLight.intensity = big ? 60 : 0;
    if (big) { const bp = st.particles.find((pt) => pt.color === '#ff5722'); if (bp) { const v = to3(bp.x, bp.y, 3); boomLight.position.copy(v); } }
    let bi = 0;
    for (const b of st.bullets) {
      if (bi >= bulletPool.length) break;
      const m = bulletPool[bi++];
      m.visible = true;
      const pos = to3(b.x, b.y, 1.4);
      m.position.copy(pos);
      m.rotation.y = rotY(Math.atan2(b.vy, b.vx));
    }
    for (; bi < bulletPool.length; bi += 1) bulletPool[bi].visible = false;

    // ---- rain around the camera ----
    if (rain.visible) {
      for (let i = 0; i < RAIN_N; i += 1) {
        const s = rainSeed[i];
        rainPos[i * 3] = camPos.x + s[0];
        rainPos[i * 3 + 1] = ((s[1] - time * 26) % 40 + 40) % 40;
        rainPos[i * 3 + 2] = camPos.z + s[2];
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // ---- camera ----
    const speedF = Math.min(1, Math.abs(p.speed || 0) / 560);
    const snap = !!opts.snap;
    function placeCam(wantPos, wantLook, fovTarget, lerpK) {
      if (snap) { camPos.copy(wantPos); camLook.copy(wantLook); fov = fovTarget; return; }
      camPos.lerp(wantPos, 1 - Math.pow(lerpK, dt));
      camLook.lerp(wantLook, 1 - Math.pow(lerpK * 0.5, dt));
      fov += (fovTarget - fov) * 0.06;
    }
    if (screen === 'title') {
      // Slow cinematic orbit over the sunset beach boulevard.
      const t = time * 0.05;
      placeCam(
        new THREE.Vector3(Math.sin(t) * 60 - 60, 26 + Math.sin(t * 0.7) * 4, Math.cos(t) * 40 + 10),
        new THREE.Vector3(-120, 2, 0), 58, 0.001);
    } else if (inCar && car) {
      const a = car.angle;
      const back = 7.5 + speedF * 3.0;
      const up = 2.9 + speedF * 0.5;
      placeCam(
        new THREE.Vector3(pp.x - Math.cos(a) * back, up, pp.z - Math.sin(a) * back),
        new THREE.Vector3(pp.x + Math.cos(a) * 9, 1.4, pp.z + Math.sin(a) * 9),
        62 + speedF * 16, 0.001);
    } else if (aiming) {
      // Over-shoulder: character left-of-centre, gun raised, crosshair ahead.
      const a = opts.aimAngle != null ? opts.aimAngle : p.angle;
      const right = a + Math.PI / 2;
      placeCam(
        new THREE.Vector3(
          pp.x - Math.cos(a) * 5.6 + Math.cos(right) * 1.7,
          2.9,
          pp.z - Math.sin(a) * 5.6 + Math.sin(right) * 1.7),
        new THREE.Vector3(pp.x + Math.cos(a) * 14, 1.6, pp.z + Math.sin(a) * 14),
        52, 0.0001);
    } else {
      const a = p.angle;
      placeCam(
        new THREE.Vector3(pp.x - Math.cos(a) * 7.5, 3.4, pp.z - Math.sin(a) * 7.5),
        new THREE.Vector3(pp.x + Math.cos(a) * 6, 1.3, pp.z + Math.sin(a) * 6),
        60, 0.001);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // Sun + shadows follow the player so the shadow frustum stays useful.
    sun.position.set(pp.x + PHASES[raining ? 'rain' : phase].sunPos[0] * 0.4, PHASES[raining ? 'rain' : phase].sunPos[1], pp.z + PHASES[raining ? 'rain' : phase].sunPos[2] * 0.4);
    sun.target.position.set(pp.x, 0, pp.z);
    if (inCar && car) {
      const on = phase !== 'day';
      headSpot.intensity = on ? 90 : 0;
      headSpot.position.set(pp.x + Math.cos(car.angle) * 2.2, 1, pp.z + Math.sin(car.angle) * 2.2);
      headSpot.target.position.set(pp.x + Math.cos(car.angle) * 26, 0, pp.z + Math.sin(car.angle) * 26);
    } else headSpot.intensity = 0;

    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  return { render, resize, renderer, camera, scene };
}
