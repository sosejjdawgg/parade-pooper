# Meadow Well — animatic

`index.html` is a self-contained, ~106-second canvas animatic of the screenplay in `SCREENPLAY.md`, drawn on a fixed
**1080×1920 (9:16) portrait stage** for TikTok. Open it in a browser. There's nothing to build.

- **Style:** anime-inspired impact frames (white flash, then an inverted red/black frame with radial burst lines and a shockwave ring), speed lines, smoke clouds lit by the fire below them, embers and screen shake.
- **Transitions:** fast snap-cut montages of extreme close-ups, punched in with whooshes and broken up by single white frames, then a whip pan out:
  - Title → Prologue: ignition key, cigarette lighter, gear stick, foot down
  - Prologue → Chapter One: spinning newspaper, spray can, match, petrol-bomb rag
  - Riot → West End and Regeneration → Wall: whip pans
  - Chapter One → Chapter Two: "APPROVED" stamp, hard hat, CCTV lens
  - Chapter Two → Epilogue: calendar flicking from 1991 to 2026, lit fuse
- **Controls:** click or Space to play and pause, ←/→ to skip 5 s, chapter buttons, a scrub bar, and an optional synthesised sound toggle.

## Exporting the MP4

```
node export.js meadow-well.mp4 30
```

This needs Node, Playwright (with Chromium) and ffmpeg. It loads `index.html?export` and steps the animation one
frame at a time instead of playing it live, so dropped frames are impossible and every render comes out identical
(randomness is seeded). The output is H.264, 1080×1920, 30 fps, yuv420p with faststart, which is ready to upload. A full
render takes several minutes.

Captions sit inside TikTok's safe zones: scene headings start about 10% from the top, and dialogue ends about 26% above
the bottom, clear of TikTok's own caption and button overlays.
