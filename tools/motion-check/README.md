# Motion check

Plays the motion test sequence (`/studio?season=3&test=motion`, `studio-kit/episodes-test.js`) on a virtual
clock and measures, frame by frame, how human the presenters' movement is:

| measure | what it catches |
|---|---|
| foot slide (m, m/s) | a foot moving while it is planted (3+ frames within 1 cm of the floor) |
| joint pops | a joint's angular speed jumping by more than 600°/s between two frames: a visible snap |
| joint angular accel p99 / worst | how hard the joints accelerate; the worst joint and when |
| body turn rate / accel | how fast the body turns and how abruptly that speed changes |
| hips speed / accel | how the body (the hips, what is seen) speeds up and slows down |
| turn: chest lags head, hips lag chest | whether a turn travels down the body (head → chest → hips) or the body turns as one block |
| start / stop ramp | how long a walk takes to reach speed and to come to rest |
| idle head / hips sway | a standing host: frozen (0 mm) or fidgeting (> 15 mm) |

```
node motion-check.mjs                                   the current studio-kit/hosts.js → motion.json
node motion-check.mjs --code old-hosts.js --out old.json
node motion-check.mjs --sheet 5,6,7,8 --sheetOut s      stills at those seconds (drawn)
node motion-check.mjs --compare old.json new.json       side-by-side table
```

The sequence can also be recorded as a video: `node ../studio-render/render.mjs --season 3 --test motion`.
