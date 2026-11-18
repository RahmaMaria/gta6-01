# Neon Harbor — Meridian Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/RahmaMaria/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/RahmaMaria/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — an original 2D top-down open-world crime game.

## The game

You are a kid with no wheels in Meridian Bay, a neon harbour city. Five jobs
for Rook's crew stand between you and owning the bay:

1. **First Wheels** — get in a car (E beside one; parked cars are free, traffic
   cars are grand theft auto and the law notices).
2. **The Pickup** — drive to Pier 9 and collect the package.
3. **Getaway** — the whole precinct is coming; lose them, then reach the
   safehouse.
4. **The Exchange** — clear Rook's rivals on foot, pistol out, then make the
   drop.
5. **Harbor King** — reach the yacht at the pier through a three-star chase.

The city lives around you: traffic follows the road grid, pedestrians stroll
the sidewalks and scatter from speeding cars, police spawn to your wanted
level (0–5 stars) and ram, and the heat cools only when you go quiet. HUD
shows health, cash, wanted stars, the job objective and a live minimap.
Progress saves in the browser; the best cash is kept between visits. Sound is
synthesised WebAudio — bass line, engine hum, sirens, shots — with M to mute.

## Controls

- **WASD / arrows** — walk and drive (up = throttle, down = brake/reverse)
- **E** — enter / exit a car
- **Mouse** — aim on foot · **Click** — shoot
- **P** — pause · **M** — mute · **R** — run it back after busted / victory

## Play

Serve `game/` locally (`node serve.ts`, then http://localhost:8080) or open
`game/index.html` through any static server. No network requests, no
libraries: ES modules under `game/src/`, canvas 2D, desktop Chrome.

## Files

- `game/src/config.js` — tuning and palette
- `game/src/city.js` — the road grid, buildings, parks, harbour, markers
- `game/src/engine.js` — rules and state: player, cars, peds, thugs, wanted, missions
- `game/src/player.js` — on foot and driving, stealing, shooting
- `game/src/vehicles.js` — traffic AI, police chase, car physics
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/wanted.js` — 0–5 stars, heat and decay
- `game/src/missions.js` — the five-job story chain
- `game/src/render.js` — canvas drawing, camera
- `game/src/hud.js` — HUD, minimap, screens
- `game/src/audio.js` — synthesised SFX and music
- `game/src/save.js` — localStorage save / best cash
- `game/src/shots.js` — staged screenshot scenes (`?shot=start|play|chase|end`)
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` and writes `dossier.json`
