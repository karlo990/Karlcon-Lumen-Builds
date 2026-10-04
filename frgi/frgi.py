#!/usr/bin/env python3
"""frgi - curate Zimbabwe wildlife-experience videos from Pinterest for Instagram.

Pipeline:  grabber.js capture -> ingest -> rank / next -> rights -> fetch|attach
           -> KCERMEDIA_<n> caption JSON + description -> pack (zip) -> apply -> publish

Standard library only. See README.md for the workflow and RESEARCH.md for why.
"""
import argparse, datetime as dt, hashlib, html, json, os, random, re, sys, time
import urllib.parse, urllib.request, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
HOME = Path(os.environ.get("FRGI_HOME", "frgi-work")).resolve()
PREFIX = os.environ.get("FRGI_PREFIX", "KCERMEDIA")
FIRST_NUMBER = 101
CLEARED = {"own", "permission", "licensed"}
RIGHTS = CLEARED | {"pending", "requested", "declined"}
UA = "frgi/1.0 (+single user-requested file; contact via Instagram)"
IG_CAPTION_MAX, IG_HASHTAG_MAX = 2200, 30


# ---------- storage ----------

def now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

def load_ledger():
    p = HOME / "ledger.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"prefix": PREFIX, "next_number": FIRST_NUMBER, "pins": {}, "edges": {}, "pages": []}

def save_ledger(L):
    HOME.mkdir(parents=True, exist_ok=True)
    tmp = HOME / "ledger.json.tmp"
    tmp.write_text(json.dumps(L, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(HOME / "ledger.json")

def gazetteer():
    return json.loads((HERE / "zimbabwe_keywords.json").read_text(encoding="utf-8"))


# ---------- relevance (keyword scoring) ----------

def _norm(s):
    s = html.unescape(s or "").lower()
    return " " + re.sub(r"[^a-z0-9'\-]+", " ", s) + " "

def _has(text, alias):
    return (" " + re.sub(r"[^a-z0-9'\-]+", " ", alias.lower()).strip() + " ") in text

def score_text(raw, G=None):
    """Zimbabwe relevance: place/species/experience matches minus off-country penalty."""
    G = G or gazetteer()
    t = _norm(raw)
    hit = lambda group: [e for e in G[group] if any(_has(t, a) for a in e["aliases"])]
    places, species, exps = hit("places"), hit("species"), hit("experiences")
    country = any(_has(t, a) for a in G["country"]["aliases"])
    other = [a for a in G["other_countries"]["aliases"] if _has(t, a)]
    s = sum(e["weight"] for e in places) + sum(e["weight"] for e in species) + sum(e["weight"] for e in exps)
    s += G["country"]["weight"] if country else 0
    zim = bool(places) or country
    if other and not zim:
        s -= G["other_countries"]["penalty"]
    return {
        "score": s, "zimbabwe": zim, "off_target": other if (other and not zim) else [],
        "places": [e["name"] for e in places], "species": [e["name"] for e in species],
        "experiences": [e["name"] for e in exps],
    }

def pin_text(p):
    d = p.get("detail") or {}
    parts = [p.get("title"), p.get("alt"), p.get("card_text"), p.get("description"), p.get("note"),
             d.get("description"), d.get("auto_alt_text"), d.get("closeup_unified_description"),
             d.get("grid_title"), d.get("seo_title"), d.get("og_title")]
    for ld in d.get("ld", []):
        parts += [ld.get("name"), ld.get("headline"), ld.get("description"), ld.get("articleBody")]
    # search queries stay metadata: every pin on a results page shares them, so they say nothing about the pin
    return " | ".join(x for x in parts if x)

def rescore(p, G):
    r = score_text(pin_text(p), G)
    r["score"] += 2 if p.get("is_video") else -3
    p["relevance"] = r
    return r


# ---------- ingest grabber captures ----------

def _detail_fields(d):
    out = {"mp4": sorted(set(d.get("mp4", [])), key=_mp4_width, reverse=True), "vtt": d.get("vtt", [])}
    for ld in d.get("ld", []):
        if ld.get("@type") == "VideoObject":
            out.update(is_video=True, upload_date=ld.get("uploadDate"), duration_iso=ld.get("duration"),
                       thumbnail=ld.get("thumbnailUrl"))
        if (ld.get("headline") or ld.get("name")) and "title" not in out:
            out["title"] = ld.get("headline") or ld.get("name")
        a = ld.get("author") or {}
        if a.get("name"):
            out["creator"] = {"name": a.get("name"), "url": a.get("url")}
    return out

def _mp4_width(u):
    m = re.search(r"_(\d+)w\.mp4", u)
    return int(m.group(1)) if m else 0

def cmd_ingest(a):
    L, G = load_ledger(), gazetteer()
    added = updated = 0
    for f in a.files:
        cap = json.loads(Path(f).read_text(encoding="utf-8"))
        if cap.get("tool") != "frgi-grabber":
            sys.exit(f"{f}: not a frgi-grabber export")
        pages = {pg["url"]: pg for pg in cap.get("pages", [])}
        L["pages"].extend(pg for pg in pages.values() if pg not in L["pages"])
        for c in cap.get("pins", []):
            p = L["pins"].get(c["id"])
            if p is None:
                p = L["pins"][c["id"]] = {"id": c["id"], "first_seen": now(), "rights": {"status": "pending"},
                                          "queries": [], "opened": False}
                added += 1
            else:
                updated += 1
            for k in ("url", "title", "alt", "img", "card_text", "duration", "creator_path"):
                if c.get(k) and not p.get(k):
                    p[k] = c[k]
            p["is_video"] = p.get("is_video") or c.get("is_video", False)
            for u in c.get("seen_on", []):
                pg = pages.get(u, {})
                if pg.get("query") and pg["query"] not in p["queries"]:
                    p["queries"].append(pg["query"])
                if pg.get("landed_pin"):
                    L["edges"].setdefault(pg["landed_pin"], [])
                    if c["id"] not in L["edges"][pg["landed_pin"]]:
                        L["edges"][pg["landed_pin"]].append(c["id"])
        for pid, d in (cap.get("details") or {}).items():
            p = L["pins"].setdefault(pid, {"id": pid, "first_seen": now(), "rights": {"status": "pending"},
                                           "queries": [], "url": f"https://www.pinterest.com/pin/{pid}/"})
            p["detail"], p["opened"] = d, True
            p.update({k: v for k, v in _detail_fields(d).items() if v})
    for p in L["pins"].values():
        rescore(p, G)
    save_ledger(L)
    print(f"ingested: {added} new pins, {updated} updated; {len(L['pins'])} total, {len(L['edges'])} landed pins with leads")

def cmd_add(a):
    """Register pin URLs by hand (e.g. from the share button). Uses Pinterest's public oEmbed API."""
    L, G = load_ledger(), gazetteer()
    for u in a.urls:
        m = re.search(r"/pin/(\d{6,25})", u)
        if not m:
            print(f"skip (not a pin URL): {u}"); continue
        pid = m.group(1)
        p = L["pins"].setdefault(pid, {"id": pid, "first_seen": now(), "rights": {"status": "pending"},
                                       "queries": [], "url": f"https://www.pinterest.com/pin/{pid}/", "opened": False})
        if a.note:
            p["note"] = a.note
        if not a.offline:
            try:
                q = urllib.parse.urlencode({"url": p["url"]})
                with urllib.request.urlopen(urllib.request.Request(
                        f"https://www.pinterest.com/oembed.json?{q}", headers={"User-Agent": UA}), timeout=20) as r:
                    o = json.load(r)
                p["title"] = p.get("title") or o.get("title")
                p["creator"] = p.get("creator") or {"name": o.get("author_name"), "url": o.get("author_url")}
            except Exception as e:
                print(f"  oEmbed failed for {pid}: {e}")
        r = rescore(p, G)
        print(f"{pid}  score {r['score']:>3}  {p.get('title') or ''}  {('OFF-TARGET ' + ','.join(r['off_target'])) if r['off_target'] else ''}")
    save_ledger(L)


# ---------- ranking & lead-following (Pixie-style random walk) ----------

def pixie_walk(L, steps=20000, alpha=0.5, seed=7):
    """Random walk with restart over the lead graph you built by browsing.

    Edges: landed pin -> pins Pinterest showed next to it. Restarts are drawn
    from relevant opened pins, and each hop is biased toward relevant neighbours
    (Pixie's biased walk, Eksombatchai et al. 2018). Visit counts rank the
    unopened pins worth opening next."""
    rnd = random.Random(seed)
    pins, E = L["pins"], L["edges"]
    rel = lambda pid: max(0.0, pins.get(pid, {}).get("relevance", {}).get("score", 0)) + 0.1
    seeds = [pid for pid in E if pid in pins and pins[pid].get("relevance", {}).get("zimbabwe")] or list(E)
    if not seeds:
        return {}
    sw = [rel(s) for s in seeds]
    visits, cur = {}, rnd.choices(seeds, sw)[0]
    for _ in range(steps):
        nb = E.get(cur)
        if not nb or rnd.random() < alpha:
            cur = rnd.choices(seeds, sw)[0]
            continue
        cur = rnd.choices(nb, [rel(n) ** 2 for n in nb])[0]
        visits[cur] = visits.get(cur, 0) + 1
    return visits

def ranked(L):
    v = pixie_walk(L)
    vmax = max(v.values(), default=1)
    rows = []
    for p in L["pins"].values():
        r = p.get("relevance") or {}
        lead = v.get(p["id"], 0) / vmax
        rows.append((r.get("score", 0) + 6 * lead, lead, p))
    rows.sort(key=lambda x: -x[0])
    return rows

def cmd_rank(a):
    L = load_ledger()
    shown = 0
    for total, lead, p in ranked(L):
        r = p.get("relevance", {})
        if r.get("off_target") and not a.all:
            continue
        if a.video and not p.get("is_video"):
            continue
        tag = p.get("number") or p["rights"]["status"]
        where = ", ".join(r.get("places", [])) or "-"
        what = ", ".join(r.get("species", []) + r.get("experiences", [])) or "-"
        print(f"{total:6.1f}  {p['id']:<20} {tag:<14} {'V' if p.get('is_video') else ' '} {p.get('duration') or '':>5}  {where} | {what} | {(p.get('title') or p.get('alt') or '')[:60]}")
        shown += 1
        if shown >= a.n:
            break

def cmd_next(a):
    """Which unopened pins to open next in your browser: these are the leads."""
    L = load_ledger()
    rows = [x for x in ranked(L) if not x[2].get("opened") and x[2].get("is_video")
            and not x[2].get("relevance", {}).get("off_target")]
    for total, lead, p in rows[: a.n]:
        print(f"{total:6.1f}  lead {lead:.2f}  {p['url']}  {(p.get('title') or p.get('alt') or '')[:70]}")
    if not rows:
        print("no leads yet: open a few Zimbabwe video pins with the grabber recording, then ingest again")

def cmd_keywords(a):
    """Pinterest search URLs built from the gazetteer, for you to open with the grabber running."""
    G = gazetteer()
    qs = []
    for pl in G["places"]:
        base = pl["name"].replace(" National Park", "")
        qs += [f"{base} zimbabwe safari video", f"{base} game drive"]
    for sp in G["species"][:8]:
        qs.append(f"{sp['name']} zimbabwe safari")
    for ex in G["experiences"][:5]:
        qs.append(f"{ex['name']} zimbabwe")
    for q in qs[: a.n]:
        print(f"https://www.pinterest.com/search/videos/?q={urllib.parse.quote(q)}")


# ---------- rights ----------

def _pin(L, ref):
    if ref in L["pins"]:
        return L["pins"][ref]
    for p in L["pins"].values():
        if p.get("number") == ref:
            return p
    sys.exit(f"unknown pin or number: {ref}")

def cmd_rights(a):
    if a.status not in RIGHTS:
        sys.exit(f"status must be one of {sorted(RIGHTS)}")
    if a.status in CLEARED and not a.note:
        sys.exit("record who granted it and where (e.g. --note 'DM from @creator 2026-10-04, credit required')")
    L = load_ledger()
    p = _pin(L, a.ref)
    p["rights"] = {"status": a.status, "note": a.note, "updated": now(),
                   "history": (p.get("rights", {}).get("history", []) + [{k: v for k, v in p.get("rights", {}).items() if k != "history"}])}
    save_ledger(L)
    print(f"{p['id']}: rights -> {a.status}")

def cmd_ask(a):
    L = load_ledger()
    p = _pin(L, a.ref)
    who = (p.get("creator") or {}).get("name") or "there"
    place = ", ".join(p.get("relevance", {}).get("places", [])) or "Zimbabwe"
    print(f"""Hi {who}, your video ({p.get('url')}) from {place} is beautiful.
We run KCER Media, an Instagram page showcasing wildlife experiences in Zimbabwe.
May we repost it as a Reel with full credit to you (name + link in the caption)?
If yes, could you send the original file, and tell us how you'd like to be credited?
Thank you!""")
    if p["rights"]["status"] == "pending":
        p["rights"] = {"status": "requested", "note": "permission request drafted", "updated": now(),
                       "history": [dict(p["rights"])]}
        save_ledger(L)


# ---------- numbering, captions, descriptions ----------

def assign_number(L, p):
    if not p.get("number"):
        p["number"] = f"{L.get('prefix', PREFIX)}_{L['next_number']}"
        L["next_number"] += 1
    return p["number"]

def caption_for(p, G):
    r = p.get("relevance") or score_text(pin_text(p), G)
    by = lambda grp, names: [e for e in G[grp] if e["name"] in names]
    places, species, exps = by("places", r["places"]), by("species", r["species"]), by("experiences", r["experiences"])
    place = places[0]["name"] if places else "Zimbabwe"
    phrase = exps[0]["phrase"] if exps else "on safari"
    subject = species[0]["name"].capitalize() if species else "Wildlife"
    hook = f"{subject} {phrase} in {place}"
    tags = []
    for t in G["base_hashtags"] + [e["hashtag"] for e in places[:2] + species[:2] + exps[:1]]:
        if t not in tags:
            tags.append(t)
    tags = tags[:IG_HASHTAG_MAX]
    creator = p.get("creator") or {}
    credit = f"Video: {creator.get('name') or '[creator]'}" + (f" ({creator['url']})" if creator.get("url") else "")
    body = (f"{place}, Zimbabwe. Tell us in the comments: which sighting would you wake up at dawn for?"
            if places else "Zimbabwe. Tell us in the comments: which sighting would you wake up at dawn for?")
    cta = "Save this for your Zimbabwe safari list and share it with your travel partner."
    full = "\n\n".join([hook, body, credit + " - shared with permission.", cta, " ".join("#" + t for t in tags)])
    return {
        "hook": hook, "body": body, "credit": credit, "cta": cta, "hashtags": tags,
        "full_text": full[:IG_CAPTION_MAX], "chars": len(full),
        "alt_text": f"{hook}. " + (p.get("alt") or (p.get("detail") or {}).get("auto_alt_text") or ""),
        "location_tag": place if places else None,
    }

def write_media_record(L, p, G, file_path=None, source=None):
    num = assign_number(L, p)
    rec = {
        "id": num, "pin_id": p["id"], "source_pin": p.get("url"), "creator": p.get("creator"),
        "creator_path": p.get("creator_path"), "rights": {k: v for k, v in p["rights"].items() if k != "history"},
        "location": {"places": p["relevance"]["places"], "country": "Zimbabwe" if p["relevance"]["zimbabwe"] else None},
        "species": p["relevance"]["species"], "experiences": p["relevance"]["experiences"],
        "relevance_score": p["relevance"]["score"],
        "original": {"title": p.get("title"), "description": (p.get("detail") or {}).get("description"),
                     "alt": p.get("alt") or (p.get("detail") or {}).get("auto_alt_text"),
                     "duration": p.get("duration"), "upload_date": p.get("upload_date")},
        "caption_draft": caption_for(p, G),
        "caption_final": None,
        "instagram": {"media_type": "REELS", "status": "draft", "media_id": None},
        "file": None, "created": now(), "needs_review": True,
    }
    if file_path:
        b = Path(file_path).read_bytes()
        rec["file"] = {"path": os.path.relpath(file_path, HOME), "bytes": len(b),
                       "sha256": hashlib.sha256(b).hexdigest(), "source": source}
    old = HOME / "captions" / f"{num}.json"
    if old.exists():
        prev = json.loads(old.read_text(encoding="utf-8"))
        rec["caption_final"], rec["instagram"] = prev.get("caption_final"), prev.get("instagram", rec["instagram"])
    (HOME / "captions").mkdir(parents=True, exist_ok=True)
    (HOME / "descriptions").mkdir(parents=True, exist_ok=True)
    old.write_text(json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8")
    o = rec["original"]
    desc = "\n".join([
        f"{num}", f"Pin: {rec['source_pin']}",
        f"Creator: {(rec['creator'] or {}).get('name') or rec.get('creator_path') or 'unknown'}  {(rec['creator'] or {}).get('url') or ''}",
        f"Rights: {rec['rights'].get('status')} - {rec['rights'].get('note') or ''}",
        f"Where: {', '.join(rec['location']['places']) or 'unknown'}",
        f"What: {', '.join(rec['species'] + rec['experiences']) or 'unknown'}",
        f"Original title: {o['title'] or ''}", f"Original description: {o['description'] or ''}",
        f"Alt text: {o['alt'] or ''}", f"Duration: {o['duration'] or ''}  Uploaded: {o['upload_date'] or ''}",
        f"File: {(rec['file'] or {}).get('path') or 'not downloaded'}",
    ])
    (HOME / "descriptions" / f"{num}.txt").write_text(desc + "\n", encoding="utf-8")
    index = HOME / "descriptions" / "descriptions.jsonl"
    rows = [json.loads(x) for x in index.read_text(encoding="utf-8").splitlines()] if index.exists() else []
    rows = [x for x in rows if x["id"] != num] + [{"id": num, "pin": rec["source_pin"], "text": desc}]
    rows.sort(key=lambda x: int(x["id"].rsplit("_", 1)[1]))
    index.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in rows), encoding="utf-8")
    p["caption_file"] = os.path.relpath(old, HOME)
    return num

def _cleared(p):
    if p["rights"]["status"] not in CLEARED:
        print(f"  {p['id']}: rights '{p['rights']['status']}' - not cleared. Ask the creator (`frgi ask {p['id']}`), "
              f"then record their yes: frgi rights {p['id']} permission --note '...'")
        return False
    return True

def cmd_fetch(a):
    """Download the video file for rights-cleared pins, one user-chosen file each."""
    L, G = load_ledger(), gazetteer()
    targets = [_pin(L, r) for r in a.refs] if a.refs else \
        [p for p in L["pins"].values() if p["rights"]["status"] in CLEARED and not p.get("file_done")]
    if not targets:
        print("nothing cleared to fetch. Record permission with: frgi rights <pin> permission --note '...'")
    for p in targets:
        if not _cleared(p):
            continue
        mp4 = (p.get("mp4") or [None])[0]
        if not mp4:
            print(f"  {p['id']}: no MP4 link yet - open the pin with the grabber running, export, ingest"); continue
        if a.dry_run:
            print(f"  would download {mp4} -> {PREFIX}_<next>.mp4"); continue
        num = assign_number(L, p)
        dest = HOME / "media" / f"{num}.mp4"
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(mp4, headers={"User-Agent": UA, "Referer": "https://www.pinterest.com/"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
            while chunk := r.read(1 << 16):
                f.write(chunk)
        p["file_done"] = True
        write_media_record(L, p, G, dest, source=mp4)
        save_ledger(L)
        print(f"  {num}  <- {p['id']}  {dest.stat().st_size // 1024} KB")
        time.sleep(2)

def cmd_attach(a):
    """Register the original file a creator sent you (better quality than Pinterest's re-encode)."""
    L, G = load_ledger(), gazetteer()
    p = _pin(L, a.ref)
    if not _cleared(p):
        return
    num = assign_number(L, p)
    dest = HOME / "media" / f"{num}{Path(a.file).suffix.lower() or '.mp4'}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(Path(a.file).read_bytes())
    p["file_done"] = True
    write_media_record(L, p, G, dest, source="creator original")
    save_ledger(L)
    print(f"{num}  <- {a.file}")

def cmd_draft(a):
    """Caption drafts for top unnumbered candidates (no number, no download) - for review before asking."""
    L, G = load_ledger(), gazetteer()
    out = []
    for total, lead, p in ranked(L):
        r = p.get("relevance", {})
        if r.get("off_target") or not r.get("zimbabwe") or not p.get("is_video"):
            continue
        out.append({"pin_id": p["id"], "url": p.get("url"), "rank_score": round(total, 2),
                    "rights": p["rights"]["status"], "creator": p.get("creator"),
                    "places": r["places"], "species": r["species"], "experiences": r["experiences"],
                    "caption_draft": caption_for(p, G)})
        if len(out) >= a.n:
            break
    HOME.mkdir(parents=True, exist_ok=True)
    (HOME / "candidates.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(out)} candidates to {HOME / 'candidates.json'}")


# ---------- zip out, corrected captions back in ----------

def cmd_pack(a):
    L = load_ledger()
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    out = Path(a.out or f"{PREFIX}_captions_{stamp}.zip").resolve()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for sub in ("captions", "descriptions"):
            for f in sorted((HOME / sub).glob("*")) if (HOME / sub).exists() else []:
                z.write(f, f"{sub}/{f.name}")
        if (HOME / "candidates.json").exists():
            z.write(HOME / "candidates.json", "candidates.json")
        if a.with_media and (HOME / "media").exists():
            for f in sorted((HOME / "media").glob("*")):
                z.write(f, f"media/{f.name}")
        z.writestr("manifest.json", json.dumps({
            "tool": "frgi", "packed": now(), "prefix": L.get("prefix", PREFIX), "next_number": L["next_number"],
            "numbered": sorted((p["number"] for p in L["pins"].values() if p.get("number")),
                               key=lambda s: int(s.rsplit("_", 1)[1])),
            "how_to_correct": "Edit caption_final in captions/<ID>.json (same shape as caption_draft), zip, then: frgi apply <zip>",
        }, indent=2))
    print(out)

def cmd_apply(a):
    """Merge corrected captions (caption_final) from a returned zip or folder."""
    files = {}
    src = Path(a.source)
    if src.suffix == ".zip":
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if re.search(r"captions/[^/]+\.json$", n):
                    files[Path(n).name] = json.loads(z.read(n))
    else:
        files = {f.name: json.loads(f.read_text(encoding="utf-8")) for f in src.glob("*.json")}
    n = 0
    for name, rec in files.items():
        dest = HOME / "captions" / name
        if not dest.exists() or not rec.get("caption_final"):
            continue
        cur = json.loads(dest.read_text(encoding="utf-8"))
        cf = rec["caption_final"]
        if isinstance(cf, dict) and "full_text" in cf and len(cf["full_text"]) > IG_CAPTION_MAX:
            print(f"  {name}: caption is {len(cf['full_text'])} chars (> {IG_CAPTION_MAX}), skipped"); continue
        cur["caption_final"], cur["needs_review"] = cf, False
        dest.write_text(json.dumps(cur, indent=2, ensure_ascii=False), encoding="utf-8")
        n += 1
    print(f"applied {n} corrected captions")


# ---------- Instagram (Graph API, Reels) ----------

def _graph(method, path, params):
    ver = os.environ.get("FRGI_GRAPH_VERSION", "").strip("/")
    url = f"https://graph.facebook.com/{ver + '/' if ver else ''}{path}"
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url + ("" if method == "POST" else "?" + data.decode()),
                                 data=data if method == "POST" else None, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def cmd_publish(a):
    """Publish a numbered item as a Reel. Needs an Instagram professional account,
    IG_USER_ID and IG_ACCESS_TOKEN, and the video at a public HTTPS URL."""
    L = load_ledger()
    p = _pin(L, a.ref)
    if not p.get("number") or not _cleared(p):
        sys.exit("only numbered, rights-cleared items can be published")
    capf = HOME / "captions" / f"{p['number']}.json"
    rec = json.loads(capf.read_text(encoding="utf-8"))
    cap = rec.get("caption_final") or rec["caption_draft"]
    if rec.get("needs_review") and not a.force_draft:
        sys.exit("caption not reviewed yet: correct it, `frgi apply`, or pass --force-draft")
    text = cap["full_text"] if isinstance(cap, dict) else str(cap)
    params = {"media_type": "REELS", "video_url": a.video_url, "caption": text, "share_to_feed": "true"}
    if not a.go:
        print(json.dumps({"dry_run": True, "POST": "/{IG_USER_ID}/media", **params}, indent=2, ensure_ascii=False))
        print("add --go to publish")
        return
    uid, tok = os.environ.get("IG_USER_ID"), os.environ.get("IG_ACCESS_TOKEN")
    if not (uid and tok):
        sys.exit("set IG_USER_ID and IG_ACCESS_TOKEN")
    c = _graph("POST", f"{uid}/media", {**params, "access_token": tok})["id"]
    for _ in range(60):
        st = _graph("GET", c, {"fields": "status_code", "access_token": tok}).get("status_code")
        if st == "FINISHED":
            break
        if st in ("ERROR", "EXPIRED"):
            sys.exit(f"container {c}: {st}")
        time.sleep(10)
    mid = _graph("POST", f"{uid}/media_publish", {"creation_id": c, "access_token": tok})["id"]
    rec["instagram"] = {"media_type": "REELS", "status": "published", "media_id": mid, "published": now()}
    capf.write_text(json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{p['number']} published: media id {mid}")


def cmd_bookmarklet(a):
    src = (HERE / "grabber.js").read_text(encoding="utf-8")
    print("javascript:" + urllib.parse.quote(src, safe="(){};,=!+*'/:.[]|&?<>"))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="frgi", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("bookmarklet", help="print the grabber bookmarklet URL"); s.set_defaults(f=cmd_bookmarklet)
    s = sp.add_parser("keywords", help="Zimbabwe search URLs to open with the grabber running")
    s.add_argument("-n", type=int, default=40); s.set_defaults(f=cmd_keywords)
    s = sp.add_parser("ingest", help="load grabber exports"); s.add_argument("files", nargs="+"); s.set_defaults(f=cmd_ingest)
    s = sp.add_parser("add", help="add pin URLs by hand"); s.add_argument("urls", nargs="+")
    s.add_argument("--note"); s.add_argument("--offline", action="store_true"); s.set_defaults(f=cmd_add)
    s = sp.add_parser("rank", help="ranked candidates"); s.add_argument("-n", type=int, default=30)
    s.add_argument("--all", action="store_true", help="include off-target (non-Zimbabwe) pins")
    s.add_argument("--video", action="store_true"); s.set_defaults(f=cmd_rank)
    s = sp.add_parser("next", help="leads: unopened pins to open next"); s.add_argument("-n", type=int, default=10); s.set_defaults(f=cmd_next)
    s = sp.add_parser("ask", help="draft a permission request to the creator"); s.add_argument("ref"); s.set_defaults(f=cmd_ask)
    s = sp.add_parser("rights", help="record rights status"); s.add_argument("ref"); s.add_argument("status")
    s.add_argument("--note"); s.set_defaults(f=cmd_rights)
    s = sp.add_parser("fetch", help="download cleared videos as KCERMEDIA_<n>.mp4"); s.add_argument("refs", nargs="*")
    s.add_argument("--dry-run", action="store_true"); s.set_defaults(f=cmd_fetch)
    s = sp.add_parser("attach", help="register a creator-supplied file"); s.add_argument("ref"); s.add_argument("file"); s.set_defaults(f=cmd_attach)
    s = sp.add_parser("draft", help="caption drafts for top candidates -> candidates.json"); s.add_argument("-n", type=int, default=20); s.set_defaults(f=cmd_draft)
    s = sp.add_parser("pack", help="zip captions + descriptions"); s.add_argument("--out")
    s.add_argument("--with-media", action="store_true"); s.set_defaults(f=cmd_pack)
    s = sp.add_parser("apply", help="merge corrected captions from a zip/folder"); s.add_argument("source"); s.set_defaults(f=cmd_apply)
    s = sp.add_parser("publish", help="publish a Reel via the Instagram Graph API"); s.add_argument("ref")
    s.add_argument("--video-url", required=True); s.add_argument("--go", action="store_true")
    s.add_argument("--force-draft", action="store_true"); s.set_defaults(f=cmd_publish)
    a = ap.parse_args(argv)
    a.f(a)

if __name__ == "__main__":
    main()
