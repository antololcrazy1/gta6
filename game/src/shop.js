// Sunset Arms & Paint: the shop by the Neon Hotel. Walk (or drive) within
// 90 px and press E to open it: body armor $200 (+50 armor), an ammo box
// $100 (+60 ammo), or a paint job $150 (cycles 6 colours for the car you
// are in). Pure rules — the renderer draws the shop panel from state.shop.
import { PAINTS, SHOP_POS } from './config.js';

export const SHOP_ITEMS = [
  { id: 'armor', name: 'Body Armor', price: 200, desc: '+50 armor (max 100)' },
  { id: 'ammo', name: 'Ammo Box', price: 100, desc: '+60 ammo' },
  { id: 'paint', name: 'Car Paint', price: 150, desc: 'next paint colour' },
];

export function createShop() {
  const data = { x: SHOP_POS.x, y: SHOP_POS.y, label: SHOP_POS.label, open: false, near: false, paintIndex: 0 };
  function isNear(state) {
    const p = state.player;
    return Math.hypot(p.x - data.x, p.y - data.y) < 90;
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
      data.paintIndex = (data.paintIndex + 1) % PAINTS.length;
      car.color = PAINTS[data.paintIndex];
    }
    state.money -= item.price;
    state.message = `Bought ${item.name} for $${item.price}.`; state.messageTimer = 3;
    return { ok: true, msg: state.message };
  }
  return { data, update, toggle, buy, items: SHOP_ITEMS };
}
