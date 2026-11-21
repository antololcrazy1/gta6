// Save / continue for the v6 rebuild: autosaves money, respect, missions
// done, best money, unlocked weapons and the current weapon, so weapons and
// rank survive a reload. All access is guarded — private mode just means
// no save. Written fresh for the rebuild.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
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

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
