# Neon Harbor — Meridian Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/RahmaMaria/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/RahmaMaria/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game, built from scratch for the
make.fun **gta6-01** bounty. No Rockstar names, characters, map or assets —
this is our own city, our own story, our own art and sound.

## The city

**Meridian Bay** is a sun-soaked road-grid harbour city: nine districts
(Coral Row, Vela Point, Kite District, Anchor Quarter, Meridian Docks,
Palma Heights, Gull Market, Beacon Hill, Saltworks) joined by named
streets, with a bay along the south and east edges, palm-lined sidewalks,
neon-signed rooftops and a dusk-lit palette. The whole map is generated
from a seeded RNG (seed 7 by default), so the same seed always rebuilds
the same city.

## Playing

You are **Mara Voss**, a courier driver who owes the wrong people money.
Work it off across a five-mission story chain:

1. **First Delivery** — run a package to Gull Market for Sal the Dispatcher.
2. **Hot Wheels** — steal the coral sportscar in Vela Point and deliver it
   to the Anchor Quarter garage.
3. **The Collector** — collect from three shops for Madame Okafor while the
   patrol watches.
4. **Dockside Run** — reach the Meridian Docks before the tide, in 90 seconds,
   with two stars of heat already on you.
5. **The Harbor Job** — lift the vault cash on Beacon Hill, lose four stars
   of heat, and reach the Palma Heights safehouse. Clear the debt.

## Systems

- **On foot and by car** — walk, sprint, punch, shoot, and steal any car
  on the street (drivers bail and run; parked cars are free).
- **Traffic and pedestrians** — 26 traffic cars follow the roads and turn
  at intersections, 30 parked cars, 42 pedestrians who stroll the
  sidewalks, wait for fast cars, and scatter when shots ring out.
- **Wanted level 0–5** — crimes draw heat; Meridian Bay police (MBPD) spawn
  on the roads, chase, ram, and try to bust Mara on foot. Lay low out of
  sight and the heat cools off.
- **Combat** — punch up close, shoot with a real raycast, blow cars out.
- **HUD with minimap** — cash, district, wanted stars, health/armor,
  speedometer, mission objective with distance, live minimap (roads,
  mission marker, cops, player arrow), and a message feed.
- **Start screen, death ("WASTED"), bust, pause, and story-complete
  ("DEBT PAID") screens**, with best cash saved in localStorage.
- **Synthesised sound** — WebAudio engine hum, two-tone sirens, gunshots,
  payout chimes and a bassline loop. No audio files; the context is
  created on the first key press and everything is guarded, so headless
  runs never crash.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive |
| E | Enter / steal car, step out |
| F / left click | Punch |
| Space | Shoot (on foot), handbrake (in car) |
| Shift | Sprint |
| P / Esc | Pause |
| R | Retry a failed mission / get back up |
| M | Mute |

## Screenshots

The four screenshots in `screenshots/` are real renders of the game
running headlessly in Chromium at 1280×720:

1. `1-start.jpg` — title screen over the living city.
2. `2-play.jpg` — driving in traffic, mission 1 on the HUD.
3. `3-chase.jpg` — 3-star police chase with the minimap and objective.
4. `4-end.jpg` — the story-complete screen.

They are produced with the game's own `?shot=` scenes
(`?shot=start|play|chase|end&seed=7`), each a deterministic setup of the
running game — no staging, no edits.

## Running it

No build step, no network requests, no libraries. Static files only:

```sh
cd game
python3 -m http.server 8080
# open http://localhost:8080
```

Or serve `game/` with any static file server. Node 22 is only needed for
the entry program:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library. Running it twice
produces byte-identical output.

## Layout

```
game/
  index.html            page shell
  src/
    main.js             bootstrap, loop, state machine, ?shot= scenes
    rng.js              seeded RNG (mulberry32)
    config.js           tuning constants and palette
    world.js            city generation: roads, buildings, props, bay
    player.js           on-foot movement, punch, shoot, stealing
    vehicles.js         car physics, traffic AI, collisions
    police.js           wanted stars, cop spawn and chase AI
    pedestrians.js      pedestrian AI
    missions.js         five-mission story chain
    hud.js              HUD, minimap, menus
    audio.js            WebAudio synth: engine, sirens, shots, music
    render.js           camera and Canvas 2D drawing
    input.js            keyboard and mouse
main.ts                 entry program (Node 22, stdlib only)
screenshots/            four real renders of the game
```

MIT licensed. Built from scratch in a single recorded session.
