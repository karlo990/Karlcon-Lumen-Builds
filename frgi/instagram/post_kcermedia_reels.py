r"""
post_kcermedia_reels.py
────────────────────────────────────────────────────────────────────────
Posts frgi's numbered wildlife videos to Instagram as Reels, each with
its reviewed caption. Sits next to Post.py / ig_carousel_poster.py and
reuses Post.py's browser, login, caption and publish helpers unchanged.

WHAT IT READS (frgi workspace, default .\frgi-work):
    media\KCERMEDIA_101.mp4          the video (frgi download/attach)
    captions\KCERMEDIA_101.json      caption_final (from `run_all.py apply`),
                                     rights, creator, instagram status

WHICH ITEMS IT POSTS
    - rights status is own / permission / licensed (frgi's gate; never bypassed)
    - the video file exists
    - not already posted (instagram.status != "published")
    - caption_final is set (reviewed). --allow-draft uses caption_draft instead.
    - the caption credits the creator by name: a "[creator]" placeholder is
      filled in, a missing credit line is added, and an item whose creator is
      unknown is skipped. Your own footage is credited to --own-credit.

RESUMABLE: after every attempt the caption JSON's "instagram" block is
rewritten (status, posted_at, url, error), so re-running skips what is
already published and retries failures.

PACING: Instagram web posting publishes immediately, so this posts at most
--daily-limit Reels per run (default 4) with a 45-90 s pause between them.
Run it once a day (Task Scheduler) instead of raising the cap.

Usage (from the folder that holds Post.py):
    python post_kcermedia_reels.py --frgi-home "C:\...\frgi\frgi-work" --dry-run
    python post_kcermedia_reels.py --frgi-home "C:\...\frgi\frgi-work" --limit 1
    python post_kcermedia_reels.py --frgi-home "C:\...\frgi\frgi-work" --only KCERMEDIA_103
    python post_kcermedia_reels.py --frgi-home "C:\...\frgi\frgi-work" --profile-dir "C:\PW_Profiles\ig"
"""

from __future__ import annotations

import argparse
import inspect
import json
import random
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

CAT = timezone(timedelta(hours=2))
CLEARED = {"own", "permission", "licensed"}
IG_CAPTION_MAX = 2200
DEFAULT_DAILY_LIMIT = 4
VIDEO_EXTS = (".mp4", ".mov", ".m4v")


# ─────────────────────────────────────────────────────────────────────────────
# frgi workspace
# ─────────────────────────────────────────────────────────────────────────────
def _num(item_id: str) -> int:
    m = re.search(r"_(\d+)$", item_id)
    return int(m.group(1)) if m else 0


def find_video(home: Path, rec: dict) -> Path | None:
    f = rec.get("file") or {}
    if f.get("path"):
        p = (home / f["path"]).resolve()
        if p.exists():
            return p
    for ext in VIDEO_EXTS:
        p = home / "media" / f"{rec['id']}{ext}"
        if p.exists():
            return p
    return None


def caption_text(rec: dict, allow_draft: bool, own_credit: str = "") -> str | None:
    cap = rec.get("caption_final")
    if not cap and allow_draft:
        cap = rec.get("caption_draft")
    if not cap:
        return None
    text = cap.get("full_text") if isinstance(cap, dict) else str(cap)
    text = (text or "").strip()
    creator = ((rec.get("creator") or {}).get("name") or "").strip()
    if not creator and rec.get("rights", {}).get("status") == "own":
        creator = own_credit
    if "[creator]" in text:
        if not creator:
            return None
        text = text.replace("[creator]", creator)
    if not creator:
        return None
    if creator and creator.lower() not in text.lower():
        text = f"{text}\n\nVideo: {creator} - shared with permission."
    return text[:IG_CAPTION_MAX]


def load_queue(home: Path, allow_draft: bool, only: set[str] | None, own_credit: str = ""):
    ready, skipped = [], []
    for path in sorted((home / "captions").glob("*.json"), key=lambda p: _num(p.stem)):
        rec = json.loads(path.read_text(encoding="utf-8"))
        rid = rec.get("id", path.stem)
        if only and rid not in only:
            continue
        status = (rec.get("rights") or {}).get("status")
        ig = rec.get("instagram") or {}
        if ig.get("status") == "published":
            skipped.append((rid, "already published"))
            continue
        if status not in CLEARED:
            skipped.append((rid, f"rights '{status}' not cleared"))
            continue
        video = find_video(home, rec)
        if not video:
            skipped.append((rid, "video file missing (run frgi download/attach)"))
            continue
        text = caption_text(rec, allow_draft, own_credit)
        if not text:
            has_cap = rec.get("caption_final") or (allow_draft and rec.get("caption_draft"))
            skipped.append((rid, "creator credit unknown (set creator in the caption JSON)" if has_cap
                            else "caption not reviewed (apply corrected zip, or --allow-draft)"))
            continue
        ready.append((path, rec, video, text))
    return ready, skipped


def record_result(path: Path, ok: bool, url: str | None, error: str | None) -> None:
    rec = json.loads(path.read_text(encoding="utf-8"))
    ig = rec.get("instagram") or {}
    ig.update({
        "media_type": "REELS",
        "status": "published" if ok else "failed",
        "via": "instagram.com (Post.py)",
        "url": url,
        "error": error,
        "posted_at" if ok else "last_attempt_at": datetime.now(CAT).strftime("%Y-%m-%d %H:%M CAT"),
        "attempts": ig.get("attempts", 0) + 1,
    })
    rec["instagram"] = ig
    path.write_text(json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Posting: Post.post_reel when its signature fits, else a flow built from the
# same Post.py helpers ig_carousel_poster.py already relies on.
# ─────────────────────────────────────────────────────────────────────────────
def _post_reel_fn(P):
    fn = getattr(P, "post_reel", None)
    if not fn:
        return None
    try:
        params = list(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        return None
    return fn if len(params) >= 3 else None


def _select_video(P, page, video: Path) -> bool:
    if not P._wait_for(page, 'input[type="file"]', timeout_s=15.0):
        print("[reel] ✗ file input not found")
        return False
    try:
        page.locator('input[type="file"]').first.set_input_files(str(video))
        print(f"[reel] ✓ video injected: {video.name}")
        P._jitter(1500, 2500)
        return True
    except Exception as e:
        print(f"[reel] ✗ file injection failed: {e}")
        return False


def _advance_to_caption(P, page) -> bool:
    deadline = time.time() + P.UPLOAD_TIMEOUT_S
    while time.time() < deadline:
        if not P.page_alive(page):
            return False
        # "Video posts are now shared as reels" notice on first video upload
        if P._click_by_text(page, r"^ok$", timeout_s=0.5):
            P._jitter(400, 800)
        if page.locator('[role="progressbar"], svg[aria-label*="Loading"]').count() == 0:
            break
        page.wait_for_timeout(250)
    for screen in ("Crop", "Edit"):
        P._jitter(600, 1100)
        if P._click_by_text(page, r"^next$", timeout_s=12.0):
            print(f"[reel] ✓ Next ({screen} screen)")
        elif P._wait_for(page, 'div[contenteditable="true"][role="textbox"]', timeout_s=2.0):
            break
        else:
            print(f"[reel] ✗ Next not found on {screen} screen")
            return False
        P._jitter(800, 1400)
    if P._wait_for(page, 'div[contenteditable="true"][role="textbox"]', timeout_s=10.0):
        print("[reel] ✓ caption screen reached")
        return True
    print("[reel] ✗ caption screen not found")
    return False


def post_reel_own(P, page, video: Path, caption: str, retries: int) -> bool:
    for attempt in range(1, retries + 1):
        print(f"{'─' * 50}\nReel attempt {attempt}/{retries}\n{'─' * 50}")
        try:
            P._safe_goto(page, P.IG_HOME, retries=2)
            P._jitter(1500, 2500)
            if any(x in page.url for x in ("accounts/login", "challenge", "checkpoint")):
                P.wait_for_login(page)
        except Exception as e:
            if not P.page_alive(page):
                raise
            print(f"[reel] navigation/login failed: {e}")
            continue
        steps = [
            ("click_create", lambda: P.click_create(page)),
            ("select_video", lambda: _select_video(P, page, video)),
            ("advance_to_caption", lambda: _advance_to_caption(P, page)),
            ("enter_caption_share", lambda: P.enter_caption_and_share(page, caption)),
        ]
        failed = next((name for name, fn in steps if not fn()), None)
        if failed:
            print(f"[reel] step '{failed}' failed on attempt {attempt}")
            P._recover(page)
            continue
        if P.wait_for_publish(page):
            return True
        print(f"[reel] publish confirmation failed (attempt {attempt})")
        P._recover(page)
        if attempt < retries:
            time.sleep(random.uniform(8, 12))
    return False


def post_one(P, page, video: Path, caption: str, retries: int, engine: str) -> bool:
    fn = _post_reel_fn(P) if engine in ("auto", "post") else None
    if fn:
        params = inspect.signature(fn).parameters
        kwargs = {"retries": retries} if "retries" in params else {}
        return bool(fn(page, str(video), caption, **kwargs))
    if engine == "post":
        raise RuntimeError("Post.post_reel not found or has an unexpected signature; use --engine own")
    return post_reel_own(P, page, video, caption, retries)


# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="Post frgi KCERMEDIA videos to Instagram as Reels",
                                 formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument("--frgi-home", type=Path, default=Path("frgi-work"),
                    help="frgi workspace folder (holds media\\ and captions\\)")
    ap.add_argument("--profile-dir", default=r"C:\PW_Profiles\ig",
                    help="Instagram-logged-in profile (same as ig_login.py / Post.py)")
    ap.add_argument("--profile", default="Default")
    ap.add_argument("--browser", choices=["chrome", "chromium"], default="chrome")
    ap.add_argument("--force-kill", action="store_true")
    ap.add_argument("--daily-limit", type=int, default=DEFAULT_DAILY_LIMIT)
    ap.add_argument("--limit", type=int, help="override the daily limit for this run")
    ap.add_argument("--only", nargs="+", help="post only these ids, e.g. KCERMEDIA_103")
    ap.add_argument("--own-credit", default="@karlcon_elite_retreats_zw",
                    help="credit used for your own footage (rights 'own')")
    ap.add_argument("--allow-draft", action="store_true", help="post caption_draft when no caption_final")
    ap.add_argument("--engine", choices=["auto", "post", "own"], default="auto",
                    help="auto: Post.post_reel if compatible, else the built-in reel flow")
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true", help="list what would be posted, then stop")
    a = ap.parse_args()

    home = a.frgi_home.resolve()
    if not (home / "captions").is_dir():
        sys.exit(f"no captions folder in {home} - pass --frgi-home <path to frgi-work>")
    ready, skipped = load_queue(home, a.allow_draft, set(a.only) if a.only else None, a.own_credit)
    cap = a.limit if a.limit is not None else a.daily_limit
    batch = ready[:cap]

    print("=" * 60)
    print(f"  KCERMEDIA reels  |  ready {len(ready)}  this run {len(batch)}  skipped {len(skipped)}")
    print("=" * 60)
    for rid, why in skipped:
        print(f"  skip {rid}: {why}")
    for path, rec, video, text in batch:
        first = text.splitlines()[0] if text else ""
        print(f"  post {rec['id']}: {video.name}  |  {first[:70]}")
    if a.dry_run or not batch:
        print("\n(dry run)" if a.dry_run else "\nnothing to post")
        return

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        import Post as P
    except ImportError:
        sys.exit("Post.py must sit next to this script (it provides the browser/login/share helpers)")

    posted = 0
    try:
        with P.open_browser(a.profile_dir, a.profile, a.browser, a.force_kill) as page:
            P.wait_for_login(page)
            for n, (path, rec, video, text) in enumerate(batch, 1):
                print(f"\n[{n}/{len(batch)}] {rec['id']}  ({video.name})")
                try:
                    ok = post_one(P, page, video, text, a.retries, a.engine)
                    err = None if ok else "post failed - see console log"
                except Exception as e:
                    if not P.page_alive(page):
                        record_result(path, False, None, f"browser died: {e}")
                        raise
                    ok, err = False, str(e)
                url = page.url if ok and re.search(r"/(reel|reels|p)/", page.url or "") else None
                record_result(path, ok, url, err)
                print(f"[{'OK' if ok else 'FAIL'}] {rec['id']}" + (f"  {url}" if url else ""))
                if ok:
                    posted += 1
                    P._post_success_reset(page)
                    if n < len(batch):
                        wait = random.uniform(45, 90)
                        print(f"     waiting {wait:.0f}s before the next reel...")
                        time.sleep(wait)
    except KeyboardInterrupt:
        print("\nstopped by user - progress is saved in each caption JSON")
    print(f"\nDone: {posted}/{len(batch)} reels posted this run.")


if __name__ == "__main__":
    main()
