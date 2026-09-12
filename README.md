# Captain Feed

Mobile-first daily-dose feed on GitHub Pages. Public-safe static site. No database and no login.

Live: https://shenoyabhijith.github.io/captain-feed/

## Update cards

Edit `data/feed.json`, then commit and push to `main`. Pages rebuilds from the repo root.

Card shape:

```json
{
  "id": "unique-id",
  "category": "book|tax|trending|aws|deals|gym",
  "title": "Short headline",
  "body": "One or two sentences.",
  "source": "Attribution label",
  "tags": ["optional"],
  "accent": "coral|teal|amber|ink",
  "image": "https://...",
  "link": "https://optional-related-url"
}
```

Progress (read / saved / seen) lives only in the visitor browser via `localStorage`.

## Local

Open `index.html` through any static server from the repo root (fetch needs HTTP).
