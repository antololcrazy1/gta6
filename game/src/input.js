// Vice Coast v6 — keyboard + mouse + touch input.
// Held keys give a movement vector; one-shot presses (confirm, pause, enter
// car, interact, shoot, mute, radio, phone, shop/phone slots) are queued.
// Touch: virtual joystick (left) + action buttons (right) as DOM elements
// with pointer-events:auto, so every button is really pressable.
// ROTATION (the v5 lesson, ported): on orientationchange / resize the game
// releases every held touch + key state and resizes the canvas — a stuck
// joystick or a frozen frame after rotating the phone cannot happen. The
// main loop calls input.releaseAll() on those events; resize never reloads.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_INTERACT = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_RADIO = 64;
export const ACTION_PHONE = 128;
export const ACTION_SLOT1 = 256;
export const ACTION_SLOT2 = 512;
export const ACTION_SLOT3 = 1024;
export const ACTION_CONTINUE = 2048;
export const ACTION_WEAPON = 4096;
export const ACTION_SLOT4 = 8192;

export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
export const TOUCH_HINT = 'Touch: left stick to move • GAS / BRAKE to drive • SHOOT / ENTER on the right';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function makeButton(label, right, bottom, onDown, onUp) {
  const b = document.createElement('div');
  b.className = 'vc-btn';
  b.textContent = label;
  b.style.cssText = `position:absolute;right:${right}px;bottom:${bottom}px;width:64px;height:64px;border-radius:50%;background:rgba(20,16,32,0.55);border:2px solid rgba(255,201,60,0.8);color:#fff7e8;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none;pointer-events:auto;`;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(255,201,60,0.75)'; if (onDown) onDown(); });
  const up = () => { b.style.background = 'rgba(20,16,32,0.55)'; if (onUp) onUp(); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, aiming: false };
  const touch = { active: false, move: { x: 0, y: 0 }, gas: false, brake: false, shooting: false, boost: false, handbrake: false, elements: null, camYaw: 0, camDragging: false };
  let knobEl = null;
  // Touch camera drag: the pointer being tracked + its last x.
  let camId = null, camLastX = 0;
  // Driving-mode buttons (toggled by setInCar): GAS/BRK only make sense in
  // a car, SHOOT only on foot. Kept here so setInCar can flip them.
  let gasBtn = null, brakeBtn = null, shootBtn = null;
  // Phase 3: BOOST (nitro) takes SHOOT's slot while driving; HBRK is the
  // handbrake. Both are car-only.
  let boostBtn = null, hbrkBtn = null;
  // Whether the player is in a car (set by setInCar): Space becomes the
  // handbrake instead of confirm/enter while driving.
  let inCarMode = false;
  // v6.4: a USE button (opens the shop when near it — the shop had no touch
  // equivalent for the E key) and a PAUSE button (pause had no touch
  // equivalent for Esc). Positions depend on orientation: portrait has
  // vertical room for a stack; short landscape puts them in a fourth
  // column clear of the dialog, the money panel and the minimap.
  let useBtn = null, pauseBtn = null;
  function layoutTouchButtons() {
    if (!useBtn || !pauseBtn) return;
    const shortLandscape = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
    if (shortLandscape) {
      useBtn.style.right = '272px'; useBtn.style.bottom = '120px';
      pauseBtn.style.right = '272px'; pauseBtn.style.bottom = '204px';
    } else {
      useBtn.style.right = '24px'; useBtn.style.bottom = '288px';
      pauseBtn.style.right = '188px'; pauseBtn.style.bottom = '204px';
    }
  }
  function setUseVisible(v) {
    if (!useBtn) return;
    useBtn.style.display = v ? 'flex' : 'none';
  }
  function setInCar(inCar) {
    inCarMode = inCar;
    if (!gasBtn) return;
    gasBtn.style.display = inCar ? 'flex' : 'none';
    brakeBtn.style.display = inCar ? 'flex' : 'none';
    shootBtn.style.display = inCar ? 'none' : 'flex';
    if (boostBtn) boostBtn.style.display = inCar ? 'flex' : 'none';
    if (hbrkBtn) hbrkBtn.style.display = inCar ? 'flex' : 'none';
    // A button hidden mid-press never fires pointerup: drop the held state
    // of the buttons that just disappeared, or the car/player drives itself.
    if (inCar) touch.shooting = false;
    else { touch.gas = false; touch.brake = false; touch.boost = false; touch.handbrake = false; }
  }

  function queue(action) { actions |= action; }
  function releaseAll() {
    // The rotation fix: drop every held state so nothing stays stuck after
    // the phone is turned or the window is resized.
    for (const k of Object.keys(held)) held[k] = false;
    touch.move.x = 0; touch.move.y = 0; touch.active = false;
    touch.gas = false; touch.brake = false; touch.shooting = false;
    touch.boost = false; touch.handbrake = false;
    touch.camYaw = 0; touch.camDragging = false; camId = null;
    mouse.down = false; mouse.aiming = false;
    if (knobEl) { knobEl.style.left = '40px'; knobEl.style.top = '40px'; }
    layoutTouchButtons();
  }

  window.addEventListener('keydown', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) { held[dir] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Space') {
      // In a car Space is the handbrake, not confirm/enter — F is
      // enter/exit now, so Space is free while driving.
      if (inCarMode) held.handbrake = true;
      else actions |= ACTION_CONFIRM | ACTION_ENTER;
    } else if (event.code === 'Enter') actions |= ACTION_CONFIRM | ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_ENTER;
    else if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyJ') actions |= ACTION_SHOOT;
    else if (event.code === 'KeyP') actions |= ACTION_PHONE;
    else if (event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyQ') actions |= ACTION_RADIO;
    else if (event.code === 'KeyR') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyC') actions |= ACTION_CONTINUE;
    else if (event.code === 'Digit1') actions |= ACTION_SLOT1;
    else if (event.code === 'Digit2') actions |= ACTION_SLOT2;
    else if (event.code === 'Digit3') actions |= ACTION_SLOT3;
    else if (event.code === 'Digit4') actions |= ACTION_SLOT4;
    else if (event.code === 'KeyV') actions |= ACTION_WEAPON;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) held[dir] = false;
    if (event.code === 'Space') held.handbrake = false;
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // Mouse: move tracks the cursor; press-and-hold aims + shoots on foot.
  // A plain click on the canvas is ALSO a confirm (title / briefing), but
  // only when the game is not in play — the main loop decides, so a tap on
  // the briefing can never leak through as a gunshot.
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    mouse.x = event.clientX; mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    mouse.x = event.clientX; mouse.y = event.clientY;
    mouse.down = true; mouse.aiming = true;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; mouse.aiming = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch camera drag (Hanz: swipe the LEFT side of the screen left/right
  // to turn the camera; the joystick is movement only, on foot and in a
  // car). Attached to the canvas, not to an overlay: the joystick, the
  // action buttons, the HUD panels and the big buttons are separate
  // elements above the canvas, so a touch that starts on any of them
  // never reaches here — no conflict by construction. A touch that starts
  // on the right half is ignored (that side is buttons), and a touch that
  // starts on the joystick knob is the analog stick, not a drag: the
  // stick element intercepts it first and stops propagation.
  // The canvas has touch-action:none, so pointermove fires for the whole
  // drag instead of the browser stealing it as a scroll.
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || camId !== null) return;
    if (event.clientX > window.innerWidth * 0.5) return;
    camId = event.pointerId; camLastX = event.clientX; touch.camDragging = true;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || event.pointerId !== camId) return;
    const dx = event.clientX - camLastX; camLastX = event.clientX;
    // Drag right -> view turns right (forward azimuth grows); a full
    // half-screen swipe is ~100 deg. Clamped to +/-180 deg so a long
    // drag can never spin the camera around wildly.
    touch.camYaw = Math.max(-Math.PI, Math.min(Math.PI, touch.camYaw + dx * 0.0045));
  });
  const camEnd = (event) => { if (event.pointerId === camId) { camId = null; touch.camDragging = false; } };
  canvas.addEventListener('pointerup', camEnd);
  canvas.addEventListener('pointercancel', camEnd);

  // ---- touch overlay (only built on touch devices) ----
  if (IS_TOUCH && typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.className = 'vc-touch';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;';
    const stick = document.createElement('div');
    stick.className = 'vc-joystick';
    stick.style.cssText = 'position:absolute;left:24px;bottom:24px;width:128px;height:128px;border-radius:50%;background:rgba(20,16,32,0.45);border:2px solid rgba(255,255,255,0.35);pointer-events:auto;touch-action:none;';
    const knob = document.createElement('div');
    knob.className = 'vc-knob';
    knob.style.cssText = 'position:absolute;left:40px;top:40px;width:48px;height:48px;border-radius:50%;background:rgba(255,201,60,0.85);';
    knobEl = knob;
    stick.appendChild(knob);
    let stickId = null;
    function stickMove(e) {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      touch.move.x = dx; touch.move.y = dy; touch.active = true;
      knob.style.left = `${40 + dx * 34}px`; knob.style.top = `${40 + dy * 34}px`;
    }
    function stickEnd() { stickId = null; touch.move.x = 0; touch.move.y = 0; touch.active = false; knob.style.left = '40px'; knob.style.top = '40px'; }
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch { /* noop */ } stickMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
    stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) stickEnd(); });
    stick.addEventListener('pointercancel', stickEnd);
    root.appendChild(stick);
    const gas = makeButton('GAS', 24, 120, () => { touch.gas = true; }, () => { touch.gas = false; });
    const brake = makeButton('BRK', 104, 36, () => { touch.brake = true; }, () => { touch.brake = false; });
    const enter = makeButton('ENTER', 104, 120, () => queue(ACTION_ENTER));
    const shoot = makeButton('SHOOT', 24, 204, () => { touch.shooting = true; queue(ACTION_SHOOT); }, () => { touch.shooting = false; });
    const radio = makeButton('RADIO', 188, 36, () => queue(ACTION_RADIO));
    const phone = makeButton('PHONE', 188, 120, () => queue(ACTION_PHONE));
    const use = makeButton('USE', 24, 288, () => queue(ACTION_INTERACT));
    const pause = makeButton('PAUSE', 188, 204, () => queue(ACTION_PAUSE));
    // Phase 3: BOOST takes SHOOT's slot (24,204) while driving; HBRK sits
    // in the free slot next to it. Both are car-only (see setInCar).
    const boost = makeButton('BOOST', 24, 204, () => { touch.boost = true; }, () => { touch.boost = false; });
    const hbrk = makeButton('HBRK', 104, 204, () => { touch.handbrake = true; }, () => { touch.handbrake = false; });
    gasBtn = gas; brakeBtn = brake; shootBtn = shoot;
    boostBtn = boost; hbrkBtn = hbrk;
    useBtn = use; pauseBtn = pause;
    // USE only shows near the shop (main loop toggles it); PAUSE is always on.
    use.style.display = 'none';
    // On foot by default: GAS/BRK hidden until the player enters a car.
    setInCar(false);
    layoutTouchButtons();
    for (const b of [gas, brake, enter, shoot, radio, phone, use, pause, boost, hbrk]) root.appendChild(b);
    document.body.appendChild(root);
    touch.elements = root;
  }

  return {
    held, mouse, touch, queue, releaseAll, setInCar, setUseVisible,
    move() {
      // Keyboard + GAS/BRK give the base vector. A live joystick steers
      // (x) and, when no pedal is held, also throttles (y) — but GAS/BRK
      // always win the throttle: v6.1 let a held joystick swallow GAS
      // entirely, so steering + GAS together left the car dead.
      let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let y = (held.down || touch.brake ? 1 : 0) - (held.up || touch.gas ? 1 : 0);
      if (touch.active && (Math.abs(touch.move.x) > 0.15 || Math.abs(touch.move.y) > 0.15)) {
        x = touch.move.x;
        if (!touch.gas && !touch.brake) y = touch.move.y;
      }
      return { x, y };
    },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
