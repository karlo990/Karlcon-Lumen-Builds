# KARLCON Studio — live presenter page

## Address after deploying
    /studio              the studio (two presenters, the building, the Atlas globe)
    /studio?format=vertical   9:16 frame for Instagram Live
    /studio?obs          clean feed: no dock, no cursor (keyboard still works)

## Files (all at the ROOT of the karlcon-lumen-builds project)
    studio.html              the page: director, voices, captions, on-air graphics
    studio-kit/hosts.js      the presenters: seated pose, IK arms/legs, eyes, blinks, gestures, lip-sync
    studio-kit/set.js        the set: blueprint wall, KARLCON SYSTEM desk, Glass Cube, Atlas globe, story screen
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
