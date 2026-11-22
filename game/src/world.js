// The world of Vice Coast: the city, the traffic, the people, the police,
// the missions and the money. This is the simulation; render3d.js only
// draws what this file decides, and hud.js only shows it.
import { CFG, LANDMARKS, RANKS, WEAPON_STATS, districtAt } from './config.js';
import { makeRng, hashSeed } from './random.js';
import { createWeather } from './weather.js';
import { createTaxi } from './taxi.js';
import { createPhone } from './phone.js';
import { createGangCars, TURF } from './gang.js';
import { MISSIONS, STORY_TOTAL, currentStage } from './missions.js';
import { createDirector, roadXs, roadYs } from './director.js';
import { saveGame } from './save.js';
import { buyItem } from './shop.js';

// How many buildings of each type the city holds. The total is 405.
const TYPE_QUOTAS = {
  house: 117,
  shophouse: 102,
  office: 53,
  tower: 47,
  restaurant: 37,
  hotel: 23,
  warehouse: 21,
  gas: 5,
};
const TYPE_ORDER = ['house', 'shophouse', 'office', 'tower', 'restaurant', 'hotel', 'warehouse', 'gas'];

// Size and height ranges per type, in world units.
const TYPE_DIMS = {
  house: { w: [130, 190], h: [110, 170], floors: [1, 2], ht: [64, 92] },
  shophouse: { w: [140, 200], h: [120, 180], floors: [2, 3], ht: [86, 128] },
  office: { w: [180, 250], h: [160, 230], floors: [6, 12], ht: [170, 320] },
  tower: { w: [200, 260], h: [180, 240], floors: [12, 20], ht: [312, 520] },
  restaurant: { w: [150, 210], h: [130, 180], floors: [1, 2], ht: [72, 110] },
  hotel: { w: [190, 250], h: [170, 230], floors: [6, 10], ht: [168, 272] },
  warehouse: { w: [220, 300], h: [180, 250], floors: [1, 1], ht: [62, 92] },
  gas: { w: [160, 200], h: [130, 160], floors: [1, 1], ht: [44, 58] },
};

const ACCENTS = ['#d84a4a', '#4a7ad8', '#e8c84a', '#4ad87a', '#9a4ad8', '#e87a4a', '#4ad8d8', '#c9c9c9'];
const SIGN_TEXTS = {
  restaurant: ['PIZZA', 'TACOS', 'BURGER', 'CAFE', 'NOODLES', 'BBQ'],
  hotel: ['HOTEL', 'MOTEL', 'SUITES', 'INN'],
  gas: ['GAS', 'FUEL', '24H'],
  shophouse: ['SHOP', 'BAR', 'NEON', 'OPEN', 'MART', 'CLUB'],
};
const CAR_COLORS = [0xd84a4a, 0x4a7ad8, 0xe8c84a, 0xe8e8e8, 0x222222, 0x4ad87a, 0x9a4ad8, 0xe87a4a, 0x2a8a8a, 0x8a5a2a];

// The hidden packages: ten of them, tucked beside landmarks.
const HIDDEN_SPOTS = [
  { x: 420, y: 3180 }, { x: 9120, y: 1320 }, { x: 9680, y: 5280 },
  { x: 5320, y: 1920 }, { x: 4320, y: 4680 }, { x: 8720, y: 2720 },
  { x: 2400, y: 1020 }, { x: 6800, y: 4300 }, { x: 1500, y: 5400 },
  { x: 10300, y: 900 },
];

// True when a point is inside any building, with a margin.
function pointInBuildings(buildings, x, y, margin) {
  for (const b of buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) {
      return true;
    }
  }
  return false;
}

// Build the city deterministically: 405 buildings in 8 types, 138 pitched
// roofs, 125 name signs, 39 parks, 17 vertical and 13 horizontal roads.
function buildCity(rng) {
  const buildings = [];
  // A shuffled deck of type labels, exactly the quotas.
  const deck = [];
  for (const t of TYPE_ORDER) {
    for (let i = 0; i < TYPE_QUOTAS[t]; i += 1) deck.push(t);
  }
  const shuffled = rng.shuffle(deck);
  let typeCursor = 0;
  let shophousePitched = 0;
  let shophouseSigns = 0;

  // Blocks sit between the roads: 16 columns by 12 rows.
  const blocks = [];
  for (let i = 0; i < CFG.V_ROADS - 1; i += 1) {
    for (let j = 0; j < CFG.H_ROADS - 1; j += 1) {
      blocks.push({ i, j });
    }
  }
  const shuffledBlocks = rng.shuffle(blocks);
  // The first 21 blocks in shuffled order get a third building.
  const extraBlocks = new Set(shuffledBlocks.slice(0, 21).map((b) => `${b.i},${b.j}`));

  function placeBuilding(block, slot) {
    const type = shuffled[typeCursor % shuffled.length];
    typeCursor += 1;
    const dims = TYPE_DIMS[type];
    const x0 = CFG.V_ROAD_X0 + block.i * CFG.V_ROAD_DX + CFG.ROAD_W / 2 + 6;
    const x1 = CFG.V_ROAD_X0 + (block.i + 1) * CFG.V_ROAD_DX - CFG.ROAD_W / 2 - 6;
    const y0 = CFG.H_ROAD_Y0 + block.j * CFG.H_ROAD_DY + CFG.ROAD_W / 2 + 6;
    const y1 = CFG.H_ROAD_Y0 + (block.j + 1) * CFG.H_ROAD_DY - CFG.ROAD_W / 2 - 6;
    const w = Math.min(rng.range(dims.w[0], dims.w[1]), (x1 - x0) / 2 - 16);
    const h = Math.min(rng.range(dims.h[0], dims.h[1]), (y1 - y0) - 16);
    let x;
    let y;
    if (slot === 0) {
      x = x0 + 8;
      y = y0 + 8;
    } else if (slot === 1) {
      x = x1 - w - 8;
      y = y0 + 8;
    } else {
      x = x0 + (x1 - x0 - w) / 2;
      y = y1 - h - 8;
    }
    const floors = rng.int(dims.floors[0], dims.floors[1]);
    const ht = rng.range(dims.ht[0], dims.ht[1]);
    // Pitched roofs: every house, plus the first 21 shophouses — 138.
    let pitched = false;
    if (type === 'house') pitched = true;
    else if (type === 'shophouse' && shophousePitched < 21) {
      pitched = true;
      shophousePitched += 1;
    }
    const b = {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
      ht: Math.round(ht),
      type,
      floors,
      pitched,
      accent: rng.pick(ACCENTS),
      variant: rng.int(0, 2),
      seed: rng.int(0, 99999),
    };
    buildings.push(b);
    return b;
  }

  for (const block of blocks) {
    placeBuilding(block, 0);
    placeBuilding(block, 1);
    if (extraBlocks.has(`${block.i},${block.j}`)) placeBuilding(block, 2);
  }

  // Name signs: every restaurant, hotel and gas station, plus the first
  // 60 shophouses — 125 in all.
  const signs = [];
  for (const b of buildings) {
    let text = null;
    if (b.type === 'restaurant' || b.type === 'hotel' || b.type === 'gas') {
      text = rng.pick(SIGN_TEXTS[b.type]);
    } else if (b.type === 'shophouse' && shophouseSigns < 60) {
      text = rng.pick(SIGN_TEXTS.shophouse);
      shophouseSigns += 1;
    }
    if (text) {
      signs.push({
        x: b.x + b.w / 2,
        y: b.y + b.h + 4,
        text,
        color: b.accent,
        type: b.type,
      });
    }
  }

  // Parks: 39 small green plots in the bottom-left corner of blocks.
  const parks = [];
  let parkCount = 0;
  for (const block of shuffledBlocks) {
    if (parkCount >= 39) break;
    if ((block.i * 7 + block.j * 3) % 5 !== 0) continue;
    const x0 = CFG.V_ROAD_X0 + block.i * CFG.V_ROAD_DX + CFG.ROAD_W / 2 + 6;
    const y1 = CFG.H_ROAD_Y0 + (block.j + 1) * CFG.H_ROAD_DY - CFG.ROAD_W / 2 - 6;
    const trees = [];
    const nTrees = rng.int(3, 5);
    for (let t = 0; t < nTrees; t += 1) {
      trees.push({ x: x0 + 12 + rng.range(0, 90), y: y1 - 12 - rng.range(0, 70) });
    }
    parks.push({ x: x0 + 4, y: y1 - 100, w: 120, h: 92, trees });
    parkCount += 1;
  }

  return { buildings, signs, parks };
}

// ---------------------------------------------------------------- state

export function createWorld(audio) {
  const rng = makeRng(31);
  const city = buildCity(rng);
  const weather = createWeather();

  const state = {
    time: 0,
    seed: 31,
    buildings: city.buildings,
    signs: city.signs,
    parks: city.parks,
    cars: [],
    peds: [],
    cops: [],
    gangCars: createGangCars(rng),
    gang: { kills: 0 },
    heli: null,
    roadblock: null,
    bullets: [],
    pickups: HIDDEN_SPOTS.map((s, i) => ({ id: i, kind: 'hidden', x: s.x, y: s.y, active: true })),
    hiddenTotal: HIDDEN_SPOTS.length,
    player: {
      x: 1300, y: 3300, angle: Math.PI, speed: 0,
      inCar: false, carId: -1,
      health: 100, armor: 0, ammo: WEAPON_STATS.pistol.ammo,
      walkPhase: 0, punchCd: 0, fireCd: 0,
    },
    wanted: 0,
    hiddenTimer: 0,
    nitro: 100,
    boosting: false,
    money: 0,
    earnedTotal: 0,
    respect: 0,
    rankIndex: 0,
    weapons: ['pistol'],
    weapon: 'pistol',
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    missionTarget: null,
    missionText: '',
    missionsDone: 0,
    holdTimer: 0,
    gangMissionKills: 0,
    over: null,
    weather: { phase: 'day', t: weather.t, raining: false },
    sunDirection: { x: -0.4, y: 0.35, z: 0.8 },
    taxi: createTaxi(),
    phone: createPhone(),
    shop: { open: false },
    race: { available: false },
    crewCooldowns: { mira: 0, dex: 0, luna: 0 },
    banner: null,
    dialogue: null,
    district: 'Beach',
    nearMissCd: 0,
    driftTime: 0,
    cameraPos: { x: 1100, y: 3300, z: 80 },
  };

  const dir = createDirector(state);
  state.director = dir;

  // Traffic: 34 moving cars on the roads, 14 parked at the roadside.
  const xs = roadXs();
  const ys = roadYs();
  for (let i = 0; i < CFG.TRAFFIC_CARS; i += 1) {
    const vertical = rng.chance(0.55);
    let x;
    let y;
    let angle;
    if (vertical) {
      x = rng.pick(xs) + rng.pick([-28, 28]);
      y = rng.range(400, CFG.WORLD_H - 400);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rng.range(800, CFG.WORLD_W - 400);
      y = rng.pick(ys) + rng.pick([-28, 28]);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    state.cars.push({
      id: i, x: Math.round(x), y: Math.round(y), angle,
      speed: rng.range(120, 220), health: 100,
      traffic: true, parked: false, repo: false,
      color: rng.pick(CAR_COLORS),
      kind: rng.pick(['sedan', 'sedan', 'taxi', 'van']),
      lane: vertical ? 'v' : 'h',
    });
  }
  for (let i = 0; i < CFG.PARKED_CARS; i += 1) {
    const vertical = rng.chance(0.5);
    let x;
    let y;
    let angle;
    if (vertical) {
      // Parked in the curb lane of the road, clear of the building line
      // (buildings start 54 units from the road centre; the car is 44
      // wide, so 34 keeps it on the road and out of the walls).
      x = rng.pick(xs) + rng.pick([-34, 34]);
      y = rng.range(500, CFG.WORLD_H - 500);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rng.range(900, CFG.WORLD_W - 500);
      y = rng.pick(ys) + rng.pick([-34, 34]);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    state.cars.push({
      id: CFG.TRAFFIC_CARS + i, x: Math.round(x), y: Math.round(y), angle,
      speed: 0, health: 100,
      traffic: false, parked: true, repo: false,
      color: rng.pick(CAR_COLORS),
      kind: rng.pick(['sedan', 'sedan', 'van', 'sport']),
      lane: vertical ? 'v' : 'h',
    });
  }

  // Pedestrians: 60 on the sidewalks, 6 beachgoers on the sand.
  for (let i = 0; i < CFG.PEDS; i += 1) {
    const vertical = rng.chance(0.5);
    let x;
    let y;
    if (vertical) {
      x = rng.pick(xs) + rng.pick([-68, 68]);
      y = rng.range(400, CFG.WORLD_H - 400);
    } else {
      x = rng.range(800, CFG.WORLD_W - 400);
      y = rng.pick(ys) + rng.pick([-68, 68]);
    }
    state.peds.push(makePed(rng, i, x, y, false));
  }
  for (let i = 0; i < CFG.BEACHGOERS; i += 1) {
    const x = rng.range(120, 520);
    const y = rng.range(800, 5800);
    state.peds.push(makePed(rng, CFG.PEDS + i, x, y, true));
  }

  function makePed(rngFn, id, x, y, beach) {
    // Look data, from the pedestrian rig module's palette.
    const skins = [0xe8b88a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0x6e4426];
    const shirts = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8c84a, 0x9a4ad8, 0xe8e8e8, 0x222222, 0xe87a4a, 0x4ad8d8, 0xd84a9a];
    const trousers = [0x2a3a5a, 0x3a3a3a, 0x5a3a2a, 0x2a5a3a, 0x6a6a6a, 0x1a1a2a];
    const hairs = [0x1a1a1a, 0x4a2a1a, 0x8a6a3a, 0xaaaaaa, 0x6a1a1a];
    const hatRoll = rngFn.f();
    return {
      id,
      x: Math.round(x), y: Math.round(y),
      angle: rngFn.range(0, Math.PI * 2),
      speed: beach ? rngFn.range(20, 45) : rngFn.range(38, 72),
      alive: true,
      beach,
      height: beach ? rngFn.range(88, 104) : rngFn.range(84, 108),
      build: rngFn.pick(['slim', 'average', 'average', 'heavy']),
      walkPhase: rngFn.range(0, Math.PI * 2),
      shirt: rngFn.pick(shirts),
      trousers: beach ? rngFn.pick([0xe84a6a, 0x4ad8d8, 0xe8c84a, 0xd84a4a]) : rngFn.pick(trousers),
      skin: rngFn.pick(skins),
      hair: rngFn.pick(hairs),
      hat: hatRoll < 0.16 ? 'cap' : hatRoll < 0.26 ? 'beanie' : null,
      hatColor: rngFn.pick([0xd84a4a, 0x4a7ad8, 0xe8c84a, 0x222222]),
      // Sidewalk wandering state.
      wanderT: rngFn.range(0, 4),
    };
  }

  // ------------------------------------------------------------ missions

  function setTargetFromStage() {
    const stage = currentStage(state);
    if (!stage) {
      state.missionTarget = null;
      return;
    }
    if (stage.kind === 'goto') {
      state.missionTarget = { x: stage.x, y: stage.y, label: stage.label };
    } else if (stage.kind === 'torch') {
      state.missionTarget = {
        x: TURF.x, y: TURF.y,
        label: `Torch 3 rival gang cars (${state.gangMissionKills}/3)`,
      };
    } else if (stage.kind === 'hold') {
      state.missionTarget = { x: stage.x, y: stage.y, label: stage.label };
    } else if (stage.kind === 'hide') {
      state.missionTarget = { x: state.player.x, y: state.player.y, label: stage.label };
    }
    const m = MISSIONS[state.missionIndex];
    state.missionText = m ? `${m.name}: ${state.missionTarget.label}` : '';
  }

  function startMission(index) {
    state.missionIndex = index;
    state.missionStage = 0;
    state.holdTimer = 0;
    state.gangMissionKills = 0;
    const m = MISSIONS[index];
    if (!m) {
      state.missionTarget = null;
      state.missionText = '';
      return;
    }
    state.missionTimer = m.timer || 0;
    if (m.startWanted) {
      state.wanted = m.startWanted;
      ensurePolice();
    }
    setTargetFromStage();
    state.dialogue = { name: 'Maya', text: m.briefing, until: state.time + 7 };
    state.banner = { title: m.name, text: m.briefing, until: state.time + 5 };
    if (audio) audio.mission();
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    if (!m) return;
    state.money += m.pay;
    state.earnedTotal += m.pay;
    state.missionsDone += 1;
    state.banner = { title: 'Mission Complete', text: `${m.name} — +$${m.pay}`, until: state.time + 4 };
    if (audio) audio.cash();
    saveGame(state);
    if (state.missionIndex >= MISSIONS.length - 1) {
      state.over = 'win';
      state.race.available = true;
      if (audio) audio.win();
      return;
    }
    startMission(state.missionIndex + 1);
  }

  function advanceStage() {
    const m = MISSIONS[state.missionIndex];
    if (!m) return;
    state.missionStage += 1;
    if (state.missionStage >= m.stages.length) {
      completeMission();
      return;
    }
    state.holdTimer = 0;
    setTargetFromStage();
    if (audio) audio.pickup();
  }

  // ------------------------------------------------------------- police

  function ensurePolice() {
    // Cop cars: one per wanted star plus one, up to six; foot cops: one per star.
    const wantCars = Math.min(1 + state.wanted, 6);
    const haveCars = state.cops.filter((c) => c.inCar).length;
    for (let i = haveCars; i < wantCars; i += 1) {
      const spot = dir.aheadPoint(300 + i * 90, i % 2 === 0 ? -26 : 26);
      state.cops.push({
        id: 2000 + state.cops.length,
        x: spot.x, y: spot.y,
        angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x),
        speed: 0, health: 60, inCar: true, ramCd: 0, color: 0xf0f0f0,
      });
    }
    const haveFoot = state.cops.filter((c) => !c.inCar).length;
    for (let i = haveFoot; i < state.wanted; i += 1) {
      state.cops.push({
        id: 3000 + state.cops.length,
        x: state.player.x + (i % 2 === 0 ? 160 : -160),
        y: state.player.y + 120,
        angle: 0, speed: 0, health: 40, inCar: false, ramCd: 0,
      });
    }
    // The helicopter goes up at four stars.
    if (state.wanted >= CFG.HELI_MIN_STARS && !state.heli) {
      state.heli = {
        x: state.player.x + CFG.HELI_ORBIT, y: state.player.y,
        z: CFG.HELI_HEIGHT, orbitAngle: 0,
        lightX: state.player.x, lightY: state.player.y,
        spotIntensity: 0.55, spotAngle: 0.32, groundLux: 0.42,
      };
      if (audio) audio.siren();
    }
    if (state.wanted >= 3 && !state.roadblock) {
      const spot = dir.aheadPoint(420, 0);
      state.roadblock = { x: spot.x, y: spot.y, angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x) };
    }
  }

  function addWanted(n) {
    state.wanted = Math.min(5, state.wanted + n);
    state.hiddenTimer = 0;
    ensurePolice();
  }

  function useCrew(id) {
    const cd = state.crewCooldowns[id] || 0;
    if (cd > 0) return state.wanted;
    if (id === 'mira') {
      if (state.wanted > 0) {
        state.wanted -= 1;
        state.crewCooldowns.mira = 45;
        state.banner = { title: 'Mira', text: 'Smooth talker — one star gone.', until: state.time + 3 };
        if (state.wanted < CFG.HELI_MIN_STARS) state.heli = null;
      }
    } else if (id === 'dex') {
      state.nitro = 100;
      state.crewCooldowns.dex = 40;
      state.banner = { title: 'Dex', text: 'Wheelman — nitro refilled.', until: state.time + 3 };
    } else if (id === 'luna') {
      state.crewCooldowns.luna = 30;
      state.dialogue = { name: 'Luna', text: state.missionTarget ? `Target: ${state.missionTarget.label}` : 'No active target.', until: state.time + 5 };
    }
    return state.wanted;
  }

  // ------------------------------------------------------------ shooting

  function shoot(angle) {
    const p = state.player;
    if (p.fireCd > 0) return false;
    const stats = WEAPON_STATS[state.weapon] || WEAPON_STATS.pistol;
    if (p.ammo > 0) {
      p.fireCd = stats.rate;
      p.ammo -= 1;
      p.angle = angle;
      const pellets = stats.pellets || 1;
      for (let i = 0; i < pellets; i += 1) {
        const spread = pellets > 1 ? (i - (pellets - 1) / 2) * 0.06 : 0;
        state.bullets.push({
          x: p.x + Math.cos(angle) * 40,
          y: p.y + Math.sin(angle) * 40,
          angle: angle + spread,
          speed: 950,
          life: stats.range / 950,
          damage: stats.damage,
        });
      }
      if (audio) audio.shoot();
      return true;
    }
    // No ammo: a punch. It only lands up close, and only when the
    // cooldown has run out.
    if (p.punchCd > 0) return false;
    p.punchCd = 0.4;
    p.angle = angle;
    let hitAny = false;
    for (const target of [...state.gangCars, ...state.cops]) {
      if (target.alive === false) continue;
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (d < 80) {
        damageTarget(target, 25);
        hitAny = true;
      }
    }
    if (hitAny) {
      state.hitMarker = 0.3;
      if (audio) audio.hit();
    }
    return hitAny;
  }

  function damageTarget(target, dmg) {
    target.health -= dmg;
    state.hitMarker = 0.3;
    if (target.health > 0) return;
    if (state.gangCars.includes(target)) {
      target.alive = false;
      target.wreckTimer = 30;
      state.gang.kills += 1;
      state.respect += 5;
      if (state.missionIndex === 8 && state.missionStage === 0) {
        state.gangMissionKills += 1;
        setTargetFromStage();
      }
      state.banner = { title: 'Gang car torched', text: `Respect +5 (total ${state.respect})`, until: state.time + 3 };
      if (audio) audio.cash();
    } else if (state.cops.includes(target)) {
      target.health = 0;
      // A wrecked cop car is towed away.
      state.cops = state.cops.filter((c) => c !== target);
    }
  }

  // ------------------------------------------------------- car entry/exit

  function enterExitCar() {
    const p = state.player;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      p.inCar = false;
      p.carId = -1;
      if (car) {
        p.x = car.x - Math.cos(car.angle) * 60;
        p.y = car.y - Math.sin(car.angle) * 60;
        p.angle = car.angle;
        car.speed = 0;
      }
      if (state.taxi.active) state.taxi.cancel();
      return false;
    }
    let best = null;
    let bestD = 110;
    for (const car of state.cars) {
      if (car.health <= 0) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return false;
    best.traffic = false;
    best.parked = false;
    p.inCar = true;
    p.carId = best.id;
    p.x = best.x;
    p.y = best.y;
    p.angle = best.angle;
    return true;
  }

  // ---------------------------------------------------------------- step

  // One step of the simulation. Under software rendering a frame can
  // take half a second, so a big dt is split into substeps of at most
  // 1/30s: game time then tracks wall time even at 2 fps, and nothing
  // moves far enough in one substep to tunnel through a building.
  function step(dt, input, isTouch) {
    if (state.over) {
      // The run is over; the world still renders but nothing moves.
      return;
    }
    dt = Math.min(dt, 0.5);
    const n = Math.max(1, Math.ceil(dt / (1 / 30)));
    const sub = dt / n;
    for (let i = 0; i < n; i += 1) stepOnce(sub, input, isTouch);
  }

  function stepOnce(dt, input, isTouch) {
    state.time += dt;
    const p = state.player;
    const mv = (input && input.move) || { x: 0, y: 0 };
    const nitroHeld = !!(input && input.nitro);
    const brakeHeld = !!(input && input.handbrake);
    const shootHeld = !!(input && input.shoot);

    // The clock runs: a full day is 240 seconds.
    weather.advance(dt);
    const phase = weather.phase();
    state.weather.phase = phase;
    state.weather.t = weather.t;
    state.weather.raining = weather.raining;
    state.sunDirection = weather.sunDirection();
    state.district = districtAt(p.x, p.y);

    // Cooldowns tick down.
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.punchCd = Math.max(0, p.punchCd - dt);
    state.hitMarker = Math.max(0, (state.hitMarker || 0) - dt);
    state.nearMissCd = Math.max(0, state.nearMissCd - dt);
    for (const k of Object.keys(state.crewCooldowns)) {
      state.crewCooldowns[k] = Math.max(0, state.crewCooldowns[k] - dt);
    }
    if (state.banner && state.time > state.banner.until) state.banner = null;
    if (state.dialogue && state.time > state.dialogue.until) state.dialogue = null;

    // ---------------------------------------------------------- the player
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) {
        const top = CFG.CAR_TOP_SPEED * (state.boosting ? CFG.NITRO_MULT : 1);
        if (mv.y > 0) car.speed = Math.min(top, car.speed + CFG.CAR_ACCEL * dt);
        else if (mv.y < 0) {
          if (car.speed > 10) car.speed = Math.max(0, car.speed - CFG.CAR_BRAKE * dt);
          else car.speed = Math.max(-CFG.CAR_REVERSE, car.speed - CFG.CAR_ACCEL * 0.6 * dt);
        } else {
          car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
        }
        // Nitro: Shift while moving, while the tank has anything in it.
        const wantBoost = nitroHeld && car.speed > 60 && state.nitro > 0;
        state.boosting = wantBoost;
        if (wantBoost) state.nitro = Math.max(0, state.nitro - CFG.NITRO_DRAIN * dt);
        else state.nitro = Math.min(100, state.nitro + CFG.NITRO_REGEN * dt);
        // Steering, sharper at low speed, with a drift slide on the
        // handbrake.
        const steer = mv.x;
        const speedF = Math.min(1, Math.abs(car.speed) / 180);
        const turnRate = CFG.CAR_TURN * speedF * (brakeHeld ? 1.7 : 1);
        car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
        if (brakeHeld && Math.abs(car.speed) > 150 && steer !== 0) {
          state.driftTime += dt;
          if (state.driftTime > 1) {
            state.driftTime = 0;
            state.money += 5;
            state.earnedTotal += 5;
            state.banner = { title: 'DRIFT +$5', text: '', until: state.time + 1.2 };
          }
        } else {
          state.driftTime = 0;
        }
        // Move, sliding along building walls instead of stopping dead.
        // The margin is the car's half-width: a car in the curb lane
        // clears the building line by a couple of units.
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        if (!pointInBuildings(state.buildings, nx, car.y, 18)) car.x = nx;
        else car.speed *= 0.5;
        if (!pointInBuildings(state.buildings, car.x, ny, 18)) car.y = ny;
        else car.speed *= 0.5;
        car.x = Math.max(40, Math.min(CFG.WORLD_W - 40, car.x));
        car.y = Math.max(40, Math.min(CFG.WORLD_H - 40, car.y));
        p.x = car.x;
        p.y = car.y;
        p.angle = car.angle;
        p.speed = car.speed;
        // Near misses: fast, close, no contact.
        if (Math.abs(car.speed) > 200 && state.nearMissCd <= 0) {
          for (const other of state.cars) {
            if (other === car || !other.traffic) continue;
            const d = Math.hypot(other.x - car.x, other.y - car.y);
            if (d > 45 && d < 95) {
              state.money += CFG.NEAR_MISS_PAY;
              state.earnedTotal += CFG.NEAR_MISS_PAY;
              state.banner = { title: `NEAR MISS +$${CFG.NEAR_MISS_PAY}`, text: '', until: state.time + 1.2 };
              state.nearMissCd = 2;
              if (audio) audio.cash();
              break;
            }
          }
        }
        // Bumping traffic cars slows both down — but only while the
        // player is actually driving, and at most once per short
        // cooldown. A parked car being brushed by passing traffic is
        // not wrecked by it, and the damage never fires once per
        // substep (that wrecked cars in a single frame).
        car.bumpCd = Math.max(0, (car.bumpCd || 0) - dt);
        if (Math.abs(car.speed) > 60 && car.bumpCd <= 0) {
          for (const other of state.cars) {
            if (other === car || !other.traffic) continue;
            const d = Math.hypot(other.x - car.x, other.y - car.y);
            if (d < 52 && d > 0.01) {
              car.bumpCd = 0.7;
              car.speed *= 0.6;
              other.speed *= 0.7;
              car.health = Math.max(0, car.health - 2);
              if (car.health <= 0) {
                p.inCar = false;
                p.carId = -1;
                p.health = Math.max(1, p.health - 20);
                p.x = car.x - 70;
                p.y = car.y;
                state.banner = { title: 'Car wrecked', text: 'Your ride is done.', until: state.time + 3 };
              }
              break;
            }
          }
        }
        if (audio) audio.engine(Math.min(1, Math.abs(car.speed) / CFG.CAR_TOP_SPEED));
      }
    } else {
      // On foot: WASD moves in world directions, the player faces where
      // they walk, Shift sprints.
      const sprint = nitroHeld;
      const speed = sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
      const moving = mv.x !== 0 || mv.y !== 0;
      if (moving) {
        const len = Math.hypot(mv.x, mv.y) || 1;
        const dx = (mv.x / len) * speed * dt;
        const dy = (mv.y / len) * speed * dt;
        p.angle = Math.atan2(mv.y, mv.x);
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (!pointInBuildings(state.buildings, nx, p.y, 14)) p.x = nx;
        if (!pointInBuildings(state.buildings, p.x, ny, 14)) p.y = ny;
        p.x = Math.max(30, Math.min(CFG.WORLD_W - 30, p.x));
        p.y = Math.max(30, Math.min(CFG.WORLD_H - 30, p.y));
        p.speed = speed;
        // About four steps a second at a walk, quicker at a sprint.
        p.walkPhase += dt * CFG.WALK_STEPS_PER_SEC * Math.PI * (sprint ? 1.5 : 1);
      } else {
        p.speed = 0;
      }
      // Shooting on foot: J, or the touch shoot button.
      if (shootHeld) shoot(p.angle);
      if (audio) audio.engineOff();
    }

    // ----------------------------------------------------------- traffic
    for (const car of state.cars) {
      if (!car.traffic) continue;
      if (car.lane === 'v') {
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (car.y > CFG.WORLD_H - 200) car.y = 400;
        if (car.y < 400) car.y = CFG.WORLD_H - 200;
      } else {
        car.x += Math.cos(car.angle) * car.speed * dt;
        if (car.x > CFG.WORLD_W - 200) car.x = 800;
        if (car.x < 800) car.x = CFG.WORLD_W - 200;
      }
    }

    // -------------------------------------------------------- pedestrians
    for (const pd of state.peds) {
      if (!pd.alive) continue;
      pd.wanderT -= dt;
      if (pd.wanderT <= 0) {
        pd.wanderT = 3 + Math.random() * 4;
        if (!pd.beach) {
          // Pedestrians walk along the roads and turn at random.
          pd.angle = Math.round(pd.angle / (Math.PI / 2)) * (Math.PI / 2) + (Math.random() < 0.5 ? 0 : Math.PI / 2);
        } else {
          pd.angle = Math.random() * Math.PI * 2;
        }
      }
      const nx = pd.x + Math.cos(pd.angle) * pd.speed * dt;
      const ny = pd.y + Math.sin(pd.angle) * pd.speed * dt;
      if (pd.beach) {
        pd.x = Math.max(60, Math.min(CFG.BEACH_W - 40, nx));
        pd.y = Math.max(200, Math.min(CFG.WORLD_H - 200, ny));
      } else if (!pointInBuildings(state.buildings, nx, ny, 12)) {
        pd.x = nx;
        pd.y = ny;
      } else {
        pd.angle += Math.PI / 2;
      }
      pd.walkPhase += dt * CFG.WALK_STEPS_PER_SEC * Math.PI;
    }

    // ------------------------------------------------------------- police
    // No heat, no cops: they leave once the wanted level is gone.
    if (state.wanted === 0 && state.cops.length > 0) state.cops = [];
    const topCop = CFG.COP_TOP_SPEED + CFG.COP_PER_STAR * state.wanted;
    for (const cop of state.cops) {
      cop.ramCd = Math.max(0, (cop.ramCd || 0) - dt);
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      if (cop.inCar) {
        // Cop cars chase and ram.
        const want = Math.atan2(p.y - cop.y, p.x - cop.x);
        let diff = want - cop.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
        cop.speed = Math.min(topCop, cop.speed + 300 * dt);
        const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
        const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
        if (!pointInBuildings(state.buildings, nx, cop.y, 26)) cop.x = nx;
        if (!pointInBuildings(state.buildings, cop.x, ny, 26)) cop.y = ny;
        if (d < 64 && cop.ramCd <= 0) {
          cop.ramCd = 0.8;
          cop.speed *= 0.4;
          if (p.inCar) {
            const car = state.cars.find((c) => c.id === p.carId);
            if (car) {
              car.health = Math.max(0, car.health - 8);
              car.speed *= 0.7;
              if (car.health <= 0) {
                p.inCar = false;
                p.carId = -1;
                p.health = Math.max(1, p.health - 20);
                p.x = car.x - 70;
                p.y = car.y;
              }
            }
          } else {
            // A ram on foot hurts, but it does not one-shot the player:
            // the armour takes the first bite.
            p.health = Math.max(0, p.health - 3);
            if (p.armor > 0) p.armor = Math.max(0, p.armor - 4);
          }
          if (audio) audio.hit();
        }
      } else {
        // Foot cops run the player down.
        const want = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.angle = want;
        cop.x += Math.cos(want) * 260 * dt;
        cop.y += Math.sin(want) * 260 * dt;
        if (d < 52 && cop.ramCd <= 0) {
          cop.ramCd = 1;
          p.health = Math.max(0, p.health - 3);
          if (p.armor > 0) p.armor = Math.max(0, p.armor - 3);
        }
      }
    }

    // The helicopter keeps its orbit while the heat is on.
    if (state.wanted >= CFG.HELI_MIN_STARS && !state.heli) {
      state.heli = {
        x: p.x + CFG.HELI_ORBIT, y: p.y, z: CFG.HELI_HEIGHT,
        orbitAngle: 0, lightX: p.x, lightY: p.y,
        spotIntensity: 0.55, spotAngle: 0.32, groundLux: 0.42,
      };
    }
    if (state.wanted < CFG.HELI_MIN_STARS && state.heli) state.heli = null;

    // Wanted decay: 14 seconds with no cop within 380 units loses a star.
    if (state.wanted > 0) {
      let nearest = Infinity;
      for (const cop of state.cops) {
        nearest = Math.min(nearest, Math.hypot(cop.x - p.x, cop.y - p.y));
      }
      if (state.cops.length === 0 || nearest > CFG.HIDE_RADIUS) {
        state.hiddenTimer += dt;
        if (state.hiddenTimer >= CFG.HIDE_DECAY_SEC) {
          state.hiddenTimer = 0;
          state.wanted -= 1;
          if (state.wanted === 0) {
            state.cops = [];
            state.roadblock = null;
          }
        }
      } else {
        state.hiddenTimer = 0;
      }
    }

    // ------------------------------------------------------------ bullets
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.life -= dt;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      let dead = b.life <= 0;
      if (!dead) {
        for (const target of [...state.gangCars, ...state.cops]) {
          if (target.alive === false || target.health <= 0) continue;
          if (Math.hypot(target.x - b.x, target.y - b.y) < 48) {
            damageTarget(target, b.damage);
            if (audio) audio.hit();
            dead = true;
            break;
          }
        }
      }
      if (!dead && pointInBuildings(state.buildings, b.x, b.y, 0)) dead = true;
      if (dead) state.bullets.splice(i, 1);
    }

    // Gang cars cruise their turf loop; wrecks smoke and get towed.
    for (const gc of state.gangCars) {
      if (!gc.alive) {
        gc.wreckTimer -= dt;
        continue;
      }
      gc.orbitAngle += gc.orbitSpeed * dt * 0.5;
      gc.x = TURF.x + Math.cos(gc.orbitAngle) * gc.orbitRadius;
      gc.y = TURF.y + Math.sin(gc.orbitAngle) * gc.orbitRadius;
      gc.angle = gc.orbitAngle + Math.PI / 2;
    }

    // --------------------------------------------------- hidden packages
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 110) {
        pk.active = false;
        state.money += CFG.HIDDEN_PACKAGE_PAY;
        state.earnedTotal += CFG.HIDDEN_PACKAGE_PAY;
        state.respect += CFG.HIDDEN_PACKAGE_RESPECT;
        state.banner = {
          title: `Hidden package +$${CFG.HIDDEN_PACKAGE_PAY}`,
          text: `Respect +${CFG.HIDDEN_PACKAGE_RESPECT}`,
          until: state.time + 3,
        };
        if (audio) audio.pickup();
      }
    }

    // ------------------------------------------------------------ missions
    const stage = currentStage(state);
    if (stage && !state.over) {
      if (stage.kind === 'goto') {
        if (Math.hypot(p.x - stage.x, p.y - stage.y) < 130) advanceStage();
      } else if (stage.kind === 'torch') {
        if (state.gangMissionKills >= stage.count) {
          state.missionStage = 1;
          state.holdTimer = 0;
          setTargetFromStage();
          state.banner = { title: 'Turf cleared', text: 'Hold the turf marker — 20s', until: state.time + 4 };
        }
      } else if (stage.kind === 'hold') {
        const d = Math.hypot(p.x - stage.x, p.y - stage.y);
        if (d < 300) {
          state.holdTimer += dt;
          state.missionTarget.label = `Hold the turf marker — ${Math.ceil(20 - state.holdTimer)}s`;
          if (state.holdTimer >= 20) advanceStage();
        } else {
          state.holdTimer = Math.max(0, state.holdTimer - dt);
        }
      } else if (stage.kind === 'hide') {
        if (state.wanted === 0) advanceStage();
      }
      // The mission timer runs out: restart the mission.
      const m = MISSIONS[state.missionIndex];
      if (m && m.timer > 0) {
        state.missionTimer -= dt;
        if (state.missionTimer <= 0) {
          state.banner = { title: 'Time up', text: 'The mission restarts.', until: state.time + 3 };
          if (audio) audio.fail();
          startMission(state.missionIndex);
        }
      }
    }

    // -------------------------------------------------- taxi, phone, shop
    state.taxi.update(state, dt);
    if (state.taxi.waiting && p.inCar) state.taxi.tryPickup(state);
    const fare = state.taxi.updateActive(state, dt);
    if (fare && fare.paid > 0) {
      state.money += fare.paid;
      state.earnedTotal += fare.paid;
      state.banner = { title: `Fare complete +$${fare.paid}`, text: '', until: state.time + 3 };
      if (audio) audio.cash();
    }
    const jobDone = state.phone.update(state, dt);
    if (jobDone && jobDone.paid) {
      state.banner = { title: `${jobDone.job} job done +$${jobDone.paid}`, text: '', until: state.time + 3 };
      if (audio) audio.cash();
    }

    // -------------------------------------------------------- respect ranks
    let rank = 0;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (state.respect >= RANKS[i].respect) rank = i;
    }
    if (rank !== state.rankIndex) {
      state.rankIndex = rank;
      const unlocked = RANKS[rank].weapon;
      if (!state.weapons.includes(unlocked)) {
        state.weapons.push(unlocked);
        state.weapon = unlocked;
        const stats = WEAPON_STATS[unlocked];
        if (stats) state.player.ammo = stats.ammo;
        state.banner = {
          title: `Rank up: ${RANKS[rank].name}`,
          text: `New weapon: ${stats ? stats.name : unlocked}`,
          until: state.time + 4,
        };
        if (audio) audio.mission();
      }
    }

    // ------------------------------------------------------------ the end
    if (p.health <= 0 && !state.over) {
      state.over = 'dead';
      if (audio) audio.fail();
    }

    // The traffic director keeps the chase dense and the camera clear.
    dir.update(dt, state.cameraPos);
  }

  // The world starts on mission 1.
  startMission(0);

  return {
    state,
    weather,
    director: dir,
    step,
    shoot,
    addWanted,
    useCrew,
    completeMission,
    debugWin() {
      // Test hook: jump straight to the win screen.
      state.missionsDone = MISSIONS.length;
      state.money = Math.max(state.money, STORY_TOTAL);
      state.earnedTotal = Math.max(state.earnedTotal, STORY_TOTAL);
      state.over = 'win';
      state.race.available = true;
    },
    enterExitCar,
    startMission,
    // Restart the run in place: rebuild the state inside the same object
    // so the renderer and the HUD keep their references, then start over
    // on mission 1. The director reads this same state object, so it
    // keeps working too.
    reset() {
      const fresh = createWorld(audio);
      const keepDirector = state.director;
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, fresh.state);
      state.director = keepDirector;
      weather.t = fresh.weather.t;
      weather.raining = false;
      startMission(0);
    },
    // The shop, bought through the shop module.
    buyItem: (id) => buyItem(state, id),
  };
}
