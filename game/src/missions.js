// Vice Coast story: the 10-mission chain and its flow.
// Pure mission data + the target/start/complete helpers; the world owns the
// live state object and passes it in, so this file has no browser or drawing.
// v5 adds three missions after the Sunset Showdown: Harbor Lights (smuggle
// run), Neon Reign (gang turf) and the Vice Coast Finale (bank heist, 5 stars,
// escape to the pier). Total story money: $9,650 in mission rewards, $9,850
// with the mission-5 vault bonus.
import { NIGHT_DROPS } from './config.js';
import { GANG_TURF } from './gang.js';

export const MISSIONS = [
  { id: 1, name: 'Sunset Taxi', brief: 'Pick up Maya at the pier, then drop her at the Neon Hotel. Drive smooth — she tips for speed.', reward: 150 },
  { id: 2, name: 'Package Run', brief: 'Collect 3 packages around Palm Row and deliver them to the docks. Watch the clock.', reward: 250 },
  { id: 3, name: 'Getaway', brief: 'Grab the bag from the arcade and reach the hideout in 75 seconds. The cops will not wait.', reward: 350 },
  { id: 4, name: 'Lose the Heat', brief: 'You are at 3 stars. Break line of sight and stay hidden until the heat dies down.', reward: 400 },
  { id: 5, name: 'The Sunset Heist', brief: 'Hit the Coral Bank vault, grab the loot, and escape to the hideout. Finish this and Vice Coast is yours.', reward: 800 },
  { id: 6, name: 'Vice Nights', brief: 'Collect 4 night drops, one at each corner of the city, then deliver them to the hideout. It starts hot — 4 stars the moment you begin, heli already up.', reward: 1000 },
  { id: 7, name: 'Sunset Showdown', brief: 'Reach the Sunset Pier in 75 seconds with 5 stars on you. Finish this and Vice Coast is yours.', reward: 1200 },
  { id: 8, name: 'Harbor Lights', brief: 'Smuggle run: collect 3 crates on the docks road, then deliver them to the boat at the Sunset Pier. 120 seconds on the clock.', reward: 1400 },
  { id: 9, name: 'Neon Reign', brief: 'Gang turf war: torch 3 rival gang cars in Neon Downtown, then hold the turf marker for 20 seconds. The Vipers will not give it up easy.', reward: 1600 },
  { id: 10, name: 'Vice Coast Finale', brief: 'The last job: hit Coral Bank one more time at 5 stars, then escape to the Sunset Pier in 90 seconds. Pull this off and the coast is truly yours.', reward: 2500 },
];

// Smuggle crates for Harbor Lights (mission 8): three spots along the docks
// road at y=1792, collected in order, then the boat at the pier.
export const HARBOR_CRATES = [
  { x: 3008, y: 1792 },
  { x: 3200, y: 1792 },
  { x: 3392, y: 1792 },
];

// Fresh per-run mission fields, spread into the world state by createWorld.
export function createMissionState() {
  return {
    missionIndex: 0, missionStage: 0, missionTimer: 0, packagesLeft: 0, collected: 0,
    missionTarget: null, missionText: '', missionFlash: 0, missionsDone: 0,
    missionHold: 0, gangMissionKills: 0, gangPrimed: false,
  };
}

// Where the gold beacon points for a mission + stage. Landmarks come from the
// world (pier, hotel, docks, arcade, hideout, bank, packages). Returns null
// once every mission is done.
export function missionTargetFor(missionIndex, missionStage, landmarks) {
  const L = landmarks;
  if (missionIndex === 0) return missionStage === 0 ? { ...L.pier, label: 'Pick up Maya' } : { ...L.hotel, label: 'Drop Maya off' };
  if (missionIndex === 1) return missionStage < 3 ? { ...L.packages[missionStage], label: `Package ${missionStage + 1}/3` } : { ...L.docks, label: 'Deliver to the docks' };
  if (missionIndex === 2) return missionStage === 0 ? { ...L.arcade, label: 'Grab the bag' } : { ...L.hideout, label: 'Reach the hideout!' };
  if (missionIndex === 3) return { ...L.hideout, label: 'Get to the hideout' };
  if (missionIndex === 4) return missionStage === 0 ? { ...L.bank, label: 'Hit Coral Bank' } : { ...L.hideout, label: 'Escape to the hideout!' };
  if (missionIndex === 5) return missionStage < 4 ? { ...NIGHT_DROPS[missionStage], label: `Night drop ${missionStage + 1}/4` } : { ...L.hideout, label: 'Deliver to the hideout' };
  if (missionIndex === 6) return { ...L.pier, label: 'Reach the Sunset Pier' };
  if (missionIndex === 7) return missionStage < 3 ? { ...HARBOR_CRATES[missionStage], label: `Crate ${missionStage + 1}/3` } : { ...L.boat, label: 'Deliver to the pier boat' };
  if (missionIndex === 8) return missionStage === 0 ? { ...GANG_TURF[0], label: 'Torch 3 gang cars' } : { ...GANG_TURF[0], label: 'Hold the turf marker' };
  if (missionIndex === 9) return missionStage === 0 ? { ...L.bank, label: 'Hit Coral Bank — final job' } : { ...L.pier, label: 'Escape to the Sunset Pier!' };
  return null;
}

// Point the beacon + banner at the current mission and stage.
export function refreshMissionTarget(state, landmarks) {
  const m = state.missionIndex;
  if (m >= MISSIONS.length) { state.missionTarget = null; state.missionText = 'Vice Coast is yours. Free roam!'; return; }
  state.missionTarget = missionTargetFor(m, state.missionStage, landmarks);
  state.missionText = `${MISSIONS[m].name} — ${state.missionTarget.label}`;
}

// How long a mission's clock runs: Package Run 120 s, Getaway and Sunset
// Showdown 75 s, Harbor Lights 120 s, Vice Coast Finale 90 s, the rest
// untimed (0).
export function missionTimerFor(missionIndex) {
  if (missionIndex === 1 || missionIndex === 7) return 120;
  if (missionIndex === 2 || missionIndex === 6) return 75;
  if (missionIndex === 9) return 90;
  return 0;
}

// Begin (or restart) mission i: reset its stage, arm its timer, set the
// beacon, flash the banner and show the brief. Mission 4 starts at 3 stars,
// Vice Nights at 4 stars, Sunset Showdown and the Finale at 5 stars.
export function startMission(state, i, landmarks, addWanted) {
  state.missionIndex = i; state.missionStage = 0; state.packagesLeft = 3; state.collected = 0;
  state.missionTimer = missionTimerFor(i);
  state.missionHold = 0; state.gangMissionKills = 0; state.gangPrimed = false;
  if (i === 3) addWanted(3, true);
  if (i === 5) addWanted(4, true);
  if (i === 6 || i === 9) addWanted(5, true);
  refreshMissionTarget(state, landmarks);
  state.missionFlash = 3;
  state.message = `${MISSIONS[i].name}: ${MISSIONS[i].brief}`; state.messageTimer = 5;
}

// Pay out the current mission and move on. The last one wins the game via
// winGame(); the rest chain straight into the next mission.
export function completeMission(state, landmarks, addWanted, winGame) {
  const m = MISSIONS[state.missionIndex];
  state.money += m.reward; state.respect += 20; state.missionsDone += 1;
  state.message = `Mission complete! +$${m.reward} — ${m.name}`; state.messageTimer = 4; state.missionFlash = 3;
  if (state.missionIndex === MISSIONS.length - 1) { winGame(); return; }
  startMission(state, state.missionIndex + 1, landmarks, addWanted);
}
