// Sunset Arms & Paint for the v6 rebuild: the shop beside the Neon Hotel.
// Walk or drive within range and press E to open it: body armor $200
// (+50 armor), an ammo box $100 (+60 ammo for the current weapon), or a
// paint job $150 (cycles 6 colours for the car you are in, plus gold paint
// once you reach the Kingpin rank). Pure rules — the HUD draws the panel.
import { GOLD_PAINT, PAINTS, RANKS, SHOP_POS } from './config.js';

export const SHOP_ITEMS = [
  { id: 'armor', name: 'Body Armor', price: 200, desc: '+50 armor (max 100)' },
  { id: 'ammo', name: 'Ammo Box', price: 100, desc: '+60 ammo' },
  { id: 'paint', name: 'Car Paint', price: 150, desc: 'next paint colour' },
];

export function createShop() {
  const data = { x: SHOP_POS.x, y: SHOP_POS.y, label: SHOP_POS.label, open: false, near: false, paintIndex: 0 };
  function isNear(state) {
    const p = state.player;
    return Math.hypot(p.x - data.x, p.y - data.y) < 160;
  }
  function paintChoices(state) {
    const list = PAINTS.slice();
    if (state.respect >= RANKS[4].at) list.push(GOLD_PAINT);
    return list;
  }
  function update(state) {
    data.near = isNear(state);
    if (!data.near) data.open = false;
  }
  function toggle(state) {
    if (!isNear(state)) return false;
    data.open = !data.open;
    return data.open;
  }
  function buy(state, itemId) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, msg: 'No such item.' };
    if (state.money < item.price) return { ok: false, msg: `Need $${item.price} — you have $${state.money}.` };
    if (itemId === 'armor') {
      if (state.player.armor >= 100) return { ok: false, msg: 'Armor already full.' };
      state.player.armor = Math.min(100, state.player.armor + 50);
    } else if (itemId === 'ammo') {
      state.player.ammo += 60;
    } else if (itemId === 'paint') {
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (!car) return { ok: false, msg: 'Get in a car first, then buy paint.' };
      const choices = paintChoices(state);
      data.paintIndex = (data.paintIndex + 1) % choices.length;
      car.color = choices[data.paintIndex];
    }
    state.money -= item.price;
    state.message = `Bought ${item.name} for $${item.price}.`;
    state.messageTimer = 3;
    return { ok: true, msg: state.message };
  }
  return { data, update, toggle, buy, items: SHOP_ITEMS, paintChoices };
}
