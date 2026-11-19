// In-car radio: five stations, each a 16-step bass + lead sequencer.
// Notes are MIDI numbers (0 = rest), played through audio.note() — no audio
// files, no network. Silent while muted or before the audio unlocks.
// v5 adds SUNSET 99, a slow chillwave station for night driving.
const STATIONS = [
  {
    name: 'VICE FM', tag: 'sunset synth', bpm: 104,
    bassWave: 'sawtooth', bassVol: 0.10, leadWave: 'triangle', leadVol: 0.07,
    bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0],
    lead: [69, 0, 72, 0, 76, 0, 72, 69, 0, 74, 0, 76, 79, 0, 76, 0],
  },
  {
    name: 'CORAL 88', tag: 'funk drive', bpm: 116,
    bassWave: 'square', bassVol: 0.09, leadWave: 'sawtooth', leadVol: 0.05,
    bass: [41, 41, 0, 41, 0, 44, 0, 41, 46, 0, 46, 0, 44, 0, 41, 0],
    lead: [65, 0, 68, 0, 70, 0, 68, 65, 0, 68, 0, 72, 0, 70, 68, 0],
  },
  {
    name: 'NIGHT TIDE', tag: 'late night', bpm: 88,
    bassWave: 'sine', bassVol: 0.12, leadWave: 'sine', leadVol: 0.06,
    bass: [38, 0, 0, 38, 0, 0, 41, 0, 0, 0, 43, 0, 0, 41, 0, 0],
    lead: [62, 0, 0, 65, 0, 0, 69, 0, 0, 67, 0, 65, 0, 0, 62, 0],
  },
  {
    name: 'PALM 101', tag: 'island groove', bpm: 96,
    bassWave: 'triangle', bassVol: 0.11, leadWave: 'square', leadVol: 0.05,
    bass: [48, 0, 52, 0, 55, 0, 52, 0, 48, 0, 52, 0, 57, 0, 55, 52],
    lead: [72, 0, 76, 79, 0, 76, 0, 72, 74, 0, 76, 0, 79, 0, 81, 0],
  },
  {
    name: 'SUNSET 99', tag: 'chillwave', bpm: 80,
    bassWave: 'sine', bassVol: 0.11, leadWave: 'triangle', leadVol: 0.06,
    bass: [43, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0, 45, 0, 0, 0],
    lead: [67, 0, 71, 0, 74, 0, 71, 0, 69, 0, 72, 0, 76, 0, 74, 0],
  },
];

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function createRadio(audio) {
  let station = 0; let step = 0; let acc = 0;
  function stepDur() { return 60 / STATIONS[station].bpm / 4; } // 16th notes
  function playStep() {
    const st = STATIONS[station];
    const b = st.bass[step], l = st.lead[step];
    const d = stepDur() * 0.9;
    if (b) audio.note(midiToFreq(b), d, st.bassWave, st.bassVol);
    if (l) audio.note(midiToFreq(l), d, st.leadWave, st.leadVol);
  }
  return {
    // Advance the sequencer; silent when muted or the audio never unlocked.
    tick(dt) {
      if (!audio.unlocked || audio.muted) return;
      acc += dt;
      const d = stepDur();
      while (acc >= d) { acc -= d; playStep(); step = (step + 1) % 16; }
    },
    // Cycle to the next station with a short 3-note jingle.
    next() {
      station = (station + 1) % STATIONS.length;
      step = 0; acc = 0;
      const st = STATIONS[station];
      [0, 4, 7].forEach((n, i) => setTimeout(() => audio.note(midiToFreq(69 + n), 0.12, st.leadWave, st.leadVol), i * 90));
      return st.name;
    },
    name() { return STATIONS[station].name; },
    tag() { return STATIONS[station].tag; },
    debug() { return { station: STATIONS[station].name, step, bpm: STATIONS[station].bpm }; },
  };
}
