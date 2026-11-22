// Sunset Arms & Paint: the shop near Neon Downtown where the player buys
// armour, ammo, health and paint. Buying is instant and priced in dollars;
// the world decides when the shop is open (the player must be on foot and
// near the door) and this module decides what a purchase does.
import { LANDMARKS } from './config.js';

export const SHOP = {
  x: LANDMARKS.sunsetArms.x,
  y: LANDMARKS.sunsetArms.y,
  name: 'Sunset Arms & Paint',
  radius: 220,
};

export const SHOP_ITEMS = [
  { id: 'armor', name: 'Body Armour', price: 200, desc: '+50 armour' },
  { id: 'ammo', name: 'Ammo Box', price: 100, desc: '+60 ammo' },
  { id: 'health', name: 'First Aid', price: 150, desc: 'Full health' },
  { id: 'paint', name: 'Car Paint', price: 300, desc: 'Fresh paint job' },
  { id: 'repair', name: 'Car Repair', price: 100, desc: 'Fix your car' },
];

// Buy one item. Returns { ok, reason }. The state is mutated on success.
export function buyItem(state, id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return { ok: false, reason: 'no such item' };
  if (state.money < item.price) return { ok: false, reason: 'not enough money' };
  const p = state.player;
  if (id === 'armor') {
    if (p.armor >= 100) return { ok: false, reason: 'armour already full' };
    state.money -= item.price;
    p.armor = Math.min(100, p.armor + 50);
    return { ok: true, item: id };
  }
  if (id === 'ammo') {
    state.money -= item.price;
    p.ammo += 60;
    return { ok: true, item: id };
  }
  if (id === 'health') {
    if (p.health >= 100) return { ok: false, reason: 'health already full' };
    state.money -= item.price;
    p.health = 100;
    return { ok: true, item: id };
  }
  if (id === 'paint') {
    const car = state.cars.find((c) => c.id === state.player.carId);
    if (!car) return { ok: false, reason: 'no car to paint' };
    state.money -= item.price;
    car.color = 0xd84a9a;
    car.painted = true;
    return { ok: true, item: id };
  }
  if (id === 'repair') {
    const car = state.cars.find((c) => c.id === state.player.carId);
    if (!car) return { ok: false, reason: 'no car to repair' };
    if (car.health >= 100) return { ok: false, reason: 'car already fixed' };
    state.money -= item.price;
    car.health = 100;
    return { ok: true, item: id };
  }
  return { ok: false, reason: 'unknown item' };
}

// True when the player is close enough to the shop door to open it.
export function nearShop(state) {
  const p = state.player;
  return Math.hypot(p.x - SHOP.x, p.y - SHOP.y) < SHOP.radius;
}
