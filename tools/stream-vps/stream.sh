#!/usr/bin/env bash
# KARLCON — stream the rendered studio videos on an endless loop to Instagram / Facebook / YouTube Live.
# One ffmpeg connection for the whole run (no reconnect between videos), video and sound copied as
# rendered (almost no CPU). systemd restarts it if the connection drops (see karlcon-stream.service).
set -euo pipefail
cd "$(dirname "$0")"
[ -f stream.env ] && . ./stream.env
: "${STREAM_URL:?Set STREAM_URL in stream.env (server URL + stream key)}"
VIDEO_DIR="${VIDEO_DIR:-$PWD/videos}"
ORDER="${ORDER:-name}"          # name = in file-name order; shuffle = a new order on every (re)start

mapfile -t files < <(find "$VIDEO_DIR" -maxdepth 1 -type f -name '*.mp4' | sort)
[ "${#files[@]}" -gt 0 ] || { echo "No .mp4 files in $VIDEO_DIR" >&2; exit 1; }
[ "$ORDER" = shuffle ] && mapfile -t files < <(printf '%s\n' "${files[@]}" | shuf)

list="$(mktemp --suffix=.txt)"
for f in "${files[@]}"; do printf "file '%s'\n" "${f//\'/\'\\\'\'}"; done > "$list"
echo "$(date '+%F %T') streaming ${#files[@]} video(s) on a loop to ${STREAM_URL%/*}/…"

exec ffmpeg -hide_banner -loglevel warning -nostdin \
  -re -stream_loop -1 -f concat -safe 0 -i "$list" \
  -c copy -flvflags no_duration_filesize -f flv "$STREAM_URL"
