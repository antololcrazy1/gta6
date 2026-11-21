// Three.js 3D layer for the v6 rebuild: low-poly coastal city at golden
// hour, third-person chase camera, an articulated on-foot character, police
// helicopter with searchlight, markers and particles. Written fresh for the
// rebuild; it reads the world state every frame and owns no game rules.
import * as THREE from 'three';
import { ROADS_V, ROADS_H } from './world.js';
import { SKY, sunHeight } from './weather.js';
import { WORLD } from './config.js';

const matCache = new Map();
function mat(color, opts) {
  const key = `${color}|${opts && opts.emissive ? opts.emissive : ''}|${opts && opts.transparent ? 't' : ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
  matCache.set(key, m);
  return m;
}
function box(w, h, d, color, opts) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
}
function hexLerp(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ff7a3c');
  scene.fog = new THREE.Fog(0xe88a5a, 1500, 9000);
  const camera = new THREE.PerspectiveCamera(68, 1280 / 720, 1, 20000);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-3000, 800, 2000);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0x804060, 0.35);
  scene.add(amb);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width + 6000, WORLD.height + 2000), mat(0x7a7f6a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD.width / 2 - 2000, -1, WORLD.height / 2);
  scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1000, WORLD.height + 2000), mat(0xe8c98f));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(450, 0, WORLD.height / 2);
  scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(6000, WORLD.height + 4000), mat(0x1b6f8e));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-3000, -2, WORLD.height / 2);
  scene.add(ocean);
  const glitter = new THREE.Mesh(new THREE.PlaneGeometry(900, WORLD.height), new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.45 }));
  glitter.rotation.x = -Math.PI / 2;
  glitter.position.set(-600, 0, WORLD.height / 2);
  scene.add(glitter);

  const roadMat = mat(0x33363d);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const x of ROADS_V) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(150, WORLD.height), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 1, WORLD.height / 2); scene.add(r);
    for (let y = 700; y < WORLD.height; y += 420) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(8, 90), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 2, y); scene.add(d);
    }
  }
  for (const y of ROADS_H) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width, 150), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(WORLD.width / 2, 1, y); scene.add(r);
    for (let x = 1200; x < WORLD.width; x += 420) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(90, 8), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 2, y); scene.add(d);
    }
  }
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(300, 32), new THREE.MeshBasicMaterial({ color: 0xffcf5e, fog: false }));
  sunDisc.position.set(-2600, 500, WORLD.height / 2);
  sunDisc.lookAt(5000, 500, WORLD.height / 2);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(800, 32), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.15, fog: false }));
  sunGlow.position.set(-2700, 500, WORLD.height / 2);
  sunGlow.lookAt(5000, 500, WORLD.height / 2);
  scene.add(sunGlow);

  let buildingMesh = null;
  let roofMesh = null;
  let signMesh = null;
  let trunkMesh = null;
  let leafMesh = null;
  let parkMeshes = [];
  function windowTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2a2f45';
    for (let y = 14; y < 120; y += 26) {
      for (let x = 12; x < 120; x += 26) {
        if (((x + y) / 26) % 3 !== 0) g.fillRect(x, y, 14, 16);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  function buildCity(state) {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    buildingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, map: windowTexture() }), state.buildings.length);
    const roofs = state.buildings.filter((b) => b.pitched);
    roofMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, roofs.length));
    state.buildings.forEach((b, i) => {
      dummy.position.set(b.x + b.w / 2, b.ht / 2, b.y + b.h / 2);
      dummy.scale.set(b.w, b.ht, b.h);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      buildingMesh.setMatrixAt(i, dummy.matrix);
      buildingMesh.setColorAt(i, col.set(b.color));
    });
    roofs.forEach((b, i) => {
      dummy.position.set(b.x + b.w / 2, b.ht + b.ht * 0.22, b.y + b.h / 2);
      dummy.scale.set(b.w * 0.78, b.ht * 0.45, b.h * 0.78);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(i, dummy.matrix);
      roofMesh.setColorAt(i, col.set(b.roof));
    });
    scene.add(buildingMesh);
    scene.add(roofMesh);
    signMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), state.signs.length);
    state.signs.forEach((s, i) => {
      dummy.position.set(s.x, 60, s.y);
      dummy.scale.set(s.big ? 120 : 70, 18, 8);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      signMesh.setMatrixAt(i, dummy.matrix);
      signMesh.setColorAt(i, col.set(s.color));
    });
    scene.add(signMesh);
    trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(6, 10, 90, 6), mat(0x8a6a42), state.palms.length);
    leafMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(55, 60, 6), mat(0x2e8b57), state.palms.length);
    state.palms.forEach((p, i) => {
      dummy.position.set(p.x, 45, p.y);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 110, p.y);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
    });
    scene.add(trunkMesh);
    scene.add(leafMesh);
    for (const p of state.parks) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat(0x4f9e57));
      g.rotation.x = -Math.PI / 2;
      g.position.set(p.x + p.w / 2, 1.5, p.y + p.h / 2);
      scene.add(g);
      parkMeshes.push(g);
    }
    for (let i = 0; i < 14; i += 1) {
      const ux = 250 + (i % 7) * 90, uy = 900 + Math.floor(i / 7) * 2600 + (i * 173) % 500;
      const pole = box(6, 90, 6, 0xd8d8d8);
      pole.position.set(ux, 45, uy); scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(70, 34, 8), mat(i % 2 ? 0xff6b9d : 0x3498db));
      top.position.set(ux, 105, uy); scene.add(top);
      const towel = box(90, 4, 50, i % 3 ? 0xf1c40f : 0x2ecc71);
      towel.position.set(ux + 110, 3, uy + 40); scene.add(towel);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(16, 10, 8), mat(0xff2fb3));
      ball.position.set(ux + 60, 16, uy - 90); scene.add(ball);
    }
    const tower = box(90, 130, 90, 0xecf0f1);
    tower.position.set(420, 65, 3300); scene.add(tower);
    const towerTop = box(130, 50, 130, 0xe74c3c);
    towerTop.position.set(420, 155, 3300); scene.add(towerTop);
    const pier = box(700, 16, 120, 0x8a6a42);
    pier.position.set(0, 8, 3300); scene.add(pier);
  }

  const carGroups = new Map();
  function carGroup(car) {
    let g = carGroups.get(car.id);
    if (!g) {
      g = new THREE.Group();
      const body = box(96, 26, 46, car.color);
      body.position.y = 22;
      const cabin = box(52, 22, 40, 0x1c2733);
      cabin.position.set(-4, 44, 0);
      const wheels = box(96, 14, 50, 0x111111);
      wheels.position.y = 8;
      const head = box(4, 8, 40, 0xfff3c4, { emissive: 0xfff3c4 });
      head.position.set(49, 20, 0);
      const tail = box(4, 8, 40, 0xff3b30, { emissive: 0xff3b30 });
      tail.position.set(-49, 20, 0);
      const stripe = box(60, 4, 30, 0xffd700, { emissive: 0xffd700 });
      stripe.position.set(-4, 57, 0);
      stripe.visible = false;
      g.add(body, cabin, wheels, head, tail, stripe);
      g.userData.body = body;
      g.userData.tail = tail;
      g.userData.stripe = stripe;
      scene.add(g);
      carGroups.set(car.id, g);
    }
    return g;
  }
  const pedGroups = new Map();
  function pedGroup(ped, i) {
    const key = `p${i}`;
    let g = pedGroups.get(key);
    if (!g) {
      g = new THREE.Group();
      const body = box(26, 46, 18, ped.color);
      body.position.y = 42;
      const head = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 8), mat(0xe8b88a));
      head.position.y = 78;
      g.add(body, head);
      scene.add(g);
      pedGroups.set(key, g);
    }
    return g;
  }
  const char = new THREE.Group();
  const torso = box(34, 52, 20, 0xe74c3c);
  torso.position.y = 78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(15, 12, 10), mat(0xe8b88a));
  head.position.y = 118;
  const cap = box(32, 8, 32, 0x222222);
  cap.position.y = 130;
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(0, 56, side * 10);
    const thigh = box(12, 30, 12, 0x2c3e50);
    thigh.position.y = -15;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -30;
    hip.add(knee);
    const calf = box(10, 28, 10, 0x2c3e50);
    calf.position.y = -14;
    knee.add(calf);
    const shoe = box(12, 8, 22, 0x111111);
    shoe.position.set(3, -30, 0);
    knee.add(shoe);
    char.add(hip);
    return { hip, knee };
  }
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 100, side * 22);
    const upper = box(10, 34, 10, 0xe74c3c);
    upper.position.y = -17;
    shoulder.add(upper);
    char.add(shoulder);
    return shoulder;
  }
  const legL = leg(-1), legR = leg(1);
  const armL = arm(-1), armR = arm(1);
  char.add(torso, head, cap);
  scene.add(char);

  const heli = new THREE.Group();
  const heliBody = box(90, 40, 60, 0xecf0f1);
  const heliTail = box(110, 14, 14, 0xecf0f1);
  heliTail.position.set(-95, 8, 0);
  const heliRotor = box(190, 4, 12, 0x222222);
  heliRotor.position.y = 30;
  const heliLight = new THREE.Mesh(new THREE.ConeGeometry(90, 260, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  heliLight.position.y = -160;
  heli.add(heliBody, heliTail, heliRotor, heliLight);
  scene.add(heli);
  const heliPool = new THREE.Mesh(new THREE.CircleGeometry(110, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.3 }));
  heliPool.rotation.x = -Math.PI / 2;
  scene.add(heliPool);

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 900, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  scene.add(beacon);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(26), new THREE.MeshBasicMaterial({ color: 0xffc93c }));
  scene.add(diamond);
  const jobDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(30), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  scene.add(jobDiamond);
  const repoRing = new THREE.Mesh(new THREE.TorusGeometry(70, 8, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
  repoRing.rotation.x = -Math.PI / 2;
  scene.add(repoRing);
  const racePole = new THREE.Group();
  const pole = box(10, 320, 10, 0x222222);
  pole.position.y = 160;
  const flag = box(120, 80, 4, 0xecf0f1);
  flag.position.set(60, 280, 0);
  racePole.add(pole, flag);
  scene.add(racePole);

  const pickupMeshes = new Map();
  function pickupMesh(pk, i) {
    const key = `k${i}`;
    let m = pickupMeshes.get(key);
    if (!m) {
      const color = pk.kind === 'hidden' ? 0xffd700 : pk.kind === 'health' ? 0x2ecc71 : pk.kind === 'ammo' ? 0xf1c40f : pk.kind === 'repair' ? 0x3498db : 0x2ecc71;
      m = box(34, 34, 34, color, { emissive: color });
      scene.add(m);
      pickupMeshes.set(key, m);
    }
    return m;
  }
  const bulletGeo = new THREE.BoxGeometry(70, 3, 3);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const bulletPool = [];
  for (let i = 0; i < 24; i += 1) {
    const b = new THREE.Mesh(bulletGeo, bulletMat);
    b.visible = false;
    scene.add(b);
    bulletPool.push(b);
  }
  const PMAX = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 14, vertexColors: true, transparent: true, opacity: 0.95 }));
  points.frustumCulled = false;
  scene.add(points);
  const RMAX = 600;
  const rGeo = new THREE.BufferGeometry();
  const rPos = new Float32Array(RMAX * 3);
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.Points(rGeo, new THREE.PointsMaterial({ size: 6, color: 0x9fc4e8, transparent: true, opacity: 0.6 }));
  rain.frustumCulled = false;
  scene.add(rain);

  let built = false;
  let camYaw = 0;
  let camDist = 260;
  let camHeight = 110;
  const camTarget = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function update(state, dt, time, yawOffset, screen) {
    if (!built) { buildCity(state); built = true; }
    const st = state;
    const p = st.player;
    const phase = st.weather.phase;
    const blend = phase === 'sunset' ? 0.5 : phase === 'night' ? 1 : 0;
    const top = hexLerp(SKY.day.top, SKY.sunset.top, phase === 'sunset' ? 1 : 0);
    if (phase === 'night') top.copy(new THREE.Color(SKY.night.top));
    else if (phase === 'sunset') top.copy(new THREE.Color(SKY.sunset.top));
    else top.copy(new THREE.Color(SKY.day.top));
    scene.background.copy(top);
    const hor = phase === 'night' ? SKY.night.horizon : phase === 'sunset' ? SKY.sunset.horizon : SKY.day.horizon;
    scene.fog.color.copy(new THREE.Color(phase === 'night' ? SKY.night.fog : phase === 'sunset' ? SKY.sunset.fog : SKY.day.fog));
    const sh = sunHeight(st.weather.t);
    sun.intensity = phase === 'night' ? 0.25 : 1.1 + sh;
    sun.color.copy(new THREE.Color(phase === 'sunset' ? 0xff8a4a : phase === 'night' ? 0x8fa8d8 : 0xfff3c4));
    sun.position.set(-3000, 400 + Math.max(0, sh) * 2200, 2000);
    hemi.intensity = phase === 'night' ? 0.35 : 0.9;
    amb.intensity = phase === 'night' ? 0.5 : 0.35;
    sunDisc.visible = phase !== 'night';
    sunDisc.position.y = 180 + Math.max(0, sh) * 1400;
    sunGlow.visible = phase === 'sunset';
    glitter.material.opacity = phase === 'sunset' ? 0.5 : 0.18;

    const seenCars = new Set();
    for (const car of st.cars) {
      seenCars.add(car.id);
      const g = carGroup(car);
      g.position.set(car.x, 0, car.y);
      g.rotation.y = -car.angle;
      g.visible = true;
      const body = g.userData.body;
      if (body.material !== mat(car.color)) body.material = mat(car.color);
      g.userData.tail.material = mat(0xff3b30, { emissive: 0xff3b30 });
      g.userData.stripe.visible = car.id === st.player.carId;
      if (car.cop) {
        body.material = mat(car.roadblock ? 0x1f4fa0 : 0x2f6fd0);
      }
      if (car.gang) body.material = mat(car.color);
    }
    for (const [id, g] of carGroups) if (!seenCars.has(id)) { g.visible = false; }
    for (const gc of st.gangCars) {
      const g = carGroup(gc);
      g.position.set(gc.x, 0, gc.y);
      g.rotation.y = -gc.angle;
      g.visible = true;
      g.userData.body.material = mat(gc.color);
    }
    if (st.race && st.race.rivals) {
      for (const r of st.race.rivals) {
        const fake = { id: `race-${r.name}`, color: r.color };
        const g = carGroup(fake);
        g.position.set(r.x, 0, r.y);
        g.rotation.y = 0;
        g.visible = st.race.active || st.race.countdown > 0;
        g.userData.body.material = mat(r.color);
      }
    }
    st.peds.forEach((ped, i) => {
      const g = pedGroup(ped, i);
      g.position.set(ped.x, 0, ped.y);
      g.rotation.y = -ped.angle;
      g.visible = ped.alive;
    });
    st.cops.forEach((cop, i) => {
      if (cop.inCar) return;
      const g = pedGroup({ color: 0x2f6fd0 }, 1000 + i);
      g.position.set(cop.x, 0, cop.y);
      g.rotation.y = -Math.atan2(p.y - cop.y, p.x - cop.x);
      g.visible = !cop.dead;
    });
    if (p.inCar) {
      char.visible = false;
    } else {
      char.visible = true;
      char.position.set(p.x, 0, p.y);
      char.rotation.y = -p.angle;
      const ph = p.walkPhase;
      const swing = p.moving ? (p.sprinting ? 0.95 : 0.7) : 0;
      const s = Math.sin(ph);
      const c = Math.sin(ph + Math.PI);
      legL.hip.rotation.x = s * swing;
      legR.hip.rotation.x = c * swing;
      legL.knee.rotation.x = Math.max(0, -c) * 1.1 * swing;
      legR.knee.rotation.x = Math.max(0, -s) * 1.1 * swing;
      armL.rotation.x = c * swing * 0.8;
      armR.rotation.x = s * swing * 0.8;
      if (p.aiming) { armL.rotation.x = -1.2; armR.rotation.x = -1.2; }
      torso.position.y = 78 + (p.moving ? Math.abs(Math.cos(ph)) * 4 : Math.sin(time * 1.8) * 1.5);
      torso.rotation.x = p.sprinting ? 0.12 : 0;
      head.position.y = 118 + (p.moving ? Math.abs(Math.cos(ph)) * 4 : Math.sin(time * 1.8) * 1.5);
    }
    if (st.heli) {
      heli.visible = true;
      heliPool.visible = true;
      heli.position.set(st.heli.x, 320, st.heli.y);
      heli.rotation.y = -Math.atan2(p.y - st.heli.y, p.x - st.heli.x);
      heliRotor.rotation.y = st.heli.rotor;
      heliPool.position.set(p.x, 2, p.y);
      heliPool.material.opacity = 0.25 + 0.08 * Math.sin(time * 6);
    } else { heli.visible = false; heliPool.visible = false; }
    if (st.missionTarget) {
      beacon.visible = true; diamond.visible = true;
      beacon.position.set(st.missionTarget.x, 450, st.missionTarget.y);
      diamond.position.set(st.missionTarget.x, 170 + Math.sin(time * 2.4) * 18, st.missionTarget.y);
      diamond.rotation.y = time * 1.5;
    } else { beacon.visible = false; diamond.visible = false; }
    const job = st.phone.job;
    if (job && job.target) {
      jobDiamond.visible = true;
      jobDiamond.position.set(job.target.x, 110 + Math.sin(time * 2.4) * 14, job.target.y);
      jobDiamond.rotation.y = time * 2;
    } else jobDiamond.visible = false;
    const repoCar = job && job.type === 'repo' ? st.cars.find((cc) => cc.id === job.carId) : null;
    if (repoCar) {
      repoRing.visible = true;
      repoRing.position.set(repoCar.x, 6, repoCar.y);
    } else repoRing.visible = false;
    if (st.race && st.race.available) {
      racePole.visible = true;
      racePole.position.set(700, 0, 3300);
    } else racePole.visible = false;
    st.pickups.forEach((pk, i) => {
      const m = pickupMesh(pk, i);
      m.visible = pk.active;
      m.position.set(pk.x, 40 + Math.sin(pk.bob) * 10, pk.y);
      m.rotation.y = time * 1.2 + i;
    });
    st.bullets.forEach((b, i) => {
      const m = bulletPool[i];
      if (!m) return;
      m.visible = true;
      m.position.set(b.x, 40, b.y);
      m.rotation.y = -Math.atan2(b.vy, b.vx);
    });
    for (let i = st.bullets.length; i < bulletPool.length; i += 1) bulletPool[i].visible = false;
    for (let i = 0; i < PMAX; i += 1) {
      const pt = st.particles[i];
      if (pt) {
        pPos[i * 3] = pt.x; pPos[i * 3 + 1] = pt.z; pPos[i * 3 + 2] = pt.y;
        const col = new THREE.Color(pt.color);
        pCol[i * 3] = col.r; pCol[i * 3 + 1] = col.g; pCol[i * 3 + 2] = col.b;
      } else { pPos[i * 3 + 1] = -100; }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    if (st.weather.raining) {
      rain.visible = true;
      for (let i = 0; i < RMAX; i += 1) {
        rPos[i * 3] = p.x + ((i * 137) % 1200) - 600;
        rPos[i * 3 + 1] = 400 - ((time * 900 + i * 61) % 400);
        rPos[i * 3 + 2] = p.y + ((i * 251) % 1200) - 600;
      }
      rGeo.attributes.position.needsUpdate = true;
    } else rain.visible = false;

    camYaw += (yawOffset - camYaw) * Math.min(1, dt * 2.2);
    const heading = p.angle + camYaw;
    const inCar = p.inCar;
    const speed = Math.abs(p.speed || 0);
    const wantDist = inCar ? 220 + speed * 0.08 : 265;
    const wantHeight = inCar ? 110 + speed * 0.03 : 130;
    camDist += (wantDist - camDist) * Math.min(1, dt * 3);
    camHeight += (wantHeight - camHeight) * Math.min(1, dt * 3);
    const fx = Math.cos(heading), fy = Math.sin(heading);
    const cx = p.x - fx * camDist;
    const cy = p.y - fy * camDist;
    camera.position.set(cx, camHeight, cy);
    camTarget.set(p.x + fx * 180, inCar ? 55 : 80, p.y + fy * 180);
    camera.lookAt(camTarget);
    const fov = 62 + Math.min(8, speed * 0.015) + (st.boosting ? 4 : 0);
    if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
  }

  return { update, resize, renderer, scene, camera };
}
