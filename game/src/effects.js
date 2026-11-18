// Vice Coast effects — screen shake, tyre skid marks, muzzle flashes and
// floating score text, plus explosions and speed lines at top speed. Purely
// cosmetic: it reads world state each frame and never writes it, so it cannot
// break the simulation. The renderer draws it in world space after the city,
// before the HUD.
export function createEffects() {
  const skids = []; // {x, y, angle, life}
  const floaters = []; // {x, y, text, color, life}
  const flashes = []; // {x, y, angle, life}
  const booms = []; // {x, y, vx, vy, size, color, life}
  const streaks = []; // {x, y, angle, life} — speed lines behind a fast car
  let shake = 0;
  let lastMoney = 0;
  let lastShots = 0;
  let lastHealth = 100;

  function addSkid(x, y, angle) {
    skids.push({ x, y, angle, life: 6 });
    if (skids.length > 140) skids.shift();
  }

  // A car going up in flames: fireball particles, a flash and a hard shake.
  // Called from main.js when a run ends wasted.
  function explode(x, y) {
    const colors = ['#ff9f1c', '#ff5e3a', '#ffd166', '#7a7a7a'];
    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 320;
      booms.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 5 + Math.random() * 12, color: colors[i % colors.length], life: 0.5 + Math.random() * 0.7 });
    }
    shake = Math.min(16, shake + 14);
  }

  return {
    get shake() { return shake; },
    explode,

    // Called once per fixed step from main.js with the live world state.
    update(dt, state) {
      if (shake > 0) shake = Math.max(0, shake - dt * 26);
      const p = state.player;
      // Hard cornering in a car leaves dark tyre marks behind the rear axle.
      if (p.inCar && Math.abs(p.speed) > 320) {
        const rearX = p.x - Math.cos(p.angle) * 22;
        const rearY = p.y - Math.sin(p.angle) * 22;
        const prev = skids[skids.length - 1];
        if (!prev || Math.hypot(prev.x - rearX, prev.y - rearY) > 14) {
          addSkid(rearX, rearY, p.angle);
        }
        // Flat out (near top speed) the world streaks past: speed lines.
        if (Math.abs(p.speed) > 500 && Math.random() < 0.6) {
          streaks.push({ x: p.x - Math.cos(p.angle) * 60 + (Math.random() - 0.5) * 90, y: p.y - Math.sin(p.angle) * 60 + (Math.random() - 0.5) * 90, angle: p.angle, life: 0.3 });
        }
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = streaks.length - 1; i >= 0; i -= 1) {
        streaks[i].life -= dt;
        if (streaks[i].life <= 0) streaks.splice(i, 1);
      }
      for (let i = booms.length - 1; i >= 0; i -= 1) {
        const b = booms[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.94; b.vy *= 0.94; b.life -= dt;
        if (b.life <= 0) booms.splice(i, 1);
      }
      // Money going up floats a green "+$n" over the player.
      if (state.money > lastMoney) {
        floaters.push({ x: p.x, y: p.y - 30, text: `+$${state.money - lastMoney}`, color: '#7dff8a', life: 1.4 });
      }
      lastMoney = state.money;
      // A fresh shot flashes a spark at the muzzle and kicks the camera.
      if (state.shotsFired > lastShots) {
        const mx = p.x + Math.cos(p.aimAngle ?? p.angle) * 26;
        const my = p.y + Math.sin(p.aimAngle ?? p.angle) * 26;
        flashes.push({ x: mx, y: my, angle: p.aimAngle ?? p.angle, life: 0.12 });
        shake = Math.min(7, shake + 3);
      }
      lastShots = state.shotsFired;
      // Taking a hit shakes the camera harder than shooting does.
      if (p.health < lastHealth) shake = Math.min(12, shake + 6);
      lastHealth = p.health;
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        floaters[i].y -= dt * 34;
        floaters[i].life -= dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        flashes[i].life -= dt;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }
    },

    // World-space drawing. The caller already translated to the camera.
    draw(ctx) {
      ctx.save();
      for (const s of skids) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = Math.min(0.5, s.life / 6) * 0.9;
        ctx.fillStyle = '#141414';
        ctx.fillRect(-14, -3, 28, 6);
        ctx.restore();
      }
      for (const f of flashes) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.globalAlpha = Math.max(0, f.life / 0.12);
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, -5);
        ctx.lineTo(34, 0);
        ctx.lineTo(26, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (const b of booms) {
        ctx.globalAlpha = Math.max(0, b.life / 1.2);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * Math.max(0.2, b.life), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      for (const s of streaks) {
        ctx.globalAlpha = Math.max(0, s.life / 0.3) * 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(s.angle) * 46, s.y + Math.sin(s.angle) * 46);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px system-ui, sans-serif';
      for (const f of floaters) {
        ctx.globalAlpha = Math.max(0, f.life / 1.4);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    },

    // Test hook: counts only, no drawing.
    debug() { return { skids: skids.length, floaters: floaters.length, flashes: flashes.length, booms: booms.length, streaks: streaks.length, shake, shots: lastShots }; },
  };
}
