// Vice Coast v6 boot + loop — Three.js 3D edition.
// Fixed 1/60 s steps, screens: title, brief, play, paused, over, win.
// ?seed=N fixes the city; ?shot=chase|play|heist|end stages a screenshot
// scene and sets window.__shotReady. The simulation is world.js (unchanged
// v5 rules: 10 missions, Viper gang, shop, phone jobs, save/continue,
// day/night + rain); only the presentation is 3D — vc3d.js renders it and
// hud.js draws the dense GTA HUD as a DOM overlay.
// Rotation: resize / orientationchange resizes the WebGL canvas, releases
// every held input (no stuck joystick after turning the phone) and never
// reloads. Every screen confirm is a DOM button AND a key AND a canvas tap.
import { BEST_KEY, MISSIONS_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PHONE, ACTION_RADIO, ACTION_SHOOT, ACTION_SLOT1, ACTION_SLOT2, ACTION_SLOT3, ACTION_SLOT4, ACTION_WEAPON, IS_TOUCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createRenderer3D } from './vc3d.js';
import { createHUD } from './hud.js';
import { stageShot } from './shots.js';
import { hasSave, loadSave, saveGame } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer3d = createRenderer3D(canvas);
const audio = createAudio();
const radio = createRadio(audio);

function readNum(key) { try { return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; } }
function saveNum(key, v) { try { window.localStorage.setItem(key, String(v)); } catch { /* private mode */ } }

function fitCanvas() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer3d.resize(w, h);
}

// Staged screenshot pages: run the real rules forward, render the 3D scene
// a few frames, then flag readiness for the screenshot tool.
function runShot(name) {
  fitCanvas();
  const scene = stageShot(name, world);
  const hud = createHUD({ onStart() {}, onContinue() {}, onBriefStart() {}, onResume() {} });
  hud.update(world.state, scene.screen, { time: 0 });
  let painted = 0;
  // Fixed clock for staged shots: rAF timestamps differ per run, so a shot
  // rendered twice must use the same time or its bytes will differ.
  const T0 = 8;
  function paint() {
    const t = T0 + painted / 60;
    renderer3d.render(world.state, scene.screen, t, { dt: 1 / 60, aiming: !!scene.aiming, aimAngle: scene.aimAngle, snap: painted === 0 });
    if (scene.showHit) hud.showHit();
    hud.update(world.state, scene.screen, { aiming: !!scene.aiming });
    painted += 1;
    if (painted < 12) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__game = {
    state: world.state, world, audio, shop: world.shop, phone: world.phone,
    weather: world.weather, get heli() { return world.state.heli; }, renderer3d,
  };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  if (IS_TOUCH) document.body.classList.add('vc-touch');
  let screen = 'title';
  let best = readNum(BEST_KEY);
  let missionsBest = readNum(MISSIONS_KEY);
  let accumulator = 0; let last = performance.now(); let time = 0;
  let lastAutosave = 0;
  let prevWanted = 0;
  let prevDriveby = -1;
  let lastInCar = false;
  let pendingShoot = false; let pendingEnter = false;
  let radioIdx = 0;
  let aimAngle = 0;
  let aiming = false;

  const hud = createHUD({
    onStart: () => startGame(),
    onContinue: () => continueGame(),
    onBriefStart: () => { if (screen === 'brief') { screen = 'play'; announce('Playing. Follow the gold marker.'); } },
    onResume: () => { if (screen === 'paused' || screen === 'win') { screen = 'play'; announce('Playing.'); } },
    // Tappable shop / phone rows (touch): same code paths as the keys.
    onShopBuy: (item) => { const r = world.shop.buy(world.state, item); announce(r.msg); },
    onShopClose: () => { world.shop.toggle(world.state); announce('Shop closed.'); },
    onPhoneJob: (jobId) => {
      const r = world.phone.start(world.state, jobId);
      announce(r.ok ? `${jobId} job started.` : r.msg);
      // A job picked by tap drops straight back into the game — no extra
      // resume tap needed (the keyboard flow keeps the old P-to-resume).
      if (r.ok && screen === 'paused') screen = 'play';
    },
    onPhoneClose: () => {
      if (world.state.phone.open) world.phone.toggle();
      if (screen === 'paused') screen = 'play';
      announce('Playing.');
    },
  });

  function announce(m) { status.textContent = m; }
  function startGame() {
    world.reset(); accumulator = 0; screen = 'brief';
    try { audio.unlock(); } catch { /* headless */ }
    announce('Vice Coast. Mission briefing.');
  }
  function continueGame() {
    const data = loadSave();
    if (!data) { announce('No save yet — start a new run.'); return false; }
    world.continueSave(data); accumulator = 0; screen = 'brief';
    try { audio.unlock(); } catch { /* headless */ }
    announce(`Continuing: mission ${Math.min(data.missionsDone + 1, 10)}, $${data.money}.`);
    return true;
  }
  function endRun() {
    screen = world.state.over === 'win' ? 'win' : 'over';
    if (world.state.money > best) { best = world.state.money; saveNum(BEST_KEY, best); }
    if (world.state.missionsDone > missionsBest) { missionsBest = world.state.missionsDone; saveNum(MISSIONS_KEY, missionsBest); }
    world.state.best = best;
    saveGame(world.state);
    try { if (world.state.over === 'win') audio.win(); else audio.busted(); } catch { /* headless */ }
    announce(`${world.state.overReason} Money $${world.state.money}. Best $${best}.`);
  }

  function computeAim() {
    const st = world.state;
    if (IS_TOUCH) return st.player.angle;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    // Over-shoulder aim: cursor offset from screen centre steers the aim.
    return st.player.angle + ((input.mouse.x - cx) / Math.max(1, rect.width)) * 1.9;
  }

  function handleActions() {
    const actions = input.takeActions();
    const st = world.state;
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (actions & ACTION_RADIO) { radioIdx = (radioIdx + 1) % 5; const name = radio.next(); announce(`Radio: ${name}.`); }
    if (actions & ACTION_SHOOT) pendingShoot = true;
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (st.shop.open) {
      if (actions & ACTION_SLOT1) { const r = world.shop.buy(st, 'armor'); announce(r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.shop.buy(st, 'ammo'); announce(r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.shop.buy(st, 'paint'); announce(r.msg); }
    } else if (st.phone.open) {
      if (actions & ACTION_SLOT1) { const r = world.phone.start(st, 'courier'); announce(r.ok ? 'Courier job started.' : r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.phone.start(st, 'vigilante'); announce(r.ok ? 'Vigilante job started.' : r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.phone.start(st, 'racer'); announce(r.ok ? 'Racer job started.' : r.msg); }
      else if (actions & ACTION_SLOT4) { const r = world.phone.start(st, 'repo'); announce(r.ok ? 'Repo job started.' : r.msg); }
    }
    // Phase 3: crew abilities on 1/2/3 when no panel is open (the shop and
    // the phone claim those keys while open), and V cycles weapons.
    if (screen === 'play' && !st.shop.open && !st.phone.open) {
      if (actions & ACTION_SLOT1) { const r = world.useCrew('mira'); announce(r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.useCrew('lio'); announce(r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.useCrew('kiki'); announce(r.msg); }
      if (actions & ACTION_WEAPON) { const r = world.cycleWeapon(); announce(r.msg); }
    }
    if (actions & ACTION_INTERACT) {
      if (screen === 'play' && st.shop.near) { const open = world.shop.toggle(st); announce(open ? 'Sunset Arms & Paint — 1 armor, 2 ammo, 3 paint.' : 'Shop closed.'); }
    }
    if (actions & ACTION_PHONE) {
      // v6.4: the phone no longer pauses the screen — the old code set
      // screen='paused', and the pause screen (z-index 20) covered the
      // phone panel (z-index 10), so the job rows were visible but
      // untappable on touch. The world freezes while the panel is open
      // (see step()), exactly like the shop.
      if (screen === 'play') {
        const open = world.phone.toggle();
        announce(open ? 'Phone open. 1 Courier, 2 Vigilante, 3 Racer, 4 Repo.' : 'Playing.');
        return;
      }
      if (screen === 'paused') { screen = 'play'; announce('Playing.'); return; }
    }
    // A canvas tap / click counts as confirm on every non-play screen, so a
    // tap on the title or the briefing always works — it can never leak into
    // gameplay as a gunshot, because pendingShoot is cleared here.
    if (screen === 'title' && (actions & (ACTION_CONFIRM | ACTION_SHOOT))) { startGame(); pendingShoot = false; pendingEnter = false; return; }
    if (screen === 'title' && (actions & ACTION_CONTINUE) && hasSave()) { continueGame(); pendingShoot = false; pendingEnter = false; return; }
    if (screen === 'brief' && (actions & (ACTION_CONFIRM | ACTION_ENTER | ACTION_SHOOT))) { screen = 'play'; announce('Playing. Follow the gold marker.'); pendingEnter = false; pendingShoot = false; return; }
    if (screen === 'over' || screen === 'win') {
      if (actions & (ACTION_CONFIRM | ACTION_SHOOT)) { startGame(); pendingShoot = false; pendingEnter = false; }
      return;
    }
    if (actions & ACTION_PAUSE && screen === 'play') {
      if (st.phone.open) world.phone.toggle(); // never pause with the panel open behind the pause screen
      screen = 'paused'; try { saveGame(world.state); } catch { /* ignore */ } announce('Paused.'); return;
    }
    if (actions & ACTION_PAUSE && screen === 'paused') {
      if (st.phone.open) { world.phone.toggle(); announce('Phone closed. Still paused.'); }
      else { screen = 'play'; announce('Playing.'); }
    }
  }

  // Hit detection for the hit marker: total enemy health before vs after.
  function enemyHealth() {
    let h = 0;
    for (const c of world.state.cops) h += Math.max(0, c.health);
    for (const c of world.state.cars) if (c.cop) h += Math.max(0, c.health);
    for (const g of world.state.gangCars) h += Math.max(0, g.health);
    for (const p of world.state.peds) if (p.alive) h += Math.max(0, p.health);
    return h;
  }

  function step() {
    time += STEP;
    if (screen === 'title') { world.step(STEP, { move: { x: 0, y: 0 } }, true); return; }
    if (screen !== 'play') return;
    // The world freezes while the shop or the phone panel is open (the
    // shop did this already; the phone used to pause the whole screen,
    // which covered its own panel on touch).
    if (world.state.shop.open || world.state.phone.open) return;
    const move = input.move();
    const st = world.state;
    // Touch camera drag: after the drag ends, the orbit eases back
    // behind the player while moving (half-life ~0.9 s); while standing
    // still the dragged view holds so the player can look around.
    if (!input.touch.camDragging && Math.abs(st.player.speed || 0) > 20) {
      input.touch.camYaw *= Math.pow(0.5, STEP / 0.9);
      if (Math.abs(input.touch.camYaw) < 0.005) input.touch.camYaw = 0;
    }
    aiming = (!st.player.inCar) && (input.mouse.aiming || input.touch.shooting);
    aimAngle = computeAim();
    const beforeHealth = enemyHealth();
    const beforeShots = st.shotsFired;
    const ctrl = {
      move, sprint: input.held.sprint,
      // Shift = sprint on foot / BOOST in a car; Space = handbrake in a car.
      boost: input.held.sprint || input.touch.boost,
      handbrake: input.held.handbrake || input.touch.handbrake,
      shoot: pendingShoot || input.mouse.down || input.touch.shooting,
      aimAngle, enter: pendingEnter,
    };
    pendingShoot = false; pendingEnter = false;
    const events = world.step(STEP, ctrl, false);
    // Touch mode switch: driving buttons (GAS/BRK) come out when the player
    // enters a car and SHOOT (useless in a car) hides; on foot it flips back.
    if (st.player.inCar !== lastInCar) { lastInCar = st.player.inCar; input.setInCar(lastInCar); }
    if (st.shotsFired > beforeShots && enemyHealth() < beforeHealth) hud.showHit();
    try {
      radio.tick(STEP);
      audio.engine(st.player.inCar ? st.player.speed : 0, st.player.inCar);
      audio.siren(STEP, st.wanted > 0);
      audio.rotor(STEP, !!st.heli);
      audio.nightAmbience(STEP, st.weather.phase === 'night');
    } catch { /* headless audio */ }
    if (st.drivebyAt !== prevDriveby) { prevDriveby = st.drivebyAt; if (st.drivebyAt >= 0) { try { audio.driveby(); } catch { /* noop */ } } }
    if (events & EVENT_SHOT) { try { audio.shot(); } catch { /* noop */ } }
    if (events & EVENT_PICKUP) { try { audio.pickup(); } catch { /* noop */ } }
    if (events & EVENT_MISSION) { try { audio.mission(); } catch { /* noop */ } }
    if (st.wanted > prevWanted) { try { audio.siren(0, true); } catch { /* noop */ } }
    prevWanted = st.wanted;
    if (events & EVENT_OVER) endRun();
    else if (st.over) endRun();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // Count the sim steps this frame: the walk phase runs on sim time
    // (simDt), not on render calls, so the gait stays in sync at 30 fps.
    let stepsThisFrame = 0;
    if (screen === 'title' || screen === 'play') {
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) { step(); accumulator -= STEP; stepsThisFrame += 1; }
    } else accumulator = 0;
    const saveData = hasSave() ? loadSave() : null;
    renderer3d.render(world.state, screen, time, { dt: STEP, simDt: stepsThisFrame * STEP, aiming, aimAngle, shooting: input.mouse.down || input.touch.shooting, camYaw: input.touch.camYaw, camDragging: input.touch.camDragging });
    hud.update(world.state, screen, {
      time, radioIdx, aiming,
      best, hasSave: !!saveData,
      saveMission: saveData ? (saveData.missionsDone || 0) + 1 : 1,
      saveMoney: saveData ? saveData.money : 0,
      // Phase 3: crew cards / weapon slots are tappable in the HUD.
      onCrew: (id) => { const r = world.useCrew(id); announce(r.msg); },
      onWeapon: (id) => { const r = world.selectWeapon(id); announce(r.msg); },
      onWeaponCycle: () => { const r = world.cycleWeapon(); announce(r.msg); },
    });
    // USE button: only in play, near the shop, while it is closed.
    input.setUseVisible(screen === 'play' && world.state.shop.near && !world.state.shop.open);
    // Autosave (v6.4): the old code saved only on mission completion, so
    // quitting mid-mission lost everything since the last one. Save every
    // 30 s of play; pausing / hiding also saves (see below).
    if (screen === 'play' && time - lastAutosave > 30) {
      lastAutosave = time;
      try { saveGame(world.state); } catch { /* ignore */ }
    }
  }

  // Rotation / resize: release stuck input, resize the WebGL canvas, keep
  // playing. Never reloads.
  function onResize() {
    input.releaseAll();
    fitCanvas();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      if (world.state.phone.open) world.phone.toggle();
      screen = 'paused';
      try { saveGame(world.state); } catch { /* ignore */ }
      announce('Paused.');
    }
  });

  window.__game = {
    screen: () => screen,
    state: world.state,
    world,
    start: startGame,
    continueGame,
    audio, radio, input, hud, renderer3d,
    shop: world.shop, phone: world.phone, weather: world.weather,
    save: { hasSave, loadSave },
    get heli() { return world.state.heli; },
  };
  fitCanvas();
  announce('Vice Coast. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
