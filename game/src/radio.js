// Vice Coast radio — three in-car stations, chiptune step sequencer.
// The sequencer only schedules notes through audio.note(); it never touches
// the AudioContext itself, so muting and unlocking stay in audio.js.
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// One bar = 16 sixteenth steps. bass plays on the beat (every 4 steps),
// lead plays the 16-step melody. 0 = rest. Notes are MIDI numbers.
export const STATIONS = [
  {
    name: 'VICE FM',
    tag: 'sunset synth',
    bpm: 104,
    bassWave: 'square', bassVol: 0.05,
    leadWave: 'triangle', leadVol: 0.045,
    bass: [45, 0, 0, 0, 45, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0],
    lead: [69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0, 64, 0],
  },
  {
    name: 'CORAL 88',
    tag: 'funk drive',
    bpm: 116,
    bassWave: 'square', bassVol: 0.06,
    leadWave: 'sawtooth', leadVol: 0.03,
    bass: [41, 0, 41, 0, 44, 0, 41, 0, 46, 0, 44, 0, 41, 0, 39, 0],
    lead: [65, 0, 0, 68, 0, 0, 70, 0, 68, 0, 0, 65, 0, 63, 0, 0],
  },
  {
    name: 'NIGHT TIDE',
    tag: 'late night',
    bpm: 88,
    bassWave: 'triangle', bassVol: 0.07,
    leadWave: 'sine', leadVol: 0.05,
    bass: [38, 0, 0, 0, 0, 0, 41, 0, 38, 0, 0, 0, 0, 0, 43, 0],
    lead: [62, 0, 0, 65, 0, 0, 0, 69, 0, 0, 67, 0, 0, 0, 65, 0],
  },
  {
    name: 'PALM 101',
    tag: 'island groove',
    bpm: 96,
    bassWave: 'sine', bassVol: 0.08,
    leadWave: 'triangle', leadVol: 0.05,
    bass: [43, 0, 0, 43, 0, 0, 48, 0, 43, 0, 0, 43, 0, 0, 45, 0],
    lead: [67, 0, 71, 0, 0, 74, 0, 71, 0, 0, 67, 0, 64, 0, 0, 0],
  },
];

export function createRadio(audio) {
  let station = 0;
  let step = 0;
  let stepTimer = 0;
  let started = false;

  function stationDef() { return STATIONS[station]; }
  function stepDur() { return 60 / stationDef().bpm / 4; }

  function playStep() {
    const s = stationDef();
    const bassNote = s.bass[step];
    if (bassNote) audio.note(midi(bassNote), stepDur() * 3.5, s.bassWave, s.bassVol);
    const leadNote = s.lead[step];
    if (leadNote) audio.note(midi(leadNote), stepDur() * 1.8, s.leadWave, s.leadVol);
  }

  return {
    // Advance the sequencer. Called once per fixed step from main.js.
    // Silent when the game is muted or the audio context is not unlocked yet.
    tick(dt) {
      if (audio.muted || !audio.unlocked) return;
      if (!started) { started = true; step = 0; stepTimer = 0; playStep(); return; }
      stepTimer += dt;
      const d = stepDur();
      while (stepTimer >= d) {
        stepTimer -= d;
        step = (step + 1) % 16;
        playStep();
      }
    },
    // Q cycles stations; a short jingle marks the switch.
    next() {
      station = (station + 1) % STATIONS.length;
      step = 0; stepTimer = 0;
      const s = stationDef();
      audio.note(midi(76), 0.12, 'triangle', 0.06);
      audio.note(midi(81), 0.12, 'triangle', 0.06);
      audio.note(midi(84), 0.2, 'triangle', 0.06);
      return s.name;
    },
    name() { return stationDef().name; },
    tag() { return stationDef().tag; },
    // Test hook: current station index + step, no audio needed.
    debug() { return { station, step, bpm: stationDef().bpm }; },
  };
}
