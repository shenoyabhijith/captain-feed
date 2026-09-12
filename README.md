# Captain Feed

React + PWA daily-dose feed on GitHub Pages.

Live: https://shenoyabhijith.github.io/captain-feed/

## Android install

1. Open the live URL in Chrome on Android.
2. Tap the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. If an **Install** button shows in the feed header, you can use that too (`beforeinstallprompt`).

## Update cards (Firstmate)

Edit `data/feed.json`, then from repo root:

```bash
npm run build
git add data/feed.json docs
git commit -m "Update feed cards"
git push
```

Or ask Builder to rebuild after you push JSON-only changes.

### Card schema

List fields (required): `id`, `category` (`book|tax|trend|aws|deal|gym`), `title`, `body` (teaser), optional `source`, `tags`, `accent`, `image`, `link`.

Detail fields (recommended):

```json
"detail": {
  "summary": "Longer lede",
  "sections": [{ "heading": "...", "body": "..." }],
  "bullets": ["..."],
  "steps": ["..."],
  "actions": [{ "label": "...", "url": "https://..." }],
  "sources": [{ "label": "...", "url": "https://..." }]
}
```

Old cards without `detail` still open; the teaser body is shown.

## Dev

```bash
npm install
npm run dev
npm run build
```

GitHub Pages serves the `docs/` folder from `main`.
