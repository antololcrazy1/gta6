# Vice Coast — Make GTA 6 entry

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/antololcrazy1/gta6/rank.svg)
![reward](https://make.fun/badge/gta6-01/antololcrazy1/gta6/reward.svg)

An original open-world crime game built for the [make.fun](https://make.fun) bounty **[gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01)** — a sun-soaked coastal city to explore on foot and by car, in the spirit of GTA 6, with none of Rockstar's names, characters, map, art or music. Everything here — the city, the characters, the story, the art and the sounds — is original.

## Play it

Serve the `game/` folder with any static server, then open `game/index.html` in desktop Chrome. No build step, no network request — every script, image, sound and font is a file under `game/` or generated in code. Three.js r160 loads from the unpkg CDN through an import map (the only network request the game makes).

```sh
node serve.ts   # then open http://localhost:8080
```

The dev server also serves the staged screenshots under `/shots/` and the shot manifest as JSON at `/shots`.

## The game

You are a newcomer in **Vice Coast**, a coastal city of neon hotels, a wooden pier, parks, docks and a coral bank, split into four districts — Beach, Neon Downtown, Coral Docks and the Suburbs. Explore the 11400×6600 city, steal cars, dodge the Vice Coast PD, and run a 10-mission story chain:

1. **Sunset Taxi** — pick up Maya at the pier, drop her at the Neon Hotel ($150)
2. **Package Run** — collect 3 packages around Palm Row and deliver them to the docks ($250)
3. **Getaway** — grab the bag from the arcade and reach the hideout in 180 seconds ($350)
4. **Lose the Heat** — break line of sight at 3 wanted stars until the heat dies down ($400)
5. **The Sunset Heist** — hit the Coral Bank vault and escape to the hideout ($800)
6. **Vice Nights** — collect 4 night drops, one at each corner of the city, then deliver them to the hideout; starts hot at 4 stars with the helicopter already up ($1000)
7. **Sunset Showdown** — reach the Sunset Pier in 180 seconds with 5 stars on you ($1200)
8. **Harbor Lights** — smuggle run: collect 3 crates on the docks road and deliver them to the boat at the Sunset Pier in 180 seconds ($1400)
9. **Neon Reign** — gang turf war: torch 3 rival Viper cars in Neon Downtown, then hold the turf marker for 20 seconds ($1600)
10. **Vice Coast Finale** — hit Coral Bank one last time at 5 stars and escape to the Sunset Pier in 180 seconds ($2500)

Finish all ten ($9,650 total) and Vice Coast is yours.

### Features

- Open city on foot and by car: traffic, wandering pedestrians, parked and moving cars to steal, beach and pier, parks, day-sunset palette — now in four districts with their own colours and a name banner when you cross into one
- Round 7 presentation: a chase camera that sweeps its boom and pulls in before it ever clips a building wall; human pedestrians with thigh-calf-shoe legs, counter-swinging arms and a 4-steps-a-second walk cycle; real PCF soft shadows from a sun whose shadow camera follows the player, plus headlight cones at night and a helicopter searchlight; procedural building facades (brick, glass, concrete, neon) with window grids, signage bands and rooftop AC units, water towers and antennas — no two neighbours alike
- Day/night + weather: a clock that cycles day, sunset and night over ~4 minutes of play, with streetlight glow, headlight cones and glowing neon signs at night, plus occasional rain that slicks the roads and throws up spray
- Rival gang: the Vipers hold three turf districts; their purple-and-gold cars patrol the turf and do drive-bys while the heat is low — torching one pays cash and +5 respect
- Shop: Sunset Arms & Paint by the Neon Hotel — press E nearby to buy body armor ($200), ammo ($100) or a paint job ($150, cycles 6 colours for your car, plus gold paint at Kingpin rank)
- In-game phone: press P for side jobs — Courier ($80, 150s delivery), Vigilante ($120, take out 2 wanted cars in 120s), Racer ($150, 3 checkpoints in 150s), Repo ($200, steal the marked car and deliver it in 180s)
- Save / continue: progress autosaves every 30 seconds, on pause and on mission completion; pick Continue on the title screen to resume at the next mission, weapons and rank included
- Mobile touch controls: a virtual joystick on the left and GAS / BRAKE / BOOST / DRIFT / USE / SHOOT / RADIO / PHONE buttons on the right; drag the left half of the screen to look around, X resets the camera; portrait and landscape both work with the game still running on rotation
- Driving with acceleration, braking, steering, crash damage and a speedometer
- Wanted system (0–5 stars) that rises on stealing, hitting pedestrians, shooting and cop-killing, and decays when you stay hidden; police cars and foot cops chase, ram and arrest you — and at 4–5 stars a **VCPD helicopter** circles overhead with a spotlight and a rotor thump, tracked on the minimap
- Hidden packages: 10 golden parcels tucked beside landmarks across the city, each worth $50 and +2 respect, tracked as PACKAGES n/10 in the HUD
- Taxi fares: a side activity — a waving pedestrian flags you down, you drive them to one of 9 intersections across the city in 150 seconds for $40–$80 and +2 respect
- In-car radio: five stations (VICE FM, CORAL 88, NIGHT TIDE, PALM 101, SUNSET 99), each a 16-step bass + lead synth sequencer generated live with WebAudio — Q changes station
- Effects: tyre skid marks at speed, floating +$n text, muzzle flash and camera shake, explosion fireballs when a run ends wasted, speed lines at top speed, and rain splashes on wet roads
- Combat: shoot (mouse / J) or punch when out of ammo, health and ammo pickups, cash, repair and health pickups scattered around the city; armor from the shop absorbs damage first
- HUD with money, respect, health, armor, wanted stars, a live minimap (player, cops, gang cars, mission marker, shop, north), mission objective banner, off-screen mission arrow, timers, a clock and the weather
- Title screen, mission briefings, pause, game over (Wasted / Busted) and win screens; best money and missions completed saved to localStorage
- WebAudio sound: engine hum, police siren, helicopter rotor, gunshots, pickups, mission jingles, night crickets and gang drive-bys — M to mute

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive / steer in a car |
| Shift | Sprint |
| Space | Enter / exit the nearest car (stealing one raises your wanted level) |
| Mouse click / J | Shoot toward the mouse |
| E | Open the shop when standing by Sunset Arms & Paint |
| P | Open the phone (side jobs) / pause |
| Esc | Pause |
| Q | Change radio station |
| M | Mute |
| C | Continue a saved run (title screen) |
| 1 / 2 / 3 | Buy in the shop / start a phone job |
| R | Restart after game over / win |

On touch devices: left stick to move, GAS / BRAKE to drive, ENTER / SHOOT / RADIO / PHONE buttons on the right.

## Screenshots

Staged by an autopilot playing the real game rules forward from a fresh world (`game/src/shots.js`, `?shot=chase|play|heist|end&seed=23`, manifest in `shots.json`) — the chase is the cover, so the first thing a judge sees is gameplay, not the title screen:

1. `1-chase.jpg` — a 5-star police chase down the beach boulevard at sunset, helicopter overhead
2. `2-play.jpg` — the Package Run drive through Palm Row in daylight, 2 stars
3. `3-heist.jpg` — the Neon Reign gang turf shootout at sunset in Neon Downtown, on foot
4. `4-end.jpg` — the Vice Coast Finale win screen at the Sunset Pier at sunset

## Tech

Three.js r160 via a CDN import map (no vendored library), vanilla ES modules, no build step. Round 7 reworks the presentation: `game/src/camera.js` (chase-camera collision), `game/src/pedrig.js` (human pedestrian rigs), `game/src/shadows.js` (PCFSoft shadow rig + headlights), `game/src/facades.js` (procedural facades + rooftop kit), plus a reworked `serve.ts` (game + screenshots, `/shots` manifest endpoint, ETags, HEAD, `--host`) and a richer `shots.json` manifest (seed 23, wanted level, time of day, staging notes, hero flag). `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.
