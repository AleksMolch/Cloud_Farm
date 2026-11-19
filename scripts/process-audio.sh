#!/usr/bin/env bash
set -euo pipefail

INPUT_DIR="raw_assets/audio"
OUTPUT_DIR="public/assets/audio"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install it with: brew install ffmpeg" >&2
  exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
  echo "No source audio in $INPUT_DIR. Put music_*/sfx_* files there and rerun."
  exit 0
fi

mkdir -p "$OUTPUT_DIR"
shopt -s nullglob
files=("$INPUT_DIR"/*.wav "$INPUT_DIR"/*.mp3 "$INPUT_DIR"/*.ogg "$INPUT_DIR"/*.m4a "$INPUT_DIR"/*.flac)

if [ ${#files[@]} -eq 0 ]; then
  echo "No audio files found in $INPUT_DIR."
  exit 0
fi

processed=0
for file in "${files[@]}"; do
  name="$(basename "${file%.*}")"
  output="$OUTPUT_DIR/${name}.ogg"

  case "$name" in
    music_*)
      ffmpeg -hide_banner -loglevel error -y -i "$file" \
        -af "loudnorm=I=-18:TP=-1.5:LRA=11,afade=t=in:st=0:d=1,areverse,afade=t=in:st=0:d=1,areverse" \
        -c:a libvorbis -q:a 5 "$output"
      ;;
    sfx_*)
      ffmpeg -hide_banner -loglevel error -y -i "$file" \
        -af "loudnorm=I=-14:TP=-1:LRA=9,silenceremove=start_periods=1:start_silence=0.02:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.02:start_threshold=-45dB,areverse" \
        -c:a libvorbis -q:a 6 "$output"
      ;;
    *)
      echo "Skipping $file: expected music_* or sfx_* prefix."
      continue
      ;;
  esac

  processed=$((processed + 1))
  echo "$file -> $output"
done

if [ "$processed" -eq 0 ]; then
  echo "No files matched music_* or sfx_* prefixes."
else
  echo "Processed $processed audio file(s)."
  echo "Hook the files in AudioService when you want to replace synthesized audio."
fi
