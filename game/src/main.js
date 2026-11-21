// Vice Coast v6 boot + loop. Fixed 1/60 s steps, screens: title, brief,
// play, paused, over (wasted/busted), win. ?seed=N fixes the city;
// ?shot=chase|play|heist|end stages a screenshot scene and sets
// window.__shotReady. The shop (E), the phone (P — it pauses the game
// while open), save / continue (C on the title), crew abilities (1/2/3),
// weapon cycle (V), nitro (Shift) and handbrake (Space, in the car) all
// live here. Written fresh for the v6 rebuild.
import * as THREE from 'three';
import { BEST_KEY, MISSIONS_KEY, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PHONE, ACTION_RADIO, ACTION_SHOOT, ACTION_SLOT1, ACTION_SLOT2, ACTION_SLOT3, ACTION_SLOT4, ACTION_WEAPON, IS_TOUCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createScene } from './render3d.js';
import { createHud, SCREEN_BRIEF, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './hud.js';
import { stageShot } from './shots.js';
import { hasSave, loadSave, saveGame } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudRoot = document.getElementById('hud');
const world = createWorld(createRandom(seed));
const scene3d = createScene(canvas);
const hud = createHud(hudRoot);
const audio = createAudio();
const radio = createRadio(audio);

function readNum(key) { try { return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0; } catch { return 0; } }
function saveNum(key, v) { try { window.localStorage.setItem(key, String(v)); } catch { /* private mode */ } }

function sizeCanvas() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  scene3d.resize(w, h);
}
window.addEventListener('resize', sizeCanvas);
sizeCanvas();

function runShot(name) {
  const staged = stageShot(name, world);
  window.__game = {
    state: world.state,
    world,
    audio,
    shop: world.shop,
    phone: world.phone,
    weather: world.weather,
    scene: scene3d,
    get heli() { return world.state.heli; },
  };
  let painted = 0;
  function paint() {
    scene3d.update(world.state, STEP, world.state.elapsed + painted * 0.05, 0, staged.screen);
    hud.draw(world.state, staged.screen, staged.best, { time: world.state.elapsed, radio: radio.name(), hasSave: false });
    painted += 1;
    if (painted < 5) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNum(BEST_KEY);
  let missionsBest = readNum(MISSIONS_KEY);
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let prevWanted = 0;
  let prevDriveby = -1;
  let pendingShoot = false;
  let pendingEnter = false;
  let spaceDown = false;
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') spaceDown = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

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
    const st = world.state;
    if (IS_TOUCH || st.player.inCar) return st.player.angle;
    const v = new THREE.Vector3(st.player.x, 60, st.player.y);
    v.project(scene3d.camera);
    const rect = canvas.getBoundingClientRect();
    const px = ((v.x + 1) / 2) * rect.width;
    const py = ((1 - v.y) / 2) * rect.height;
    const dx = input.mouse.x - px;
    const dy = input.mouse.y - py;
    if (Math.hypot(dx, dy) < 4) return st.player.angle;
    return Math.atan2(dy, dx);
  }

  function handleActions() {
    const actions = input.takeActions();
    const st = world.state;
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (actions & ACTION_RADIO) { const name = radio.next(); announce(`Radio: ${name}.`); }
    if (actions & ACTION_SHOOT) pendingShoot = true;
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (actions & ACTION_WEAPON && screen === SCREEN_PLAY) { world.cycleWeapon(); }
    if (st.shop.open) {
      if (actions & ACTION_SLOT1) { const r = world.shop.buy(st, 'armor'); announce(r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.shop.buy(st, 'ammo'); announce(r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.shop.buy(st, 'paint'); announce(r.msg); }
    } else if (st.phone.open) {
      if (actions & ACTION_SLOT1) { const r = world.phone.start(st, 'courier'); announce(r.ok ? 'Courier job started.' : r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.phone.start(st, 'vigilante'); announce(r.ok ? 'Vigilante job started.' : r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.phone.start(st, 'racer'); announce(r.ok ? 'Racer job started.' : r.msg); }
      else if (actions & ACTION_SLOT4) { const r = world.phone.start(st, 'repo'); announce(r.ok ? 'Repo job started.' : r.msg); }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_SLOT1) { const r = world.useCrew('mira'); announce(r.msg); }
      else if (actions & ACTION_SLOT2) { const r = world.useCrew('lio'); announce(r.msg); }
      else if (actions & ACTION_SLOT3) { const r = world.useCrew('kiki'); announce(r.msg); }
    }
    if (actions & ACTION_INTERACT) {
      if (screen === SCREEN_PLAY && st.shop.near) { const open = world.shop.toggle(st); announce(open ? 'Sunset Arms & Paint — 1 armor, 2 ammo, 3 paint.' : 'Shop closed.'); }
    }
    if (actions & ACTION_PHONE) {
      if (screen === SCREEN_PLAY) { world.phone.toggle(); screen = SCREEN_PAUSED; saveGame(st); announce('Phone open. 1 Courier, 2 Vigilante, 3 Racer, 4 Repo.'); return; }
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
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; saveGame(st); announce('Paused.'); return; }
    if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      if (st.phone.open) { world.phone.toggle(); announce('Phone closed. Still paused.'); }
      else { screen = SCREEN_PLAY; announce('Playing.'); }
    }
  }

  function step() {
    time += STEP;
    if (screen === SCREEN_TITLE) { world.step(STEP, { move: { x: 0, y: 0 } }, true); return; }
    if (screen !== SCREEN_PLAY) return;
    if (world.state.shop.open) return;
    const move = input.move();
    const race = world.state.race;
    if (race.available && !race.active && race.countdown <= 0 && world.state.player.inCar) {
      if (Math.hypot(world.state.player.x - 700, world.state.player.y - 3300) < 170) world.startRace();
    }
    const ctrl = {
      move, sprint: input.held.sprint || input.touch.boost,
      shoot: pendingShoot || input.mouse.down || input.touch.shooting,
      aimAngle: aimAngle(), enter: pendingEnter,
      handbrake: (spaceDown && world.state.player.inCar) || input.touch.handbrake,
    };
    pendingShoot = false; pendingEnter = false;
    input.easeCam(STEP, world.state.player.inCar && Math.abs(world.state.player.speed) > 60);
    const events = world.step(STEP, ctrl, false);
    const st = world.state;
    radio.tick(STEP);
    audio.engine(st.player.inCar ? st.player.speed : 0, st.player.inCar);
    audio.siren(STEP, st.wanted > 0);
    audio.rotor(STEP, !!st.heli);
    audio.nightAmbience(STEP, st.weather.phase === 'night');
    if (st.drivebyAt !== prevDriveby) { prevDriveby = st.drivebyAt; if (st.drivebyAt >= 0) audio.driveby(); }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (st.boosting) audio.boost();
    if (st.wanted > prevWanted) audio.siren(0, true);
    prevWanted = st.wanted;
    if (events & EVENT_OVER) endRun();
    else if (st.over) endRun();
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
    scene3d.update(world.state, STEP, time, input.cam.yaw, screen);
    hud.draw(world.state, screen, best, { time, muted: audio.muted, radio: radio.name(), hasSave: !!saveData, saveData });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; saveGame(world.state); announce('Paused.'); }
  });

  hudRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const act = btn.dataset.act;
      if (act === 'start') startGame();
      else if (act === 'continue') continueGame();
      else if (act === 'play' || act === 'resume') { if (screen === SCREEN_BRIEF || screen === SCREEN_PAUSED) { world.state.phone.open = false; screen = SCREEN_PLAY; } }
      else if (act === 'restart') startGame();
      return;
    }
    const crew = e.target.closest('[data-crew]');
    if (crew && screen === SCREEN_PLAY) { const r = world.useCrew(crew.dataset.crew); announce(r.msg); return; }
    const job = e.target.closest('[data-job]');
    if (job && world.state.phone.open) { const r = world.phone.start(world.state, job.dataset.job); announce(r.ok ? `${job.dataset.job} job started.` : r.msg); return; }
    const buy = e.target.closest('[data-buy]');
    if (buy && world.state.shop.open) { const r = world.shop.buy(world.state, buy.dataset.buy); announce(r.msg); }
  });

  window.__game = {
    screen: () => screen,
    state: world.state,
    world,
    start: startGame,
    continueGame,
    audio,
    radio,
    input,
    scene: scene3d,
    shop: world.shop,
    phone: world.phone,
    weather: world.weather,
    save: { hasSave, loadSave },
    get heli() { return world.state.heli; },
  };
  announce('Vice Coast. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
