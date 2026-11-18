// Cosmetic effects: tyre skid marks, floating cash text, muzzle flash and
// camera shake, explosions and speed lines. Purely cosmetic — this module
// reads world state and never writes it, so it cannot change the rules.
export function createEffects() {
  const skids = []; const floaters = []; const flashes = []; const booms = []; const streaks = [];
  let shake = 0; let lastMoney = 0; let lastShots = 0; let lastHealth = 100;

  function addShake(n) { shake = Math.min(14, shake + n); }

  // 26 fireball particles + a hard shake, e.g. when a run ends wasted.
  function explode(x, y) {
    const colors = ['#ff5722', '#ff9800', '#ffc93c', '#ff3b30'];
    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      booms.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5, max: 1, size: 4 + Math.random() * 8, color: colors[i % colors.length],
      });
    }
    addShake(12);
  }

  function update(dt, state) {
    const p = state.player;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) {
        // Tyre skid marks behind the rear axle when fast, fading over 6 s.
        if (Math.abs(car.speed) > 320) {
          const bx = car.x - Math.cos(car.angle) * 24, by = car.y - Math.sin(car.angle) * 24;
          const px = -Math.sin(car.angle), py = Math.cos(car.angle);
          skids.push({ x: bx + px * 10, y: by + py * 10, x2: bx - px * 10, y2: by - py * 10, life: 6, max: 6 });
          if (skids.length > 140) skids.splice(0, skids.length - 140);
        }
        // Speed lines when really flying.
        if (Math.abs(car.speed) > 500) {
          streaks.push({
            x: car.x + (Math.random() - 0.5) * 320, y: car.y + (Math.random() - 0.5) * 220,
            angle: car.angle, life: 0.25, max: 0.25,
          });
        }
      }
    }
    for (let i = skids.length - 1; i >= 0; i -= 1) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
    // Floating "+$n" when the money rises.
    if (state.money > lastMoney) {
      floaters.push({ x: p.x, y: p.y - 30, text: `+$${state.money - lastMoney}`, life: 1.2, max: 1.2 });
    }
    lastMoney = state.money;
    // Muzzle flash + small shake when a shot goes off.
    if (state.shotsFired > lastShots) {
      flashes.push({ x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26, life: 0.08, max: 0.08 });
      addShake(2);
    }
    lastShots = state.shotsFired;
    // A bigger shake when the player takes damage.
    if (p.health < lastHealth) addShake(6);
    lastHealth = p.health;
    shake = Math.max(0, shake - dt * 30);
    // Decay the short-lived lists; fireballs drift while they burn.
    for (const arr of [floaters, flashes, booms, streaks]) {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        const it = arr[i]; it.life -= dt;
        if (it.vx !== undefined) { it.x += it.vx * dt; it.y += it.vy * dt; }
        if (it.life <= 0) arr.splice(i, 1);
      }
    }
  }

  // Draw in world space (the renderer calls this last, inside the camera transform).
  function draw(ctx) {
    ctx.save();
    for (const s of skids) {
      ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.45;
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = '#7CFC9A';
      ctx.fillText(f.text, f.x, f.y - (1.2 - f.life) * 40);
    }
    ctx.globalAlpha = 1;
    for (const f of flashes) {
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath(); ctx.arc(f.x, f.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of booms) {
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    for (const s of streaks) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      const dx = Math.cos(s.angle) * 46, dy = Math.sin(s.angle) * 46;
      ctx.beginPath(); ctx.moveTo(s.x - dx, s.y - dy); ctx.lineTo(s.x + dx, s.y + dy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function debug() {
    return { skids: skids.length, floaters: floaters.length, flashes: flashes.length, booms: booms.length, streaks: streaks.length, shake: Math.round(shake * 10) / 10, shots: lastShots };
  }

  return { update, draw, explode, debug, get shake() { return shake; } };
}
