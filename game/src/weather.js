// The day cycle and the rain for Vice Coast. A full day is 240 seconds of
// play: day for the first 120, sunset from 120 to 170, night from 170 to
// 240, then a new morning. The sun's direction follows the phase, low and
// orange at sunset, high at midday, gone at night.
import { CFG } from './config.js';

// Where in the cycle each named phase sits, in seconds.
const PHASES = {
  day: { start: 0, end: CFG.DAY_END },
  sunset: { start: CFG.DAY_END, end: CFG.SUNSET_END },
  night: { start: CFG.SUNSET_END, end: CFG.DAY_LENGTH },
};

export function createWeather() {
  const w = {
    // Seconds into the current day. Starts in the morning.
    t: 30,
    raining: false,
    // The phase name: 'day', 'sunset' or 'night'.
    phase() {
      if (w.t < CFG.DAY_END) return 'day';
      if (w.t < CFG.SUNSET_END) return 'sunset';
      return 'night';
    },
    // Jump the clock to the middle of a named phase (used by screenshots).
    setPhase(name) {
      const p = PHASES[name];
      if (p) w.t = (p.start + p.end) / 2;
    },
    // Move the clock forward, wrapping to a new morning.
    advance(seconds) {
      w.t = (w.t + seconds) % CFG.DAY_LENGTH;
    },
    // Rain on or off. Rain is rare and short: it clears by itself.
    setRain(on) {
      w.raining = !!on;
    },
    // The sun's direction as a unit-ish vector, for light and shadows.
    // The world is Z-up: x is east-west, y is north-south, z is vertical.
    // Low in the west at sunset, high at midday, below the horizon at night.
    sunDirection() {
      const p = w.phase();
      if (p === 'day') {
        const f = w.t / CFG.DAY_END;
        return { x: -0.55 + f * 0.35, y: 0.35, z: 0.85 - f * 0.25 };
      }
      if (p === 'sunset') {
        const f = (w.t - CFG.DAY_END) / (CFG.SUNSET_END - CFG.DAY_END);
        return { x: -0.95, y: 0.12, z: 0.28 - f * 0.16 };
      }
      return { x: -0.3, y: 0.4, z: -0.2 };
    },
    // How bright the sun is right now, 0 to 1.
    sunStrength() {
      const p = w.phase();
      if (p === 'day') return 1;
      if (p === 'sunset') return 0.55;
      return 0.12;
    },
    // Sky colours for the current phase, as CSS strings for the HUD sky.
    skyColors() {
      const p = w.phase();
      if (p === 'day') return { top: '#7fb2dd', mid: '#bcd8ec', low: '#e8d9b0' };
      if (p === 'sunset') return { top: '#5a3d8a', mid: '#e85d75', low: '#ff9a5c' };
      return { top: '#070d24', mid: '#16224d', low: '#2a2f5e' };
    },
    // A small debug snapshot for the playtest harness.
    debug() {
      return { phase: w.phase(), t: Math.round(w.t * 10) / 10, raining: w.raining };
    },
  };
  return w;
}
