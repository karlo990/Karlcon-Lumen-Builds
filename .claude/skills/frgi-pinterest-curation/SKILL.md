---
name: frgi-pinterest-curation
description: Curate Zimbabwe wildlife-experience videos from Pinterest for Instagram with the frgi tool (frgi/ in this repo). Covers the browser grabber and the Playwright session, ranking and lead-following, creator permission, KCERMEDIA_<n> numbering, the caption JSON and description files, correcting captions from a returned zip, publishing Reels, and testing or repairing the grabber with Playwright when Pinterest's markup changes. Use when the user mentions frgi, KCERMEDIA, Pinterest curation, safari/wildlife reels, uploads a KCERMEDIA captions zip, or asks to fix or extend the grabber.
---

# frgi: Pinterest → Instagram wildlife curation

The tool lives in `frgi/`. Read `frgi/README.md` for the user's commands and `frgi/RESEARCH.md` for the research it is based on: the Pinterest recommender papers and the destination-image studies.

## Rules that never bend

1. **No automated browsing of Pinterest.** robots.txt on www.pinterest.com and the pinimg CDNs is `User-agent: * / Disallow: /`. Never write code (Playwright or otherwise) that scrolls, clicks, navigates, paginates or fetches search, board or "More to explore" pages on its own. The human browses; frgi only reads what their browser already rendered. The only server calls frgi makes are Pinterest's public oEmbed endpoint (`frgi add`) and a single download per user-chosen, rights-cleared pin.
2. **Permission before download or publish.** `fetch`, `attach` and `publish` refuse a pin unless its rights status is `own`, `permission` or `licensed`, and recording one of those needs a `--note` saying who granted it. Never weaken this gate, add a bypass flag, or mark rights on the user's behalf.
3. **Every caption credits the creator.** Never remove the credit line.

## One-script entry point

`frgi/run_all.py` wraps everything for the user. It has a guided menu, plus the subcommands `setup`, `browse`, `process`, `permissions`, `download`, `package`, `apply`, `publish`, `bundle` and `all`.

- **`browse`** is the Python Playwright version of `pw_session.mjs`. It uses the same inlined, top-frame-only init script, and it opens `leads.html` in a second tab.
- **`process`** ingests the captures, writes `leads.html`, `candidates.json` and `permission_requests.txt`, and marks those pins as `requested`.
- **`permissions`** records only answers the user types, and requires a note.
- **`bundle`** builds `frgi_KCERMEDIA_toolkit.zip`. It contains the scripts, docs, tests, a freshly generated `bookmarklet.txt`, this skill, and `START_HERE.txt`.

When you change any frgi file, rebuild the zip with `python frgi/run_all.py bundle`.

## The pipeline

```
grabber (bookmarklet or pw_session.mjs) -> frgi-capture-*.json
  -> frgi ingest -> rank / next  (leads to open next; Pixie-style random walk with restart)
  -> ask -> rights <pin> permission --note ...
  -> fetch | attach   => media/KCERMEDIA_101.mp4, captions/KCERMEDIA_101.json, descriptions/KCERMEDIA_101.txt (+ descriptions.jsonl)
  -> pack (zip) -> user uploads zip to Claude -> Claude writes caption_final -> frgi apply <zip>
  -> publish <KCERMEDIA_n> --video-url <public https mp4> [--go]
```

- Numbers come from `ledger.json` (`next_number`, starting at 101). They are assigned once, on the first download or attach, and are never reused.
- The workspace is `FRGI_HOME` (default `./frgi-work`). The ledger is the source of truth: back it up and never hand-edit `number` or `next_number`.
- `zimbabwe_keywords.json` is the gazetteer. Places outweigh species, and species outweigh experiences. Pins that name another country (Uganda, Serengeti, Kruger ...) and no Zimbabwe place are marked off-target and hidden. To add a place, give it aliases (camps, landmarks, local names) and a hashtag, then run `ingest` again to rescore.

## Playwright

Playwright has three jobs here. All three either run in a window the human drives or run fully offline.

### 1. `frgi/pw_session.mjs`: the human-driven browser

`node pw_session.mjs [--chrome] [--ingest]` opens a headed persistent-profile browser with the grabber preloaded on every pinterest.com page (through `addInitScript`). Exports go through `exposeFunction('__frgiSave')` to `frgi-work/captures/capture-<doc>.json` every 15 s and on `pagehide`, so full reloads no longer lose the recording (the bookmarklet's weakness). One-time setup on the user's machine: `npm i playwright && npx playwright install chromium`, or pass `--chrome` to use installed Chrome.

Facts learned the hard way. Keep them when editing the script:

- **Pinterest's Content-Security-Policy blocks `eval`.** The grabber source is inlined into the init script as a function body. Never go back to `eval(SRC)`, and don't "fix" it with `bypassCSP`.
- **The init script runs in every frame,** including the `ct.pinterest.com/ct.html` tracking iframe, whose empty export used to overwrite the real one. Keep the `window.top !== window` guard.
- **The first navigation waits for `domcontentloaded`,** not `load`, because the app keeps loading for a long time. A failed first load logs a message and doesn't throw.
- **When `window.__frgiSink` exists,** the grabber hands its JSON to it instead of downloading a file and skips its `alert()`s.

### 2. `frgi/tests/grabber.test.mjs`: offline regression test

```
cd frgi && node tests/grabber.test.mjs
```

It serves `tests/fixtures/pin.html` at a fake pinterest.com pin URL using `page.route(...).fulfill`, aborts every other request so nothing leaves the machine, runs the grabber twice (start, then export), and checks:

- the pins, page kind and landed pin
- the MP4 link and the description
- the duration badge

It then pipes the export through `frgi.py` (ingest → rank → next → rights → attach) and checks off-target filtering, lead suggestion and the KCERMEDIA_101 caption and description files. Run it after any change to `grabber.js`, `frgi.py` or the gazetteer.

The fixture is synthetic but mirrors the real pin page: `ld+json` `SocialMediaPosting` + `VideoObject`, embedded `"description"`/`"auto_alt_text"` JSON fields, `v1.pinimg.com/videos/iht/expMp4/..._720w.mp4`, and `[data-grid-item] > a[href^="/pin/"][aria-label] img[alt]` cards with a `0:12` duration badge. Don't commit real Pinterest page HTML; it's other people's content.

### 3. Repairing the grabber when Pinterest changes its markup

Symptom: the user's captures show `0 pins`, no `mp4`, or every page has kind `other`.

1. Ask the user for one fresh capture JSON. If needed, also ask for a DevTools "Copy outerHTML" of a single grid card and the `<head>` of one pin page from their own browser. Never fetch Pinterest pages yourself to investigate; a single pin page is the most you'd need, and asking the user is better.
2. Update `tests/fixtures/pin.html` to the new structure first. The test should now fail the way the user's capture failed.
3. Fix `grabber.js`: the selectors in `readCard`, the regexes in `pinDetail`, the page-kind rules in `pageInfo`. Rerun the test until it passes.
4. Regenerate the bookmarklet (`python frgi.py bookmarklet > bookmarklet.txt`) and tell the user to replace their bookmark. `pw_session.mjs` reads `grabber.js` directly, so it needs no change.

Sandbox note: in Claude's cloud container, Chromium doesn't trust the egress proxy's certificate (`ERR_CERT_AUTHORITY_INVALID`), and Pinterest's app never finishes loading through it. For a live smoke test there, copy the script to the scratchpad and add `ignoreHTTPSErrors: true` to that copy only. Never commit that option, and expect only the server-rendered landed pin, not "More to explore".

## Correcting captions from a returned zip

The user uploads `KCERMEDIA_captions_<date>.zip` (`captions/*.json`, `descriptions/*`, `manifest.json`, maybe `candidates.json`). For each `captions/KCERMEDIA_<n>.json`:

1. Read `original`, `location`, `species`, `experiences`, `creator`, `rights` and `caption_draft`. Use `descriptions/KCERMEDIA_<n>.txt` and anything the user says about the clip as the facts. Never invent a sighting, place or creator.
2. Write `caption_final` in the same shape as `caption_draft` (`hook`, `body`, `credit`, `cta`, `hashtags`, `full_text`, `alt_text`, `location_tag`):
   - **Hook:** species + experience + named park, true to the clip.
   - **Body:** one or two lines with a specific Zimbabwe detail (Mana Pools floodplain, Chilojo Cliffs, Hwange pans), then a question that invites comments.
   - **Credit:** keep it, with the creator's preferred handle from `rights.note`.
   - **Hashtags:** place-first, 5 to 10, never more than 30.
   - **`full_text`:** 2,200 characters or fewer. Write a plain-language `alt_text`.
3. Leave every other field alone. Don't touch `id`, `pin_id`, `rights` or `file`. Re-zip with the same paths and give the user the zip plus the command `python frgi.py apply <zip>`.

If the rights status in a file isn't cleared, still correct the caption, but flag that the item can't be published yet.
