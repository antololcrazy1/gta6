// The ten story missions of Vice Coast, in order. Each mission is data:
// a name, a payout, an optional timer, a briefing line, and a list of
// stages. A stage is a 'goto' (reach a place), a 'torch' (destroy gang
// cars), a 'hold' (stay on a spot for some seconds) or a 'hide' (lose the
// heat until the wanted level reaches zero). The world drives the stage
// machine; this file only describes what has to happen.
import { LANDMARKS } from './config.js';

// The four night-drop corners, one at each corner of the city.
const CORNERS = [
  { x: 800, y: 600, name: 'NW corner' },
  { x: 10600, y: 600, name: 'NE corner' },
  { x: 800, y: 6000, name: 'SW corner' },
  { x: 10600, y: 6000, name: 'SE corner' },
];

// Three package spots around Palm Row, and three crates on the docks road.
const PACKAGE_SPOTS = [
  { x: 4200, y: 1500, name: 'Palm Row package' },
  { x: 4800, y: 2100, name: 'Palm Row package' },
  { x: 3600, y: 2400, name: 'Palm Row package' },
];
const CRATE_SPOTS = [
  { x: 9600, y: 5000, name: 'Docks crate' },
  { x: 10100, y: 5200, name: 'Docks crate' },
  { x: 9800, y: 5600, name: 'Docks crate' },
];

function gotoStage(x, y, label) {
  return { kind: 'goto', x, y, label };
}

export const MISSIONS = [
  {
    name: 'Sunset Taxi',
    pay: 150,
    timer: 0,
    briefing: 'Maya is waiting at the pier. Pick her up, then drop her at the Neon Hotel. She tips for speed.',
    stages: [
      gotoStage(LANDMARKS.sunsetPier.x, LANDMARKS.sunsetPier.y, 'Pick up Maya at the Sunset Pier'),
      gotoStage(LANDMARKS.neonHotel.x, LANDMARKS.neonHotel.y, 'Drop Maya at the Neon Hotel'),
    ],
  },
  {
    name: 'Package Run',
    pay: 250,
    timer: 150,
    briefing: 'Three packages around Palm Row, then to the docks. The clock is running.',
    stages: [
      gotoStage(PACKAGE_SPOTS[0].x, PACKAGE_SPOTS[0].y, 'Package 1/3 — Palm Row'),
      gotoStage(PACKAGE_SPOTS[1].x, PACKAGE_SPOTS[1].y, 'Package 2/3 — Palm Row'),
      gotoStage(PACKAGE_SPOTS[2].x, PACKAGE_SPOTS[2].y, 'Package 3/3 — Palm Row'),
      gotoStage(LANDMARKS.coralDocks.x, LANDMARKS.coralDocks.y, 'Deliver the packages to the docks'),
    ],
  },
  {
    name: 'Getaway',
    pay: 350,
    timer: 180,
    briefing: 'Grab the bag from the Pixel Arcade and reach the hideout before the cops box you in.',
    startWanted: 2,
    stages: [
      gotoStage(LANDMARKS.pixelArcade.x, LANDMARKS.pixelArcade.y, 'Grab the bag at the Pixel Arcade'),
      gotoStage(LANDMARKS.hideout.x, LANDMARKS.hideout.y, 'Reach the Hideout'),
    ],
  },
  {
    name: 'Lose the Heat',
    pay: 400,
    timer: 0,
    briefing: 'Three stars on you. Break line of sight and stay hidden until the heat dies down.',
    startWanted: 3,
    stages: [
      { kind: 'hide', label: 'Stay hidden until the heat dies down' },
    ],
  },
  {
    name: 'The Sunset Heist',
    pay: 800,
    timer: 0,
    briefing: 'Hit the Coral Bank vault, grab the loot, and get out to the hideout.',
    stages: [
      gotoStage(LANDMARKS.coralBank.x, LANDMARKS.coralBank.y, 'Hit the Coral Bank vault'),
      gotoStage(LANDMARKS.hideout.x, LANDMARKS.hideout.y, 'Escape to the Hideout'),
    ],
  },
  {
    name: 'Vice Nights',
    pay: 1000,
    timer: 0,
    briefing: 'Four night drops, one at each corner of the city. It starts hot — four stars, helicopter already up.',
    startWanted: 4,
    stages: [
      gotoStage(CORNERS[0].x, CORNERS[0].y, 'Night drop 1/4'),
      gotoStage(CORNERS[1].x, CORNERS[1].y, 'Night drop 2/4'),
      gotoStage(CORNERS[2].x, CORNERS[2].y, 'Night drop 3/4'),
      gotoStage(CORNERS[3].x, CORNERS[3].y, 'Night drop 4/4'),
      gotoStage(LANDMARKS.hideout.x, LANDMARKS.hideout.y, 'Deliver the drops to the Hideout'),
    ],
  },
  {
    name: 'Sunset Showdown',
    pay: 1200,
    timer: 180,
    briefing: 'Reach the Sunset Pier in time with five stars on you. Do not stop.',
    startWanted: 5,
    stages: [
      gotoStage(LANDMARKS.sunsetPier.x, LANDMARKS.sunsetPier.y, 'Reach the Sunset Pier'),
    ],
  },
  {
    name: 'Harbor Lights',
    pay: 1400,
    timer: 180,
    briefing: 'A smuggle run: three crates on the docks road, then deliver them to the boat at the Sunset Pier.',
    stages: [
      gotoStage(CRATE_SPOTS[0].x, CRATE_SPOTS[0].y, 'Crate 1/3 — Docks road'),
      gotoStage(CRATE_SPOTS[1].x, CRATE_SPOTS[1].y, 'Crate 2/3 — Docks road'),
      gotoStage(CRATE_SPOTS[2].x, CRATE_SPOTS[2].y, 'Crate 3/3 — Docks road'),
      gotoStage(LANDMARKS.pierBoat.x, LANDMARKS.pierBoat.y, 'Deliver the crates to the boat at the Sunset Pier'),
    ],
  },
  {
    name: 'Neon Reign',
    pay: 1600,
    timer: 0,
    briefing: 'A gang turf war. Torch three rival gang cars in Neon Downtown, then hold the turf marker.',
    stages: [
      { kind: 'torch', count: 3, label: 'Torch 3 rival gang cars (0/3)' },
      { kind: 'hold', x: LANDMARKS.turf.x, y: LANDMARKS.turf.y, secs: 20, label: 'Hold the turf marker — 20s' },
    ],
  },
  {
    name: 'Vice Coast Finale',
    pay: 2500,
    timer: 180,
    briefing: 'The last job. Hit Coral Bank one more time at five stars, then escape to the Sunset Pier.',
    startWanted: 5,
    stages: [
      gotoStage(LANDMARKS.coralBank.x, LANDMARKS.coralBank.y, 'Hit Coral Bank — one last time'),
      gotoStage(LANDMARKS.sunsetPier.x, LANDMARKS.sunsetPier.y, 'Escape to the Sunset Pier'),
    ],
  },
];

// The story chain pays 9,650 across the ten missions.
export const STORY_TOTAL = MISSIONS.reduce((n, m) => n + m.pay, 0);

// A one-line summary of where the player is in the current mission,
// for the HUD's mission panel.
export function missionSummary(state) {
  const m = MISSIONS[state.missionIndex];
  if (!m) return { name: 'Free Roam', objective: 'The city is yours.', progress: 1 };
  const total = m.stages.length;
  const done = state.missionStage;
  return {
    name: m.name,
    objective: state.missionTarget ? state.missionTarget.label : m.briefing,
    progress: total ? done / total : 0,
    timer: state.missionTimer,
    pay: m.pay,
  };
}

// The current stage definition, or null when the chain is finished.
export function currentStage(state) {
  const m = MISSIONS[state.missionIndex];
  if (!m) return null;
  return m.stages[state.missionStage] || null;
}
