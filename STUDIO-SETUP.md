# KARLCON Studios — live presenter page

## Address after deploying
    /studio              the studio (two presenters, the building, the Atlas globe)
    /studio?format=vertical   9:16 frame for Instagram Live
    /studio?obs          clean feed: no dock, no cursor (keyboard still works)

## Files (all at the ROOT of the karlcon-lumen-builds project)
    studio.html              the page: director, voices, captions, on-air graphics
    studio-kit/hosts.js      the presenters: seated pose, IK arms/legs, eyes, blinks, gestures, lip-sync,
                             listening reactions, weight shifts, drinking, motion-capture blending
    studio-kit/set.js        the set: blueprint wall, KARLCON STUDIOS desk and bottles, buildings, crane, photographic Atlas globe, story screen
    studio-kit/episodes.js   hosts + the Episode 1 script (edit lines and cues here)
    studio-kit/lipsync-en.mjs   text-to-viseme rules from TalkingHead (MIT, see LICENSE-talkinghead)
    models/hosts/*.glb       presenter avatars (see licences below)
    vendor/three/            three.js r170 (MIT), served locally so the studio runs offline
    vercel.json, sw.js       /studio route added; the service worker leaves the studio alone

## Going live on Instagram
1. Open /studio in Microsoft Edge (best free voices) and pick 9:16.
2. OBS: Window Capture on that browser window + Desktop Audio. Crop to the frame.
3. Stream to Instagram with Live Producer (it gives you the RTMP URL and key).
4. Press "Go live". Space = pause, ←/→ = line, 1–7 = camera, C = captions, H = dock.

## Avatar licences — read before a public broadcast
- avaturn.glb (Luma) and avatarsdk.glb (Karl) are the TalkingHead project's samples:
  NON-COMMERCIAL use only. Rehearse with them, then replace them.
- mpfb.glb is CC0 (free for any use) and is the automatic fallback.
- To replace: make your own avatar from photos at avaturn.me (Type-2 export; tell Avaturn it is
  for commercial use), save it as models/hosts/<name>.glb, and point `model` in
  studio-kit/episodes.js at it. No other change is needed — the rig adapts to any
  Ready-Player-Me / Mixamo-style skeleton with viseme blendshapes.

## Writing a new episode
Copy the episode object in studio-kit/episodes.js. Each line has `who` and `say`, plus optional
cues: cam, look, point, build (0–7), open (0–1), slide, ticker, mood. House rule: engineering
numbers only where they come from the LB-1 engineering file.

## Live mode — Claude writes the show (endless)
    /studio?mode=live   the studio, writing itself segment by segment
    /writers-room       watch the script arrive, see what was rejected, send viewer questions, steer

### One-time setup in Vercel (Settings → Environment Variables), then redeploy
    ANTHROPIC_API_KEY   your Claude API key (workspace-scoped, with an expiry). Server only.
    STUDIO_KEY          a passcode you choose; you type it into /studio and /writers-room.
    STUDIO_MODEL        optional; default claude-sonnet-5.

### How it stays grounded (no foreign narratives)
- The server builds each prompt only from: your concept library (concepts-data.js + /?admin
  edits), the site's own facts, and the short Zimbabwe / design-intent lists in
  api/_studio-facts.js. Nothing is fetched from the open web.
- Every line must cite the fact ids it uses. Before a line reaches the hosts, the server drops it
  if it: speaks a number that is not in a cited fact; names a country or city that is not in the
  facts; mentions prices, guarantees, awards or politics; claims past clients or projects; or has
  links, emojis or markdown. If too much is dropped, Claude rewrites once. Everything dropped is
  listed in the Writers' Room.
- Viewer questions are treated as material to answer, never as instructions.
- KARL: read the INTENT facts in api/_studio-facts.js — they are said on air as KARLCON design
  intentions (rain sensor, battery backup + manual override, water test). Delete any that are not true.

### The loop
Segments run in arcs per concept: the concept → how it opens → climate / process / materials /
build → the Atlas flies to the next city, then the next concept. One segment is always written
ahead. If writing fails twice, the show plays lines from Episode 1 until it recovers.
Cost guide with claude-sonnet-5: roughly a cent or two per segment.

### Running it
1. Open /studio?mode=live in Edge, enter the passcode, press Go live.
2. Open /writers-room in the same browser (another window) — it links to the studio automatically.
3. Capture only the studio window in OBS.

## Six episodes and the 20-hour marathon
    /studio?ep=3                     play one scripted episode (1–6); also chosen on the start screen
    /studio?mode=marathon            the marathon (start screen: hours, live segments per episode)
    /studio?mode=marathon&format=vertical&obs   the marathon as a clean 9:16 feed for Instagram Live

Episodes (studio-kit/episodes.js), each with its own building on stage (studio-kit/buildings.js),
build sequence 0–7, roof reveal, materials list and Zimbabwe segment:
    1  The Elevated Glass Cube   Harare          bi-parting pair (LB-1 figures)
    2  The Lumen Oval            Victoria Falls  telescoping curved panels (concept mechanism)
    3  The Rotunda Fan           Masvingo        radial fan of glass wedges (concept mechanism)
    4  The Origami Crown         Harare          eight-petal folding crown (concept mechanism)
    5  The Stone Arcade          Bulawayo        bi-parting pair (LB-1 figures)
    6  The Granite Tower         Mutare          bi-parting pair on struts (LB-1 figures)
The five new buildings are also in the concept library (concepts-data.js) with card images and
Meshy inputs: open /developer and press "Generate all missing" to make their 3D models.

The marathon plays the episodes in turn. After each one, Claude writes fresh segments about that
building (default 10), then the next episode starts; it loops until the hours run out, with an
on-air "HOUR x/20" counter. If live writing is unavailable (no key, no credit) it plays the six
episodes on a loop instead, so the stream never goes dead.
Cost guide (estimate, claude-sonnet-5, 10 live segments per episode): roughly $10–15 for 20 hours.
Keep the studio window visible (not minimised) for the whole run, or the browser slows it down.

## Picture and movement (automatic)
- Quality: High (default) adds ambient occlusion, depth of field on close-ups, a reflective floor
  and soft area lights. Standard is lighter for slower laptops: /studio?q=standard, or the
  High/Standard buttons on the start screen. Both add a gentle glow on the brightest highlights.
- The listener reacts: nods, smiles, raised brows, leaning in on questions, glancing at the screen
  when a slide changes. The camera sometimes cuts to the listener at the end of a sentence.
- Now and then a presenter drinks from the Elite Retreats bottle on the desk (long lines only,
  at most every two minutes).
- A logo wipe plays when an episode starts or the show moves to a new building; lower thirds slide in; during a build the crane swings and
  dust rises as each stage lands.
- The Atlas is a photographic Earth (NASA Blue Marble, public domain) with Zimbabwe marked. It
  turns to each episode's city and to the city of every live segment.

## Real 3D buildings on stage (Meshy)
When a concept in the library has a finished 3D model (modelUrl), the studio loads it and, once
the build sequence reaches the end, the procedural building dissolves into the real model. To make
the models: open /developer, press "Generate all missing", wait for them to finish. Nothing else to
do. If a model faces the wrong way on stage, add `stageYaw: 90` (degrees) to that concept.
Turn it off for a show with /studio?meshy=0.

## Motion capture (Mixamo) — optional, free
The presenters already move procedurally. For more natural upper bodies:
1. Sign in at mixamo.com (free Adobe account). Load any character.
2. Download "Sitting Idle" and "Sitting Talking": Format FBX Binary, Skin "Without Skin", 30 fps.
3. Save them as models/anim/sitting-idle.fbx and models/anim/sitting-talking.fbx, push.
The studio picks them up automatically and blends them into the spine, neck and shoulders only
(hands, eyes and lips stay under the rig's control). Without the files nothing changes.

## Background music
    models/audio/playlist.json   the songs, shuffled
    models/audio/*.mp3           the songs (loudness-normalised to -18 LUFS, silence trimmed)
The music starts with the opening sting and never stops: songs play in a shuffled order (each
once per round, never the same one twice in a row) with a 4-second crossfade between them.
To add a song: put the mp3 in models/audio/ and add a line to playlist.json:
    { "src": "song.mp3", "title": "Artist – Song", "duck": -24 }
"duck" is optional: use -24 for songs with vocals (rap/singing fights the hosts' words more than
an instrumental does); the default is -20. Mixing is automatic:
- Between lines the music sits at -8 dB; when a host speaks it dips to -20 dB within a quarter
  second (about 22 dB under the voice) and stays down across the short gaps between lines, so it
  doesn't pump. It rises again slowly on stings, title cards and pauses.
- The music is EQ'd out of the speech band (-2 dB at 300 Hz, -2 to -6 dB at 2.5 kHz), and
  ElevenLabs voices get a high-pass, a little presence and gentle compression. A limiter on
  the output stops clipping.
- Dock: Music button (or M) fades it in/out; ⏭ Song (or N) skips to the next song; Music slider sets the level (0–2).
- Address options: ?music=0 (off) · ?musicvol=0.6 (quieter) · ?musicsrc=/models/audio/other.mp3 (plays just that one)
- OBS Browser Source: tick "Control audio via OBS" so music and voices go into the stream.
COPYRIGHT: commercial songs on Instagram/Facebook Live usually get the live muted or stopped by
Meta's rights matching. For public streams use music you have a licence for (royalty-free or
licensed library music, or Meta's Sound Collection).

## Premium voices with exact lip-sync (ElevenLabs) — optional, paid
Browser voices are free but robotic. With ElevenLabs the hosts sound human and the lips follow
the real audio timings.
1. elevenlabs.io → sign up (a paid plan is needed for 20-hour use), create an API key
   (restrict it to Text to Speech).
2. Voice Library → pick one voice for Luma and one for Karl → copy each Voice ID.
3. Vercel → Settings → Environment Variables (Secret; Production + Preview), then redeploy:
       ELEVENLABS_API_KEY      the key — never in the repo or the page
       ELEVENLABS_VOICE_LUMA   Luma's voice id
       ELEVENLABS_VOICE_KARL   Karl's voice id
       ELEVENLABS_MODEL        optional; default eleven_multilingual_v2
4. Type the studio passcode on the start screen; it shows "Premium voices on."
Each line is paid for once, ever. Lines are cached three deep: in the streaming browser (Cache
Storage, survives reloads and site updates, so a repeated line makes no network call at all), then in
the Blob store (shared by every PC), and only a line never heard before goes to ElevenLabs. In the
marathon the six scripted episodes cost credits on the first loop only; new Claude-written live
lines are always new, so they always cost credits. Changing a voice id or the model resets the cache.
Check in the browser console: `voiceStats` → { browser, server, paid }. If ElevenLabs fails, that line falls back to the browser voice. Force browser voices with
/studio?voice=browser. Check the voices' licence allows commercial broadcast.
