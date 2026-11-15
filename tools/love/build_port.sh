#!/bin/bash
# Builds the PortMaster zip for R36-class handhelds (ArkOS etc).
#   tools/love/build_port.sh            -> dist/vapekayak-portmaster.zip         (public: no River)
#   tools/love/build_port.sh --private  -> dist/vapekayak-portmaster-private.zip (with the River opener)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/handheld/love"
PM="$ROOT/handheld/portmaster"
PRIVATE=0; [ "${1:-}" = "--private" ] && PRIVATE=1
SUFFIX=""; [ $PRIVATE = 1 ] && SUFFIX="-private"
OUT="$ROOT/dist/vapekayak-portmaster$SUFFIX.zip"

STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
G="$STAGE/vapekayak/gamedata"
mkdir -p "$G/assets"
for f in "$SRC"/*.lua; do [ "$(basename "$f")" = testshots.lua ] || cp "$f" "$G/"; done
cp -r "$SRC/assets/sfx" "$SRC/assets/atlas.png" "$SRC/assets/atlas.lua" "$G/assets/"
mkdir -p "$G/assets/music"
for f in "$SRC"/assets/music/*.ogg; do
  [ $PRIVATE = 0 ] && [ "$(basename "$f")" = river.ogg ] && continue
  cp "$f" "$G/assets/music/"
done

cp "$PM/Vape Kayak.sh" "$STAGE/"
cp "$PM/port.json" "$PM/README.md" "$PM/gameinfo.xml" "$STAGE/vapekayak/"
cp -r "$PM/licenses" "$STAGE/vapekayak/"
if [ -f "$PM/screenshot.png" ]; then cp "$PM/screenshot.png" "$STAGE/vapekayak/"; fi
# PortMaster scripts must have LF endings and be executable
sed -i 's/\r$//' "$STAGE/Vape Kayak.sh"; chmod +x "$STAGE/Vape Kayak.sh"

mkdir -p "$ROOT/dist"; rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" "Vape Kayak.sh" vapekayak)
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
