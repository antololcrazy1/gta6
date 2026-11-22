// Save and continue. The game writes a small save to localStorage whenever
// a mission is completed, and the title screen offers Continue (C) when a
// save exists. A save holds the mission count, the money, the total earned
// and the respect, so a continued run picks up where the last one ended.
export const SAVE_KEY = 'vice-coast.save-v6';

export function saveGame(state) {
  try {
    const data = {
      missionsDone: state.missionsDone,
      money: state.money,
      earnedTotal: state.earnedTotal,
      respect: state.respect,
      weapons: state.weapons.slice(),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Ignore storage failures.
  }
}

// Apply a loaded save to a fresh state: the mission index follows the
// missions done, and the money and respect carry over.
export function applySave(state, data) {
  if (!data) return false;
  state.missionsDone = data.missionsDone || 0;
  state.missionIndex = Math.min(state.missionsDone, 9);
  state.money = data.money || 0;
  state.earnedTotal = data.earnedTotal || 0;
  state.respect = data.respect || 0;
  if (Array.isArray(data.weapons) && data.weapons.length) {
    state.weapons = data.weapons.slice();
    state.weapon = state.weapons[state.weapons.length - 1];
  }
  return true;
}
