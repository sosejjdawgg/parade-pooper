# Angela Rayner's Vape Canoe

A portrait, one-thumb endless runner that turns into a bullet-heaven. Political satire / parody — not affiliated with anyone.

Steer the canoe down a procedurally generated canal, collect spinning vapes, level up, and grow a weak puff of vapour into screen-filling weather that melts hordes of swans, paparazzi and piranhas.

## Play / run

No build step and no dependencies — it is plain ES modules and a canvas.

```
npx serve .        # or: python3 -m http.server
```

Open the URL on a phone (or a desktop browser: arrow keys / A-D steer, 1-3 pick upgrades, P pauses).
To host it, publish the repo root on any static host (GitHub Pages, Netlify, Cloudflare Pages).
For link previews on social media, change `og:image` in `index.html` to the absolute URL of `og.png` once you know the domain.

## Layout

| File | What |
| --- | --- |
| `src/config.js` | **Every balance number**: speeds, XP curve, spawn rates, weapons, shop prices, biomes |
| `src/game.js` | Simulation: canal shape, chunk generator, pickups, enemies, weapons, level-ups, autoplay bot |
| `src/render.js` | World + HUD drawing (black, white and ginger only) |
| `src/main.js` | Main loop and menu screens (title, level-up, game over, shop, settings) |
| `src/gfx.js` | Canvas scaling, 3x5 pixel font, procedurally built sprites |
| `src/platform.js` | Save data (localStorage), synthesised sound, touch / keyboard / tilt input |
| `tools/` | Headless Playwright scripts: `balance.cjs` (invulnerable bot logs the power curve), `screens.cjs` (screenshots, `og.png`, `icon.png`), `shots.cjs` (smoke test) |

Debug URL flags: `?bot=1` autoplay, `&god=1` no death, `&fast=8` time multiplier.

## Design notes

- Logical resolution is 360 wide; height stretches from 640 up to 800 so tall phones get more river rather than black bars.
- Canoe sits 68% down the screen; the world scrolls toward it. Tap left/right for a sharp nudge, hold to keep nudging, optional tilt.
- Three biomes blend by distance: British canal (0 m), desert (650 m), jungle (1700 m).
- Hearts absorb enemies, debris, sandbars and vortex cores. Barges, bridge piers and lock gates sink you outright.
- Weapons: Vape Cloud, Slipstream (trail), Fog Bank (area blast), Vape Storm (orbiters). Each evolves at max level if you hold its partner passive.
- Cash is banked on death and spent in the shop; the Vape Engine (speed burst per vape) is the first unlock.

## Music

- `music/ufo.mp3` ("Riding a UFO") plays for levels 1-5, `music/arab.mp3` ("Arabian Dancer") from level 6, with a crossfade.
  Both were supplied by the project owner as royalty-free chiptune tracks; check the original licence / attribution terms before publishing.
- The files are trimmed (leading silence and fade-outs removed) and loop at sample-matched points set in `MUSIC.TRACKS` in `src/config.js`.
- The main-menu tune is synthesised live in `src/music.js` (no audio file).
- Music is low-passed ("muffled") whenever a menu, the shop, pause or the level-up screen is showing.
