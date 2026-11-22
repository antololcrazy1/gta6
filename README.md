# Vice Coast — Make GTA 6 entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/antololcrazy1/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/antololcrazy1/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Coast** is my entry for the [Make GTA 6](https://make.fun/bounty/gta6-01)
bounty on make.fun — a low-poly 3D open-world crime game built with Three.js,
played in third person.

## The city

The game takes place in Vice Coast, a golden-hour coastal city that measures
11400 by 6600 units. A beach and boardwalk run along the west edge, where the
sun sets over the ocean, and the city behind it holds 405 buildings in 8 types
— houses, shophouses, offices, towers, restaurants, hotels, warehouses, and
gas stations — spread across 4 districts. A full day/night cycle lasts 240
seconds, so the light keeps shifting from sunset gold to night neon and back
while you play. Traffic fills the roads and pedestrians walk the sidewalks, so
the streets feel alive around you.

## Story — 10 missions

You arrive in Vice Coast as a nobody and work your way up through ten story
missions: courier runs and getaway drives, turf fights against the rival Viper
gang, three heists, and a finale that settles who runs the coast. Each mission
pays cash, and finishing the story unlocks a street race at the pier.

## Driving

- Steal any car on the street and drive it — traffic, parked cars, and police
  all share the road.
- Nitro boost for extra speed, a handbrake for drifting around corners, and
  cash for near misses with traffic.
- Drifting builds a score multiplier, and a clean slide pays out when it ends.
- A street race at the pier pits you against three rivals once the story is
  done.

## On foot

- A human character with a real walk and run animation — no sliding mannequin.
- Over-shoulder aim with hit markers, and weapons that unlock as your respect
  rank grows: the SMG at Wheelman, the shotgun at Fixer.
- Enter and exit cars, pick up hidden packages, and take phone side jobs
  between missions.

## Wanted

- Wanted stars rise as you commit crimes. Foot cops give chase and try to
  arrest you, cop cars ram you off the road, and roadblocks appear at higher
  stars.
- From 4 stars, a police helicopter joins the hunt with a searchlight sweeping
  the streets.
- Lose the heat by breaking line of sight, or call in a crew member: Mira
  swaps your plates to drop a star, Lio repairs your car, and Kiki marks foot
  cops on the minimap.

## Crew and respect

- Three crew members with abilities on cooldowns, triggered from the keyboard
  or tapped on screen.
- Respect ranks — Dock Hand, Wheelman, Fixer, Shot Caller, Kingpin — unlock
  weapons, a gold paint job, and new jobs as you earn respect.

## Phone, shops, and saves

- The in-game phone offers side jobs: courier runs, taxi fares, a repo job,
  and a street race.
- Shops sell weapons and car paint. Progress autosaves, and you can continue
  where you left off.

## How to play

Serve the `game/` folder with any static server, for example:

```sh
node serve.ts
```

Then open `game/index.html` in a browser. Three.js r160 loads from the CDN
through an import map, so no build step is needed.

### Controls

- **WASD / arrows** — walk or drive
- **Mouse** — aim (click to shoot on foot)
- **F** — enter or exit a car
- **Shift** — sprint on foot, nitro in a car
- **Space** — handbrake while driving
- **V** — switch weapon
- **1 / 2 / 3** — crew abilities
- **E** — shop, **P** — phone

Touch controls are built in: a joystick for movement, camera swipe on the left
half of the screen, and on-screen buttons for driving, shooting, and abilities.
Rotate your phone sideways for the best view.

## License

MIT — see `LICENSE`.
