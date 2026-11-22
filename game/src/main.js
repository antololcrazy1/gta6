// Vice Coast — game entry and boot.
//
// This file owns the screen state machine (title, briefing, play, paused,
// game over, win), wires keyboard and touch input into the world, runs the
// frame loop, keeps the HUD and the 3D renderer in step, and hooks the
// autosave (every 30 seconds of play, when the phone pauses the game, and
// when the tab is hidden) plus Continue across reloads. The simulation
// itself lives in world.js; the presentation in render3d.js and hud.js.
// Nothing in here knows how a mission or a car works — it just calls the
// modules that do.
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createRadio } from './radio.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { MISSIONS, missionSummary } from './missions.js';
import { CREW, RANKS } from './config.js';
import { buyItem, nearShop } from './shop.js';
import { stageShot } from './shots.js';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const screens = {
  title: document.getElementById('vc-title'),
  brief: document.getElementById('vc-brief'),
  over: document.getElementById('vc-over'),
  win: document.getElementById('vc-win'),
};
const briefTitle = document.getElementById('vc-brief-title');
const briefText = document.getElementById('vc-brief-text');
const winTotal = document.getElementById('vc-win-total');
const winRank = document.getElementById('vc-win-rank');
const continueBtn = document.getElementById('vc-continue');

// ---------------------------------------------------------------------------
// Subsystems
// ---------------------------------------------------------------------------
const audio = createAudio();
const input = createInput();
input.attach();

const world = createWorld(audio);
const state = world.state;
const radio = createRadio(audio);
const renderer = createRenderer(canvas, state);
const hud = createHud(state, radio);

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('vc-touch-device');

// ---------------------------------------------------------------------------
// Screen state machine
// ---------------------------------------------------------------------------
// title -> brief -> play <-> paused ; play -> over | win ; over | win -> brief
let screen = 'title';

function rankName() {
  const rank = RANKS[state.rankIndex] || RANKS[0];
  return rank ? rank.name : 'Rookie';
}

function refreshBrief() {
  const summary = missionSummary(state);
  const mission = MISSIONS[state.missionIndex];
  briefTitle.textContent = mission
    ? `MISSION ${state.missionIndex + 1} OF 10 — ${summary.name.toUpperCase()}`
    : 'FREE ROAM';
  briefText.textContent = mission
    ? `${mission.briefing} Pays $${mission.pay}. Press Enter to play.`
    : 'The city is yours. Press Enter to play.';
}

function refreshWin() {
  // The win screen shows the real dynamic total of everything earned,
  // never a fixed number.
  winTotal.textContent = `$${state.earnedTotal}`;
  winRank.textContent = `${rankName()} · ${state.missionsDone}/10 missions · $${state.money}`;
}

function showScreen(next) {
  screen = next;
  document.body.dataset.screen = next;
  screens.title.style.display = next === 'title' ? 'flex' : 'none';
  screens.brief.style.display = next === 'brief' ? 'flex' : 'none';
  screens.over.style.display = next === 'over' ? 'flex' : 'none';
  screens.win.style.display = next === 'win' ? 'flex' : 'none';
  if (next === 'brief') refreshBrief();
  if (next === 'win') refreshWin();
}

function toBrief() {
  showScreen('brief');
}

function toPlay() {
  showScreen('play');
  audio.ensure();
  radio.start();
}

// Continue a saved run: the mission index follows the missions done and
// the money, earned total and respect carry over; then the briefing for
// that mission is shown.
function continueGame() {
  const data = loadGame();
  if (!data) return;
  applySave(state, data);
  world.startMission(state.missionIndex);
  toBrief();
}

function openPhone() {
  state.phone.open = true;
  showScreen('paused');
  saveGame(state);
}

function closePhone() {
  state.phone.open = false;
  showScreen('play');
}

function restartRun() {
  state.phone.open = false;
  state.shop.open = false;
  world.reset();
  toBrief();
}

// ---------------------------------------------------------------------------
// Keyboard — edge-triggered actions. Held keys (WASD, Shift, Space, J) are
// read by the input module and fed to the world every frame.
// ---------------------------------------------------------------------------
const CREW_BY_DIGIT = { Digit1: 'mira', Digit2: 'dex', Digit3: 'luna' };

function crewIdForDigit(code) {
  if (CREW_BY_DIGIT[code]) return CREW_BY_DIGIT[code];
  const n = Number(code.slice(5));
  const member = CREW[n - 1];
  return member ? member.id : null;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  audio.ensure();
  const code = e.code;

  if (code === 'Space' || code === 'Enter') {
    if (screen === 'title') {
      // START begins a fresh run: the title screen may be showing a
      // state the playtest (or a previous run) moved around, so the new
      // game starts from the spawn, on foot, on mission 1. Continue (C)
      // is the path that keeps a save; START never is.
      restartRun();
      e.preventDefault();
      return;
    }
    if (screen === 'brief') {
      toPlay();
      e.preventDefault();
      return;
    }
  }

  if (code === 'KeyC' && screen === 'title' && hasSave()) {
    continueGame();
    return;
  }

  if (code === 'KeyR') {
    if (screen === 'over' || screen === 'win' || screen === 'play' || screen === 'paused') {
      restartRun();
    }
    return;
  }

  if (screen === 'play') {
    if (code === 'KeyF') {
      world.enterExitCar();
    } else if (code === 'KeyJ') {
      // A tap fires at once, even if the next frame is slow to arrive;
      // holding J keeps firing through the frame loop's shoot polling.
      if (!state.player.inCar) world.shoot(state.player.angle);
    } else if (code === 'KeyE') {
      if (state.shop.open) {
        state.shop.open = false;
      } else if (nearShop(state)) {
        state.shop.open = true;
      }
    } else if (code === 'KeyQ') {
      radio.next();
    } else if (code === 'KeyP') {
      openPhone();
    } else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
      const id = crewIdForDigit(code);
      if (id) world.useCrew(id);
    }
    return;
  }

  if (screen === 'paused') {
    if (code === 'KeyP') {
      closePhone();
      return;
    }
    // Phone jobs: pressing 1-4 starts the job and LEAVES THE PHONE OPEN,
    // so the player can watch the job and close it with P when ready.
    // (Auto-closing here used to make the next P press re-open the phone
    // and leave the game paused, which broke courier, repo and rank runs.)
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4') {
      state.phone.startJob(state, code.slice(5));
    }
  }
});

// ---------------------------------------------------------------------------
// Touch controls
// ---------------------------------------------------------------------------
const joystick = document.querySelector('.vc-joystick');
const knob = document.querySelector('.vc-joystick-knob');
let joyPointer = null;

function joystickVector(e) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = (e.clientX - cx) / (rect.width / 2);
  let dy = (e.clientY - cy) / (rect.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  return { x: dx, y: dy };
}

if (joystick) {
  joystick.addEventListener('pointerdown', (e) => {
    joyPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    const v = joystickVector(e);
    input.setJoystick(v.x, v.y);
    if (knob) knob.style.transform = `translate(${v.x * 32}px, ${v.y * 32}px)`;
    e.preventDefault();
  });
  joystick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointer) return;
    const v = joystickVector(e);
    input.setJoystick(v.x, v.y);
    if (knob) knob.style.transform = `translate(${v.x * 32}px, ${v.y * 32}px)`;
  });
  const releaseJoy = (e) => {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    input.releaseJoystick();
    if (knob) knob.style.transform = '';
  };
  joystick.addEventListener('pointerup', releaseJoy);
  joystick.addEventListener('pointercancel', releaseJoy);
}

// Touch buttons: drive/brake/shoot/nitro are held; enter and phone act on tap.
const HOLD_BUTTONS = new Set(['drive', 'brake', 'shoot', 'nitro']);
document.querySelectorAll('.vc-touch .vc-btn').forEach((btn) => {
  const act = btn.dataset.act;
  if (!act) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.ensure();
    if (act === 'enter') {
      if (screen === 'play') world.enterExitCar();
      return;
    }
    if (act === 'phone') {
      if (screen === 'play') openPhone();
      else if (screen === 'paused') closePhone();
      return;
    }
    if (HOLD_BUTTONS.has(act)) input.touch.buttons.add(act);
  });
  const release = () => input.touch.buttons.delete(act);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});

// Title / briefing buttons (tap targets for phone players).
document.querySelectorAll('button[data-act="start"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (screen === 'title') restartRun();
  });
});
document.querySelectorAll('button[data-act="play"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (screen === 'brief') toPlay();
  });
});
if (continueBtn) {
  continueBtn.addEventListener('click', () => {
    if (screen === 'title') continueGame();
  });
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
let lastNow = performance.now();
let lastSaveAt = 0;
const IDLE_INPUT = { move: { x: 0, y: 0 }, nitro: false, handbrake: false, shoot: false };

function frameInput() {
  const mv = input.moveVector();
  if (input.touchDown('drive')) mv.y = 1;
  return {
    move: mv,
    nitro: input.nitro(),
    handbrake: input.handbrake(),
    shoot: input.shootHeld(),
  };
}

function loop(now) {
  requestAnimationFrame(loop);
  // The world splits a big dt into 1/30s substeps, so game time tracks
  // wall time even at 2 fps under software rendering. Cap only absurd
  // stalls (a backgrounded tab), never the normal slow frame: clamping
  // tight starves the traffic director and the chase camera, which both
  // work in game time.
  const dt = Math.max(0, Math.min((now - lastNow) / 1000, 1.0));
  lastNow = now;

  // The phone pauses the game: opening it flips to the paused screen and
  // closing it resumes. The key handler sets this, the loop keeps it true
  // if anything else opened the phone.
  if (state.phone.open && screen === 'play') showScreen('paused');
  if (!state.phone.open && screen === 'paused') showScreen('play');

  // The city stays alive behind the title and briefing screens so the
  // streets, pedestrians and traffic are already moving when play starts.
  // Paused, game-over and win screens freeze the simulation.
  if (screen === 'play') {
    world.step(dt, frameInput(), isTouchDevice);
  } else if (screen === 'title' || screen === 'brief') {
    world.step(dt, IDLE_INPUT, isTouchDevice);
  }

  // End of the run: death ends the game, the last mission wins it.
  if (screen === 'play' && state.over === 'dead') showScreen('over');
  if (screen === 'play' && state.over === 'win') showScreen('win');

  // Engine hum follows the car; silence on foot.
  if (screen === 'play' && state.player.inCar) {
    const car = state.cars.find((c) => c.id === state.player.carId);
    const level = car ? Math.min(1, Math.abs(car.speed) / 448) : 0;
    audio.engine(level);
  } else {
    audio.engineOff();
  }

  // Autosave every 30 seconds of play.
  if (screen === 'play' && now - lastSaveAt > 30000) {
    saveGame(state);
    lastSaveAt = now;
  }

  hud.update(now);
  renderer.render(dt);
}

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());

// Save when the tab is hidden mid-run.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (screen === 'play' || screen === 'paused')) {
    saveGame(state);
  }
});

// ---------------------------------------------------------------------------
// The handle the playtest harness and the screenshot driver use.
// ---------------------------------------------------------------------------
const game = {
  state,
  world,
  screen: () => screen,
  get heli() {
    return state.heli;
  },
  radio,
  shop: {
    buy: buyItem,
    near: nearShop,
  },
  save: {
    hasSave,
    loadGame,
    saveGame,
    applySave,
  },
  sceneDebug: () => renderer.sceneDebug(),
};
window.__game = game;
window.__shotReady = false;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
if (hasSave()) {
  continueBtn.style.display = 'block';
}

const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
const shotSeed = Number(params.get('seed') || 31);

if (shotKind) {
  // Staged screenshot mode: skip the title screen and go straight into
  // the simulation so the driver can settle the scene.
  showScreen('play');
} else {
  showScreen('title');
}

requestAnimationFrame(loop);

if (shotKind) {
  stageShot(game, shotKind, shotSeed).catch((err) => {
    console.error('shot staging failed', err);
  });
}
