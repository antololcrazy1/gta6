// Sound effects and music hooks for Vice Coast, built on plain WebAudio.
// Everything is guarded: no AudioContext is created until the player has
// interacted, and every call is safe to make before that. Headless playtests
// run with sound effectively muted, which is fine.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;

  function ensure() {
    if (ctx || muted) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch (e) {
      // Sound is decoration; a failure here must never break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || !ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch (e) {
      // Ignore audio failures.
    }
  }

  return {
    ensure,
    setMuted(b) {
      muted = !!b;
      if (master) master.gain.value = muted ? 0 : 0.4;
    },
    // One-shot effects.
    shoot() {
      noise(0.12, 0.35, 2400);
      tone(180, 0.08, 'square', 0.12, 60);
    },
    hit() {
      tone(880, 0.06, 'sine', 0.2);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.2);
      setTimeout(() => tone(990, 0.12, 'sine', 0.2), 70);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.25);
      setTimeout(() => tone(784, 0.16, 'triangle', 0.25), 110);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 130));
    },
    fail() {
      tone(220, 0.4, 'sawtooth', 0.2, 110);
    },
    siren() {
      tone(700, 0.5, 'sine', 0.08, 950);
    },
    cash() {
      tone(1200, 0.07, 'sine', 0.18);
      setTimeout(() => tone(1500, 0.1, 'sine', 0.18), 60);
    },
    // A low engine hum that follows the car's speed, 0 to 1.
    engine(level) {
      if (!ensure() || !ctx) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 50;
          engineGain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 320;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(45 + level * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(level * 0.06, ctx.currentTime, 0.1);
      } catch (e) {
        // Ignore.
      }
    },
    engineOff() {
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    // Music hooks: a tiny bass-line loop per station. The radio module
    // picks the pattern; this just plays it quietly in the background.
    startMusic(pattern) {
      if (!ensure() || !ctx) return;
      this.stopMusic();
      let step = 0;
      const notes = pattern || [110, 0, 130.8, 0, 98, 0, 146.8, 0];
      musicTimer = setInterval(() => {
        const f = notes[step % notes.length];
        if (f) tone(f, 0.22, 'triangle', 0.05);
        step += 1;
      }, 240);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
