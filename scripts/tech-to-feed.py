#!/usr/bin/env python3
"""
Tech Digest → Captain Feed card converter.

Collects tech news from HN + Reddit + RSS feeds and appends a card
to docs/data/feed.json in the captain-feed card schema.

Run daily via cron or manually:  python3 scripts/tech-to-feed.py
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FEED_JSON = REPO / "data" / "feed.json"

# Import data collection from the existing all-tech-pdf-digest
SCRIPTS_DIR = Path("/opt/data/scripts")
sys.path.insert(0, str(SCRIPTS_DIR))

def clean_text(s):
    """Remove surrogate chars that break UTF-8 encoding."""
    if not s:
        return s
    return s.encode("utf-8", errors="replace").decode("utf-8")



UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 hermes-agent/1.0 TechDigest/1.0"

# ── Data collection (lightweight, no PDF deps) ──────────────────

def fetch_json(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def clean_json(obj):
    """Recursively clean surrogates from JSON data."""
    if isinstance(obj, str):
        return clean_text(obj)
    if isinstance(obj, list):
        return [clean_json(x) for x in obj]
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    return obj


def fetch_text(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def fetch_hn_top(limit=10):
    """Fetch top HN stories."""
    items = []
    try:
        ids = fetch_json("https://hacker-news.firebaseio.com/v0/topstories.json")[:limit]
        for sid in ids:
            try:
                item = fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json")
                if item and item.get("title"):
                    items.append({
                        "title": item["title"],
                        "url": item.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                        "source": "Hacker News",
                        "score": item.get("score", 0),
                        "comments": item.get("descendants", 0),
                    })
            except Exception:
                continue
    except Exception as e:
        print(f"[HN] {e}", file=sys.stderr)
    return items


def fetch_reddit_rss(subreddit, limit=5):
    """Fetch top posts from a subreddit RSS."""
    items = []
    try:
        url = f"https://www.reddit.com/r/{subreddit}/top/.rss?t=day"
        xml_text = fetch_text(url)
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        for entry in root.findall("atom:entry", ns)[:limit]:
            title = (entry.findtext("atom:title", "", ns) or "").strip()
            link_el = entry.find("atom:link", ns)
            link = link_el.get("href", "") if link_el is not None else ""
            if title and link:
                items.append({
                    "title": title,
                    "url": link,
                    "source": f"r/{subreddit}",
                    "score": 0,
                })
    except Exception as e:
        print(f"[Reddit {subreddit}] {e}", file=sys.stderr)
    return items


def collect_tech_news():
    """Collect tech news from multiple sources."""
    all_items = []
    statuses = {}

    # HN
    hn = fetch_hn_top(10)
    if hn:
        all_items.extend(hn)
        statuses["Hacker News"] = f"ok ({len(hn)} stories)"
    else:
        statuses["Hacker News"] = "failed"

    # Reddit
    import time
    for sub in ["LocalLLaMA", "technology", "codex"]:
        time.sleep(1.5)  # avoid 429s
        r_items = fetch_reddit_rss(sub, 5)
        if r_items:
            all_items.extend(r_items)
            statuses[f"r/{sub}"] = f"ok ({len(r_items)} posts)"
        else:
            statuses[f"r/{sub}"] = "failed"

    return all_items, statuses


# ── Card builder ────────────────────────────────────────────────

def build_tech_card(items, statuses, today_str):
    """Build a captain-feed card from tech news items."""
    date_slug = today_str.replace("-", "")
    card_id = f"tech-{date_slug}-daily-digest"

    # Sort by score, take top 15
    items.sort(key=lambda x: x.get("score", 0), reverse=True)
    top_items = items[:15]

    # Top 3 stories as tldr bullets
    tldr_bullets = []
    for i, item in enumerate(top_items[:3]):
        score_str = f" ({item['score']}pts)" if item.get("score") else ""
        tldr_bullets.append(f"{item['title']}{score_str}")

    # Build sections by source
    source_groups = {}
    for item in top_items:
        src = item.get("source", "Unknown")
        source_groups.setdefault(src, []).append(item)

    sections = []
    for src, src_items in source_groups.items():
        body_lines = []
        for item in src_items[:5]:
            score_str = f" [{item['score']}pts]" if item.get("score") else ""
            body_lines.append(f"{item['title']}{score_str}\n{item['url']}")
        sections.append({
            "heading": f"\ud83d\udcf0 {src}",
            "body": "\n\n".join(body_lines)
        })

    # Source status section
    ok_count = sum(1 for v in statuses.values() if str(v).startswith("ok"))
    status_body = "\n".join(
        f"\u2705 {name}: {status}" if str(status).startswith("ok") else f"\u26a0\ufe0f {name}: {status}"
        for name, status in sorted(statuses.items())
    )
    sections.append({
        "heading": "\ud83d\udce1 Source Status",
        "body": f"{ok_count}/{len(statuses)} sources online\n\n{status_body}"
    })

    # Bullets
    bullets = [
        f"{len(top_items)} stories curated from {len(statuses)} sources",
        f"Top score: {top_items[0]['score']}pts ({top_items[0]['title'][:60]})" if top_items else "No stories",
        f"{ok_count}/{len(statuses)} sources healthy",
    ]

    # Source links
    source_items = []
    for item in top_items[:5]:
        source_items.append({
            "label": f"{item['title'][:60]}",
            "url": item["url"]
        })

    # Find a representative image (first HN item with a thumbnail or fallback)
    image_url = f"https://picsum.photos/seed/tech-{date_slug}/800/520"

    # Summary
    summary = f"Daily tech digest for {today_str}: {len(top_items)} stories from {ok_count} sources. "
    if top_items:
        summary += f"Top: {top_items[0]['title']}"

    return {
        "id": card_id,
        "category": "tech",
        "title": f"Tech Digest \u2014 {today_str}",
        "body": summary[:280],
        "source": f"Hermes Daily Digest \u00b7 {today_str}",
        "tags": ["tech", "ai", "hacker-news", "reddit", "daily-digest"],
        "accent": "teal",
        "image": image_url,
        "link": "https://news.ycombinator.com/",
        "detail": {
            "tldr": summary[:200],
            "tldrBullets": tldr_bullets,
            "summary": summary,
            "sections": sections,
            "bullets": bullets,
            "actions": [
                {"label": "Hacker News", "url": "https://news.ycombinator.com/"},
                {"label": "r/LocalLLaMA", "url": "https://www.reddit.com/r/LocalLLaMA/"},
                {"label": "r/technology", "url": "https://www.reddit.com/r/technology/"},
            ],
            "sources": source_items,
        },
    }


# ── Feed.json management ────────────────────────────────────────

def load_feed():
    if FEED_JSON.exists():
        return json.loads(FEED_JSON.read_text())
    return {"title": "Captain Feed", "subtitle": "Daily doses. Tap any card for the full brief.", "updated": "", "cards": []}


def save_feed(feed):
    feed["updated"] = dt.datetime.now(dt.timezone.utc).isoformat()
    with open(FEED_JSON, "w", encoding="utf-8") as f:
        f.write(json.dumps(feed, indent=2, ensure_ascii=True))
    print(f"\u2713 feed.json updated ({len(feed['cards'])} cards)")


def prune_old_cards(cards, max_days=14):
    cutoff = (dt.date.today() - dt.timedelta(days=max_days)).isoformat()
    return [c for c in cards if not c["id"].startswith("tech-") or c.get("source", "").find(cutoff) == -1]


# ── Main ────────────────────────────────────────────────────────

def main():
    today_str = dt.date.today().isoformat()

    items, statuses = collect_tech_news()
    items = clean_json(items)
    statuses = clean_json(statuses)
    if not items:
        print("No tech news collected", file=sys.stderr)
        return 1

    card = build_tech_card(items, statuses, today_str)
    feed = load_feed()

    if any(c["id"] == card["id"] for c in feed["cards"]):
        print(f"[SKIP] {card['id']} already in feed")
        return 0

    feed["cards"].insert(0, card)
    feed["cards"] = prune_old_cards(feed["cards"])
    save_feed(feed)
    print(f"\U0001f4f0 {card['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())