// Vice Coast boot + loop. Fixed 1/60 s steps, screens: title, brief, play, paused,
// over (wasted/busted), win. ?seed=N fixes the city; ?shot=start|play|chase|heist|end
// stages a screenshot scene and sets window.__shotReady. ?shot=heist stages the
// on-foot Coral Bank shootout (mission 5, 3 stars); the other shots are the
// title, a taxi drive, a 3-star chase and the win screen.
import { BEST_KEY, MISSIONS_KEY, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RADIO, ACTION_SHOOT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRadio } from './radio.js';
import { createEffects } from './effects.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

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
  let pendingShoot = false; let pendingEnter = false;

  function announce(m) { status.textContent = m; }
  function startGame() {
    world.reset(); accumulator = 0; screen = SCREEN_BRIEF; audio.unlock();
    announce('Vice Coast. Mission briefing.');
  }
  function endRun() {
    screen = world.state.over === 'win' ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.money > best) { best = world.state.money; saveNum(BEST_KEY, best); }
    if (world.state.missionsDone > missionsBest) { missionsBest = world.state.missionsDone; saveNum(MISSIONS_KEY, missionsBest); }
    if (world.state.over === 'win') audio.win(); else audio.busted();
    announce(`${world.state.overReason} Money $${world.state.money}. Best $${best}.`);
  }
  function aimAngle() {
    // Mouse position in world coords: canvas is scaled to the window; the view is
    // 1280x720 centred, so map the mouse through the same scale.
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
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Muted.' : 'Sound on.'); }
    if (actions & ACTION_RADIO) { const name = radio.next(); announce(`Radio: ${name}.`); }
    if (actions & ACTION_SHOOT) pendingShoot = true;
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (screen === SCREEN_TITLE && (actions & (ACTION_CONFIRM | ACTION_SHOOT))) { startGame(); pendingShoot = false; pendingEnter = false; return; }
    if (screen === SCREEN_BRIEF && (actions & (ACTION_CONFIRM | ACTION_ENTER))) { screen = SCREEN_PLAY; announce('Playing. Follow the gold marker.'); pendingEnter = false; return; }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) { startGame(); pendingShoot = false; pendingEnter = false; }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); return; }
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
  }

  function step() {
    time += STEP;
    if (screen === SCREEN_TITLE) { world.step(STEP, { move: { x: 0, y: 0 } }, true); return; }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const ctrl = {
      move, sprint: input.held.sprint,
      shoot: pendingShoot || input.mouse.down,
      aimAngle: aimAngle(), enter: pendingEnter,
    };
    pendingShoot = false; pendingEnter = false;
    const events = world.step(STEP, ctrl, false);
    const st = world.state;
    audio.engine(st.player.inCar ? st.player.speed : 0, st.player.inCar);
    audio.siren(STEP, st.wanted > 0);
    audio.rotor(STEP, !!st.heli);
    radio.tick(STEP);
    effects.update(STEP, st);
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (st.wanted > prevWanted) audio.siren(0, true);
    prevWanted = st.wanted;
    if (events & EVENT_OVER && st.over === 'wasted') effects.explode(st.player.x, st.player.y);
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
    renderer.draw(world.state, screen, best, { time, muted: audio.muted, effects, radio: radio.name() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  // Clicking the title / panels also starts: pointerdown on canvas counts as confirm
  // when not playing, handled via ACTION_SHOOT queue — treat a click on title as start.
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE || screen === SCREEN_BRIEF) { /* handleActions picks up ACTION_SHOOT? no — start via keyboard too */ }
  });

  window.__game = {
    screen: () => screen,
    state: world.state,
    world,
    start: startGame,
    audio,
    radio,
    effects,
    // Live helicopter (null below 4 stars); a getter so tests always see the
    // current one, not a stale snapshot from boot.
    get heli() { return world.state.heli; },
  };
  announce('Vice Coast. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
