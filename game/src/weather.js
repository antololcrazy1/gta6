// Day/night + weather for the 3D rebuild. The clock runs a 240 s day and
// the 3D layer reads phase, sun height and sky colours to light the scene.
// Rain comes in bursts and makes the roads slick. Pure rules — no drawing.
import { DAY_LENGTH, DAY_PHASES } from './config.js';

function phaseFor(t) {
  const c = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  for (const p of DAY_PHASES) if (c >= p.from && c < p.to) return p.name;
  return 'day';
}

export function phaseBlend(t) {
  const c = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  for (const p of DAY_PHASES) {
    if (c >= p.from && c < p.to) return (c - p.from) / (p.to - p.from);
  }
  return 0;
}

export function sunHeight(t) {
  const c = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  if (c < 120) return 0.35 + 0.65 * Math.sin((c / 120) * Math.PI);
  if (c < 170) return Math.max(0, 0.35 * (1 - (c - 120) / 50));
  return -0.25;
}

export const SKY = {
  day: { top: '#3f8fd2', horizon: '#bfe3f2', sun: '#fff3c4', fog: '#bcd8e8' },
  sunset: { top: '#5a2d7a', horizon: '#ff7a3c', sun: '#ffcf5e', fog: '#e88a5a' },
  night: { top: '#0a0d24', horizon: '#27355e', sun: '#c8d4f0', fog: '#141a33' },
};

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
  function debug() {
    return { phase: data.phase, raining: data.raining, t: Math.round(data.t * 10) / 10, sun: Math.round(sunHeight(data.t) * 100) / 100 };
  }
  return { data, update, force, setRain, reset, debug, advance: update };
}
