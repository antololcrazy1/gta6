// Tuning numbers, colours, districts and the day cycle for Vice Coast.
// One place for every magic number so the world, the camera, the police
// and the HUD all agree about the same city.
export const CFG = {
  // The city, in world units. The beach and the sunset sit on the west edge.
  WORLD_W: 11400,
  WORLD_H: 6600,
  BEACH_W: 620,
  ROAD_W: 96,
  // Road grids: 17 vertical roads, 13 horizontal roads.
  V_ROADS: 17,
  H_ROADS: 13,
  V_ROAD_X0: 700,
  V_ROAD_DX: 640,
  H_ROAD_Y0: 300,
  H_ROAD_DY: 500,

  // Driving. Top speed 448 is about 143 km/h in the game's scale.
  CAR_TOP_SPEED: 448,
  CAR_ACCEL: 336,
  CAR_BRAKE: 496,
  CAR_REVERSE: 160,
  CAR_TURN: 2.4,
  NITRO_MULT: 1.5,
  NITRO_DRAIN: 30,
  NITRO_REGEN: 8,
  // Police cars are quick but never quite as quick as a nitro boost.
  COP_TOP_SPEED: 360,
  COP_PER_STAR: 20,

  // On foot.
  WALK_SPEED: 230,
  SPRINT_SPEED: 350,
  // About four steps a second at a walk.
  WALK_STEPS_PER_SEC: 4,

  // The day: 240 seconds, day, then sunset, then night, then morning.
  DAY_LENGTH: 240,
  DAY_END: 120,
  SUNSET_END: 170,

  // Wanted. Stars decay after 14 seconds with no cop within 380 units.
  HIDE_RADIUS: 380,
  HIDE_DECAY_SEC: 14,
  HELI_MIN_STARS: 4,
  HELI_ORBIT: 420,
  HELI_HEIGHT: 260,

  // The traffic director's density targets.
  DENSITY_CAR_RADIUS: 450,
  DENSITY_CAR_MIN: 8,
  DENSITY_PED_RADIUS: 200,
  DENSITY_PED_MIN: 10,
  // Pedestrians keep this far from the camera.
  PED_CAMERA_KEEPOUT: 42,

  // Facade texture budget: at most this many unique canvas textures.
  FACADE_TEXTURE_BUDGET: 48,
  FACADE_SIZE: 256,

  // World population.
  TRAFFIC_CARS: 34,
  PARKED_CARS: 14,
  PEDS: 60,
  BEACHGOERS: 6,
  GANG_CARS: 6,

  // Money.
  HIDDEN_PACKAGE_PAY: 50,
  HIDDEN_PACKAGE_RESPECT: 2,
  NEAR_MISS_PAY: 10,

  // Colours of the golden-hour city.
  COLORS: {
    skyDay: 0x87b5d6,
    skySunset: 0xff9a5c,
    skyNight: 0x0e1633,
    sun: 0xffd9a0,
    asphalt: 0x2b2b30,
    roadLine: 0xd8d8c8,
    sidewalk: 0x8a8a86,
    sand: 0xe8cf9a,
    ocean: 0x1d5f8a,
    oceanSunset: 0x2a6f9e,
    grass: 0x4d8a3f,
  },
};

// The four districts, in plain words, used by the HUD and the minimap.
export const DISTRICTS = [
  { name: 'Beach', test: (x) => x < 1500 },
  { name: 'Neon Downtown', test: (x, y) => x >= 7500 && y < 2400 },
  { name: 'Coral Docks', test: (x, y) => x >= 7500 && y >= 4200 },
  { name: 'Suburbs', test: () => true },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (d.test(x, y)) return d.name;
  }
  return 'Suburbs';
}

// Landmarks, placed on the big map. The pier and the beach are west,
// Neon Downtown is north-east, the docks are south-east.
export const LANDMARKS = {
  sunsetPier: { x: 320, y: 3300, name: 'Sunset Pier' },
  pierBoat: { x: 180, y: 3450, name: 'Pier Boat' },
  neonHotel: { x: 9000, y: 1200, name: 'Neon Hotel' },
  coralDocks: { x: 9800, y: 5400, name: 'Coral Docks' },
  pixelArcade: { x: 5200, y: 1800, name: 'Pixel Arcade' },
  hideout: { x: 4200, y: 4800, name: 'Hideout' },
  coralBank: { x: 8600, y: 2600, name: 'Coral Bank' },
  palmRow: { x: 4200, y: 1800, name: 'Palm Row' },
  sunsetArms: { x: 8300, y: 1800, name: 'Sunset Arms & Paint' },
  turf: { x: 8300, y: 2400, name: 'Viper Turf' },
};

// Respect ranks: name, respect needed, weapon unlocked at that rank.
export const RANKS = [
  { name: 'Rookie', respect: 0, weapon: 'pistol' },
  { name: 'Street', respect: 60, weapon: 'smg' },
  { name: 'Hustler', respect: 150, weapon: 'shotgun' },
  { name: 'Kingpin', respect: 300, weapon: 'smg' },
];

export const WEAPON_STATS = {
  pistol: { damage: 34, range: 520, rate: 0.28, ammo: 120, name: 'Pistol' },
  smg: { damage: 22, range: 460, rate: 0.11, ammo: 240, name: 'SMG' },
  shotgun: { damage: 26, range: 300, rate: 0.7, ammo: 60, pellets: 5, name: 'Shotgun' },
};

// Named police units for the HUD's police response list.
export const POLICE_UNITS = [
  { name: 'Unit 12', role: 'Pursuit' },
  { name: 'Unit 07', role: 'Interceptor' },
  { name: 'Unit 23', role: 'Roadblock' },
  { name: 'Unit 31', role: 'Pursuit' },
  { name: 'Unit 44', role: 'K-9' },
  { name: 'Unit 58', role: 'Interceptor' },
  { name: 'Air 1', role: 'Helicopter' },
  { name: 'Unit 66', role: 'Roadblock' },
];

// Crew members and what their ability does.
export const CREW = [
  { id: 'mira', name: 'Mira', ability: 'Smooth Talker', desc: 'Removes 1 wanted star', cooldown: 45 },
  { id: 'dex', name: 'Dex', ability: 'Wheelman', desc: 'Nitro refills instantly', cooldown: 40 },
  { id: 'luna', name: 'Luna', ability: 'Lookout', desc: 'Marks the mission target', cooldown: 30 },
];
