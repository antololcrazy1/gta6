// In-car radio for the v6 rebuild: five stations, each a 16-step bass and
// lead sequencer. Notes are MIDI numbers (0 = rest), played through the
// audio synth — no audio files, no network. Silent while muted or before
// the audio unlocks. All five melodies were written fresh for this rebuild.
const STATIONS = [
  {
    name: 'VICE FM', tag: 'sunset synth', bpm: 108,
    bassWave: 'sawtooth', bassVol: 0.1, leadWave: 'triangle', leadVol: 0.07,
    bass: [41, 0, 0, 41, 0, 48, 0, 41, 0, 43, 0, 43, 0, 50, 0, 48],
    lead: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0],
  },
  {
    name: 'CORAL 88', tag: 'funk drive', bpm: 118,
    bassWave: 'square', bassVol: 0.09, leadWave: 'sawtooth', leadVol: 0.05,
    bass: [43, 43, 0, 43, 46, 0, 43, 0, 41, 0, 41, 0, 44, 0, 46, 0],
    lead: [67, 0, 70, 0, 72, 0, 70, 67, 0, 70, 0, 74, 0, 72, 0, 70],
  },
  {
    name: 'NIGHT TIDE', tag: 'late night', bpm: 84,
    bassWave: 'sine', bassVol: 0.12, leadWave: 'sine', leadVol: 0.06,
    bass: [36, 0, 0, 0, 36, 0, 0, 41, 0, 0, 0, 43, 0, 0, 41, 0],
    lead: [60, 0, 0, 64, 0, 0, 67, 0, 0, 65, 0, 0, 64, 0, 62, 0],
  },
  {
    name: 'PALM 101', tag: 'island groove', bpm: 100,
    bassWave: 'triangle', bassVol: 0.11, leadWave: 'square', leadVol: 0.05,
    bass: [50, 0, 50, 0, 53, 0, 50, 0, 55, 0, 53, 0, 50, 0, 48, 0],
    lead: [74, 0, 77, 0, 81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0],
  },
  {
    name: 'SUNSET 99', tag: 'chillwave', bpm: 76,
    bassWave: 'sine', bassVol: 0.11, leadWave: 'triangle', leadVol: 0.06,
    bass: [45, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 48, 0, 0, 0],
    lead: [69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0, 64, 0],
  },
];

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function createRadio(audio) {
  let station = 0;
  let step = 0;
  let acc = 0;
  function stepDur() { return 60 / STATIONS[station].bpm / 4; }
  function playStep() {
    const st = STATIONS[station];
    const b = st.bass[step];
    const l = st.lead[step];
    const d = stepDur() * 0.9;
    if (b) audio.note(midiToFreq(b), d, st.bassWave, st.bassVol);
    if (l) audio.note(midiToFreq(l), d, st.leadWave, st.leadVol);
  }
  return {
    tick(dt) {
      if (!audio.unlocked || audio.muted) return;
      acc += dt;
      const d = stepDur();
      while (acc >= d) { acc -= d; playStep(); step = (step + 1) % 16; }
    },
    next() {
      station = (station + 1) % STATIONS.length;
      step = 0;
      acc = 0;
      const st = STATIONS[station];
      [0, 3, 7].forEach((n, i) => setTimeout(() => audio.note(midiToFreq(72 + n), 0.12, st.leadWave, st.leadVol), i * 90));
      return st.name;
    },
    // Round 7: jump to a station by index (the HUD radio ticker uses
    // this) and describe the current station in one object.
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
      acc = 0;
      return STATIONS[station].name;
    },
    stationInfo() {
      const st = STATIONS[station];
      return { name: st.name, tag: st.tag, bpm: st.bpm, index: station, of: STATIONS.length };
    },
    name() { return STATIONS[station].name; },
    tag() { return STATIONS[station].tag; },
    count() { return STATIONS.length; },
    debug() { return { station: STATIONS[station].name, step, bpm: STATIONS[station].bpm }; },
  };
}
