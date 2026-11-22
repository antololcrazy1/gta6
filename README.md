# Vice Coast — Make GTA 6 entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/antololcrazy1/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/antololcrazy1/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Coast** is my entry for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun — a 3D open-world action game set in a golden-hour coastal city, built to feel like a GTA game in the browser.

## The city

Vice Coast is a living open world, 11400×6600 units of streets, beach and boardwalk. The map holds 405 buildings in 8 types across 4 districts, plus parks, signs and traffic. A full day/night cycle runs every 240 seconds, so the city slides from golden-hour sunset into night neon and back, with rain rolling in from time to time.

## Story — 10 missions

Play through a 10-mission story that takes you from small-time wheelman to the crew's go-to driver and shooter. Missions mix driving, on-foot shootouts, escapes and turf fights, and pay out cash you can spend around the city.

## Driving

- Steal any car on the street and drive with a third-person chase camera.
- Nitro boost, handbrake drift and near-miss cash for threading traffic.
- A street race at the pier pays a bonus for the fastest run.
- Cops chase in cars, ram you off the road and set up roadblocks.

## On foot

- Step out of the car any time and walk the streets with a proper walk animation.
- Over-shoulder aim with hit markers when you shoot.
- Wanted stars climb as you cause chaos: foot cops chase you down, cop cars ram, roadblocks appear, and from 4 stars a helicopter circles overhead with a searchlight.

## Crew, respect and gear

- Recruit crew members, each with an ability that helps in a pinch.
- Earn respect ranks as you finish missions and jobs; higher ranks unlock the SMG and shotgun.
- Spend your cash in shops, take phone side jobs for extra money, and save your progress to continue later.

## How to play

```sh
node serve.ts
```

Then open `game/index.html` in your browser. The game runs on Three.js r160 loaded from a CDN import map — no build step and nothing to install.

## Controls

- **WASD** — drive / walk
- **Shift** — nitro (in a car) / run (on foot)
- **Space** — handbrake
- **E** — enter / exit car
- **Mouse** — aim, **Click** — shoot (on foot)
- **F** — toggle phone jobs

Touch controls are built in for phones: a joystick to move, buttons to drive, shoot, brake and enter cars, plus swipe on the left side of the screen to swing the camera.
