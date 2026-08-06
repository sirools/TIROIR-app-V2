#!/usr/bin/env bash
# Transforme un rush de simulateur en plan utilisable.
#
# Piloter l'app à distance laisse de longs temps morts entre deux gestes :
# mpdecimate supprime les images identiques, ce qui compresse l'attente sans
# toucher au mouvement. On accélère ensuite pour tenir dans la durée du plan.
#
#   ./densify.sh public/captures/04-selection.mp4 [duree_cible_en_s]
set -euo pipefail

SRC="$1"
TARGET="${2:-4}"
OUT="${SRC%.mp4}-cut.mp4"

# 1re passe : couper les temps morts, mesurer ce qu'il reste.
TMP="$(mktemp -t densify).mp4"
ffmpeg -v error -i "$SRC" \
  -vf "mpdecimate=hi=64*24:lo=64*10:frac=0.02,setpts=N/FRAME_RATE/TB,scale=644:-2" \
  -r 30 -an -y "$TMP"

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP")"
# Facteur d'accélération pour atteindre la durée cible (jamais de ralenti).
FACTOR="$(python3 -c "print(min(1.0, $TARGET / $DUR))")"

ffmpeg -v error -i "$TMP" -vf "setpts=${FACTOR}*PTS" -r 30 -an -y "$OUT"
rm -f "$TMP"

FINAL="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")"
printf '%s : %.1fs brut → %.1fs utile (×%.1f)\n' \
  "$(basename "$OUT")" "$DUR" "$FINAL" "$(python3 -c "print(1/$FACTOR)")"
