// Vice Coast story: the 5-mission chain and its flow.
// Pure mission data + the target/start/complete helpers; the world owns the
// live state object and passes it in, so this file has no browser or drawing.
export const MISSIONS = [
  { id: 1, name: 'Sunset Taxi', brief: 'Pick up Maya at the pier, then drop her at the Neon Hotel. Drive smooth — she tips for speed.', reward: 150 },
  { id: 2, name: 'Package Run', brief: 'Collect 3 packages around Palm Row and deliver them to the docks. Watch the clock.', reward: 250 },
  { id: 3, name: 'Getaway', brief: 'Grab the bag from the arcade and reach the hideout in 75 seconds. The cops will not wait.', reward: 350 },
  { id: 4, name: 'Lose the Heat', brief: 'You are at 3 stars. Break line of sight and stay hidden until the heat dies down.', reward: 400 },
  { id: 5, name: 'The Sunset Heist', brief: 'Hit the Coral Bank vault, grab the loot, and escape to the hideout. Finish this and Vice Coast is yours.', reward: 800 },
];

// Fresh per-run mission fields, spread into the world state by createWorld.
export function createMissionState() {
  return {
    missionIndex: 0, missionStage: 0, missionTimer: 0, packagesLeft: 0, collected: 0,
    missionTarget: null, missionText: '', missionFlash: 0, missionsDone: 0,
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
  return null;
}

// Point the beacon + banner at the current mission and stage.
export function refreshMissionTarget(state, landmarks) {
  const m = state.missionIndex;
  if (m >= MISSIONS.length) { state.missionTarget = null; state.missionText = 'Vice Coast is yours. Free roam!'; return; }
  state.missionTarget = missionTargetFor(m, state.missionStage, landmarks);
  state.missionText = `${MISSIONS[m].name} — ${state.missionTarget.label}`;
}

// How long a mission's clock runs: Package Run 120 s, Getaway 75 s, the rest
// untimed (0).
export function missionTimerFor(missionIndex) {
  return missionIndex === 2 ? 75 : missionIndex === 1 ? 120 : 0;
}

// Begin (or restart) mission i: reset its stage, arm its timer, set the
// beacon, flash the banner and show the brief. Mission 4 starts at 3 stars.
export function startMission(state, i, landmarks, addWanted) {
  state.missionIndex = i; state.missionStage = 0; state.packagesLeft = 3; state.collected = 0;
  state.missionTimer = missionTimerFor(i);
  if (i === 3) addWanted(3, true);
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
