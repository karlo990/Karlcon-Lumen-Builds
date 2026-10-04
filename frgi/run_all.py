#!/usr/bin/env python3
"""frgi all-in-one: one script for the whole Pinterest -> Instagram workflow.

    python run_all.py                 guided menu (start here)
    python run_all.py start           browse, then process (the usual first command)
    python run_all.py keywords        Zimbabwe search keywords (+ clickable keywords.html)
    python run_all.py setup           install Python Playwright + Chromium (asks first)
    python run_all.py browse [--chrome]
                                      open a browser YOU drive; the grabber records as you scroll
    python run_all.py process         ingest captures -> rank -> leads.html -> caption drafts
                                      -> permission messages for the best videos
    python run_all.py permissions     record each creator's yes / no (with a note)
    python run_all.py download        download cleared videos as KCERMEDIA_<n>.mp4
                                      + captions/KCERMEDIA_<n>.json + descriptions/KCERMEDIA_<n>.txt
    python run_all.py package [--with-media]
                                      zip captions + descriptions to upload for caption review
    python run_all.py apply <zip>     load corrected captions back
    python run_all.py publish <KCERMEDIA_n> --video-url <url> [--go]
    python run_all.py bundle          zip the whole toolkit (scripts, docs, tests, skill)
    python run_all.py all             browse -> process -> permissions -> download -> package

Options: --home <dir> (default ./frgi-work), --top <n> candidates to draft/ask (default 15).

frgi never scrolls, clicks or navigates Pinterest for you (Pinterest's robots.txt
disallows bots) and never downloads or publishes without the creator's permission.
"""
import argparse, contextlib, html, io, json, logging, os, subprocess, sys, time, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
START_URL = "https://www.pinterest.com/"


def frgi_module(home):
    os.environ["FRGI_HOME"] = str(home)
    sys.path.insert(0, str(HERE))
    import frgi
    frgi.HOME = Path(home).resolve()
    return frgi


def run(f, *argv):
    """Run a frgi.py subcommand in-process; its sys.exit() messages become printed errors."""
    try:
        f.main([str(a) for a in argv])
        return True
    except SystemExit as e:
        if e.code not in (None, 0):
            print(f"  ! {e.code}")
        return False


def ask(q, default="n"):
    try:
        a = input(f"{q} [{'Y/n' if default == 'y' else 'y/N'}] ").strip().lower()
    except EOFError:
        a = ""
    return (a or default).startswith("y")


def banner(t):
    print(f"\n=== {t} " + "=" * max(0, 60 - len(t)))


# ---------- setup ----------

def cmd_setup(a, f):
    banner("setup")
    try:
        import playwright  # noqa: F401
        print("Python Playwright is installed.")
    except ImportError:
        if not ask("Install Python Playwright with pip now?", "y"):
            return
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    if a.chrome:
        print("Using your installed Google Chrome (--chrome); no browser download needed.")
    elif ask("Download Playwright's Chromium (about 150 MB)? Say no if you will use --chrome.", "y"):
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    print("Setup done.")


# ---------- browse (human-driven) ----------

def init_script():
    # grabber is inlined, not eval'd: Pinterest's Content-Security-Policy blocks eval.
    # Top frame only: the ct.pinterest.com tracking iframe would export an empty capture.
    src = (HERE / "grabber.js").read_text(encoding="utf-8")
    return """(() => {
  if (window.top !== window || !/(^|\\.)pinterest\\.[a-z.]+$/.test(location.hostname)) return;
  window.__frgiDoc = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  window.__frgiSink = s => window.__frgiSave(window.__frgiDoc, s);
  const grab = () => {
%s
  };
  const run = () => { grab(); setInterval(grab, 15000); addEventListener('pagehide', grab); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', run) : run();
})();""" % src


def ensure_playwright():
    """Import Playwright, installing it with pip first if it is missing."""
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        print("  Playwright is not installed; installing it now (pip install playwright)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        import importlib
        importlib.invalidate_caches()
        from playwright.sync_api import sync_playwright
        return sync_playwright


def launch_headed(p, profile, prefer_chrome=False):
    """Open a visible (headed) browser window with a kept profile.

    Order: Playwright's Chromium (installed on first use), then Microsoft Edge
    (always on Windows), then Google Chrome. --chrome tries Chrome first."""
    opts = {"headless": False, "no_viewport": True, "args": ["--start-maximized"]}
    attempts = [("chrome", "Google Chrome")] if prefer_chrome else []
    attempts += [(None, "Playwright Chromium"), ("msedge", "Microsoft Edge"), ("chrome", "Google Chrome")]
    errors = []
    for channel, name in attempts:
        kw = dict(opts, **({"channel": channel} if channel else {}))
        for attempt in (1, 2):
            try:
                ctx = p.chromium.launch_persistent_context(str(profile), **kw)
                print(f"  opened {name} (headed)")
                return ctx
            except Exception as e:
                msg = str(e).splitlines()[0]
                if channel is None and attempt == 1 and "Executable doesn't exist" in str(e):
                    print("  Chromium not downloaded yet; installing it now (playwright install chromium)...")
                    if subprocess.call([sys.executable, "-m", "playwright", "install", "chromium"]) == 0:
                        continue
                errors.append(f"{name}: {msg}")
                break
    sys.exit("could not open a browser:\n  " + "\n  ".join(errors) +
             "\nTry: python -m playwright install chromium   (or install Google Chrome / Microsoft Edge)")


KEYWORD_GROUPS = {
    "Parks and places": [
        "Hwange National Park safari", "Hwange elephants waterhole", "Mana Pools wild dogs", "Mana Pools canoe safari",
        "Mana Pools elephant standing", "Gonarezhou Chilojo Cliffs", "Gonarezhou elephants", "Victoria Falls Zimbabwe",
        "Zambezi National Park lions", "Matobo Hills rhino", "Matusadona Lake Kariba", "Lake Kariba houseboat sunset",
        "Chizarira National Park", "Save Valley Conservancy", "Malilangwe Singita Pamushana", "Nyanga Mutarazi Falls",
        "Chimanimani mountains hike", "Great Zimbabwe ruins",
    ],
    "Animals": [
        "painted dogs Zimbabwe", "elephants Zimbabwe safari", "lions Hwange", "leopard Zimbabwe safari",
        "black rhino Matobo", "buffalo herd Zimbabwe", "giraffe Hwange", "hippo Zambezi river",
        "sable antelope Hwange", "carmine bee-eaters Zambezi",
    ],
    "Experiences": [
        "Zimbabwe game drive video", "Zimbabwe walking safari", "Zambezi canoe safari", "Zambezi sunset cruise",
        "Hwange sleep out hide", "Victoria Falls helicopter flight of angels", "Devil's Pool Victoria Falls",
        "Zimbabwe safari lodge", "Zimbabwe sunrise game drive", "African safari jeep Zimbabwe",
    ],
}


def write_keywords_html(f):
    import urllib.parse
    def link(q):
        u = "https://www.pinterest.com/search/videos/?q=" + urllib.parse.quote(q)
        return f'<a href="{html.escape(u)}" target="_blank" rel="noopener">{html.escape(q)}</a>'
    groups = "".join(f"<h2>{html.escape(g)}</h2><div class='kw'>{''.join(link(q) for q in qs)}</div>"
                     for g, qs in KEYWORD_GROUPS.items())
    page = f"""<!doctype html><html><head><meta charset="utf-8"><title>frgi search keywords</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{{font:15px system-ui,sans-serif;margin:16px;background:#f6f4ef;color:#222}} h1{{font-size:20px}} h2{{font-size:16px;margin-top:24px}}
.kw{{display:flex;flex-wrap:wrap;gap:8px}} .kw a{{background:#fff;border-radius:18px;padding:7px 14px;text-decoration:none;color:#1d4d2b;box-shadow:0 1px 3px #0002}}
.kw a:visited{{color:#888}}
</style></head><body><h1>Zimbabwe wildlife video searches</h1>
<p>Click a search, scroll the results, open the best video pins. Visited searches turn grey.</p>{groups}</body></html>"""
    out = f.HOME / "keywords.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


def cmd_keywords(a, f):
    banner("search keywords")
    for g, qs in KEYWORD_GROUPS.items():
        print(f"\n  {g}:")
        for q in qs:
            print(f"    {q}")
    print(f"\n  clickable page: {write_keywords_html(f)}  (also opens as a tab in Browse)")


def cmd_browse(a, f):
    banner("browse")
    sync_playwright = ensure_playwright()
    out = f.HOME / "captures"
    out.mkdir(parents=True, exist_ok=True)
    saved = {}

    def save(doc, payload):
        (out / f"capture-{doc}.json").write_text(payload, encoding="utf-8")
        saved[doc] = len(json.loads(payload).get("pins", []))
        print(f"\r  recording: {sum(saved.values())} pins across {len(saved)} pages   ", end="", flush=True)

    print("A browser window opens. Log in once (the profile is kept), then search, scroll and open")
    print("Zimbabwe video pins yourself (the keywords tab has ready-made searches).")
    print("When you are done, CLOSE THE BROWSER WINDOW: frgi then ranks everything automatically.")
    interrupted = False
    try:
        with sync_playwright() as p:
            ctx = launch_headed(p, f.HOME / "browser-profile", a.chrome)
            ctx.expose_function("__frgiSave", save)
            ctx.add_init_script(init_script())
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            leads = f.HOME / "leads.html"
            try:
                page.goto(START_URL, wait_until="domcontentloaded")
            except Exception as e:
                print(f"  could not open Pinterest ({str(e).splitlines()[0]}); use the address bar")
            for extra in [write_keywords_html(f)] + ([leads] if leads.exists() else []):
                with contextlib.suppress(Exception):
                    ctx.new_page().goto(extra.as_uri())
            try:
                ctx.wait_for_event("close", timeout=0)
            except KeyboardInterrupt:
                interrupted = True
                with contextlib.suppress(BaseException):
                    ctx.close()
            except Exception:
                pass
    except KeyboardInterrupt:
        interrupted = True
    if interrupted:
        # Ctrl+C leaves Playwright's event loop mid-call; its shutdown noise is harmless
        logging.getLogger("asyncio").setLevel(logging.CRITICAL)
        sys.unraisablehook = lambda *_: None
    print(f"\n  captures saved in {out}")
    if any(out.glob("*.json")):
        cmd_process(a, f)


# ---------- process ----------

def write_leads_html(f, L, top):
    rows = f.ranked(L)
    nxt = [x for x in rows if not x[2].get("opened") and x[2].get("is_video")
           and not x[2].get("relevance", {}).get("off_target")][:top * 2]
    best = [x for x in rows if x[2].get("is_video") and x[2].get("relevance", {}).get("zimbabwe")][:top * 2]

    def card(total, lead, p):
        r = p.get("relevance", {})
        title = html.escape(p.get("title") or p.get("alt") or p["id"])
        img = f'<img src="{html.escape(p["img"])}" alt="">' if p.get("img") else '<div class="noimg"></div>'
        meta = html.escape(" · ".join(r.get("places", []) + r.get("species", []) + r.get("experiences", [])) or "-")
        tag = html.escape(p.get("number") or p["rights"]["status"])
        return (f'<a class="card" href="{html.escape(p["url"])}" target="_blank" rel="noopener">{img}'
                f'<b>{title}</b><span>{meta}</span><span>score {total:.1f} · lead {lead:.2f} · {tag}'
                f'{" · " + html.escape(p["duration"]) if p.get("duration") else ""}</span></a>')

    page = f"""<!doctype html><html><head><meta charset="utf-8"><title>frgi leads</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{{font:14px system-ui,sans-serif;margin:16px;background:#f6f4ef;color:#222}}
h1{{font-size:20px}} h2{{font-size:16px;margin-top:28px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}}
.card{{display:flex;flex-direction:column;gap:4px;background:#fff;border-radius:10px;padding:8px;text-decoration:none;color:inherit;box-shadow:0 1px 3px #0002}}
.card img,.noimg{{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6px;background:#ddd}}
.card span{{font-size:12px;color:#666}}
</style></head><body><h1>frgi leads, {time.strftime('%Y-%m-%d %H:%M')}</h1>
<p>Open these in the frgi browser window. Each one you open adds its "More to explore" pins as new leads.</p>
<h2>Open next (leads)</h2><div class="grid">{''.join(card(*x) for x in nxt) or '<p>No leads yet: open a few Zimbabwe video pins first.</p>'}</div>
<h2>Best Zimbabwe videos so far</h2><div class="grid">{''.join(card(*x) for x in best)}</div>
</body></html>"""
    (f.HOME / "leads.html").write_text(page, encoding="utf-8")


def capture_summary(path):
    try:
        j = json.loads(Path(path).read_text(encoding="utf-8"))
        pages = j.get("pages") or [{}]
        return len(j.get("pins", [])), pages[0].get("url", "?")
    except Exception as e:
        return 0, f"unreadable ({e})"


def explain_empty(f, caps):
    """No pins: show what the captures hold, then look for captures with pins in other toolkit folders."""
    if caps:
        print("\n  These captures hold no pins (a page was open, but no pin cards were recorded):")
        for c in caps[-8:]:
            n, url = capture_summary(c)
            print(f"    {Path(c).name}: {n} pins, page {url}")
    mine = {Path(c).resolve() for c in caps}
    roots = [Path.home() / "Downloads", Path.home() / "Desktop", Path.home() / "Documents", HERE.parent]
    found = []
    for root in roots:
        if not root.is_dir():
            continue
        for pat in ("*/frgi-work/captures/*.json", "*/*/frgi-work/captures/*.json", "frgi-work/captures/*.json"):
            for c in root.glob(pat):
                if c.resolve() not in mine and capture_summary(c)[0] > 0:
                    found.append(c)
    found = sorted(set(found), key=lambda c: c.stat().st_mtime)
    if not found:
        print("\n  No captures with pins found in other toolkit folders either.")
        print("  Browse again: open a search from the keywords tab, SCROLL the results, open a few video pins,")
        print("  and watch the 'recording: N pins' counter in this window rise before closing the browser.")
        return
    total = sum(capture_summary(c)[0] for c in found)
    print(f"\n  Found {len(found)} capture file(s) with {total} pins in other folders:")
    for c in found[-10:]:
        print(f"    {c}  ({capture_summary(c)[0]} pins)")
    if ask("Import them into this workspace?", "y"):
        dest = f.HOME / "captures"
        dest.mkdir(parents=True, exist_ok=True)
        for c in found:
            (dest / c.name).write_bytes(c.read_bytes())
        run(f, "ingest", *[dest / c.name for c in found])


def cmd_process(a, f):
    banner("process")
    caps = sorted((f.HOME / "captures").glob("*.json")) + [Path(x) for x in a.captures]
    if caps:
        run(f, "ingest", *caps)
    else:
        print("  no captures yet (run browse, or pass bookmarklet exports: process <file.json> ...)")
    L = f.load_ledger()
    if not L["pins"]:
        explain_empty(f, caps)
        L = f.load_ledger()
    if not L["pins"]:
        return
    print("\nTop Zimbabwe videos:")
    run(f, "rank", "--video", "-n", a.top)
    print("\nLeads to open next:")
    run(f, "next", "-n", min(a.top, 10))
    write_leads_html(f, L, a.top)
    run(f, "draft", "-n", a.top)
    pending = [p for _, _, p in f.ranked(L) if p.get("is_video") and p["rights"]["status"] == "pending"
               and p.get("relevance", {}).get("zimbabwe") and not p.get("relevance", {}).get("off_target")][: a.top]
    if pending:
        req = f.HOME / "permission_requests.txt"
        with open(req, "a", encoding="utf-8") as out:
            for p in pending:
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf):
                    run(f, "ask", p["id"])
                creator = (p.get("creator") or {}).get("url") or p.get("creator_path") or "(open the pin to find the creator)"
                out.write(f"--- pin {p['id']}  creator: {creator}\n{buf.getvalue()}\n")
        print(f"\n  {len(pending)} permission messages added to {req}")
    print(f"  leads page: {f.HOME / 'leads.html'}")
    print(f"  caption drafts: {f.HOME / 'candidates.json'}")


# ---------- permissions ----------

def cmd_permissions(a, f):
    banner("permissions")
    L = f.load_ledger()
    todo = [p for p in L["pins"].values() if p["rights"]["status"] == "requested"]
    if not todo:
        print("  nothing awaiting an answer (process writes requests; send them first)")
        return
    print("For each request you sent: did the creator say yes?  y = yes, n = no, Enter = still waiting")
    for p in todo:
        r = p.get("relevance", {})
        print(f"\n  {p['id']}  {p.get('title') or p.get('alt') or ''}\n  {p['url']}  "
              f"{', '.join(r.get('places', []) + r.get('species', []))}")
        try:
            ans = input("  answer [y/n/Enter]: ").strip().lower()
        except EOFError:
            ans = ""
        if ans.startswith("y"):
            note = ""
            while not note:
                note = input("  who said yes, where, and how to credit (e.g. IG DM @name 2026-10-04, credit @name): ").strip()
            run(f, "rights", p["id"], "permission", "--note", note)
        elif ans.startswith("n"):
            run(f, "rights", p["id"], "declined", "--note", "creator declined or no reply")


# ---------- download / package / bundle ----------

def cmd_download(a, f):
    banner("download")
    if not f.load_ledger()["pins"]:
        print("  No pins yet, so nothing to download. Run Browse first:  python run_all.py start")
        return
    run(f, "fetch")
    for x in a.attach or []:
        ref, _, path = x.partition("=")
        run(f, "attach", ref, path)


def cmd_package(a, f):
    banner("package")
    stamp = time.strftime("%Y%m%d-%H%M")
    out = Path(a.out or Path.cwd() / f"{f.PREFIX}_captions_{stamp}.zip")
    args = ["pack", "--out", out] + (["--with-media"] if a.with_media else [])
    if run(f, *args):
        print("  Upload this zip to Claude for caption correction, then: python run_all.py apply <corrected zip>")


def cmd_bundle(a, f):
    banner("bundle")
    out = Path(a.out or HERE / "frgi_KCERMEDIA_toolkit.zip").resolve()
    files = ["run_all.py", "frgi.py", "grabber.js", "pw_session.mjs", "zimbabwe_keywords.json",
             "README.md", "RESEARCH.md", ".gitignore", "instagram/post_kcermedia_reels.py"]
    skill = HERE.parent / ".claude" / "skills" / "frgi-pinterest-curation" / "SKILL.md"
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        f.main(["bookmarklet"])
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n in files:
            if (HERE / n).exists():
                z.write(HERE / n, f"frgi/{n}")
        for t in sorted((HERE / "tests").rglob("*")):
            if t.is_file():
                z.write(t, f"frgi/{t.relative_to(HERE).as_posix()}")
        z.writestr("frgi/bookmarklet.txt", buf.getvalue())
        if skill.exists():
            z.write(skill, "frgi/skill/frgi-pinterest-curation/SKILL.md")
        z.writestr("frgi/START_HERE.txt", START_HERE)
    print(f"  {out}")
    with zipfile.ZipFile(out) as z:
        for n in z.namelist():
            print("   ", n)


START_HERE = """frgi: Zimbabwe wildlife videos, Pinterest -> Instagram

1. Install Python 3.9+ (python.org).
2. In this folder:  python run_all.py setup     (optional: option 1 installs Playwright + Chromium itself)
3. Then:            python run_all.py start     (Chromium opens: browse, close it -> ranked)
   or:              python run_all.py           (guided menu: browse, process, permissions,
                                                 download, package)
4. Upload the KCERMEDIA_captions_<date>.zip it makes to Claude for caption correction,
   then:            python run_all.py apply <corrected zip>

No Playwright? Use the bookmarklet instead: paste bookmarklet.txt into a new bookmark's URL,
click it on pinterest.com, export, then: python run_all.py process <export.json>

Full guide: README.md   Research basis: RESEARCH.md   Claude skill: skill/
"""


# ---------- menu ----------

MENU = [
    ("1", "Browse Pinterest (records as you scroll)", "browse"),
    ("2", "Process captures: rank, leads page, caption drafts, permission messages", "process"),
    ("3", "Record creators' answers", "permissions"),
    ("4", "Download cleared videos (KCERMEDIA numbers)", "download"),
    ("5", "Package captions + descriptions zip", "package"),
    ("6", "Apply corrected captions zip", "apply"),
    ("7", "Show ranking", "rank"),
    ("k", "Search keywords", "keywords"),
    ("8", "Bundle the toolkit zip", "bundle"),
    ("9", "Setup (install Playwright)", "setup"),
    ("0", "Quit", None),
]


def cmd_menu(a, f):
    while True:
        L = f.load_ledger()
        n = len(L["pins"])
        cleared = sum(p["rights"]["status"] in f.CLEARED for p in L["pins"].values())
        numbered = sum(bool(p.get("number")) for p in L["pins"].values())
        banner(f"frgi  |  {n} pins · {cleared} cleared · {numbered} numbered · next {L.get('prefix', f.PREFIX)}_{L['next_number']}")
        waiting = len(list((f.HOME / "captures").glob("*.json"))) if (f.HOME / "captures").exists() else 0
        if n == 0 and waiting:
            print(f"  {waiting} recorded capture file(s) not processed yet: choose 2 (Process).")
        elif n == 0:
            print("  No pins yet: start with 1 (Browse). A Chromium window opens; search Pinterest for")
            print("  Zimbabwe safari videos, scroll and open pins, then close the window and choose 2.")
        for k, label, _ in MENU:
            print(f"  {k}. {label}")
        try:
            c = input("choose: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        cmd = dict((k, v) for k, _, v in MENU).get(c, "?")
        if cmd is None:
            return
        if cmd == "?":
            continue
        if cmd == "apply":
            a.source = input("path to corrected zip: ").strip().strip('"')
        try:
            {"rank": lambda a, f: run(f, "rank", "-n", a.top), "apply": cmd_apply}.get(cmd, COMMANDS.get(cmd))(a, f)
        except SystemExit as e:
            print(f"  ! {e.code}")
        except KeyboardInterrupt:
            print("\n  stopped")


def cmd_apply(a, f):
    banner("apply")
    run(f, "apply", a.source)


def cmd_publish(a, f):
    banner("publish")
    run(f, "publish", a.ref, "--video-url", a.video_url, *(["--go"] if a.go else []),
        *(["--force-draft"] if a.force_draft else []))


def cmd_start(a, f):
    cmd_browse(a, f)
    print("\nNext: send the messages in frgi-work\\permission_requests.txt, then run:  python run_all.py permissions")


def cmd_all(a, f):
    cmd_browse(a, f)
    print("\nSend the messages in permission_requests.txt, then come back and record the answers.")
    if ask("Record answers now?"):
        cmd_permissions(a, f)
    cmd_download(a, f)
    cmd_package(a, f)


COMMANDS = {"start": cmd_start, "keywords": cmd_keywords, "setup": cmd_setup, "browse": cmd_browse, "process": cmd_process, "permissions": cmd_permissions,
            "download": cmd_download, "package": cmd_package, "bundle": cmd_bundle, "apply": cmd_apply,
            "publish": cmd_publish, "all": cmd_all, "menu": cmd_menu}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="run_all", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="?", default="menu", choices=sorted(COMMANDS))
    ap.add_argument("rest", nargs="*", help="capture files (process), corrected zip (apply), KCERMEDIA id (publish)")
    ap.add_argument("--home", default=os.environ.get("FRGI_HOME", "frgi-work"))
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--chrome", action="store_true", help="use installed Google Chrome")
    ap.add_argument("--with-media", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--attach", action="append", help="download: PIN=path/to/creator_original.mp4")
    ap.add_argument("--video-url"); ap.add_argument("--go", action="store_true")
    ap.add_argument("--force-draft", action="store_true")
    a = ap.parse_args(argv)
    a.captures = a.rest if a.cmd == "process" else []
    if a.cmd == "apply":
        if not a.rest:
            ap.error("apply needs the corrected zip path")
        a.source = a.rest[0]
    if a.cmd == "publish":
        if not (a.rest and a.video_url):
            ap.error("publish needs <KCERMEDIA_n> --video-url <public https url>")
        a.ref = a.rest[0]
    f = frgi_module(Path(a.home).resolve())
    try:
        COMMANDS[a.cmd](a, f)
    except KeyboardInterrupt:
        print("\n  stopped")


if __name__ == "__main__":
    main()
