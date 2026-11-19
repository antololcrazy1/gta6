// Keyboard + mouse + touch input. Held keys give a movement vector; one-shot
// presses (confirm, pause, enter car, interact, shoot, mute, radio, phone,
// shop/phone slots) are queued as flags.
// v5: on touch devices a virtual joystick (left) + buttons on the right
// (GAS, BRAKE, ENTER, SHOOT, RADIO, PHONE) are overlaid on the canvas as DOM
// elements, so the game is playable on a phone without breaking keyboard /
// mouse play on desktop.
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

// Touch devices have no keyboard: the on-foot HUD shows this instead of the
// key list. (Checked once at load; a desktop browser never matches.)
export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
export const TOUCH_HINT = 'Touch: left stick to move  •  GAS / BRAKE to drive  •  SHOOT / ENTER / PHONE on the right';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function makeButton(label, right, bottom, action, input) {
  const b = document.createElement('div');
  b.className = 'vc-btn';
  b.textContent = label;
  b.style.cssText = `position:absolute;right:${right}px;bottom:${bottom}px;width:64px;height:64px;border-radius:50%;background:rgba(20,16,32,0.55);border:2px solid rgba(255,201,60,0.8);color:#fff7e8;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none;`;
  const down = (e) => { e.preventDefault(); b.style.background = 'rgba(255,201,60,0.75)'; input.queue(action); };
  const up = () => { b.style.background = 'rgba(20,16,32,0.55)'; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
  return b;
}

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  const mouse = { x: 640, y: 360, down: false };
  // Touch stick state: a normalised -1..1 vector, zero when released.
  const touch = { active: false, move: { x: 0, y: 0 }, gas: false, brake: false, shooting: false, elements: null };

  function queue(action) { actions |= action; }

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
  window.addEventListener('blur', () => { for (const k of Object.keys(held)) held[k] = false; touch.move.x = 0; touch.move.y = 0; touch.active = false; });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return; // touch aiming is the stick
    const r = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (event.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return; // touch buttons handle taps
    const r = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (event.clientY - r.top) * (canvas.height / r.height);
    mouse.down = true;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });

  // ---- touch overlay (only built on touch devices) ----
  if (IS_TOUCH && typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.className = 'vc-touch';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
    // Virtual joystick, bottom-left.
    const stick = document.createElement('div');
    stick.className = 'vc-joystick';
    stick.style.cssText = 'position:absolute;left:24px;bottom:24px;width:128px;height:128px;border-radius:50%;background:rgba(20,16,32,0.45);border:2px solid rgba(255,255,255,0.35);pointer-events:auto;touch-action:none;';
    const knob = document.createElement('div');
    knob.className = 'vc-knob';
    knob.style.cssText = 'position:absolute;left:40px;top:40px;width:48px;height:48px;border-radius:50%;background:rgba(255,201,60,0.85);';
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
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
    stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) stickEnd(); });
    stick.addEventListener('pointercancel', stickEnd);
    root.appendChild(stick);
    // Right-hand buttons: GAS / BRAKE drive, ENTER gets in/out of a car,
    // SHOOT fires toward the facing direction, RADIO cycles, PHONE opens jobs.
    const gas = makeButton('GAS', 24, 120, 0, { queue: () => {} });
    gas.addEventListener('pointerdown', () => { touch.gas = true; });
    gas.addEventListener('pointerup', () => { touch.gas = false; });
    gas.addEventListener('pointercancel', () => { touch.gas = false; });
    const brake = makeButton('BRK', 104, 36, 0, { queue: () => {} });
    brake.addEventListener('pointerdown', () => { touch.brake = true; });
    brake.addEventListener('pointerup', () => { touch.brake = false; });
    brake.addEventListener('pointercancel', () => { touch.brake = false; });
    const enter = makeButton('ENTER', 104, 120, ACTION_ENTER, { queue });
    const shoot = makeButton('SHOOT', 24, 204, ACTION_SHOOT, { queue });
    shoot.addEventListener('pointerdown', () => { touch.shooting = true; });
    shoot.addEventListener('pointerup', () => { touch.shooting = false; });
    const radio = makeButton('RADIO', 188, 36, ACTION_RADIO, { queue });
    const phone = makeButton('PHONE', 188, 120, ACTION_PHONE, { queue });
    for (const b of [gas, brake, enter, shoot, radio, phone]) root.appendChild(b);
    document.body.appendChild(root);
    touch.elements = root;
  }

  return {
    held, mouse, touch,
    move() {
      // The touch stick wins when it is held; otherwise the keys drive.
      if (touch.active && (Math.abs(touch.move.x) > 0.15 || Math.abs(touch.move.y) > 0.15)) {
        return { x: touch.move.x, y: touch.move.y };
      }
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0) + (touch.gas || touch.brake ? 0 : 0),
        y: (held.down || touch.brake ? 1 : 0) - (held.up || touch.gas ? 1 : 0),
      };
    },
    takeActions() { const t = actions; actions = 0; return t; },
    queue,
  };
}
