// Vice Coast rules v5: no drawing, no browser. An 11400x6600 coastal city in
// four districts, traffic and pedestrians, stealable cars, wanted stars and
// police, a 10-mission story, combat, pickups, money and respect — plus a
// day/night weather cycle, a rival gang holding turf, a shop, phone side
// jobs and save/continue. step() advances one fixed step and returns event
// flags. The public API the tests use is unchanged: createWorld, world.step,
// world.startMission, world.completeMission, world.debugWin, world.debugChase,
// world.addWanted, world.shoot, and state/screen/radio/effects on window.__game.
import { CAR, HELI, HIDDEN_PACKAGES, NITRO, PALETTE, PLAYER, STEP, VIEW, WORLD, WANTED_DECAY, districtAt } from './config.js';
import { MISSIONS, completeMission as completeMissionFlow, createMissionState, refreshMissionTarget, startMission as startMissionFlow } from './missions.js';
import { RANKS, WEAPONS, WEAPON_ORDER, rankFor } from './ranks.js';
import { GANG_TURF, createGang } from './gang.js';
import { createWeather } from './weather.js';
import { createShop } from './shop.js';
import { createPhone } from './phone.js';
import { saveGame } from './save.js';
import { pick, range, shuffle } from './random.js';
import { createTaxi } from './taxi.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_WANTED = 16;
export const EVENT_SHOT = 32;

// Street race (v6.5, Phase 3): a post-finale bonus race at the pier. The
// route runs on roads only (axis-aligned legs), so rival racers never cut
// through buildings. Start at the pier intersection, east along y=3250,
// north up x=4661, east along y=1625, south down x=8309 to the finish.
export const RACE_START = { x: 1013, y: 3250, label: 'Street Race' };
export const RACE_ROUTE = [
  { x: 4661, y: 3250 },
  { x: 4661, y: 1625 },
  { x: 8309, y: 1625 },
  { x: 8309, y: 4062 },
];
const RACE_PAYOUTS = [600, 300, 150, 50];
const RACE_RIVALS = [
  { name: 'VEX', color: '#e74c3c', top: 340 },
  { name: 'NOVA', color: '#f1c40f', top: 365 },
  { name: 'REX', color: '#9b59b6', top: 390 },
];

// Road grid: the v6.4 roads scaled x3.1667 / y3.1731 for the 10x map,
// plus a midpoint road between each pair so the blocks stay city-sized
// (~608 x ~406) instead of empty 1216 x 812 superblocks. 17 vertical,
// 13 horizontal.
export const ROADS_V = [1013, 1621, 2229, 2837, 3445, 4053, 4661, 5269, 5877, 6485, 7093, 7701, 8309, 8917, 9525, 10133, 10741];
export const ROADS_H = [812, 1218, 1625, 2031, 2437, 2843, 3250, 3656, 4062, 4468, 4875, 5281, 5687];
const CAR_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d', '#7f8c8d'];
const PED_COLORS = ['#ff9f43', '#48dbfb', '#1dd1a1', '#f368e0', '#ff6b6b', '#c8d64f', '#a29bfe', '#fd79a8'];
const NAMES = ['Maya', 'Rico', 'Lena', 'Dario', 'Sofia', 'Marco', 'Nina', 'Tomas'];
const TIMED_MISSIONS = [1, 2, 6, 7, 9]; // missions whose clock can run out

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function normAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function createWorld(random) {
  // ---- subsystem controllers (pure rules, owned by the world) ----
  const weather = createWeather(random);
  const gang = createGang(random);
  const shop = createShop();
  const phone = createPhone(random);
  const taxi = createTaxi(random);

  // ---- static city ----
  // Varied buildings (v6.5): a real city, not a forest of identical
  // towers. Houses, shophouses, towers, offices, hotels, warehouses, gas
  // stations and restaurants — different heights, footprints, roof shapes
  // (flat slab vs pitched pyramid) and shop signs. The mix depends on the
  // district: towers/offices/hotels downtown, warehouses at the docks,
  // houses/shops in the suburbs. Each block holds 2-4 buildings in a 2x2
  // slot grid so the big 608x406 blocks read as built-up, not empty.
  const BTYPES = {
    house: { w: [90, 150], h: [80, 130], ht: [5, 8], roof: 'pit', sign: 0, colors: ['#e8c98f', '#d9a441', '#c96f4a', '#e07a5f', '#c9c9c9', '#b05b7a'] },
    shophouse: { w: [110, 170], h: [100, 150], ht: [8, 13], roof: 'flat', sign: 0.55, colors: ['#c96f4a', '#d9a441', '#5b8fb0', '#6fae7a', '#e07a5f'] },
    tower: { w: [140, 210], h: [120, 170], ht: [14, 26], roof: 'flat', sign: 0.15, colors: PALETTE.building },
    office: { w: [150, 230], h: [130, 180], ht: [12, 20], roof: 'flat', sign: 0.3, colors: ['#7a6fae', '#5b8fb0', '#c9c9c9', '#6fae7a'] },
    hotel: { w: [160, 240], h: [140, 200], ht: [16, 28], roof: 'flat', sign: 0.8, colors: ['#d9a441', '#e07a5f', '#b05b7a', '#c96f4a'] },
    warehouse: { w: [200, 300], h: [150, 220], ht: [7, 10], roof: 'pit', sign: 0.1, colors: ['#8a7a6a', '#9a8a7a', '#7a6a5a', '#b0a090', '#6e6250'] },
    gas: { w: [180, 240], h: [140, 180], ht: [5, 6], roof: 'flat', sign: 1, colors: ['#e74c3c', '#f1c40f', '#3498db'] },
    restaurant: { w: [120, 180], h: [100, 150], ht: [6, 9], roof: 'flat', sign: 0.7, colors: ['#e07a5f', '#d9a441', '#b05b7a', '#c96f4a'] },
  };
  const SIGN_COLORS = ['#ffd76a', '#ff2fb3', '#48dbfb', '#ff5a3c', '#2ecc71'];
  function pickType(districtName) {
    const r = random();
    if (districtName === 'Neon Downtown') return r < 0.45 ? 'tower' : r < 0.75 ? 'office' : r < 0.9 ? 'hotel' : 'shophouse';
    if (districtName === 'Coral Docks') return r < 0.55 ? 'warehouse' : r < 0.8 ? 'shophouse' : r < 0.9 ? 'office' : 'restaurant';
    return r < 0.45 ? 'house' : r < 0.75 ? 'shophouse' : r < 0.9 ? 'restaurant' : 'office';
  }
  function makeBuilding(t, type, x, y, w, h) {
    return {
      x, y, w, h, type,
      height: range(random, t.ht[0], t.ht[1]),
      color: pick(random, t.colors),
      roof: pick(random, PALETTE.roof),
      roofType: t.roof,
      sign: random() < t.sign ? pick(random, SIGN_COLORS) : null,
      seed: random(),
    };
  }
  const buildings = []; const parks = []; const trees = [];
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const x0 = ROADS_V[i] + 52, x1 = ROADS_V[i + 1] - 52;
      const y0 = ROADS_H[j] + 52, y1 = ROADS_H[j + 1] - 52;
      if (x0 < 950) continue; // beach strip
      if ((i * 7 + j * 3) % 5 === 0) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t += 1) trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 10, 18) });
        continue;
      }
      // One block in ~29 is a gas station: a single low building + sign.
      if ((i * 5 + j * 11) % 29 === 0) {
        buildings.push(makeBuilding(BTYPES.gas, 'gas', x0 + (x1 - x0 - 210) / 2, y0 + (y1 - y0 - 160) / 2, 210, 160));
        continue;
      }
      // 2x2 slots; each slot gets a building ~65% of the time.
      const districtName = districtAt((x0 + x1) / 2, (y0 + y1) / 2).name;
      const sw = (x1 - x0) / 2, sh = (y1 - y0) / 2;
      for (let sx = 0; sx < 2; sx += 1) {
        for (let sy = 0; sy < 2; sy += 1) {
          if (random() > 0.65) continue;
          const type = pickType(districtName);
          const t = BTYPES[type];
          const bw = range(random, t.w[0], Math.min(t.w[1], sw - 20));
          const bh = range(random, t.h[0], Math.min(t.h[1], sh - 20));
          const bx = x0 + sx * sw + range(random, 8, Math.max(9, sw - bw - 8));
          const by = y0 + sy * sh + range(random, 8, Math.max(9, sh - bh - 8));
          buildings.push(makeBuilding(t, type, bx, by, bw, bh));
        }
      }
    }
  }
  const landmarks = {
    pier: { x: 665, y: 3250, label: 'Sunset Pier' },
    boat: { x: 348, y: 3250, label: 'Pier boat' },
    hotel: { x: 8309, y: 1625, label: 'Neon Hotel' },
    docks: { x: 10450, y: 5687, label: 'Coral Docks' },
    arcade: { x: 3445, y: 2437, label: 'Pixel Arcade' },
    hideout: { x: 2229, y: 5687, label: 'Hideout' },
    bank: { x: 5877, y: 3250, label: 'Coral Bank' },
    packages: [{ x: 4661, y: 1625 }, { x: 7093, y: 4062 }, { x: 9525, y: 2437 }],
  };

  // ---- dynamic state ----
  const player = { x: 1013, y: 3250, angle: 0, health: PLAYER.health, armor: 0, ammo: 30, inCar: false, carId: -1, invuln: 0, punchCd: 0, shootCd: 0, speed: 0, weapon: 'pistol' };
  const cars = []; const peds = []; const cops = []; const bullets = []; const pickups = []; const particles = [];
  const gangCars = [];
  const state = {
    player, cars, peds, cops, bullets, pickups, particles, gangCars, buildings, parks, trees, landmarks,
    ...createMissionState(),
    money: 0, respect: 0, wanted: 0, wantedTimer: 0, crimeTimer: 99, elapsed: 0,
    message: '', messageTimer: 0,
    over: null, overReason: '', camera: { x: 0, y: 0 }, arrest: 0, best: 0,
    shotsFired: 0, carsStolen: 0, pedsHit: 0,
    heli: null, hiddenFound: 0, hiddenTotal: HIDDEN_PACKAGES.length,
    taxi: { waiting: null, active: null, cooldown: 12 },
    gang: { kills: 0, respawn: 0 },
    weather: weather.data, shop: shop.data, phone: phone.data,
    district: 'Beach', districtTimer: 0, drivebyAt: -1,
    // Phase 3: nitro meter (100 = full), crew cooldowns + Eyes Out timer,
    // floating stunt popups, respect rank + owned weapons, street race.
    nitro: NITRO.max, nitroBoosting: false,
    crew: { miraCd: 0, lioCd: 0, kikiCd: 0, eyesT: 0 },
    popups: [],
    rank: 0,
    weapons: { fists: true, pistol: true, smg: false, '12g': false, mako: false },
    raceAvailable: false, race: null, raceCooldown: 0,
  };
  // Drift tracking (closure, not state): previous car angle + how long the
  // current drift has held. A drift pays out when it ENDS, so a long
  // slide is one payout, not one per frame.
  const drift = { prevAngle: 0, t: 0 };

  // ---- small shared helpers ----
  // Particles spawn in a small disc around (x, y), not exactly on one
  // point: a burst caught at age 0 (the staged shots fire on the last
  // step) reads as one solid square instead of a cloud. minSpeed/lifeMax
  // let a muzzle flash disperse fast instead of hovering at the gun.
  function burst(x, y, color, n, speed, minSpeed = 20, lifeMax = 0.8) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const r = random() * 2;
      particles.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * range(random, minSpeed, speed), vy: Math.sin(a) * range(random, minSpeed, speed), life: range(random, 0.3, lifeMax), max: lifeMax, color, size: range(random, 2, 5) });
    }
  }
  // Armor absorbs damage first, then health. Returns the health lost.
  function hurtPlayer(amount) {
    let left = amount;
    if (player.armor > 0) { const absorbed = Math.min(player.armor, left); player.armor -= absorbed; left -= absorbed; }
    player.health -= left;
    return left;
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
  function nearestCar(maxD) {
    let best = null; let bd = maxD;
    for (const c of cars) {
      if (c.cop || c.race) continue; // race rivals are never stealable mid-race
      const d = dist(player.x, player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // ---- spawns ----
  // v6.4 density: 34 moving + 14 parked cars (was 26 + 10) — the streets
  // near the player are kept alive by updateDensity() below.
  function spawnTraffic() {
    cars.length = 0;
    for (let i = 0; i < 34; i += 1) {
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
    for (let i = 0; i < 14; i += 1) {
      const road = pick(random, ROADS_V);
      cars.push({
        id: 100 + i, x: road, y: range(random, 400, WORLD.height - 200), angle: Math.PI / 2,
        speed: 0, health: 100, color: pick(random, CAR_COLORS), traffic: false, cop: false, parked: true, vertical: true, road, honk: 0,
      });
    }
  }
  // v6.4 density: 60 peds (was 42) + 6 beachgoers on the sand so the beach
  // is alive, not an empty postcard.
  function spawnPeds() {
    peds.length = 0;
    for (let i = 0; i < 60; i += 1) {
      peds.push({
        x: range(random, 300, WORLD.width - 100), y: range(random, 100, WORLD.height - 100),
        angle: range(random, 0, Math.PI * 2), speed: range(random, 30, 65), color: pick(random, PED_COLORS),
        name: pick(random, NAMES), alive: true, flee: 0, change: range(random, 1, 4), health: 30,
      });
    }
    for (let i = 0; i < 6; i += 1) {
      peds.push({
        x: range(random, 60, 280), y: range(random, 150, WORLD.height - 150),
        angle: range(random, 0, Math.PI * 2), speed: range(random, 20, 45), color: pick(random, PED_COLORS),
        name: pick(random, NAMES), alive: true, flee: 0, change: range(random, 1, 4), health: 30, beach: true,
      });
    }
  }
  function spawnPickups() {
    pickups.length = 0;
    // Shuffle the scatter so the same seed still repeats, but cash/health/ammo
    // land in a different order each city.
    const kinds = shuffle(random, ['cash', 'cash', 'health', 'ammo', 'cash', 'repair', 'health', 'ammo', 'cash', 'cash', 'health', 'repair', 'ammo', 'cash']);
    for (const kind of kinds) {
      pickups.push({ x: range(random, 950, WORLD.width - 80), y: range(random, 120, WORLD.height - 80), kind, active: true, bob: range(random, 0, 6) });
    }
    // Hidden packages: fixed landmark spots, same every run.
    for (const spot of HIDDEN_PACKAGES) {
      pickups.push({ x: spot.x, y: spot.y, kind: 'hidden', label: spot.label, active: true, bob: range(random, 0, 6) });
    }
  }

  // Mission flow lives in missions.js; the world calls it with its live state
  // and landmarks. winGame stays here: it flips the world's over flag.
  function winGame() { state.over = 'win'; state.overReason = 'You pulled off the Vice Coast Finale and escaped clean. Vice Coast is yours.'; }
  function addWanted(n, silent) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before && !silent) { state.message = `Wanted level ${state.wanted}! Lose the cops!`; state.messageTimer = 3; }
    return state.wanted > before;
  }
  function completeMission() {
    completeMissionFlow(state, landmarks, addWanted, winGame);
    saveGame(state); // autosave on every mission completion
  }
  function startMission(i) {
    startMissionFlow(state, i, landmarks, addWanted);
    if (i === 8) gang.ensureTurfCars(state, 0, 3);
  }

  function reset() {
    player.x = 1013; player.y = 3250; player.angle = 0; player.health = PLAYER.health; player.armor = 0; player.ammo = 30;
    player.inCar = false; player.carId = -1; player.invuln = 0; player.speed = 0; player.weapon = 'pistol';
    bullets.length = 0; particles.length = 0; cops.length = 0;
    state.money = 0; state.respect = 0; state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 99;
    state.elapsed = 0; state.over = null; state.overReason = ''; state.arrest = 0;
    state.shotsFired = 0; state.carsStolen = 0; state.pedsHit = 0;
    state.heli = null; state.hiddenFound = 0;
    state.missionsDone = 0; state.collected = 0; state.district = 'Beach'; state.districtTimer = 0;
    state.nitro = NITRO.max; state.nitroBoosting = false;
    state.crew = { miraCd: 0, lioCd: 0, kikiCd: 0, eyesT: 0 };
    state.popups.length = 0;
    state.rank = 0;
    state.weapons = { fists: true, pistol: true, smg: false, '12g': false, mako: false };
    state.raceAvailable = false; state.race = null; state.raceCooldown = 0;
    drift.prevAngle = 0; drift.t = 0;
    nextCopId = 900;
    nextRaceId = 2000;
    state.drivebyAt = -1;
    weather.reset();
    phone.reset();
    shop.data.open = false; shop.data.near = false;
    taxi.reset(state);
    gang.reset(state);
    spawnTraffic(); spawnPeds(); spawnPickups();
    startMissionFlow(state, 0, landmarks, addWanted);
  }
  // Continue from a save: fresh city, then restore money/respect/progress and
  // start at the next mission (or free roam if all ten are done).
  function continueSave(data) {
    reset();
    state.money = data.money || 0; state.respect = data.respect || 0;
    state.best = data.best || 0;
    state.missionsDone = data.missionsDone || 0;
    state.rank = data.rank || 0;
    if (Array.isArray(data.weapons)) {
      for (const w of data.weapons) if (w in state.weapons) state.weapons[w] = true;
    }
    if (data.weapon && state.weapons[data.weapon]) player.weapon = data.weapon;
    if (state.missionsDone >= MISSIONS.length) {
      state.missionIndex = MISSIONS.length; state.missionTarget = null;
      state.missionText = 'Vice Coast is yours. Free roam!';
    } else {
      startMissionFlow(state, state.missionsDone, landmarks, addWanted);
    }
  }

  // ---- player ----
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
    drift.prevAngle = car.angle; drift.t = 0;
  }
  function shoot(aimAngle) {
    if (player.shootCd > 0 || player.inCar) return 0;
    const w = WEAPONS[player.weapon] || WEAPONS.pistol;
    if (player.weapon === 'fists' || player.ammo <= 0) {
      // Punch instead: short-range melee.
      if (player.punchCd > 0) return 0;
      player.punchCd = 0.45;
      const px = player.x + Math.cos(aimAngle) * 34, py = player.y + Math.sin(aimAngle) * 34;
      for (const p of peds) if (p.alive && dist(px, py, p.x, p.y) < 34) { p.health -= 25; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } }
      for (const c of cops) if (dist(px, py, c.x, c.y) < 34) { c.health -= 25; if (c.health <= 0) c.dead = true; addWanted(1); }
      for (const g of gangCars) if (dist(px, py, g.x, g.y) < 34) { g.health -= 25; if (g.health <= 0) gang.destroyCar(state, g, { burst, onGangKill: () => phone.onCarDestroyed(state) }); }
      return EVENT_HIT;
    }
    player.shootCd = w.cd; player.ammo -= 1; state.shotsFired += 1;
    // Spread weapons (12G) fire several pellets at small angle offsets.
    for (let i = 0; i < w.spread; i += 1) {
      const off = w.spread > 1 ? (i - (w.spread - 1) / 2) * 0.07 : 0;
      const a = aimAngle + off;
      bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: w.life, dmg: w.dmg });
    }
    // Muzzle flash: few, fast, short-lived. The old 4 slow particles
    // (speed 20-160, life 0.8) hovered at the gun and overlapped into a
    // flat pale panel in the play/heist shots.
    burst(player.x + Math.cos(aimAngle) * 26, player.y + Math.sin(aimAngle) * 26, '#ffd76a', 3, 260, 120, 0.35);
    return EVENT_SHOT;
  }

  // ---- Phase 3 helpers ----
  // Floating stunt popup: shown by the HUD for ~2.4 s, newest last.
  function addPopup(text) {
    state.popups.push({ text, t: 2.4 });
    if (state.popups.length > 3) state.popups.shift();
  }
  // Crew abilities (tap a crew card, press 1/2/3, or call from the phone).
  const CREW_DEFS = {
    mira: { cd: 45, label: 'Mira · SWAP PLATES' },
    lio: { cd: 30, label: 'Lio · QUICK FIX' },
    kiki: { cd: 60, label: 'Kiki · EYES OUT' },
  };
  function useCrew(id) {
    const def = CREW_DEFS[id];
    if (!def) return { ok: false, msg: 'No such crew member.' };
    const c = state.crew;
    const cdKey = `${id}Cd`;
    if (c[cdKey] > 0) return { ok: false, msg: `${def.label} — ready in ${Math.ceil(c[cdKey])}s.` };
    if (id === 'mira') {
      if (state.wanted <= 0) return { ok: false, msg: 'Swap Plates needs heat — you have no wanted stars.' };
      state.wanted -= 1; state.wantedTimer = 0;
      c.miraCd = def.cd;
      state.message = 'Mira swapped the plates — wanted down 1 star!'; state.messageTimer = 3;
      return { ok: true, msg: state.message };
    }
    if (id === 'lio') {
      if (!player.inCar) return { ok: false, msg: 'Quick Fix needs a car — get in one first.' };
      const car = cars.find((x) => x.id === player.carId);
      if (!car) return { ok: false, msg: 'No car.' };
      if (car.health >= 100) return { ok: false, msg: 'Car is already at full health.' };
      car.health = 100; c.lioCd = def.cd;
      state.message = 'Lio patched the car — 100% health!'; state.messageTimer = 3;
      return { ok: true, msg: state.message };
    }
    c.kikiCd = def.cd; c.eyesT = 20;
    state.message = 'Kiki has eyes out — all cops marked on the minimap for 20s!'; state.messageTimer = 3;
    return { ok: true, msg: state.message };
  }
  function selectWeapon(id) {
    if (!WEAPONS[id]) return { ok: false, msg: 'No such weapon.' };
    if (!state.weapons[id]) return { ok: false, msg: `${WEAPONS[id].name} is locked — rank up to unlock it.` };
    player.weapon = id;
    return { ok: true, msg: `${WEAPONS[id].name} equipped.` };
  }
  function cycleWeapon() {
    const owned = WEAPON_ORDER.filter((w) => state.weapons[w]);
    const i = owned.indexOf(player.weapon);
    const next = owned[(i + 1) % owned.length];
    player.weapon = next;
    return { ok: true, msg: `${WEAPONS[next].name} equipped.` };
  }
  // Respect ranks: one check per step covers every respect source
  // (missions, jobs, hidden packages, gang kills) without touching each
  // call site. A rank-up grants its unlock and auto-equips the weapon.
  function checkRanks() {
    const nr = rankFor(state.respect);
    for (let i = state.rank + 1; i <= nr; i += 1) {
      state.rank = i;
      const unlock = RANKS[i].unlock;
      if (unlock && unlock.weapon) {
        state.weapons[unlock.weapon] = true;
        player.weapon = unlock.weapon;
      }
      state.message = `RANK UP! ${RANKS[i].name}${unlock ? ` — ${unlock.label} UNLOCKED` : ''}`; state.messageTimer = 4;
    }
  }
  // ---- Street race ----
  let nextRaceId = 2000;
  function routeProgress(stage, x, y) {
    const target = RACE_ROUTE[Math.min(stage, RACE_ROUTE.length - 1)];
    return stage * 10000 - dist(x, y, target.x, target.y);
  }
  function startRace() {
    const rivals = RACE_RIVALS.map((r, i) => {
      const car = {
        id: nextRaceId, x: RACE_START.x - 60 - i * 70, y: RACE_START.y - 70 + (i % 2) * 140,
        angle: 0, speed: 0, health: 100, color: r.color, traffic: false, cop: false, parked: false,
        vertical: false, road: 3250, honk: 0, race: true, raceName: r.name, raceTop: r.top,
        raceStage: 0, raceDone: false, raceTime: 0, limpT: 0,
      };
      nextRaceId += 1;
      cars.push(car);
      return car;
    });
    state.race = { phase: 'countdown', countdown: 3.2, timer: 180, stage: 0, rivals, finished: 0, position: 4, result: null, payout: 0 };
    state.message = 'STREET RACE — 3, 2, 1…'; state.messageTimer = 3;
  }
  function endRace(msg, payout) {
    const r = state.race;
    if (!r) return;
    for (const rv of r.rivals) { const i = cars.indexOf(rv); if (i >= 0) cars.splice(i, 1); }
    if (payout > 0) { state.money += payout; state.respect += 10; }
    state.message = msg; state.messageTimer = 4;
    state.race = null; state.raceCooldown = 15;
  }
  function updateRace(dt) {
    if (state.raceCooldown > 0) state.raceCooldown -= dt;
    state.raceAvailable = state.missionsDone >= 10;
    const r = state.race;
    if (!r) {
      if (state.raceAvailable && state.raceCooldown <= 0 && player.inCar && dist(player.x, player.y, RACE_START.x, RACE_START.y) < 90) startRace();
      return;
    }
    if (r.phase === 'countdown') {
      r.countdown -= dt;
      if (r.countdown <= 0) { r.phase = 'racing'; state.message = 'GO!'; state.messageTimer = 1; }
      return;
    }
    r.timer -= dt;
    if (r.timer <= 0) { endRace('Race over — out of time.', 0); return; }
    const target = RACE_ROUTE[r.stage];
    if (target && dist(player.x, player.y, target.x, target.y) < 90) {
      r.stage += 1;
      if (r.stage >= RACE_ROUTE.length) {
        const place = 1 + r.finished;
        const payout = RACE_PAYOUTS[place - 1] || 50;
        endRace(`Race finished — ${place}${place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'} place! +$${payout}`, payout);
        return;
      }
      state.message = `Checkpoint ${r.stage}/${RACE_ROUTE.length}!`; state.messageTimer = 2;
    }
    const pProg = routeProgress(r.stage, player.x, player.y);
    for (const rv of r.rivals) {
      if (rv.raceDone) continue;
      if (rv.health <= 0) { rv.health = 100; rv.limpT = 4; }
      if (rv.limpT > 0) rv.limpT -= dt;
      const tgt = RACE_ROUTE[rv.raceStage];
      if (!tgt) continue;
      const dx = tgt.x - rv.x, dy = tgt.y - rv.y;
      // Axis-aligned legs only, so rivals stay on roads and never cut
      // through buildings: drive along x until aligned, then along y.
      const desired = Math.abs(dx) > 120 ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
      rv.angle += clamp(normAngle(desired - rv.angle), -3.0 * dt, 3.0 * dt);
      const rvProg = routeProgress(rv.raceStage, rv.x, rv.y);
      let top = rv.raceTop * (rv.limpT > 0 ? 0.35 : 1);
      if (rvProg < pProg - 800) top *= 1.1; else if (rvProg > pProg + 800) top *= 0.9;
      rv.speed = clamp(rv.speed + 350 * dt, 0, top);
      const nx = rv.x + Math.cos(rv.angle) * rv.speed * dt;
      const ny = rv.y + Math.sin(rv.angle) * rv.speed * dt;
      if (!collideBuildings(nx, ny, 26).hit) { rv.x = nx; rv.y = ny; }
      if (dist(rv.x, rv.y, tgt.x, tgt.y) < 90) {
        rv.raceStage += 1;
        if (rv.raceStage >= RACE_ROUTE.length) { rv.raceDone = true; rv.raceTime = 180 - r.timer; r.finished += 1; }
      }
    }
    r.position = 1 + r.finished + r.rivals.filter((rv) => !rv.raceDone && routeProgress(rv.raceStage, rv.x, rv.y) > pProg).length;
    if (r.finished >= r.rivals.length && r.stage < RACE_ROUTE.length) {
      endRace('Race finished — 4th place! +$50', 50);
      return;
    }
    const pc = cars.find((c) => c.id === player.carId);
    if (!player.inCar) { endRace('You left the car — race over.', 0); return; }
    if (pc && pc.health <= 0) { endRace('Your car is wrecked — race over.', 0); return; }
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
      // Rain makes the roads slick: slightly less grip, a touch less turn.
      const grip = state.weather.raining ? 0.82 : 1;
      // Race countdown: the car stays put until the GO, so a late
      // throttle press cannot jump the start.
      const raceFreeze = state.race && state.race.phase === 'countdown';
      // Nitro: hold BOOST while moving to burn the meter for +35% top
      // speed and +50% accel; it refills 8/s when not burning.
      const boost = !raceFreeze && ctrl.boost && state.nitro > 0 && Math.abs(car.speed) > 0;
      state.nitroBoosting = boost;
      if (boost) {
        state.nitro = Math.max(0, state.nitro - NITRO.drain * dt);
        burst(car.x - Math.cos(car.angle) * 46, car.y - Math.sin(car.angle) * 46, '#ff8c1a', 1, 60, 30, 0.35);
      } else {
        state.nitro = Math.min(NITRO.max, state.nitro + NITRO.refill * dt);
      }
      const topSpeed = CAR.maxSpeed * (boost ? NITRO.boostMul : 1);
      const accel = CAR.accel * (boost ? NITRO.accelMul : 1);
      if (raceFreeze) car.speed = Math.max(0, car.speed - 600 * dt);
      else if (throttle > 0) car.speed += accel * dt * grip;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed *= Math.pow(0.4, dt);
      // When the boost ends the car is above the normal top speed: bleed
      // the excess down at 600/s instead of snapping. The bleed must beat
      // full-throttle accel (336/s) or the car creeps up past 448 with the
      // throttle held (300/s did exactly that). While not boosting the
      // clamp's upper bound is the current speed, so it cannot snap the
      // car down before the bleed runs.
      car.speed = clamp(car.speed, -CAR.reverse, boost ? topSpeed : Math.max(CAR.maxSpeed, car.speed));
      if (!boost && car.speed > CAR.maxSpeed) car.speed = Math.max(CAR.maxSpeed, car.speed - 600 * dt);
      // Handbrake (Space in car): sharp turns + speed bleed, so the car
      // can pitch into a drift. The bleed uses *= 0.3^dt so a tap slows
      // without killing the slide outright.
      if (ctrl.handbrake && !raceFreeze) car.speed *= Math.pow(0.3, dt);
      const turnRate = CAR.turn * grip * (ctrl.handbrake && !raceFreeze ? 2.0 : 1) * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * turnRate * dt;
      // Drift: high speed + hard yaw + steering. The payout lands when
      // the slide ENDS (t >= 0.6 s), so one long drift pays once.
      const angleRate = normAngle(car.angle - drift.prevAngle) / Math.max(dt, 0.0001);
      drift.prevAngle = car.angle;
      const drifting = !raceFreeze && Math.abs(car.speed) > 220 && Math.abs(angleRate) > 1.1 && steer !== 0;
      if (drifting) {
        drift.t += dt;
      } else if (drift.t >= 0.6) {
        const mult = Math.min(5, 1 + Math.floor(drift.t));
        const payout = 50 * mult;
        state.money += payout;
        addPopup(`DRIFT x${mult} +$${payout}`);
        drift.t = 0;
      } else {
        drift.t = 0;
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (car.hitCd > 0) car.hitCd -= dt;
      const hit = collideBuildings(nx, ny, 26);
      if (hit.hit) {
        if (Math.abs(car.speed) > 240 && car.hitCd <= 0) { car.health -= 10; car.hitCd = 0.6; burst(car.x, car.y, '#ff9f43', 8, 220); state.message = 'Crash!'; state.messageTimer = 1; }
        car.speed *= -0.25; car.x = hit.x; car.y = hit.y;
      } else { car.x = nx; car.y = ny; }
      car.x = clamp(car.x, 150, WORLD.width - 20); car.y = clamp(car.y, 60, WORLD.height - 20);
      // Ram traffic cars (and gang cars — ramming a Viper is a legit way to
      // torch one for Neon Reign) and peds. The speed cut is gated by
      // hitCd (once per 0.5 s): the old code cut 15% EVERY frame while in
      // contact, so dense traffic glued the car to a crawl.
      for (const other of cars) {
        if (other === car || other.cop) continue;
        if (dist(car.x, car.y, other.x, other.y) < 52) {
          other.traffic = false; other.speed = 0;
          other.x += (other.x - car.x) * 0.12; other.y += (other.y - car.y) * 0.12;
          if (car.hitCd <= 0) { car.speed *= 0.85; car.health -= 4; other.health -= 8; car.hitCd = 0.5; burst(other.x, other.y, '#ffb142', 5, 180); }
        } else if (other.traffic && !other.parked && !other.race && Math.abs(car.speed) > 250) {
          // Near miss: a fast pass within 52–78 of a moving traffic car
          // pays $100, once per car per 5 s (nearCd ticks in updateTraffic).
          const d = dist(car.x, car.y, other.x, other.y);
          if (d >= 52 && d < 78 && (!other.nearCd || other.nearCd <= 0)) {
            other.nearCd = 5;
            state.money += 100;
            addPopup('NEAR MISS +$100');
          }
        }
      }
      for (const g of [...gangCars]) {
        if (dist(car.x, car.y, g.x, g.y) < 52) {
          g.x += (g.x - car.x) * 0.12; g.y += (g.y - car.y) * 0.12;
          if (car.hitCd <= 0) {
            car.speed *= 0.85; car.health -= 4; g.health -= 10; car.hitCd = 0.5;
            burst(g.x, g.y, '#c084fc', 5, 180);
            if (g.health <= 0) gang.destroyCar(state, g, { burst, onGangKill: () => phone.onCarDestroyed(state) });
          }
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
      if (car.health <= 0) { burst(car.x, car.y, '#ff5722', 24, 320); cars.splice(cars.indexOf(car), 1); player.inCar = false; hurtPlayer(20); player.invuln = 1; }
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

  // ---- traffic, peds, cops, heli ----
  // Living streets (v6.4): keep at least 8 moving traffic cars within 450
  // of the player and 10 peds within 200 — recycle a far one onto a nearby
  // road / sidewalk instead of leaving the player on an empty road. One
  // recycle per frame max, never onto the player (min 90 away) and never
  // on top of another car. Uses the seeded rng, so staged shots stay
  // deterministic.
  function placeCarNearPlayer(c) {
    for (let tries = 0; tries < 6; tries += 1) {
      const vertical = random() < 0.5;
      // Pick a road NEAR the player, not any road on the map: on the 10x
      // map a random road is almost always thousands of units away, so the
      // old "any road" pick landed the car far from the player ~90% of the
      // time (measured: only 10.3% of placements within 450) and the
      // streets around the player stayed empty (density probe: 5 cars,
      // not 8). Falls back to any road where no road is near (e.g. deep
      // on the beach).
      const nearV = ROADS_V.filter((r) => Math.abs(r - player.x) < 450);
      const nearH = ROADS_H.filter((r) => Math.abs(r - player.y) < 450);
      const road = vertical
        ? (nearV.length ? pick(random, nearV) : pick(random, ROADS_V))
        : (nearH.length ? pick(random, nearH) : pick(random, ROADS_H));
      const a = range(random, 0, Math.PI * 2);
      const r = range(random, 150, 400);
      const x = clamp(player.x + Math.cos(a) * r, 950, WORLD.width - 100);
      const y = clamp(player.y + Math.sin(a) * r, 100, WORLD.height - 100);
      const nx = vertical ? road + (random() < 0.5 ? -18 : 18) : x;
      const ny = vertical ? y : road + (random() < 0.5 ? -18 : 18);
      if (dist(nx, ny, player.x, player.y) < 90) continue;
      if (dist(nx, ny, player.x, player.y) > 450) continue; // must actually land near the player
      if (cars.some((o) => o !== c && dist(nx, ny, o.x, o.y) < 70)) continue;
      c.x = nx; c.y = ny; c.vertical = vertical; c.road = road;
      c.angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
      c.speed = range(random, 120, 210);
      return true;
    }
    return false;
  }
  function placePedNearPlayer(p) {
    for (let tries = 0; tries < 6; tries += 1) {
      const a = range(random, 0, Math.PI * 2);
      const r = range(random, 90, 180);
      const x = clamp(player.x + Math.cos(a) * r, 150, WORLD.width - 20);
      const y = clamp(player.y + Math.sin(a) * r, 60, WORLD.height - 20);
      if (dist(x, y, player.x, player.y) < 40) continue;
      if (collideBuildings(x, y, 10).hit) continue;
      p.x = x; p.y = y; p.angle = range(random, 0, Math.PI * 2);
      return true;
    }
    return false;
  }
  function updateDensity() {
    let nearCars = 0;
    for (const c of cars) if (c.traffic && !c.cop && c.health > 0 && dist(c.x, c.y, player.x, player.y) < 450) nearCars += 1;
    if (nearCars < 8) {
      for (const c of cars) {
        if (c.cop || c.race || c.health <= 0 || c.id === player.carId) continue;
        // Traffic cars, plus abandoned wrecks the player rammed (they lost
        // traffic=true and would otherwise clog the roads forever).
        if (!c.traffic && c.parked) continue;
        if (dist(c.x, c.y, player.x, player.y) > 700 && placeCarNearPlayer(c)) { c.traffic = true; c.parked = false; break; }
      }
    }
    let nearPeds = 0;
    for (const p of peds) if (p.alive && dist(p.x, p.y, player.x, player.y) < 200) nearPeds += 1;
    if (nearPeds < 10) {
      for (const p of peds) {
        if (!p.alive || p.fare) continue;
        if (dist(p.x, p.y, player.x, player.y) > 400 && placePedNearPlayer(p)) break;
      }
    }
  }
  function updateTraffic(dt) {
    for (const c of cars) {
      if (c.nearCd > 0) c.nearCd -= dt;
      if (!c.traffic || c.cop) continue;
      // A wrecked traffic car stops dead instead of ghost-driving on.
      if (c.health <= 0) { c.speed = 0; continue; }
      const stepLen = c.speed * dt;
      if (c.vertical) { c.y += (c.angle > 0 ? 1 : -1) * stepLen; if (c.y < 80) c.y = WORLD.height - 80; if (c.y > WORLD.height - 80) c.y = 80; }
      else { c.x += (Math.cos(c.angle) > 0 ? 1 : -1) * stepLen; if (c.x < 950) c.x = WORLD.width - 80; if (c.x > WORLD.width - 80) c.x = 950; }
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
      if (p.fare) continue; // a waiting taxi fare stands still for its cab
      p.change -= dt;
      if (p.flee > 0) {
        p.flee -= dt;
        const a = angleTo(player.x, player.y, p.x, p.y);
        const nx = p.x + Math.cos(a) * 150 * dt, ny = p.y + Math.sin(a) * 150 * dt;
        // Fleeing peds stay in the city (the old code let them run into the
        // sea / off the map with no bounds check).
        if (!collideBuildings(nx, ny, 10).hit && nx > 150 && nx < WORLD.width - 20 && ny > 60 && ny < WORLD.height - 20) { p.x = nx; p.y = ny; }
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
  // Monotonic cop-car ids: the old `900 + cops.length` reused an id after a
  // cop car was destroyed, so two cars shared one mesh/identity (B1).
  let nextCopId = 900;
  function updateCops(dt) {
    const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted) : state.wanted >= 1 ? 1 : 0;
    const wantFoot = state.wanted >= 1 ? Math.min(4, state.wanted + 1) : 0;
    // Spawn cop cars.
    let carCops = cops.filter((c) => c.inCar).length;
    while (carCops < wantCars) {
      const road = pick(random, ROADS_V);
      const car = { id: nextCopId, x: clamp(player.x + range(random, -500, 500), 950, WORLD.width - 100), y: clamp(player.y + range(random, -400, 400), 100, WORLD.height - 100), angle: 0, speed: 0, health: 120, color: '#2f6fd0', traffic: false, cop: true, parked: false, vertical: false, road, honk: 0 };
      nextCopId += 1;
      car.y = pick(random, ROADS_H); car.x = clamp(player.x + (random() < 0.5 ? -420 : 420), 950, WORLD.width - 100);
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
        // v6.4: cop cars slow down with the player car (was 480 + 25/star,
        // faster than the player's old 560 and far faster than the new 448)
        // — 380 at 1 star, 460 at 5 stars, so escape is possible but tense.
        car.speed = clamp(car.speed + 380 * dt, 0, 360 + state.wanted * 20);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const hit = collideBuildings(nx, ny, 26);
        if (hit.hit) { car.speed *= 0.4; car.angle += 0.6; } else { car.x = nx; car.y = ny; }
        cop.x = car.x; cop.y = car.y;
        if (dist(car.x, car.y, player.x, player.y) < 56) {
          if (player.inCar) {
            const pc = cars.find((c) => c.id === player.carId);
            if (pc) { pc.health -= 8 * dt; pc.speed *= 0.99; burst(player.x, player.y, '#ff5252', 3, 160); }
          } else if (player.invuln <= 0) {
            hurtPlayer(30 * dt); player.invuln = 0.4; cop.arrestT += dt;
            if (cop.arrestT > 1.2) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
          }
        } else cop.arrestT = 0;
      } else {
        const a = angleTo(cop.x, cop.y, player.x, player.y);
        const sp = 200 + state.wanted * 18;
        cop.x += Math.cos(a) * sp * dt; cop.y += Math.sin(a) * sp * dt;
        if (dist(cop.x, cop.y, player.x, player.y) < 30 && !player.inCar && player.invuln <= 0) {
          hurtPlayer(26 * dt); player.invuln = 0.4; cop.arrestT += dt;
          if (cop.arrestT > 1.4) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
        } else if (dist(cop.x, cop.y, player.x, player.y) >= 30) cop.arrestT = 0; // was >60: the 30-60 band froze the timer forever (B13)
      }
    }
    // A cop car shot to pieces explodes: it counts for the Vigilante phone job.
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.inCar && cop.car && cop.car.health <= 0) {
        burst(cop.car.x, cop.car.y, '#ff5722', 22, 300);
        cars.splice(cars.indexOf(cop.car), 1);
        cops.splice(i, 1);
        phone.onCarDestroyed(state);
        state.message = 'Cop car wrecked!'; state.messageTimer = 2;
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
      if (!dead && b.gang) {
        // Drive-by round: it only ever hurts the player.
        if (dist(b.x, b.y, player.x, player.y) < 16) {
          if (player.inCar) {
            const pc = cars.find((c) => c.id === player.carId);
            if (pc) pc.health -= 6;
          } else if (player.invuln <= 0) { hurtPlayer(8); player.invuln = 0.3; }
          burst(b.x, b.y, '#ff5252', 4, 140);
          dead = true;
        }
      }
      if (!dead && !b.gang) {
        for (const p of peds) if (p.alive && dist(b.x, b.y, p.x, p.y) < 16) { p.health -= b.dmg ?? 30; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } burst(b.x, b.y, '#ff6b6b', 6, 180); dead = true; break; }
        if (!dead) for (const c of cops) {
          if (c.dead) continue;
          const t = c.inCar && c.car ? c.car : c;
          if (dist(b.x, b.y, t.x, t.y) < (c.inCar ? 30 : 16)) {
            if (c.inCar) c.car.health -= b.dmg ?? 30; else { c.health -= b.dmg ?? 30; if (c.health <= 0) c.dead = true; }
            addWanted(1); burst(b.x, b.y, '#ffd32a', 6, 180); dead = true; break;
          }
        }
        if (!dead) for (const c of cars) {
          if (c.cop) continue;
          if (dist(b.x, b.y, c.x, c.y) < 30) { c.health -= b.dmg ?? 30; burst(b.x, b.y, '#ffb142', 5, 160); if (c.health <= 0) burst(c.x, c.y, '#ff5722', 16, 260); dead = true; break; }
        }
        if (!dead) for (const g of gangCars) {
          if (dist(b.x, b.y, g.x, g.y) < 38) {
            g.health -= b.dmg ?? 30; burst(b.x, b.y, '#c084fc', 6, 180);
            if (g.health <= 0) gang.destroyCar(state, g, { burst, onGangKill: () => phone.onCarDestroyed(state) });
            dead = true; break;
          }
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

  // ---- missions ----
  function updateMission(dt) {
    const m = state.missionIndex;
    if (m >= MISSIONS.length || state.over) return 0;
    // Timed missions restart when the clock runs out.
    if (TIMED_MISSIONS.includes(m) && state.missionTimer > 0) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.message = 'Too slow — the job fell through. Try again!'; state.messageTimer = 3;
        startMissionFlow(state, m, landmarks, addWanted);
        return 0;
      }
    }
    if (m === 3) {
      // Survive until wanted drops to 0.
      if (state.wanted === 0) { completeMission(); return EVENT_MISSION; }
      return 0;
    }
    if (m === 8) {
      // Neon Reign: torch 3 gang cars, then hold the turf marker 20 s.
      if (state.missionStage === 0) {
        if (!state.gangPrimed) { state.gangPrimed = true; state.gangMissionKills = 0; gang.ensureTurfCars(state, 0, 3); }
        if (state.gangMissionKills >= 3) {
          state.missionStage = 1; state.missionHold = 0;
          state.message = 'Turf cleared! Hold the marker for 20 seconds!'; state.messageTimer = 3;
          refreshMissionTarget(state, landmarks);
          return EVENT_MISSION;
        }
        return 0;
      }
      const turf = GANG_TURF[0];
      if (dist(player.x, player.y, turf.x, turf.y) < 90) {
        state.missionHold += dt;
        state.missionText = `Neon Reign — Hold the turf ${Math.max(0, Math.ceil(20 - state.missionHold))}s`;
        if (state.missionHold >= 20) { completeMission(); return EVENT_MISSION; }
      } else {
        state.missionHold = Math.max(0, state.missionHold - dt * 0.5);
        state.missionText = 'Neon Reign — Hold the turf marker';
      }
      return 0;
    }
    const t = state.missionTarget;
    if (!t) return 0;
    if (dist(player.x, player.y, t.x, t.y) < 80) {
      if (m === 0) { if (state.missionStage === 0) { state.missionStage = 1; state.message = 'Maya is in! Now the Neon Hotel.'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); } else completeMission(); }
      else if (m === 1) {
        if (state.missionStage < 3) { state.missionStage += 1; state.collected += 1; state.message = `Package ${state.collected}/3 collected!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 220); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 2) {
        if (state.missionStage === 0) { state.missionStage = 1; addWanted(2, true); state.message = 'Bag grabbed! Run for the hideout — 2 stars!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 4) {
        if (state.missionStage === 0) { state.missionStage = 1; state.money += 200; addWanted(3, true); state.message = 'Vault loot grabbed! +$200 — escape!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 5) {
        if (state.missionStage < 4) { state.missionStage += 1; state.collected += 1; state.message = `Night drop ${state.collected}/4 collected!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 220); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 6) {
        completeMission();
      } else if (m === 7) {
        if (state.missionStage < 3) { state.missionStage += 1; state.collected += 1; state.message = `Crate ${state.collected}/3 loaded!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 220); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 9) {
        if (state.missionStage === 0) { state.missionStage = 1; state.message = 'Vault hit! Escape to the Sunset Pier — 5 stars!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      }
      return EVENT_MISSION;
    }
    return 0;
  }

  // ---- main step ----
  function step(dt, ctrl, harmless) {
    let events = 0;
    state.elapsed += dt;
    weather.update(dt);
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.missionFlash > 0) state.missionFlash -= dt;
    // Phase 3: crew cooldowns + Eyes Out timer tick down; stunt popups
    // expire after ~2.4 s.
    const crew = state.crew;
    if (crew.miraCd > 0) crew.miraCd -= dt;
    if (crew.lioCd > 0) crew.lioCd -= dt;
    if (crew.kikiCd > 0) crew.kikiCd -= dt;
    if (crew.eyesT > 0) crew.eyesT -= dt;
    for (let i = state.popups.length - 1; i >= 0; i -= 1) { state.popups[i].t -= dt; if (state.popups[i].t <= 0) state.popups.splice(i, 1); }
    if (state.districtTimer > 0) state.districtTimer -= dt;
    state.crimeTimer += dt;
    updateTraffic(dt);
    updatePeds(dt);
    updateDensity(dt);
    taxi.update(dt, state);
    shop.update(state);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    if (harmless) {
      // Title backdrop: the city lives, nothing can hurt the player.
      state.camera.x = clamp(2217 + Math.sin(state.elapsed * 0.05) * 1583 - VIEW.width / 2, 0, WORLD.width - VIEW.width);
      state.camera.y = clamp(3250 - VIEW.height / 2, 0, WORLD.height - VIEW.height);
      return 0;
    }
    if (state.over) return EVENT_OVER;
    const c = ctrl || { move: { x: 0, y: 0 }, sprint: false, boost: false, handbrake: false, shoot: false, aimAngle: 0, enter: false };
    updatePlayer(dt, c);
    updateBullets(dt);
    updateCops(dt);
    updateHeli(dt);
    gang.update(dt, state, {
      burst, collide: collideBuildings,
      onDriveby() { state.drivebyAt = state.elapsed; },
      onGangKill() { phone.onCarDestroyed(state); },
    });
    phone.update(dt, state);
    updateRace(dt);
    checkRanks();
    events |= updatePickups(dt);
    events |= updateMission(dt);
    // District banner: show the district name for 3 s when it changes.
    const d = districtAt(player.x, player.y);
    if (d.name !== state.district) { state.district = d.name; state.districtTimer = 3; }
    // Wanted decay: hidden (no cop within 380) and no recent crime.
    const copNear = cops.some((cop) => !cop.dead && dist(cop.x, cop.y, player.x, player.y) < 380);
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
    state, reset, step, addWanted, enterCar, shoot, startMission, completeMission, continueSave, nearestCar,
    useCrew, selectWeapon, cycleWeapon,
    weather, gang, shop, phone,
    // Staging helpers used by shots.js / tests: real code paths, not shortcuts.
    debugWin() { state.money = 9850; state.missionsDone = 10; state.missionIndex = 10; state.wanted = 0; state.missionText = 'Vice Coast is yours!'; state.missionTarget = null; state.message = ''; state.messageTimer = 0; const c = cars.find((x) => x.id === player.carId); if (c) c.speed = 0; winGame(); },
    debugChase() { player.x = 8309; player.y = 2437; addWanted(3, true); },
  };
}
