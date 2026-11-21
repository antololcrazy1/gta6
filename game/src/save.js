// Save / continue for the v6 rebuild: autosaves money, respect, missions
// done, best money, unlocked weapons and the current weapon, so weapons and
// rank survive a reload. All access is guarded — private mode just means
// no save. Written fresh for the rebuild.
// Round 7: saves carry a schema version and a timestamp, so a save from
// an older build is still readable and the title screen can say when
// the run was last played.
import { SAVE_KEY } from './config.js';

export const SAVE_VERSION = 2;

export function saveGame(state) {
  try {
    const data = {
      v: SAVE_VERSION,
      savedAt: Date.now(),
      money: state.money,
      respect: state.respect,
      missionsDone: state.missionsDone,
      best: Math.max(state.best || 0, state.money),
      weapons: state.weapons || ['pistol'],
      weapon: state.weapon || 'pistol',
      earned: state.earnedTotal || 0,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number' || typeof d.missionsDone !== 'number') return null;
    return {
      v: typeof d.v === 'number' ? d.v : 1,
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
      money: d.money,
      respect: d.respect || 0,
      missionsDone: d.missionsDone,
      best: d.best || 0,
      weapons: Array.isArray(d.weapons) ? d.weapons : ['pistol'],
      weapon: typeof d.weapon === 'string' ? d.weapon : 'pistol',
      earned: d.earned || 0,
    };
  } catch { return null; }
}

// One-line summary of the save for the title screen: money, missions
// and how long ago it was written, or null when there is no save.
export function saveSummary() {
  const d = loadSave();
  if (!d) return null;
  const ageMin = d.savedAt ? Math.max(0, Math.round((Date.now() - d.savedAt) / 60000)) : null;
  return { money: d.money, missionsDone: d.missionsDone, best: d.best, ageMin, version: d.v };
}

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
