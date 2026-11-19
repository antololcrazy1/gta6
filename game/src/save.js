// Save / continue: autosaves money, respect, missions done and best money
// to localStorage whenever a mission completes, and restores them when the
// player picks Continue on the title screen (a new run starts at the next
// mission). All access is guarded — private mode just means no save.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      respect: state.respect,
      missionsDone: state.missionsDone,
      best: Math.max(state.best || 0, state.money),
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
    return { money: d.money, respect: d.respect || 0, missionsDone: d.missionsDone, best: d.best || 0 };
  } catch { return null; }
}

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
