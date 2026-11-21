// Dense GTA-style HUD for the v6 rebuild: DOM overlay plus a 2D minimap
// canvas. Top-left mission panel + police list, top-right clock/money/stars,
// right weapon slots + crew cards, bottom-left district + respect + minimap
// with health/armour bars, bottom-centre dialogue, bottom-right speed +
// radio. Screens (title, briefing, paused, over, win) are DOM panels whose
// buttons accept taps — every confirmation works by touch as well as keys.
import { clockFor } from './weather.js';
import { RANKS, WEAPONS } from './config.js';
import { MISSIONS, missionProgress } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const star = (on) => `<span class="star ${on ? 'on' : ''}">★</span>`;

export function createHud(root) {
  root.innerHTML = `
  <div id="vc-hud">
    <div id="vc-mission" class="vc-panel"></div>
    <div id="vc-police" class="vc-panel"></div>
    <div id="vc-top-right">
      <div id="vc-clock"></div>
      <div id="vc-money"></div>
      <div id="vc-stars"></div>
      <div id="vc-status"></div>
    </div>
    <div id="vc-weapons"></div>
    <div id="vc-crew"></div>
    <div id="vc-bottom-left">
      <div id="vc-district"></div>
      <div id="vc-respect"></div>
      <canvas id="vc-map" width="180" height="180"></canvas>
      <div id="vc-bars"><div id="vc-hp"></div><div id="vc-armor"></div></div>
    </div>
    <div id="vc-dialog"></div>
    <div id="vc-speed"></div>
    <div id="vc-radio"></div>
    <div id="vc-nitro"><div id="vc-nitro-fill"></div></div>
    <div id="vc-popups"></div>
    <div id="vc-crosshair">+</div>
    <div id="vc-hitmarker">✕</div>
    <div id="vc-banner"></div>
    <div id="vc-race"></div>
  </div>
  <div id="vc-screen"></div>
  <div id="vc-phone" class="vc-panel"></div>
  <div id="vc-shop" class="vc-panel"></div>`;
  const $ = (id) => root.querySelector(id);
  const mapCtx = $('#vc-map').getContext('2d');
  const screenEl = $('#vc-screen');
  let lastScreen = '';
  let lastHtml = '';

  function minimap(state) {
    const c = mapCtx;
    const W = 180, H = 180;
    c.fillStyle = 'rgba(10,12,20,0.85)';
    c.fillRect(0, 0, W, H);
    const sc = W / 11400;
    const px = state.player.x * sc, py = state.player.y * sc;
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 1;
    for (let x = 1050; x <= 10970; x += 620) { c.beginPath(); c.moveTo(x * sc, 0); c.lineTo(x * sc, H); c.stroke(); }
    for (let y = 550; y <= 6050; y += 500) { c.beginPath(); c.moveTo(0, y * sc); c.lineTo(W, y * sc); c.stroke(); }
    c.fillStyle = '#e8c98f';
    c.fillRect(0, 0, 900 * sc, H);
    c.fillStyle = '#1b6f8e';
    c.fillRect(0, 0, 200 * sc, H);
    if (state.missionTarget) {
      c.fillStyle = '#ffc93c';
      c.beginPath(); c.arc(state.missionTarget.x * sc, state.missionTarget.y * sc, 5, 0, 7); c.fill();
    }
    const job = state.phone.job;
    if (job && job.target) {
      c.fillStyle = '#00e5ff';
      c.save();
      c.translate(job.target.x * sc, job.target.y * sc);
      c.rotate(Math.PI / 4);
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      c.fillStyle = cop.inCar ? '#3b82f6' : '#60a5fa';
      c.beginPath(); c.arc(cop.x * sc, cop.y * sc, 3, 0, 7); c.fill();
    }
    if (state.heli) {
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(state.heli.x * sc, state.heli.y * sc, 4, 0, 7); c.fill();
    }
    for (const pk of state.pickups) {
      if (pk.active && pk.kind === 'hidden') {
        c.fillStyle = '#ffd700';
        c.fillRect(pk.x * sc - 2, pk.y * sc - 2, 4, 4);
      }
    }
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
    c.strokeStyle = '#ffc93c';
    c.lineWidth = 2;
    c.beginPath(); c.arc(px, py, 6, 0, 7); c.stroke();
    c.fillStyle = '#fff';
    c.font = 'bold 11px system-ui';
    c.fillText('N', 88, 12);
  }

  function draw(state, screen, best, opts) {
    const st = state;
    const p = st.player;
    const hud = $('#vc-hud');
    hud.style.display = screen === SCREEN_PLAY || screen === SCREEN_PAUSED ? 'block' : 'none';
    if (screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) { drawScreen(state, screen, best, opts); return; }
    const m = st.missionIndex < MISSIONS.length ? MISSIONS[st.missionIndex] : null;
    const prog = missionProgress(st);
    const timer = st.missionTimer > 0 ? ` ⏱ ${Math.ceil(st.missionTimer)}s` : '';
    // Round 7: the mission panel shows the real chain progress
    // (missions done of 10) and the active phone job with its timer,
    // so a side job never hides behind the story objective.
    const job = st.phone.job ? ` · 📱 ${st.phone.job.label} ${Math.ceil(st.phone.job.timer || 0)}s` : '';
    const progress = m ? Math.min(100, Math.round(((st.missionStage + (st.collected || 0) * 0.1) / 3) * 100)) : 100;
    $('#vc-mission').innerHTML = m
      ? `<b>${m.name}</b>${timer}<div class="vc-bar"><i style="width:${progress}%"></i></div><div>${st.missionText}</div><div class="vc-small">${prog.done}/${prog.total} missions · $${prog.totalReward} total${job}</div>`
      : `<b>Free roam</b><div>${st.missionText}</div><div class="vc-small">${prog.done}/${prog.total} missions${job}</div>`;
    const police = st.policeList || [];
    $('#vc-police').innerHTML = police.length
      ? police.slice(0, 5).map((u) => `<div>🚔 ${u.name} · ${u.role} · ${u.dist}m</div>`).join('') + (police.length > 5 ? `<div>+${police.length - 5} more units</div>` : '')
      : '<div>No police response</div>';
    $('#vc-clock').textContent = clockFor(st.weather.t);
    $('#vc-money').textContent = `$${st.money.toLocaleString()}`;
    $('#vc-stars').innerHTML = [1, 2, 3, 4, 5].map((i) => star(i <= st.wanted)).join('');
    $('#vc-status').textContent = st.wanted > 0 ? `WANTED — ${st.wanted} star${st.wanted > 1 ? 's' : ''}` : st.weather.raining ? 'Raining' : st.weather.phase;
    const slots = ['pistol', 'smg', 'shotgun', 'mako'].map((w) => {
      const owned = st.weapons.includes(w);
      const cur = st.weapon === w;
      return `<div class="vc-slot ${cur ? 'cur' : ''}">${owned ? `${WEAPONS[w].name} · ${st.ammoByWeapon[w] ?? 0}` : '—'}</div>`;
    }).join('');
    $('#vc-weapons').innerHTML = slots;
    $('#vc-crew').innerHTML = [
      { id: 'mira', label: 'Mira · Plates', cd: st.crew.mira },
      { id: 'lio', label: 'Lio · Fix', cd: st.crew.lio },
      { id: 'kiki', label: 'Kiki · Eyes', cd: st.crew.kiki },
    ].map((c) => `<div class="vc-crew-card" data-crew="${c.id}">${c.label}${c.cd > 0 ? ` (${Math.ceil(c.cd)}s)` : ''}</div>`).join('');
    $('#vc-district').textContent = `${st.district} — ${RANKS[st.rankIndex].name} · Respect ${st.respect} (next ${RANKS[Math.min(st.rankIndex + 1, 4)].at})`;
    const nextAt = RANKS[Math.min(st.rankIndex + 1, 4)].at;
    const prevAt = RANKS[st.rankIndex].at;
    const pct = Math.min(100, Math.round(((st.respect - prevAt) / Math.max(1, nextAt - prevAt)) * 100));
    $('#vc-respect').innerHTML = `<div class="vc-bar"><i style="width:${pct}%"></i></div>`;
    minimap(st);
    $('#vc-hp').style.width = `${Math.max(0, p.health)}%`;
    $('#vc-armor').style.width = `${Math.max(0, p.armor)}%`;
    $('#vc-dialog').innerHTML = st.messageTimer > 0 && st.message ? `<div class="vc-face">😎</div><div>${st.message}</div>` : '';
    $('#vc-dialog').style.display = st.messageTimer > 0 && st.message ? 'flex' : 'none';
    const car = p.inCar ? st.cars.find((c) => c.id === p.carId) : null;
    const kmh = Math.round(Math.abs(p.speed || 0) * 0.32);
    $('#vc-speed').innerHTML = p.inCar
      ? `<b>${kmh}</b> km/h<div>${car ? 'Vice' : ''} · ${car ? Math.max(0, Math.round(car.health)) : 0}% condition</div><div class="vc-bar"><i style="width:${car ? Math.max(0, car.health) : 0}%"></i></div>`
      : `<b>${kmh}</b> km/h<div>On foot</div>`;
    $('#vc-radio').textContent = `♪ ${opts.radio || ''}`;
    $('#vc-nitro').style.display = p.inCar ? 'block' : 'none';
    $('#vc-nitro-fill').style.width = `${Math.round(st.nitro)}%`;
    $('#vc-nitro-fill').style.background = st.boosting ? '#ff7a1a' : '#ffc93c';
    $('#vc-popups').innerHTML = st.popups.map((pp) => `<div style="color:${pp.color}">${pp.text}</div>`).join('');
    $('#vc-crosshair').style.display = !p.inCar && screen === SCREEN_PLAY ? 'block' : 'none';
    $('#vc-hitmarker').style.display = st.hitMarker > 0 ? 'block' : 'none';
    $('#vc-banner').innerHTML = st.missionFlash > 0 && m ? `<div class="vc-title">${m.name}</div><div class="vc-brief">${m.brief}</div>` : st.districtTimer > 0 ? `<div class="vc-district">${st.district}</div>` : '';
    const race = st.race;
    $('#vc-race').innerHTML = race && race.countdown > 0
      ? `<div class="vc-race-count">${Math.ceil(race.countdown)}</div>`
      : race && race.active
        ? `<div>🏁 RACE — checkpoint ${race.stage + 1}/4</div>`
        : race && race.available && !race.active
          ? `<div>🏁 Street race at the pier — drive into the gold marker</div>`
          : '';
    const phoneEl = $('#vc-phone');
    if (st.phone.open) {
      phoneEl.style.display = 'block';
      phoneEl.innerHTML = `<b>📱 Vice Phone</b>
      <div class="vc-row" data-job="courier">1 · Courier $80 — deliver in 150s</div>
      <div class="vc-row" data-job="vigilante">2 · Vigilante $120 — take out 2 wanted cars</div>
      <div class="vc-row" data-job="racer">3 · Racer $150 — 3 checkpoints in 150s</div>
      <div class="vc-row" data-job="repo">4 · Repo $200 — steal the marked car</div>
      <div>Crew: Mira plates · Lio fix · Kiki eyes (keys 1/2/3 when closed)</div>${st.phone.job ? `<div>Active: ${st.phone.job.label} — ${Math.ceil(st.phone.job.timer || 0)}s</div>` : '<div>No active job.</div>'}`;
    } else phoneEl.style.display = 'none';
    const shopEl = $('#vc-shop');
    if (st.shop.open) {
      shopEl.style.display = 'block';
      shopEl.innerHTML = `<b>🔧 Sunset Arms &amp; Paint</b>
      <div class="vc-row" data-buy="armor">1 · Body Armor $200 — +50 armor</div>
      <div class="vc-row" data-buy="ammo">2 · Ammo Box $100 — +60 ammo</div>
      <div class="vc-row" data-buy="paint">3 · Car Paint $150 — next colour${st.respect >= RANKS[4].at ? ' · gold unlocked' : ''}</div>
      <div>Press E to close.</div>`;
    } else if (st.shop.near) {
      shopEl.style.display = 'block';
      shopEl.innerHTML = `<b>🔧 Sunset Arms &amp; Paint</b><div>Press E to open the shop.</div>`;
    } else shopEl.style.display = 'none';
    drawScreen(state, screen, best, opts);
  }

  function drawScreen(state, screen, best, opts) {
    const st = state;
    if (screen === lastScreen && screen === SCREEN_PLAY) return;
    const m = st.missionIndex < MISSIONS.length ? MISSIONS[st.missionIndex] : null;
    let html = '';
    if (screen === SCREEN_TITLE) {
      html = `<div class="vc-screen-card"><h1>VICE COAST</h1><p>Open-world crime on the Sunset Coast. 10 missions, cops, heli, turf wars.</p>
      <p>Drive: WASD · Enter car: F/Space · Shoot: J · Phone: P · Shop: E · Crew: 1/2/3 · Weapon: V · Nitro: Shift</p>
      <p>Touch: left stick to move · GAS/BRAKE to drive · SHOOT on foot · drag left side to look around</p>
      <button data-act="start">▶ START</button>
      ${opts.hasSave ? '<button data-act="continue">↻ CONTINUE</button>' : ''}
      <p class="vc-small">Best: $${(best || 0).toLocaleString()} · ${st.hiddenFound}/${st.hiddenTotal} hidden packages</p></div>`;
    } else if (screen === SCREEN_BRIEF) {
      html = `<div class="vc-screen-card"><h2>${m ? m.name : 'Free roam'}</h2><p>${m ? m.brief : 'Vice Coast is yours. Free roam!'}</p><p>Reward: $${m ? m.reward : 0}</p><button data-act="play">▶ GO</button></div>`;
    } else if (screen === SCREEN_PAUSED) {
      html = `<div class="vc-screen-card"><h2>Paused</h2><p>${st.phone.open ? 'Phone open — pick a job with 1-4.' : 'Take a breath, Vice Coast waits.'}</p><button data-act="resume">▶ RESUME</button><button data-act="restart">↻ RESTART</button></div>`;
    } else if (screen === SCREEN_OVER) {
      html = `<div class="vc-screen-card"><h2>${st.over === 'busted' ? 'BUSTED' : 'WASTED'}</h2><p>${st.overReason}</p><p>Money: $${st.money.toLocaleString()} · Missions: ${st.missionsDone}/10</p><button data-act="restart">↻ PLAY AGAIN</button></div>`;
    } else if (screen === SCREEN_WIN) {
      html = `<div class="vc-screen-card"><h2>🏆 VICE COAST IS YOURS</h2><p>${st.overReason}</p><p>Total earned: $${(st.earnedTotal || 0).toLocaleString()} · Missions: ${st.missionsDone}/10 · Rank: ${RANKS[st.rankIndex].name}</p><p>Street race unlocked at the pier!</p><button data-act="restart">↻ PLAY AGAIN</button></div>`;
    }
    if (html !== lastHtml || screen !== lastScreen) {
      screenEl.innerHTML = html;
      screenEl.style.display = html ? 'flex' : 'none';
      lastHtml = html;
      lastScreen = screen;
    }
    if (screen === SCREEN_PLAY) { screenEl.innerHTML = ''; screenEl.style.display = 'none'; lastHtml = ''; lastScreen = screen; }
  }

  return { draw, screenEl, mapCtx };
}
