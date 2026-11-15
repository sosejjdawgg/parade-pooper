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

source $controlfolder/runtimes/"love_11.5"/love.txt

# gptokeyb only provides the hotkey exit (Select+Start); the game reads the pad directly
$GPTOKEYB "$LOVE_GPTK" &
pm_platform_helper "$LOVE_BINARY"
$LOVE_RUN "$GAMEDIR/gamedata"

pm_finish
