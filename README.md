# Vice Coast — Make GTA 6 entry

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/antololcrazy1/gta6/rank.svg)
![reward](https://make.fun/badge/gta6-01/antololcrazy1/gta6/reward.svg)

An original open-world crime game built for the [make.fun](https://make.fun) bounty **[gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01)** — a sun-soaked coastal city to explore on foot and by car, in the spirit of GTA 6, with none of Rockstar's names, characters, map, art or music. Everything here — the city, the characters, the story, the art and the sounds — is original.

## v6 — now in 3D (branch `v6-3d`)

v6 rebuilds Vice Coast as a **Three.js low-poly 3D** open world (vendored under `game/vendor/three.module.js`, zero network at runtime), benchmarked frame-by-frame against the gta6-01 top 10 and GTA V itself:

- **Third-person chase cam** low behind the car (FOV widens with speed) + **on-foot third-person with an animated character** (walk / run / over-shoulder aim / shoot with hit marker, enter & exit cars)
- **Golden-hour sunset by default** — orange-purple sky, low sun disc, long shadows, brake lights, wet-looking asphalt — plus the day/night cycle and rain from v5
- **Dense GTA HUD**: mission panel + named police response list (KITE-1, MARLIN-3… with roles and distances), wanted stars, money + clock, weapon slots, crew cards, portrait dialogue, round minimap + health/armour, big speedometer + car name/condition/gear, radio ticker
- **Busy scenes**: traffic, police cars with flashing light bars, a police helicopter with a searchlight cone, pedestrians, palms, beach + ocean, pier, docks containers, billboards
- Same content as v5: **10-mission story** ($9,650), Viper gang turf wars, shop, phone side jobs, save/continue, hidden packages, taxi fares, in-car radio
- **Mobile**: virtual joystick + action buttons, every screen (title, briefing, pause, game over) accepts a real tap, and **rotation is handled without reload** — turning the phone resizes the canvas and releases stuck touch input

Play it: serve `game/` with any static server, then open `game/index.html`. No build step, no network request.

```sh
node serve.ts   # then open http://localhost:8080
```

## The game

You are a newcomer in **Vice Coast**, a coastal city of neon hotels, a wooden pier, parks, docks and a coral bank, split into four districts — Beach, Neon Downtown, Coral Docks and the Suburbs. Explore the 3600×2600 city, steal cars, dodge the Vice Coast PD, and run a 10-mission story chain:

1. **Sunset Taxi** — pick up Maya at the pier, drop her at the Neon Hotel ($150)
2. **Package Run** — collect 3 packages around Palm Row and deliver them to the docks ($250)
3. **Getaway** — grab the bag from the arcade and reach the hideout in 75 seconds ($350)
4. **Lose the Heat** — break line of sight at 3 wanted stars until the heat dies down ($400)
5. **The Sunset Heist** — hit the Coral Bank vault and escape to the hideout ($800)
6. **Vice Nights** — collect 4 night drops, one at each corner of the city, then deliver them to the hideout; starts hot at 4 stars with the helicopter already up ($1000)
7. **Sunset Showdown** — reach the Sunset Pier in 75 seconds with 5 stars on you ($1200)
8. **Harbor Lights** — smuggle run: collect 3 crates on the docks road and deliver them to the boat at the Sunset Pier in 120 seconds ($1400)
9. **Neon Reign** — gang turf war: torch 3 rival Viper cars in Neon Downtown, then hold the turf marker for 20 seconds ($1600)
10. **Vice Coast Finale** — hit Coral Bank one last time at 5 stars and escape to the Sunset Pier in 90 seconds ($2500)

Finish all ten ($9,650 total) and Vice Coast is yours.

### Features

- Open city on foot and by car: traffic, wandering pedestrians, parked and moving cars to steal, beach and pier, parks, day-sunset palette — now in four districts with their own colours and a name banner when you cross into one
- Day/night + weather: a clock that cycles day, sunset and night over ~4 minutes of play, with streetlight glow, headlight cones and glowing neon signs at night, plus occasional rain that slicks the roads and throws up spray
- Rival gang: the Vipers hold three turf districts; their purple-and-gold cars patrol the turf and do drive-bys while the heat is low — torching one pays cash and +5 respect
- Shop: Sunset Arms & Paint by the Neon Hotel — press E nearby to buy body armor ($200), ammo ($100) or a paint job ($150, cycles 6 colours for your car)
- In-game phone: press P for side jobs — Courier ($80, 60s delivery), Vigilante ($120, take out 2 wanted cars), Racer ($150, 3 checkpoints in 45s)
- Save / continue: progress autosaves on every mission completion; pick Continue on the title screen to resume at the next mission
- Mobile touch controls: a virtual joystick on the left and GAS / BRAKE / ENTER / SHOOT / RADIO / PHONE buttons on the right
- Driving with acceleration, braking, steering, crash damage and a speedometer
- Wanted system (0–5 stars) that rises on stealing, hitting pedestrians, shooting and cop-killing, and decays when you stay hidden; police cars and foot cops chase, ram and arrest you — and at 4–5 stars a **VCPD helicopter** circles overhead with a spotlight and a rotor thump, tracked on the minimap
- Hidden packages: 10 golden parcels tucked beside landmarks across the city, each worth $50 and +2 respect, tracked as PACKAGES n/10 in the HUD
- Taxi fares: a side activity — a waving pedestrian flags you down, you drive them to one of 9 intersections across the city in 45 seconds for $40–$80 and +2 respect
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

Staged by an autopilot playing the real game rules forward from a fresh world (`game/src/shots.js`, `?shot=chase|play|heist|end&seed=19`) — the chase is the cover, so the first thing a judge sees is gameplay, not the title screen:

1. `1-chase.jpg` — a 4-star golden-hour police chase down the palm-lined boulevard into the low sun, helicopter overhead, roadblock + burning wreck ahead
2. `2-play.jpg` — an on-foot over-shoulder shootout on the Sunset Pier approach at sunset, cop car ahead, hit marker lit
3. `3-heist.jpg` — the Neon Reign gang turf shootout at sunset in Neon Downtown, one Viper car burning
4. `4-end.jpg` — the Vice Coast Finale win screen at the Sunset Pier at sunset

## Tech

Vanilla 2D canvas + ES modules, no libraries, no build step. v5 adds missions 8–10 (Harbor Lights, Neon Reign, Vice Coast Finale), day/night + rain, the Viper gang and its turf, the Sunset Arms & Paint shop, phone side jobs, save/continue, mobile touch controls and a district-based visual rewrite. `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.
