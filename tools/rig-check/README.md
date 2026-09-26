# Rig check: are the presenters moving like people?

Plays Episode 1 of `/studio` on a virtual clock, with nothing drawn, so it runs faster than real time.
On every frame it measures the joints a human body is limited to, and compares them with the
normal adult range of motion (AAOS; Norkin & White):

| Joint | Comfortable while talking | Normal maximum |
|---|---:|---:|
| Trunk bent forward | 18° | 45° |
| Head turned against the chest | 50° | 80° |
| Head tilted up / bent down against the chest | 20° / 30° | 60° / 50° |
| Head tilted sideways | 12° | 45° |
| Wrist bent toward the palm / back | 50° / 45° | 80° / 70° |
| Wrist bent toward the thumb / the little finger | 15° / 25° | 20° / 35° |
| Forearm turned palm-down / palm-up (from thumb-up) | 75° / 75° | 90° / 90° |

It **fails (exit code 1)** if any frame goes past a normal maximum. Run it after changing
`studio-kit/hosts.js`, before the change goes on air.

```
cd tools/studio-render && npm install     # once: the check borrows this folder's Playwright
cd ../rig-check
node rig-check.mjs                                     # the current hosts.js, 60 s
node rig-check.mjs --code old-hosts.js --out old.json  # another version
node rig-check.mjs --compare old.json rig.json         # the two side by side
node rig-check.mjs --shots 12.5,42                     # also save stills at those seconds
```
On Windows add `--browser msedge`. A run takes about half a minute.

The show's random choices (camera cuts, reactions) and the presenters' random choices come from two
fixed streams, so two versions of `hosts.js` are compared on exactly the same show.
