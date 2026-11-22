# Vice Coast — a GTA 6 style open world (make.fun gta6-01)

A low-poly 3D open-world crime game in Three.js, third-person, built for
the make.fun bounty "Make GTA 6". You play a driver fresh off the Sunset
Pier, working ten story missions across a coastal city at golden hour —
and running from the police while you do it.

## The city

11400 by 6600 units of coast: a beach and boardwalk on the west edge with
the sunset over the ocean, 405 buildings in 8 types, 17 vertical and 13
horizontal roads, four districts (Beach, Neon Downtown, Coral Docks,
Suburbs), 125 name signs, 39 parks, and landmarks — Sunset Pier, Neon
Hotel, Coral Docks, Pixel Arcade, the Hideout, Coral Bank. A full day is
240 seconds: day, then sunset, then night, then a new morning.

## The game

- Drive: 34 traffic cars and 14 parked cars, nitro, handbrake drifts,
  near-miss cash, a street race at the pier.
- On foot: a human walk — thigh, calf and shoe, knee bend, arms swinging
  opposite the legs, about four steps a second — plus over-shoulder aim,
  a crosshair and hit markers.
- Wanted: foot cops, cop cars that ram and set roadblocks, and a police
  helicopter with a searchlight from four stars up. Hide for 14 seconds
  to lose a star.
- Crew: Mira talks a star away, Dex refills the nitro, Luna marks the
  target. Respect ranks unlock the SMG and the shotgun.
- Side work: taxi fares, phone jobs (courier, food, dispatch, repo),
  ten hidden packages, the Sunset Arms & Paint shop, save and continue.

## Missions

1. Sunset Taxi — $150 · 2. Package Run — $250 · 3. Getaway — $350 ·
4. Lose the Heat — $400 · 5. The Sunset Heist — $800 · 6. Vice Nights —
$1000 · 7. Sunset Showdown — $1200 · 8. Harbor Lights — $1400 ·
9. Neon Reign — $1600 · 10. Vice Coast Finale — $2500. The story chain
pays $9,650; the win screen shows the real total you earned, including
side jobs.

## Controls

- WASD / arrows — drive and walk, Shift — nitro / sprint, Space —
  handbrake (in the car) / briefing (on the title screen)
- F — enter / exit car, J or click — shoot, E — shop, Q — radio,
  P — phone, 1–3 — crew abilities, R — restart, C — continue (title)
- Touch: left joystick to move, DRIVE / BRAKE / FIRE / ENTER / NITRO /
  PHONE buttons. The game keeps running when an Android phone rotates.

## Running it

```sh
node serve.ts --port 8000
```

Then open http://127.0.0.1:8000/. Three.js r160 loads from the unpkg
CDN through an import map; nothing is vendored into the repo.

## Screenshots

Staged deterministically with seed 31 (`?shot=chase|play|heist|end`):
the hero sunset chase at five stars, a daytime drive, the Neon Reign
turf war, and the finale win screen.
