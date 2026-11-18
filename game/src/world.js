// Vice Coast rules: no drawing, no browser. A 3600x2600 coastal city, traffic and
// pedestrians, stealable cars, wanted stars and police, a 5-mission story, combat,
// pickups, money and respect. step() advances one fixed step and returns event flags.
import { CAR, HELI, HIDDEN_PACKAGES, PALETTE, PLAYER, STEP, VIEW, WORLD, WANTED_DECAY } from './config.js';
import { MISSIONS, completeMission as completeMissionFlow, createMissionState, refreshMissionTarget, startMission as startMissionFlow } from './missions.js';
import { pick, range, shuffle } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_WANTED = 16;
export const EVENT_SHOT = 32;

export const ROADS_V = [320, 704, 1088, 1472, 1856, 2240, 2624, 3008, 3392];
export const ROADS_H = [320, 640, 960, 1280, 1600, 1920, 2240];
const CAR_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d', '#7f8c8d'];
const PED_COLORS = ['#ff9f43', '#48dbfb', '#1dd1a1', '#f368e0', '#ff6b6b', '#c8d64f', '#a29bfe', '#fd79a8'];
const NAMES = ['Maya', 'Rico', 'Lena', 'Dario', 'Sofia', 'Marco', 'Nina', 'Tomas'];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function normAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function createWorld(random) {
  // ---- static city ----
  const buildings = []; const parks = []; const trees = [];
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const x0 = ROADS_V[i] + 52, x1 = ROADS_V[i + 1] - 52;
      const y0 = ROADS_H[j] + 52, y1 = ROADS_H[j + 1] - 52;
      if (x0 < 300) continue; // beach strip
      if ((i * 7 + j * 3) % 5 === 0) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t += 1) trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 10, 18) });
        continue;
      }
      const ci = Math.floor(random() * PALETTE.building.length);
      buildings.push({ x: x0 + range(random, 0, 40), y: y0 + range(random, 0, 30), w: range(random, 130, 210), h: range(random, 110, 170), color: PALETTE.building[ci], roof: PALETTE.roof[ci], seed: random() });
      if (random() < 0.5) buildings.push({ x: x1 - range(random, 150, 210), y: y1 - range(random, 130, 170), w: range(random, 110, 170), h: range(random, 100, 150), color: pick(random, PALETTE.building), roof: pick(random, PALETTE.roof), seed: random() });
    }
  }
  const landmarks = {
    pier: { x: 210, y: 1280, label: 'Sunset Pier' },
    hotel: { x: 2624, y: 640, label: 'Neon Hotel' },
    docks: { x: 3300, y: 2240, label: 'Coral Docks' },
    arcade: { x: 1088, y: 960, label: 'Pixel Arcade' },
    hideout: { x: 704, y: 2240, label: 'Hideout' },
    bank: { x: 1856, y: 1280, label: 'Coral Bank' },
    packages: [{ x: 1472, y: 640 }, { x: 2240, y: 1600 }, { x: 3008, y: 960 }],
  };

  // ---- dynamic state ----
  const player = { x: 320, y: 1280, angle: 0, health: PLAYER.health, ammo: 30, inCar: false, carId: -1, invuln: 0, punchCd: 0, shootCd: 0, speed: 0 };
  const cars = []; const peds = []; const cops = []; const bullets = []; const pickups = []; const particles = [];
  const state = {
    player, cars, peds, cops, bullets, pickups, particles, buildings, parks, trees, landmarks,
    ...createMissionState(),
    money: 0, respect: 0, wanted: 0, wantedTimer: 0, crimeTimer: 99, elapsed: 0,
    message: '', messageTimer: 0,
    over: null, overReason: '', camera: { x: 0, y: 0 }, arrest: 0, best: 0,
    shotsFired: 0, carsStolen: 0, pedsHit: 0,
    heli: null, hiddenFound: 0, hiddenTotal: HIDDEN_PACKAGES.length,
  };

  function spawnTraffic() {
    cars.length = 0;
    for (let i = 0; i < 26; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_V) : pick(random, ROADS_H);
      cars.push({
        id: i, x: vertical ? road + (random() < 0.5 ? -18 : 18) : range(random, 300, WORLD.width - 100),
        y: vertical ? range(random, 100, WORLD.height - 100) : road + (random() < 0.5 ? -18 : 18),
        angle: vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
        speed: range(random, 120, 210), health: 100, color: pick(random, CAR_COLORS),
        traffic: true, cop: false, parked: false, vertical, road, honk: range(random, 0, 5),
      });
    }
    for (let i = 0; i < 10; i += 1) {
      const road = pick(random, ROADS_V);
      cars.push({
        id: 100 + i, x: road, y: range(random, 400, WORLD.height - 200), angle: Math.PI / 2,
        speed: 0, health: 100, color: pick(random, CAR_COLORS), traffic: false, cop: false, parked: true, vertical: true, road, honk: 0,
      });
    }
  }
  function spawnPeds() {
    peds.length = 0;
    for (let i = 0; i < 42; i += 1) {
      peds.push({
        x: range(random, 300, WORLD.width - 100), y: range(random, 100, WORLD.height - 100),
        angle: range(random, 0, Math.PI * 2), speed: range(random, 30, 65), color: pick(random, PED_COLORS),
        name: pick(random, NAMES), alive: true, flee: 0, change: range(random, 1, 4), health: 30,
      });
    }
  }
  function spawnPickups() {
    pickups.length = 0;
    // Shuffle the scatter so the same seed still repeats, but cash/health/ammo
    // land in a different order each city.
    const kinds = shuffle(random, ['cash', 'cash', 'health', 'ammo', 'cash', 'repair', 'health', 'ammo', 'cash', 'cash', 'health', 'repair', 'ammo', 'cash']);
    for (const kind of kinds) {
      pickups.push({ x: range(random, 320, WORLD.width - 80), y: range(random, 120, WORLD.height - 80), kind, active: true, bob: range(random, 0, 6) });
    }
    // Hidden packages: fixed landmark spots, same every run.
    for (const spot of HIDDEN_PACKAGES) {
      pickups.push({ x: spot.x, y: spot.y, kind: 'hidden', label: spot.label, active: true, bob: range(random, 0, 6) });
    }
  }

  // Mission flow lives in missions.js; the world calls it with its live state
  // and landmarks. winGame stays here: it flips the world's over flag.
  function winGame() { state.over = 'win'; state.overReason = 'You pulled off the Sunset Heist. Vice Coast is yours.'; }
  function addWanted(n, silent) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before && !silent) { state.message = `Wanted level ${state.wanted}! Lose the cops!`; state.messageTimer = 3; }
    return state.wanted > before;
  }

  function reset() {
    player.x = 320; player.y = 1280; player.angle = 0; player.health = PLAYER.health; player.ammo = 30;
    player.inCar = false; player.carId = -1; player.invuln = 0; player.speed = 0;
    bullets.length = 0; particles.length = 0; cops.length = 0;
    state.money = 0; state.respect = 0; state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 99;
    state.elapsed = 0; state.over = null; state.overReason = ''; state.arrest = 0;
    state.shotsFired = 0; state.carsStolen = 0; state.pedsHit = 0;
    state.heli = null; state.hiddenFound = 0;
    spawnTraffic(); spawnPeds(); spawnPickups();
    startMissionFlow(state, 0, landmarks, addWanted);
  }

  function collideBuildings(x, y, r) {
    for (const b of buildings) {
      const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.01;
        return { x: cx + (dx / d) * r, y: cy + (dy / d) * r, hit: true, nx: dx / d, ny: dy / d };
      }
    }
    return { x, y, hit: false, nx: 0, ny: 0 };
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * range(random, 20, speed), vy: Math.sin(a) * range(random, 20, speed), life: range(random, 0.3, 0.8), max: 0.8, color, size: range(random, 2, 5) });
    }
  }
  function nearestCar(maxD) {
    let best = null; let bd = maxD;
    for (const c of cars) {
      if (c.cop) continue;
      const d = dist(player.x, player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function enterCar() {
    if (player.inCar) {
      const car = cars.find((c) => c.id === player.carId);
      player.inCar = false; player.carId = -1;
      player.x = car ? car.x + Math.cos(car.angle + Math.PI / 2) * 40 : player.x;
      player.y = car ? car.y + Math.sin(car.angle + Math.PI / 2) * 40 : player.y;
      return;
    }
    const car = nearestCar(85);
    if (!car) return;
    if (car.traffic) { car.traffic = false; car.parked = false; state.carsStolen += 1; addWanted(1); state.message = 'Car stolen! The owner called it in.'; state.messageTimer = 3; }
    player.inCar = true; player.carId = car.id; car.speed = 0;
  }
  function shoot(aimAngle) {
    if (player.shootCd > 0 || player.inCar) return 0;
    if (player.ammo <= 0) {
      // Punch instead: short-range melee.
      if (player.punchCd > 0) return 0;
      player.punchCd = 0.45;
      const px = player.x + Math.cos(aimAngle) * 34, py = player.y + Math.sin(aimAngle) * 34;
      for (const p of peds) if (p.alive && dist(px, py, p.x, p.y) < 34) { p.health -= 25; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } }
      for (const c of cops) if (dist(px, py, c.x, c.y) < 34) { c.health -= 25; if (c.health <= 0) c.dead = true; addWanted(1); }
      return EVENT_HIT;
    }
    player.shootCd = 0.22; player.ammo -= 1; state.shotsFired += 1;
    bullets.push({ x: player.x + Math.cos(aimAngle) * 20, y: player.y + Math.sin(aimAngle) * 20, vx: Math.cos(aimAngle) * 950, vy: Math.sin(aimAngle) * 950, life: 0.7 });
    burst(player.x + Math.cos(aimAngle) * 26, player.y + Math.sin(aimAngle) * 26, '#ffd76a', 4, 160);
    return EVENT_SHOT;
  }

  function updatePlayer(dt, ctrl) {
    if (player.invuln > 0) player.invuln -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.punchCd > 0) player.punchCd -= dt;
    if (ctrl.enter) enterCar();
    if (ctrl.shoot) shoot(ctrl.aimAngle ?? player.angle);
    if (player.inCar) {
      const car = cars.find((c) => c.id === player.carId);
      if (!car) { player.inCar = false; return; }
      const throttle = ctrl.move.y < 0 ? 1 : ctrl.move.y > 0 ? -0.7 : 0; // up = gas
      const steer = ctrl.move.x;
      if (throttle > 0) car.speed += CAR.accel * dt;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed *= Math.pow(0.4, dt);
      car.speed = clamp(car.speed, -CAR.reverse, CAR.maxSpeed);
      const turnRate = CAR.turn * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * turnRate * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (car.hitCd > 0) car.hitCd -= dt;
      const hit = collideBuildings(nx, ny, 26);
      if (hit.hit) {
        if (Math.abs(car.speed) > 240 && car.hitCd <= 0) { car.health -= 10; car.hitCd = 0.6; burst(car.x, car.y, '#ff9f43', 8, 220); state.message = 'Crash!'; state.messageTimer = 1; }
        car.speed *= -0.25; car.x = hit.x; car.y = hit.y;
      } else { car.x = nx; car.y = ny; }
      car.x = clamp(car.x, 150, WORLD.width - 20); car.y = clamp(car.y, 60, WORLD.height - 20);
      // Ram traffic cars and peds.
      for (const other of cars) {
        if (other === car || other.cop) continue;
        if (dist(car.x, car.y, other.x, other.y) < 52) {
          other.traffic = false; other.speed = 0;
          other.x += (other.x - car.x) * 0.12; other.y += (other.y - car.y) * 0.12;
          car.speed *= 0.85;
          if (car.hitCd <= 0) { car.health -= 4; other.health -= 8; car.hitCd = 0.5; burst(other.x, other.y, '#ffb142', 5, 180); }
        }
      }
      for (const p of peds) {
        if (p.alive && dist(car.x, car.y, p.x, p.y) < 34) {
          p.alive = false; state.pedsHit += 1; addWanted(1); burst(p.x, p.y, '#ff6b6b', 8, 200);
          car.speed *= 0.8;
        }
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = car.speed;
      if (Math.abs(car.speed) > 300 && random() < 0.3) particles.push({ x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#cfd8dc', size: 4 });
      if (car.health <= 0) { burst(car.x, car.y, '#ff5722', 24, 320); cars.splice(cars.indexOf(car), 1); player.inCar = false; player.health -= 20; player.invuln = 1; }
      return;
    }
    // On foot.
    const mv = ctrl.move;
    const len = Math.hypot(mv.x, mv.y) || 1;
    const speed = ctrl.sprint ? PLAYER.sprint : PLAYER.walk;
    let nx = player.x, ny = player.y;
    if (mv.x || mv.y) {
      nx = player.x + (mv.x / len) * speed * dt;
      ny = player.y + (mv.y / len) * speed * dt;
      player.angle = Math.atan2(mv.y, mv.x);
      player.speed = speed;
    } else player.speed = 0;
    const hit = collideBuildings(nx, ny, PLAYER.radius);
    player.x = clamp(hit.x, 140, WORLD.width - 20); player.y = clamp(hit.y, 60, WORLD.height - 20);
  }

  function updateTraffic(dt) {
    for (const c of cars) {
      if (!c.traffic || c.cop) continue;
      const stepLen = c.speed * dt;
      if (c.vertical) { c.y += (c.angle > 0 ? 1 : -1) * stepLen; if (c.y < 80) c.y = WORLD.height - 80; if (c.y > WORLD.height - 80) c.y = 80; }
      else { c.x += (Math.cos(c.angle) > 0 ? 1 : -1) * stepLen; if (c.x < 300) c.x = WORLD.width - 80; if (c.x > WORLD.width - 80) c.x = 300; }
      // Slow for a car ahead on the same road.
      for (const o of cars) {
        if (o === c || !o.traffic) continue;
        if (c.vertical === o.vertical && Math.abs((c.vertical ? c.x - o.x : c.y - o.y)) < 26) {
          const ahead = c.vertical ? (c.angle > 0 ? o.y - c.y : c.y - o.y) : (Math.cos(c.angle) > 0 ? o.x - c.x : c.x - o.x);
          if (ahead > 0 && ahead < 70) { c.speed = Math.max(40, c.speed - 200 * dt); }
        }
      }
    }
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (!p.alive) continue;
      p.change -= dt;
      if (p.flee > 0) {
        p.flee -= dt;
        const a = angleTo(player.x, player.y, p.x, p.y);
        p.x += Math.cos(a) * 150 * dt; p.y += Math.sin(a) * 150 * dt;
      } else {
        if (p.change <= 0) { p.angle = range(random, 0, Math.PI * 2); p.change = range(random, 2, 6); }
        const nx = p.x + Math.cos(p.angle) * p.speed * dt, ny = p.y + Math.sin(p.angle) * p.speed * dt;
        if (!collideBuildings(nx, ny, 10).hit && nx > 150 && nx < WORLD.width - 20 && ny > 60 && ny < WORLD.height - 20) { p.x = nx; p.y = ny; }
        else p.angle += Math.PI / 2;
      }
    }
  }
  // Police helicopter: spawns at 4+ stars, orbits the player, leaves when the
  // heat drops below 4. Only one heli; it can never be shot down.
  function updateHeli(dt) {
    if (state.wanted < 4) { state.heli = null; return; }
    if (!state.heli) {
      state.heli = { x: player.x + HELI.radius, y: player.y - HELI.radius, angle: -Math.PI / 4, rotor: 0 };
    }
    const h = state.heli;
    h.angle += HELI.orbitSpeed * dt;
    h.x = player.x + Math.cos(h.angle) * HELI.radius;
    h.y = player.y + Math.sin(h.angle) * HELI.radius;
    h.rotor += HELI.rotorSpeed * dt;
  }
  function updateCops(dt) {
    const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted) : state.wanted >= 1 ? 1 : 0;
    const wantFoot = state.wanted >= 1 ? Math.min(4, state.wanted + 1) : 0;
    // Spawn cop cars.
    let carCops = cops.filter((c) => c.inCar).length;
    while (carCops < wantCars) {
      const road = pick(random, ROADS_V);
      const car = { id: 900 + cops.length, x: clamp(player.x + range(random, -500, 500), 320, WORLD.width - 100), y: clamp(player.y + range(random, -400, 400), 100, WORLD.height - 100), angle: 0, speed: 0, health: 120, color: '#2f6fd0', traffic: false, cop: true, parked: false, vertical: false, road, honk: 0 };
      car.y = pick(random, ROADS_H); car.x = clamp(player.x + (random() < 0.5 ? -420 : 420), 320, WORLD.width - 100);
      cars.push(car); cops.push({ x: car.x, y: car.y, inCar: true, car, health: 100, dead: false, arrestT: 0 });
      carCops += 1;
    }
    let footCops = cops.filter((c) => !c.inCar && !c.dead).length;
    while (footCops < wantFoot) {
      cops.push({ x: clamp(player.x + range(random, -350, 350), 200, WORLD.width - 50), y: clamp(player.y + range(random, -350, 350), 80, WORLD.height - 50), inCar: false, car: null, health: 60, dead: false, arrestT: 0 });
      footCops += 1;
    }
    // Chase.
    for (const cop of cops) {
      if (cop.dead) continue;
      if (cop.inCar && cop.car) {
        const car = cop.car;
        const target = angleTo(car.x, car.y, player.x, player.y);
        car.angle += clamp(normAngle(target - car.angle), -2.4 * dt, 2.4 * dt);
        car.speed = clamp(car.speed + 380 * dt, 0, 480 + state.wanted * 25);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const hit = collideBuildings(nx, ny, 26);
        if (hit.hit) { car.speed *= 0.4; car.angle += 0.6; } else { car.x = nx; car.y = ny; }
        cop.x = car.x; cop.y = car.y;
        if (dist(car.x, car.y, player.x, player.y) < 56) {
          if (player.inCar) {
            const pc = cars.find((c) => c.id === player.carId);
            if (pc) { pc.health -= 8 * dt; pc.speed *= 0.99; burst(player.x, player.y, '#ff5252', 3, 160); }
          } else if (player.invuln <= 0) {
            player.health -= 30 * dt; player.invuln = 0.4; cop.arrestT += dt;
            if (cop.arrestT > 1.2) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
          }
        } else cop.arrestT = 0;
      } else {
        const a = angleTo(cop.x, cop.y, player.x, player.y);
        const sp = 200 + state.wanted * 18;
        cop.x += Math.cos(a) * sp * dt; cop.y += Math.sin(a) * sp * dt;
        if (dist(cop.x, cop.y, player.x, player.y) < 30 && !player.inCar && player.invuln <= 0) {
          player.health -= 26 * dt; player.invuln = 0.4; cop.arrestT += dt;
          if (cop.arrestT > 1.4) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
        } else if (dist(cop.x, cop.y, player.x, player.y) > 60) cop.arrestT = 0;
      }
    }
    // Remove dead / far cops when wanted is 0.
    if (state.wanted === 0) {
      for (let i = cops.length - 1; i >= 0; i -= 1) {
        const cop = cops[i];
        if (cop.inCar && cop.car) { cars.splice(cars.indexOf(cop.car), 1); }
        cops.splice(i, 1);
      }
    }
  }
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || collideBuildings(b.x, b.y, 2).hit;
      if (!dead) {
        for (const p of peds) if (p.alive && dist(b.x, b.y, p.x, p.y) < 16) { p.health -= 34; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } burst(b.x, b.y, '#ff6b6b', 6, 180); dead = true; break; }
        if (!dead) for (const c of cops) {
          if (c.dead) continue;
          const t = c.inCar && c.car ? c.car : c;
          if (dist(b.x, b.y, t.x, t.y) < (c.inCar ? 30 : 16)) {
            if (c.inCar) c.car.health -= 30; else { c.health -= 34; if (c.health <= 0) c.dead = true; }
            addWanted(1); burst(b.x, b.y, '#ffd32a', 6, 180); dead = true; break;
          }
        }
        if (!dead) for (const c of cars) {
          if (c.cop) continue;
          if (dist(b.x, b.y, c.x, c.y) < 30) { c.health -= 25; burst(b.x, b.y, '#ffb142', 5, 160); if (c.health <= 0) burst(c.x, c.y, '#ff5722', 16, 260); dead = true; break; }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }
  function updatePickups(dt) {
    for (const pk of pickups) {
      if (!pk.active) continue;
      pk.bob += dt;
      if (dist(player.x, player.y, pk.x, pk.y) < 36) {
        pk.active = false;
        if (pk.kind === 'hidden') {
          state.hiddenFound += 1; state.money += 50; state.respect += 2;
          state.message = `Hidden package ${state.hiddenFound}/${state.hiddenTotal} found! +$50`; state.messageTimer = 3;
        } else if (pk.kind === 'cash') { const v = 25 + Math.floor(random() * 50); state.money += v; state.message = `+$${v} found!`; state.messageTimer = 2; }
        else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); state.message = 'Health +40'; state.messageTimer = 2; }
        else if (pk.kind === 'ammo') { player.ammo += 24; state.message = 'Ammo +24'; state.messageTimer = 2; }
        else if (pk.kind === 'repair') {
          const car = cars.find((c) => c.id === player.carId);
          if (car) car.health = 100; state.message = 'Car repaired!'; state.messageTimer = 2;
        }
        burst(pk.x, pk.y, '#ffc93c', 10, 200);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }
  function updateMission(dt) {
    if (state.missionIndex >= MISSIONS.length || state.over) return 0;
    const m = state.missionIndex;
    if (m === 1 && state.missionTimer > 0) { state.missionTimer -= dt; if (state.missionTimer <= 0) { state.message = 'Too slow — packages returned. Try again!'; state.messageTimer = 3; startMissionFlow(state, 1, landmarks, addWanted); return 0; } }
    if (m === 2 && state.missionTimer > 0) { state.missionTimer -= dt; if (state.missionTimer <= 0) { state.message = 'Getaway failed — the hideout moved on. Try again!'; state.messageTimer = 3; startMissionFlow(state, 2, landmarks, addWanted); return 0; } }
    if (m === 3) {
      // Survive until wanted drops to 0.
      if (state.wanted === 0) { completeMissionFlow(state, landmarks, addWanted, winGame); return EVENT_MISSION; }
      return 0;
    }
    const t = state.missionTarget;
    if (!t) return 0;
    if (dist(player.x, player.y, t.x, t.y) < 80) {
      if (m === 0) { if (state.missionStage === 0) { state.missionStage = 1; state.message = 'Maya is in! Now the Neon Hotel.'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); } else completeMissionFlow(state, landmarks, addWanted, winGame); }
      else if (m === 1) {
        if (state.missionStage < 3) { state.missionStage += 1; state.collected += 1; state.message = `Package ${state.collected}/3 collected!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 220); refreshMissionTarget(state, landmarks); }
        else completeMissionFlow(state, landmarks, addWanted, winGame);
      } else if (m === 2) {
        if (state.missionStage === 0) { state.missionStage = 1; addWanted(2, true); state.message = 'Bag grabbed! Run for the hideout — 2 stars!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMissionFlow(state, landmarks, addWanted, winGame);
      } else if (m === 4) {
        if (state.missionStage === 0) { state.missionStage = 1; state.money += 200; addWanted(3, true); state.message = 'Vault loot grabbed! +$200 — escape!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMissionFlow(state, landmarks, addWanted, winGame);
      }
      return EVENT_MISSION;
    }
    return 0;
  }

  function step(dt, ctrl, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.missionFlash > 0) state.missionFlash -= dt;
    state.crimeTimer += dt;
    updateTraffic(dt);
    updatePeds(dt);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    if (harmless) {
      // Title backdrop: the city lives, nothing can hurt the player.
      state.camera.x = clamp(700 + Math.sin(state.elapsed * 0.05) * 500 - VIEW.width / 2, 0, WORLD.width - VIEW.width);
      state.camera.y = clamp(1280 - VIEW.height / 2, 0, WORLD.height - VIEW.height);
      return 0;
    }
    if (state.over) return EVENT_OVER;
    const c = ctrl || { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false };
    updatePlayer(dt, c);
    updateBullets(dt);
    updateCops(dt);
    updateHeli(dt);
    events |= updatePickups(dt);
    events |= updateMission(dt);
    // Wanted decay: hidden (no cop within 450) and no recent crime.
    const copNear = cops.some((cop) => !cop.dead && dist(cop.x, cop.y, player.x, player.y) < 450);
    if (state.wanted > 0 && !copNear && state.crimeTimer > 4) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED_DECAY) { state.wanted -= 1; state.wantedTimer = 0; state.message = state.wanted === 0 ? 'Heat is off. You are clean.' : `Wanted down to ${state.wanted} stars.`; state.messageTimer = 3; }
    } else state.wantedTimer = 0;
    if (player.health <= 0) { state.over = 'wasted'; state.overReason = 'Wasted! Vice Coast claimed another one.'; events |= EVENT_OVER; }
    if (state.over) events |= EVENT_OVER;
    // Camera follows the player.
    const focusX = player.x, focusY = player.y;
    state.camera.x = clamp(focusX - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    state.camera.y = clamp(focusY - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    return events;
  }

  reset();
  return {
    state, reset, step, addWanted, enterCar, shoot,
    startMission(i) { startMissionFlow(state, i, landmarks, addWanted); },
    completeMission() { completeMissionFlow(state, landmarks, addWanted, winGame); },
    // Staging helpers used by shots.js / tests: real code paths, not shortcuts.
    debugWin() { state.money = 1950; state.missionsDone = 5; state.missionIndex = 5; state.wanted = 0; state.missionText = 'Vice Coast is yours!'; state.missionTarget = null; state.message = ''; state.messageTimer = 0; const c = cars.find((x) => x.id === player.carId); if (c) c.speed = 0; winGame(); },
    debugChase() { player.x = 1856; player.y = 1280; addWanted(3, true); },
    nearestCar,
  };
}
