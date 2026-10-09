# Builders post format (daily job)

How the weekday "Builders today" card in `data/feed.json` is shaped. This file is
NOT published (`docs/` is the GitHub Pages output; this lives in `docs-internal/`).

## Card

```jsonc
{
  "id": "ai-YYYYMMDD-builders-today",      // unique, stable
  "category": "ai",
  "title": "Builders today — Oct 8, 2026",
  "body": "Two-line gist shown on the feed card. Inline markdown OK.",
  "source": "X builders watch · Oct 8, 2026 CT · Name · Name …",
  "tags": ["ai", "builders", "…"],
  "accent": "teal",
  "image": "https://…",                    // optional hero
  "link": "https://x.com/<lead post>",
  "detail": {
    "tldr": "1–2 lines, one per \\n. Inline markdown.",
    "tldrBullets": ["Name: point with **bold** key phrase", "…"],
    "summary": "Short framing paragraph.",
    "sections": [ /* see Section */ ],
    "bullets": ["Name: key point", "…"],     // renders as "Key points"
    "actions": [{ "label": "Name - what", "url": "https://x.com/…" }],
    "sources": [{ "label": "Name @handle", "url": "https://x.com/…" }]
  }
}
```

## Section

```jsonc
{
  "heading": "Tests as source of truth",   // short; gets the section's color
  "body": "Paragraphs split by blank lines (\\n\\n). Inline markdown.",
  "tweets":  [ /* 1–3 Tweet objects, see below; optional */ ],
  "quote":   { "text": "Best line, verbatim", "by": "Matt Pocock" },   // optional
  "callout": { "kind": "why" | "try", "text": "One or two sentences." } // optional
}
```

Render order inside a section: colored heading → body → **tweet cards** → pull quote → callout.
Section colors rotate automatically (blue, violet, emerald, pink, cyan, gold). Never add orange or left bars.

### Inline markdown (body, tldr, bullets, callout, quote)

| Syntax | Result |
| --- | --- |
| `**text**` | bold key phrase with tinted highlight. Use 1–3 per paragraph. |
| `[label](url)` | link |
| `` `code` `` | code chip (skill names like `/wait-what`) |
| `==44-task==` | stat chip. `%` and `$` amounts are auto-chipped. |
| `@handle` | colored handle chip |
| `Name: rest` at line start (≤24 chars) | colored lead name (bullets, tldrBullets) |
| lines starting `- ` | bulleted list (2+ consecutive lines) |
| `> text -- Name` | pull quote inside body |

## Tweet (X-style card)

```jsonc
{
  "id": "2108054698213396821",
  "url": "https://x.com/GeoffreyHuntley/status/2108054698213396821",
  "author": {
    "name": "geoff",
    "username": "GeoffreyHuntley",
    "avatar": "https://pbs.twimg.com/profile_images/…_normal.jpg", // hotlinked; colored initial if it fails
    "verified": true,
    "verified_type": "blue"            // blue | business | government | none
  },
  "created_at": "2026-10-08T04:39:40.000Z",
  "text": "Full post text (note_tweet.text when present), leading reply @mentions removed, trailing media t.co removed",
  "reply_to": ["kunchenguid"],         // optional → "Replying to @kunchenguid"
  "urls": [{ "url": "https://t.co/…", "expanded_url": "https://…", "display_url": "x.com/…" }], // optional, non-media links
  "media": [{ "type": "photo" | "video" | "animated_gif", "url": "https://pbs.twimg.com/media/…", "width": 1200, "height": 630 }],
  "public_metrics": { "reply_count": 4, "repost_count": 2, "quote_count": 0, "like_count": 165, "impression_count": 7206 }
}
```

- Text over 280 chars is cut at a word and shows "Show more" (opens the post).
- Repost count shown = `repost_count + quote_count`, like X.
- Fallback: a tweet with only `{ "url": … }` (optionally `author.username`) renders a simple "View post on X" link card. Use this when a fetch fails. Never invent text or metrics.

## Daily job steps

1. Write the section prose as usual. For each section pick the 1–3 most relevant posts and put placeholders: `"tweets": [{ "url": "https://x.com/<user>/status/<id>" }]`.
2. Fetch all picked ids in ONE call (max 100 ids; X budget is 30 reads/min, shared 429s happen, wait ~60s and retry):
   `x.get_posts_by_ids` with
   - `ids`: comma-separated
   - `expansions`: `author_id,attachments.media_keys`
   - `user.fields`: `name,username,profile_image_url,verified,verified_type`
   - `post.fields`: `created_at,public_metrics,entities,attachments,note_tweet`
   - `media.fields`: `url,preview_image_url,type,width,height,alt_text`
3. Save the raw JSON response to a file, then hydrate:
   `node scripts/hydrate-tweets.mjs --raw /tmp/posts.json --card ai-YYYYMMDD-builders-today`
   (any id the API didn't return becomes a link fallback card; the script prints counts).
4. `npm run build` (copies `data/feed.json` into `public/` + `docs/`), check the card at 390px in light and dark, commit.
