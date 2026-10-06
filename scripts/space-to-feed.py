#!/usr/bin/env python3
"""
Space Digest → Captain Feed card converter.

Picks today's space topic, fetches a NASA image, and appends a card
to docs/data/feed.json in the captain-feed card schema.

Run daily via cron or manually:  python3 scripts/space-to-feed.py
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FEED_JSON = REPO / "data" / "feed.json"
DATA_FILE = Path("/opt/data/scripts/space-content-data.py")

NASA_APOD = "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true"
NASA_IMAGES = "https://images-api.nasa.gov/search"

# ── Load topic data ─────────────────────────────────────────────

def load_topics():
    ns = {}
    if DATA_FILE.exists():
        exec(DATA_FILE.read_text(), ns)
    return ns.get("TOPICS", []), ns.get("pick_topic_rich", lambda d: None)


def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "SpaceDigest/2.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def try_fetch_json(url):
    try:
        return fetch_json(url)
    except Exception:
        return None


def nasa_image(query):
    params = urllib.parse.urlencode({"q": query, "media_type": "image", "page_size": 8})
    data = try_fetch_json(f"{NASA_IMAGES}?{params}") or {}
    items = data.get("collection", {}).get("items", [])
    for item in items:
        links = item.get("links") or []
        href = next((l.get("href") for l in links if l.get("href")), None)
        if href:
            return href
    return None


def apod():
    data = try_fetch_json(NASA_APOD) or {}
    return {
        "url": data.get("hdurl") or data.get("url") or "",
        "title": data.get("title", "NASA APOD"),
        "explanation": re.sub(r"\s+", " ", data.get("explanation", "")).strip()[:400],
        "date": data.get("date", ""),
    }


# ── Card builder ────────────────────────────────────────────────

def build_space_card(topic, today_str):
    name = topic["name"]
    subtitle = topic.get("subtitle", "")
    lead = topic.get("lead", "")
    columns = topic.get("columns", [])
    numbers = topic.get("numbers", [])
    sources = topic.get("sources", [])
    query = topic.get("query", name)

    image_url = nasa_image(query) or f"https://picsum.photos/seed/space-{name.lower()}-{today_str}/800/520"

    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    date_slug = today_str.replace("-", "")
    card_id = f"space-{date_slug}-{slug}"

    sections = [{"heading": h, "body": b} for h, b in columns]
    bullets = [f"{label}: {value}" for label, value in numbers]
    source_items = [{"label": label, "url": url} for label, url in sources]

    apod_data = apod()
    if apod_data.get("url"):
        sections.append({
            "heading": "\ud83d\udd2d APOD \u2014 Astronomy Picture of the Day",
            "body": f"{apod_data['title']}\n\n{apod_data['explanation']}"
        })
        source_items.append({
            "label": f"NASA APOD \u2014 {apod_data.get('date', today_str)}",
            "url": "https://apod.nasa.gov/apod/"
        })

    summary = lead
    if columns:
        summary += f"\n\n{columns[0][1][:300]}\u2026"

    tags = [name.lower(), "space", "nasa", topic.get("kind", "astronomy")]
    if topic.get("kind") == "planet":
        tags.append("solar-system")

    return {
        "id": card_id,
        "category": "space",
        "title": f"{name} \u2014 {subtitle}",
        "body": lead[:280] + "\u2026" if len(lead) > 280 else lead,
        "source": f"Daily Space Field Note \u00b7 {today_str}",
        "tags": tags,
        "accent": "ink",
        "image": image_url,
        "link": "https://shenoyabhijith.github.io/daily-space-digest/",
        "detail": {
            "tldr": lead[:200] + "\u2026" if len(lead) > 200 else lead,
            "tldrBullets": bullets[:5],
            "summary": summary,
            "sections": sections,
            "bullets": bullets,
            "actions": [
                {"label": "View on Daily Space Digest", "url": "https://shenoyabhijith.github.io/daily-space-digest/"},
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
    return [c for c in cards if not c["id"].startswith("space-") or c.get("source", "").find(cutoff) == -1]


# ── Main ────────────────────────────────────────────────────────

def main():
    today = dt.date.today()
    today_str = today.isoformat()

    topics, pick_fn = load_topics()
    if not topics:
        print("No topics found", file=sys.stderr)
        return 1

    topic = pick_fn(today) if pick_fn else topics[today.toordinal() % len(topics)]
    if not topic:
        print("pick_topic_rich returned None", file=sys.stderr)
        return 1

    card = build_space_card(topic, today_str)
    feed = load_feed()

    if any(c["id"] == card["id"] for c in feed["cards"]):
        print(f"[SKIP] {card['id']} already in feed")
        return 0

    feed["cards"].insert(0, card)
    feed["cards"] = prune_old_cards(feed["cards"])
    save_feed(feed)
    print(f"\U0001f680 {card['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())