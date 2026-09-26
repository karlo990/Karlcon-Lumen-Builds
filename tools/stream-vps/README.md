# Stream the recorded studio 24/7 from a VPS

The videos from `../studio-render` stream on an endless loop from a small Linux server. Your PC and
home internet are no longer involved, so there are no dropped frames. The video is copied as it
was rendered — no re-encoding — so the smallest VPS is enough.

## 1. Rent a VPS
Any provider (Hetzner, Contabo, DigitalOcean, Vultr…): **Ubuntu 24.04, 1–2 vCPU, 2 GB RAM**,
about $5–10 a month. Check the bandwidth allowance: a 720p stream uses about 1.5 GB an hour
(roughly 35 GB a day), which most plans include many times over.

## 2. Set it up (once)
Copy this folder to the server and run the setup. From Windows, WinSCP or:
```
scp -r tools/stream-vps root@YOUR_SERVER_IP:/root/
ssh root@YOUR_SERVER_IP
cd /root/stream-vps && sudo bash setup.sh
```

## 3. Upload the videos
```
scp episodes.mp4 marathon-3h.mp4 root@YOUR_SERVER_IP:/opt/karlcon-stream/videos/
```
They play in file-name order (name them `01-…`, `02-…`), or set `ORDER="shuffle"`, then loop forever.

## 4. Go live
1. In Instagram / Facebook Live Producer choose **Streaming software** and copy the server URL and
   stream key.
2. `sudo nano /opt/karlcon-stream/stream.env` → paste them together into `STREAM_URL`.
3. `sudo systemctl start karlcon-stream`
4. Wait for the preview in Live Producer, then press **Go live** there.

| | |
|---|---|
| Watch the log | `sudo journalctl -u karlcon-stream -f` |
| Stop | `sudo systemctl stop karlcon-stream` |
| New videos / new key | edit, then `sudo systemctl restart karlcon-stream` |
| Start by itself after a reboot (fixed keys, e.g. YouTube) | `sudo systemctl enable karlcon-stream` |

If the connection drops, it reconnects within 5 seconds. After ten failures in two minutes (usually
an expired or wrong key) it pauses for a minute — check the log.

## Platform limits to know
- **Instagram Live** ends a broadcast after **4 hours**, and each broadcast has a new stream key:
  for a longer run, start a new live with the new key every 4 hours (update `stream.env`, restart).
- **Facebook** and **YouTube** allow much longer broadcasts; check the current limits in Live
  Producer / YouTube Studio before a marathon.
- A looped video is a pre-recorded broadcast. Say so in the title or description where the platform
  asks (e.g. "Studio replay"), so it is not flagged as misleading live content.
