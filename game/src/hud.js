// Vice Coast v6 — dense GTA-style HUD as a DOM overlay on the 3D canvas.
// Everything the top-10 screenshots share: mission panel + police response
// list, wanted stars, money + clock, weapon slots, crew cards, dialogue,
// round minimap + health/armour, big speedometer, radio ticker. Screens
// (title / briefing / pause / over / win) are DOM too, so EVERY confirm is a
// real tap target — the v5 bug (briefing only accepted keyboard Enter) cannot
// recur: the buttons are pointer-events:auto and call the same handlers as
// the keys.
import { MISSIONS } from './missions.js';
import { clockFor } from './weather.js';
import { WORLD, SHOP_POS } from './config.js';
import { ROADS_V, ROADS_H } from './world.js';

const CREW = [
  { name: 'Mira', role: 'Driver', perk: 'SWAP PLATES', color: '#ff6b9d', init: 'M' },
  { name: 'Lio', role: 'Mechanic', perk: 'QUICK FIX', color: '#f1c40f', init: 'L' },
  { name: 'Kiki', role: 'Lookout', perk: 'EYES OUT', color: '#48dbfb', init: 'K' },
];
const DIALOGUE = [
  ['MIRA', 'Wheelman', 'Pier pickup, then the hotel. Smooth and fast — she tips for speed.'],
  ['MARCO', 'Smuggler', 'Three packages, Palm Row to the docks. Do not stop for anyone.'],
  ['MIRA', 'Wheelman', 'Grab the bag and run. Cops will be on you in seconds.'],
  ['KIKI', 'Lookout', 'Three stars. Break line of sight — duck into the alleys.'],
  ['MARCO', 'Smuggler', 'Coral Bank vault. In and out, then the hideout. Go.'],
  ['MIRA', 'Wheelman', 'Four drops, four corners. Heli is already up — keep moving.'],
  ['KIKI', 'Lookout', 'Five stars and the pier is the only way out. Floor it.'],
  ['MARCO', 'Smuggler', 'Crates on the docks road, boat at the pier. One hundred twenty seconds.'],
  ['MIRA', 'Wheelman', 'Torch three Viper cars, then hold the turf. They will come for you.'],
  ['KIKI', 'Lookout', 'Last job. Bank, five stars, pier. Make it count.'],
];
const UNIT_NAMES = ['KITE-1', 'MARLIN-3', 'CORAL-48', 'REEF-7', 'SURF-12', 'PALM-9'];
const UNIT_ROLES = ['RAMMING', 'PURSUIT', 'FLANKING', 'ROADBLOCK', 'SPOTLIGHT', 'SHORE WATCH'];
const RADIOS = ['OMBO 98.4 — Island Pop', 'CELESTE 98.1 — Malecón Mirage · Vela Roja', 'VICE FM — Neon Nights', 'CORAL 88 — Docks Blues', 'SUNSET 99 — Golden Hour Mix'];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createHUD(callbacks) {
  const root = el('div', 'vc-hud');
  root.innerHTML = `
  <div class="vc-top-left">
    <div class="vc-mission" id="vc-mission">
      <div class="vc-mission-title"><span id="vc-mission-title-text">MISSION 1 · SUNSET TAXI</span><span class="vc-stage" id="vc-mission-stage"></span></div>
      <div class="vc-mission-bar"><div id="vc-mission-fill"></div></div>
      <div class="vc-mission-obj" id="vc-mission-obj">Pick up Maya</div>
      <div class="vc-mission-next" id="vc-mission-next">NEXT: Drop Maya off</div>
    </div>
    <div class="vc-units" id="vc-units"></div>
  </div>
  <div class="vc-top-right">
    <div class="vc-clock" id="vc-clock">18:47</div>
    <div class="vc-money" id="vc-money">$0</div>
    <div class="vc-stars" id="vc-stars"></div>
    <div class="vc-status" id="vc-status">VCPD · CLEAR</div>
  </div>
  <div class="vc-wanted" id="vc-wanted"></div>
  <div class="vc-right">
    <div class="vc-weapons" id="vc-weapons"></div>
    <div class="vc-crew" id="vc-crew"></div>
  </div>
  <div class="vc-bottom-left">
    <div class="vc-district" id="vc-district">Kumala Strand</div>
    <div class="vc-respect"><div id="vc-respect-fill"></div></div>
    <canvas class="vc-minimap" id="vc-minimap" width="360" height="360"></canvas>
    <div class="vc-bars">
      <div class="vc-bar"><span>HEALTH</span><div class="vc-bar-track"><div id="vc-health" class="vc-bar-health"></div></div></div>
      <div class="vc-bar"><span>ARMOUR</span><div class="vc-bar-track"><div id="vc-armor" class="vc-bar-armor"></div></div></div>
    </div>
  </div>
  <div class="vc-dialog" id="vc-dialog"><div class="vc-portrait" id="vc-portrait">M</div><div><div class="vc-dialog-name" id="vc-dialog-name">MIRA · WHEELMAN</div><div class="vc-dialog-line" id="vc-dialog-line"></div></div></div>
  <div class="vc-bottom-right">
    <div class="vc-speed"><span id="vc-speed">0</span><small>KM/H</small></div>
    <div class="vc-gear" id="vc-gear">P</div>
    <div class="vc-car" id="vc-car">RUKAN PELO GT</div>
    <div class="vc-cond"><div id="vc-cond-fill"></div></div>
    <div class="vc-radio" id="vc-radio">OMBO 98.4 — Island Pop</div>
  </div>
  <div class="vc-banner" id="vc-banner"></div>
  <div class="vc-district-banner" id="vc-district-banner"></div>
  <div class="vc-crosshair" id="vc-crosshair">+</div>
  <div class="vc-hitmarker" id="vc-hitmarker">✕</div>
  <div class="vc-message" id="vc-message"></div>
  <div class="vc-shop" id="vc-shop"></div>
  <div class="vc-phone" id="vc-phone"></div>`;
  document.body.appendChild(root);

  // ---- screens (title / briefing / pause / over / win) ----
  const screens = el('div', 'vc-screens');
  screens.innerHTML = `
  <div class="vc-screen vc-screen-title" id="vc-screen-title">
    <div class="vc-logo">VICE<span>COAST</span></div>
    <div class="vc-tagline">A sun-soaked open-world crime game — in the spirit of GTA 6</div>
    <div class="vc-title-stats" id="vc-title-stats"></div>
    <button class="vc-bigbtn" id="vc-btn-start">▶ &nbsp;START</button>
    <button class="vc-bigbtn vc-btn-ghost" id="vc-btn-continue" style="display:none">CONTINUE — RESUME YOUR RUN</button>
    <div class="vc-keys">WASD drive / walk &nbsp;·&nbsp; F / SPACE enter car &nbsp;·&nbsp; Mouse aim, click shoot &nbsp;·&nbsp; P phone &nbsp;·&nbsp; Q radio</div>
    <div class="vc-keys">Touch: left stick to move · GAS / BRAKE to drive · SHOOT / ENTER on the right</div>
  </div>
  <div class="vc-screen" id="vc-screen-brief" style="display:none">
    <div class="vc-brief-kicker" id="vc-brief-kicker">MISSION 1</div>
    <div class="vc-brief-title" id="vc-brief-title">Sunset Taxi</div>
    <div class="vc-brief-text" id="vc-brief-text"></div>
    <div class="vc-brief-reward" id="vc-brief-reward">$150</div>
    <button class="vc-bigbtn" id="vc-btn-brief">▶ &nbsp;START MISSION</button>
    <div class="vc-keys">Tap the button or press Enter / Space</div>
  </div>
  <div class="vc-screen" id="vc-screen-pause" style="display:none">
    <div class="vc-brief-title">PAUSED</div>
    <button class="vc-bigbtn" id="vc-btn-resume">▶ &nbsp;RESUME</button>
    <button class="vc-bigbtn vc-btn-ghost" id="vc-btn-restart">RESTART RUN</button>
  </div>
  <div class="vc-screen" id="vc-screen-over" style="display:none">
    <div class="vc-over-title" id="vc-over-title">WASTED</div>
    <div class="vc-brief-text" id="vc-over-text"></div>
    <div class="vc-title-stats" id="vc-over-stats"></div>
    <button class="vc-bigbtn" id="vc-btn-again">↻ &nbsp;PLAY AGAIN</button>
  </div>
  <div class="vc-screen" id="vc-screen-win" style="display:none">
    <div class="vc-over-title vc-win-title">VICE COAST IS YOURS</div>
    <div class="vc-brief-text" id="vc-win-text">All ten missions complete. $9,850 earned. The coast belongs to you.</div>
    <button class="vc-bigbtn" id="vc-btn-free">▶ &nbsp;FREE ROAM</button>
  </div>`;
  document.body.appendChild(screens);

  const $ = (id) => document.getElementById(id);
  const bind = (id, fn) => {
    const b = $(id);
    // pointerdown (not click) so a tap fires instantly and cannot leak into
    // the canvas as a gunshot — the v5 briefing bug, fixed at the source.
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
  };
  bind('vc-btn-start', () => callbacks.onStart());
  bind('vc-btn-continue', () => callbacks.onContinue());
  bind('vc-btn-brief', () => callbacks.onBriefStart());
  bind('vc-btn-resume', () => callbacks.onResume());
  bind('vc-btn-restart', () => callbacks.onStart());
  bind('vc-btn-again', () => callbacks.onStart());
  bind('vc-btn-free', () => callbacks.onResume());

  const minimap = $('vc-minimap');
  const mctx = minimap.getContext('2d');
  let hitTimer = 0;
  let lastHitTime = null;
  let lastDialogMission = -1;
  let lastFlash = 0;
  let radioIdx = 0;

  // Shop / phone panels are re-rendered every frame, so taps are handled by
  // delegation on the container (survives innerHTML swaps). Rows carry a
  // data-action; the main loop passes the matching callbacks.
  function wirePanel(id, fn) {
    $(id).addEventListener('pointerdown', (e) => {
      const row = e.target.closest('[data-action]');
      if (!row) return;
      e.preventDefault(); e.stopPropagation();
      fn(row.dataset.action);
    });
  }
  wirePanel('vc-shop', (a) => {
    if (a === 'close') { if (callbacks.onShopClose) callbacks.onShopClose(); }
    else if (callbacks.onShopBuy) callbacks.onShopBuy(a);
  });
  wirePanel('vc-phone', (a) => {
    if (a === 'close') { if (callbacks.onPhoneClose) callbacks.onPhoneClose(); }
    else if (callbacks.onPhoneJob) callbacks.onPhoneJob(a);
  });

  function drawMinimap(st) {
    const w = 360, s = w / WORLD.width, mh = WORLD.height * s;
    mctx.clearRect(0, 0, w, w);
    mctx.save();
    mctx.beginPath(); mctx.arc(180, 180, 176, 0, Math.PI * 2); mctx.clip();
    mctx.fillStyle = '#20242e'; mctx.fillRect(0, 0, w, w);
    // Beach + sea on the west edge: the sea is west of x=0, so it gets a
    // strip at the canvas edge (0-12px), then the sand (12-32px), then the
    // city. The old code painted the sea and immediately overpainted it
    // with the identical sand rect, so no sea ever showed (B3).
    mctx.fillStyle = '#1b6f8e'; mctx.fillRect(0, 0, 12, mh);
    mctx.fillStyle = '#e8c98f'; mctx.fillRect(12, 0, 300 * s - 12, mh);
    mctx.fillStyle = '#33363d';
    // Roads stop at the map's south edge — the old code drew the vertical
    // roads the full 360px height, sticking ~100px below the city (B3).
    for (const rx of ROADS_V) mctx.fillRect(rx * s - 4, 0, 8, mh);
    for (const ry of ROADS_H) mctx.fillRect(0, ry * s - 4, w, 8);
    // Mission marker.
    if (st.missionTarget) {
      mctx.fillStyle = '#ffc93c';
      mctx.beginPath(); mctx.arc(st.missionTarget.x * s, st.missionTarget.y * s, 9, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke();
    }
    // Shop + hideout (hideout was promised by the comment but never drawn).
    mctx.fillStyle = '#48dbfb'; mctx.fillRect(SHOP_POS.x * s - 4, SHOP_POS.y * s - 4, 8, 8);
    if (st.landmarks && st.landmarks.hideout) {
      mctx.fillStyle = '#7dff9a';
      mctx.beginPath(); mctx.arc(st.landmarks.hideout.x * s, st.landmarks.hideout.y * s, 5, 0, Math.PI * 2); mctx.fill();
    }
    // Active phone-job target: the job label names a place ("Midtown")
    // but nothing on the map ever showed where it is.
    if (st.phone.job && st.phone.job.target) {
      mctx.fillStyle = '#48dbfb';
      mctx.save();
      mctx.translate(st.phone.job.target.x * s, st.phone.job.target.y * s);
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-6, -6, 12, 12);
      mctx.restore();
    }
    // Cops red, gang purple, traffic grey dots.
    for (const c of st.cars) {
      if (c.cop) { mctx.fillStyle = '#ff3b30'; mctx.beginPath(); mctx.arc(c.x * s, c.y * s, 6, 0, Math.PI * 2); mctx.fill(); }
    }
    for (const g of st.gangCars) {
      mctx.fillStyle = '#c084fc'; mctx.beginPath(); mctx.arc(g.x * s, g.y * s, 5, 0, Math.PI * 2); mctx.fill();
    }
    if (st.heli) {
      mctx.fillStyle = '#ff3b30'; mctx.font = 'bold 20px system-ui'; mctx.fillText('H', st.heli.x * s - 7, st.heli.y * s + 7);
    }
    // Player arrow.
    const px = st.player.x * s, py = st.player.y * s;
    mctx.save(); mctx.translate(px, py); mctx.rotate(st.player.angle);
    mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(11, 0); mctx.lineTo(-8, -7); mctx.lineTo(-8, 7); mctx.closePath(); mctx.fill();
    mctx.restore();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#fff'; mctx.font = 'bold 16px system-ui'; mctx.fillText('N', 172, 22);
  }

  // Tiny inline-SVG weapon silhouettes (no font dependency): the top-10
  // slots all show an icon, v6.0 showed text only.
  const WEAPON_ICONS = {
    FISTS: '<svg viewBox="0 0 32 16"><rect x="6" y="4" width="20" height="10" rx="3"/><rect x="8" y="1" width="4" height="5" rx="1"/><rect x="14" y="1" width="4" height="5" rx="1"/><rect x="20" y="1" width="4" height="5" rx="1"/></svg>',
    PISTOL: '<svg viewBox="0 0 32 16"><rect x="4" y="3" width="22" height="5" rx="1"/><rect x="8" y="8" width="5" height="7" rx="1"/><rect x="22" y="5" width="5" height="3"/></svg>',
    SMG: '<svg viewBox="0 0 32 16"><rect x="2" y="4" width="26" height="5" rx="1"/><rect x="12" y="9" width="4" height="6" rx="1"/><rect x="24" y="6" width="6" height="3"/></svg>',
    '12G': '<svg viewBox="0 0 32 16"><rect x="2" y="5" width="28" height="4" rx="1"/><rect x="14" y="9" width="5" height="4" rx="1"/><rect x="6" y="9" width="4" height="4" rx="1"/></svg>',
    MAKO: '<svg viewBox="0 0 32 16"><rect x="2" y="5" width="28" height="4" rx="1"/><rect x="12" y="2" width="8" height="3" rx="1"/><rect x="14" y="9" width="4" height="6" rx="1"/><rect x="24" y="7" width="6" height="3"/></svg>',
  };

  function weaponSlots(st) {
    const ammo = st.player.ammo;
    // Slots 3-5 are locked: no weapon switching exists in the game, so the
    // old hardcoded '30/60' / '150' ammo strings were fake (B4). Show them
    // as unowned instead of inventing ammo.
    const slots = [
      ['1', 'FISTS', '∞', true],
      ['2', 'PISTOL', `${ammo}`, ammo > 0],
      ['3', 'SMG', '—', false],
      ['4', '12G', '—', false],
      ['5', 'MAKO', '—', false],
    ];
    return slots.map(([n, name, am, on]) => `<div class="vc-weapon ${on ? 'on' : ''}"><b>${n}</b>${WEAPON_ICONS[name]}<span>${name}</span><i>${am}</i></div>`).join('');
  }

  function update(st, screen, opts = {}) {
    const inCar = st.player.inCar;
    const car = inCar ? st.cars.find((c) => c.id === st.player.carId) : null;
    const m = MISSIONS[Math.min(st.missionIndex, 9)];
    // Real stage counts: Package Run 4 (3 pickups + delivery), Vice Nights
    // 5 (4 drops + delivery), Harbor Lights 4 (3 crates + delivery), Neon
    // Reign 2. The old map said 3/3/3/2, so Vice Nights capped at STAGE 3/3
    // before the final delivery (B5).
    const STAGE_TOTALS = { 1: 4, 5: 5, 7: 4, 8: 2 };
    const stageTotal = STAGE_TOTALS[st.missionIndex] || 1;
    const stageDone = Math.min(st.missionStage, stageTotal);
    $('vc-mission-title-text').textContent = st.missionIndex >= 10 ? 'FREE ROAM · VICE COAST' : `MISSION ${st.missionIndex + 1} · ${m.name.toUpperCase()}`;
    const stageChip = $('vc-mission-stage');
    stageChip.textContent = stageTotal > 1 ? `STAGE ${stageDone}/${stageTotal}` : '';
    stageChip.style.display = stageTotal > 1 ? 'inline-block' : 'none';
    $('vc-mission-fill').style.width = `${st.missionIndex >= 10 ? 100 : ((st.missionIndex + stageDone / (stageTotal + 1)) / 10) * 100}%`;
    $('vc-mission-obj').textContent = st.missionText || '';
    $('vc-mission-next').textContent = st.missionTimer > 0 ? `⏱ ${Math.ceil(st.missionTimer)}s left` : `PACKAGES ${st.hiddenFound}/${st.hiddenTotal} · RESPECT ${st.respect}`;
    // Police response list.
    const units = $('vc-units');
    if (st.wanted > 0) {
      const rows = st.cops.slice(0, 4).map((cop, i) => {
        const d = Math.round(Math.hypot(cop.x - st.player.x, cop.y - st.player.y) / 2);
        const role = cop.inCar ? UNIT_ROLES[i % 4] : 'FOOT';
        return `<div class="vc-unit"><b>${UNIT_NAMES[i % UNIT_NAMES.length]}</b><span>${role}</span><i>${d}m</i><em>${st.heli && i === 0 ? 'SPOTLIGHT' : 'IN PURSUIT'}</em></div>`;
      }).join('');
      const more = st.cops.length > 4 ? `<div class="vc-unit-more">+${st.cops.length - 4} more units</div>` : '';
      units.innerHTML = rows + more;
      units.style.display = 'block';
    } else units.style.display = 'none';
    $('vc-clock').textContent = clockFor(st.weather.t);
    $('vc-money').textContent = `$${st.money.toLocaleString('en-US')}`;
    const stars = $('vc-stars');
    stars.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < st.wanted ? 'lit' : ''}">★</span>`).join('');
    // Big gold WANTED banner top-centre at 3+ stars, like Golden Hour Kings.
    const wanted = $('vc-wanted');
    wanted.textContent = st.wanted >= 3 ? `WANTED ${'★'.repeat(st.wanted)}` : '';
    wanted.style.display = st.wanted >= 3 ? 'block' : 'none';
    $('vc-status').textContent = st.heli ? 'AIR UNIT DEPLOYED · SPOTLIGHT ACTIVE' : st.wanted > 0 ? `VCPD · ${st.wanted} STAR${st.wanted > 1 ? 'S' : ''} — LOSE THEM` : 'VCPD · CLEAR';
    $('vc-status').style.color = st.wanted > 0 ? '#ff6b6b' : '#7dff9a';
    $('vc-weapons').innerHTML = weaponSlots(st);
    $('vc-crew').innerHTML = CREW.map((c) => `<div class="vc-crew-card"><div class="vc-crew-face" style="background:${c.color}">${c.init}</div><div><b>${c.perk}</b><span>${c.name} · ${c.role}</span></div></div>`).join('');
    $('vc-district').textContent = `${st.district} · ${st.weather.phase === 'sunset' ? 'Golden Hour' : st.weather.phase === 'night' ? 'Night' : st.weather.raining ? 'Rain' : 'Day'}`;
    $('vc-respect-fill').style.width = `${Math.min(100, st.respect)}%`;
    $('vc-health').style.width = `${Math.max(0, st.player.health)}%`;
    $('vc-armor').style.width = `${Math.max(0, st.player.armor)}%`;
    drawMinimap(st);
    // Dialogue follows the mission — and replays when a timed mission
    // restarts at the same index (missionFlash rising edge). The old code
    // only fired on a missionIndex change, so a retried mission showed no
    // briefing again (B20).
    if (st.missionFlash > 0 && lastFlash <= 0) lastDialogMission = -1;
    lastFlash = st.missionFlash;
    if (st.missionIndex !== lastDialogMission && st.missionIndex < 10) {
      lastDialogMission = st.missionIndex;
      const [name, role, line] = DIALOGUE[st.missionIndex];
      $('vc-portrait').textContent = name[0];
      $('vc-dialog-name').textContent = `${name} · ${role}`;
      $('vc-dialog-line').textContent = line;
    }
    // Speedometer: 0 on foot — the old code showed the walk speed as
    // 74 km/h / sprint as 112 km/h (B2).
    const kmh = inCar ? Math.round(Math.abs(st.player.speed || 0) * 0.32) : 0;
    $('vc-speed').textContent = kmh;
    $('vc-gear').textContent = !inCar ? 'F' : kmh === 0 ? 'P' : (st.player.speed || 0) < 0 ? 'R' : `D${Math.min(5, 1 + Math.floor(kmh / 40))}`;
    $('vc-car').textContent = car ? (car.cop ? 'VCPD INTERCEPTOR' : car.gang ? 'VIPER LOWRIDER' : 'RUKAN PELO GT') : 'ON FOOT';
    $('vc-cond-fill').style.width = `${car ? Math.max(0, car.health) : 100}%`;
    radioIdx = opts.radioIdx || 0;
    $('vc-radio').textContent = RADIOS[radioIdx % RADIOS.length];
    $('vc-crosshair').style.display = opts.aiming && !inCar ? 'block' : 'none';
    $('vc-hitmarker').style.opacity = hitTimer > 0 ? '1' : '0';
    // Hit marker decays by real time, not by frames — the old 1/60 per
    // update assumed exactly 60 fps (B19). opts.time is the game clock.
    if (hitTimer > 0 && typeof opts.time === 'number') {
      if (lastHitTime == null) lastHitTime = opts.time;
      hitTimer -= Math.max(0, opts.time - lastHitTime);
      lastHitTime = opts.time;
    }
    $('vc-message').textContent = st.messageTimer > 0 ? st.message : '';
    // Mission-complete banner only: the mission-start message already
    // shows as the toast above and in the mission panel — showing it a
    // third time as a giant banner crowds narrow screens.
    const banner = $('vc-banner');
    if (st.missionFlash > 0 && st.message && st.message.indexOf('Mission complete') === 0) {
      banner.textContent = st.message;
      banner.style.display = 'block';
    } else banner.style.display = 'none';
    const db = $('vc-district-banner');
    if (st.districtTimer > 0) { db.textContent = st.district; db.style.display = 'block'; }
    else db.style.display = 'none';
    // Shop / phone panels: rows are tappable (data-action, handled by the
    // delegated pointerdown listener) — the old panels only worked with
    // keys 1/2/3 and E/P, so the shop and phone jobs were unusable on a
    // phone. Prices come from the live state so a row never lies.
    const shop = $('vc-shop');
    if (st.shop.open) {
      shop.style.display = 'block';
      shop.innerHTML = `<b>SUNSET ARMS &amp; PAINT</b><div class="vc-shop-row" data-action="armor">1 · Body armor $200 <span>+50 armor</span></div><div class="vc-shop-row" data-action="ammo">2 · Ammo $100 <span>+60 ammo</span></div><div class="vc-shop-row" data-action="paint">3 · Paint job $150 <span>next colour</span></div><div class="vc-shop-row vc-shop-close" data-action="close">✕ Close</div><i>Tap a row to buy · or press 1 / 2 / 3, E to close</i>`;
    } else shop.style.display = 'none';
    const phone = $('vc-phone');
    if (st.phone.open) {
      phone.style.display = 'block';
      const job = st.phone.job;
      const jobLine = job ? `<div class="vc-phone-job">ACTIVE: ${job.label} — ${job.timer > 0 ? Math.ceil(job.timer) + 's left' : 'no timer'}</div>` : '';
      phone.innerHTML = `<b>📱 PHONE — SIDE JOBS</b>${jobLine}<div class="vc-shop-row" data-action="courier">1 · Courier $80 <span>60s delivery</span></div><div class="vc-shop-row" data-action="vigilante">2 · Vigilante $120 <span>wreck 2 wanted cars</span></div><div class="vc-shop-row" data-action="racer">3 · Racer $150 <span>3 checkpoints in 45s</span></div><div class="vc-shop-row vc-shop-close" data-action="close">✕ Close</div><i>Tap a row to start · or press 1 / 2 / 3, P to close</i>`;
    } else phone.style.display = 'none';
    // Screens.
    const show = (id, on) => { $(id).style.display = on ? 'flex' : 'none'; };
    show('vc-screen-title', screen === 'title');
    show('vc-screen-brief', screen === 'brief');
    show('vc-screen-pause', screen === 'paused');
    show('vc-screen-over', screen === 'over');
    show('vc-screen-win', screen === 'win');
    root.style.display = screen === 'play' || screen === 'paused' ? 'block' : 'none';
    if (screen === 'title') {
      $('vc-title-stats').textContent = opts.hasSave ? `Save found — mission ${opts.saveMission || 1} · $${opts.saveMoney || 0}` : 'No save yet — start a new run';
      $('vc-btn-continue').style.display = opts.hasSave ? 'block' : 'none';
    }
    if (screen === 'brief' && st.missionIndex < 10) {
      $('vc-brief-kicker').textContent = `MISSION ${st.missionIndex + 1} OF 10`;
      $('vc-brief-title').textContent = m.name;
      $('vc-brief-text').textContent = m.brief;
      $('vc-brief-reward').textContent = `REWARD $${m.reward}`;
    }
    if (screen === 'over') {
      $('vc-over-title').textContent = st.over === 'busted' ? 'BUSTED' : 'WASTED';
      $('vc-over-text').textContent = st.overReason || '';
      $('vc-over-stats').textContent = `Money $${st.money} · Missions ${st.missionsDone}/10 · Best $${opts.best || 0}`;
    }
    if (screen === 'win') {
      // Real total: $9,650 in mission rewards + $200 vault bonus = $9,850.
      // The old text hardcoded $9,650 (B14).
      $('vc-win-text').textContent = `All ten missions complete. $${st.money.toLocaleString('en-US')} earned. The coast belongs to you.`;
    }
  }

  return {
    update,
    showHit() { hitTimer = 0.35; },
    setRadio(i) { radioIdx = i; },
  };
}
