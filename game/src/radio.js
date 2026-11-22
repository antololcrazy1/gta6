// The car radio: four stations with a name, a genre line and a bass-line
// pattern the audio module can hum. Q cycles the station; the HUD shows
// the current station in its radio ticker.
export function createRadio(audio) {
  const stations = [
    { name: 'Vice FM', genre: 'Synthwave', pattern: [110, 0, 130.8, 0, 98, 0, 146.8, 0] },
    { name: 'Neon Wave', genre: 'Electro', pattern: [87.3, 87.3, 0, 110, 0, 130.8, 0, 98] },
    { name: 'Coral Coast', genre: 'Reggae', pattern: [98, 0, 0, 98, 0, 123.5, 0, 0] },
    { name: 'Sunset 87', genre: 'Chill', pattern: [130.8, 0, 164.8, 0, 196, 0, 164.8, 0] },
  ];
  let index = 0;
  let on = false;

  return {
    stations: stations.map((s) => s.name),
    name() {
      return stations[index].name;
    },
    genre() {
      return stations[index].genre;
    },
    track() {
      return `${stations[index].name} — ${stations[index].genre}`;
    },
    isOn() {
      return on;
    },
    next() {
      index = (index + 1) % stations.length;
      if (on && audio) audio.startMusic(stations[index].pattern);
      return stations[index].name;
    },
    prev() {
      index = (index - 1 + stations.length) % stations.length;
      if (on && audio) audio.startMusic(stations[index].pattern);
      return stations[index].name;
    },
    start() {
      on = true;
      if (audio) audio.startMusic(stations[index].pattern);
    },
    stop() {
      on = false;
      if (audio) audio.stopMusic();
    },
  };
}
