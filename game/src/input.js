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
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, aiming: false };
  const touch = { active: false, move: { x: 0, y: 0 }, gas: false, brake: false, shooting: false, elements: null };
  let knobEl = null;

  function queue(action) { actions |= action; }
  function releaseAll() {
    // The rotation fix: drop every held state so nothing stays stuck after
    // the phone is turned or the window is resized.
    for (const k of Object.keys(held)) held[k] = false;
    touch.move.x = 0; touch.move.y = 0; touch.active = false;
    touch.gas = false; touch.brake = false; touch.shooting = false;
    mouse.down = false; mouse.aiming = false;
    if (knobEl) { knobEl.style.left = '40px'; knobEl.style.top = '40px'; }
  }

  window.addEventListener('keydown', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) { held[dir] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM | ACTION_ENTER;
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
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) held[dir] = false;
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
    for (const b of [gas, brake, enter, shoot, radio, phone]) root.appendChild(b);
    document.body.appendChild(root);
    touch.elements = root;
  }

  return {
    held, mouse, touch, queue, releaseAll,
    move() {
      if (touch.active && (Math.abs(touch.move.x) > 0.15 || Math.abs(touch.move.y) > 0.15)) {
        return { x: touch.move.x, y: touch.move.y };
      }
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down || touch.brake ? 1 : 0) - (held.up || touch.gas ? 1 : 0),
      };
    },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
