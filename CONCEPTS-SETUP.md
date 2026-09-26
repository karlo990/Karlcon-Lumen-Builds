# KARLCON Lumen Builds — Concept Channel + Developer page

## Addresses after deploying
    /              the concept app (Watch, Explore, Planner, Saved, Talk to Karl)
    /developer     3D model generation (also /developers and /dev)
    /?admin        the Studio panel for adding concepts by hand
    /hologram      your BIM hologram viewer
    /pipeline      your BIM pipeline

## Settings you can change in concepts.html (search for "const TALK")
    whatsapp: ''            add your number, e.g. '2637XXXXXXXX', for a WhatsApp button with the context pre-filled
    afterMs: 60000          Talk to Karl pops up after 60 s of real use, once a day per visitor
    autoRedirectSeconds: 0  0 = never sends anyone off the page by itself

## Files (everything in this zip goes at the ROOT of the karlcon-lumen-builds project)
    concepts.html          public concept library (new front page "/")
    developer.html         model generation page ("/developer")
    concepts-data.js       the built-in catalogue, shared by both pages — edit concepts here
    img/concepts/*.webp    card thumbnails (full studio scene)
    img/meshy/*.png        cropped buildings sent to Meshy
    api/concepts.js        the library's memory (read / save / hide / delete)
    api/model-import.js    streams a finished Meshy model (any size) into Blob for optimising
    api/blob-upload.js     upload tokens for images and GLBs
    vendor/glb-optimizer.js  in-browser model optimiser used by /developer and the Studio
                           (built from tools/glb-optimizer — see "Rebuilding the optimiser")
    api/_lib.js            shared helpers (not a route)
    package.json           adds @vercel/blob; "type": "module" matches meshy-proxy.js
    vercel.json            REPLACES the old one

The hologram, pipeline and api/meshy-proxy.js are included, so everything runs from one project
and the Meshy key saved on /hologram is shared with /developer.

## One-time setup in Vercel
1. Storage → Create → Blob → connect it to this project (adds BLOB_READ_WRITE_TOKEN).
2. Settings → Environment Variables → ADMIN_KEY = a long random value. Keep it private.
3. Redeploy.

## Generating the 3D models (once)
1. Open https://karl-con-bim.vercel.app/developer
2. Paste the Meshy API key (it reuses the key saved by /hologram if you already entered one there)
   and the ADMIN_KEY.
3. Press "Generate all missing". Models run two at a time, usually a couple of minutes each.
4. Each finished model is copied into your Blob store. From then on every visitor loads that
   stored copy — Meshy is never called again for that concept.

If you close the tab mid-generation, reopen /developer: unfinished tasks resume by themselves.
"Regenerate" asks for confirmation because it spends credits again.

## Model size and quality
Meshy's files are mostly texture data (2048 px PNGs), and "High detail" returns Meshy's raw,
un-remeshed mesh on top — often 60–200 MB, which used to fail with "larger than 60 MB".
Now every model is optimised in your browser before it is stored:
    Web          Meshy remesh to 30k triangles     → about 1–2 MB
    High detail  Meshy's full mesh, ≤600k triangles → about 5–10 MB
(geometry is meshopt-compressed, textures become JPEG; 2048 px colour is kept.)
The server only streams Meshy's file into Blob; the browser downloads, shrinks and uploads it,
then the raw copy is deleted. Models stored before this change show "not optimised yet" —
press "Optimise stored models" once on /developer (no Meshy credits are spent).
Replaced models, thumbnails and input images are deleted from the store automatically.

## The skylight on each model
Meshy rebuilds a building from one picture, so thin glass leaves come back missing (the tower's
input image even cropped its skylight off), melted into the roof, or as stray panels. The viewer
therefore mounts the engineered KARLCON skylight on every generated model: it finds the roof,
seats the kerb on it, cuts the roof open underneath (removing Meshy's melted version), adds a
lit light-well, and "Open roof" drives the real mechanism.
- Placement is automatic for new models. The six current models have hand-tuned placements in
  concepts-data.js (skylight: {...}).
- To adjust one: /developer → "Skylight" (or /?admin#concept=<id>), enter the admin key in the
  Studio panel, drag Across / Along / Size / Length / Turn / Raise, then "Save for everyone".
- Regenerating a model resets its placement to automatic.
- AR (View on your site) shows the Meshy model on its own for now.

## Rebuilding the optimiser (only if you change tools/glb-optimizer/optimizer.js)
    cd tools/glb-optimizer && npm install && npm run build
This rewrites vendor/glb-optimizer.js. tools/ is not deployed (.vercelignore).

## Better models: give Meshy 2–4 views of the same building
One picture makes Meshy guess the roof and the back — that is where skylights get lost. On
/developer, under each input image:
- **2×2** — upload a view sheet (front · side / back · roof, one building, same design in every panel):
  it is cut into four views automatically.
- **+** — add another angle (up to 4 in total). Click a small view to remove it.
With 2–4 views, Generate / Regenerate uses Meshy's multi-image to 3D (High detail also asks for its
finer "2k" geometry). The first image is the front. Use JPG or PNG (WebP is converted), plain
background, no people, the whole building in frame.

## Better models (single image)
Three inputs are tight crops rather than clean cut-outs, because the studio background could not
be separated automatically: Elevated Glass Cube, Matobo Boulder House, Terraced Hillside.
For better results, render those buildings again on a plain background with no people in front,
then click the input image on /developer to replace it and press Regenerate.

## Everyday editing
- Text, specs and channels for built-in concepts: edit concepts-data.js, redeploy,
  then press "Sync built-in concepts" on /developer.
- New concepts: open /?admin (the Studio panel).
- Built-in concepts are hidden rather than deleted, so they do not reappear from the catalogue.

## Notes
- The old vercel.json combined "routes" with "headers", which Vercel rejects. It now uses "rewrites".
  "/" opens the concept library; /hologram and /pipeline are unchanged.
- Before the Blob store is connected the public page still works, showing the built-in concepts.
- Share one concept with its own link: /#concept=<id> (the Share button copies it).
