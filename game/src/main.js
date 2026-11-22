// The entry point for Vice Coast: boot, the screen flow (title, briefing,
// play, paused, over, win), keyboard and touch input, the game loop, and
// the window.__game handle the playtests drive.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { stageShot } from './shots.js';
import { loadGame, applySave, hasSave, saveGame } from './save.js';
import { buyItem, nearShop, SHOP_ITEMS } from './shop.js';

const canvas = document.getElementById('game');
const audio = createAudio();
const radio = createRadio(audio);
const input = createInput();
input.attach();

let world = createWorld(audio);
let state = world.state;
let renderer = createRenderer(canvas, state);
let hud = createHud(state, radio);

// The screen flow. 'title' and 'brief' run the world as an attract mode;
// 'paused' freezes it; 'over' and 'win' are set from state.over.
let screen = 'title';
let shotStaged = false;
let shotFrames = 0;

function setScreen(next) {
  screen = next;
  document.body.dataset.screen = next;
  // Touch buttons: only the one for this screen is tappable.
  const startBtn = document.querySelector('button[data-act="start"]');
  const playBtn = document.querySelector('button[data-act="play"]');
  if (startBtn) startBtn.style.display = next === 'title' ? 'block' : 'none';
  if (playBtn) playBtn.style.display = next === 'brief' ? 'block' : 'none';
  const titleEl = document.getElementById('vc-title');
  if (titleEl) titleEl.style.display = next === 'title' ? 'flex' : 'none';
  const briefEl = document.getElementById('vc-brief');
  if (briefEl) briefEl.style.display = next === 'brief' ? 'flex' : 'none';
  const overEl = document.getElementById('vc-over');
  if (overEl) overEl.style.display = next === 'over' ? 'flex' : 'none';
  const winEl = document.getElementById('vc-win');
  if (winEl) {
    winEl.style.display = next === 'win' ? 'flex' : 'none';
    if (next === 'win') {
      const total = document.getElementById('vc-win-total');
      if (total) total.textContent = `$${state.earnedTotal.toLocaleString('en-US')}`;
      const rankEl = document.getElementById('vc-win-rank');
      if (rankEl) rankEl.textContent = `Rank ${state.rankIndex} · ${state.missionsDone}/10 missions`;
    }
  }
  const continueBtn = document.getElementById('vc-continue');
  if (continueBtn) continueBtn.style.display = next === 'title' && hasSave() ? 'block' : 'none';
}

function restart() {
  world.reset();
  state = world.state;
  setScreen('brief');
}

function startPlay() {
  // Starting from the briefing (re)starts the run at the spawn point,
  // on foot — so the mission always begins from the same place.
  state.player.inCar = false;
  state.player.carId = -1;
  state.player.x = 1300;
  state.player.y = 3300;
  state.player.angle = Math.PI;
  state.player.speed = 0;
  setScreen('play');
  radio.start();
  audio.ensure();
}

function openBrief() {
  setScreen('brief');
  const briefText = document.getElementById('vc-brief-text');
  const m = state.missionIndex;
  if (briefText) {
    briefText.textContent = `Mission ${m + 1} of 10 — press Enter to play.`;
  }
}

// ------------------------------------------------------------ keyboard
// One keydown listener routes every key by the screen the game is on.
// The phone is the only thing that pauses mid-game: P opens it from
// play and closes it from paused. Picking a side job with 1-4 starts
// the job but leaves the phone open — the player closes it with P when
// they are done browsing, so the job, the close and the resume are
// three separate steps and none of them can swallow the next one.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const code = e.code;
  const closePhone = () => {
    state.phone.open = false;
    setScreen('play');
  };
  if (screen === 'title') {
    if (code === 'Space' || code === 'Enter') openBrief();
    else if (code === 'KeyC' && hasSave()) {
      const data = loadGame();
      applySave(state, data);
      world.startMission(Math.min(state.missionsDone, 9));
      setScreen('brief');
    }
    return;
  }
  if (screen === 'brief') {
    if (code === 'Enter' || code === 'Space') startPlay();
    return;
  }
  if (screen === 'over' || screen === 'win') {
    if (code === 'KeyR') restart();
    return;
  }
  if (code === 'KeyR') {
    restart();
    return;
  }
  if (screen === 'paused') {
    if (code === 'KeyP') {
      closePhone();
    } else if (state.phone.open && /^Digit[1-4]$/.test(code)) {
      // Start the job and stay on the phone: P closes it afterwards.
      state.phone.startJob(state, code.slice(5));
    }
    return;
  }
  // screen === 'play'
  if (code === 'KeyP') {
    state.phone.open = true;
    setScreen('paused');
  } else if (code === 'KeyF') {
    world.enterExitCar();
  } else if (code === 'KeyE') {
    if (state.shop.open) state.shop.open = false;
    else if (nearShop(state)) state.shop.open = true;
  } else if (code === 'KeyQ') {
    radio.next();
  } else if (code === 'KeyJ') {
    if (!state.player.inCar) world.shoot(state.player.angle);
  } else if (code === 'Digit1') {
    world.useCrew('mira');
  } else if (code === 'Digit2') {
    world.useCrew('dex');
  } else if (code === 'Digit3') {
    world.useCrew('luna');
  }
});

// Shooting with the mouse: click to fire, nudged toward where on the
// screen the click landed.
canvas.addEventListener('mousedown', (e) => {
  if (screen !== 'play' || state.player.inCar) return;
  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
  world.shoot(state.player.angle + dx * 1.2);
});

// --------------------------------------------------------------- touch
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('vc-touch-device');

function bindTouchButton(act, down, up) {
  const btn = document.querySelector(`button[data-act="${act}"]`);
  if (!btn) return;
  const on = (e) => {
    e.preventDefault();
    if (down) down();
  };
  const off = (e) => {
    e.preventDefault();
    if (up) up();
  };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
}

bindTouchButton('start', () => {
  if (screen === 'title') openBrief();
});
bindTouchButton('play', () => {
  if (screen === 'brief') startPlay();
});
bindTouchButton('shoot', () => {
  if (screen === 'play' && !state.player.inCar) world.shoot(state.player.angle);
});
bindTouchButton('enter', () => {
  if (screen === 'play') world.enterExitCar();
});
bindTouchButton('nitro', () => input.touch.buttons.add('nitro'), () => input.touch.buttons.delete('nitro'));
bindTouchButton('brake', () => input.touch.buttons.add('brake'), () => input.touch.buttons.delete('brake'));
bindTouchButton('drive', () => input.touch.buttons.add('drive'), () => input.touch.buttons.delete('drive'));
bindTouchButton('phone', () => {
  if (screen === 'play') {
    state.phone.open = true;
    setScreen('paused');
  } else if (screen === 'paused') {
    state.phone.open = false;
    setScreen('play');
  }
});

// The joystick: drag to move, release to stop.
const stick = document.querySelector('.vc-joystick');
const knob = document.querySelector('.vc-joystick-knob');
if (stick) {
  let stickId = null;
  const setFromEvent = (e) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    const cl = len > 1 ? 1 / len : 1;
    input.setJoystick(dx * cl, dy * cl);
    if (knob) knob.style.transform = `translate(${dx * cl * 28}px, ${dy * cl * 28}px)`;
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    setFromEvent(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) setFromEvent(e);
  });
  const release = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      input.releaseJoystick();
      if (knob) knob.style.transform = 'translate(0px, 0px)';
    }
  };
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);
}

// ------------------------------------------------------------ the loop
let lastT = performance.now();
let shotReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.5);
  lastT = now;

  // Stage a screenshot when the URL asks for one.
  if (!shotStaged) {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      const seed = parseInt(params.get('seed') || '31', 10);
      stageShot({ state, world }, shot, seed);
      shotStaged = true;
      setScreen('play');
      radio.start();
    }
  }

  // The world runs on title, briefing and play — an attract mode behind
  // the menus, the real game in play. Paused, over and win freeze it.
  if (screen === 'title' || screen === 'brief' || screen === 'play') {
    const mv = input.moveVector();
    // The touch drive button acts as forward.
    if (input.touch.buttons.has('drive')) mv.y = 1;
    world.step(dt, { move: mv, nitro: input.nitro(), handbrake: input.handbrake(), shoot: input.shootHeld() }, isTouch);
    // The run can end inside the step: death or the finale win.
    if (state.over === 'win' && screen !== 'win') setScreen('win');
    else if (state.over === 'dead' && screen !== 'over') setScreen('over');
  }

  renderer.render(dt);
  hud.update(now);

  if (shotStaged && !shotReady) {
    shotFrames += 1;
    if (shotFrames >= 3) {
      shotReady = true;
      window.__shotReady = true;
    }
  }
}

// --------------------------------------------------------- the game API
const game = {
  get state() {
    return state;
  },
  get world() {
    return world;
  },
  radio,
  shop: {
    buy: (st, id) => buyItem(st, id),
    items: SHOP_ITEMS,
  },
  save: {
    hasSave,
    loadGame,
    saveGame: (st) => saveGame(st || state),
    clearSave: () => {
      try {
        window.localStorage.removeItem('vice-coast.save-v6');
      } catch (e) {
        // Ignore.
      }
    },
  },
  screen() {
    return screen;
  },
  sceneDebug() {
    return renderer.sceneDebug();
  },
  get heli() {
    return state.heli;
  },
};
window.__game = game;

setScreen('title');
requestAnimationFrame(frame);
