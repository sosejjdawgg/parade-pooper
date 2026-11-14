# Angela Rayner's: Vape Kayak

A portrait, one-thumb endless runner that turns into a bullet-heaven. Political satire / parody — not affiliated with anyone.

Steer the kayak down a procedurally generated canal, collect spinning vapes, level up, and grow a weak puff of vapour into screen-filling weather that melts hordes of swans, paparazzi and piranhas.

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
| `marketing/` | itch.io kit: page copy (`itch-page.md`), cover / banner / social images, screenshots, upload zip. Regenerate images with `node tools/marketing.cjs` |
| `tools/` | Headless Playwright scripts: `balance.cjs` (invulnerable bot logs the power curve), `screens.cjs` (screenshots, `og.png`, `icon.png`), `shots.cjs` (smoke test) |

Debug URL flags: `?bot=1` autoplay, `&god=1` no death, `&fast=8` time multiplier.

## Design notes

- Logical resolution is 360 wide; height stretches from 640 up to 800 so tall phones get more river rather than black bars.
- Kayak sits 68% down the screen; the world scrolls toward it. Tap left/right for a sharp nudge, hold to keep nudging, optional tilt.
- Three biomes blend by distance: British canal (0 m), desert (650 m), jungle (1700 m).
- Hearts absorb enemies, debris, sandbars and vortex cores. Barges, bridge piers and lock gates sink you outright.
- Weapons: Vape Cloud, Vapetrail (trail), Fog Bank (area blast), Vape Storm (orbiters). Each evolves at max level if you hold its partner passive.
- Cash is banked on death and spent in the shop; the Vape Engine (speed burst per vape) is the first unlock.

## Legal

Free, non-commercial parody: no sales, ads or donations, no data collected. Full wording in `LEGAL.md` (also in-game under Settings > About and Legal).
`node tools/bundle.cjs --itch` builds the public zip, which excludes `music/river.mp3`.

## Music

- `music/river.mp3` plays once, starting on the main menu and carrying on into the run. It is an 8-bit cover of a commercial song
  ("River", 8 Bit Universe tribute) supplied by the project owner. **It is not royalty-free: clear the rights or swap it out before publishing.**
- When it finishes, the biome tracks take over: `music/ufo.mp3` ("Riding a UFO") on the British canal and in the jungle,
  `music/arab.mp3` ("Arabian Dancer") in the desert, crossfading when the scenery changes. Both are by harayu, CC-BY 3.0: the credit lines in `LEGAL.md` must stay wherever the game is published.
- The files are trimmed (leading silence and fade-outs removed) and loop at sample-matched points set in `MUSIC.TRACKS` in `src/config.js`.
- The main-menu tune is synthesised live in `src/music.js` (no audio file).
- Music is low-passed ("muffled") whenever a menu, the shop, pause or the level-up screen is showing.
