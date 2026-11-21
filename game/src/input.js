// Keyboard + mouse + touch input for the v6 rebuild. Held keys give a
// movement vector; one-shot presses (confirm, pause, enter car, interact,
// shoot, mute, radio, phone, crew, weapon) are queued as flags. On touch
// devices a virtual joystick (left) plus buttons on the right (GAS, BRAKE,
// BOOST, HANDBRAKE, ENTER, SHOOT, RADIO, PHONE) are overlaid as DOM
// elements. A drag that starts on the left half of the screen outside the
// joystick knob and moves left or right rotates the camera (about 100
// degrees for half a screen drag); the joystick itself is only for movement.
// Written fresh for the rebuild.
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
export const ACTION_SLOT4 = 2048;
export const ACTION_CONTINUE = 4096;
export const ACTION_WEAPON = 8192;

export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
export const TOUCH_HINT = 'Touch: left stick to move • GAS / BRAKE to drive • BOOST + handbrake in car • drag left side to look around';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function makeButton(label, right, bottom, input, onDown, onUp) {
  const b = document.createElement('div');
  b.className = 'vc-btn';
  b.textContent = label;
  b.style.cssText = `position:absolute;right:${right}px;bottom:${bottom}px;width:64px;height:64px;border-radius:50%;background:rgba(20,16,32,0.55);border:2px solid rgba(255,201,60,0.8);color:#fff7e8;font:700 12px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none;pointer-events:auto;`;
  const down = (e) => { e.preventDefault(); e.stopPropagation(); b.style.background = 'rgba(255,201,60,0.75)'; if (onDown) onDown(); };
  const up = () => { b.style.background = 'rgba(20,16,32,0.55)'; if (onUp) onUp(); };
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
  const touch = { active: false, move: { x: 0, y: 0 }, gas: false, brake: false, boost: false, handbrake: false, shooting: false, elements: null };
  const cam = { yaw: 0, swipeId: null, swipeX: 0, swipeY: 0 };

  function queue(action) { actions |= action; }

  window.addEventListener('keydown', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) { held[dir] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM | ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_ENTER;
    else if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyJ') actions |= ACTION_SHOOT;
    else if (event.code === 'KeyP') actions |= ACTION_PHONE;
    else if (event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyQ') actions |= ACTION_RADIO;
    else if (event.code === 'KeyR') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyX') resetCam();
    else if (event.code === 'KeyC') actions |= ACTION_CONTINUE;
    else if (event.code === 'KeyV') actions |= ACTION_WEAPON;
    else if (event.code === 'Digit1') actions |= ACTION_SLOT1;
    else if (event.code === 'Digit2') actions |= ACTION_SLOT2;
    else if (event.code === 'Digit3') actions |= ACTION_SLOT3;
    else if (event.code === 'Digit4') actions |= ACTION_SLOT4;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) held[dir] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    touch.move.x = 0; touch.move.y = 0; touch.active = false;
    touch.gas = false; touch.brake = false; touch.boost = false; touch.handbrake = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (event.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (event.clientY - r.top) * (canvas.height / r.height);
    mouse.down = true;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });

  function swipeStart(x, y, id) {
    if (x < window.innerWidth / 2 && cam.swipeId === null) {
      cam.swipeId = id; cam.swipeX = x; cam.swipeY = y;
    }
  }
  function swipeMove(x, id) {
    if (cam.swipeId !== id) return;
    const dx = x - cam.swipeX;
    cam.yaw += (dx / (window.innerWidth / 2)) * 1.75;
    cam.swipeX = x;
  }
  function swipeEnd(id) { if (cam.swipeId === id) cam.swipeId = null; }
  // Round 7: X snaps the chase camera back behind the car — handy
  // after a long look-around swipe, and the touch UI gets the same
  // reset when the player double-taps the left half of the screen.
  function resetCam() { cam.yaw = 0; }
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') swipeStart(e.clientX, e.clientY, e.pointerId); });
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') swipeMove(e.clientX, e.pointerId); });
  window.addEventListener('pointerup', (e) => swipeEnd(e.pointerId));
  window.addEventListener('pointercancel', (e) => swipeEnd(e.pointerId));

  if (IS_TOUCH && typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.className = 'vc-touch';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
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
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
    stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) stickEnd(); });
    stick.addEventListener('pointercancel', stickEnd);
    root.appendChild(stick);
    const gas = makeButton('GAS', 24, 120, null, () => { touch.gas = true; }, () => { touch.gas = false; });
    const brake = makeButton('BRK', 104, 36, null, () => { touch.brake = true; }, () => { touch.brake = false; });
    const boost = makeButton('BOOST', 24, 204, null, () => { touch.boost = true; }, () => { touch.boost = false; });
    const hb = makeButton('DRIFT', 104, 204, null, () => { touch.handbrake = true; }, () => { touch.handbrake = false; });
    const enter = makeButton('USE', 188, 120, null, () => queue(ACTION_ENTER));
    const shoot = makeButton('SHOOT', 188, 204, null, () => { touch.shooting = true; queue(ACTION_SHOOT); }, () => { touch.shooting = false; });
    const radio = makeButton('RADIO', 272, 36, null, () => queue(ACTION_RADIO));
    const phone = makeButton('PHONE', 272, 120, null, () => queue(ACTION_PHONE));
    const pause = makeButton('II', 24, 300, null, () => queue(ACTION_PAUSE));
    for (const b of [gas, brake, boost, hb, enter, shoot, radio, phone, pause]) root.appendChild(b);
    document.body.appendChild(root);
    touch.elements = root;
  }

  return {
    held, mouse, touch, cam,
    move() {
      if (touch.active && (Math.abs(touch.move.x) > 0.15 || Math.abs(touch.move.y) > 0.15)) {
        return { x: touch.move.x, y: touch.move.y };
      }
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down || touch.brake ? 1 : 0) - (held.up || touch.gas ? 1 : 0),
      };
    },
    easeCam(dt, driving) {
      if (driving) cam.yaw += (0 - cam.yaw) * Math.min(1, dt * 1.4);
    },
    resetCam,
    takeActions() { const t = actions; actions = 0; return t; },
    queue,
  };
}
