# PICO-8 edition — launch kit

Everything for announcing the handheld / PICO-8 version of **Angela Rayner's: Vape Kayak**.
All images and GIFs in this folder are drawn in the PICO-8 palette; the GIFs are real footage from the cart.

## The files

| File | Use it for |
| --- | --- |
| `trailer.gif` (384×384, ~18 s) | The main post on Reddit, Lexaloffle forum, X / Bluesky, itch.io |
| `gameplay-canal.gif`, `gameplay-jungle-horde.gif` (512×512) | "Early game vs late game" pairs, replies, devlogs |
| `screenshot-*.png` (768×768) | itch.io screenshots, store galleries |
| `social-1200x630.png` | Link previews, X / Facebook / Bluesky cards |
| `square-1024.png` | Instagram, Mastodon, Discord |
| `itch-cover-630x500.png` | Cover image for a PICO-8 / handheld itch.io page |
| `handheld-mockup.png`, `handheld-mockup-title.png` | "It runs on your handheld" posts (generic, unbranded device) |
| `cart-label.png` | The cartridge label (already built into `pico8/vape-kayak.p8`) |
| `boxart-512.png` + `gamelist-snippet.xml` | Box art in EmulationStation / ArkOS (instructions inside the XML file) |

## One-liners

- **Tagline:** Paddle. Vape. Melt the horde. Now in 128×128.
- **Short:** A one-thumb endless runner that turns into a bullet heaven, squeezed into a PICO-8 cart for your retro handheld.
- **Hook for handheld communities:** Drop one `.p8` file in your `pico-8` folder. Built for 60 fps on R36S-class handhelds through Fake-08. No BIOS, no setup.

## Lexaloffle BBS (PICO-8 forum, "Cartridges" section)

The forum takes carts as `.p8.png`. In PICO-8: `load vape-kayak.p8`, then `save vape-kayak.p8.png`, and upload that. Check the forum's rules on parodies of real people before posting.

**Title:** Angela Rayner's: Vape Kayak

**Post:**

> A political-satire endless runner that turns into a bullet heaven.
>
> You paddle a kayak down a procedurally generated canal, hoovering up spinning vapes. Every vape is XP; every level is a choice of three upgrades. Your little puff of vapour grows into clouds in eight directions, a toxic trail, orbiting storm clouds and blasts that clear the screen. By the volcano, the swans and paparazzi are the ones running.
>
> - Three biomes, each with its own chiptune and bank colours: British canal, desert, volcano
> - 4 weapons plus Vape Rings, 6 passives, 4 evolutions
> - Cash shop between runs: Vape Engine, Political Immunity and more
> - Boost-ram enemies with the bow of the kayak
> - A Doom-style face in the status bar that gets more dishevelled as you get hurt
>
> **Controls:** ⬅️➡️ paddle (hold to keep paddling), ⬆️⬇️ menus, 🅾️/❎ select.
>
> A free, non-commercial parody. Not affiliated with anyone. No kayaks were harmed.

**Tags:** `endless runner`, `bullet heaven`, `survivors`, `satire`, `roguelite`

## Reddit

**r/pico8** — flair *Game*

> **Title:** I squeezed a Vampire Survivors-style kayak game into a PICO-8 cart (satire)
>
> [trailer.gif]
>
> It starts as a simple runner: dodge barges and low bridges, collect vapes. Then the auto-firing clouds level up until you're melting hordes by the volcano. Built for 60 fps on cheap retro handhelds too. Happy to talk about fitting a survivors-like into 8,192 tokens: the weapon stats all live in `split()` strings.

**r/SBCGaming, r/R36S, r/RetroHandhelds**

> **Title:** Made a free game that runs natively on the R36S: just drop the .p8 in your pico-8 folder
>
> [handheld-mockup.png or trailer.gif]
>
> One-thumb endless runner that turns into a bullet heaven, built for 60 fps through Fake-08 on ArkOS. Box art and a gamelist entry are included if you want it to look tidy in EmulationStation. Tip: in RetroArch set *Analog to Digital Type → Left Analog* to steer with the stick. Free, non-commercial parody.

Read each subreddit's self-promotion rules first; most want you to take part in the community, not just post links.

## Short social posts

- **X / Bluesky / Threads:** Vape Kayak is now a PICO-8 cart. 128 pixels, 60 fps, one thumb, runs on a cheap retro handheld. Paddle. Vape. Melt the horde. [link] #pico8 #pixelart #indiegame
- **Mastodon (#pico8 is very active there):** Ported my satire bullet-heaven to PICO-8 so it runs on retro handhelds. The whole thing is one .p8 file; all weapon stats are in split() strings to fit the token limit. [trailer.gif] #pico8 #gamedev #indiedev
- **Devlog title ideas:** "Fitting a survivors-like into 8,192 tokens" · "Testing a PICO-8 cart without PICO-8: a headless harness and a bot that cannot die"

## On the itch.io page

Add the cart as a download on the existing page (or a separate "PICO-8 edition" page):

1. Upload `pico8/vape-kayak.p8`, tick **Linux** / **Other**, and name the file "PICO-8 cart (retro handhelds, PICO-8, Fake-08)".
2. Add `trailer.gif` to the screenshots (itch plays GIFs inline) and `itch-cover-630x500.png` as the cover if it's a separate page.
3. Paste the install steps from `pico8/README.md` (copy to the `pico-8` folder; the analog stick tip).

A playable browser build of the PICO-8 version needs official PICO-8's `export vape-kayak.html`; the existing HTML5 game already covers the browser.

## Credits and small print

- Same terms as the main game: free and non-commercial, no ads, no donations. See `LEGAL.md`.
- The PICO-8 cart's music is original to the cart. It does not use harayu's tracks or the River cover, so it carries no music credits or licence conditions.
