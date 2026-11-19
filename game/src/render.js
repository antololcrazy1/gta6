// Drawing only: world state + screen in, pixels out. Top-down coastal city
// in four districts with distinct palettes, animated sea waves, neon signs
// that glow at night, headlight cones, rain, and a district name banner.
// HUD, minimap, shop + phone panels. 1280x720 logical view.
// v5 rewrite: districts, weather, gang turf, shop/phone panels, night light.
import { CAR, FONT, PALETTE, PLAYER, VIEW, WORLD, SHOP_POS } from './config.js';
import { IS_TOUCH, TOUCH_HINT } from './input.js';
import { MISSIONS } from './missions.js';
import { GANG_TURF } from './gang.js';
import { clockFor } from './weather.js';
import { ROADS_H, ROADS_V } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_BRIEF = 'brief';

const SUNSET = ['#ff9a56', '#ff7e5f', '#feb47b'];
// Neon signs on downtown buildings: text, position, glow colour.
const NEON_SIGNS = [
  { x: 2624, y: 620, text: 'NEON HOTEL', color: '#ff2fb3' },
  { x: 3008, y: 940, text: 'VICE', color: '#22d3ee' },
  { x: 2240, y: 1300, text: '24H TACOS', color: '#facc15' },
  { x: 2624, y: 1620, text: 'PIER 9', color: '#a78bfa' },
];

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    if (!fonts.has(size + (bold ? 'b' : ''))) fonts.set(size + (bold ? 'b' : ''), `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(size + (bold ? 'b' : ''));
    context.fillStyle = color; context.textAlign = align || 'left'; context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function rr(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y); context.arcTo(x + w, y, x + w, y + h, r); context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r); context.arcTo(x, y, x + w, y, r); context.closePath();
  }
  function drawCar(c, isPlayer) {
    context.save(); context.translate(c.x, c.y); context.rotate(c.angle);
    context.fillStyle = 'rgba(0,0,0,0.35)'; rr(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 8); context.fill();
    context.fillStyle = c.color; rr(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9); context.fill();
    context.fillStyle = '#1d2733'; rr(-6, -CAR.width / 2 + 4, 20, CAR.width - 8, 4); context.fill();
    context.fillStyle = '#bfe9ff'; rr(12, -CAR.width / 2 + 5, 8, CAR.width - 10, 3); context.fill();
    context.fillStyle = '#fff8d6'; context.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 3, 3, 6); context.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 9, 3, 6);
    context.fillStyle = '#ff3b30'; context.fillRect(-CAR.length / 2 + 1, -CAR.width / 2 + 3, 3, 6); context.fillRect(-CAR.length / 2 + 1, CAR.width / 2 - 9, 3, 6);
    if (c.cop) {
      context.fillStyle = '#fff'; context.fillRect(-14, -CAR.width / 2 + 2, 28, CAR.width - 4);
      context.fillStyle = '#2f6fd0'; text('PD', 0, 5, 11, '#2f6fd0', 'center', true);
      const blink = Math.floor(performance.now() / 260) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#3b82f6';
      context.beginPath(); context.arc(-2, -CAR.width / 2 + 2, 5, 0, Math.PI * 2); context.fill();
      context.fillStyle = blink ? '#3b82f6' : '#ff3b30';
      context.beginPath(); context.arc(10, -CAR.width / 2 + 2, 5, 0, Math.PI * 2); context.fill();
    }
    if (c.gang) {
      // Purple paint, gold trim + a gold V on the roof: the Vipers.
      context.strokeStyle = PALETTE.gangGold; context.lineWidth = 2.5;
      rr(-CAR.length / 2 + 2, -CAR.width / 2 + 2, CAR.length - 4, CAR.width - 4, 7); context.stroke();
      text('V', 0, 5, 12, PALETTE.gangGold, 'center', true);
    }
    if (isPlayer) { context.strokeStyle = '#ffc93c'; context.lineWidth = 3; rr(-CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 11); context.stroke(); }
    // Health bar for damaged cars.
    if (c.health < 100) {
      context.fillStyle = 'rgba(0,0,0,0.5)'; context.fillRect(-20, -CAR.width / 2 - 10, 40, 5);
      context.fillStyle = c.health > 40 ? '#2ecc71' : '#e74c3c'; context.fillRect(-20, -CAR.width / 2 - 10, 40 * Math.max(0, c.health) / 100, 5);
    }
    context.restore();
  }
  function drawPerson(x, y, angle, color, isPlayer, name) {
    context.save(); context.translate(x, y);
    context.fillStyle = 'rgba(0,0,0,0.3)'; context.beginPath(); context.ellipse(2, 4, 12, 9, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = color; context.beginPath(); context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#2d1a12'; context.beginPath(); context.arc(Math.cos(angle) * 5, Math.sin(angle) * 5, 6, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#ffd9b3'; context.beginPath(); context.arc(Math.cos(angle) * 8, Math.sin(angle) * 8, 4.5, 0, Math.PI * 2); context.fill();
    if (isPlayer) { context.strokeStyle = '#ffc93c'; context.lineWidth = 3; context.beginPath(); context.arc(0, 0, PLAYER.radius + 4, 0, Math.PI * 2); context.stroke(); }
    context.restore();
    if (name) text(name, x, y - 20, 12, '#fff', 'center');
  }
  // Headlight cone in front of a car at night: a soft yellow wedge.
  function drawHeadlights(c) {
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    const px = -fy, py = fx;
    const grad = context.createLinearGradient(c.x + fx * 24, c.y + fy * 24, c.x + fx * 190, c.y + fy * 190);
    grad.addColorStop(0, 'rgba(255,240,180,0.30)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
    context.fillStyle = grad;
    context.beginPath();
    context.moveTo(c.x + fx * 24 + px * 10, c.y + fy * 24 + py * 10);
    context.lineTo(c.x + fx * 190 + px * 52, c.y + fy * 190 + py * 52);
    context.lineTo(c.x + fx * 190 - px * 52, c.y + fy * 190 - py * 52);
    context.lineTo(c.x + fx * 24 - px * 10, c.y + fy * 24 - py * 10);
    context.closePath(); context.fill();
  }

  function drawWorld(state, time, fx) {
    const cam = state.camera;
    const wx = state.weather || { phase: 'day', raining: false };
    const night = wx.phase === 'night';
    const sunset = wx.phase === 'sunset';
    context.save();
    context.translate(-cam.x, -cam.y);
    // ---- sea + beach (west edge), with animated waves ----
    context.fillStyle = PALETTE.seaDeep; context.fillRect(cam.x - 20, cam.y - 20, 150, VIEW.height + 40);
    context.fillStyle = PALETTE.sea; context.fillRect(cam.x - 20, cam.y - 20, 130, VIEW.height + 40);
    context.strokeStyle = 'rgba(255,255,255,0.35)'; context.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const wy = cam.y + ((i * 137 + Math.floor(time * 30)) % (VIEW.height + 80)) - 40;
      const sway = Math.sin(time * 1.4 + i * 1.7) * 10;
      context.beginPath(); context.moveTo(cam.x, wy); context.quadraticCurveTo(cam.x + 40 + sway, wy + 12, cam.x + 95, wy); context.stroke();
    }
    // A moored boat at the pier (the Harbor Lights delivery boat).
    context.save(); context.translate(110, 1280);
    context.fillStyle = '#5b3a1e'; rr(-52, -16, 104, 32, 12); context.fill();
    context.fillStyle = '#f5f0e6'; rr(-30, -26, 60, 16, 6); context.fill();
    context.fillStyle = '#ff9a56'; context.fillRect(-4, -52, 5, 28);
    context.fillStyle = '#ffd76a'; context.beginPath(); context.moveTo(1, -52); context.lineTo(26, -38); context.lineTo(1, -30); context.closePath(); context.fill();
    context.restore();
    context.fillStyle = PALETTE.sand; context.fillRect(130, cam.y - 20, 130, VIEW.height + 40);
    context.fillStyle = PALETTE.sandDark;
    for (let i = 0; i < 8; i += 1) { context.beginPath(); context.arc(170 + (i * 53) % 70, cam.y + (i * 173) % VIEW.height, 5, 0, Math.PI * 2); context.fill(); }
    // ---- district ground washes (each district its own palette) ----
    context.fillStyle = PALETTE.suburbs; context.fillRect(260, cam.y - 20, WORLD.width, VIEW.height + 40);
    context.fillStyle = PALETTE.downtown; context.fillRect(2240, 0, WORLD.width - 2240, 1600);
    context.fillStyle = PALETTE.docks; context.fillRect(2624, 1600, WORLD.width - 2624, WORLD.height - 1600);
    // Parks.
    for (const pk of state.parks) {
      context.fillStyle = PALETTE.grass; context.fillRect(pk.x, pk.y, pk.w, pk.h);
      context.fillStyle = PALETTE.grassDark; context.fillRect(pk.x + 8, pk.y + 8, pk.w - 16, pk.h - 16);
    }
    for (const t of state.trees) {
      context.fillStyle = '#2e7d32'; context.beginPath(); context.arc(t.x, t.y, t.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#66bb6a'; context.beginPath(); context.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); context.fill();
    }
    // Roads (+ a wet-road sheen when it rains).
    context.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_V) context.fillRect(x - 48, cam.y - 20, 96, VIEW.height + 40);
    for (const y of ROADS_H) context.fillRect(cam.x - 20, y - 48, VIEW.width + 40, 96);
    context.fillStyle = PALETTE.road;
    for (const x of ROADS_V) context.fillRect(x - 36, cam.y - 20, 72, VIEW.height + 40);
    for (const y of ROADS_H) context.fillRect(cam.x - 20, y - 36, VIEW.width + 40, 72);
    if (wx.raining) {
      context.fillStyle = 'rgba(180,210,255,0.10)';
      for (const x of ROADS_V) context.fillRect(x - 36, cam.y - 20, 72, VIEW.height + 40);
      for (const y of ROADS_H) context.fillRect(cam.x - 20, y - 36, VIEW.width + 40, 72);
    }
    context.strokeStyle = '#ffd76a'; context.lineWidth = 2; context.setLineDash([18, 22]);
    for (const x of ROADS_V) { context.beginPath(); context.moveTo(x, cam.y - 20); context.lineTo(x, cam.y + VIEW.height + 20); context.stroke(); }
    for (const y of ROADS_H) { context.beginPath(); context.moveTo(cam.x - 20, y); context.lineTo(cam.x + VIEW.width + 20, y); context.stroke(); }
    context.setLineDash([]);
    // Pier (wooden deck into the sea at y=1280).
    context.fillStyle = '#8d5a2b'; context.fillRect(0, 1240, 300, 80);
    context.fillStyle = '#a9743f';
    for (let x = 10; x < 300; x += 26) context.fillRect(x, 1244, 18, 72);
    context.fillStyle = '#ffd76a';
    for (let x = 20; x < 290; x += 40) { context.beginPath(); context.arc(x, 1252, 3, 0, Math.PI * 2); context.fill(); }
    // Gang turf: a purple wash + a pulsing marker ring on each turf district.
    for (const turf of GANG_TURF) {
      context.fillStyle = 'rgba(142,68,173,0.10)';
      context.beginPath(); context.arc(turf.x, turf.y, turf.r, 0, Math.PI * 2); context.fill();
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      context.strokeStyle = 'rgba(193,132,252,0.85)'; context.lineWidth = 3;
      context.beginPath(); context.arc(turf.x, turf.y, 46 * pulse, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#c084fc';
      context.beginPath(); context.moveTo(turf.x, turf.y - 58); context.lineTo(turf.x + 12, turf.y - 38); context.lineTo(turf.x - 12, turf.y - 38); context.closePath(); context.fill();
      text('VIPER TURF', turf.x, turf.y + 66, 13, '#e9d5ff', 'center', true);
    }
    // Buildings.
    for (const b of state.buildings) {
      if (b.x > cam.x + VIEW.width + 40 || b.x + b.w < cam.x - 40 || b.y > cam.y + VIEW.height + 40 || b.y + b.h < cam.y - 40) continue;
      context.fillStyle = 'rgba(0,0,0,0.3)'; context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color; context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof; context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = night ? 'rgba(255,214,120,0.9)' : 'rgba(255,255,255,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 34)), rows = Math.max(2, Math.floor(b.h / 32));
      for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
        if (((i * 3 + j * 7 + Math.floor(b.seed * 10)) % 4) === 0) continue;
        context.fillRect(b.x + 16 + i * ((b.w - 28) / cols), b.y + 16 + j * ((b.h - 28) / rows), 12, 10);
      }
    }
    // Neon signs in Neon Downtown: they glow hard at night, softly by day.
    for (const s of NEON_SIGNS) {
      if (s.x < cam.x - 120 || s.x > cam.x + VIEW.width + 120 || s.y < cam.y - 40 || s.y > cam.y + VIEW.height + 40) continue;
      const glow = night ? 0.95 : sunset ? 0.6 : 0.3;
      context.save();
      context.globalAlpha = glow;
      context.shadowColor = s.color; context.shadowBlur = night ? 22 : 8;
      context.fillStyle = s.color;
      context.font = `700 26px ${FONT}`; context.textAlign = 'center';
      context.fillText(s.text, s.x, s.y);
      context.restore();
    }
    // Shop front: Sunset Arms & Paint, on the road by the Neon Hotel.
    context.save(); context.translate(SHOP_POS.x, SHOP_POS.y);
    context.fillStyle = '#2c2118'; rr(-46, -30, 92, 60, 8); context.fill();
    context.strokeStyle = '#ffc93c'; context.lineWidth = 3; rr(-46, -30, 92, 60, 8); context.stroke();
    text('ARMS', 0, -6, 15, '#ffc93c', 'center', true);
    text('& PAINT', 0, 12, 11, '#fff7e8', 'center', true);
    context.restore();
    // Mission target beacon.
    const target = state.missionTarget;
    if (target && !state.over) {
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      context.save(); context.translate(target.x, target.y);
      context.strokeStyle = '#ffc93c'; context.lineWidth = 4;
      context.beginPath(); context.arc(0, 0, 34 * pulse, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#ffc93c';
      context.beginPath(); context.moveTo(0, -58); context.lineTo(14, -34); context.lineTo(-14, -34); context.closePath(); context.fill();
      context.restore();
      text(target.label, target.x, target.y - 68, 15, '#ffc93c', 'center', true);
    }
    // Phone job target (blue diamond) when a side job is active.
    const job = state.phone && state.phone.job;
    if (job && job.target && !state.over) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      context.save(); context.translate(job.target.x, job.target.y);
      context.strokeStyle = '#38bdf8'; context.lineWidth = 4;
      context.beginPath(); context.arc(0, 0, 28 * pulse, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#38bdf8';
      context.beginPath(); context.moveTo(0, -12); context.lineTo(9, 0); context.lineTo(0, 12); context.lineTo(-9, 0); context.closePath(); context.fill();
      context.restore();
      text(job.label, job.target.x, job.target.y - 40, 13, '#7dd3fc', 'center', true);
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(time * 3 + pk.bob) * 3;
      context.save(); context.translate(pk.x, pk.y + bob);
      if (pk.kind === 'hidden') {
        // Gold diamond with a twinkling inner facet and a sparkle tick.
        context.fillStyle = '#ffc93c';
        context.beginPath(); context.moveTo(0, -13); context.lineTo(10, 0); context.lineTo(0, 13); context.lineTo(-10, 0); context.closePath(); context.fill();
        context.fillStyle = '#fff3c4';
        const tw = 1 + Math.sin(time * 5 + pk.bob) * 0.3;
        context.beginPath(); context.moveTo(0, -6 * tw); context.lineTo(4, 0); context.lineTo(0, 6 * tw); context.lineTo(-4, 0); context.closePath(); context.fill();
        context.strokeStyle = 'rgba(255,255,255,0.9)'; context.lineWidth = 2;
        const sp = 16 + Math.sin(time * 4 + pk.bob) * 3;
        context.beginPath(); context.moveTo(sp, -sp); context.lineTo(sp + 6, -sp - 6); context.stroke();
      }
      else if (pk.kind === 'cash') { context.fillStyle = '#2ecc71'; rr(-13, -9, 26, 18, 3); context.fill(); context.fillStyle = '#fff'; text('$', 0, 5, 15, '#fff', 'center', true); }
      else if (pk.kind === 'health') { context.fillStyle = '#fff'; rr(-11, -11, 22, 22, 5); context.fill(); context.fillStyle = '#e74c3c'; context.fillRect(-3, -8, 6, 16); context.fillRect(-8, -3, 16, 6); }
      else if (pk.kind === 'ammo') { context.fillStyle = '#f39c12'; rr(-11, -8, 22, 16, 3); context.fill(); context.fillStyle = '#2c3e50'; context.fillRect(-6, -4, 12, 8); }
      else { context.fillStyle = '#3498db'; rr(-12, -8, 24, 16, 4); context.fill(); context.fillStyle = '#fff'; text('🔧', 0, 5, 12, '#fff', 'center'); }
      context.restore();
    }
    // Headlight cones at night (player car + cop cars + gang cars).
    if (night) {
      const pl = state.player;
      if (pl.inCar) { const car = state.cars.find((c) => c.id === pl.carId); if (car) drawHeadlights(car); }
      for (const c of state.cars) if (c.cop) drawHeadlights(c);
      for (const g of state.gangCars) drawHeadlights(g);
    }
    // Traffic + player cars.
    for (const c of state.cars) drawCar(c, state.player.inCar && state.player.carId === c.id);
    // Gang cars (purple with gold trim).
    for (const g of state.gangCars) drawCar(g, false);
    // Pedestrians (a waiting taxi fare stands out with a TAXI tag).
    for (const p of state.peds) if (p.alive) drawPerson(p.x, p.y, p.angle, p.color, false, p.fare ? 'TAXI' : null);
    // Foot cops.
    for (const cop of state.cops) {
      if (cop.dead || cop.inCar) continue;
      drawPerson(cop.x, cop.y, Math.atan2(state.player.y - cop.y, state.player.x - cop.x), '#2f6fd0', false, null);
      context.fillStyle = '#fff'; context.fillRect(cop.x - 7, cop.y - 4, 14, 8);
    }
    // Bullets + particles.
    context.fillStyle = '#ffe66d';
    for (const b of state.bullets) { context.fillStyle = b.gang ? '#e879f9' : '#ffe66d'; context.beginPath(); context.arc(b.x, b.y, 4, 0, Math.PI * 2); context.fill(); }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color; context.beginPath(); context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
    // Player on foot.
    const pl = state.player;
    if (!pl.inCar && !(pl.invuln > 0 && Math.floor(pl.invuln * 10) % 2 === 0)) {
      drawPerson(pl.x, pl.y, pl.angle, '#ff4757', true, null);
      // Gun direction tick.
      context.strokeStyle = '#fff'; context.lineWidth = 3;
      context.beginPath(); context.moveTo(pl.x + Math.cos(pl.angle) * 16, pl.y + Math.sin(pl.angle) * 16); context.lineTo(pl.x + Math.cos(pl.angle) * 26, pl.y + Math.sin(pl.angle) * 26); context.stroke();
    }
    // Police helicopter (4+ stars): flies above the traffic, spotlight on the player.
    const heli = state.heli;
    if (heli) {
      // Ground shadow, offset down-right as if the sun is low in the west.
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.beginPath(); context.ellipse(heli.x + 26, heli.y + 30, 34, 14, 0, 0, Math.PI * 2); context.fill();
      // Spotlight cone + lit pool on the player.
      const dx = pl.x - heli.x, dy = pl.y - heli.y;
      const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d, px = -ny, py = nx;
      context.fillStyle = 'rgba(255,255,240,0.13)';
      context.beginPath();
      context.moveTo(heli.x, heli.y);
      context.lineTo(pl.x + px * 46, pl.y + py * 46);
      context.lineTo(pl.x - px * 46, pl.y - py * 46);
      context.closePath(); context.fill();
      context.fillStyle = 'rgba(255,255,240,0.20)';
      context.beginPath(); context.arc(pl.x, pl.y, 42, 0, Math.PI * 2); context.fill();
      context.save(); context.translate(heli.x, heli.y);
      context.rotate(Math.atan2(dy, dx));
      // Rotor blur disc + spinning blades.
      context.fillStyle = 'rgba(255,255,255,0.10)';
      context.beginPath(); context.arc(0, 0, 40, 0, Math.PI * 2); context.fill();
      context.strokeStyle = 'rgba(20,20,30,0.75)'; context.lineWidth = 4;
      const r = heli.rotor;
      context.beginPath(); context.moveTo(Math.cos(r) * -38, Math.sin(r) * -38); context.lineTo(Math.cos(r) * 38, Math.sin(r) * 38); context.stroke();
      context.beginPath(); context.moveTo(Math.cos(r + Math.PI / 2) * -38, Math.sin(r + Math.PI / 2) * -38); context.lineTo(Math.cos(r + Math.PI / 2) * 38, Math.sin(r + Math.PI / 2) * 38); context.stroke();
      // Tail, body, cockpit, blinking beacon.
      context.fillStyle = '#1c2733'; rr(-34, -5, 22, 10, 4); context.fill();
      context.fillStyle = '#22303e'; rr(-14, -11, 32, 22, 10); context.fill();
      context.fillStyle = '#bfe9ff'; rr(6, -7, 10, 14, 4); context.fill();
      const blink = Math.floor(time * 3) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#ffffff';
      context.beginPath(); context.arc(-16, 0, 4, 0, Math.PI * 2); context.fill();
      context.restore();
      text('VCPD', heli.x, heli.y + 4, 10, '#fff', 'center', true);
    }
    // Cosmetic effects last, in world space: skids, floaters, flashes, booms.
    if (fx) fx.draw(context);
    context.restore();
    // ---- screen-space weather: night darkness, streetlight glow, rain ----
    if (sunset) { context.fillStyle = 'rgba(255,122,89,0.16)'; context.fillRect(0, 0, VIEW.width, VIEW.height); }
    if (night) {
      context.fillStyle = 'rgba(8,8,32,0.42)'; context.fillRect(0, 0, VIEW.width, VIEW.height);
      // Streetlight pools at the road intersections in view.
      for (const x of ROADS_V) for (const y of ROADS_H) {
        const sx = x - cam.x, sy = y - cam.y;
        if (sx < -80 || sx > VIEW.width + 80 || sy < -80 || sy > VIEW.height + 80) continue;
        const g = context.createRadialGradient(sx, sy, 4, sx, sy, 70);
        g.addColorStop(0, 'rgba(255,220,140,0.20)'); g.addColorStop(1, 'rgba(255,220,140,0)');
        context.fillStyle = g; context.beginPath(); context.arc(sx, sy, 70, 0, Math.PI * 2); context.fill();
      }
    }
    if (wx.raining) {
      context.strokeStyle = 'rgba(190,215,255,0.5)'; context.lineWidth = 1.5;
      for (let i = 0; i < 90; i += 1) {
        const rx = (i * 173 + Math.floor(time * 900)) % (VIEW.width + 40) - 20;
        const ry = (i * 271 + Math.floor(time * 1400)) % (VIEW.height + 40) - 20;
        context.beginPath(); context.moveTo(rx, ry); context.lineTo(rx - 6, ry + 16); context.stroke();
      }
    }
  }

  function drawMinimap(state) {
    const mw = 210, mh = 152, mx = VIEW.width - mw - 16, my = 16;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,10,22,0.78)'; rr(mx - 6, my - 6, mw + 12, mh + 12, 10); context.fill();
    context.strokeStyle = '#ffc93c'; context.lineWidth = 2; rr(mx - 6, my - 6, mw + 12, mh + 12, 10); context.stroke();
    context.fillStyle = '#1b6f8e'; context.fillRect(mx, my, 130 * sx, mh);
    context.fillStyle = '#e8c98f'; context.fillRect(mx + 130 * sx, my, 130 * sx, mh);
    context.fillStyle = '#3a3f47';
    for (const x of ROADS_V) context.fillRect(mx + x * sx - 1, my, 2, mh);
    for (const y of ROADS_H) context.fillRect(mx, my + y * sy - 1, mw, 2);
    context.fillStyle = '#4f9e57';
    for (const pk of state.parks) context.fillRect(mx + pk.x * sx, my + pk.y * sy, Math.max(2, pk.w * sx), Math.max(2, pk.h * sy));
    // Gang turf on the minimap (purple dots).
    context.fillStyle = '#c084fc';
    for (const turf of GANG_TURF) { context.beginPath(); context.arc(mx + turf.x * sx, my + turf.y * sy, 5, 0, Math.PI * 2); context.fill(); }
    // Shop marker (gold square).
    context.fillStyle = '#ffc93c'; context.fillRect(mx + SHOP_POS.x * sx - 3, my + SHOP_POS.y * sy - 3, 6, 6);
    const t = state.missionTarget;
    if (t && !state.over) { context.fillStyle = '#ffc93c'; context.beginPath(); context.arc(mx + t.x * sx, my + t.y * sy, 6, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 2; context.stroke(); }
    for (const c of state.cars) { if (c.cop) { context.fillStyle = '#3b82f6'; context.fillRect(mx + c.x * sx - 3, my + c.y * sy - 3, 6, 6); } }
    for (const g of state.gangCars) { context.fillStyle = '#c084fc'; context.fillRect(mx + g.x * sx - 3, my + g.y * sy - 3, 6, 6); }
    if (state.heli) {
      context.fillStyle = '#fff'; context.beginPath(); context.arc(mx + state.heli.x * sx, my + state.heli.y * sy, 4, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#2f6fd0'; context.lineWidth = 2; context.stroke();
    }
    context.fillStyle = '#ff4757'; context.beginPath(); context.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#fff'; context.lineWidth = 2; context.stroke();
    text('N ↑', mx + mw - 8, my + mh - 8, 12, '#fff', 'right', true);
    text('VICE COAST', mx + 4, my + mh - 8, 11, '#ffd9a0', 'left', true);
  }

  function drawHud(state, muted, radioName, extra) {
    const wx = state.weather || { phase: 'day', raining: false, t: 0 };
    // Top-left status panel — tall enough that the wanted stars sit INSIDE it.
    context.fillStyle = PALETTE.hudBg; rr(14, 14, 300, 196, 12); context.fill();
    text(`$${state.money.toLocaleString()}`, 30, 48, 30, '#7CFC9A', 'left', true);
    text(`RESPECT ${state.respect}`, 30, 74, 15, PALETTE.muted, 'left', true);
    // Health bar.
    context.fillStyle = 'rgba(255,255,255,0.2)'; rr(30, 84, 180, 12, 6); context.fill();
    context.fillStyle = state.player.health > 40 ? '#2ecc71' : '#e74c3c'; rr(30, 84, 180 * Math.max(0, state.player.health) / 100, 12, 6); context.fill();
    text(`HP ${Math.max(0, Math.round(state.player.health))}`, 220, 96, 14, '#fff', 'left', true);
    // Armor bar (bought at the shop).
    context.fillStyle = 'rgba(255,255,255,0.2)'; rr(30, 102, 180, 8, 4); context.fill();
    context.fillStyle = '#38bdf8'; rr(30, 102, 180 * Math.max(0, state.player.armor) / 100, 8, 4); context.fill();
    text(`ARMOR ${Math.round(state.player.armor)}`, 220, 111, 12, '#7dd3fc', 'left', true);
    // Wanted stars, inside the panel: label at y 150, stars centred y 158.
    text('WANTED', 30, 150, 13, '#ffb3b3', 'left', true);
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < state.wanted ? '#ffd700' : 'rgba(255,255,255,0.25)';
      const sx = 110 + i * 26, sy = 158;
      context.beginPath();
      for (let k = 0; k < 10; k += 1) { const a = -Math.PI / 2 + k * (Math.PI / 5); const r = k % 2 ? 5 : 11; const px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r; if (k === 0) context.moveTo(px, py); else context.lineTo(px, py); }
      context.closePath(); context.fill();
    }
    text(`${state.district}  •  ${clockFor(wx.t)} ${wx.phase.toUpperCase()}${wx.raining ? ' • RAIN' : ''}`, 30, 196, 13, '#ffd9a0', 'left', true);
    if (muted) text('MUTED (M)', 30, 216, 13, '#ccc', 'left');
    // Hidden packages tracker, tucked under the status panel.
    context.fillStyle = PALETTE.hudBg; rr(14, 224, 172, 30, 9); context.fill();
    text(`◆ PACKAGES ${state.hiddenFound}/${state.hiddenTotal}`, 30, 245, 14, '#ffc93c', 'left', true);
    // Radio station, under the packages pill (Q changes station).
    if (radioName) {
      context.fillStyle = PALETTE.hudBg; rr(14, 262, 272, 30, 9); context.fill();
      text(`♪ ${radioName} • Q to change station`, 30, 283, 14, '#ffd9a0', 'left', true);
    }
    drawMinimap(state);
    // Objective banner.
    if (state.missionText && !state.over) {
      const w = Math.min(720, 40 + state.missionText.length * 9.5);
      context.fillStyle = state.missionFlash > 0 ? 'rgba(255,201,60,0.92)' : PALETTE.hudBg;
      rr((VIEW.width - w) / 2, 14, w, 44, 10); context.fill();
      text(state.missionText, VIEW.width / 2, 43, 18, state.missionFlash > 0 ? '#1a1a2e' : '#fff7e8', 'center', true);
    }
    // Mission progress + timer.
    text(`MISSION ${Math.min(state.missionIndex + 1, MISSIONS.length)}/${MISSIONS.length}  •  AMMO ${state.player.ammo}`, VIEW.width / 2, 78, 15, '#fff', 'center', true);
    if (state.missionTimer > 0 && state.missionIndex < MISSIONS.length) {
      text(`⏱ ${Math.ceil(state.missionTimer)}s`, VIEW.width / 2, 104, 22, state.missionTimer < 15 ? '#ff6b6b' : '#ffc93c', 'center', true);
    }
    // Active phone side job, under the timer.
    const job = state.phone && state.phone.job;
    if (job) {
      const jobLine = job.timer > 0 ? `${job.label} — ${Math.ceil(job.timer)}s` : job.type === 'vigilante' ? `${job.label} (${job.done}/${job.need})` : job.label;
      context.fillStyle = 'rgba(14,40,60,0.8)'; const jw = 40 + jobLine.length * 8.5; rr((VIEW.width - jw) / 2, 116, jw, 32, 9); context.fill();
      text(`☎ ${jobLine}`, VIEW.width / 2, 138, 15, '#7dd3fc', 'center', true);
    }
    // District name banner when entering a district.
    if (state.districtTimer > 0) {
      const a = Math.min(1, state.districtTimer);
      context.globalAlpha = a;
      text(state.district.toUpperCase(), VIEW.width / 2, 210, 44, '#fff', 'center', true);
      context.globalAlpha = a * 0.8;
      text('— VICE COAST —', VIEW.width / 2, 236, 15, '#ffd9a0', 'center', true);
      context.globalAlpha = 1;
    }
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = 'rgba(0,0,0,0.55)'; const mw = 30 + state.message.length * 8.5; rr((VIEW.width - mw) / 2, VIEW.height - 96, mw, 36, 9); context.fill();
      text(state.message, VIEW.width / 2, VIEW.height - 71, 17, '#fff', 'center');
    }
    // Shop hint when standing by the shop.
    if (state.shop && state.shop.near && !state.shop.open) {
      context.fillStyle = 'rgba(0,0,0,0.55)'; const sw = 560; rr((VIEW.width - sw) / 2, VIEW.height - 140, sw, 32, 9); context.fill();
      text('E — Sunset Arms & Paint: armor $200 • ammo $100 • paint $150', VIEW.width / 2, VIEW.height - 118, 15, '#ffc93c', 'center', true);
    }
    // Speedometer in car.
    if (state.player.inCar) {
      const car = state.cars.find((c) => c.id === state.player.carId);
      const kmh = car ? Math.round(Math.abs(car.speed) * 0.32) : 0;
      context.fillStyle = PALETTE.hudBg; rr(VIEW.width - 190, VIEW.height - 96, 176, 82, 12); context.fill();
      text(`${kmh}`, VIEW.width - 102, VIEW.height - 38, 40, '#fff', 'center', true);
      text('km/h', VIEW.width - 102, VIEW.height - 20, 13, PALETTE.muted, 'center');
      if (car) {
        context.fillStyle = 'rgba(255,255,255,0.2)'; rr(VIEW.width - 176, VIEW.height - 86, 148, 8, 4); context.fill();
        context.fillStyle = car.health > 40 ? '#2ecc71' : '#e74c3c'; rr(VIEW.width - 176, VIEW.height - 86, 148 * Math.max(0, car.health) / 100, 8, 4); context.fill();
      }
    } else {
      text(IS_TOUCH ? TOUCH_HINT : 'SPACE: enter car   •   CLICK / J: shoot   •   E: shop   •   P: phone', 16, VIEW.height - 18, 14, 'rgba(255,255,255,0.75)', 'left');
    }
    // Off-screen mission arrow.
    const tgt = state.missionTarget;
    if (tgt && !state.over) {
      const cam = state.camera;
      const onScreen = tgt.x > cam.x && tgt.x < cam.x + VIEW.width && tgt.y > cam.y && tgt.y < cam.y + VIEW.height;
      if (!onScreen) {
        const cx = VIEW.width / 2, cy = VIEW.height / 2;
        const a = Math.atan2(tgt.y - state.player.y, tgt.x - state.player.x);
        const ax = cx + Math.cos(a) * 300, ay = cy + Math.sin(a) * 220;
        context.save(); context.translate(ax, ay); context.rotate(a);
        context.fillStyle = '#ffc93c'; context.beginPath(); context.moveTo(18, 0); context.lineTo(-10, -12); context.lineTo(-10, 12); context.closePath(); context.fill();
        context.restore();
        text(`${Math.round(Math.hypot(tgt.x - state.player.x, tgt.y - state.player.y) / 10) * 10}m`, ax, ay - 18, 14, '#ffc93c', 'center', true);
      }
    }
  }

  function drawPanel(title, lines, prompt, accent, dy) {
    const w = 680; const h = 150 + lines.length * 32 + 70;
    const x = (VIEW.width - w) / 2, y = (VIEW.height - h) / 2 + (dy || 0);
    context.fillStyle = PALETTE.panel; rr(x, y, w, h, 18); context.fill();
    context.strokeStyle = accent || '#ffc93c'; context.lineWidth = 3; rr(x, y, w, h, 18); context.stroke();
    text(title, VIEW.width / 2, y + 72, 46, accent || '#ffc93c', 'center', true);
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 118 + i * 32, 20, '#fff7e8', 'center'));
    text(prompt, VIEW.width / 2, y + h - 30, 20, '#ffc93c', 'center', true);
  }

  function drawShopPanel(state) {
    const items = [
      '1 — Body Armor  $200  (+50 armor)',
      '2 — Ammo Box  $100  (+60 ammo)',
      '3 — Car Paint  $150  (next colour)',
    ];
    drawPanel('SUNSET ARMS & PAINT', [
      `Cash: $${state.money.toLocaleString()}  •  Armor ${Math.round(state.player.armor)}/100  •  Ammo ${state.player.ammo}`,
      ...items,
      'Paint applies to the car you are in — get in a car first.',
    ], 'Press 1 / 2 / 3 to buy  •  E to close', '#ffc93c');
  }

  function drawPhonePanel(state) {
    const job = state.phone && state.phone.job;
    drawPanel('VICE PHONE — SIDE JOBS', [
      '1 — Courier  $80   Deliver a package in 60s',
      '2 — Vigilante  $120   Take out 2 wanted cars',
      '3 — Racer  $150   Hit 3 checkpoints in 45s',
      job ? `Active: ${job.label}` : 'No job running — pick one and earn on the side.',
    ], 'Press 1 / 2 / 3 to start  •  P to close', '#38bdf8');
  }

  function draw(state, screen, best, extra) {
    const time = (extra && extra.time) || 0;
    const muted = extra && extra.muted;
    const fx = extra && extra.effects;
    const radioName = extra && extra.radio;
    const hasSave = extra && extra.hasSave;
    const saveData = extra && extra.saveData;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#14101f'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Camera shake from the effects layer (muzzle flash, damage, explosions).
    if (fx && fx.shake > 0.2) context.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    drawWorld(state, time, fx);
    // Sunset gradient overlay for warmth.
    const grad = context.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(255,122,89,0.10)'); grad.addColorStop(0.6, 'rgba(255,122,89,0.03)'); grad.addColorStop(1, 'rgba(43,16,80,0.14)');
    context.fillStyle = grad; context.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      const g2 = context.createLinearGradient(0, 0, 0, VIEW.height);
      g2.addColorStop(0, 'rgba(20,8,40,0.25)'); g2.addColorStop(1, 'rgba(20,8,40,0.72)');
      context.fillStyle = g2; context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('VICE COAST', VIEW.width / 2, 118, 84, '#fff', 'center', true);
      text('★  SUNSET CITY  •  STEAL  •  DRIVE  •  ESCAPE  ★', VIEW.width / 2, 156, 21, SUNSET[2], 'center', true);
      const lines = [
        'Explore a sun-soaked coastal city on foot and by car.',
        'Steal cars, dodge the Vice Coast PD, and run 10 story missions.',
        'Day turns to night, rain slicks the roads, the Vipers hold turf.',
        IS_TOUCH ? TOUCH_HINT : 'WASD move  •  SPACE enter car  •  CLICK / J shoot  •  SHIFT sprint',
        IS_TOUCH ? 'RADIO / PHONE buttons on the right  •  Your best money is saved' : 'E shop  •  P phone jobs  •  Q radio  •  Your best money is saved',
        best > 0 ? `Best money so far: $${best.toLocaleString()}` : 'First time in Vice Coast? The pier is a good place to start.',
      ];
      if (hasSave && saveData) lines.push(`C — Continue: mission ${Math.min(saveData.missionsDone + 1, MISSIONS.length)}/10, $${saveData.money.toLocaleString()} saved`);
      drawPanel('An open-world crime story', lines, IS_TOUCH ? 'Tap START GAME below' : 'Press SPACE or click to start', '#ff9a56', 55);
      return;
    }
    drawHud(state, muted, radioName, extra);
    if (state.shop && state.shop.open) drawShopPanel(state);
    else if (state.phone && state.phone.open) drawPhonePanel(state);
    else if (screen === SCREEN_BRIEF) {
      const m = MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
      drawPanel(`Mission ${m.id}: ${m.name}`, [m.brief, `Reward: $${m.reward}`, 'Get in a car — Vice Coast is big.'], IS_TOUCH ? 'Tap START MISSION below' : 'Press ENTER to start the mission', '#ffc93c');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', `Money $${state.money.toLocaleString()}  •  Mission ${Math.min(state.missionIndex + 1, MISSIONS.length)}/${MISSIONS.length}`, 'M mute  •  R restart run'], 'Press P to resume', '#7ec8ff');
    } else if (screen === SCREEN_OVER) {
      drawPanel(state.over === 'busted' ? 'BUSTED!' : 'WASTED!', [
        state.overReason || 'The run is over.',
        `Money earned: $${state.money.toLocaleString()}  •  Missions done: ${state.missionsDone}/${MISSIONS.length}`,
        `Best money: $${Math.max(best, state.money).toLocaleString()}`,
      ], 'Press R or SPACE to play again', '#ff6b6b');
    } else if (screen === SCREEN_WIN) {
      drawPanel('VICE COAST IS YOURS!', [
        'You pulled off the Vice Coast Finale and escaped clean.',
        `Final take: $${state.money.toLocaleString()}  •  Respect ${state.respect}`,
        `All ${MISSIONS.length} missions complete. Free roam continues — enjoy the sunset.`,
      ], 'Press R or SPACE to play again', '#ffc93c');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
