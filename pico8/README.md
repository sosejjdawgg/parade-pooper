# Angela Rayner's: Vape Kayak — handheld edition (PICO-8 cart)

`vape-kayak.p8` is a PICO-8 cartridge built for R36S / RS36 Pro style handhelds (RK3326, 640×480, ArkOS and similar).
It runs at a native 60 fps (`_update60`) at PICO-8's 128×128 resolution, which scales cleanly to the 640×480 screen.

A free, non-commercial parody. Not affiliated with anyone.

## Install on the handheld (ArkOS)

1. Copy `vape-kayak.p8` to the SD card's PICO-8 ROM folder: `EASYROMS/pico-8/` (on some builds `roms/pico-8/`).
2. In EmulationStation, refresh the game list (Start → Game Settings → Update gamelists) or restart.
3. Open **PICO-8** and start *vape-kayak*.

ArkOS plays PICO-8 carts with either:

- **Fake-08** (the RetroArch core that ships with ArkOS). Nothing extra needed.
- **Official PICO-8**, if you own it and copied the Raspberry Pi build into the same folder. The cart is under the 8,192-token limit (about 8,080 by our count), so official PICO-8 should load it too.

If both are installed, use the game's options in EmulationStation to choose which emulator runs it.

## Controls

| Handheld | In game |
| --- | --- |
| D-pad left / right | Paddle left / right (hold to keep paddling, let go to glide) |
| Left stick | Same as the d-pad, once RetroArch maps it (see below) |
| D-pad up / down | Move through menus, level-up cards and the shop |
| A or B | Select, buy, take an upgrade (either face button works everywhere) |
| Start | PICO-8 pause menu: continue, **quit to title**, reset |

**Analog stick:** PICO-8 only reads digital directions. With Fake-08, enable the stick once in RetroArch: open the RetroArch menu (usually Select + X), then **Settings → Input → Port 1 Controls → Analog to Digital Type → Left Analog**. Save with **Overrides → Save Core Overrides**.

Progress (cash, shop upgrades, best run) is saved by PICO-8's `cartdata` on the SD card.

## What changed from the browser version

The handheld cart keeps the same game, rebuilt for a 128×128 screen, physical buttons and the cart's size limit:

- **Steering:** hold-to-paddle with momentum instead of tap nudges, which suits a d-pad. Menus are d-pad lists; any face button selects.
- **Everything else from the browser version:** three biomes with their own music, spinning vapes, level-ups with 3 choices, all four cloud weapons plus Vape Rings, +1 Cloud and the four evolutions. Also the enemies with red outlines, tea, cash, the shop (Vape Engine, five-level Engine Tuning, Thick Skin, Political Immunity and the rest), boost ramming, red banks in the late game, the face portrait in a bottom status bar, and the satire.
- **Music:** original chiptunes written for the cart: an A-minor theme on the canal and title, a phrygian "desert" theme, and a faster jungle version. The browser version's MP3s aren't used: a PICO-8 cart can only hold its own tracker music.
- **Cut for space:** lock gates, the heat-haze mirage barges and the side-art border. The How-to-Play screen is a single page.

## Development

The cart is generated; edit the sources, not the `.p8`:

- `pico8/vape_kayak.lua` — the game code, written in plain Lua so the test harness can run it. All balance values are at the top.
- `tools/p8/build.py` — adds the sprites, sound effects and music, converts simple `x=x+1` lines to PICO-8's `x+=1` (fewer tokens) and writes `pico8/vape-kayak.p8`. Run `python3 tools/p8/build.py pico8/label.hex`.
- `tools/p8/tokens.py` — estimates the token count (limit 8,192).
- `tools/p8/harness.lua` — a headless stand-in for the PICO-8 API that runs the cart with a bot. `shots` dumps screens (convert with `tools/p8/topng.py`); `soak:<seconds>` plays an invulnerable run and reports Lua work per frame. Needs `lua5.2`.
