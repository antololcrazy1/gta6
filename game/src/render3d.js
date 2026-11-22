// The Three.js renderer for Vice Coast: the scene, the chase camera, the
// city meshes, the cars, the people, the helicopter and the markers. The
// world module decides everything; this file only draws it. The world is
// Z-up: x is east-west, y is north-south, z is height. The camera's up
// vector is set to +Z to match.
import * as THREE from 'three';
import { CFG, LANDMARKS } from './config.js';
import { createFacadeFactory, rooftopProps } from './facades.js';
import { setupShadows } from './shadows.js';
import { buildHumanRig, animateHumanRig } from './pedrig.js';
import { createCamera } from './camera.js';
import { makeRng } from './random.js';

// A small shared pool of geometries and materials, so the hundreds of
// meshes do not each allocate their own.
const GEO = {};
function boxGeo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!GEO[key]) GEO[key] = new THREE.BoxGeometry(w, h, d);
  return GEO[key];
}

export function createRenderer(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe88a5c, 900, 5200);
  const camera3 = new THREE.PerspectiveCamera(62, 1, 1, 14000);
  camera3.up.set(0, 0, 1);

  const shadows = setupShadows(THREE, renderer, scene);
  const facades = createFacadeFactory(THREE);
  const cam = createCamera(THREE);
  cam.attach(camera3);

  // -------------------------------------------------------------- the sky
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(11000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  // The sun disc, low in the west at sunset. A sprite always faces the
  // camera, so it reads as a sun from every angle.
  const sunSpriteMat = new THREE.SpriteMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.95 });
  const sunDisc = new THREE.Sprite(sunSpriteMat);
  sunDisc.scale.set(900, 900, 1);
  scene.add(sunDisc);
  let lastPhase = '';

  function paintSky(phase) {
    const g = skyCanvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (phase === 'day') {
      grad.addColorStop(0, '#5a9ad6');
      grad.addColorStop(0.55, '#a8c8e8');
      grad.addColorStop(0.8, '#e8d9b0');
      grad.addColorStop(1, '#f0e0b8');
      scene.fog.color.set(0xa8c8e8);
    } else if (phase === 'sunset') {
      grad.addColorStop(0, '#3a2a6a');
      grad.addColorStop(0.45, '#a83a6a');
      grad.addColorStop(0.75, '#e85d75');
      grad.addColorStop(1, '#ff9a5c');
      scene.fog.color.set(0xe88a5c);
    } else {
      grad.addColorStop(0, '#050914');
      grad.addColorStop(0.6, '#101a3d');
      grad.addColorStop(1, '#232a55');
      scene.fog.color.set(0x101a3d);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    skyTex.needsUpdate = true;
    sunDisc.material.color.set(phase === 'sunset' ? 0xffb85c : phase === 'day' ? 0xfff2c8 : 0xd8d8e8);
    sunDisc.material.opacity = phase === 'night' ? 0.25 : 0.95;
    lastPhase = phase;
  }
  paintSky('day');

  // --------------------------------------------------- the ground and sea
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 1024;
  groundCanvas.height = 640;
  (function paintGround() {
    const g = groundCanvas.getContext('2d');
    const sx = 1024 / CFG.WORLD_W;
    const sy = 640 / CFG.WORLD_H;
    // Asphalt everywhere east of the beach.
    g.fillStyle = '#33333a';
    g.fillRect(0, 0, 1024, 640);
    // The beach: sand along the west edge.
    g.fillStyle = '#e8cf9a';
    g.fillRect(0, 0, CFG.BEACH_W * sx, 640);
    // Boardwalk strip between the sand and the first road.
    g.fillStyle = '#b89a6a';
    g.fillRect(CFG.BEACH_W * sx, 0, (700 - CFG.BEACH_W) * sx, 640);
    // Roads: lighter strips with centre dashes.
    g.fillStyle = '#45454e';
    for (let i = 0; i < CFG.V_ROADS; i += 1) {
      const x = (CFG.V_ROAD_X0 + i * CFG.V_ROAD_DX) * sx;
      g.fillRect(x - (CFG.ROAD_W / 2) * sx, 0, CFG.ROAD_W * sx, 640);
    }
    for (let j = 0; j < CFG.H_ROADS; j += 1) {
      const y = (CFG.H_ROAD_Y0 + j * CFG.H_ROAD_DY) * sy;
      g.fillRect(0, y - (CFG.ROAD_W / 2) * sy, 1024, CFG.ROAD_W * sy);
    }
    // Centre dashes.
    g.fillStyle = '#d8d8c8';
    for (let i = 0; i < CFG.V_ROADS; i += 1) {
      const x = (CFG.V_ROAD_X0 + i * CFG.V_ROAD_DX) * sx;
      for (let y = 0; y < 640; y += 36) g.fillRect(x - 1, y, 2, 18);
    }
    for (let j = 0; j < CFG.H_ROADS; j += 1) {
      const y = (CFG.H_ROAD_Y0 + j * CFG.H_ROAD_DY) * sy;
      for (let x = 0; x < 1024; x += 36) g.fillRect(x, y - 1, 18, 2);
    }
    // Sidewalk edges along the roads.
    g.fillStyle = '#6a6a66';
    for (let i = 0; i < CFG.V_ROADS; i += 1) {
      const x = (CFG.V_ROAD_X0 + i * CFG.V_ROAD_DX) * sx;
      g.fillRect(x - (CFG.ROAD_W / 2 + 8) * sx, 0, 3, 640);
      g.fillRect(x + (CFG.ROAD_W / 2 + 5) * sx, 0, 3, 640);
    }
    // Parks as green plots.
    g.fillStyle = '#4d8a3f';
    for (const pk of state.parks) {
      g.fillRect(pk.x * sx, pk.y * sy, pk.w * sx, pk.h * sy);
    }
  })();
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 4;
  // The canvas is drawn with y down = world y down; do not flip it.
  groundTex.flipY = false;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.WORLD_W, CFG.WORLD_H),
    new THREE.MeshLambertMaterial({ map: groundTex })
  );
  ground.position.set(CFG.WORLD_W / 2, CFG.WORLD_H / 2, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // The ocean west of the beach, with a sunset glitter strip.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, CFG.WORLD_H + 2000),
    new THREE.MeshLambertMaterial({ color: 0x1d5f8a })
  );
  ocean.position.set(-2100, CFG.WORLD_H / 2, -2);
  scene.add(ocean);
  const glitter = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 700),
    new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0.28 })
  );
  glitter.position.set(-2100, 3300, -1);
  scene.add(glitter);
  // Foam at the waterline.
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(90, CFG.WORLD_H),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  foam.position.set(45, CFG.WORLD_H / 2, 1);
  scene.add(foam);

  // ----------------------------------------------------------- the city
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);
  const rng = makeRng(5150);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a4a3a });
  const roofMatDark = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
  let buildingMeshes = 0;

  // A pitched roof is a triangular prism, built once per building.
  function pitchedRoof(w, h, ht) {
    const hw = w / 2;
    const hh = h / 2;
    const rh = Math.min(46, ht * 0.35);
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -hw, -hh, 0, hw, -hh, 0, 0, -hh, rh,
      hw, hh, 0, -hw, hh, 0, 0, hh, rh,
      -hw, -hh, 0, 0, -hh, rh, 0, hh, rh, -hw, hh, 0,
      hw, -hh, 0, hw, hh, 0, 0, hh, rh, 0, -hh, rh,
      -hw, -hh, 0, -hw, hh, 0, hw, hh, 0, hw, -hh, 0,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, roofMat);
  }

  for (const b of state.buildings) {
    const tex = facades.textureFor(b.type, b.floors, b.variant, makeRng(b.seed).next);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(boxGeo(b.w, b.h, b.ht), mat);
    mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, b.ht / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);
    buildingMeshes += 1;
    if (b.pitched) {
      const roof = pitchedRoof(b.w, b.h, b.ht);
      roof.position.set(b.x + b.w / 2, b.y + b.h / 2, b.ht);
      cityGroup.add(roof);
      buildingMeshes += 1;
    } else {
      // Flat roofs get a parapet rim and props.
      const rim = new THREE.Mesh(boxGeo(b.w + 4, b.h + 4, 8), roofMatDark);
      rim.position.set(b.x + b.w / 2, b.y + b.h / 2, b.ht + 4);
      cityGroup.add(rim);
      buildingMeshes += 1;
      const props = rooftopProps(b, makeRng(b.seed + 7).next);
      for (const pr of props) {
        if (pr.kind === 'ac') {
          const ac = new THREE.Mesh(boxGeo(34 * pr.s, 26 * pr.s, 14), wallMat);
          ac.position.set(b.x + b.w / 2 + pr.x * b.w, b.y + b.h / 2 + pr.z * b.h, b.ht + 10);
          cityGroup.add(ac);
        } else if (pr.kind === 'tank') {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(16 * pr.s, 16 * pr.s, 42 * pr.s, 10), wallMat);
          tank.rotation.x = Math.PI / 2;
          tank.position.set(b.x + b.w / 2 + pr.x * b.w, b.y + b.h / 2 + pr.z * b.h, b.ht + 26);
          cityGroup.add(tank);
        } else if (pr.kind === 'antenna') {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 120 * pr.s, 6), roofMatDark);
          ant.rotation.x = Math.PI / 2;
          ant.position.set(b.x + b.w / 2 + pr.x * b.w, b.y + b.h / 2 + pr.z * b.h, b.ht + 60 * pr.s);
          cityGroup.add(ant);
        }
      }
    }
  }

  // Name signs on the big buildings: a thin box with the sign texture on
  // its south face (+Y), so the text stays upright.
  const signSideMat = new THREE.MeshLambertMaterial({ color: 0x14101f });
  for (const s of state.signs) {
    const tex = facades.signTexture(s.text, s.color);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });
    const sign = new THREE.Mesh(boxGeo(150, 6, 38), [signSideMat, signSideMat, faceMat, signSideMat, signSideMat, signSideMat]);
    sign.position.set(s.x, s.y, 120);
    cityGroup.add(sign);
  }

  // Parks: green is baked into the ground; the trees are cones.
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2a6a2a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  for (const pk of state.parks) {
    for (const t of pk.trees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 26, 6), trunkMat);
      trunk.rotation.x = Math.PI / 2;
      trunk.position.set(t.x, t.y, 13);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(26, 60, 8), treeMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(t.x, t.y, 52);
      scene.add(crown);
    }
  }

  // The beach: umbrellas, towels, beach balls, a lifeguard tower.
  const umbrellaColors = [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x4ad87a, 0xd84a9a];
  for (let i = 0; i < 14; i += 1) {
    const ux = 90 + rng.range(0, 380);
    const uy = 500 + i * 400 + rng.range(-120, 120);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 90, 6), trunkMat);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(ux, uy, 45);
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(64, 34, 10), new THREE.MeshLambertMaterial({ color: umbrellaColors[i % umbrellaColors.length] }));
    top.rotation.x = Math.PI / 2;
    top.position.set(ux, uy, 100);
    scene.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(46, 90), new THREE.MeshLambertMaterial({ color: umbrellaColors[(i + 2) % umbrellaColors.length] }));
    towel.position.set(ux + 90, uy + 40, 2);
    scene.add(towel);
    if (i % 3 === 0) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(16, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
      ball.position.set(ux + 60, uy - 70, 16);
      scene.add(ball);
    }
  }
  // The lifeguard tower near the pier.
  const towerGroup = new THREE.Group();
  const towerBase = new THREE.Mesh(boxGeo(90, 90, 130), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  towerBase.position.set(0, 0, 65);
  towerGroup.add(towerBase);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(80, 40, 4), new THREE.MeshLambertMaterial({ color: 0xd84a4a }));
  towerRoof.rotation.x = Math.PI / 2;
  towerRoof.rotation.z = Math.PI / 4;
  towerRoof.position.set(0, 0, 150);
  towerGroup.add(towerRoof);
  towerGroup.position.set(300, 3600, 0);
  scene.add(towerGroup);
  // The Sunset Pier: a boardwalk out over the water.
  const pier = new THREE.Mesh(boxGeo(420, 60, 14), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(120, 3300, 7);
  scene.add(pier);
  const pierBoat = new THREE.Mesh(boxGeo(120, 50, 30), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  pierBoat.position.set(-260, 3450, 8);
  scene.add(pierBoat);

  // -------------------------------------------------------------- cars
  // One car mesh: body, cabin, four wheels, headlights and brake lights.
  // The body colour is set per car; cop cars get a light bar.
  function makeCarMesh(color, isCop) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(boxGeo(92, 44, 22), bodyMat);
    body.position.z = 20;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(boxGeo(52, 40, 18), new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    cabin.position.set(-4, 0, 38);
    cabin.castShadow = true;
    g.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [wx, wy] of [[30, 22], [30, -22], [-30, 22], [-30, -22]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 10), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, 11);
      g.add(wheel);
    }
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
    for (const wy of [14, -14]) {
      const head = new THREE.Mesh(boxGeo(4, 10, 6), headMat);
      head.position.set(47, wy, 22);
      g.add(head);
    }
    const brakeMat = new THREE.MeshBasicMaterial({ color: 0xd81a1a });
    for (const wy of [14, -14]) {
      const brake = new THREE.Mesh(boxGeo(4, 10, 6), brakeMat);
      brake.position.set(-47, wy, 22);
      g.add(brake);
    }
    if (isCop) {
      const barR = new THREE.Mesh(boxGeo(10, 14, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      barR.position.set(-4, 9, 50);
      g.add(barR);
      const barB = new THREE.Mesh(boxGeo(10, 14, 6), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      barB.position.set(-4, -9, 50);
      g.add(barB);
      g.userData.lightR = barR;
      g.userData.lightB = barB;
    }
    g.userData.bodyMat = bodyMat;
    return g;
  }

  const carMeshes = new Map();
  function carMeshFor(car, isCop) {
    let m = carMeshes.get(car.id);
    if (!m) {
      m = makeCarMesh(car.color, isCop);
      carMeshes.set(car.id, m);
      scene.add(m);
    }
    return m;
  }
  // The player's car gets a gold body so it is easy to spot.
  const playerCarMesh = makeCarMesh(0xd8a82a, false);
  scene.add(playerCarMesh);
  playerCarMesh.visible = false;

  // ------------------------------------------------------------ people
  // One rig per pedestrian, built once and animated every frame.
  const pedRigs = new Map();
  for (const pd of state.peds) {
    const rig = buildHumanRig(THREE, {
      height: pd.height, build: pd.build, shirt: pd.shirt,
      trousers: pd.trousers, skin: pd.skin, hair: pd.hair,
      hat: pd.hat, hatColor: pd.hatColor,
    });
    // Pedestrians do not cast shadows: with 66 rigs the shadow pass
    // costs more than the shadows are worth. Buildings and cars do.
    pedRigs.set(pd.id, rig);
    scene.add(rig.group);
  }
  // The player, in a gold jacket.
  const playerRig = buildHumanRig(THREE, {
    height: 100, build: 'average', shirt: 0xd8a82a,
    trousers: 0x2a3a5a, skin: 0xe8b88a, hair: 0x1a1a1a, hat: null,
  });
  playerRig.group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(playerRig.group);
  // Foot cops, in navy.
  const copRigs = new Map();

  // -------------------------------------------------------- the helicopter
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(boxGeo(120, 60, 40), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  heliBody.position.z = 0;
  heliGroup.add(heliBody);
  const heliTail = new THREE.Mesh(boxGeo(110, 16, 14), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  heliTail.position.set(-105, 0, 6);
  heliGroup.add(heliTail);
  const heliGlass = new THREE.Mesh(boxGeo(34, 56, 22), new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
  heliGlass.position.set(48, 0, 6);
  heliGroup.add(heliGlass);
  const rotor = new THREE.Mesh(boxGeo(300, 10, 4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.z = 30;
  heliGroup.add(rotor);
  // The searchlight: a dimmed, narrowed cone, plus a soft pool of light
  // on the ground that never washes out the traffic underneath.
  const spotCone = new THREE.Mesh(
    new THREE.ConeGeometry(90, 260, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
  );
  spotCone.rotation.x = Math.PI / 2;
  spotCone.position.z = -130;
  heliGroup.add(spotCone);
  const spotPool = new THREE.Mesh(
    new THREE.CircleGeometry(90, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.14, depthWrite: false })
  );
  scene.add(spotPool);
  heliGroup.visible = false;
  spotPool.visible = false;
  scene.add(heliGroup);

  // -------------------------------------------------- bullets and pickups
  const bulletGeo = new THREE.SphereGeometry(5, 8, 6);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe94a });
  const bulletMeshes = [];
  for (let i = 0; i < 24; i += 1) {
    const b = new THREE.Mesh(bulletGeo, bulletMat);
    b.visible = false;
    scene.add(b);
    bulletMeshes.push(b);
  }
  // Hidden packages: small glowing diamonds that bob.
  const pickupMeshes = [];
  const pickupGeo = new THREE.OctahedronGeometry(22);
  const pickupMat = new THREE.MeshBasicMaterial({ color: 0x4ad87a });
  for (const pk of state.pickups) {
    const m = new THREE.Mesh(pickupGeo, pickupMat);
    m.position.set(pk.x, pk.y, 40);
    scene.add(m);
    pickupMeshes.push(m);
  }
  // The mission target beacon: a tall glowing pillar.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 420, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe94a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  scene.add(beacon);
  const beaconTop = new THREE.Mesh(new THREE.OctahedronGeometry(34), new THREE.MeshBasicMaterial({ color: 0xffe94a }));
  scene.add(beaconTop);
  // The roadblock: two striped barriers across the road.
  const roadblockGroup = new THREE.Group();
  for (const off of [-40, 40]) {
    const barrier = new THREE.Mesh(boxGeo(14, 150, 26), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    barrier.position.set(0, off, 13);
    roadblockGroup.add(barrier);
    const stripe = new THREE.Mesh(boxGeo(16, 150, 8), new THREE.MeshBasicMaterial({ color: 0xd84a4a }));
    stripe.position.set(0, off, 28);
    roadblockGroup.add(stripe);
  }
  roadblockGroup.visible = false;
  scene.add(roadblockGroup);

  // ------------------------------------------------------------- the loop
  let frameMs = 0;
  let frames = 0;
  const tmpColor = new THREE.Color();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera3.aspect = w / h;
    camera3.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render(dt) {
    const t0 = performance.now();
    const p = state.player;
    const phase = state.weather.phase;
    if (phase !== lastPhase) paintSky(phase);
    // The sky dome and the sun follow the player.
    sky.position.set(p.x, p.y, 0);
    const sd = state.sunDirection;
    sunDisc.position.set(p.x + sd.x * 9800, p.y + sd.y * 9800, 400 + Math.max(0, sd.z) * 7800);
    sunDisc.material.color.set(phase === 'sunset' ? 0xffb85c : phase === 'day' ? 0xfff2c8 : 0xd8d8e8);
    sunDisc.material.opacity = phase === 'night' ? 0.25 : 0.95;
    // The ocean turns orange at sunset.
    tmpColor.set(phase === 'sunset' ? 0x2a6f9e : phase === 'night' ? 0x0e1a33 : 0x1d5f8a);
    ocean.material.color.copy(tmpColor);
    glitter.material.opacity = phase === 'sunset' ? 0.32 : 0.08;
    glitter.material.color.set(phase === 'sunset' ? 0xff9a5c : 0xffffff);

    shadows.update(sd, p.x, p.y);

    // The camera: car, foot or aim, driven by the camera module.
    const mode = p.inCar ? 'car' : 'aim';
    cam.update(state, dt, mode);
    state.cameraPos = cam.getPos();

    // Cars.
    let playerCar = null;
    if (p.inCar) playerCar = state.cars.find((c) => c.id === p.carId);
    playerCarMesh.visible = !!playerCar;
    if (playerCar) {
      playerCarMesh.position.set(playerCar.x, playerCar.y, 0);
      playerCarMesh.rotation.z = playerCar.angle;
    }
    for (const car of state.cars) {
      if (car === playerCar) {
        // The gold player-car mesh replaces this car's own mesh while
        // the player drives it; hide the regular one so no ghost sits
        // behind at the place the player got in.
        const own = carMeshes.get(car.id);
        if (own) own.visible = false;
        continue;
      }
      const m = carMeshFor(car, false);
      m.visible = true;
      m.position.set(car.x, car.y, 0);
      m.rotation.z = car.angle;
      // A wrecked car sits lower and smokes (dark, low).
      m.position.z = car.health <= 0 ? -6 : 0;
    }
    // Cop cars, with flashing light bars.
    const copCarSet = new Set();
    for (const cop of state.cops) {
      if (!cop.inCar) continue;
      copCarSet.add(cop.id);
      const m = carMeshFor(cop, true);
      m.visible = true;
      m.position.set(cop.x, cop.y, 0);
      m.rotation.z = cop.angle;
      const flash = Math.floor(state.time * 6) % 2 === 0;
      if (m.userData.lightR) m.userData.lightR.visible = flash;
      if (m.userData.lightB) m.userData.lightB.visible = !flash;
    }
    for (const [id, m] of carMeshes) {
      if (id >= 2000 && id < 3000 && !copCarSet.has(id)) m.visible = false;
    }
    // Foot cops.
    for (const cop of state.cops) {
      if (cop.inCar) continue;
      let rig = copRigs.get(cop.id);
      if (!rig) {
        rig = buildHumanRig(THREE, { height: 100, build: 'average', shirt: 0x223355, trousers: 0x1a1a2a, skin: 0xc98d5f, hair: 0x1a1a1a, hat: 'cap', hatColor: 0x223355 });
        scene.add(rig.group);
        copRigs.set(cop.id, rig);
      }
      rig.group.position.set(cop.x, cop.y, 0);
      rig.group.rotation.z = cop.angle - Math.PI / 2;
      animateHumanRig(rig, 260, dt, false);
    }
    // Gang cars, cruising the turf.
    for (const gc of state.gangCars) {
      const m = carMeshFor(gc, false);
      m.visible = gc.alive || gc.wreckTimer > 0;
      m.position.set(gc.x, gc.y, gc.alive ? 0 : -8);
      m.rotation.z = gc.angle;
      if (gc.alive) m.userData.bodyMat.color.setHex(gc.color);
      else m.userData.bodyMat.color.setHex(0x1a1a1a);
    }

    // Pedestrians and the player, with the human walk.
    for (const pd of state.peds) {
      const rig = pedRigs.get(pd.id);
      if (!rig) continue;
      rig.group.visible = pd.alive;
      if (!pd.alive) continue;
      rig.group.position.set(pd.x, pd.y, 0);
      rig.group.rotation.z = pd.angle - Math.PI / 2;
      animateHumanRig(rig, pd.speed, dt, false);
    }
    playerRig.group.visible = !p.inCar;
    if (!p.inCar) {
      playerRig.group.position.set(p.x, p.y, 0);
      playerRig.group.rotation.z = p.angle - Math.PI / 2;
      animateHumanRig(playerRig, p.speed || 0, dt, (p.speed || 0) > 300);
    }

    // The helicopter, circling with its dimmed searchlight.
    const heli = state.heli;
    heliGroup.visible = !!heli;
    spotPool.visible = !!heli;
    if (heli) {
      heliGroup.position.set(heli.x, heli.y, heli.z);
      heliGroup.rotation.z = heli.orbitAngle + Math.PI / 2;
      rotor.rotation.z = state.time * 22;
      spotCone.material.opacity = 0.13;
      spotPool.position.set(heli.lightX, heli.lightY, 2);
      spotPool.material.opacity = 0.14;
    }

    // Bullets.
    for (let i = 0; i < bulletMeshes.length; i += 1) {
      const b = state.bullets[i];
      const m = bulletMeshes[i];
      if (b) {
        m.visible = true;
        m.position.set(b.x, b.y, 34);
      } else {
        m.visible = false;
      }
    }
    // Pickups bob; the beacon marks the mission target.
    for (let i = 0; i < state.pickups.length; i += 1) {
      const pk = state.pickups[i];
      const m = pickupMeshes[i];
      m.visible = pk.active;
      m.position.z = 40 + Math.sin(state.time * 2 + i) * 8;
      m.rotation.z = state.time * 1.5 + i;
    }
    if (state.missionTarget) {
      beacon.visible = true;
      beaconTop.visible = true;
      beacon.position.set(state.missionTarget.x, state.missionTarget.y, 210);
      beaconTop.position.set(state.missionTarget.x, state.missionTarget.y, 430 + Math.sin(state.time * 2) * 12);
      beaconTop.rotation.z = state.time;
    } else {
      beacon.visible = false;
      beaconTop.visible = false;
    }
    // The roadblock.
    if (state.roadblock) {
      roadblockGroup.visible = true;
      roadblockGroup.position.set(state.roadblock.x, state.roadblock.y, 0);
      roadblockGroup.rotation.z = state.roadblock.angle + Math.PI / 2;
    } else {
      roadblockGroup.visible = false;
    }

    renderer.render(scene, camera3);
    const took = performance.now() - t0;
    frameMs = frameMs * 0.9 + took * 0.1;
    frames += 1;
  }

  return {
    render,
    resize,
    scene,
    camera3,
    shadows,
    facades,
    // A debug snapshot for the playtest harness.
    sceneDebug() {
      const cd = cam.debug();
      // The closest pedestrian to the camera, for the keep-out check.
      let minPedCam = Infinity;
      for (const pd of state.peds) {
        if (!pd.alive) continue;
        const d = Math.hypot(pd.x - state.cameraPos.x, pd.y - state.cameraPos.y);
        if (d < minPedCam) minPedCam = d;
      }
      return {
        shadows: { sunCasting: shadows.sunCasting },
        buildingMeshes,
        facades: facades.count(),
        facadeTextures: facades.count(),
        facadeBudget: facades.budget(),
        frameMs: Math.round(frameMs * 10) / 10,
        frames,
        camera: { blocked: cd.blocked, boom: cd.boom },
        cameraHeight: cd.height,
        cameraInsideBuilding: cd.inside,
        minPedCameraDist: Math.round(minPedCam),
        spotlight: state.heli
          ? { intensity: state.heli.spotIntensity, angle: state.heli.spotAngle, groundLux: state.heli.groundLux }
          : null,
      };
    },
  };
}
