# Upgrades trailer: upload notes

**File:** `vape-kayak-upgrades-trailer.mp4` (1080×1920, 30 fps, 40 s, H.264 + AAC). It's vertical and under 60 seconds, so YouTube treats it as a Short. It also works for TikTok and Reels.
**Thumbnail:** `thumbnail.png`, the fully upgraded climax at 28.5 s.

## Titles (pick one)

- One puff vs one duck… then I upgraded 💨💥 #shorts
- Vape Rings + Mushroom Cloud = total overkill 💥 #shorts
- It starts with ONE puff 💨 Vape Kayak #shorts

## Description

> It starts with one vape. It ends with a mushroom cloud. 💨💥
>
> Vape Rings, +1 Cloud, a Bigger Vape Battery and the Mushroom Cloud evolution. How far will you upgrade Angie's vape tech? Free, one thumb, plays in your browser.
>
> ▶ PLAY FREE: (your itch.io link)
>
> A free, non-commercial parody. Not affiliated with or endorsed by any politician, party or company.
>
> Music: "Arabian Dancer" by harayu
> https://www.youtube.com/watch?v=NuNPp0UcoOg
> Creative Commons licence (CC-BY 3.0)
>
> #shorts #indiegame #pixelart #browsergame #bulletheaven #survivorslike #gaming

Keep the music credit in the description: the track's licence requires it.

## Pinned comment

> Sorry, duck. 🦆 ▶ Play free: (link). What's your favourite upgrade?

## Structure (trailer theory)

| Time | Beat | What happens | Music |
| --- | --- | --- | --- |
| 0–4 s | **Hook** | A quiet canal in close-up: "A QUIET DAY ON THE CANAL", then "ONE VAPE." A duck drifts in. | Quiet intro |
| 4–6 s | **Set-up** | Slow-motion puff. "BYE BYE, DUCK." | Quiet intro |
| 6–8 s | **Inciting choice** | A level-up screen; VAPE RINGS is picked, then a full-screen "NEW POWER" card. | Gap before the drop |
| 8–12 s | **Escalation 1** | Vape Rings cut through flocks of ducks, firing on the beat. | **Drop** |
| 12–16 s | **Escalation 2** | +1 CLOUD: a mini ring peels off to each side. | |
| 16–22 s | **Escalation 3** | The cards speed up to every 2 seconds: Vape Rings LV 5, +1 Cloud LV 3 (three mini rings), Bigger Vape Battery LV 5. The biome changes from canal to desert to volcano. Rings fire on every beat, then every half-beat. | Building |
| 22–24 s | **Breath** | EVOLUTION card: Mushroom Cloud. The music drops away. | Ducked |
| 24–26 s | **Payoff** | Mushroom Cloud wipes the screen, with a white flash and a boom. | Back in |
| 26–32 s | **Climax** | Fully upgraded vape tech in a volcano horde, ending on "THIS IS FINE." | Full |
| 32–35 s | **Button** | Hard cut to silence. Back on the calm canal: "ONE MORE DUCK." Full-arsenal overkill: "SORRY, DUCK." A callback to the opening. | Silence, then a boom |
| 35–40 s | **Call to action** | Key art, the logo, "UPGRADE YOUR VAPE TECH", "PLAY FREE NOW", credits. | Back on the drop |

## Rebuild

```
node tools/bundle.cjs
node tools/trailer_upgrades.cjs <framesDir>
python3 tools/trailer_upgrades_mix.py <framesDir> marketing/trailer-upgrades/vape-kayak-upgrades-trailer.mp4
```

Gameplay is the real browser game with each shot staged. Some upgrades are set directly so each one appears on cue, and the rings fire on the beat. Sound effects are the game's own.
