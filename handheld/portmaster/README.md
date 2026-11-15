# Angela Rayner's: Vape Kayak (PortMaster)

Like-for-like port of the browser game, running on LÖVE 11.5. The game is the same: the canal, desert and volcano
biomes, every weapon, power, evolution and shop upgrade, the Vape Engine, the HUD portrait, the music and the sound
effects. The only changes are for the 640x480 screen and the buttons.

## Install
1. PortMaster must be installed (it comes with ArkOS on the R36S / RS36 Pro).
2. Copy `Vape Kayak.sh` and the `vapekayak` folder into `EASYROMS/ports/`.
3. Restart EmulationStation (or refresh the games list), then open Ports > Vape Kayak.

## Controls
| Button | In a run | In menus |
|---|---|---|
| D-pad left / right | steer (tap to nudge, hold to keep going) | move focus |
| Left stick | smooth steering, like tilt on a phone (STICK STEER in Settings) | move focus |
| D-pad up / down | - | move focus / scroll |
| A | - | choose |
| B | - | back |
| Start | pause | pause / resume |
| Select + Start | quit to EmulationStation | quit |

## Screen
The 360-pixel play column sits in the middle of the 640x480 screen and the river banks run out to both edges. How to
Play and the shop scroll, and the results screen is laid out for the shorter screen. Share is replaced by Title, and
phone tilt is replaced by the stick.

## Saves
`ports/vapekayak/conf/love/vapekayak/save.txt`. Delete it, or use Settings > Reset, to start again.

## Legal
A free, non-commercial parody with no affiliation to anyone it depicts. Music: "Riding a UFO" and "Arabian Dancer" by
harayu, CC-BY 3.0. See `licenses/` and the in-game About and Legal screen.

## If it opens and closes straight away
Open `ports/vapekayak/log.txt` on the SD card (put the card in a computer). It says which LÖVE runtime was used
and why the game stopped. Updating PortMaster (Ports > PortMaster) usually fixes launch problems. A copy of the
LÖVE runtime is included in `runtime/` for older PortMaster versions that don't have one.
