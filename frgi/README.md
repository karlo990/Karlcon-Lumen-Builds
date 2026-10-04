# frgi

frgi finds Zimbabwe wildlife-experience videos on Pinterest, ranks them, tracks permission from each creator, downloads cleared videos as `KCERMEDIA_101.mp4`, `KCERMEDIA_102.mp4` and so on, writes a caption JSON and a description file for each, zips them for review, and publishes Reels to Instagram.

It needs only Python 3.9+ (no installs). Why it works this way: [RESEARCH.md](RESEARCH.md).

## Quick start: one script for everything

```
python run_all.py setup      # once: installs Python Playwright + Chromium (or add --chrome to use Chrome)
python run_all.py            # guided menu
```

The menu runs each step:

| Step | What it does |
|---|---|
| browse | opens a browser you drive, recording as you scroll |
| process | ranks the pins and writes `leads.html` (links to open next), `candidates.json` (caption drafts) and `permission_requests.txt` |
| permissions | you enter each creator's yes or no |
| download | saves cleared videos as `KCERMEDIA_101.mp4` and up, each with its caption JSON and description |
| package | makes the zip of captions and descriptions for review |
| apply | loads corrected captions back in |
| bundle | zips the whole toolkit |

Every step is also a subcommand, for example `python run_all.py process` or `python run_all.py all`. The sections below are the same steps done by hand with `frgi.py`.

## 1. Install the grabber (once)

```
python frgi.py bookmarklet
```

Copy the printed `javascript:...` line into a new browser bookmark (as the URL) and name it **frgi**.

### Or: the Playwright browser (no bookmarklet, survives reloads)

```
npm i playwright
npx playwright install chromium
node pw_session.mjs --ingest              # add --chrome to use your installed Chrome
```

This opens a normal browser window with the grabber already running on every Pinterest page. You still do all the scrolling yourself. Captures save to `frgi-work/captures/` every 15 seconds, and `--ingest` loads them into frgi when you close the window. You log in once, and the profile is kept.

To test the grabber offline: `node tests/grabber.test.mjs`.

## 2. Browse Pinterest with the grabber recording

```
python frgi.py keywords          # Zimbabwe search links: Hwange, Mana Pools, Gonarezhou ...
```

1. On pinterest.com, click **frgi** once. Recording starts.
2. Search, scroll and open video pins as normal. Every pin card you scroll past is recorded.
3. On each pin you open ("land" on), it also saves the pin's details, its MP4 link and the "More to explore" pins beside it. Those are your leads.
4. Click **frgi** again to export `frgi-capture-<time>.json`. You can export as often as you like.
5. Export before reloading the tab: a full page reload clears the recording.

## 3. Rank, and follow the leads

```
python frgi.py ingest ~/Downloads/frgi-capture-*.json
python frgi.py rank --video       # best Zimbabwe video pins first (Uganda/Kenya/... pins are hidden)
python frgi.py next               # unopened pins worth opening next
python frgi.py add <pin-url> ...  # add a pin you found elsewhere (share > copy link)
```

Open what `next` suggests, save the good ones to one board, export, and ingest again. Each round narrows Pinterest's recommendations toward Zimbabwe safari video.

## 4. Permission, then download (numbers are given here)

```
python frgi.py ask <pin>                                     # message to send the creator
python frgi.py rights <pin> permission --note "IG DM from @name 2026-10-04, credit as @name"
python frgi.py fetch                                          # downloads every cleared pin
python frgi.py attach <pin> original.mp4                      # or use the file the creator sent
```

Each downloaded video gets the next number, starting at `KCERMEDIA_101`:

```
frgi-work/media/KCERMEDIA_101.mp4
frgi-work/captions/KCERMEDIA_101.json        caption_draft, caption_final, creator, rights, places, species
frgi-work/descriptions/KCERMEDIA_101.txt     the video's description
frgi-work/descriptions/descriptions.jsonl    every description in one file
```

Rights statuses are `pending`, `requested`, `permission`, `own`, `licensed` and `declined`. Only `permission`, `own` and `licensed` can be downloaded or published.

## 5. Zip for caption review, then load the corrections back

```
python frgi.py draft              # caption drafts for top candidates -> candidates.json (no download)
python frgi.py pack               # KCERMEDIA_captions_<date>.zip (add --with-media for the MP4s)
```

Upload the zip to Claude to correct the captions. The corrected text goes in each file's `caption_final`. Then load the corrected zip:

```
python frgi.py apply KCERMEDIA_captions_corrected.zip
```

## 6. Publish to Instagram

```
set IG_USER_ID=...      (Windows)   /   export IG_USER_ID=...
set IG_ACCESS_TOKEN=...
python frgi.py publish KCERMEDIA_101 --video-url https://<public-host>/KCERMEDIA_101.mp4        # dry run
python frgi.py publish KCERMEDIA_101 --video-url https://<public-host>/KCERMEDIA_101.mp4 --go
```

This uses the Instagram Graph API, so it needs an Instagram professional account linked to a Meta app. Instagram fetches the video itself, so the MP4 must be at a public HTTPS URL. Publishing only goes ahead once the caption has been reviewed with `apply` (or you pass `--force-draft`).

## Post the videos with your own Instagram scripts

`instagram/post_kcermedia_reels.py` posts the numbered videos as Reels through your existing `Post.py`, using its browser profile, login and share steps. Copy it into the folder that holds `Post.py`, then run:

```
python post_kcermedia_reels.py --frgi-home "C:\path\to\frgi\frgi-work" --dry-run
python post_kcermedia_reels.py --frgi-home "C:\path\to\frgi\frgi-work" --limit 1
```

The first command lists what would be posted without posting anything. The second posts one Reel as a test.

It posts only videos that are:
- rights-cleared,
- downloaded,
- not already published, and
- reviewed: they have a `caption_final`. To post an unreviewed draft caption instead, add `--allow-draft`.

Every caption credits the creator, and any video whose creator is unknown is skipped. After each post the script writes the result into that video's caption JSON, so re-running continues where it stopped. It posts at most 4 Reels per run (`--daily-limit`), with a 45 to 90 second pause between posts.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `FRGI_HOME` | `./frgi-work` | where the ledger, media, captions and descriptions live |
| `FRGI_PREFIX` | `KCERMEDIA` | the number prefix |
| `FRGI_GRAPH_VERSION` | unset (app default) | e.g. `v23.0` |

## Why frgi doesn't auto-scroll Pinterest

Pinterest's robots.txt blocks every bot it hasn't listed. So frgi doesn't crawl: you browse, and Pinterest's own recommender (a random walk over the pin graph, see RESEARCH.md) brings up the leads. frgi only reads what your browser already showed you, and it downloads a video only after you've recorded the creator's permission.
