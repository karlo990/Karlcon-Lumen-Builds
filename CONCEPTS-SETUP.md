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
    api/blob-upload.js     upload tokens for images and GLBs
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

## Better models
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
