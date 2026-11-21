// Vice Coast v6 rules: no drawing, no browser. A 11400x6600 coastal city
// in four districts, traffic and pedestrians with a density keeper, stealable
// cars, wanted stars, police cars, roadblocks and a helicopter, a 10-mission
// story, combat, pickups, money and respect — plus nitro, handbrake, drift
// and near-miss payouts, crew abilities, a post-finale street race, respect
// ranks with weapon unlocks, a repo phone job and save/continue. step()
// advances one fixed step and returns event flags. Written fresh for the
// v6 rebuild from the prose spec; the v5 facts it carries are re-expressed
// in this file's own structure.
import { CAR, COP_SPEED, CREW, DRIFT, GOLD_PAINT, HANDBRAKE, HELI, HIDDEN_PACKAGES, NEAR_MISS, NITRO, PALETTE, PED_WALK, PLAYER, RANKS, STEP, SUN_DIRECTION, WEAPONS, WORLD, WANTED_DECAY, HIDE_RADIUS, districtAt } from './config.js';
import { MISSIONS, completeMission as completeMissionFlow, createMissionState, refreshMissionTarget, startMission as startMissionFlow } from './missions.js';
import { GANG_TURF, createGang } from './gang.js';
import { createWeather } from './weather.js';
import { createShop } from './shop.js';
import { createPhone } from './phone.js';
import { saveGame } from './save.js';
import { pick, range, shuffled } from './random.js';
import { createTaxi } from './taxi.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_WANTED = 16;
export const EVENT_SHOT = 32;

export const ROADS_V = [];
for (let i = 0; i < 17; i += 1) ROADS_V.push(1050 + i * 620);
export const ROADS_H = [];
for (let j = 0; j < 13; j += 1) ROADS_H.push(550 + j * 500);

const CAR_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d', '#7f8c8d'];
const PED_COLORS = ['#ff9f43', '#48dbfb', '#1dd1a1', '#f368e0', '#ff6b6b', '#c8d64f', '#a29bfe', '#fd79a8'];
const PED_NAMES = ['Maya', 'Rico', 'Lena', 'Dario', 'Sofia', 'Marco', 'Nina', 'Tomas'];
const TIMED_MISSIONS = [1, 2, 6, 7, 9];
const RACE_RIVALS = [
  { name: 'VEX', top: 340, color: '#e74c3c' },
  { name: 'NOVA', top: 365, color: '#3498db' },
  { name: 'REX', top: 390, color: '#f1c40f' },
];
const RACE_POINTS = [
  { x: 2400, y: 3300 }, { x: 5200, y: 3300 }, { x: 8000, y: 3300 }, { x: 10500, y: 3300 },
];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function normAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function createWorld(random) {
  const weather = createWeather(random);
  const gang = createGang(random);
  const shop = createShop();
  const phone = createPhone(random);
  const taxi = createTaxi(random);

  const buildings = [];
  const parks = [];
  const signs = [];
  const palms = [];
  const typeQuota = { house: 117, shophouse: 102, office: 53, tower: 47, restaurant: 37, hotel: 23, warehouse: 21, gas: 5 };
  const typeLeft = { ...typeQuota };
  const typeSize = {
    house: { w: [180, 260], h: [160, 240], ht: [70, 110] },
    shophouse: { w: [220, 320], h: [180, 260], ht: [90, 150] },
    office: { w: [260, 380], h: [220, 320], ht: [160, 260] },
    tower: { w: [300, 420], h: [260, 360], ht: [320, 520] },
    restaurant: { w: [220, 320], h: [180, 260], ht: [80, 130] },
    hotel: { w: [300, 420], h: [240, 340], ht: [220, 340] },
    warehouse: { w: [360, 520], h: [280, 400], ht: [90, 140] },
    gas: { w: [260, 320], h: [200, 260], ht: [50, 70] },
  };
  const typeOrder = ['house', 'shophouse', 'office', 'tower', 'restaurant', 'hotel', 'warehouse', 'gas'];
  let pitchedLeft = 138;
  function nextType(blockCenterX, blockCenterY) {
    const pool = [];
    if (blockCenterX >= 7100 && blockCenterY < 4000) pool.push('tower', 'office', 'hotel', 'shophouse');
    else if (blockCenterX >= 8300 && blockCenterY >= 4000) pool.push('warehouse', 'shophouse', 'office');
    else pool.push('house', 'house', 'shophouse', 'restaurant', 'gas');
    for (const t of shuffled(random, pool)) if (typeLeft[t] > 0) return t;
    for (const t of typeOrder) if (typeLeft[t] > 0) return t;
    return null;
  }
  const blocks = [];
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      const x0 = ROADS_V[i] + 100, x1 = ROADS_V[i + 1] - 100;
      const y0 = ROADS_H[j] + 100, y1 = ROADS_H[j + 1] - 100;
      if (x0 < 900) continue; // beach strip stays open
      blocks.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }
  const parkBlocks = shuffled(random, blocks).slice(0, 39);
  const parkSet = new Set(parkBlocks);
  for (const b of parkBlocks) {
    parks.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
    for (let t = 0; t < 8; t += 1) palms.push({ x: range(random, b.x0 + 30, b.x1 - 30), y: range(random, b.y0 + 30, b.y1 - 30), r: range(random, 12, 20), park: true });
  }
  const FACADE_ACCENTS = ['#ffd700', '#ff2fb3', '#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#00e5ff'];
  const PED_TROUSERS = ['#2c3e50', '#34495e', '#5d4037', '#1c2733', '#6b7c93'];
  const PED_HAIR = ['#1a1a1a', '#4a2c14', '#8a8a8a', '#d9a441', '#6b2d1a'];
  const PED_HATS = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71'];
  function pedLook(random, beach) {
    // Round 7: every pedestrian carries its own look so the rig layer
    // can build a human that never looks cloned — height, build,
    // trousers, hair or a hat, plus a walk phase the renderer animates.
    return {
      seed: random(),
      height: 0.88 + random() * 0.24,
      build: 0.85 + random() * 0.35,
      trousers: beach ? '#e8c98f' : pick(random, PED_TROUSERS),
      hair: pick(random, PED_HAIR),
      hat: beach ? null : (random() < 0.3 ? pick(random, PED_HATS) : null),
      walkPhase: random() * Math.PI * 2,
      moving: true,
      hurrying: false,
    };
  }
  function buildingLook(random, type, ht) {
    // Round 7: facade data lives with the building — its floor count
    // follows its height and its accent varies, so the facade layer
    // never gives two neighbours the same face.
    return {
      floors: Math.max(1, Math.min(14, Math.round(ht / 42))),
      accent: pick(random, FACADE_ACCENTS),
    };
  }
  for (const b of blocks) {
    if (parkSet.has(b)) continue;
    const count = random() < 0.45 ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const type = nextType(b.cx, b.cy);
      if (!type) break;
      typeLeft[type] -= 1;
      const sz = typeSize[type];
      const w = Math.min(range(random, sz.w[0], sz.w[1]), b.x1 - b.x0 - 60);
      const h = Math.min(range(random, sz.h[0], sz.h[1]), b.y1 - b.y0 - 60);
      const bx = k === 0 ? b.x0 + range(random, 0, 20) : b.x1 - w - range(random, 0, 20);
      const by = k === 0 ? b.y0 + range(random, 0, 20) : b.y1 - h - range(random, 0, 20);
      const pitched = type === 'house' || (type === 'shophouse' && pitchedLeft > 21);
      if (pitched) pitchedLeft -= 1;
      const ci = Math.floor(random() * PALETTE.building.length);
      const ht = range(random, sz.ht[0], sz.ht[1]);
      buildings.push({
        x: bx, y: by, w, h, ht,
        type, pitched, color: PALETTE.building[ci], roof: PALETTE.roof[ci], seed: random(),
        ...buildingLook(random, type, ht),
      });
    }
  }
  for (const t of typeOrder) {
    while (typeLeft[t] > 0) {
      const b = blocks[Math.floor(random() * blocks.length)];
      const sz = typeSize[t];
      const w = Math.min(range(random, sz.w[0], sz.w[1]), b.x1 - b.x0 - 60);
      const h = Math.min(range(random, sz.h[0], sz.h[1]), b.y1 - b.y0 - 60);
      const pitched = t === 'house' && pitchedLeft > 0;
      if (pitched) pitchedLeft -= 1;
      const ci = Math.floor(random() * PALETTE.building.length);
      const ht = range(random, sz.ht[0], sz.ht[1]);
      buildings.push({ x: b.x0 + range(random, 0, Math.max(0, b.x1 - b.x0 - w)), y: b.y0 + range(random, 0, Math.max(0, b.y1 - b.y0 - h)), w, h, ht, type: t, pitched, color: PALETTE.building[ci], roof: PALETTE.roof[ci], seed: random(), ...buildingLook(random, t, ht) });
      typeLeft[t] -= 1;
    }
  }
  for (let i = 0; i < 125; i += 1) {
    const b = buildings[Math.floor(random() * buildings.length)];
    signs.push({ x: b.x + b.w / 2, y: b.y - 20, text: '', color: pick(random, ['#ff2fb3', '#f1c40f', '#2ecc71', '#3498db', '#ff6b9d']), big: random() < 0.2 });
  }
  for (let y = 400; y < 6600; y += 320) {
    palms.push({ x: range(random, 620, 780), y: y + range(random, -60, 60), r: range(random, 14, 22), park: false });
    if (random() < 0.5) palms.push({ x: range(random, 950, 1100), y: y + 160, r: range(random, 12, 20), park: false });
  }

  const landmarks = {
    pier: { x: 350, y: 3300, label: 'Sunset Pier' },
    boat: { x: 120, y: 3300, label: 'Pier boat' },
    hotel: { x: 8300, y: 1300, label: 'Neon Hotel' },
    docks: { x: 10600, y: 5600, label: 'Coral Docks' },
    arcade: { x: 3600, y: 2400, label: 'Pixel Arcade' },
    hideout: { x: 2400, y: 5800, label: 'Hideout' },
    bank: { x: 5900, y: 3200, label: 'Coral Bank' },
    packages: [{ x: 4350, y: 1300 }, { x: 7100, y: 3800 }, { x: 9800, y: 2300 }],
  };

  const player = { x: 1050, y: 3300, angle: 0, health: PLAYER.health, armor: 0, ammo: 30, inCar: false, carId: -1, invuln: 0, punchCd: 0, shootCd: 0, speed: 0, walkPhase: 0, moving: false, sprinting: false, aiming: false };
  const cars = [];
  const peds = [];
  const cops = [];
  const bullets = [];
  const pickups = [];
  const particles = [];
  const popups = [];
  const gangCars = [];
  const state = {
    player, cars, peds, cops, bullets, pickups, particles, popups, gangCars,
    buildings, parks, signs, palms, landmarks,
    ...createMissionState(),
    money: 0, earnedTotal: 0, respect: 0, rankIndex: 0, wanted: 0, wantedTimer: 0, crimeTimer: 99, elapsed: 0,
    message: '', messageTimer: 0,
    over: null, overReason: '', camera: { x: 0, y: 0 }, arrest: 0, best: 0,
    shotsFired: 0, carsStolen: 0, pedsHit: 0, hitMarker: 0,
    heli: null, hiddenFound: 0, hiddenTotal: HIDDEN_PACKAGES.length,
    taxi: { waiting: null, active: null, cooldown: 12, waitTimer: 0 },
    gang: { kills: 0, respawn: 0 },
    weather: weather.data, shop: shop.data, phone: phone.data,
    sunDirection: SUN_DIRECTION.day,
    district: 'Beach', districtTimer: 0, drivebyAt: -1,
    nitro: NITRO.cap, boosting: false, driftMult: 0, driftScore: 0, drifting: false,
    crew: { mira: 0, lio: 0, kiki: 0, kikiUntil: 0 },
    weapons: ['pistol'], weapon: 'pistol', ammoByWeapon: { pistol: 30 },
    race: { available: false, active: false, countdown: 0, stage: 0, rivals: [], cooldown: 0, place: 0, finished: false },
    repo: null,
    policeList: [], roadblock: null,
    saveTimer: 30, yawRate: 0,
  };

  function burst(x, y, color, n, speed, z) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      particles.push({ x, y, z: z || 20, vx: Math.cos(a) * range(random, 20, speed), vy: Math.sin(a) * range(random, 20, speed), vz: range(random, 40, 160), life: range(random, 0.3, 0.8), max: 0.8, color, size: range(random, 3, 7) });
    }
  }
  function popup(x, y, text, color) {
    popups.push({ x, y, text, color: color || '#2ecc71', life: 1.6 });
  }
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
    let best = null;
    let bd = maxD;
    for (const c of cars) {
      if (c.cop) continue;
      const d = dist(player.x, player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function rankName() { return RANKS[state.rankIndex].name; }
  function checkRank() {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i += 1) if (state.respect >= RANKS[i].at) idx = i;
    if (idx > state.rankIndex) {
      state.rankIndex = idx;
      const w = RANKS[idx].weapon;
      if (w && !state.weapons.includes(w)) {
        state.weapons.push(w);
        state.weapon = w;
        state.ammoByWeapon[w] = WEAPONS[w].ammo;
        player.ammo = WEAPONS[w].ammo;
        state.message = `Rank up: ${RANKS[idx].name}! Unlocked the ${WEAPONS[w].name} — auto-equipped.`;
      } else {
        state.message = `Rank up: ${RANKS[idx].name}!`;
      }
      if (idx === 4) state.message = 'Rank up: Kingpin! Gold paint is now in the shop.';
      state.messageTimer = 4;
    }
  }

  function spawnTraffic() {
    cars.length = 0;
    for (let i = 0; i < 34; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_V) : pick(random, ROADS_H);
      cars.push({
        id: i,
        x: vertical ? road + (random() < 0.5 ? -34 : 34) : range(random, 1050, WORLD.width - 200),
        y: vertical ? range(random, 600, WORLD.height - 200) : road + (random() < 0.5 ? -34 : 34),
        angle: vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
        speed: range(random, 120, 210), health: 100, color: pick(random, CAR_COLORS),
        traffic: true, cop: false, parked: false, vertical, road, honk: range(random, 0, 5), nearMissCd: 0, hitCd: 0,
      });
    }
    for (let i = 0; i < 14; i += 1) {
      const road = pick(random, ROADS_V);
      cars.push({
        id: 100 + i, x: road + 34, y: range(random, 800, WORLD.height - 400), angle: Math.PI / 2,
        speed: 0, health: 100, color: pick(random, CAR_COLORS), traffic: false, cop: false, parked: true, vertical: true, road, honk: 0, nearMissCd: 0, hitCd: 0,
      });
    }
  }
  function spawnPeds() {
    peds.length = 0;
    for (let i = 0; i < 60; i += 1) {
      const px = range(random, 1050, WORLD.width - 200);
      const py = range(random, 600, WORLD.height - 200);
      peds.push({
        x: dist(px, py, 1050, 3300) < 260 ? px + 500 : px,
        y: py,
        angle: range(random, 0, Math.PI * 2), speed: range(random, 30, 65), color: pick(random, PED_COLORS),
        name: pick(random, PED_NAMES), alive: true, flee: 0, change: range(random, 1, 4), health: 30, beach: false,
        ...pedLook(random, false),
      });
    }
    for (let i = 0; i < 6; i += 1) {
      peds.push({
        x: range(random, 200, 800), y: range(random, 800, WORLD.height - 800),
        angle: range(random, 0, Math.PI * 2), speed: range(random, 25, 45), color: pick(random, PED_COLORS),
        name: pick(random, PED_NAMES), alive: true, flee: 0, change: range(random, 1, 4), health: 30, beach: true,
        ...pedLook(random, true),
      });
    }
  }
  function spawnPickups() {
    pickups.length = 0;
    const kinds = shuffled(random, ['cash', 'cash', 'health', 'ammo', 'cash', 'repair', 'health', 'ammo', 'cash', 'cash', 'health', 'repair', 'ammo', 'cash']);
    for (const kind of kinds) {
      pickups.push({ x: range(random, 1100, WORLD.width - 200), y: range(random, 600, WORLD.height - 200), kind, active: true, bob: range(random, 0, 6) });
    }
    for (const spot of HIDDEN_PACKAGES) {
      pickups.push({ x: spot.x, y: spot.y, kind: 'hidden', label: spot.label, active: true, bob: range(random, 0, 6) });
    }
  }

  function winGame() {
    state.over = 'win';
    state.overReason = 'You pulled off the Vice Coast Finale and escaped clean. Vice Coast is yours.';
    state.race.available = true;
  }
  function addWanted(n, silent) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before && !silent) { state.message = `Wanted level ${state.wanted}! Lose the cops!`; state.messageTimer = 3; }
    return state.wanted > before;
  }
  function completeMission() {
    completeMissionFlow(state, landmarks, addWanted, winGame);
    saveGame(state);
  }
  function startMission(i) {
    startMissionFlow(state, i, landmarks, addWanted);
    if (i === 8) gang.ensureTurfCars(state, 0, 3);
  }

  function reset() {
    player.x = 1050; player.y = 3300; player.angle = 0; player.health = PLAYER.health; player.armor = 0; player.ammo = 30;
    player.inCar = false; player.carId = -1; player.invuln = 0; player.speed = 0; player.walkPhase = 0;
    bullets.length = 0; particles.length = 0; popups.length = 0; cops.length = 0;
    state.money = 0; state.earnedTotal = 0; state.respect = 0; state.rankIndex = 0;
    state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 99;
    state.elapsed = 0; state.over = null; state.overReason = ''; state.arrest = 0;
    state.shotsFired = 0; state.carsStolen = 0; state.pedsHit = 0; state.hitMarker = 0;
    state.heli = null; state.hiddenFound = 0; state.nitro = NITRO.cap; state.boosting = false;
    state.driftMult = 0; state.driftScore = 0; state.drifting = false;
    state.crew = { mira: 0, lio: 0, kiki: 0, kikiUntil: 0 };
    state.weapons = ['pistol']; state.weapon = 'pistol'; state.ammoByWeapon = { pistol: 30 };
    state.race = { available: false, active: false, countdown: 0, stage: 0, rivals: [], cooldown: 0, place: 0, finished: false };
    state.missionsDone = 0; state.collected = 0; state.district = 'Beach'; state.districtTimer = 0;
    state.drivebyAt = -1; state.roadblock = null; state.saveTimer = 30;
    weather.reset();
    phone.reset();
    shop.data.open = false; shop.data.near = false;
    taxi.reset(state);
    gang.reset(state);
    spawnTraffic(); spawnPeds(); spawnPickups();
    startMissionFlow(state, 0, landmarks, addWanted);
  }
  function continueSave(data) {
    reset();
    state.money = data.money || 0;
    state.earnedTotal = data.earned || 0;
    state.respect = data.respect || 0;
    state.best = data.best || 0;
    state.weapons = data.weapons && data.weapons.length ? data.weapons.slice() : ['pistol'];
    state.weapon = data.weapon && state.weapons.includes(data.weapon) ? data.weapon : 'pistol';
    state.ammoByWeapon = { pistol: 30 };
    for (const w of state.weapons) state.ammoByWeapon[w] = WEAPONS[w].ammo;
    player.ammo = state.ammoByWeapon[state.weapon];
    let idx = 0;
    for (let i = 0; i < RANKS.length; i += 1) if (state.respect >= RANKS[i].at) idx = i;
    state.rankIndex = idx;
    state.missionsDone = data.missionsDone || 0;
    if (state.missionsDone >= MISSIONS.length) {
      state.missionIndex = MISSIONS.length; state.missionTarget = null;
      state.missionText = 'Vice Coast is yours. Free roam!';
      state.race.available = true;
    } else {
      startMissionFlow(state, state.missionsDone, landmarks, addWanted);
    }
  }

  function useCrew(id) {
    if (state.crew[id] > 0) return { ok: false, msg: `${id} is recharging (${Math.ceil(state.crew[id])}s).` };
    if (id === 'mira') {
      if (state.wanted <= 0) return { ok: false, msg: 'No heat to lose.' };
      state.wanted -= 1; state.crew.mira = CREW[0].cooldown;
      state.message = 'Mira swapped the plates — one star down.'; state.messageTimer = 3;
    } else if (id === 'lio') {
      const car = cars.find((c) => c.id === player.carId);
      if (!car) return { ok: false, msg: 'Get in a car first.' };
      car.health = 100; state.crew.lio = CREW[1].cooldown;
      state.message = 'Lio patched the car up — full condition.'; state.messageTimer = 3;
    } else if (id === 'kiki') {
      state.crew.kiki = CREW[2].cooldown; state.crew.kikiUntil = state.elapsed + 20;
      state.message = 'Kiki has eyes out — foot cops marked for 20s.'; state.messageTimer = 3;
    }
    return { ok: true, msg: state.message };
  }
  function cycleWeapon() {
    if (state.weapons.length < 2) return state.weapon;
    const i = state.weapons.indexOf(state.weapon);
    state.ammoByWeapon[state.weapon] = player.ammo;
    state.weapon = state.weapons[(i + 1) % state.weapons.length];
    player.ammo = state.ammoByWeapon[state.weapon] || 0;
    state.message = `Weapon: ${WEAPONS[state.weapon].name}`;
    state.messageTimer = 2;
    return state.weapon;
  }

  function enterCar() {
    if (player.inCar) {
      const car = cars.find((c) => c.id === player.carId);
      player.inCar = false; player.carId = -1;
      player.x = car ? car.x + Math.cos(car.angle + Math.PI / 2) * 70 : player.x;
      player.y = car ? car.y + Math.sin(car.angle + Math.PI / 2) * 70 : player.y;
      return;
    }
    const car = nearestCar(130);
    if (!car) return;
    if (car.traffic) { car.traffic = false; car.parked = false; state.carsStolen += 1; addWanted(1); state.message = 'Car stolen! The owner called it in.'; state.messageTimer = 3; }
    player.inCar = true; player.carId = car.id; car.speed = 0;
  }
  function shoot(aimAngle) {
    if (player.shootCd > 0 || player.inCar) return 0;
    const def = WEAPONS[state.weapon];
    if (player.ammo <= 0) {
      if (player.punchCd > 0) return 0;
      player.punchCd = 0.45;
      const px = player.x + Math.cos(aimAngle) * 60, py = player.y + Math.sin(aimAngle) * 60;
      for (const p of peds) if (p.alive && dist(px, py, p.x, p.y) < 60) { p.health -= 25; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } }
      for (const c of cops) if (dist(px, py, c.x, c.y) < 60) { c.health -= 25; if (c.health <= 0) c.dead = true; addWanted(1); }
      for (const g of gangCars) if (dist(px, py, g.x, g.y) < 60) { g.health -= 25; if (g.health <= 0) gang.destroyCar(state, g, { burst, onGangKill: () => phone.onCarDestroyed(state) }); }
      return EVENT_HIT;
    }
    player.shootCd = def.rate;
    player.ammo -= 1;
    state.ammoByWeapon[state.weapon] = player.ammo;
    state.shotsFired += 1;
    for (let k = 0; k < def.pellets; k += 1) {
      const spread = (random() - 0.5) * 2 * def.spread;
      const a = aimAngle + spread;
      bullets.push({ x: player.x + Math.cos(a) * 36, y: player.y + Math.sin(a) * 36, vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400, life: 0.6, damage: def.damage });
    }
    burst(player.x + Math.cos(aimAngle) * 44, player.y + Math.sin(aimAngle) * 44, '#ffd76a', 4, 200, 40);
    return EVENT_SHOT;
  }

  function updatePlayer(dt, ctrl) {
    if (player.invuln > 0) player.invuln -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.punchCd > 0) player.punchCd -= dt;
    if (ctrl.enter) enterCar();
    if (ctrl.shoot) shoot(ctrl.aimAngle ?? player.angle);
    player.aiming = !!ctrl.shoot;
    if (player.inCar) {
      const car = cars.find((c) => c.id === player.carId);
      if (!car) { player.inCar = false; return; }
      const throttle = ctrl.move.y < 0 ? 1 : ctrl.move.y > 0 ? -0.7 : 0;
      const steer = ctrl.move.x;
      const handbrake = !!ctrl.handbrake;
      const grip = state.weather.raining ? 0.82 : 1;
      const wantBoost = !!ctrl.sprint && state.nitro > 0 && throttle > 0;
      state.boosting = wantBoost;
      if (wantBoost) {
        state.nitro = Math.max(0, state.nitro - NITRO.drain * dt);
        if (state.nitro <= 0) state.boosting = false;
      } else {
        state.nitro = Math.min(NITRO.cap, state.nitro + NITRO.refill * dt);
      }
      const top = CAR.maxSpeed * (state.boosting ? 1 + NITRO.speedBonus : 1);
      const accel = CAR.accel * (state.boosting ? 1 + NITRO.accelBonus : 1);
      if (throttle > 0) car.speed += accel * dt * grip;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed *= Math.pow(0.4, dt);
      if (handbrake) car.speed -= Math.sign(car.speed) * HANDBRAKE.bleed * dt * 0.5;
      car.speed = clamp(car.speed, -CAR.reverse, top);
      const prevAngle = car.angle;
      const turnRate = CAR.turn * grip * (handbrake ? HANDBRAKE.turnMult : 1) * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * turnRate * dt;
      state.yawRate = normAngle(car.angle - prevAngle) / dt;
      if (Math.abs(car.speed) > DRIFT.minSpeed && Math.abs(state.yawRate) > DRIFT.minYaw && steer !== 0) {
        if (!state.drifting) { state.drifting = true; state.driftMult = 1; state.driftScore = 0; }
        state.driftMult = Math.min(DRIFT.maxMult, state.driftMult + dt * 1.2);
      } else if (state.drifting) {
        const pay = Math.round(DRIFT.pay * state.driftMult);
        state.money += pay; state.earnedTotal += pay;
        popup(car.x, car.y, `DRIFT x${state.driftMult.toFixed(1)} +$${pay}`, '#2ecc71');
        state.drifting = false; state.driftMult = 0;
      }
      if (state.boosting && random() < 0.6) {
        particles.push({ x: car.x - Math.cos(car.angle) * 55, y: car.y - Math.sin(car.angle) * 55, z: 26, vx: -Math.cos(car.angle) * 120, vy: -Math.sin(car.angle) * 120, vz: 30, life: 0.35, max: 0.35, color: '#ff7a1a', size: 6 });
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (car.hitCd > 0) car.hitCd -= dt;
      const hit = collideBuildings(nx, ny, 48);
      if (hit.hit) {
        if (Math.abs(car.speed) > 240 && car.hitCd <= 0) { car.health -= 10; car.hitCd = 0.6; burst(car.x, car.y, '#ff9f43', 8, 260, 30); state.message = 'Crash!'; state.messageTimer = 1; }
        car.speed *= -0.25; car.x = hit.x; car.y = hit.y;
      } else { car.x = nx; car.y = ny; }
      car.x = clamp(car.x, 200, WORLD.width - 100); car.y = clamp(car.y, 300, WORLD.height - 100);
      for (const other of cars) {
        if (other === car || other.cop) continue;
        if (dist(car.x, car.y, other.x, other.y) < 95) {
          other.traffic = false; other.speed = 0;
          other.x += (other.x - car.x) * 0.12; other.y += (other.y - car.y) * 0.12;
          car.speed *= 0.85;
          if (car.hitCd <= 0) { car.health -= 4; other.health -= 8; car.hitCd = 0.5; burst(other.x, other.y, '#ffb142', 5, 200, 30); }
        }
      }
      for (const p of peds) {
        if (p.alive && dist(car.x, car.y, p.x, p.y) < 55) {
          p.alive = false; state.pedsHit += 1; addWanted(1); burst(p.x, p.y, '#ff6b6b', 8, 220, 30);
          car.speed *= 0.8;
        }
      }
      for (const other of cars) {
        if (!other.traffic || other === car) continue;
        if (other.nearMissCd > 0) other.nearMissCd -= dt;
        const d = dist(car.x, car.y, other.x, other.y);
        if (other.nearMissCd <= 0 && d > NEAR_MISS.near && d < NEAR_MISS.far && Math.abs(car.speed) > NEAR_MISS.minSpeed) {
          other.nearMissCd = NEAR_MISS.cooldown;
          state.money += NEAR_MISS.pay; state.earnedTotal += NEAR_MISS.pay;
          popup(car.x, car.y, `NEAR MISS +$${NEAR_MISS.pay}`, '#2ecc71');
        }
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = car.speed;
      player.moving = Math.abs(car.speed) > 10;
      if (car.health <= 0) { burst(car.x, car.y, '#ff5722', 24, 360, 40); cars.splice(cars.indexOf(car), 1); player.inCar = false; hurtPlayer(20); player.invuln = 1; }
      return;
    }
    const mv = ctrl.move;
    const len = Math.hypot(mv.x, mv.y) || 1;
    const speed = ctrl.sprint ? PLAYER.sprint : PLAYER.walk;
    player.sprinting = !!ctrl.sprint && (mv.x !== 0 || mv.y !== 0);
    let nx = player.x, ny = player.y;
    if (mv.x || mv.y) {
      nx = player.x + (mv.x / len) * speed * dt;
      ny = player.y + (mv.y / len) * speed * dt;
      player.angle = Math.atan2(mv.y, mv.x);
      player.speed = speed;
      player.moving = true;
      player.walkPhase += dt * (ctrl.sprint ? 5.2 : 4);
    } else { player.speed = 0; player.moving = false; }
    const hit = collideBuildings(nx, ny, PLAYER.radius);
    player.x = clamp(hit.x, 140, WORLD.width - 100); player.y = clamp(hit.y, 300, WORLD.height - 100);
  }

  function updateTraffic(dt) {
    for (const c of cars) {
      if (!c.traffic || c.cop) continue;
      const stepLen = c.speed * dt;
      if (c.vertical) { c.y += (c.angle > 0 ? 1 : -1) * stepLen; if (c.y < 600) c.y = WORLD.height - 300; if (c.y > WORLD.height - 300) c.y = 600; }
      else { c.x += (Math.cos(c.angle) > 0 ? 1 : -1) * stepLen; if (c.x < 1050) c.x = WORLD.width - 200; if (c.x > WORLD.width - 200) c.x = 1050; }
      for (const o of cars) {
        if (o === c || !o.traffic) continue;
        if (c.vertical === o.vertical && Math.abs((c.vertical ? c.x - o.x : c.y - o.y)) < 50) {
          const ahead = c.vertical ? (c.angle > 0 ? o.y - c.y : c.y - o.y) : (Math.cos(c.angle) > 0 ? o.x - c.x : c.x - o.x);
          if (ahead > 0 && ahead < 130) c.speed = Math.max(40, c.speed - 200 * dt);
        }
      }
    }
  }
  function densityKeeper() {
    let nearCars = 0;
    for (const c of cars) if (c.traffic && dist(c.x, c.y, player.x, player.y) < 450) nearCars += 1;
    for (const c of cars) {
      if (!c.traffic) continue;
      const d = dist(c.x, c.y, player.x, player.y);
      if (d > 1600 && nearCars < 8) {
        const road = pick(random, ROADS_V);
        c.x = clamp(player.x + (random() < 0.5 ? -380 : 380), 1050, WORLD.width - 200);
        c.y = clamp(player.y + range(random, -300, 300), 600, WORLD.height - 300);
        c.vertical = random() < 0.5;
        c.road = road;
        c.angle = c.vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
        nearCars += 1;
      }
    }
    let nearPeds = 0;
    for (const p of peds) if (p.alive && dist(p.x, p.y, player.x, player.y) < 200) nearPeds += 1;
    for (const p of peds) {
      if (!p.alive || p.beach) continue;
      const d = dist(p.x, p.y, player.x, player.y);
      if (d > 600 && nearPeds < 10) {
        const side = random() < 0.5 ? -1 : 1;
        const a = player.angle + side * range(random, 1.0, 2.2);
        const r = range(random, 100, 190);
        let nx = clamp(player.x + Math.cos(a) * r, 1050, WORLD.width - 200);
        let ny = clamp(player.y + Math.sin(a) * r, 600, WORLD.height - 300);
        if (onRoad(nx, ny)) {
          // Slide off the asphalt onto the nearest sidewalk strip.
          let bestDx = 1e9, bestRv = null;
          for (const rv of ROADS_V) { const dd = Math.abs(nx - rv); if (dd < bestDx) { bestDx = dd; bestRv = rv; } }
          if (bestDx < 95) nx = bestRv + (nx >= bestRv ? 130 : -130);
          let bestDy = 1e9, bestRh = null;
          for (const rh of ROADS_H) { const dd = Math.abs(ny - rh); if (dd < bestDy) { bestDy = dd; bestRh = rh; } }
          if (bestDy < 95) ny = bestRh + (ny >= bestRh ? 130 : -130);
          nx = clamp(nx, 1050, WORLD.width - 200);
          ny = clamp(ny, 600, WORLD.height - 300);
        }
        p.x = nx; p.y = ny;
        nearPeds += 1;
      }
    }
  }
  function onRoad(x, y) {
    for (const rv of ROADS_V) if (Math.abs(x - rv) < 95) return true;
    for (const rh of ROADS_H) if (Math.abs(y - rh) < 95) return true;
    return false;
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (p.fare) continue;
      // Round 7: the walk cycle advances with the pedestrian's speed —
      // about four steps a second at a normal walk, faster when fleeing —
      // and the rig layer reads walkPhase, moving and hurrying.
      const stepping = p.flee > 0 ? PED_WALK.stepsPerSecond * 1.6 : PED_WALK.stepsPerSecond;
      p.walkPhase = (p.walkPhase || 0) + dt * Math.PI * stepping;
      p.moving = true;
      p.hurrying = p.flee > 0;
      p.change -= dt;
      if (p.flee > 0) {
        p.flee -= dt;
        const a = angleTo(player.x, player.y, p.x, p.y);
        p.x += Math.cos(a) * 150 * dt; p.y += Math.sin(a) * 150 * dt;
      } else {
        if (p.change <= 0) { p.angle = range(random, 0, Math.PI * 2); p.change = range(random, 2, 6); }
        const nx = p.x + Math.cos(p.angle) * p.speed * dt, ny = p.y + Math.sin(p.angle) * p.speed * dt;
        if (onRoad(nx, ny)) { p.angle += Math.PI / 2; p.change = range(random, 1, 3); continue; }
        if (!collideBuildings(nx, ny, 18).hit && nx > 150 && nx < WORLD.width - 100 && ny > 300 && ny < WORLD.height - 100) { p.x = nx; p.y = ny; }
        else p.angle += Math.PI / 2;
      }
    }
  }
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
    let carCops = cops.filter((c) => c.inCar).length;
    while (carCops < wantCars) {
      const car = { id: 900 + cops.length, x: clamp(player.x + (random() < 0.5 ? -700 : 700), 1050, WORLD.width - 200), y: pick(random, ROADS_H), angle: 0, speed: 0, health: 120, color: '#2f6fd0', traffic: false, cop: true, parked: false, vertical: false, road: 0, honk: 0, nearMissCd: 0, hitCd: 0 };
      cars.push(car);
      cops.push({ x: car.x, y: car.y, inCar: true, car, health: 100, dead: false, arrestT: 0 });
      carCops += 1;
    }
    let footCops = cops.filter((c) => !c.inCar && !c.dead).length;
    while (footCops < wantFoot) {
      cops.push({ x: clamp(player.x + range(random, -500, 500), 200, WORLD.width - 100), y: clamp(player.y + range(random, -500, 500), 300, WORLD.height - 100), inCar: false, car: null, health: 60, dead: false, arrestT: 0 });
      footCops += 1;
    }
    if (state.wanted >= 3 && !state.roadblock) {
      const aheadX = player.x + Math.cos(player.angle) * 700;
      const aheadY = player.y + Math.sin(player.angle) * 700;
      const rbCars = [];
      for (let k = 0; k < 2; k += 1) {
        const car = { id: 950 + k, x: clamp(aheadX, 1050, WORLD.width - 200), y: clamp(aheadY + (k === 0 ? -70 : 70), 600, WORLD.height - 300), angle: player.angle + Math.PI / 2, speed: 0, health: 120, color: '#2f6fd0', traffic: false, cop: true, parked: false, vertical: false, road: 0, honk: 0, nearMissCd: 0, hitCd: 0, roadblock: true };
        cars.push(car);
        rbCars.push(car);
      }
      state.roadblock = { cars: rbCars, timer: 20 };
    }
    if (state.roadblock) {
      state.roadblock.timer -= dt;
      if (state.roadblock.timer <= 0 || state.wanted < 3) {
        for (const car of state.roadblock.cars) {
          const idx = cars.indexOf(car);
          if (idx >= 0) cars.splice(idx, 1);
        }
        state.roadblock = null;
      }
    }
    for (const cop of cops) {
      if (cop.dead) continue;
      if (cop.inCar && cop.car) {
        const car = cop.car;
        if (car.roadblock) continue;
        const target = angleTo(car.x, car.y, player.x, player.y);
        car.angle += clamp(normAngle(target - car.angle), -2.4 * dt, 2.4 * dt);
        car.speed = clamp(car.speed + 380 * dt, 0, COP_SPEED.base + state.wanted * COP_SPEED.perStar);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const hit = collideBuildings(nx, ny, 48);
        if (hit.hit) { car.speed *= 0.4; car.angle += 0.6; } else { car.x = nx; car.y = ny; }
        cop.x = car.x; cop.y = car.y;
        if (dist(car.x, car.y, player.x, player.y) < 100) {
          if (player.inCar) {
            const pc = cars.find((c) => c.id === player.carId);
            if (pc) { pc.health -= 8 * dt; pc.speed *= 0.99; burst(player.x, player.y, '#ff5252', 3, 200, 30); }
          } else if (player.invuln <= 0) {
            hurtPlayer(30 * dt); player.invuln = 0.4; cop.arrestT += dt;
            if (cop.arrestT > 1.2) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
          }
        } else cop.arrestT = 0;
      } else {
        const a = angleTo(cop.x, cop.y, player.x, player.y);
        const sp = 200 + state.wanted * 18;
        cop.x += Math.cos(a) * sp * dt; cop.y += Math.sin(a) * sp * dt;
        if (dist(cop.x, cop.y, player.x, player.y) < 45 && !player.inCar && player.invuln <= 0) {
          hurtPlayer(26 * dt); player.invuln = 0.4; cop.arrestT += dt;
          if (cop.arrestT > 1.4) { state.over = 'busted'; state.overReason = 'Busted! The Vice Coast PD caught you.'; }
        } else if (dist(cop.x, cop.y, player.x, player.y) > 100) cop.arrestT = 0;
      }
    }
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.inCar && cop.car && cop.car.health <= 0) {
        burst(cop.car.x, cop.car.y, '#ff5722', 22, 340, 40);
        cars.splice(cars.indexOf(cop.car), 1);
        cops.splice(i, 1);
        phone.onCarDestroyed(state);
        state.message = 'Cop car wrecked!'; state.messageTimer = 2;
      }
    }
    if (state.wanted === 0) {
      for (let i = cops.length - 1; i >= 0; i -= 1) {
        const cop = cops[i];
        if (cop.inCar && cop.car) { cars.splice(cars.indexOf(cop.car), 1); }
        cops.splice(i, 1);
      }
      state.roadblock = null;
    }
    const list = [];
    const carUnits = cops.filter((c) => c.inCar && !c.dead);
    const footUnits = cops.filter((c) => !c.inCar && !c.dead);
    carUnits.forEach((c, i) => list.push({ name: `Unit ${i + 1}`, role: 'Pursuit', dist: Math.round(dist(c.x, c.y, player.x, player.y)), kind: 'car' }));
    footUnits.forEach((c, i) => list.push({ name: `Officer ${i + 1}`, role: 'Foot', dist: Math.round(dist(c.x, c.y, player.x, player.y)), kind: 'foot' }));
    if (state.heli) list.push({ name: 'Air-1', role: 'Helicopter', dist: Math.round(HELI.radius), kind: 'heli' });
    if (state.roadblock) list.push({ name: 'Roadblock', role: 'Blockade', dist: Math.round(dist(state.roadblock.cars[0].x, state.roadblock.cars[0].y, player.x, player.y)), kind: 'block' });
    state.policeList = list;
  }
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || collideBuildings(b.x, b.y, 4).hit;
      if (!dead && b.gang) {
        if (dist(b.x, b.y, player.x, player.y) < 26) {
          if (player.inCar) {
            const pc = cars.find((c) => c.id === player.carId);
            if (pc) pc.health -= 6;
          } else if (player.invuln <= 0) { hurtPlayer(8); player.invuln = 0.3; }
          burst(b.x, b.y, '#ff5252', 4, 160, 30);
          dead = true;
        }
      }
      if (!dead && !b.gang) {
        for (const p of peds) if (p.alive && dist(b.x, b.y, p.x, p.y) < 26) { p.health -= b.damage || 34; p.flee = 3; if (p.health <= 0) { p.alive = false; addWanted(1); } burst(b.x, b.y, '#ff6b6b', 6, 200, 30); state.hitMarker = 0.4; dead = true; break; }
        if (!dead) for (const c of cops) {
          if (c.dead) continue;
          const t = c.inCar && c.car ? c.car : c;
          if (dist(b.x, b.y, t.x, t.y) < (c.inCar ? 55 : 26)) {
            if (c.inCar) c.car.health -= b.damage || 30; else { c.health -= b.damage || 34; if (c.health <= 0) c.dead = true; }
            addWanted(1); burst(b.x, b.y, '#ffd32a', 6, 200, 30); state.hitMarker = 0.4; dead = true; break;
          }
        }
        if (!dead) for (const c of cars) {
          if (c.cop) continue;
          if (dist(b.x, b.y, c.x, c.y) < 55) { c.health -= b.damage || 25; burst(b.x, b.y, '#ffb142', 5, 180, 30); if (c.health <= 0) burst(c.x, c.y, '#ff5722', 16, 300, 40); state.hitMarker = 0.4; dead = true; break; }
        }
        if (!dead) for (const g of gangCars) {
          if (dist(b.x, b.y, g.x, g.y) < 55) {
            g.health -= b.damage || 25; burst(b.x, b.y, '#c084fc', 6, 200, 30); state.hitMarker = 0.4;
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
      if (dist(player.x, player.y, pk.x, pk.y) < 60) {
        pk.active = false;
        if (pk.kind === 'hidden') {
          state.hiddenFound += 1; state.money += 50; state.earnedTotal += 50; state.respect += 2;
          state.message = `Hidden package ${state.hiddenFound}/${state.hiddenTotal} found! +$50`; state.messageTimer = 3;
        } else if (pk.kind === 'cash') { const v = 25 + Math.floor(random() * 50); state.money += v; state.earnedTotal += v; state.message = `+$${v} found!`; state.messageTimer = 2; }
        else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); state.message = 'Health +40'; state.messageTimer = 2; }
        else if (pk.kind === 'ammo') { player.ammo += 24; state.ammoByWeapon[state.weapon] = player.ammo; state.message = 'Ammo +24'; state.messageTimer = 2; }
        else if (pk.kind === 'repair') {
          const car = cars.find((c) => c.id === player.carId);
          if (car) car.health = 100; state.message = 'Car repaired!'; state.messageTimer = 2;
        }
        burst(pk.x, pk.y, '#ffc93c', 10, 220, 30);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function updateRace(dt, ctrl) {
    const race = state.race;
    if (race.cooldown > 0) race.cooldown -= dt;
    if (!race.available && state.missionsDone >= MISSIONS.length) race.available = true;
    if (race.countdown > 0) {
      race.countdown -= dt;
      const car = cars.find((c) => c.id === player.carId);
      if (car) { car.speed = 0; }
      if (race.countdown <= 0) {
        race.active = true;
        state.message = 'GO! Beat the rivals to the pier!';
        state.messageTimer = 3;
      }
      return;
    }
    if (!race.active) return;
    const prog = (player.x - 700) / (10500 - 700);
    for (const r of race.rivals) {
      const band = clamp(prog + (r.offset || 0), 0, 1);
      const targetSpeed = r.top * (1 + clamp(prog - band, -0.1, 0.1));
      r.speed = clamp(r.speed + (targetSpeed - r.speed) * dt, 0, r.top * 1.1);
      r.x += r.speed * dt;
      r.offset = (r.x - 700) / (10500 - 700) - prog;
    }
    const t = RACE_POINTS[race.stage];
    if (t && dist(player.x, player.y, t.x, t.y) < 160) {
      race.stage += 1;
      if (race.stage >= RACE_POINTS.length) {
        const order = race.rivals.map((r) => ({ name: r.name, x: r.x })).concat([{ name: 'YOU', x: player.x }]).sort((a, b) => b.x - a.x);
        const place = order.findIndex((o) => o.name === 'YOU') + 1;
        const pay = [600, 300, 150, 50][place - 1] || 50;
        state.money += pay; state.earnedTotal += pay; state.respect += 10;
        race.active = false; race.finished = true; race.place = place; race.cooldown = 15;
        state.message = `Race over — ${place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : '4th'} place! +$${pay} • Respect +10`;
        state.messageTimer = 5;
        saveGame(state);
      } else {
        state.message = `Checkpoint ${race.stage}/${RACE_POINTS.length}!`;
        state.messageTimer = 2;
      }
    }
  }
  function startRace() {
    const race = state.race;
    if (!race.available || race.active || race.countdown > 0 || race.cooldown > 0) return false;
    if (!player.inCar) return false;
    race.rivals = RACE_RIVALS.map((r, i) => ({ ...r, x: player.x - 120 - i * 60, y: player.y - 90 + i * 90, speed: 0, offset: 0 }));
    race.stage = 0;
    race.countdown = 3.2;
    race.finished = false;
    race.place = 0;
    state.message = 'Street race! 3… 2… 1…';
    state.messageTimer = 3;
    return true;
  }

  function updateMission(dt) {
    const m = state.missionIndex;
    if (m >= MISSIONS.length || state.over) return 0;
    if (TIMED_MISSIONS.includes(m) && state.missionTimer > 0) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.message = 'Too slow — the job fell through. Try again!'; state.messageTimer = 3;
        startMissionFlow(state, m, landmarks, addWanted);
        return 0;
      }
    }
    if (m === 3) {
      if (state.wanted === 0) { completeMission(); return EVENT_MISSION; }
      return 0;
    }
    if (m === 8) {
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
      if (dist(player.x, player.y, turf.x, turf.y) < 200) {
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
    if (dist(player.x, player.y, t.x, t.y) < 140) {
      if (m === 0) { if (state.missionStage === 0) { state.missionStage = 1; state.message = 'Maya is in! Now the Neon Hotel.'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); } else completeMission(); }
      else if (m === 1) {
        if (state.missionStage < 3) { state.missionStage += 1; state.collected += 1; state.message = `Package ${state.collected}/3 collected!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 240, 30); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 2) {
        if (state.missionStage === 0) { state.missionStage = 1; addWanted(2, true); state.message = 'Bag grabbed! Run for the hideout — 2 stars!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 4) {
        if (state.missionStage === 0) { state.missionStage = 1; state.money += 200; state.earnedTotal += 200; addWanted(3, true); state.message = 'Vault loot grabbed! +$200 — escape!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 5) {
        if (state.missionStage < 4) { state.missionStage += 1; state.collected += 1; state.message = `Night drop ${state.collected}/4 collected!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 240, 30); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 6) {
        completeMission();
      } else if (m === 7) {
        if (state.missionStage < 3) { state.missionStage += 1; state.collected += 1; state.message = `Crate ${state.collected}/3 loaded!`; state.messageTimer = 2; burst(t.x, t.y, '#ffc93c', 12, 240, 30); refreshMissionTarget(state, landmarks); }
        else completeMission();
      } else if (m === 9) {
        if (state.missionStage === 0) { state.missionStage = 1; state.message = 'Vault hit! Escape to the Sunset Pier — 5 stars!'; state.messageTimer = 3; refreshMissionTarget(state, landmarks); }
        else completeMission();
      }
      return EVENT_MISSION;
    }
    return 0;
  }

  function step(dt, ctrl, harmless) {
    let events = 0;
    state.elapsed += dt;
    weather.update(dt);
    // Round 7: the shadow rig reads the sun's direction from state so
    // the shadow camera follows the player and the light matches the
    // phase — low from the west at sunset, high at day.
    state.sunDirection = SUN_DIRECTION[state.weather.phase] || SUN_DIRECTION.day;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.missionFlash > 0) state.missionFlash -= dt;
    if (state.districtTimer > 0) state.districtTimer -= dt;
    if (state.hitMarker > 0) state.hitMarker -= dt;
    state.crimeTimer += dt;
    for (const k of ['mira', 'lio', 'kiki']) if (state.crew[k] > 0) state.crew[k] -= dt;
    updateTraffic(dt);
    updatePeds(dt);
    taxi.update(dt, state);
    shop.update(state);
    densityKeeper();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt; pt.vz -= 300 * dt;
      if (pt.z < 0) pt.z = 0;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].life -= dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    if (harmless) {
      state.camera.x = clamp(2400 + Math.sin(state.elapsed * 0.05) * 1400 - 640, 0, WORLD.width - 1280);
      state.camera.y = clamp(3300 - 360, 0, WORLD.height - 720);
      return 0;
    }
    if (state.over) return EVENT_OVER;
    const c = ctrl || { move: { x: 0, y: 0 }, sprint: false, shoot: false, aimAngle: 0, enter: false };
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
    updateRace(dt, c);
    events |= updatePickups(dt);
    events |= updateMission(dt);
    checkRank();
    const d = districtAt(player.x, player.y);
    if (d.name !== state.district) { state.district = d.name; state.districtTimer = 3; }
    const copNear = cops.some((cop) => !cop.dead && dist(cop.x, cop.y, player.x, player.y) < HIDE_RADIUS);
    if (state.wanted > 0 && !copNear && state.crimeTimer > 4) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED_DECAY) { state.wanted -= 1; state.wantedTimer = 0; state.message = state.wanted === 0 ? 'Heat is off. You are clean.' : `Wanted down to ${state.wanted} stars.`; state.messageTimer = 3; }
    } else state.wantedTimer = 0;
    state.saveTimer -= dt;
    if (state.saveTimer <= 0) { state.saveTimer = 30; saveGame(state); }
    if (player.health <= 0) { state.over = 'wasted'; state.overReason = 'Wasted! Vice Coast claimed another one.'; events |= EVENT_OVER; }
    if (state.over) events |= EVENT_OVER;
    state.camera.x = clamp(player.x - 640, 0, WORLD.width - 1280);
    state.camera.y = clamp(player.y - 360, 0, WORLD.height - 720);
    return events;
  }

  reset();
  return {
    state, reset, step, addWanted, enterCar, shoot, startMission, completeMission, continueSave, nearestCar,
    useCrew, cycleWeapon, startRace, rankName,
    weather, gang, shop, phone,
    debugWin() {
      state.money = 9650; state.earnedTotal = 9650; state.missionsDone = 10; state.missionIndex = 10;
      state.wanted = 0; state.missionText = 'Vice Coast is yours!'; state.missionTarget = null;
      state.message = ''; state.messageTimer = 0; state.race.available = true;
      const car = cars.find((x) => x.id === player.carId);
      if (car) car.speed = 0;
      winGame();
    },
    debugChase() { player.x = 8300; player.y = 2300; addWanted(3, true); },
  };
}
