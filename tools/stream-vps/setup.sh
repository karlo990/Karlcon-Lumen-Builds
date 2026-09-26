#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu / Debian VPS:  sudo bash setup.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash setup.sh" >&2; exit 1; }
apt-get update -qq && apt-get install -y -qq ffmpeg
mkdir -p /opt/karlcon-stream/videos
cp stream.sh karlcon-stream.service /opt/karlcon-stream/
[ -f /opt/karlcon-stream/stream.env ] || cp stream.env.example /opt/karlcon-stream/stream.env
chmod +x /opt/karlcon-stream/stream.sh; chmod 600 /opt/karlcon-stream/stream.env
cp karlcon-stream.service /etc/systemd/system/ && systemctl daemon-reload
echo
echo "Done. Next:"
echo "  1. Put your videos in /opt/karlcon-stream/videos/"
echo "  2. sudo nano /opt/karlcon-stream/stream.env      (paste the stream URL + key)"
echo "  3. sudo systemctl start karlcon-stream           (go live)"
echo "     sudo journalctl -u karlcon-stream -f          (watch it)    sudo systemctl stop karlcon-stream   (end)"
