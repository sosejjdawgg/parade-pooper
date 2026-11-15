#!/bin/bash
# Angela Rayner's: Vape Kayak - PortMaster launcher (LÖVE 11.5 runtime ships with PortMaster)

XDG_DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}

if [ -d "/opt/system/Tools/PortMaster/" ]; then
  controlfolder="/opt/system/Tools/PortMaster"
elif [ -d "/opt/tools/PortMaster/" ]; then
  controlfolder="/opt/tools/PortMaster"
elif [ -d "$XDG_DATA_HOME/PortMaster/" ]; then
  controlfolder="$XDG_DATA_HOME/PortMaster"
else
  controlfolder="/roms/ports/PortMaster"
fi

source $controlfolder/control.txt
[ -f "${controlfolder}/mod_${CFW_NAME}.txt" ] && source "${controlfolder}/mod_${CFW_NAME}.txt"
get_controls

GAMEDIR=/$directory/ports/vapekayak
CONFDIR="$GAMEDIR/conf/"
mkdir -p "$CONFDIR"
cd "$GAMEDIR"

> "$GAMEDIR/log.txt" && exec > >(tee "$GAMEDIR/log.txt") 2>&1

# saves (save.txt) live in ports/vapekayak/conf/love/vapekayak/
export XDG_DATA_HOME="$CONFDIR"
export SDL_GAMECONTROLLERCONFIG="$sdl_controllerconfig"

# Use PortMaster's LÖVE 11.5 runtime; older PortMaster versions don't have it, so fall back
# to the copy bundled in runtime/, then to a system-wide love.
if [ -f "$controlfolder/runtimes/love_11.5/love.txt" ]; then
  source "$controlfolder/runtimes/love_11.5/love.txt"
  echo "Using PortMaster LOVE runtime"
elif [ -x "$GAMEDIR/runtime/love.aarch64" ]; then
  export LOVE_GPTK="love.aarch64"
  export LOVE_BINARY="$GAMEDIR/runtime/love.aarch64"
  export LOVE_RUN="env LD_LIBRARY_PATH=$GAMEDIR/runtime/libs.aarch64:$LD_LIBRARY_PATH $LOVE_BINARY"
  echo "Using bundled LOVE runtime"
elif command -v love >/dev/null 2>&1; then
  export LOVE_GPTK="love"
  export LOVE_BINARY="$(command -v love)"
  export LOVE_RUN="$LOVE_BINARY"
  echo "Using system love: $LOVE_BINARY"
else
  echo "Vape Kayak: no LOVE runtime found. Update PortMaster and try again." | tee /dev/tty1
  sleep 8
  exit 1
fi
echo "controlfolder=$controlfolder device=$DEVICE_NAME arch=$DEVICE_ARCH cfw=$CFW_NAME"

# gptokeyb only provides the hotkey exit (Select+Start); the game reads the pad directly
$GPTOKEYB "$LOVE_GPTK" &
type pm_platform_helper >/dev/null 2>&1 && pm_platform_helper "$LOVE_BINARY"
$LOVE_RUN "$GAMEDIR/gamedata"
echo "LOVE exited with code $?"

if type pm_finish >/dev/null 2>&1; then pm_finish
else pgrep -f gptokeyb | xargs -r kill -9; printf "\033c" > /dev/tty0; fi
