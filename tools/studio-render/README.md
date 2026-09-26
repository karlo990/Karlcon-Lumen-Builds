# Record the studio to video (render mode)

Live, one PC draws the studio, encodes it and uploads it at the same time, and it lags. Here the
studio is **recorded frame by frame** instead: each frame is drawn at full quality, captured, and
only then does the show's clock move on. A slow PC just takes longer; the video itself never
stutters. The finished MP4 then streams on a loop from a cheap VPS (see `../stream-vps`).

## One-time setup (Windows)
1. Install **Node.js LTS** from nodejs.org.
2. Get the project: GitHub → Code → Download ZIP (or GitHub Desktop), unzip it.
3. Open the `tools\studio-render` folder, click the address bar, type `cmd`, press Enter.
4. Run `npm install` (a minute; it brings its own ffmpeg — nothing else to install).

It uses the **Microsoft Edge** already on the PC. Close other heavy programs while it renders.

## Record
```
node render.mjs --ep 1 --key YOUR_STUDIO_PASSCODE
node render.mjs --ep all --key YOUR_STUDIO_PASSCODE --out episodes.mp4
node render.mjs --mode marathon --dur 3h --key YOUR_STUDIO_PASSCODE --out marathon-3h.mp4
```
- `--key` is the studio passcode (STUDIO_KEY). It is needed for the **premium (ElevenLabs) voices**:
  a web page cannot record the browser's own voices, so without it the video has music only.
  Each voice line is paid for once — repeats come from the voice cache.
- `--mode marathon --dur 3h` records three hours of the marathon: episodes, and Claude's live segments
  written as it goes (a cent or two each). The clock waits while a segment is being written.
- The file is saved next to the script unless you give `--out`.

| Option | Default | |
|---|---|---|
| `--format` | `vertical` | `vertical` 9:16 (Instagram, Facebook Reels) or `landscape` 16:9 (YouTube) |
| `--size` | `720` | `720` (720×1280) or `1080` (1080×1920) |
| `--quality` | `high` | `high` or `standard` |
| `--fps` | `30` | |
| `--dur` | 4 h (episodes), 1 h (marathon) | maximum length: `90m`, `3h`, `5400` |
| `--music 0` / `--musicvol 1.6` | | music off / louder, as on /studio |
| `--browser` | `msedge` | `chrome`, or a path to chrome.exe |
| `--headed` | | show the window while it renders |

**Ctrl+C** stops early and still saves a playable file of everything recorded so far.

## How long it takes
It prints its speed as it goes ("0.6× real time" means one minute of video every ~1.7 minutes).
On a typical laptop, expect roughly 1–3× the video's length at 720p High (the six episodes are about
25 minutes). Measured on a server with no graphics card at all: about 1.7 frames a second at
Standard quality.

## What you get
H.264 video (3 Mbps at 720p, a keyframe every 2 s) + AAC 44.1 kHz sound, ready for Instagram /
Facebook / YouTube Live as it is — the VPS streams it without re-encoding.
