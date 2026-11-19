// Tiny WebAudio synth: no audio files, everything is oscillators + noise.
// Engine hum, siren, gunshot, pickup blip, mission jingle, crash thud.
// v5 adds a night ambience (soft crickets + wind) and a gang drive-by burst.
export function createAudio() {
  let ctx = null; let muted = false; let engineOsc = null; let engineGain = null; let sirenTimer = 0; let rotorTimer = 0; let nightTimer = 0;
  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime; const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; return muted; },
    get muted() { return muted; },
    // True once an AudioContext exists (unlock() called from a user gesture).
    get unlocked() { return !!ctx; },
    // Public single-note helper for the radio sequencer (same tone() underneath).
    note(freq, dur, type, vol) { tone(freq, dur, type, vol); },
    shot() { noise(0.14, 0.28, 2400); tone(180, 0.08, 'square', 0.1, 60); },
    punch() { noise(0.08, 0.2, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.14); setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70); },
    cash() { tone(880, 0.08, 'triangle', 0.14); setTimeout(() => tone(1174, 0.14, 'triangle', 0.14), 80); },
    crash() { noise(0.25, 0.3, 500); tone(70, 0.2, 'sine', 0.2, 40); },
    siren(dt, on) {
      if (!ensure() || muted) return;
      sirenTimer += dt;
      if (on && engineGain) { /* siren wail via periodic tone */ }
      if (on && sirenTimer > 0.45) { sirenTimer = 0; tone(720, 0.4, 'sine', 0.05, 980); }
    },
    // Helicopter rotor: a low chopped thump while the heli is overhead, using
    // the same short-noise helper as the gunshot. Silent when muted or no heli.
    rotor(dt, on) {
      if (!ensure() || muted) return;
      rotorTimer += dt;
      if (on && rotorTimer > 0.09) { rotorTimer = 0; noise(0.06, 0.12, 300); tone(55, 0.07, 'sine', 0.08, 42); }
    },
    // Night ambience: a soft cricket chirp every couple of seconds plus a
    // low wind wash, only while the in-game clock says night.
    nightAmbience(dt, on) {
      if (!ensure() || muted) return;
      nightTimer += dt;
      if (on && nightTimer > 2.2) {
        nightTimer = 0;
        tone(4200, 0.12, 'sine', 0.015);
        setTimeout(() => tone(3900, 0.1, 'sine', 0.012), 140);
        noise(0.5, 0.015, 400);
      }
    },
    // Gang drive-by: three fast shots in a row, lower and rougher than the
    // player's pistol.
    driveby() {
      [0, 90, 180].forEach((delay) => setTimeout(() => { noise(0.1, 0.2, 1800); tone(140, 0.07, 'square', 0.08, 50); }, delay));
    },
    engine(speed, inCar) {
      if (!ensure()) return;
      const target = muted || !inCar ? 0 : 0.02 + Math.min(0.06, Math.abs(speed) / 560 * 0.06);
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) / 560 * 90, ctx.currentTime, 0.1);
    },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 110)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 160)); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.16), i * 130)); },
  };
}
