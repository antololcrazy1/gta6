// The dense GTA-style HUD for Vice Coast: mission panel and police list
// top-left, clock / money / stars top-right, weapon slots and crew cards
// on the right, district + respect + minimap + health/armour bottom-left,
// dialogue bottom-centre, speed and radio bottom-right. Banners stay
// small, as Hanz asked: mission text 13px, title banner 26px, district
// banner 18px, dialogue 360px wide.
import { CFG, CREW, POLICE_UNITS, WEAPON_STATS } from './config.js';
import { missionSummary } from './missions.js';

function el(id) {
  return document.getElementById(id);
}

function stars(n) {
  let s = '';
  for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
  return s;
}

function clockString(t) {
  // A 240-second day is a 24-hour clock starting at 06:00.
  const hours = (6 + (t / CFG.DAY_LENGTH) * 24) % 24;
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function createHud(state, radio) {
  const minimap = el('vc-minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let lastText = 0;
  let lastMap = 0;

  function drawMinimap(now) {
    if (!mctx || now - lastMap < 150) return;
    lastMap = now;
    const S = minimap.width;
    const scale = S / CFG.WORLD_W;
    const p = state.player;
    mctx.clearRect(0, 0, S, S);
    // Sea and sand on the west edge.
    mctx.fillStyle = '#1d5f8a';
    mctx.fillRect(0, 0, CFG.BEACH_W * scale, S);
    mctx.fillStyle = '#2b2b30';
    mctx.fillRect(CFG.BEACH_W * scale, 0, S - CFG.BEACH_W * scale, S);
    // Streets.
    mctx.strokeStyle = '#5a5a62';
    mctx.lineWidth = 1;
    for (let i = 0; i < CFG.V_ROADS; i += 1) {
      const x = (CFG.V_ROAD_X0 + i * CFG.V_ROAD_DX) * scale;
      mctx.beginPath();
      mctx.moveTo(x, 0);
      mctx.lineTo(x, S);
      mctx.stroke();
    }
    for (let j = 0; j < CFG.H_ROADS; j += 1) {
      const y = (CFG.H_ROAD_Y0 + j * CFG.H_ROAD_DY) * scale;
      mctx.beginPath();
      mctx.moveTo(0, y);
      mctx.lineTo(S, y);
      mctx.stroke();
    }
    // Parks.
    mctx.fillStyle = '#4d8a3f';
    for (const pk of state.parks) {
      mctx.fillRect(pk.x * scale, pk.y * scale, Math.max(2, pk.w * scale), Math.max(2, pk.h * scale));
    }
    // The mission marker, pulsing.
    if (state.missionTarget) {
      const pulse = 3 + Math.sin(now / 240) * 1.5;
      mctx.fillStyle = '#ffe94a';
      mctx.beginPath();
      mctx.arc(state.missionTarget.x * scale, state.missionTarget.y * scale, pulse, 0, Math.PI * 2);
      mctx.fill();
    }
    // The player arrow, pointing along the heading.
    const px = p.x * scale;
    const py = p.y * scale;
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(p.angle);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(7, 0);
    mctx.lineTo(-5, -4);
    mctx.lineTo(-5, 4);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('N', S - 10, 12);
  }

  function update(now) {
    // Text updates are throttled; the minimap draws on its own timer.
    drawMinimap(now);
    if (now - lastText < 120) return;
    lastText = now;
    const p = state.player;

    const summary = missionSummary(state);
    const missionName = el('vc-mission-name');
    if (missionName) missionName.textContent = summary.name;
    const missionObj = el('vc-mission-obj');
    if (missionObj) missionObj.textContent = summary.objective;
    const missionBar = el('vc-mission-bar');
    if (missionBar) missionBar.style.width = `${Math.round(summary.progress * 100)}%`;
    const missionTimer = el('vc-mission-timer');
    if (missionTimer) {
      missionTimer.textContent = summary.timer > 0 ? `${Math.ceil(summary.timer)}s` : '';
    }

    // The police response list: named units, roles, distances, counts.
    const police = el('vc-police-list');
    if (police) {
      if (state.wanted > 0 && state.cops.length > 0) {
        const rows = state.cops.slice(0, 5).map((cop, i) => {
          const unit = POLICE_UNITS[i % POLICE_UNITS.length];
          const d = Math.round(Math.hypot(cop.x - p.x, cop.y - p.y) / 3);
          return `<div>${unit.name} · ${unit.role} · ${d}m</div>`;
        });
        police.innerHTML = rows.join('') + `<div class="vc-police-count">${state.cops.length} units responding</div>`;
        police.style.display = 'block';
      } else {
        police.style.display = 'none';
      }
    }

    const clock = el('vc-clock');
    if (clock) clock.textContent = clockString(state.weather.t);
    const money = el('vc-money');
    if (money) money.textContent = `$${state.money.toLocaleString('en-US')}`;
    const starsEl = el('vc-stars');
    if (starsEl) starsEl.textContent = stars(state.wanted);
    const status = el('vc-status');
    if (status) {
      status.textContent = state.wanted >= 4 ? 'AIR SUPPORT UP' : state.wanted > 0 ? 'WANTED' : state.weather.phase === 'night' ? 'NIGHT' : 'CLEAR';
    }

    // Weapon slots with ammo, and crew cards with cooldowns.
    const weapons = el('vc-weapons');
    if (weapons) {
      weapons.innerHTML = state.weapons.map((w) => {
        const st = WEAPON_STATS[w];
        const active = w === state.weapon;
        return `<div class="vc-weapon${active ? ' active' : ''}">${st ? st.name : w}${active ? ` · ${p.ammo}` : ''}</div>`;
      }).join('');
    }
    const crew = el('vc-crew');
    if (crew) {
      crew.innerHTML = CREW.map((c) => {
        const cd = Math.ceil(state.crewCooldowns[c.id] || 0);
        return `<div class="vc-crew-card"><b>${c.name}</b> ${c.ability}${cd > 0 ? ` · ${cd}s` : ''}</div>`;
      }).join('');
    }

    const district = el('vc-district');
    if (district) district.textContent = state.district;
    const respect = el('vc-respect-bar');
    if (respect) respect.style.width = `${Math.min(100, state.respect / 3)}%`;
    const rank = el('vc-rank');
    if (rank) rank.textContent = `Rank ${state.rankIndex} · Respect ${state.respect}`;
    const hp = el('vc-health-bar');
    if (hp) hp.style.width = `${Math.max(0, p.health)}%`;
    const armor = el('vc-armor-bar');
    if (armor) armor.style.width = `${Math.max(0, p.armor)}%`;

    // Dialogue box, bottom-centre, 360px wide.
    const dialog = el('vc-dialog');
    if (dialog) {
      if (state.dialogue) {
        dialog.style.display = 'block';
        const name = el('vc-dialog-name');
        if (name) name.textContent = state.dialogue.name;
        const text = el('vc-dialog-text');
        if (text) text.textContent = state.dialogue.text;
      } else {
        dialog.style.display = 'none';
      }
    }

    // Bottom-right: speed, gear, car name, condition, radio ticker.
    const speed = el('vc-speed');
    if (speed) {
      const car = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
      const kmh = car ? Math.round(Math.abs(car.speed) * 0.32) : Math.round((p.speed || 0) * 0.32);
      speed.textContent = String(kmh);
      const gear = el('vc-gear');
      if (gear) gear.textContent = !car ? 'ON FOOT' : car.speed < -5 ? 'R' : car.speed < 60 ? '1' : car.speed < 140 ? '2' : car.speed < 240 ? '3' : car.speed < 340 ? '4' : '5';
      const carName = el('vc-car-name');
      if (carName) carName.textContent = car ? 'Comet GT' : 'On foot';
      const cond = el('vc-car-cond');
      if (cond) cond.style.width = `${car ? Math.max(0, car.health) : 100}%`;
      const nitro = el('vc-nitro-bar');
      if (nitro) nitro.style.width = `${Math.round(state.nitro)}%`;
    }
    const radioEl = el('vc-radio');
    if (radioEl && radio) radioEl.textContent = `♪ ${radio.track()}`;

    // The banner: mission title 26px, description 13px, small on purpose.
    const banner = el('vc-banner');
    if (banner) {
      if (state.banner) {
        banner.style.display = 'block';
        const t = el('vc-banner-title');
        if (t) t.textContent = state.banner.title;
        const x = el('vc-banner-text');
        if (x) x.textContent = state.banner.text || '';
      } else {
        banner.style.display = 'none';
      }
    }
  }

  return { update };
}
