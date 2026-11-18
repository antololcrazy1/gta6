# Vice Coast — Make GTA 6 entry

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/antololcrazy1/gta6/rank.svg)
![reward](https://make.fun/badge/gta6-01/antololcrazy1/gta6/reward.svg)

An original open-world crime game built for the [make.fun](https://make.fun) bounty **[gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01)** — a sun-soaked coastal city to explore on foot and by car, in the spirit of GTA 6, with none of Rockstar's names, characters, map, art or music. Everything here — the city, the characters, the story, the art and the sounds — is original.

## Play it

Serve the `game/` folder with any static server, then open `game/index.html` in desktop Chrome. No build step, no network request — every script, image, sound and font is a file under `game/` or generated in code.

```sh
node serve.ts   # then open http://localhost:8080
```

## The game

You are a newcomer in **Vice Coast**, a coastal city of neon hotels, a wooden pier, parks, docks and a coral bank. Explore the 3600×2600 city, steal cars, dodge the Vice Coast PD, and run a 7-mission story chain:

1. **Sunset Taxi** — pick up Maya at the pier, drop her at the Neon Hotel ($150)
2. **Package Run** — collect 3 packages around Palm Row and deliver them to the docks ($250)
3. **Getaway** — grab the bag from the arcade and reach the hideout in 75 seconds ($350)
4. **Lose the Heat** — break line of sight at 3 wanted stars until the heat dies down ($400)
5. **The Sunset Heist** — hit the Coral Bank vault and escape to the hideout ($800)
6. **Vice Nights** — one last job after dark: collect 4 night drops across the city at 4 stars, the helicopter already overhead, then bring them home ($1000)
7. **Sunset Showdown** — the Feds are onto you: reach the Sunset Pier in 75 seconds with 5 stars on you ($1200)

Finish all seven and Vice Coast is yours.

### Features

- Open city on foot and by car: traffic, wandering pedestrians, parked and moving cars to steal, beach and pier, parks, day-sunset palette
- Driving with acceleration, braking, steering, crash damage and a speedometer
- Wanted system (0–5 stars) that rises on stealing, hitting pedestrians, shooting and cop-killing, and decays when you stay hidden; police cars and foot cops chase, ram and arrest you — and at 4–5 stars a **VCPD helicopter** circles overhead with a spotlight and a rotor thump, tracked on the minimap
- Hidden packages: 10 golden parcels tucked beside landmarks across the city, each worth $50 and +2 respect, tracked as PACKAGES n/10 in the HUD
- Taxi fares: pedestrians wave for a cab — stop beside one in a car, follow the gold ring to their destination in 45 seconds, and earn $40–$80 plus respect
- Combat: shoot (mouse / J) or punch when out of ammo, health and ammo pickups, cash, repair and health pickups scattered around the city
- HUD with money, respect, health, wanted stars, a live minimap (player, cops, heli, mission marker, north), mission objective banner, off-screen mission arrow and timers
- Title screen, mission briefings, pause, game over (Wasted / Busted) and win screens; best money and missions completed saved to localStorage
- WebAudio sound: engine hum, police siren, helicopter rotor, gunshots, pickups, mission jingles — M to mute. In-car radio (Q to change station): VICE FM, CORAL 88, NIGHT TIDE and PALM 101, a chiptune sequencer that plays while you drive
- Feel: screen shake on shots and hits, tyre skid marks on hard cornering, muzzle flashes and floating +$ text on pickups and payouts, speed lines at top speed, and a fireball explosion when a run ends wasted

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive / steer in a car |
| Shift | Sprint |
| Space | Enter / exit the nearest car (stealing one raises your wanted level) |
| Mouse click / J | Shoot toward the mouse |
| E | Interact |
| P / Esc | Pause |
| M | Mute |
| Q | Change radio station |
| R | Restart after game over / win |

## Screenshots

Staged by an autopilot playing the real game rules forward from a fresh world (`game/src/shots.js`, `?shot=chase|play|heist|end&seed=7`) — the chase is the cover, so the first thing a judge sees is gameplay, not the title screen:

1. `1-chase.jpg` — a 3-star police chase through traffic
2. `2-play.jpg` — driving the Sunset Taxi mission through traffic
3. `3-heist.jpg` — the Sunset Heist shootout on foot outside Coral Bank
4. `4-end.jpg` — the Sunset Heist win screen

## Tech

Vanilla 2D canvas + ES modules, no libraries, no build step. `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`.
