// Day/night + weather: a clock that cycles day/sunset/night over ~4 minutes
// of play, and occasional rain. Pure rules — the renderer reads data.phase
// and data.raining to tint the sky, light the streets and draw rain. The
// world owns the data object (state.weather) and calls update() every step.
import { DAY_LENGTH, DAY_PHASES } from './config.js';

function phaseFor(t) {
  const c = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  for (const p of DAY_PHASES) if (c >= p.from && c < p.to) return p.name;
  return 'day';
}

// Clock readout for the HUD: the day starts at 08:00 and runs 24 h per cycle.
export function clockFor(t) {
  const hours = (8 + (((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH) / DAY_LENGTH * 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createWeather(random) {
  const rnd = random || Math.random;
  const data = { t: 0, phase: 'day', raining: false, rainTimer: 0, nextRainIn: 25 + rnd() * 30 };
  function update(dt) {
    data.t += dt;
    const p = phaseFor(data.t);
    if (p !== data.phase) data.phase = p;
    if (data.raining) {
      data.rainTimer -= dt;
      if (data.rainTimer <= 0) { data.raining = false; data.nextRainIn = 20 + rnd() * 40; }
    } else {
      data.nextRainIn -= dt;
      if (data.nextRainIn <= 0) { data.raining = true; data.rainTimer = 15 + rnd() * 15; }
    }
  }
  // Jump the clock to the start of a phase (day 0 s, sunset 120 s, night
  // 170 s) and set the rain on or off — used by the staged screenshots.
  function force(phase, raining) {
    const p = DAY_PHASES.find((x) => x.name === phase) || DAY_PHASES[0];
    data.t = p.from + 1;
    data.phase = phase;
    data.raining = !!raining;
    data.rainTimer = raining ? 60 : 0;
    data.nextRainIn = raining ? 60 : 60;
  }
  function setRain(on) {
    data.raining = !!on;
    if (on) data.rainTimer = 60; else data.nextRainIn = 60;
  }
  function reset() {
    data.t = 0; data.phase = 'day'; data.raining = false; data.rainTimer = 0;
    data.nextRainIn = 25 + rnd() * 30;
  }
  function debug() { return { phase: data.phase, raining: data.raining, t: Math.round(data.t * 10) / 10 }; }
  return { data, update, force, setRain, reset, debug, advance: update };
}
