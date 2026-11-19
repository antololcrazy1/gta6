// Vice Coast v5 boot + loop. Fixed 1/60 s steps, screens: title, brief, play,
// paused, over (wasted/busted), win. ?seed=N fixes the city; ?shot=start|play|
// chase|heist|end stages a screenshot scene and sets window.__shotReady.
// v5: the shop (E), the phone (P — it pauses the game while open), save /
// continue (C on the title), night ambience, drive-by sounds, and the
// weather / gang / shop / phone handles on window.__game for the tests.
import { BEST_KEY, MISSIONS_KEY, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PHONE, ACTION_RADIO, ACTION_SHOOT, ACTION_SLOT1, ACTION_SLOT2, ACTION_SLOT3, IS_TOUCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createEffects } from './effects.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
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
const renderer = createRenderer(canvas);
const audio = createAudio();
const radio = createRadio(audio);
const effects = createEffects();

function readNum(key) { try { return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; } }
function saveNum(key, v) { try { window.localStorage.setItem(key, String(v)); } catch { /* private mode */ } }

function runShot(name) {
  const scene = stageShot(name, world);
  // Staged pages never boot the game loop, so expose the same test handle the
  // live game does (state + world + live heli) for the screenshot checks.
  window.__game = {
    state: world.state,
    world,
    audio,
    shop: world.shop,
    phone: world.phone,
    weather: world.weather,
    get heli() { return world.state.heli; },
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { time: world.state.elapsed });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNum(BEST_KEY);
  let missionsBest = readNum(MISSIONS_KEY);
  let accumulator = 0; let last = performance.now(); let time = 0;
  let prevWanted = 0;
  let prevDriveby = -1;
  let pendingShoot = false; let pendingEnter = false;

  function announce(m) { status.textContent = m; }
  function startGame() {
    world.reset(); accumulator = 0; screen = SCREEN_BRIEF; audio.unlock();
    announce('Vice Coast. Mission briefing.');
  }
  function continueGame() {
    const data = loadSave();
    if (!data) { announce('No save yet — start a new run.'); return false; }
    world.continueSave(data); accumulator = 0; screen = SCREEN_BRIEF; audio.unlock();
    announce(`Continuing: mission ${Math.min(data.missionsDone + 1, 10)}, $${data.money}.`);
    return true;
  }
  function endRun() {
    screen = world.state.over === 'win' ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.money > best) { best = world.state.money; saveNum(BEST_KEY, best); }
    if (world.state.missionsDone > missionsBest) { missionsBest = world.state.missionsDone; saveNum(MISSIONS_KEY, missionsBest); }
    world.state.best = best;
    saveGame(world.state);
    if (world.state.over === 'win') audio.win(); else audio.busted();
    announce(`${world.state.overReason} Money $${world.state.money}. Best $${best}.`);
  }
  function aimAngle() {
    // Touch players shoot where they face; mouse players aim at the cursor.
    if (IS_TOUCH) return world.state.player.angle;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    const ox = (rect.width - VIEW.width * scale) / 2, oy = (rect.height - VIEW.height * scale) / 2;
    const vx = (input.mouse.x / (window.devicePixelRatio || 1) - ox) / scale;
    const vy = (input.mouse.y / (window.devicePixelRatio || 1) - oy) / scale;
    const cam = world.state.camera;
    return Math.atan2(cam.y + vy - world.state.player.y, cam.x + vx - world.state.player.x);
  }

  function handleActions() {
    const actions = input.takeActions();
    const st = world.state;
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (actions & ACTION_RADIO) { const name = radio.next(); announce(`Radio: ${name}.`); }
    if (actions & ACTION_SHOOT) pendingShoot = true;
    if (actions & ACTION_ENTER) pendingEnter = true;
    // Shop / phone slot keys: 1/2/3 buy from the shop or start a phone job.
    if (st.shop.open) {
      if (actions & ACTION_SLOT1) { const r = world.shop.buy(st, 'armor'); announce(r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.shop.buy(st, 'ammo'); announce(r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.shop.buy(st, 'paint'); announce(r.msg); }
    } else if (st.phone.open) {
      if (actions & ACTION_SLOT1) { const r = world.phone.start(st, 'courier'); announce(r.ok ? 'Courier job started.' : r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.phone.start(st, 'vigilante'); announce(r.ok ? 'Vigilante job started.' : r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.phone.start(st, 'racer'); announce(r.ok ? 'Racer job started.' : r.msg); }
    }
    if (actions & ACTION_INTERACT) {
      if (screen === SCREEN_PLAY && st.shop.near) { const open = world.shop.toggle(st); announce(open ? 'Sunset Arms & Paint — 1 armor, 2 ammo, 3 paint.' : 'Shop closed.'); }
    }
    if (actions & ACTION_PHONE) {
      // P opens the phone (and pauses the game while it is open).
      if (screen === SCREEN_PLAY) { world.phone.toggle(); screen = SCREEN_PAUSED; announce('Phone open. 1 Courier, 2 Vigilante, 3 Racer.'); return; }
      if (screen === SCREEN_PAUSED) {
        if (st.phone.open) { world.phone.toggle(); screen = SCREEN_PLAY; announce('Playing.'); }
        else { screen = SCREEN_PLAY; announce('Playing.'); }
        return;
      }
    }
    if (screen === SCREEN_TITLE && (actions & (ACTION_CONFIRM | ACTION_SHOOT))) { startGame(); pendingShoot = false; pendingEnter = false; return; }
    if (screen === SCREEN_TITLE && (actions & ACTION_CONTINUE) && hasSave()) { continueGame(); pendingShoot = false; pendingEnter = false; return; }
    if (screen === SCREEN_BRIEF && (actions & (ACTION_CONFIRM | ACTION_ENTER))) { screen = SCREEN_PLAY; announce('Playing. Follow the gold marker.'); pendingEnter = false; return; }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) { startGame(); pendingShoot = false; pendingEnter = false; }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); return; }
    if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      if (st.phone.open) { world.phone.toggle(); announce('Phone closed. Still paused.'); }
      else { screen = SCREEN_PLAY; announce('Playing.'); }
    }
  }

  function step() {
    time += STEP;
    if (screen === SCREEN_TITLE) { world.step(STEP, { move: { x: 0, y: 0 } }, true); return; }
    if (screen !== SCREEN_PLAY) return;
    // The shop freezes the action while it is open.
    if (world.state.shop.open) return;
    const move = input.move();
    const ctrl = {
      move, sprint: input.held.sprint,
      shoot: pendingShoot || input.mouse.down || input.touch.shooting,
      aimAngle: aimAngle(), enter: pendingEnter,
    };
    pendingShoot = false; pendingEnter = false;
    const events = world.step(STEP, ctrl, false);
    const st = world.state;
    effects.update(STEP, st);
    radio.tick(STEP);
    audio.engine(st.player.inCar ? st.player.speed : 0, st.player.inCar);
    audio.siren(STEP, st.wanted > 0);
    audio.rotor(STEP, !!st.heli);
    audio.nightAmbience(STEP, st.weather.phase === 'night');
    if (st.drivebyAt !== prevDriveby) { prevDriveby = st.drivebyAt; if (st.drivebyAt >= 0) audio.driveby(); }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (st.wanted > prevWanted) audio.siren(0, true);
    prevWanted = st.wanted;
    if (events & EVENT_OVER) {
      if (st.over === 'wasted') effects.explode(st.player.x, st.player.y);
      endRun();
    } else if (st.over) endRun();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) { step(); accumulator -= STEP; }
    } else accumulator = 0;
    const saveData = hasSave() ? loadSave() : null;
    renderer.draw(world.state, screen, best, { time, muted: audio.muted, effects, radio: radio.name(), hasSave: !!saveData, saveData });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });

  window.__game = {
    screen: () => screen,
    state: world.state,
    world,
    start: startGame,
    continueGame,
    audio,
    radio,
    effects,
    input,
    shop: world.shop,
    phone: world.phone,
    weather: world.weather,
    save: { hasSave, loadSave },
    // Live helicopter (null below 4 stars); a getter so tests always see the
    // current one, not a stale snapshot from boot.
    get heli() { return world.state.heli; },
  };
  announce('Vice Coast. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
