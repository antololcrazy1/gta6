// Keyboard and touch input for Vice Coast. One object holds the live key
// state and the touch joystick, and the game loop reads a single movement
// vector from it. Edge-triggered keys (Enter, F, P...) are handled by the
// main loop's keydown listener; this module only tracks what is held down.
export function createInput() {
  const keys = new Set();
  const touch = {
    active: false,
    // Joystick vector, -1..1 on each axis (y up is negative, like a stick).
    move: { x: 0, y: 0 },
    // Named touch buttons currently held: drive, brake, shoot, enter, nitro.
    buttons: new Set(),
  };

  return {
    keys,
    touch,
    // True while the key is held.
    isDown(code) {
      return keys.has(code);
    },
    // True while a named touch button is held.
    touchDown(name) {
      return touch.buttons.has(name);
    },
    // The movement vector for this frame: keyboard WASD/arrows, or the
    // touch joystick when it is active. x is strafe, y is forward (+1).
    moveVector() {
      if (touch.active && (touch.move.x !== 0 || touch.move.y !== 0)) {
        return { x: touch.move.x, y: -touch.move.y };
      }
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    // Nitro is Shift on keyboard, or the touch nitro button.
    nitro() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.buttons.has('nitro');
    },
    // Handbrake is Space on keyboard, or the touch brake button.
    handbrake() {
      return keys.has('Space') || touch.buttons.has('brake');
    },
    // Sprint on foot is Shift, same as nitro.
    sprint() {
      return this.nitro();
    },
    // Shooting is J, or a mouse click, or the touch shoot button.
    shootHeld() {
      return keys.has('KeyJ') || touch.buttons.has('shoot');
    },
    // Attach the keyboard listeners to the window.
    attach() {
      window.addEventListener('keydown', (e) => {
        keys.add(e.code);
        // Keep the page from scrolling on game keys.
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => {
        keys.delete(e.code);
      });
      window.addEventListener('blur', () => {
        keys.clear();
        touch.buttons.clear();
        touch.move.x = 0;
        touch.move.y = 0;
      });
    },
    // Feed one joystick update from the touch overlay.
    setJoystick(x, y) {
      touch.active = true;
      touch.move.x = Math.max(-1, Math.min(1, x));
      touch.move.y = Math.max(-1, Math.min(1, y));
    },
    releaseJoystick() {
      touch.move.x = 0;
      touch.move.y = 0;
    },
  };
}
