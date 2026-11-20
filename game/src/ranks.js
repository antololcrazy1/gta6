// Vice Coast progression (v6.5, Phase 3): named respect ranks with unlocks
// + the weapon table. The top-10 entries all show a rank + XP bar + a
// "NEXT AT ..." preview instead of a bare 0-100 bar, and their weapon slots
// are bought/unlocked — Vice Coast's SMG / 12G / MAKO slots showed "—"
// (unowned) because no weapon was ever obtainable. Rank-ups grant the
// weapon free and auto-equip it; the shop sells no weapons today.
export const RANKS = [
  { name: 'DOCK HAND', xp: 0, unlock: null },
  { name: 'WHEELMAN', xp: 60, unlock: { weapon: 'smg', label: 'SMG' } },
  { name: 'FIXER', xp: 140, unlock: { weapon: '12g', label: '12G SHOTGUN' } },
  { name: 'SHOT CALLER', xp: 240, unlock: { weapon: 'mako', label: 'MAKO RIFLE' } },
  { name: 'KINGPIN', xp: 380, unlock: { item: 'goldpaint', label: 'GOLD PAINT' } },
];

// Weapon stats. All weapons share the one ammo pool (the shop's ammo box
// feeds every gun) — what differs is fire rate, damage and spread. Fists
// is the no-ammo fallback: selecting it (or running dry) punches.
export const WEAPONS = {
  fists: { name: 'FISTS', cd: 0.45, dmg: 25, speed: 0, life: 0, spread: 1 },
  pistol: { name: 'PISTOL', cd: 0.22, dmg: 30, speed: 950, life: 0.7, spread: 1 },
  smg: { name: 'SMG', cd: 0.11, dmg: 20, speed: 1000, life: 0.6, spread: 1 },
  '12g': { name: '12G', cd: 0.55, dmg: 22, speed: 900, life: 0.5, spread: 3 },
  mako: { name: 'MAKO', cd: 0.16, dmg: 40, speed: 1100, life: 1.0, spread: 1 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', '12g', 'mako'];

export function rankFor(xp) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (xp >= RANKS[i].xp) r = i;
  return r;
}

// Next rank + progress within the current one (null at max rank).
export function nextRankInfo(xp) {
  const r = rankFor(xp);
  if (r >= RANKS.length - 1) return null;
  const n = RANKS[r + 1];
  return { rank: n, need: n.xp - xp, progress: Math.min(1, Math.max(0, (xp - RANKS[r].xp) / (n.xp - RANKS[r].xp))) };
}
